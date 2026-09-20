"""The two schedulers must agree, or the schedule forks per device.

frontend/src/trainer/scheduler.js and app/training/scheduler.py implement the
same Leitner rules. A card reviewed offline and synced later has to land on the
same box and due date as one reviewed online. This test reads the JS source and
fails if the numbers drift apart.

Run:  backend/venv/bin/python -m pytest backend/tests -q
"""

import re
from datetime import datetime, timedelta
from pathlib import Path

import pytest

from app.training import scheduler as py

JS = (
    Path(__file__).resolve().parent.parent.parent
    / "frontend" / "src" / "trainer" / "scheduler.js"
).read_text()


def _js_number_list(name: str) -> list[int]:
    m = re.search(rf"export const {name} = \[([^\]]*)\]", JS)
    assert m, f"{name} not found in scheduler.js"
    return [int(x) for x in m.group(1).replace(" ", "").split(",") if x]


def _js_const(name: str) -> int:
    m = re.search(rf"export const {name} = (\d+)", JS)
    assert m, f"{name} not found in scheduler.js"
    return int(m.group(1))


def test_box_intervals_match():
    assert py.BOX_DAYS == _js_number_list("BOX_DAYS")


def test_mastered_threshold_matches():
    assert py.MASTERED_BOX == _js_const("MASTERED_BOX")


def test_max_box_matches():
    assert py.MAX_BOX == len(_js_number_list("BOX_DAYS")) - 1


def test_relearn_delay_matches():
    m = re.search(r"const RELEARN_MS = (\d+) \* 60 \* 1000", JS)
    assert m, "RELEARN_MS not found in scheduler.js"
    assert py.RELEARN == timedelta(minutes=int(m.group(1)))


def test_js_still_drops_two_boxes_on_a_miss():
    # If someone changes the JS transition, this catches it even though the
    # tables still match.
    assert "Math.max(c.box - 2, 0)" in JS
    assert "Math.min(c.box + 1, MAX_BOX)" in JS


NOW = datetime(2026, 6, 15, 12, 0, 0)


@pytest.mark.parametrize("box", range(6))
def test_correct_promotes_by_one_and_schedules_the_interval(box):
    new_box, due = py.next_state(box, True, NOW)
    assert new_box == min(box + 1, py.MAX_BOX)
    assert due == NOW + timedelta(days=py.BOX_DAYS[new_box])


@pytest.mark.parametrize("box,expected", [(0, 0), (1, 0), (2, 0), (3, 1), (4, 2), (5, 3)])
def test_miss_drops_two_boxes_and_relearns_soon(box, expected):
    new_box, due = py.next_state(box, False, NOW)
    assert new_box == expected
    # A lapse must NOT be due immediately, or a cleared session is instantly
    # dirty again.
    assert due == NOW + py.RELEARN
    assert not py.is_due(due, NOW)


def test_new_material_is_due_at_once():
    assert py.is_due(NOW, NOW)


class _Stats:
    def __init__(self):
        self.day_streak = 0
        self.longest_streak = 0
        self.last_active_day = None


def test_streak_starts_extends_and_resets():
    s = _Stats()
    py.bump_streak(s, NOW)
    assert s.day_streak == 1

    py.bump_streak(s, NOW + timedelta(hours=3))      # same day
    assert s.day_streak == 1

    py.bump_streak(s, NOW + timedelta(days=1))
    assert s.day_streak == 2

    py.bump_streak(s, NOW + timedelta(days=5))       # gap
    assert s.day_streak == 1
    assert s.longest_streak == 2

"""Leitner-box spaced repetition — the server half.

MIRROR OF frontend/src/trainer/scheduler.js. The two MUST agree: a card
reviewed offline and synced later has to land on the same box and due date as
one reviewed online, or the schedule silently forks per device.

The duplication is deliberate. The alternative is server-only scheduling, which
means no offline use and a ~10s cold-start wait on Render's free tier before
the app can answer "what's due?". Keeping both to one table plus a few lines is
what makes the duplication survivable — and tests/test_scheduler_parity.py
reads the JS file and fails if the numbers drift.
"""

from datetime import datetime, timedelta

# Keep in lockstep with BOX_DAYS in scheduler.js.
BOX_DAYS = [0, 1, 3, 7, 16, 35]
MAX_BOX = len(BOX_DAYS) - 1

# A box this high counts as learned.
MASTERED_BOX = 4

# A lapse comes back after a short delay, not instantly: box 0's 0-day interval
# exists so brand-new material is available at once, but reusing it for a miss
# means a card you just got wrong is due the moment the session ends.
RELEARN = timedelta(minutes=10)


def next_state(box: int, correct: bool, now: datetime) -> tuple[int, datetime]:
    """Return the (box, due) a review produces.

    Correct promotes one box; a miss drops TWO rather than resetting to zero,
    because losing everything to a single slip makes a long repertoire
    punishing — and two boxes already puts the interval back to a day or less.
    """
    new_box = min(box + 1, MAX_BOX) if correct else max(box - 2, 0)
    due = now + (timedelta(days=BOX_DAYS[new_box]) if correct else RELEARN)
    return new_box, due


def is_due(due: datetime, now: datetime) -> bool:
    return due <= now


def day_key(moment: datetime) -> str:
    return moment.strftime("%Y-%m-%d")


def bump_streak(stats, now: datetime):
    """Roll the day streak. Same day is a no-op; a gap resets to 1.

    Mutates and returns `stats` (a TrainerStats sub-document).
    """
    today = day_key(now)
    if stats.last_active_day == today:
        return stats

    yesterday = day_key(now - timedelta(days=1))
    stats.day_streak = stats.day_streak + 1 if stats.last_active_day == yesterday else 1
    stats.longest_streak = max(stats.longest_streak, stats.day_streak)
    stats.last_active_day = today
    return stats

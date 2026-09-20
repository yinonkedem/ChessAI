from datetime import datetime

from beanie.operators import In, Inc, Set
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from pymongo import UpdateOne

from app.auth.dependencies import get_current_active_user
from app.models import TrainingCard, User
from app.training.scheduler import MASTERED_BOX, bump_streak, is_due, next_state

router = APIRouter(prefix="/training", tags=["training"])

MAX_BATCH = 200


class CardOut(BaseModel):
    repertoire_id: str
    path: str
    box: int
    due: datetime
    reps: int
    lapses: int


class ReviewIn(BaseModel):
    repertoire_id: str
    path: str
    correct: bool


class SyncIn(BaseModel):
    """A batch of reviews.

    Sent in one request at the end of a session rather than per move: the
    trainer is local-first and must not wait on a sleeping free-tier backend
    between cards.
    """

    reviews: list[ReviewIn] = Field(..., max_length=MAX_BATCH)


class SyncOut(BaseModel):
    applied: int
    skipped: int
    cards: list[CardOut]


class ProgressOut(BaseModel):
    repertoire_id: str
    seen: int
    due: int
    mastered: int


class TrainerStatsOut(BaseModel):
    reviews: int
    correct: int
    day_streak: int
    longest_streak: int


def _to_out(card: TrainingCard) -> CardOut:
    return CardOut(
        repertoire_id=card.repertoire_id,
        path=card.path,
        box=card.box,
        due=card.due,
        reps=card.reps,
        lapses=card.lapses,
    )


@router.get("/cards", response_model=list[CardOut])
async def list_cards(
    repertoire_id: str | None = Query(None),
    current_user: User = Depends(get_current_active_user),
):
    """Every card this user owns, optionally for one repertoire.

    The client merges these with whatever it has locally; the server never
    sends book content, only scheduling state.
    """
    q = TrainingCard.find(TrainingCard.user_id == current_user.id)
    if repertoire_id:
        q = q.find(TrainingCard.repertoire_id == repertoire_id)
    return [_to_out(c) for c in await q.to_list()]


@router.get("/due", response_model=list[CardOut])
async def list_due(
    repertoire_id: str | None = Query(None),
    limit: int = Query(200, ge=1, le=500),
    current_user: User = Depends(get_current_active_user),
):
    now = datetime.utcnow()
    q = TrainingCard.find(
        TrainingCard.user_id == current_user.id,
        TrainingCard.due <= now,
    )
    if repertoire_id:
        q = q.find(TrainingCard.repertoire_id == repertoire_id)
    cards = await q.sort("+due").limit(limit).to_list()
    return [_to_out(c) for c in cards]


@router.post("/review", response_model=SyncOut)
async def submit_reviews(
    body: SyncIn,
    current_user: User = Depends(get_current_active_user),
):
    """Apply a batch of reviews and return the resulting cards.

    Done as THREE round trips regardless of batch size — one read, one bulk
    write, one user update. The obvious loop of find_one + save per review is
    two round trips *each*, which against a remote free-tier Atlas cluster
    takes seconds for a normal session and leaves the client staring at a
    half-applied batch.

    A correct answer on a card that is NOT yet due is skipped rather than
    promoted, exactly as the client does — otherwise replaying a line in an
    afternoon would push everything to the top box without a day passing.
    A miss always counts.
    """
    if not body.reviews:
        return SyncOut(applied=0, skipped=0, cards=[])

    now = datetime.utcnow()
    keys = {(r.repertoire_id, r.path) for r in body.reviews}

    # 1. One read for every card this batch touches.
    existing = {
        (c.repertoire_id, c.path): c
        for c in await TrainingCard.find(
            TrainingCard.user_id == current_user.id,
            In(TrainingCard.repertoire_id, sorted({k[0] for k in keys})),
        ).to_list()
        if (c.repertoire_id, c.path) in keys
    }

    applied = 0
    skipped = 0
    correct_count = 0
    ops: list[UpdateOne] = []
    touched: dict[tuple[str, str], TrainingCard] = {}

    # 2. Fold the whole batch in memory. Later reviews of the same position in
    #    one batch build on the earlier ones, as they would one at a time.
    for r in body.reviews:
        key = (r.repertoire_id, r.path)
        card = touched.get(key) or existing.get(key)

        if card is not None and r.correct and not is_due(card.due, now):
            skipped += 1
            touched.setdefault(key, card)
            continue

        if card is None:
            card = TrainingCard(
                user_id=current_user.id,
                repertoire_id=r.repertoire_id,
                path=r.path,
                created_at=now,
            )

        card.box, card.due = next_state(card.box, r.correct, now)
        card.reps += 1
        card.lapses += 0 if r.correct else 1
        card.last_reviewed = now

        touched[key] = card
        applied += 1
        correct_count += 1 if r.correct else 0

    for (rep_id, path), card in touched.items():
        ops.append(
            UpdateOne(
                {"user_id": current_user.id, "repertoire_id": rep_id, "path": path},
                {
                    "$set": {
                        "box": card.box,
                        "due": card.due,
                        "reps": card.reps,
                        "lapses": card.lapses,
                        "last_reviewed": card.last_reviewed,
                    },
                    "$setOnInsert": {
                        "user_id": current_user.id,
                        "repertoire_id": rep_id,
                        "path": path,
                        "created_at": now,
                    },
                },
                upsert=True,
            )
        )

    # 3. One bulk write. The unique (user, repertoire, path) index makes the
    #    upserts idempotent if a client retries a batch.
    if ops:
        await TrainingCard.get_motor_collection().bulk_write(ops, ordered=False)

    if applied:
        bump_streak(current_user.trainer, now)
        # ONE update, combining the atomic counters with the recomputed streak.
        #
        # Doing `update(Inc(...))` and then `save()` looks equivalent but is
        # not: save() writes the whole in-memory document back, and that copy
        # still holds the pre-increment counters, so it silently undoes the
        # Inc. Two devices syncing at once would also lose counts that way.
        await current_user.update(
            Inc({"trainer.reviews": applied, "trainer.correct": correct_count}),
            Set({
                "trainer.day_streak": current_user.trainer.day_streak,
                "trainer.longest_streak": current_user.trainer.longest_streak,
                "trainer.last_active_day": current_user.trainer.last_active_day,
            }),
        )

    return SyncOut(
        applied=applied,
        skipped=skipped,
        cards=[_to_out(c) for c in touched.values()],
    )


@router.get("/progress", response_model=list[ProgressOut])
async def progress(current_user: User = Depends(get_current_active_user)):
    now = datetime.utcnow()
    buckets: dict[str, ProgressOut] = {}

    async for card in TrainingCard.find(TrainingCard.user_id == current_user.id):
        b = buckets.setdefault(
            card.repertoire_id,
            ProgressOut(repertoire_id=card.repertoire_id, seen=0, due=0, mastered=0),
        )
        b.seen += 1
        if is_due(card.due, now):
            b.due += 1
        if card.box >= MASTERED_BOX:
            b.mastered += 1

    return list(buckets.values())


@router.get("/stats", response_model=TrainerStatsOut)
async def stats(current_user: User = Depends(get_current_active_user)):
    t = current_user.trainer
    return TrainerStatsOut(
        reviews=t.reviews,
        correct=t.correct,
        day_streak=t.day_streak,
        longest_streak=t.longest_streak,
    )


@router.delete("/repertoire/{repertoire_id}", status_code=204)
async def reset_repertoire(
    repertoire_id: str,
    current_user: User = Depends(get_current_active_user),
):
    """Forget all progress in one repertoire. Scoped to the caller's own cards."""
    result = await TrainingCard.find(
        TrainingCard.user_id == current_user.id,
        TrainingCard.repertoire_id == repertoire_id,
    ).delete()
    if result is None:
        raise HTTPException(status_code=404, detail="No progress to reset")
    return None

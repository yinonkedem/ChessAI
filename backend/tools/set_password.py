#!/usr/bin/env python
"""Admin password reset — run locally, never exposed over HTTP.

This is the escape hatch for "I forgot my password and there's no email flow".
It talks straight to MongoDB using backend/.env, so it needs no running server.

Usage (from backend/, with the venv active):

    ./venv/bin/python tools/set_password.py <username>
    ./venv/bin/python tools/set_password.py --list

The new password is read from a hidden prompt and confirmed, so it never lands
in your shell history. Passing it as an argument is deliberately not supported.
"""

import argparse
import asyncio
import getpass
import sys
from pathlib import Path

# Make `app` importable when run as `python tools/set_password.py` from backend/.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.auth.utils import get_password_hash  # noqa: E402
from app.db import close_db, init_db  # noqa: E402
from app.models import Game, User  # noqa: E402

MIN_LEN = 8
MAX_BYTES = 72  # bcrypt ignores anything past this


async def list_users() -> int:
    users = await User.find_all().sort("-created_at").to_list()
    if not users:
        print("No users.")
        return 0
    print(f"{len(users)} user(s):\n")
    print(f"  {'username':<20} {'email':<32} {'games':>5}  created")
    print(f"  {'-' * 20} {'-' * 32} {'-' * 5}  {'-' * 10}")
    for u in users:
        games = await Game.find(Game.user_id == u.id).count()
        created = u.created_at.strftime("%Y-%m-%d") if u.created_at else "?"
        print(f"  {u.username:<20} {u.email:<32} {games:>5}  {created}")
    return 0


def prompt_password() -> str:
    while True:
        pw = getpass.getpass("New password: ")
        if len(pw) < MIN_LEN:
            print(f"  Too short — minimum {MIN_LEN} characters.")
            continue
        if len(pw.encode("utf-8")) > MAX_BYTES:
            print(f"  Too long — bcrypt only reads the first {MAX_BYTES} bytes.")
            continue
        if pw != getpass.getpass("Confirm:      "):
            print("  Passwords didn't match.")
            continue
        return pw


async def set_password(username: str) -> int:
    user = await User.find_one(User.username == username)
    if not user:
        print(f"No user named {username!r}. Run with --list to see who exists.")
        return 1

    print(f"Resetting password for {user.username} <{user.email}>")
    user.password_hash = get_password_hash(prompt_password())
    await user.save()
    print(f"Done. {user.username} can now log in with the new password.")
    return 0


async def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("username", nargs="?", help="user whose password to reset")
    ap.add_argument("--list", action="store_true", help="list users and exit")
    args = ap.parse_args()

    if not args.list and not args.username:
        ap.error("give a username, or --list")

    await init_db()
    try:
        return await (list_users() if args.list else set_password(args.username))
    finally:
        await close_db()


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))

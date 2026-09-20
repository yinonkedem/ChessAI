#!/usr/bin/env python
"""Generate the opening-trainer book data from curated lines + the ECO dataset.

    backend/venv/bin/python tools/build_openings.py

Reads  tools/repertoires.json   (hand-authored: which lines to teach, and why)
       tools/eco-source/*.tsv   (lichess-org/chess-openings, CC0 public domain)
Writes frontend/public/openings/index.json
       frontend/public/openings/<repertoire-id>.json

This runs OFFLINE and its output is committed. It is not part of `npm run build`
— the frontend ships no chess library, which is exactly why every move is
resolved to UCI here, once, instead of in the browser on every drill.

Naming is not taken from the curation file. Each line's ECO code and official
name come from a longest-prefix match against the dataset, the same way lichess
names openings. Opening names in the dataset are NOT unique ("London System"
appears four times with different move orders), so matching by name would be
ambiguous; matching by position is not.

Every assertion here is deliberately fatal. Bad book data would show a learner
a wrong "correct" move, which is worse than no trainer at all.
"""

import json
import re
import sys
from collections import Counter
from pathlib import Path

try:
    import chess
except ImportError:
    sys.exit(
        "python-chess is missing. Run this with the backend venv:\n"
        "    backend/venv/bin/python tools/build_openings.py"
    )

ROOT = Path(__file__).resolve().parent.parent
ECO_DIR = ROOT / "tools" / "eco-source"
CURATION = ROOT / "tools" / "repertoires.json"
OUT_DIR = ROOT / "frontend" / "public" / "openings"

MOVE_NUMBER = re.compile(r"\d+\.+")


class BuildError(Exception):
    """Fatal data problem — always names the line so it's fixable."""


def san_tokens(pgn: str) -> list[str]:
    """'1. e4 e5 2. Nf3' -> ['e4', 'e5', 'Nf3'] (also copes with '1.e4')."""
    return MOVE_NUMBER.sub(" ", pgn).split()


def replay(tokens: list[str], where: str) -> tuple[list[str], list[str]]:
    """Replay SAN. Returns (ucis, epds) where epds[i] is the position AFTER move i.

    Raises if any move is illegal.
    """
    board = chess.Board()
    ucis, epds = [], []
    for i, tok in enumerate(tokens):
        try:
            move = board.parse_san(tok)
        except ValueError as exc:
            raise BuildError(
                f"{where}: move {i + 1} ({tok!r}) is not legal here — {exc}\n"
                f"  position: {board.fen()}"
            ) from exc
        ucis.append(move.uci())
        board.push(move)
        epds.append(board.epd())
    return ucis, epds


def load_eco_table() -> dict[str, tuple[str, str]]:
    """{epd: (eco, name)} for every row in the dataset.

    Keyed on the resulting POSITION, not the move sequence and not the name:

    - Names repeat ("London System" appears four times with different orders).
    - Move sequences miss transpositions. The dataset reaches the Caro-Kann
      Classical via 3.Nd2 while most players go 3.Nc3; same position, different
      path. ECO codes classify positions, so the position is the right key.

    On a collision (two rows, same position) the shorter line wins — it is the
    more canonical classification.
    """
    files = sorted(ECO_DIR.glob("*.tsv"))
    if not files:
        raise BuildError(
            f"No .tsv files in {ECO_DIR}. Fetch them with:\n"
            "  for f in a b c d e; do curl -sSL -o tools/eco-source/$f.tsv \\\n"
            "    https://raw.githubusercontent.com/lichess-org/chess-openings/master/$f.tsv; done"
        )

    table: dict[str, tuple[str, str]] = {}
    depth: dict[str, int] = {}
    collisions = 0

    for path in files:
        for lineno, raw in enumerate(path.read_text().splitlines(), start=1):
            if lineno == 1 or not raw.strip():
                continue  # header
            parts = raw.split("\t")
            if len(parts) < 3:
                raise BuildError(f"{path.name}:{lineno}: expected 3 columns, got {len(parts)}")
            eco, name, pgn = parts[0], parts[1], parts[2]
            tokens = san_tokens(pgn)
            _, epds = replay(tokens, f"{path.name}:{lineno}")
            epd = epds[-1]
            if epd in table:
                collisions += 1
                if len(tokens) >= depth[epd]:
                    continue  # keep the shorter, more canonical entry
            table[epd] = (eco, name)
            depth[epd] = len(tokens)

    if collisions:
        print(f"  ({collisions} transpositions in the dataset; kept the shorter naming)")
    return table


def classify(epds: list[str], table) -> tuple[str, str]:
    """Deepest position in the line that the dataset knows a name for."""
    for epd in reversed(epds):
        hit = table.get(epd)
        if hit:
            return hit
    raise BuildError("no ECO entry matches any position in this line")


def build_line(spec: dict, side: str, table) -> dict:
    line_id = spec.get("id")
    if not line_id:
        raise BuildError(f"a line is missing its 'id': {spec.get('label', spec)!r}")

    tokens = san_tokens(spec["moves"])
    if not tokens:
        raise BuildError(f"{line_id}: no moves")

    ucis, epds = replay(tokens, line_id)

    # A promotion inside a book line would drag the whole PROMOTION_OPEN popup
    # path into the trainer. No real opening needs one; reject it so the
    # trainer can assume it never happens.
    promo = [t for t in tokens if "=" in t]
    if promo:
        raise BuildError(f"{line_id}: contains a promotion ({promo[0]}); not supported")

    # The learner answers every ply of their own colour, so a White line must
    # start on an even index and a Black line on an odd one. That is automatic,
    # but a line the learner never moves in is a curation mistake.
    answer_plies = [i for i in range(len(ucis)) if (i % 2 == 0) == (side == "w")]
    if not answer_plies:
        raise BuildError(f"{line_id}: side {side!r} never gets a move in this line")

    eco, name = classify(epds, table)

    ideas = spec.get("ideas") or []
    if len(ideas) > len(ucis):
        raise BuildError(
            f"{line_id}: {len(ideas)} ideas for {len(ucis)} moves — ideas are index-aligned"
        )
    # Pad so the frontend can index without a bounds check.
    ideas = list(ideas) + [None] * (len(ucis) - len(ideas))

    return {
        "id": line_id,
        "label": spec.get("label") or name,
        "eco": eco,
        "name": name,
        "side": side,
        "moves": [{"san": s, "uci": u} for s, u in zip(tokens, ucis)],
        "ideas": ideas,
        "answerPlies": answer_plies,
        # consumed by the label check in main(); never reaches the output file
        "_labelOk": bool(spec.get("labelOk")),
    }


def build_tree(lines, side, table):
    """Merge authored lines into a position tree keyed by UCI path.

    Authoring stays line-shaped — you write "1. e4 c5 2. Nf3 d6 ..." — but the
    trainer needs to know every book reply to a position, not just the one on
    the line you happened to be reading. Merging on shared prefixes gives that
    for free: two Najdorf lines that diverge at move 6 produce a node with two
    replies, and playing either is correct.

    The key is the concatenated UCI path ("" is the start position), which is
    also exactly the spaced-repetition card key — one card per position, so a
    shared prefix like 1.e4 is drilled once rather than once per line.
    """
    nodes: dict[str, dict] = {}
    idea_conflicts = []

    for line in lines:
        path = ""
        for i, mv in enumerate(line["moves"]):
            node = nodes.setdefault(path, {
                "ply": i,
                "turn": "w" if i % 2 == 0 else "b",
                "mine": (i % 2 == 0) == (side == "w"),
                "replies": [],
            })

            existing = next((r for r in node["replies"] if r["uci"] == mv["uci"]), None)
            idea = line["ideas"][i]

            if existing is None:
                reply = {"uci": mv["uci"], "san": mv["san"]}
                if idea:
                    reply["idea"] = idea
                node["replies"].append(reply)
            elif idea and "idea" not in existing:
                existing["idea"] = idea
            elif idea and existing.get("idea") != idea:
                # Same move from the same position described two different
                # ways. Not fatal, but the learner would see whichever line
                # happened to be authored first — worth knowing about.
                idea_conflicts.append((line["id"], mv["san"], path or "start"))

            path += mv["uci"]

        # Leaf: the line ends here. Record it so the UI can say "line complete"
        # and name the variation reached.
        n = len(line["moves"])
        leaf = nodes.setdefault(path, {
            "ply": n,
            "turn": "w" if n % 2 == 0 else "b",
            # Whose turn it would be, computed the same way as any other node.
            # Hardcoding False here silently mislabels every leaf that lands on
            # the learner's move.
            "mine": (n % 2 == 0) == (side == "w"),
            "replies": [],
        })
        leaf["end"] = True

    # Name every node by its position. Positions the dataset doesn't recognise
    # (between two named ones) inherit from the nearest named ancestor, so the
    # UI can always show where the learner currently is — shallow to deep, so
    # a parent is always named before its children look at it.
    for path in sorted(nodes, key=len):
        node = nodes[path]
        board = chess.Board()
        for i in range(0, len(path), 4):
            board.push(chess.Move.from_uci(path[i:i + 4]))

        hit = table.get(board.epd())
        if hit:
            node["eco"], node["name"] = hit
        elif path:
            parent = nodes.get(path[:-4])
            if parent and "name" in parent:
                node["eco"], node["name"] = parent["eco"], parent["name"]

    return nodes, idea_conflicts


def main() -> int:
    try:
        table = load_eco_table()
        print(f"Loaded {len(table)} ECO positions from {ECO_DIR.name}/")

        curation = json.loads(CURATION.read_text())
        repertoires, catalog = [], []
        seen_ids: Counter = Counter()
        all_conflicts: list = []

        for rep in curation["repertoires"]:
            side = rep["side"]
            if side not in ("w", "b"):
                raise BuildError(f"{rep['id']}: side must be 'w' or 'b', got {side!r}")

            lines = [build_line(spec, side, table) for spec in rep["lines"]]
            for ln in lines:
                seen_ids[ln["id"]] += 1

            nodes, conflicts = build_tree(lines, side, table)
            all_conflicts.extend(conflicts)

            # One SRS card per position the learner must answer — shared
            # prefixes collapse, so 1.e4 is one card however many lines use it.
            cards = sum(1 for n in nodes.values() if n["mine"] and n["replies"])

            doc = {
                "id": rep["id"],
                "title": rep["title"],
                "family": rep["family"],
                "blurb": rep.get("blurb", ""),
                "side": side,
                "difficulty": rep.get("difficulty", 1),
                # Lightweight variation index. The moves and ideas live in
                # `nodes` — repeating them here would double the payload for
                # no gain, since the drill navigates the tree, not the list.
                "lines": [
                    {
                        "id": ln["id"],
                        "label": ln["label"],
                        "eco": ln["eco"],
                        "name": ln["name"],
                        "path": "".join(m["uci"] for m in ln["moves"]),
                        "plies": len(ln["moves"]),
                    }
                    for ln in lines
                ],
                "nodes": nodes,
            }
            repertoires.append(doc)
            catalog.append({
                "id": rep["id"],
                "title": rep["title"],
                "family": rep["family"],
                "blurb": doc["blurb"],
                "side": side,
                "difficulty": doc["difficulty"],
                "lineCount": len(lines),
                "cardCount": cards,
                "nodeCount": len(nodes),
                "file": f"{rep['id']}.json",
            })

        if all_conflicts:
            print("\n  IDEA CONFLICTS — same move from the same position, described two ways:")
            for line_id, san, path in all_conflicts[:10]:
                print(f"    {line_id}: {san} after {path}")
            print("    The first authored wording wins. Make them agree, or drop one.")

        dupes = [i for i, n in seen_ids.items() if n > 1]
        if dupes:
            raise BuildError(f"duplicate line ids: {', '.join(sorted(dupes))}")

        # A line can silently transpose into a different opening — e.g. a
        # "Scotch Gambit" written as 4.Bc4 actually reaches an Italian Game.
        # Teaching the wrong variation name is a real defect, so flag any label
        # whose words don't appear in the official name the position resolves to.
        suspicious = []
        for doc in repertoires:
            for ln in doc["lines"]:
                if ln.pop("_labelOk", False):
                    continue  # curation says the mismatch is intentional
                official = ln["name"].lower()
                words = [w for w in re.findall(r"[a-z]{4,}", ln["label"].lower())
                         if w not in {"line", "main", "defense", "defence", "variation",
                                      "system", "attack", "with", "setup", "early"}]
                if words and not any(w in official for w in words):
                    suspicious.append((doc["id"], ln["label"], ln["name"]))
        if suspicious:
            print("\n  LABEL CHECK — these labels don't match the position's official name:")
            for rep_id, label, name in suspicious:
                print(f"    {rep_id}/{label!r} resolves to {name!r}")
            print("    Either the label is wrong, or the line transposed somewhere unintended.")

        OUT_DIR.mkdir(parents=True, exist_ok=True)
        for doc in repertoires:
            (OUT_DIR / f"{doc['id']}.json").write_text(
                json.dumps(doc, ensure_ascii=False, indent=1) + "\n"
            )

        index = {
            "version": curation.get("version", 1),
            "source": "lichess-org/chess-openings (CC0 public domain)",
            "repertoires": catalog,
        }
        (OUT_DIR / "index.json").write_text(
            json.dumps(index, ensure_ascii=False, indent=1) + "\n"
        )

    except BuildError as exc:
        print(f"\nBUILD FAILED\n  {exc}", file=sys.stderr)
        return 1

    total_lines = sum(c["lineCount"] for c in catalog)
    total_cards = sum(c["cardCount"] for c in catalog)
    written = sum((OUT_DIR / f).stat().st_size for f in (p.name for p in OUT_DIR.glob("*.json")))

    total_nodes = sum(c["nodeCount"] for c in catalog)
    print(f"\n{'repertoire':<28} {'side':>4} {'lines':>6} {'nodes':>6} {'cards':>6}")
    print(f"{'-' * 28} {'-' * 4} {'-' * 6} {'-' * 6} {'-' * 6}")
    for c in catalog:
        print(f"{c['id']:<28} {c['side']:>4} {c['lineCount']:>6} "
              f"{c['nodeCount']:>6} {c['cardCount']:>6}")
    print(f"{'-' * 28} {'-' * 4} {'-' * 6} {'-' * 6} {'-' * 6}")
    print(f"{'total':<28} {'':>4} {total_lines:>6} {total_nodes:>6} {total_cards:>6}")
    print(f"\nWrote {len(catalog) + 1} files ({written / 1024:.1f} KB) to "
          f"{OUT_DIR.relative_to(ROOT)}/")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

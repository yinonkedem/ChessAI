export async function getBestMove({ fen, depth = 8, engine = "stockfish" }) {
    const res = await fetch(`http://127.0.0.1:8000/engine/best-move?engine=${engine}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ fen, depth }),
        }
    );
    if (!res.ok) throw new Error(await res.text());
    return res.json();  // { fen, depth, best_move, engine }
}
// utils/uciToPair.js
export function uciToCoords(uci) {
    if (uci.length < 4) throw new Error("Invalid UCI: " + uci);

    const file = c => c.charCodeAt(0) - 97;  // 'a' → 0 … 'h' → 7
    const rank = c => Number(c) - 1;         // '1' → 0 … '8' → 7

    const from = [rank(uci[1]), file(uci[0])];   // [row, col]
    const to   = [rank(uci[3]), file(uci[2])];
    const result = [from, to];        // original shape
    if (uci.length === 5) result.promotion = uci[4]; // add property
    return result;
}

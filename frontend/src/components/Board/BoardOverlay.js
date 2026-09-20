import "./BoardOverlay.css";

/**
 * Arrows and square markers drawn over the board.
 *
 * Mounted as a sibling of <Pieces/> inside .board — NOT a child of .pieces,
 * which owns the drag and click handlers. `pointer-events: none` means it can
 * never swallow an input even so.
 *
 * The viewBox is 0 0 8 8, so one unit is exactly one square: no pixel maths,
 * no reading --tile-size in JS, and it rescales with the board for free.
 *
 * Board flip needs no special handling. `.board--black` rotates the whole
 * board 180°, and this layer is a descendant, so an arrow authored in white
 * coordinates lands on the right squares AND points the right way. (Only text
 * would need counter-rotating, the way .ranks and .files do — there is none
 * here deliberately.)
 */

// [rank, file] -> SVG centre. Mirrors Board.js:58-59, where row i renders rank 7-i.
const cx = (file) => file + 0.5;
const cy = (rank) => 7 - rank + 0.5;

const HEAD = 0.36;      // arrowhead width, in squares
const SHAFT = 0.13;
const START_GAP = 0.28; // leave the origin piece visible
const END_GAP = 0.06;

function Arrow({ from, to, tone }) {
    const x1 = cx(from[1]);
    const y1 = cy(from[0]);
    const x2 = cx(to[1]);
    const y2 = cy(to[0]);

    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len;
    const uy = dy / len;

    // Pull both ends in: the tail clears the piece, the tip stops on the
    // target's centre rather than overshooting it.
    const sx = x1 + ux * START_GAP;
    const sy = y1 + uy * START_GAP;
    const tipX = x2 - ux * END_GAP;
    const tipY = y2 - uy * END_GAP;

    // The shaft stops where the head begins, or the head looks hollow.
    const baseX = tipX - ux * HEAD;
    const baseY = tipY - uy * HEAD;

    // Perpendicular, for the head's two back corners.
    const px = -uy * (HEAD / 2);
    const py = ux * (HEAD / 2);

    return (
        <g className={`bo-arrow bo-${tone}`}>
            <line x1={sx} y1={sy} x2={baseX} y2={baseY} strokeWidth={SHAFT} strokeLinecap="round" />
            <polygon
                points={`${tipX},${tipY} ${baseX + px},${baseY + py} ${baseX - px},${baseY - py}`}
            />
        </g>
    );
}

function SquareMark({ square, tone }) {
    return (
        <rect
            className={`bo-square bo-${tone}`}
            x={square[1]}
            y={7 - square[0]}
            width="1"
            height="1"
            rx="0.1"
        />
    );
}

function DotMark({ square, tone }) {
    return (
        <circle className={`bo-dot bo-${tone}`} cx={cx(square[1])} cy={cy(square[0])} r="0.17" />
    );
}

export default function BoardOverlay({ annotations = [] }) {
    if (!annotations.length) return null;

    return (
        <svg
            className="board-overlay"
            viewBox="0 0 8 8"
            preserveAspectRatio="xMidYMid meet"
            aria-hidden="true"
        >
            {annotations.map((a, i) => {
                if (a.type === "arrow") {
                    return <Arrow key={i} from={a.from} to={a.to} tone={a.tone} />;
                }
                if (a.type === "dot") {
                    return <DotMark key={i} square={a.square} tone={a.tone} />;
                }
                return <SquareMark key={i} square={a.square} tone={a.tone} />;
            })}
        </svg>
    );
}

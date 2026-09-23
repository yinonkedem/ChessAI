/**
 * One piece on the board. Purely presentational: dragging and tapping are
 * handled by <Pieces/> with pointer events, so a piece only needs to know
 * whether it is the one being dragged (it stays put, dimmed, while a copy
 * follows the pointer).
 */
const Piece = ({ rank, file, piece, dragging }) => (
    <div className={`piece ${piece} p-${file}${rank}${dragging ? ' is-dragging' : ''}`} />
);

export default Piece;

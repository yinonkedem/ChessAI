import actionTypes from '../actionTypes';

export const updateCastling = (direction) => ({
    type: actionTypes.CAN_CASTLE,
    payload: direction,
});

export const detectStalemate = () => ({
    type: actionTypes.STALEMATE,
});

export const detectInsufficientMaterial = () => ({
    type: actionTypes.INSUFFICIENT_MATERIAL,
});

export const detectCheckmate = (winner) => ({
    type: actionTypes.WIN,
    payload: winner,
});

export const setupNewGame = () => ({
    type: actionTypes.NEW_GAME,
});

export const setEngineDepth = (value) => ({
    type: actionTypes.SET_ENGINE_DEPTH,
    payload: value,
});

export const setHintDepth = (value) => ({
    type: actionTypes.SET_HINT_DEPTH,
    payload: value,
});

export const resetAll = () => ({
    type: actionTypes.RESET_ALL,
});

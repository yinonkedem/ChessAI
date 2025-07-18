import actionTypes from '../actionTypes';

export const makeNewMove = ({newPosition,newMove}) => {
    return {
        type: actionTypes.NEW_MOVE,
        payload: {newPosition,newMove},
    }
}

export const setLastMove = ({from,to}) => {
    const toNum = arr => Array.isArray(arr) ? arr.map(n => +n) : null;
    return {
        type: actionTypes.SET_LAST_MOVE,
        payload: {
            from: toNum(from),
            to: toNum(to),
        },
    };
}

export const clearCandidates = () => {
    return {
        type: actionTypes.CLEAR_CANDIDATE_MOVES,
    }
}

export const generateCandidates = ({candidateMoves}) => {
    return {
        type: actionTypes.GENERATE_CANDIDATE_MOVES,
        payload : {candidateMoves}
    }
}

export const takeBack = () => {
    return {
        type: actionTypes.TAKE_BACK,
    }
}

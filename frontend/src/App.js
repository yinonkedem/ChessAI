// App.js
import React, {useEffect, useReducer} from 'react';
import './App.css';
import {reducer} from './reducer/Reducer';
import {initGameState} from './constants';
import AppContext from './contexts/Context';

import StartScreen from './pages/StartScreen';
import Board from './components/Board/Board';
import Control from './components/Control/Control';
import MovesList from './components/Control/bits/MovesList';
import TakeBack from './components/Control/bits/TakeBack';
import actionTypes from "./reducer/actionTypes";

function App() {
    const [appState, dispatch] = useReducer(reducer, initGameState);

    // Temporary smoke test: ask the backend for legal moves
    useEffect(() => {
        async function pingBackend() {
            const fen =
                "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
            try {
                const res = await fetch("http://127.0.0.1:8000/legal-moves", {
                    method: "POST",
                    headers: {"Content-Type": "application/json"},
                    body: JSON.stringify({fen}),
                });
                const data = await res.json();
                console.log("✅ backend responded with", data.moves.length, "moves:", data.moves);
            } catch (err) {
                console.error("❌ backend call failed:", err);
            }
        }

        pingBackend();
    }, []); // ← empty deps ⇒ run once

    const providerState = {appState, dispatch};

    return (
        <AppContext.Provider value={providerState}>
            <div className="App">
                {!appState.isGameSetup ? (
                    <StartScreen onStart={(setup) =>
                        dispatch({
                            type: actionTypes.SETUP_GAME,
                            payload: setup
                        })
                    }/>
                ) : (
                    <>
                        <Board orientation={appState.userColor}/>
                        <Control>
                            <MovesList/>
                            <TakeBack/>
                        </Control>
                    </>
                )}
            </div>
        </AppContext.Provider>
    );
}

export default App;

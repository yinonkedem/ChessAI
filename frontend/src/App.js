// App.js
import React from "react";
import {Routes, Route, useNavigate} from "react-router-dom";
import "./App.css";

import {reducer} from "./reducer/Reducer";
import {initGameState, GameMode} from "./constants";
import actionTypes from "./reducer/actionTypes";
import AppContext from "./contexts/Context";

import StartScreen from "./pages/StartScreen";
import CustomEditor from "./pages/CustomEditor";
import Board from "./components/Board/Board";

import Control from "./components/Control/Control";
import MovesList from "./components/Control/bits/MovesList";
import TakeBack from "./components/Control/bits/TakeBack";
import HintButton from "./components/Control/bits/HintButton";

import AIAgent from "./ai/AIAgent";
import RandomAgent from "./ai/RandomAgent";

import usePersistedReducer from "./hooks/usePersistedReducer";

function GamePage() {
    const {appState} = React.useContext(AppContext);
    return (
        <div className="App">
            <Board orientation={appState.userColor}/>
            <Control>
                <MovesList/>
                <TakeBack/>
                <HintButton/>
            </Control>
        </div>
    );
}

function EditorPage() {
    return (
        <div className="App">
            <CustomEditor/>
        </div>
    );
}

export default function App() {
    const [appState, dispatch] = usePersistedReducer(
                reducer, initGameState, "chess-state"
            );
    const navigate = useNavigate();

    const providerState = {appState, dispatch};

    /** called by StartScreen */
    function handleStart(setup) {
        localStorage.removeItem("chess-state");
        if (setup.mode === GameMode.custom) {
            dispatch({
                type: actionTypes.ENTER_CUSTOM_MODE,
                payload: {colour: setup.colour}
            });
            navigate("/custom");            // go to custom-board editor
        } else {
            dispatch({type: actionTypes.SETUP_GAME, payload: setup});
            navigate("/game");              // go straight to the game
        }
    }

    return (
        <AppContext.Provider value={providerState}>
            {/* AI side-effects keep working */}
            <AIAgent/>
            <RandomAgent/>

            {/* page routing */}
            <Routes>
                <Route path="/"
                       element={<StartScreen onStart={handleStart}/>}/>
                <Route path="/custom" element={<EditorPage />} />
                <Route path="/game" element={<GamePage/>}/>
            </Routes>
        </AppContext.Provider>
    );
}

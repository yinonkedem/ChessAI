import React from "react";
import { Routes, Route, useNavigate } from "react-router-dom";
import "./App.css";

import { reducer } from "./reducer/Reducer";
import { createInitGameState, GameMode } from "./constants";
import actionTypes from "./reducer/actionTypes";
import AppContext from "./contexts/Context";

import StartScreen from "./pages/StartScreen";
import CustomEditor from "./pages/CustomEditor";
import Board from "./components/Board/Board";

import Control from "./components/Control/Control";
import MovesList from "./components/Control/bits/MovesList";
import TakeBack from "./components/Control/bits/TakeBack";
import HintButton from "./components/Control/bits/HintButton";

import EngineAgents from "./ai/EngineAgents";
import Toolbar from "./components/Toolbar/Toolbar";

import { AuthProvider } from "./auth/AuthContext";
import ProtectedRoute from "./auth/ProtectedRoute";
import LoginPage from "./pages/LoginPage";

import usePersistedReducer from "./hooks/usePersistedReducer";

function GamePage() {
    return (
        <main className="page page--game">
            <Board />
            <Control>
                <MovesList />
                <TakeBack />
                <HintButton />
            </Control>
        </main>
    );
}

function EditorPage() {
    return (
        <main className="page page--editor">
            <CustomEditor />
        </main>
    );
}

export default function App() {
    const [appState, dispatch] = usePersistedReducer(
        reducer,
        createInitGameState,
        "chess-state"
    );
    const navigate = useNavigate();

    const providerState = { appState, dispatch };

    function handleStart(setup) {
        if (setup.mode === GameMode.custom) {
            dispatch({
                type: actionTypes.ENTER_CUSTOM_MODE,
                payload: { colour: setup.colour },
            });
            navigate("/custom");
        } else {
            dispatch({ type: actionTypes.SETUP_GAME, payload: setup });
            navigate("/game");
        }
    }

    function handleNewGame() {
        dispatch({ type: actionTypes.RESET_ALL });
        navigate("/");
    }

    return (
        <AuthProvider>
            <AppContext.Provider value={providerState}>
                <EngineAgents />

                <Toolbar onNewGame={handleNewGame} />

                <Routes>
                    <Route path="/login" element={<LoginPage />} />
                    <Route
                        path="/"
                        element={
                            <ProtectedRoute>
                                <StartScreen onStart={handleStart} />
                            </ProtectedRoute>
                        }
                    />
                    <Route
                        path="/custom"
                        element={
                            <ProtectedRoute>
                                <EditorPage />
                            </ProtectedRoute>
                        }
                    />
                    <Route
                        path="/game"
                        element={
                            <ProtectedRoute>
                                <GamePage />
                            </ProtectedRoute>
                        }
                    />
                </Routes>
            </AppContext.Provider>
        </AuthProvider>
    );
}

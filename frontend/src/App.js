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
import ScoreBoard from "./components/Control/bits/ScoreBoard";
import TakeBack from "./components/Control/bits/TakeBack";
import HintButton from "./components/Control/bits/HintButton";
import EngineDepth from "./components/Control/bits/EngineDepth";

import EngineAgents from "./ai/EngineAgents";
import Toolbar from "./components/Toolbar/Toolbar";

import { AuthProvider } from "./auth/AuthContext";
import ProtectedRoute from "./auth/ProtectedRoute";
import LoginPage from "./pages/LoginPage";
import AccountPage from "./pages/AccountPage";
import LearnPage from "./pages/LearnPage";
import DrillPage from "./pages/DrillPage";
import ReviewPage from "./pages/ReviewPage";
import ProgressPage from "./pages/ProgressPage";
import HomePage from "./pages/HomePage";
import { TrainerProvider } from "./trainer/TrainerContext";

import usePersistedReducer from "./hooks/usePersistedReducer";

function GamePage() {
    return (
        <main className="page page--game">
            <Board />
            <Control>
                <ScoreBoard />
                <MovesList />
                <TakeBack />
                <EngineDepth />
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
        // v3 -> v4: createInitGameState() gained `scoreLog`. usePersistedReducer
        // loads cached state as-is with no merge, so an old v3 entry would
        // load without it and crash on the next move's `[...state.scoreLog]`.
        // Bumping the key discards stale state cleanly instead.
        "chess-state-v4"
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
        navigate("/play");
    }

    return (
        <AuthProvider>
            <AppContext.Provider value={providerState}>
                {/* Wraps the Toolbar as well as the Routes: Pieces.js calls
                    useMoveGate(), and the toolbar will want useTrainer() for a
                    streak chip. */}
                <TrainerProvider>
                    <EngineAgents />

                    <Toolbar onNewGame={handleNewGame} />

                    <Routes>
                        <Route path="/login" element={<LoginPage />} />
                        {/* Public: the front door leads with the trainer, and
                            a first-time visitor must see it before any login. */}
                        <Route path="/" element={<HomePage />} />
                        <Route
                            path="/play"
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
                            path="/account"
                            element={
                                <ProtectedRoute>
                                    <AccountPage />
                                </ProtectedRoute>
                            }
                        />
                        {/* Public on purpose — someone must be able to try
                            a drill before signing up. */}
                        <Route path="/learn" element={<LearnPage />} />
                        <Route path="/learn/:repertoireId" element={<DrillPage />} />
                        <Route path="/learn/:repertoireId/review" element={<ReviewPage />} />
                        <Route path="/progress" element={<ProgressPage />} />
                        <Route
                            path="/game"
                            element={
                                <ProtectedRoute>
                                    <GamePage />
                                </ProtectedRoute>
                            }
                        />
                    </Routes>
                </TrainerProvider>
            </AppContext.Provider>
        </AuthProvider>
    );
}

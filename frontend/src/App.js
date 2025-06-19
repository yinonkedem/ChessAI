// App.js
import React, {useEffect, useReducer} from 'react';
import './App.css';
import {reducer} from './reducer/Reducer';
import {initGameState, GameMode} from './constants';
import AppContext from './contexts/Context';

import StartScreen from './pages/StartScreen';
import Board from './components/Board/Board';
import Control from './components/Control/Control';
import MovesList from './components/Control/bits/MovesList';
import TakeBack from './components/Control/bits/TakeBack';
import actionTypes from "./reducer/actionTypes";
import HintButton from "./components/Control/bits/HintButton";

import AIAgent   from "./ai/AIAgent";
import RandomAgent from "./ai/RandomAgent";

import { createEmptyPosition } from "./helper";
import CustomEditor from "./pages/CustomEditor";


function App() {
    const [appState, dispatch] = useReducer(reducer, initGameState);

    const providerState = {appState, dispatch};

    function handleStart(setup) {
        if (setup.mode === GameMode.custom) {
            // only colour is relevant at this stage
            dispatch({
                type   : actionTypes.ENTER_CUSTOM_MODE,
                payload: { colour: setup.colour }   // or setup.userColor if that’s your field
            });
        } else {
            dispatch({
                type   : actionTypes.SETUP_GAME,
                payload: setup                      // colour + opponent
            });
        }
    }


    return (
        <AppContext.Provider value={providerState}>
            <AIAgent />
            <RandomAgent />

            <div className="App">
                {appState.isCustomEditor ? (
                    <CustomEditor />

                ) : !appState.isGameSetup ? (
                    <StartScreen onStart={handleStart} />

                ) : (
                    <>
                        <Board orientation={appState.userColor} />
                        <Control>
                            <MovesList />
                            <TakeBack />
                            <HintButton />
                        </Control>
                    </>
                )}
            </div>
        </AppContext.Provider>
    );

}

export default App;

// App.js
import React, {useReducer} from 'react';
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

import React, {useReducer} from 'react';
import Board from './components/Board/Board';
import './App.css';
import AppContext from './contexts/Context';
import {reducer} from './reducer/Reducer';
import {initGameState} from './constant';

function App() {

    const [appState, dispatch] = useReducer(reducer, initGameState);

    const providerState = {
        appState,
        dispatch
    }

    return (
        <AppContext.Provider value={providerState}>
            <div className="Yinon's Chess App">
                <Board/>
            </div>
        </AppContext.Provider>
    );
}

export default App;

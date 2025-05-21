// components/StartScreen/StartScreen.js
import React from 'react';
import './StartScreen.css';

const StartScreen = ({onChooseColor}) => {
    return (
        <div className="start-screen">
            <h1 className="start-screen__title">Yinon Chess</h1>
            <p className="start-screen__subtitle">Choose your pieces color to begin</p>
            <div className="start-screen__buttons">
                <button
                    className="btn btn--white"
                    onClick={() => onChooseColor('white')}
                >
                    Play as White
                </button>
                <button
                    className="btn btn--black"
                    onClick={() => onChooseColor('black')}
                >
                    Play as Black
                </button>
            </div>
        </div>
    );
};

export default StartScreen;

import useEngineAgent from "./useEngineAgent";

const StockfishAgent = () => {
    useEngineAgent({ engine: "stockfish", opponentType: "ai" });
    return null;
};

const RandomEngineAgent = () => {
    useEngineAgent({ engine: "random", opponentType: "rand" });
    return null;
};

const EngineAgents = () => (
    <>
        <StockfishAgent />
        <RandomEngineAgent />
    </>
);

export default EngineAgents;

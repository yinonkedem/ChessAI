import { useContext } from "react";
import { GameContext } from "../contexts/Context";

export function useGame() {
    return useContext(GameContext);
}
"use client";

import { createContext, useContext, useEffect, useRef } from "react";

export type GameActivity =
  | "hockey"
  | "snow-shoveling"
  | "pressure-washing"
  | "falling-items"
  | "trash-pickup"
  | "shell-express"
  | "rail-rush"
  | "bike-race"
  | "rhythm-game"
  | "excavator";

export const GameEconomyContext = createContext<(activity: GameActivity) => void>(() => undefined);

export function useGameReward(activity: GameActivity, won: boolean) {
  const award = useContext(GameEconomyContext);
  const paidForThisRound = useRef(false);

  useEffect(() => {
    if (!won) {
      paidForThisRound.current = false;
      return;
    }
    if (!paidForThisRound.current) {
      paidForThisRound.current = true;
      award(activity);
    }
  }, [activity, award, won]);
}

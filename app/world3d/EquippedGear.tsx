"use client";

import { createContext, useContext } from "react";

export type EquippedGear = {
  deck: "night-line" | "starter";
  helmet: boolean;
};

const defaultGear: EquippedGear = { deck: "starter", helmet: false };

export const EquippedGearContext = createContext<EquippedGear>(defaultGear);

export function useEquippedGear() {
  return useContext(EquippedGearContext);
}

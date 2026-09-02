"use client";

import { RoundedBox } from "@react-three/drei";
import { createContext } from "react";
import { useEquippedGear } from "./EquippedGear";

export const SKATEBOARD_SPEED = 12;
export const SkateboardOwnershipContext = createContext(false);

export function Skateboard({ deck }: { deck?: "night-line" | "starter" } = {}) {
  const gear = useEquippedGear();
  const nightLine = (deck ?? gear.deck) === "night-line";
  return (
    <group>
      <RoundedBox args={[1.34, 0.1, 0.5]} position={[0, 0.34, 0]} radius={0.1} smoothness={4} castShadow>
        <meshStandardMaterial color={nightLine ? "#293f69" : "#e86946"} roughness={0.55} />
      </RoundedBox>
      {[-0.72, 0.72].map((x) => (
        <RoundedBox key={x} args={[0.34, 0.1, 0.46]} position={[x, 0.37, 0]} rotation-z={x < 0 ? -0.13 : 0.13} radius={0.1} smoothness={4} castShadow>
          <meshStandardMaterial color={nightLine ? "#293f69" : "#e86946"} roughness={0.55} />
        </RoundedBox>
      ))}
      <RoundedBox args={[1.45, 0.025, 0.43]} position={[0, 0.405, 0]} radius={0.07} smoothness={3}>
        <meshStandardMaterial color={nightLine ? "#e7c45a" : "#254a3c"} roughness={0.92} />
      </RoundedBox>
      {[-0.5, 0.5].map((x) => (
        <group key={x} position-x={x}>
          <mesh position-y={0.27} rotation-x={Math.PI / 2} castShadow>
            <cylinderGeometry args={[0.035, 0.035, 0.65, 10]} />
            <meshStandardMaterial color="#c5cec9" metalness={0.7} roughness={0.28} />
          </mesh>
          {[-0.34, 0.34].map((z) => (
            <mesh key={z} position={[0, 0.18, z]} rotation-x={Math.PI / 2} castShadow>
              <cylinderGeometry args={[0.13, 0.13, 0.14, 16]} />
              <meshStandardMaterial color="#f5d66f" roughness={0.7} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
}

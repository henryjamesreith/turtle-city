"use client";

import { Billboard, Html, useTexture } from "@react-three/drei";
import * as THREE from "three";
import { getTurtleImage, type TurtleVariant } from "@/lib/turtles";
import { useEquippedGear } from "./EquippedGear";

type TurtleBillboardProps = {
  name?: string;
  scale?: number;
  showShadow?: boolean;
  suppressGear?: boolean;
  variant: TurtleVariant;
};

export function TurtleBillboard({
  name,
  scale = 0.88,
  showShadow = true,
  suppressGear = false,
  variant,
}: TurtleBillboardProps) {
  const texture = useTexture(getTurtleImage(variant));
  const gear = useEquippedGear();

  return (
    <group scale={scale}>
      {showShadow ? <mesh position={[0, 0.035, 0]} rotation-x={-Math.PI / 2} renderOrder={0}>
        <circleGeometry args={[0.62, 32]} />
        <meshBasicMaterial
          color="#263b20"
          depthWrite={false}
          opacity={0.28}
          transparent
        />
      </mesh> : null}
      <Billboard position={[0, 1.25, 0]} follow>
        <mesh renderOrder={2}>
          <planeGeometry args={[1.94, 2.58]} />
          <meshBasicMaterial
            alphaTest={0.08}
            map={texture}
            side={THREE.DoubleSide}
            toneMapped={false}
            transparent
          />
        </mesh>
        {gear.helmet && !suppressGear ? <group position={[0, .63, .08]} renderOrder={3}>
          <mesh scale={[1, .62, .38]}><sphereGeometry args={[.58, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2]} /><meshStandardMaterial color="#3f725b" roughness={.72} /></mesh>
          <mesh position={[.18, -.05, .18]}><boxGeometry args={[.76, .09, .28]} /><meshStandardMaterial color="#274c3e" roughness={.8} /></mesh>
          <mesh position={[-.39, -.32, .08]} rotation-z={-.16}><boxGeometry args={[.045, .55, .04]} /><meshBasicMaterial color="#e7c85d" /></mesh>
          <mesh position={[.39, -.32, .08]} rotation-z={.16}><boxGeometry args={[.045, .55, .04]} /><meshBasicMaterial color="#e7c85d" /></mesh>
        </group> : null}
        {name ? (
          <Html center position={[0, 1.58, 0]} distanceFactor={12}>
            <span className="world3d-nameplate">{name}</span>
          </Html>
        ) : null}
      </Billboard>
    </group>
  );
}

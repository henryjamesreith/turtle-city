"use client";

import { Billboard, Html, useTexture } from "@react-three/drei";
import * as THREE from "three";
import { getTurtleImage, type TurtleVariant } from "@/lib/turtles";

type TurtleBillboardProps = {
  name?: string;
  scale?: number;
  variant: TurtleVariant;
};

export function TurtleBillboard({
  name,
  scale = 0.88,
  variant,
}: TurtleBillboardProps) {
  const texture = useTexture(getTurtleImage(variant));

  return (
    <group scale={scale}>
      <mesh position={[0, 0.035, 0]} rotation-x={-Math.PI / 2} renderOrder={0}>
        <circleGeometry args={[0.62, 32]} />
        <meshBasicMaterial
          color="#263b20"
          depthWrite={false}
          opacity={0.28}
          transparent
        />
      </mesh>
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
        {name ? (
          <Html center position={[0, 1.58, 0]} distanceFactor={12}>
            <span className="world3d-nameplate">{name}</span>
          </Html>
        ) : null}
      </Billboard>
    </group>
  );
}

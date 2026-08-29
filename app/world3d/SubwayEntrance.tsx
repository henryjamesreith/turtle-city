"use client";

import { Html } from "@react-three/drei";

type SubwayEntranceProps = {
  nearby?: boolean;
  position: readonly [number, number];
  rotationY?: number;
  stationName: string;
};

export function SubwayEntrance({
  nearby = false,
  position,
  rotationY = 0,
  stationName,
}: SubwayEntranceProps) {
  return (
    <group position={[position[0], 0.1, position[1]]} rotation-y={rotationY}>
      <mesh position={[0, 0.24, 0]} castShadow receiveShadow>
        <boxGeometry args={[4.4, 0.48, 3]} />
        <meshStandardMaterial color="#8d918d" roughness={0.96} />
      </mesh>
      <mesh position={[0, 0.5, 0]}>
        <boxGeometry args={[3.65, 0.55, 2.35]} />
        <meshStandardMaterial color="#151c1d" roughness={0.94} />
      </mesh>
      {Array.from({ length: 6 }, (_, index) => (
        <mesh key={index} position={[-1.25 + index * 0.43, 0.57 - index * 0.045, 0]} receiveShadow>
          <boxGeometry args={[0.42, 0.12, 2.05]} />
          <meshStandardMaterial color="#656b68" roughness={0.98} />
        </mesh>
      ))}

      {[-1.28, 1.28].map((z) => (
        <group key={z} position-z={z}>
          {[-1.72, 1.72].map((x) => (
            <mesh key={x} position={[x, 1.45, 0]} castShadow>
              <boxGeometry args={[0.11, 2.35, 0.11]} />
              <meshStandardMaterial color="#167347" metalness={0.28} roughness={0.52} />
            </mesh>
          ))}
          <mesh position={[0, 2.56, 0]} castShadow>
            <boxGeometry args={[3.55, 0.12, 0.12]} />
            <meshStandardMaterial color="#167347" metalness={0.28} roughness={0.52} />
          </mesh>
          <mesh position={[0, 1.48, 0]} castShadow>
            <boxGeometry args={[3.45, 0.08, 0.08]} />
            <meshStandardMaterial color="#167347" metalness={0.28} roughness={0.52} />
          </mesh>
        </group>
      ))}

      {[-1.68, 1.68].map((x) => (
        <group key={x} position={[x, 0, -1.28]}>
          <mesh position-y={2.95}><cylinderGeometry args={[0.07, 0.09, 0.85, 10]} /><meshStandardMaterial color="#17201f" /></mesh>
          <mesh position-y={3.42}><sphereGeometry args={[0.22, 14, 10]} /><meshStandardMaterial color="#fff0b8" emissive="#c08a36" emissiveIntensity={nearby ? 2.2 : 0.85} /></mesh>
        </group>
      ))}
      <mesh position={[-0.25, 2.94, -1.34]} castShadow>
        <boxGeometry args={[2.35, 0.74, 0.14]} />
        <meshStandardMaterial color="#202625" roughness={0.75} />
      </mesh>
      <mesh position={[-1.11, 2.94, -1.43]}>
        <circleGeometry args={[0.25, 24]} />
        <meshBasicMaterial color="#2d9b59" />
      </mesh>
      <Html center position={[-1.11, 2.94, -1.45]} distanceFactor={10}>
        <span className="world3d-subway-badge">T</span>
      </Html>
      <Html center position={[0.2, 2.94, -1.46]} distanceFactor={10}>
        <span className="world3d-subway-name">{stationName}</span>
      </Html>
      {nearby ? <pointLight position={[0, 2.2, 0]} color="#8bffbb" intensity={9} distance={7} /> : null}
    </group>
  );
}

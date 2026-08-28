"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Html, Instance, Instances, Sky } from "@react-three/drei";
import { Suspense, useEffect, useRef, useState, type MutableRefObject } from "react";
import * as THREE from "three";
import { DistrictLiveStatus } from "./MultiplayerDistrictPlayers";
import { TurtleBillboard } from "./world3d/TurtleBillboard";
import {
  moveWithCollisions,
  updateCharacterMotion,
  type WorldCollider,
} from "./world3d/movement";
import { useDistrictMultiplayer } from "@/lib/multiplayer/useDistrictMultiplayer";
import { districtMultiplayerConfigs, type MultiplayerDistrictId } from "@/lib/multiplayer/districts";
import { isTurtleVariant, type TurtleVariant } from "@/lib/turtles";

type DistrictTheme = "fidi" | "midtown" | "park" | "village";
type WorldPoint = readonly [number, number];
type DistrictAction = {
  button: string;
  detail: string;
  id: string;
  label: string;
  onEnter: () => void;
  position: WorldPoint;
  radius?: number;
  type: "activity" | "subway";
};

type OutdoorDistrict3DProps = {
  actions: DistrictAction[];
  districtId: MultiplayerDistrictId;
  spawn: string;
  spawnPositions: Record<string, WorldPoint>;
  theme: DistrictTheme;
  title: string;
  turtleName: string;
  turtleVariant: TurtleVariant;
};

const MIN_X = -30;
const MAX_X = 30;
const MIN_Z = -11;
const MAX_Z = 11;

function networkToWorld(districtId: MultiplayerDistrictId, x: number, y: number) {
  const bounds = districtMultiplayerConfigs[districtId].bounds;
  return {
    x: MIN_X + ((x - bounds.minimumX) / (bounds.maximumX - bounds.minimumX)) * (MAX_X - MIN_X),
    z: MIN_Z + ((y - bounds.minimumY) / (bounds.maximumY - bounds.minimumY)) * (MAX_Z - MIN_Z),
  };
}

function worldToNetwork(districtId: MultiplayerDistrictId, x: number, z: number) {
  const bounds = districtMultiplayerConfigs[districtId].bounds;
  return {
    x: bounds.minimumX + ((x - MIN_X) / (MAX_X - MIN_X)) * (bounds.maximumX - bounds.minimumX),
    y: bounds.minimumY + ((z - MIN_Z) / (MAX_Z - MIN_Z)) * (bounds.maximumY - bounds.minimumY),
  };
}

function BlockBuilding({ color, height, width, x, z }: { color: string; height: number; width: number; x: number; z: number }) {
  const rows = Math.max(3, Math.floor(height / 2.6));
  const columns = Math.max(2, Math.floor(width / 2.2));
  const front = z < 0 ? 3.55 : -3.55;
  return (
    <group position={[x, 0, z]}>
      <mesh position-y={height / 2} castShadow receiveShadow>
        <boxGeometry args={[width, height, 7]} />
        <meshStandardMaterial color={color} roughness={0.88} />
      </mesh>
      <Instances limit={rows * columns}>
        <planeGeometry args={[0.72, 1.1]} />
        <meshStandardMaterial color="#8dadb3" emissive="#122226" emissiveIntensity={0.3} />
        {Array.from({ length: rows * columns }, (_, index) => {
          const column = index % columns;
          const row = Math.floor(index / columns);
          return <Instance key={index} color={(index + row) % 4 === 0 ? "#f3cc77" : "#8dadb3"} position={[-width / 2 + 1.1 + column * ((width - 2.2) / Math.max(1, columns - 1)), 2 + row * 2.15, front]} rotation-y={z < 0 ? 0 : Math.PI} />;
        })}
      </Instances>
      <group position={[0, 0, z < 0 ? 3.72 : -3.72]} rotation-y={z < 0 ? 0 : Math.PI}>
        <mesh position-y={1.65} castShadow><boxGeometry args={[2.25, 3.3, 0.22]} /><meshStandardMaterial color="#263d35" roughness={0.72} /></mesh>
        <mesh position={[0, 1.86, 0.14]}><boxGeometry args={[1.48, 1.72, 0.08]} /><meshStandardMaterial color="#71969a" roughness={0.28} /></mesh>
        <mesh position={[0.72, 1.34, 0.22]}><sphereGeometry args={[0.08, 10, 8]} /><meshStandardMaterial color="#f0cf79" metalness={0.65} roughness={0.25} /></mesh>
        <mesh position={[0, 3.48, 0.16]}><boxGeometry args={[2.6, 0.22, 0.7]} /><meshStandardMaterial color="#7d563c" roughness={0.78} /></mesh>
        <pointLight position={[0, 3.2, 0.8]} color="#ffd995" intensity={3.5} distance={3.5} />
      </group>
    </group>
  );
}

function StreetBase({ color = "#34393b" }: { color?: string }) {
  return <group>
    <mesh position-y={-0.09} receiveShadow><boxGeometry args={[66, 0.18, 24]} /><meshStandardMaterial color={color} roughness={0.97} /></mesh>
    <mesh position={[0, 0.08, -9.2]} receiveShadow><boxGeometry args={[66, 0.16, 4.8]} /><meshStandardMaterial color="#b8b8b0" roughness={0.95} /></mesh>
    <mesh position={[0, 0.08, 9.2]} receiveShadow><boxGeometry args={[66, 0.16, 4.8]} /><meshStandardMaterial color="#b8b8b0" roughness={0.95} /></mesh>
    {Array.from({ length: 11 }, (_, index) => <mesh key={index} position={[-27 + index * 5.4, 0.015, 2.2]}><boxGeometry args={[2.8, 0.03, 0.17]} /><meshBasicMaterial color="#eee5c8" /></mesh>)}
  </group>;
}

function SubwayMarker({ position }: { position: WorldPoint }) {
  return <group position={[position[0], 0.1, position[1]]}>
    <mesh position-y={0.2} castShadow><boxGeometry args={[3.6, 0.4, 2.5]} /><meshStandardMaterial color="#858b88" /></mesh>
    <mesh position-y={0.45}><boxGeometry args={[3, 0.45, 1.9]} /><meshStandardMaterial color="#131a1b" /></mesh>
    {[-1.42, 1.42].flatMap((x) => [-1, 1].map((z) => <mesh key={`${x}-${z}`} position={[x, 1.55, z]}><boxGeometry args={[0.1, 2.4, 0.1]} /><meshStandardMaterial color="#167347" metalness={0.25} /></mesh>))}
    {[-1, 1].map((z) => <mesh key={z} position={[0, 2.7, z]}><boxGeometry args={[2.9, 0.1, 0.1]} /><meshStandardMaterial color="#167347" /></mesh>)}
    <mesh position={[-1.42, 3.1, -1]}><sphereGeometry args={[0.22, 12, 9]} /><meshStandardMaterial color="#fff0b8" emissive="#b47e2f" emissiveIntensity={1.1} /></mesh>
    <Html center position={[0.2, 3.08, -1.08]} distanceFactor={11}><span className="outdoor3d-subway">T · SUBWAY</span></Html>
  </group>;
}

function WinterPark() {
  const trees = Array.from({ length: 34 }, (_, index) => {
    const side = index % 2 === 0 ? -1 : 1;
    return { x: side * (11 + (index % 6) * 3.4), z: -10 + (index * 3.7) % 20, scale: 0.7 + (index % 4) * 0.12 };
  });
  return <group>
    <mesh position-y={-0.12} receiveShadow><boxGeometry args={[66, 0.24, 26]} /><meshStandardMaterial color="#dfe9e8" roughness={0.98} /></mesh>
    {[[-21,-7,7],[-16,7,5],[22,-6,6],[23,8,5]].map(([x,z,size], index) => <mesh key={index} position={[x,-0.8,z]} scale={[size,1.7,size*.72]} receiveShadow><sphereGeometry args={[1,18,12]} /><meshStandardMaterial color="#edf3f1" roughness={1} /></mesh>)}
    <mesh position={[0, 0.02, 0]} receiveShadow><boxGeometry args={[8, 0.06, 25]} /><meshStandardMaterial color="#bac8c6" roughness={0.96} /></mesh>
    <mesh position={[13, 0.03, 1]} rotation-x={-Math.PI / 2}><circleGeometry args={[5.3, 32]} /><meshStandardMaterial color="#85c9d7" roughness={0.3} metalness={0.08} /></mesh>
    <Instances limit={trees.length}><cylinderGeometry args={[0.16,0.24,2,7]} /><meshStandardMaterial color="#6f5135" />{trees.map((tree,index) => <Instance key={index} position={[tree.x,tree.scale,tree.z]} scale={tree.scale} />)}</Instances>
    <Instances limit={trees.length} castShadow><coneGeometry args={[1.05,2.8,7]} /><meshStandardMaterial color="#315f4b" />{trees.map((tree,index) => <Instance key={index} position={[tree.x,2.5*tree.scale,tree.z]} scale={tree.scale} />)}</Instances>
    <Instances limit={trees.length}><coneGeometry args={[0.78,1.9,7]} /><meshStandardMaterial color="#f1f5ef" />{trees.map((tree,index) => <Instance key={index} position={[tree.x,3.2*tree.scale,tree.z]} scale={tree.scale} />)}</Instances>
    {[-8,8].map((z) => <group key={z} position={[-5,0.45,z]}><mesh castShadow><boxGeometry args={[2.8,.22,.65]} /><meshStandardMaterial color="#765536" /></mesh><mesh position={[-1, -.45, 0]}><boxGeometry args={[.18,.9,.5]} /><meshStandardMaterial color="#4d493e" /></mesh><mesh position={[1,-.45,0]}><boxGeometry args={[.18,.9,.5]} /><meshStandardMaterial color="#4d493e" /></mesh></group>)}
  </group>;
}

function WestVillageScenery({ actions }: { actions: DistrictAction[] }) {
  const bikeStart = actions.find((action) => action.id === "waterfront")?.position ?? [-13, 0];
  return <group>
    {/* Hudson River on the west/left edge */}
    <mesh position={[-32, -0.08, 0]} receiveShadow>
      <boxGeometry args={[13, 0.16, 28]} />
      <meshStandardMaterial color="#5596aa" metalness={0.08} roughness={0.34} />
    </mesh>
    <mesh position={[-25.4, 0.28, 0]} castShadow>
      <boxGeometry args={[0.7, 0.56, 28]} />
      <meshStandardMaterial color="#8f9692" roughness={0.92} />
    </mesh>

    {/* West Side Highway running north/south beside the river */}
    <mesh position={[-20.2, -0.05, 0]} receiveShadow>
      <boxGeometry args={[9.5, 0.1, 28]} />
      <meshStandardMaterial color="#303638" roughness={0.98} />
    </mesh>
    {[-22.2, -18.2].flatMap((x) =>
      [-10, -6, -2, 2, 6, 10].map((z) => (
        <mesh key={`${x}-${z}`} position={[x, 0.015, z]}>
          <boxGeometry args={[0.16, 0.03, 2.15]} />
          <meshBasicMaterial color="#eee4bd" />
        </mesh>
      )),
    )}
    <Html center position={[-20.2, 0.5, -10.5]} distanceFactor={18}>
      <span className="outdoor3d-road-sign">WEST SIDE HWY</span>
    </Html>

    {/* Protected Hudson greenway */}
    <mesh position={[-13.4, 0.02, 0]} receiveShadow>
      <boxGeometry args={[3.2, 0.08, 28]} />
      <meshStandardMaterial color="#6d9d73" roughness={0.92} />
    </mesh>
    <mesh position={[-13.4, 0.075, 0]}>
      <boxGeometry args={[0.12, 0.03, 28]} />
      <meshBasicMaterial color="#e8e4bd" />
    </mesh>
    {[-15.25, -11.55].map((x) => (
      <mesh key={x} position={[x, 0.22, 0]}>
        <boxGeometry args={[0.18, 0.44, 28]} />
        <meshStandardMaterial color="#a9aaa2" roughness={0.9} />
      </mesh>
    ))}

    {/* Neighborhood street and brownstones to the east/right */}
    <mesh position={[8, -0.07, 0]} receiveShadow>
      <boxGeometry args={[39.2, 0.14, 24]} />
      <meshStandardMaterial color="#393f40" roughness={0.98} />
    </mesh>
    <mesh position={[8, 0.06, -9.3]} receiveShadow><boxGeometry args={[39.2, 0.14, 4.4]} /><meshStandardMaterial color="#bbb9af" /></mesh>
    <BlockBuilding x={1} z={-14} width={12} height={17} color="#975f49" />
    <BlockBuilding x={15} z={-14} width={13} height={20} color="#b98d66" />
    <BlockBuilding x={27} z={-14} width={9} height={15} color="#718075" />
    <mesh position={[8, 1.45, -10.5]}><boxGeometry args={[8, 2.8, 0.4]} /><meshStandardMaterial color="#392044" /></mesh>
    <group position={[8, 0, -10.24]}>
      <mesh position-y={1.45} castShadow><boxGeometry args={[1.8, 2.9, 0.22]} /><meshStandardMaterial color="#161019" roughness={0.72} /></mesh>
      <mesh position={[0, 1.78, 0.14]}><boxGeometry args={[1.18, 1.42, 0.08]} /><meshStandardMaterial color="#704d73" emissive="#502355" emissiveIntensity={0.5} /></mesh>
      <mesh position={[0.58, 1.25, 0.22]}><sphereGeometry args={[0.07, 10, 8]} /><meshStandardMaterial color="#e9b65f" metalness={0.6} /></mesh>
      <pointLight position={[0, 2.9, 0.8]} color="#d66cc8" intensity={4.5} distance={4} />
    </group>
    <Html center position={[8, 1.6, -10.75]} distanceFactor={14}><span className="outdoor3d-neon">THE CELLAR NOTE</span></Html>

    {/* Highly visible bike-race start */}
    <group position={[bikeStart[0], 0, bikeStart[1]]}>
      {[-1.35, 1.35].map((x) => <mesh key={x} position={[x, 1.55, 0]} castShadow><boxGeometry args={[0.16, 3.1, 0.16]} /><meshStandardMaterial color="#f0c84b" /></mesh>)}
      <mesh position={[0, 3.03, 0]} castShadow><boxGeometry args={[2.85, 0.42, 0.18]} /><meshStandardMaterial color="#173d30" /></mesh>
      <Html center position={[0, 3.05, -0.12]} distanceFactor={11}><span className="outdoor3d-bike-start">HUDSON BIKE RACE · START</span></Html>
      <mesh position={[-0.55, 0.42, 0.35]} rotation-z={Math.PI / 2}><torusGeometry args={[0.35, 0.07, 10, 20]} /><meshStandardMaterial color="#26302e" /></mesh>
      <mesh position={[0.55, 0.42, 0.35]} rotation-z={Math.PI / 2}><torusGeometry args={[0.35, 0.07, 10, 20]} /><meshStandardMaterial color="#26302e" /></mesh>
      <mesh position={[0, 0.72, 0.35]} rotation-z={-0.2}><boxGeometry args={[1.2, 0.1, 0.1]} /><meshStandardMaterial color="#e6aa32" /></mesh>
    </group>
    {actions.filter((action) => action.type === "subway").map((action) => <SubwayMarker key={action.id} position={action.position} />)}
  </group>;
}

function DistrictScenery({ actions, theme }: { actions: DistrictAction[]; theme: DistrictTheme }) {
  if (theme === "park") return <><WinterPark />{actions.filter((action) => action.type === "subway").map((action) => <SubwayMarker key={action.id} position={action.position} />)}</>;
  if (theme === "village") return <WestVillageScenery actions={actions} />;
  const palette = theme === "midtown" ? ["#495a68", "#76547c", "#465f63"] : theme === "fidi" ? ["#667579", "#8d8170", "#53696d"] : ["#9a654e", "#bc9169", "#6d7c72"];
  return <group>
    <StreetBase color={theme === "midtown" ? "#252b32" : "#34393b"} />
    <BlockBuilding x={-22} z={-14} width={15} height={theme === "midtown" ? 27 : 17} color={palette[0]} />
    <BlockBuilding x={-5} z={-14} width={15} height={theme === "fidi" ? 25 : 20} color={palette[1]} />
    <BlockBuilding x={15} z={-14} width={21} height={theme === "midtown" ? 31 : 22} color={palette[2]} />
    {theme === "midtown" ? <><Html center position={[-5, 8, -10.7]} distanceFactor={25}><span className="outdoor3d-neon is-midtown">TURTLE SQUARE</span></Html><mesh position={[11, 0.35, -7.3]}><boxGeometry args={[3, 0.7, 1.2]} /><meshStandardMaterial color="#338a57" /></mesh></> : null}
    {theme === "fidi" ? <><mesh position={[0, 0.05, 11.7]}><boxGeometry args={[66, 0.1, 3.8]} /><meshStandardMaterial color="#4a8fa3" /></mesh>{[-26,-18,-10,-2,6,14,22,30].map((x) => <mesh key={x} position={[x,.65,10.2]}><cylinderGeometry args={[.08,.1,1.3,8]} /><meshStandardMaterial color="#304d50" /></mesh>)}<Html center position={[13, 2, -10.7]} distanceFactor={16}><span className="outdoor3d-neon is-fidi">ONE SHELL PLAZA</span></Html></> : null}
    {actions.filter((action) => action.type === "subway").map((action) => <SubwayMarker key={action.id} position={action.position} />)}
  </group>;
}

function RemotePlayers({ districtId, players, targets }: { districtId: MultiplayerDistrictId; players: Array<{ sessionId: string; turtleName: string; variant: string }>; targets: MutableRefObject<Map<string, { currentX: number; currentY: number; facing: string; x: number; y: number }>> }) {
  const refs = useRef(new Map<string, THREE.Group>());
  useFrame((_, delta) => refs.current.forEach((group, id) => {
    const target = targets.current.get(id); if (!target) return;
    const smoothing = 1 - Math.exp(-delta * 10); target.currentX += (target.x - target.currentX) * smoothing; target.currentY += (target.y - target.currentY) * smoothing;
    const position = networkToWorld(districtId, target.currentX, target.currentY); group.position.set(position.x, 0, position.z);
  }));
  return players.map((player) => <group key={player.sessionId} ref={(group) => { if (group) refs.current.set(player.sessionId, group); else refs.current.delete(player.sessionId); }}><TurtleBillboard name={player.turtleName} scale={0.82} variant={isTurtleVariant(player.variant) ? player.variant : "clover"} /></group>);
}

function Controller({ actions, districtId, onNearby, sendMovement, spawn, spawnPositions, theme, turtleName, turtleVariant }: OutdoorDistrict3DProps & { onNearby: (id: string | null) => void; sendMovement: (movement: { facing: "left" | "right"; x: number; y: number }) => void }) {
  const player = useRef<THREE.Group>(null); const visual = useRef<THREE.Group>(null); const keys = useRef(new Set<string>()); const active = useRef<string | null>(null); const yaw = useRef(0); const distance = useRef(14); const dragging = useRef(false); const lastX = useRef(0); const lastSend = useRef(0); const facing = useRef<"left" | "right">("right"); const velocity = useRef(new THREE.Vector3()); const { camera, gl } = useThree();
  const colliders: WorldCollider[] = actions.filter((action) => action.type === "subway").map((action) => ({ minX: action.position[0] - 2, maxX: action.position[0] + 2, minZ: action.position[1] - 1.55, maxZ: action.position[1] + 1.55 }));
  const movementBounds = { minX: theme === "village" ? -24.2 : MIN_X + 1, maxX: MAX_X - 1, minZ: -7.7, maxZ: MAX_Z };
  useEffect(() => {
    const down = (event: KeyboardEvent) => { const key = event.key.toLowerCase(); if (["w","a","s","d","arrowup","arrowdown","arrowleft","arrowright","shift"].includes(key)) { event.preventDefault(); keys.current.add(key); } else if (key === "enter" && !event.repeat) actions.find((action) => action.id === active.current)?.onEnter(); };
    const up = (event: KeyboardEvent) => keys.current.delete(event.key.toLowerCase()); const blur = () => keys.current.clear();
    const pointerDown = (event: PointerEvent) => { dragging.current = true; lastX.current = event.clientX; gl.domElement.setPointerCapture(event.pointerId); };
    const pointerMove = (event: PointerEvent) => { if (!dragging.current) return; yaw.current -= (event.clientX - lastX.current) * 0.007; lastX.current = event.clientX; };
    const pointerUp = () => { dragging.current = false; }; const wheel = (event: WheelEvent) => { event.preventDefault(); distance.current = THREE.MathUtils.clamp(distance.current + event.deltaY * 0.012, 9, 22); };
    window.addEventListener("keydown", down, { passive: false }); window.addEventListener("keyup", up); window.addEventListener("blur", blur); gl.domElement.addEventListener("pointerdown", pointerDown); gl.domElement.addEventListener("pointermove", pointerMove); gl.domElement.addEventListener("pointerup", pointerUp); gl.domElement.addEventListener("wheel", wheel, { passive: false });
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); window.removeEventListener("blur", blur); gl.domElement.removeEventListener("pointerdown", pointerDown); gl.domElement.removeEventListener("pointermove", pointerMove); gl.domElement.removeEventListener("pointerup", pointerUp); gl.domElement.removeEventListener("wheel", wheel); };
  }, [actions, gl]);
  useFrame((state, delta) => {
    if (!player.current || !visual.current) return; const horizontal = Number(keys.current.has("d") || keys.current.has("arrowright")) - Number(keys.current.has("a") || keys.current.has("arrowleft")); const forward = Number(keys.current.has("w") || keys.current.has("arrowup")) - Number(keys.current.has("s") || keys.current.has("arrowdown")); const moving = horizontal !== 0 || forward !== 0;
    const targetVelocity = moving ? new THREE.Vector3(horizontal, 0, -forward).normalize().applyAxisAngle(new THREE.Vector3(0,1,0), yaw.current).multiplyScalar(keys.current.has("shift") ? 9 : 5.3) : new THREE.Vector3();
    velocity.current.lerp(targetVelocity, 1 - Math.exp(-delta * (moving ? 10 : 8)));
    if (Math.abs(velocity.current.x) > 0.05) facing.current = velocity.current.x < 0 ? "left" : "right";
    moveWithCollisions(player.current.position, velocity.current.clone().multiplyScalar(Math.min(delta, 0.05)), movementBounds, colliders);
    const closest = actions.map((action) => ({ action, distance: Math.hypot(player.current!.position.x - action.position[0], player.current!.position.z - action.position[1]) })).filter(({ action, distance: actionDistance }) => actionDistance <= (action.radius ?? 3.5)).sort((a,b) => a.distance - b.distance)[0]?.action.id ?? null; if (closest !== active.current) { active.current = closest; onNearby(closest); }
    updateCharacterMotion(visual.current, state.clock.elapsedTime, velocity.current.length(), delta);
    const target = player.current.position.clone().add(new THREE.Vector3(0,1.35,0)); const desired = target.clone().add(new THREE.Vector3(Math.sin(yaw.current) * distance.current, distance.current * 0.52, Math.cos(yaw.current) * distance.current)); camera.position.lerp(desired, 1 - Math.exp(-delta * 6)); camera.lookAt(target);
    if (state.clock.elapsedTime * 1000 - lastSend.current >= 65) { const network = worldToNetwork(districtId, player.current.position.x, player.current.position.z); sendMovement({ facing: facing.current, ...network }); lastSend.current = state.clock.elapsedTime * 1000; }
  });
  const start = spawnPositions[spawn] ?? [0,0]; return <group ref={player} position={[start[0],0,start[1]]}><group ref={visual}><TurtleBillboard name={turtleName} variant={turtleVariant} /></group></group>;
}

export function OutdoorDistrict3D(props: OutdoorDistrict3DProps) {
  const [nearby, setNearby] = useState<string | null>(null); const multiplayer = useDistrictMultiplayer(props.districtId, props.spawn); const prompt = props.actions.find((action) => action.id === nearby) ?? null;
  const sky = props.theme === "midtown" ? "#18213a" : props.theme === "park" ? "#cbdce4" : "#bed6df";
  return <main className={`outdoor3d-stage theme-${props.theme}`} data-testid={`${props.districtId}-district-3d`}>
    <Canvas camera={{ fov: 48, near: 0.1, far: 130, position: [0,7,16] }} dpr={[1,1.5]} gl={{ antialias: true, powerPreference: "high-performance" }} performance={{ min: 0.6 }} shadows><Suspense fallback={null}><color attach="background" args={[sky]} /><fog attach="fog" args={[sky,38,82]} /><Sky sunPosition={props.theme === "midtown" ? [-8,4,-5] : [8,11,5]} turbidity={8} rayleigh={2.2} /><hemisphereLight args={["#e9f4f7", "#4d5350", props.theme === "midtown" ? 0.85 : 1.6]} /><directionalLight castShadow intensity={props.theme === "midtown" ? 1.2 : 2.1} position={[12,18,8]} shadow-mapSize={[1024,1024]} shadow-camera-left={-36} shadow-camera-right={36} shadow-camera-top={28} shadow-camera-bottom={-28} /><DistrictScenery actions={props.actions} theme={props.theme} />{props.actions.map((action) => <mesh key={action.id} position={[action.position[0],0.14,action.position[1]]} rotation-x={-Math.PI/2}><ringGeometry args={[1.1,1.28,36]} /><meshBasicMaterial color={nearby === action.id ? "#fff2a3" : "#74c787"} opacity={nearby === action.id ? 1 : 0.5} transparent /></mesh>)}<Controller {...props} onNearby={setNearby} sendMovement={multiplayer.sendMovement} /><RemotePlayers districtId={props.districtId} players={multiplayer.remotePlayers} targets={multiplayer.remoteTargetsRef} /></Suspense></Canvas>
    <header className="outdoor3d-title"><p>Turtle City</p><h1>{props.title}</h1></header><DistrictLiveStatus remotePlayerCount={multiplayer.remotePlayers.length} status={multiplayer.status} /><aside className="outdoor3d-controls"><strong>Explore {props.title}</strong><span>WASD · Shift to run</span><span>Drag camera · Scroll to zoom</span></aside>{prompt ? <aside className="outdoor3d-prompt"><div><strong>{prompt.label}</strong><small>{prompt.detail}</small></div><button type="button" onClick={prompt.onEnter}>{prompt.button}</button></aside> : null}
    <style jsx global>{`.outdoor3d-stage{position:relative;width:100vw;height:100vh;overflow:hidden}.outdoor3d-stage canvas{display:block;cursor:grab;touch-action:none}.outdoor3d-title{position:absolute;top:26px;left:30px;color:#18392a;text-shadow:0 2px rgba(255,255,255,.4);pointer-events:none}.theme-midtown .outdoor3d-title{color:#f3e7ff;text-shadow:0 2px #171326}.outdoor3d-title p{margin:0 0 2px;font:850 12px/1.2 system-ui;letter-spacing:.16em;text-transform:uppercase}.outdoor3d-title h1{margin:0;font:900 clamp(30px,4vw,48px)/1 system-ui;letter-spacing:-.045em}.outdoor3d-controls{position:absolute;left:30px;bottom:28px;display:grid;gap:3px;padding:13px 16px;color:#efffe9;background:rgba(20,52,35,.86);border:1px solid rgba(255,255,255,.22);border-radius:13px;backdrop-filter:blur(10px);font:650 12px/1.4 system-ui}.outdoor3d-controls strong{font-size:14px}.outdoor3d-controls span{opacity:.78}.outdoor3d-prompt{position:absolute;left:50%;bottom:28px;transform:translateX(-50%);display:flex;align-items:center;gap:24px;min-width:330px;padding:13px 14px 13px 17px;color:white;background:rgba(20,52,35,.92);border:1px solid rgba(255,255,255,.25);border-radius:14px;backdrop-filter:blur(12px)}.outdoor3d-prompt div{display:grid;gap:3px;flex:1}.outdoor3d-prompt strong{font:800 14px/1.1 system-ui}.outdoor3d-prompt small{opacity:.75;font:600 11px/1.2 system-ui}.outdoor3d-prompt button{padding:10px 13px;color:#173b29;background:#fff2a3;border:0;border-radius:9px;cursor:pointer;font:800 12px/1 system-ui}.outdoor3d-subway,.outdoor3d-neon,.outdoor3d-road-sign,.outdoor3d-bike-start,.outdoor3d-activity-sign{white-space:nowrap;padding:5px 7px;color:white;background:#202625;border-radius:5px;font:900 9px/1 system-ui;letter-spacing:.08em;pointer-events:none}.outdoor3d-neon{color:#ffb8ef;background:#38203e;box-shadow:0 0 12px #d769c4}.outdoor3d-neon.is-midtown{color:#8ef8ff;background:#182d44;box-shadow:0 0 16px #4adce8}.outdoor3d-neon.is-fidi{color:#fff1b5;background:#314b50;box-shadow:none}.outdoor3d-road-sign{color:#fff3c8;background:#335646}.outdoor3d-bike-start{color:#17372b;background:#f2d45c;border:1px solid #8c7624}.outdoor3d-activity-sign{color:#17382b;background:#f3dc7d}.outdoor3d-activity-sign.is-neon{color:#9af8ff;background:#20314a;box-shadow:0 0 12px #58dce3}.outdoor3d-activity-sign.is-jazz{color:#ffb7ef;background:#38203f;box-shadow:0 0 10px #d86bc5}`}</style>
  </main>;
}

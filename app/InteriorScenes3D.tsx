"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import { Suspense, useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { TurtleBillboard } from "./world3d/TurtleBillboard";
import {
  moveWithCollisions,
  updateCharacterMotion,
  type WorldCollider,
} from "./world3d/movement";
import { subwayStations, type TransitDistrict } from "@/lib/world/subway";
import type { TurtleVariant } from "@/lib/turtles";

type WalkerProps = {
  actionActive?: boolean;
  actionPosition?: readonly [number, number];
  bounds: { maxX: number; maxZ: number; minX: number; minZ: number };
  cameraOffset?: readonly [number, number, number];
  colliders?: readonly WorldCollider[];
  name: string;
  onEnter?: () => void;
  onNearChange?: (near: boolean) => void;
  start: readonly [number, number];
  variant: TurtleVariant;
};

function InteriorWalker({
  actionActive = true,
  actionPosition,
  bounds,
  cameraOffset = [7, 8, 11],
  colliders = [],
  name,
  onEnter,
  onNearChange,
  start,
  variant,
}: WalkerProps) {
  const player = useRef<THREE.Group>(null);
  const visual = useRef<THREE.Group>(null);
  const keys = useRef(new Set<string>());
  const near = useRef(false);
  const velocity = useRef(new THREE.Vector3());
  const { camera } = useThree();
  const onEnterRef = useRef(onEnter);
  const activeRef = useRef(actionActive);

  useEffect(() => { onEnterRef.current = onEnter; }, [onEnter]);
  useEffect(() => { activeRef.current = actionActive; }, [actionActive]);
  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if (["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright", "shift"].includes(key)) {
        event.preventDefault();
        keys.current.add(key);
      } else if (key === "enter" && near.current && activeRef.current && !event.repeat) {
        event.preventDefault();
        onEnterRef.current?.();
      }
    };
    const up = (event: KeyboardEvent) => keys.current.delete(event.key.toLowerCase());
    const blur = () => keys.current.clear();
    window.addEventListener("keydown", down, { passive: false });
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
    };
  }, []);

  useFrame((state, delta) => {
    if (!player.current || !visual.current) return;
    const horizontal = Number(keys.current.has("d") || keys.current.has("arrowright")) - Number(keys.current.has("a") || keys.current.has("arrowleft"));
    const vertical = Number(keys.current.has("s") || keys.current.has("arrowdown")) - Number(keys.current.has("w") || keys.current.has("arrowup"));
    const moving = horizontal !== 0 || vertical !== 0;
    const targetVelocity = moving
      ? new THREE.Vector3(horizontal, 0, vertical).normalize().multiplyScalar(keys.current.has("shift") ? 6.4 : 4.2)
      : new THREE.Vector3();
    velocity.current.lerp(targetVelocity, 1 - Math.exp(-delta * (moving ? 11 : 9)));
    moveWithCollisions(
      player.current.position,
      velocity.current.clone().multiplyScalar(Math.min(delta, 0.05)),
      bounds,
      colliders,
      0.42,
    );
    if (actionPosition) {
      const nextNear = Math.hypot(player.current.position.x - actionPosition[0], player.current.position.z - actionPosition[1]) < 2.2;
      if (nextNear !== near.current) { near.current = nextNear; onNearChange?.(nextNear); }
    }
    updateCharacterMotion(visual.current, state.clock.elapsedTime, velocity.current.length(), delta);
    const target = player.current.position.clone().add(new THREE.Vector3(0, 1.2, 0));
    const desired = target.clone().add(new THREE.Vector3(...cameraOffset));
    camera.position.lerp(desired, 1 - Math.exp(-delta * 5));
    camera.lookAt(target);
  });

  return <group ref={player} position={[start[0], 0, start[1]]}><group ref={visual}><TurtleBillboard name={name} scale={0.82} variant={variant} /></group></group>;
}

function ApartmentRoom({ nearDoor, onNearDoor, onExit, turtleName, turtleVariant }: { nearDoor: boolean; onNearDoor: (near: boolean) => void; onExit: () => void; turtleName: string; turtleVariant: TurtleVariant }) {
  return <>
    <color attach="background" args={["#c8b99f"]} /><ambientLight intensity={1.25} /><directionalLight castShadow position={[5, 10, 7]} intensity={2} shadow-mapSize={[1024, 1024]} />
    <mesh position={[0, -0.13, 0]} receiveShadow><boxGeometry args={[18, 0.26, 13]} /><meshStandardMaterial color="#7c654f" roughness={0.96} /></mesh>
    <mesh position={[0, 4, -6.4]} receiveShadow><boxGeometry args={[18, 8, 0.28]} /><meshStandardMaterial color="#c6b28e" roughness={0.94} /></mesh>
    <mesh position={[-8.9, 4, 0]} receiveShadow><boxGeometry args={[0.28, 8, 13]} /><meshStandardMaterial color="#aa987d" /></mesh>
    {/* Door 4B */}<group position={[-6.7, 0, -6.12]}><mesh position-y={2}><boxGeometry args={[2.7, 4, 0.32]} /><meshStandardMaterial color="#315345" emissive={nearDoor ? "#315a3e" : "#000"} emissiveIntensity={0.6} /></mesh><mesh position={[-0.85, 2, 0.22]}><sphereGeometry args={[0.1, 12, 8]} /><meshStandardMaterial color="#f0c86c" metalness={0.6} /></mesh><Html center position={[0, 3.25, 0.24]} distanceFactor={11}><span className="interior3d-sign">4B · STREET</span></Html></group>
    {/* Window */}<group position={[4.7, 3.4, -6.15]}><mesh><boxGeometry args={[4.4, 3.7, 0.22]} /><meshStandardMaterial color="#486567" /></mesh><mesh position-z={0.14}><planeGeometry args={[3.8, 3.1]} /><meshBasicMaterial color="#8eb9c4" /></mesh></group>
    {/* Bed */}<group position={[4.9, 0.5, 2.8]} rotation-y={-0.08}><mesh castShadow><boxGeometry args={[5.4, 0.65, 3.1]} /><meshStandardMaterial color="#735845" /></mesh><mesh position-y={0.52} castShadow><boxGeometry args={[5.1, 0.5, 2.85]} /><meshStandardMaterial color="#ddd0b2" /></mesh><mesh position={[-1.7, 0.92, 0]}><boxGeometry args={[1.35, 0.34, 2.1]} /><meshStandardMaterial color="#b5a98f" /></mesh></group>
    {/* Kitchen */}<group position={[-5.4, 0, 2.8]}><mesh position-y={1}><boxGeometry args={[4.8, 2, 1.8]} /><meshStandardMaterial color="#7d7668" /></mesh><mesh position={[0, 2.12, 0]}><boxGeometry args={[5, 0.22, 2]} /><meshStandardMaterial color="#aaa28f" /></mesh><mesh position={[0.7, 2.26, 0]}><boxGeometry args={[1.35, 0.08, 1]} /><meshStandardMaterial color="#596b6c" /></mesh></group>
    {/* Crates, radiator, bare bulb */}<mesh position={[-1.5, 0.65, 4.1]} castShadow><boxGeometry args={[1.7, 1.3, 1.7]} /><meshStandardMaterial color="#8e633e" /></mesh><group position={[7.5, 0.7, -5.7]}>{[-0.6,-0.3,0,0.3,0.6].map((x) => <mesh key={x} position-x={x}><boxGeometry args={[0.2,1.4,0.32]} /><meshStandardMaterial color="#797b73" /></mesh>)}</group><pointLight position={[0, 6.3, 0]} color="#ffd98b" intensity={22} distance={18} /><mesh position={[0, 6.1, 0]}><sphereGeometry args={[0.22, 12, 9]} /><meshStandardMaterial color="#ffe7ad" emissive="#f0a941" emissiveIntensity={2} /></mesh>
    <mesh position={[-6.7, 0.08, -4.8]} rotation-x={-Math.PI/2}><ringGeometry args={[0.9,1.08,32]} /><meshBasicMaterial color={nearDoor ? "#fff0a0" : "#72bd82"} transparent opacity={0.75} /></mesh>
    <InteriorWalker actionPosition={[-6.7,-4.8]} bounds={{minX:-7.5,maxX:7.5,minZ:-5,maxZ:5}} colliders={[{minX:2,maxX:7.8,minZ:1,maxZ:4.7},{minX:-7.8,maxX:-2.8,minZ:1.65,maxZ:4},{minX:-2.5,maxX:-.5,minZ:3.1,maxZ:5}]} name={turtleName} onEnter={onExit} onNearChange={onNearDoor} start={[0,2]} variant={turtleVariant} />
  </>;
}

export function ChelseaApartment3D({ onExitToChelsea, turtleName, turtleVariant }: { onExitToChelsea: () => void; turtleName: string; turtleVariant: TurtleVariant }) {
  const [nearDoor, setNearDoor] = useState(false);
  return <main className="interior3d-stage" data-testid="chelsea-apartment-3d"><Canvas camera={{fov:48,near:.1,far:80,position:[8,9,14]}} dpr={[1,1.5]} shadows><Suspense fallback={null}><ApartmentRoom nearDoor={nearDoor} onNearDoor={setNearDoor} onExit={onExitToChelsea} turtleName={turtleName} turtleVariant={turtleVariant} /></Suspense></Canvas><header className="interior3d-title"><p>Chelsea · Apartment 4B</p><h1>Your apartment</h1><span>Starter condition · needs work</span></header><aside className="interior3d-controls">WASD to move · Enter near the door</aside>{nearDoor ? <aside className="interior3d-prompt"><div><strong>Apartment 4B</strong><small>Go outside to Chelsea.</small></div><button type="button" onClick={onExitToChelsea}>Go outside</button></aside> : null}<InteriorStyles /></main>;
}

const FIRST_ARRIVAL_TIME = 1; const ARRIVAL_END = 2; const BOARDING_END = 9; const CYCLE_END = 11;

function PlatformTrain({ phase }: { phase: "waiting" | "arriving" | "boarding" | "departing" }) {
  const train = useRef<THREE.Group>(null);
  useEffect(() => {
    train.current?.position.set(-30, 0, -4);
  }, []);
  useFrame((_, delta) => { if (!train.current) return; const target = phase === "waiting" ? -30 : phase === "arriving" ? 0 : phase === "boarding" ? 0 : 30; train.current.position.x = THREE.MathUtils.lerp(train.current.position.x, target, 1 - Math.exp(-delta * (phase === "departing" ? 2 : 3.5))); });
  return <group ref={train}><mesh position-y={2.25} castShadow><boxGeometry args={[24,4.5,3.3]} /><meshStandardMaterial color="#b9c1c1" metalness={0.35} roughness={0.5} /></mesh>{[-8,-4,0,4,8].map((x) => <mesh key={x} position={[x,2.65,1.67]}><planeGeometry args={[2.3,1.35]} /><meshStandardMaterial color="#263c43" emissive="#14272c" emissiveIntensity={0.7} /></mesh>)}<mesh position={[0,1.75,1.72]}><planeGeometry args={[2.5,3.2]} /><meshStandardMaterial color="#7d8988" /></mesh></group>;
}

export function SubwayPlatform3D({ origin, onBoard, onExit, turtleName, turtleVariant }: { origin: TransitDistrict; onBoard: () => void; onExit: () => void; turtleName: string; turtleVariant: TurtleVariant }) {
  const [cycleTime, setCycleTime] = useState(0); const [nearTrain, setNearTrain] = useState(false); const station = subwayStations[origin]; const phase = cycleTime < FIRST_ARRIVAL_TIME ? "waiting" : cycleTime < ARRIVAL_END ? "arriving" : cycleTime < BOARDING_END ? "boarding" : "departing";
  useEffect(() => { const timer = window.setInterval(() => setCycleTime((current) => current + .25 >= CYCLE_END ? 0 : current + .25), 250); return () => window.clearInterval(timer); }, []);
  return <main className="interior3d-stage is-platform" data-testid="subway-platform-3d"><Canvas camera={{fov:48,near:.1,far:100,position:[8,8,15]}} dpr={[1,1.5]} shadows><Suspense fallback={null}><color attach="background" args={["#111919"]} /><ambientLight intensity={1.1} /><pointLight position={[0,6,3]} intensity={32} color="#e8e2c6" distance={30} /><mesh position={[0,-.12,3]} receiveShadow><boxGeometry args={[30,.24,8]} /><meshStandardMaterial color="#8b887b" /></mesh><mesh position={[0,.02,-1.2]}><boxGeometry args={[30,.05,.45]} /><meshStandardMaterial color="#f1d55a" /></mesh><mesh position={[0,3.2,-6]}><boxGeometry args={[30,6.4,.35]} /><meshStandardMaterial color="#38645c" /></mesh><Html center position={[0,4,-5.75]} distanceFactor={18}><span className="interior3d-station">{station.name} · {station.platformDirection}</span></Html>{[-9,0,9].map((x) => <group key={x} position-x={x}><mesh position={[0,3,3]}><cylinderGeometry args={[.12,.12,6,10]} /><meshStandardMaterial color="#303735" /></mesh><mesh position={[0,6,3]}><boxGeometry args={[5,.12,.5]} /><meshStandardMaterial color="#f1e8c9" emissive="#c8b56c" emissiveIntensity={1} /></mesh></group>)}<PlatformTrain phase={phase} /><mesh position={[0,.08,0]} rotation-x={-Math.PI/2}><ringGeometry args={[1.05,1.22,32]} /><meshBasicMaterial color={phase === "boarding" && nearTrain ? "#fff0a0" : "#73bd82"} opacity={.72} transparent /></mesh><InteriorWalker actionActive={phase === "boarding"} actionPosition={[0,0]} bounds={{minX:-11,maxX:11,minZ:0,maxZ:6}} cameraOffset={[7,7,12]} name={turtleName} onEnter={onBoard} onNearChange={setNearTrain} start={[8,4]} variant={turtleVariant} /></Suspense></Canvas><header className="interior3d-title"><p>{station.neighborhood} · T train</p><h1>{station.name}</h1><span>{phase === "boarding" ? "Now boarding" : phase === "arriving" ? "Train arriving" : phase === "departing" ? "Train departing" : "Next train · 1 sec"}</span></header><button className="interior3d-exit" type="button" onClick={onExit}>← Street</button>{phase === "boarding" ? <aside className="interior3d-prompt"><div><strong>T train now boarding</strong><small>Walk to the doors and press Enter.</small></div><button type="button" onClick={onBoard}>Board</button></aside> : null}<InteriorStyles /></main>;
}

function TrainCar({ name, variant }: { name: string; variant: TurtleVariant }) {
  return <><color attach="background" args={["#b5c0bf"]} /><ambientLight intensity={1.6} /><pointLight position={[0,5,0]} intensity={26} color="#f7f1d7" distance={25} /><mesh position={[0,-.12,0]} receiveShadow><boxGeometry args={[22,.24,8]} /><meshStandardMaterial color="#6c7472" /></mesh><mesh position={[0,3.2,-4]}><boxGeometry args={[22,6.4,.28]} /><meshStandardMaterial color="#d0d4cf" /></mesh><mesh position={[0,3.2,4]}><boxGeometry args={[22,6.4,.28]} /><meshStandardMaterial color="#d0d4cf" /></mesh>{[-8,-4,4,8].map((x) => <group key={x}><mesh position={[x,1,-3.2]}><boxGeometry args={[3,1.2,1.2]} /><meshStandardMaterial color="#d5963d" /></mesh><mesh position={[x,1,3.2]}><boxGeometry args={[3,1.2,1.2]} /><meshStandardMaterial color="#d5963d" /></mesh></group>)}{[-6,0,6].map((x) => <mesh key={x} position={[x,3,0]}><cylinderGeometry args={[.07,.07,6,10]} /><meshStandardMaterial color="#c4c8c2" metalness={.7} /></mesh>)}<mesh position={[0,2.2,-3.82]}><boxGeometry args={[3.4,4.3,.16]} /><meshStandardMaterial color="#778382" /></mesh><InteriorWalker bounds={{minX:-9,maxX:9,minZ:-2.1,maxZ:2.1}} cameraOffset={[5.8,4.8,2.25]} colliders={[-6,0,6].map((x) => ({minX:x-.25,maxX:x+.25,minZ:-.3,maxZ:.3}))} name={name} start={[1.5,0]} variant={variant} /></>;
}

export function SubwayTrain3D({ onChooseStop, origin, turtleName, turtleVariant }: { onChooseStop: () => void; origin: TransitDistrict; turtleName: string; turtleVariant: TurtleVariant }) {
  const station = subwayStations[origin]; return <main className="interior3d-stage is-train" data-testid="subway-train-3d"><Canvas camera={{fov:52,near:.1,far:80,position:[5.8,5.8,2.25]}} dpr={[1,1.5]} shadows><Suspense fallback={null}><TrainCar name={turtleName} variant={turtleVariant} /></Suspense></Canvas><header className="interior3d-title"><p>T train · now leaving</p><h1>{station.name}</h1><span>Walk around the car or choose a stop.</span></header><section className="train3d-map-card"><div><b>T</b><span><small>Next stop</small><strong>Choose destination</strong></span></div><button type="button" onClick={onChooseStop}>Open subway map →</button></section><InteriorStyles /></main>;
}

function InteriorStyles() {
  return <style jsx global>{`.interior3d-stage{position:relative;width:100vw;height:100vh;overflow:hidden;background:#b9c4c1}.interior3d-stage canvas{display:block}.interior3d-title{position:absolute;top:26px;left:30px;color:#17392b;text-shadow:0 2px rgba(255,255,255,.4);pointer-events:none}.is-platform .interior3d-title{color:#f2ead0;text-shadow:0 2px #10221c}.interior3d-title p{margin:0 0 2px;font:850 12px/1.2 system-ui;letter-spacing:.14em;text-transform:uppercase}.interior3d-title h1{margin:0;font:900 clamp(29px,4vw,46px)/1 system-ui;letter-spacing:-.045em}.interior3d-title span{display:block;margin-top:7px;font:700 12px/1 system-ui;opacity:.72}.interior3d-controls{position:absolute;left:30px;bottom:28px;padding:12px 15px;color:white;background:rgba(20,52,35,.86);border-radius:12px;font:700 12px/1 system-ui}.interior3d-prompt{position:absolute;left:50%;bottom:28px;transform:translateX(-50%);display:flex;align-items:center;gap:22px;min-width:320px;padding:13px 14px;color:white;background:rgba(20,52,35,.92);border-radius:14px}.interior3d-prompt div{display:grid;gap:3px;flex:1}.interior3d-prompt strong{font:800 14px/1 system-ui}.interior3d-prompt small{font:600 11px/1.2 system-ui;opacity:.75}.interior3d-prompt button,.interior3d-exit,.train3d-map-card button{padding:10px 13px;color:#17392b;background:#fff0a0;border:0;border-radius:9px;cursor:pointer;font:800 12px/1 system-ui}.interior3d-exit{position:absolute;top:30px;right:30px}.interior3d-sign,.interior3d-station{white-space:nowrap;padding:5px 8px;color:#fff0b4;background:#173c2e;border-radius:5px;font:900 10px/1 system-ui;letter-spacing:.08em}.interior3d-station{color:white;background:#1d2423;font-size:12px}.train3d-map-card{position:absolute;right:30px;bottom:28px;display:flex;align-items:center;gap:20px;padding:12px 13px 12px 15px;color:white;background:rgba(25,49,43,.9);border-radius:14px}.train3d-map-card div{display:flex;align-items:center;gap:10px}.train3d-map-card b{display:grid;place-items:center;width:30px;height:30px;background:#2d9b59;border-radius:50%;font:900 16px/1 system-ui}.train3d-map-card span{display:grid;gap:2px}.train3d-map-card small{opacity:.7;font:650 10px/1 system-ui}.train3d-map-card strong{font:800 13px/1 system-ui}`}</style>;
}

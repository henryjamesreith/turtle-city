"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import { Suspense, useContext, useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { TurtleBillboard } from "./world3d/TurtleBillboard";
import { Skateboard, SkateboardOwnershipContext, SKATEBOARD_SPEED } from "./world3d/Skateboard";
import {
  moveWithCollisions,
  updateCharacterMotion,
  type WorldCollider,
} from "./world3d/movement";
import {
  getDirectionTerminus,
  getOneLineStopIndex,
  oneLineStops,
  subwayStations,
  type SubwayDirection,
  type TransitDistrict,
} from "@/lib/world/subway";
import type { TurtleVariant } from "@/lib/turtles";

type WalkerProps = {
  actionActive?: boolean;
  actionPosition?: readonly [number, number];
  actionPositions?: readonly { id: string; position: readonly [number, number] }[];
  bounds: { maxX: number; maxZ: number; minX: number; minZ: number };
  cameraOffset?: readonly [number, number, number];
  colliders?: readonly WorldCollider[];
  name: string;
  hasSkateboard?: boolean;
  onEnter?: (actionId?: string) => void;
  onNearChange?: (near: boolean) => void;
  start: readonly [number, number];
  variant: TurtleVariant;
};

function InteriorWalker({
  actionActive = true,
  actionPosition,
  actionPositions,
  bounds,
  cameraOffset = [7, 8, 11],
  colliders = [],
  name,
  hasSkateboard,
  onEnter,
  onNearChange,
  start,
  variant,
}: WalkerProps) {
  const globallyOwnsSkateboard = useContext(SkateboardOwnershipContext);
  const ownsSkateboard = hasSkateboard ?? globallyOwnsSkateboard;
  const player = useRef<THREE.Group>(null);
  const visual = useRef<THREE.Group>(null);
  const keys = useRef(new Set<string>());
  const near = useRef(false);
  const nearAction = useRef<string | undefined>(undefined);
  const velocity = useRef(new THREE.Vector3());
  const { camera } = useThree();
  const onEnterRef = useRef(onEnter);
  const activeRef = useRef(actionActive);
  const isSubwayPlatform = cameraOffset[0] === 7 && cameraOffset[1] === 7 && cameraOffset[2] === 12;
  const resolvedCameraOffset: readonly [number, number, number] =
    cameraOffset[0] === 7 && cameraOffset[1] === 7 && cameraOffset[2] === 12
      ? [8, 6.25, 3]
      : cameraOffset;
  const [riding, setRiding] = useState(ownsSkateboard);

  useEffect(() => { onEnterRef.current = onEnter; }, [onEnter]);
  useEffect(() => { activeRef.current = actionActive; }, [actionActive]);
  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if (["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(key)) {
        event.preventDefault();
        keys.current.add(key);
      } else if (key === "r" && ownsSkateboard && !event.repeat) {
        setRiding((current) => !current);
      } else if (key === "enter" && near.current && activeRef.current && !event.repeat) {
        event.preventDefault();
        if (isSubwayPlatform && nearAction.current) {
          window.dispatchEvent(new CustomEvent("turtle-subway-board", { detail: nearAction.current }));
        } else {
          onEnterRef.current?.(nearAction.current);
        }
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
  }, [isSubwayPlatform, ownsSkateboard]);

  useFrame((state, delta) => {
    if (!player.current || !visual.current) return;
    const horizontal = Number(keys.current.has("d") || keys.current.has("arrowright")) - Number(keys.current.has("a") || keys.current.has("arrowleft"));
    const vertical = Number(keys.current.has("s") || keys.current.has("arrowdown")) - Number(keys.current.has("w") || keys.current.has("arrowup"));
    const moving = horizontal !== 0 || vertical !== 0;
    const targetVelocity = moving
      ? new THREE.Vector3(horizontal, 0, vertical).normalize().multiplyScalar(riding ? SKATEBOARD_SPEED : 4.2)
      : new THREE.Vector3();
    velocity.current.lerp(targetVelocity, 1 - Math.exp(-delta * (moving ? 11 : 9)));
    moveWithCollisions(
      player.current.position,
      velocity.current.clone().multiplyScalar(Math.min(delta, 0.05)),
      bounds,
      colliders,
      0.42,
    );
    const actions = actionPositions ?? (isSubwayPlatform
      ? [{ id: "downtown", position: [0, 0] as const }, { id: "uptown", position: [0, 6] as const }]
      : actionPosition ? [{ id: "default", position: actionPosition }] : []);
    if (actions.length > 0) {
      const closest = actions
        .map((action) => ({ ...action, distance: Math.hypot(player.current!.position.x - action.position[0], player.current!.position.z - action.position[1]) }))
        .sort((a, b) => a.distance - b.distance)[0];
      const nextNear = closest.distance < 2.2;
      nearAction.current = nextNear ? closest.id : undefined;
      if (nextNear !== near.current) { near.current = nextNear; onNearChange?.(nextNear); }
    }
    updateCharacterMotion(visual.current, state.clock.elapsedTime, velocity.current.length(), delta);
    const target = player.current.position.clone().add(new THREE.Vector3(0, 1.2, 0));
    const desired = target.clone().add(new THREE.Vector3(...resolvedCameraOffset));
    camera.position.lerp(desired, 1 - Math.exp(-delta * 5));
    camera.lookAt(target);
  });

  return <group ref={player} position={[start[0], 0, start[1]]}><group ref={visual}>{riding ? <Skateboard /> : null}<group position-y={riding ? 0.43 : 0}><TurtleBillboard name={name} scale={0.82} variant={variant} /></group></group></group>;
}

function ApartmentRoom({ apartmentTier, hasSkateboard, nearDoor, onNearDoor, onExit, turtleName, turtleVariant }: { apartmentTier: number; hasSkateboard: boolean; nearDoor: boolean; onNearDoor: (near: boolean) => void; onExit: () => void; turtleName: string; turtleVariant: TurtleVariant }) {
  return <>
    <color attach="background" args={["#c8b99f"]} /><ambientLight intensity={1.25} /><directionalLight castShadow position={[5, 10, 7]} intensity={2} shadow-mapSize={[1024, 1024]} />
    <mesh position={[0, -0.13, 0]} receiveShadow><boxGeometry args={[18, 0.26, 13]} /><meshStandardMaterial color={apartmentTier >= 2 ? "#b88855" : "#7c654f"} roughness={0.96} /></mesh>
    <mesh position={[0, 4, -6.4]} receiveShadow><boxGeometry args={[18, 8, 0.28]} /><meshStandardMaterial color={apartmentTier >= 1 ? "#e5d8bd" : "#c6b28e"} roughness={0.94} /></mesh>
    <mesh position={[-8.9, 4, 0]} receiveShadow><boxGeometry args={[0.28, 8, 13]} /><meshStandardMaterial color="#aa987d" /></mesh>
    {/* Door 4B */}<group position={[-6.7, 0, -6.12]}><mesh position-y={2}><boxGeometry args={[2.7, 4, 0.32]} /><meshStandardMaterial color="#315345" emissive={nearDoor ? "#315a3e" : "#000"} emissiveIntensity={0.6} /></mesh><mesh position={[-0.85, 2, 0.22]}><sphereGeometry args={[0.1, 12, 8]} /><meshStandardMaterial color="#f0c86c" metalness={0.6} /></mesh><Html center position={[0, 3.25, 0.24]} distanceFactor={11}><span className="interior3d-sign">4B · STREET</span></Html></group>
    {/* Window */}<group position={[4.7, 3.4, -6.15]}><mesh><boxGeometry args={[4.4, 3.7, 0.22]} /><meshStandardMaterial color="#486567" /></mesh><mesh position-z={0.14}><planeGeometry args={[3.8, 3.1]} /><meshBasicMaterial color="#8eb9c4" /></mesh></group>
    {/* Bed */}<group position={[4.9, 0.5, 2.8]} rotation-y={-0.08}><mesh castShadow><boxGeometry args={[5.4, 0.65, 3.1]} /><meshStandardMaterial color="#735845" /></mesh><mesh position-y={0.52} castShadow><boxGeometry args={[5.1, 0.5, 2.85]} /><meshStandardMaterial color="#ddd0b2" /></mesh><mesh position={[-1.7, 0.92, 0]}><boxGeometry args={[1.35, 0.34, 2.1]} /><meshStandardMaterial color="#b5a98f" /></mesh></group>
    {/* Kitchen */}<group position={[-5.4, 0, 2.8]}><mesh position-y={1}><boxGeometry args={[4.8, 2, 1.8]} /><meshStandardMaterial color="#7d7668" /></mesh><mesh position={[0, 2.12, 0]}><boxGeometry args={[5, 0.22, 2]} /><meshStandardMaterial color="#aaa28f" /></mesh><mesh position={[0.7, 2.26, 0]}><boxGeometry args={[1.35, 0.08, 1]} /><meshStandardMaterial color="#596b6c" /></mesh></group>
    {/* Crates, radiator, bare bulb */}<mesh position={[-1.5, 0.65, 4.1]} castShadow><boxGeometry args={[1.7, 1.3, 1.7]} /><meshStandardMaterial color="#8e633e" /></mesh><group position={[7.5, 0.7, -5.7]}>{[-0.6,-0.3,0,0.3,0.6].map((x) => <mesh key={x} position-x={x}><boxGeometry args={[0.2,1.4,0.32]} /><meshStandardMaterial color="#797b73" /></mesh>)}</group><pointLight position={[0, 6.3, 0]} color="#ffd98b" intensity={22} distance={18} /><mesh position={[0, 6.1, 0]}><sphereGeometry args={[0.22, 12, 9]} /><meshStandardMaterial color="#ffe7ad" emissive="#f0a941" emissiveIntensity={2} /></mesh>
    <mesh position={[-6.7, 0.08, -4.8]} rotation-x={-Math.PI/2}><ringGeometry args={[0.9,1.08,32]} /><meshBasicMaterial color={nearDoor ? "#fff0a0" : "#72bd82"} transparent opacity={0.75} /></mesh>
    {apartmentTier >= 1 ? <group position={[-1.4,.5,3.8]}><mesh castShadow><cylinderGeometry args={[.48,.6,1,10]} /><meshStandardMaterial color="#c4944f" /></mesh><mesh position-y={1.25}><sphereGeometry args={[.8,10,7]} /><meshStandardMaterial color="#5f8b55" /></mesh></group> : null}
    {apartmentTier >= 2 ? <group position={[0,.45,-5.9]}><mesh><boxGeometry args={[4.5,.9,.5]} /><meshStandardMaterial color="#315345" /></mesh><mesh position={[0,.75,.1]}><boxGeometry args={[3.4,.75,.18]} /><meshStandardMaterial color="#d7b85e" /></mesh></group> : null}
    {apartmentTier >= 3 ? <group position={[-1,0,0]}><mesh position-y={.32}><cylinderGeometry args={[1.8,1.8,.18,32]} /><meshStandardMaterial color="#c9604d" /></mesh><pointLight position={[0,4,0]} color="#ffd88b" intensity={15} distance={9} /></group> : null}
    <InteriorWalker hasSkateboard={hasSkateboard} actionPosition={[-6.7,-4.8]} bounds={{minX:-7.5,maxX:7.5,minZ:-5,maxZ:5}} colliders={[{minX:2,maxX:7.8,minZ:1,maxZ:4.7},{minX:-7.8,maxX:-2.8,minZ:1.65,maxZ:4},{minX:-2.5,maxX:-.5,minZ:3.1,maxZ:5}]} name={turtleName} onEnter={onExit} onNearChange={onNearDoor} start={[0,2]} variant={turtleVariant} />
  </>;
}

export function ChelseaApartment3D({ apartmentTier, hasSkateboard, onExitToChelsea, onPurchaseUpgrade, onUpgrade, shells, turtleName, turtleVariant, upgrades }: { apartmentTier: number; hasSkateboard: boolean; onExitToChelsea: () => void; onPurchaseUpgrade: (itemKey: string) => Promise<void>; onUpgrade: () => Promise<void>; shells: number; turtleName: string; turtleVariant: TurtleVariant; upgrades: string[] }) {
  const [nearDoor, setNearDoor] = useState(false);
  const [upgradeError, setUpgradeError] = useState(""); const [upgrading, setUpgrading] = useState(false); const costs = [50,125,250]; const cost = costs[apartmentTier]; const labels = ["Starter", "Freshened up", "Renovated", "Dream apartment"];
  const [storeOpen, setStoreOpen] = useState(false); const [buying, setBuying] = useState("");
  const items = [{ key: "apartment-warm-lights", name: "Warm Lighting", price: 75 }, { key: "apartment-fresh-walls", name: "Fresh Walls", price: 125 }, { key: "apartment-comfy-bed", name: "Comfy Bed", price: 175 }];
  async function buyUpgrade() { setUpgrading(true); setUpgradeError(""); try { await onUpgrade(); } catch { setUpgradeError("You need more shells for this renovation."); } finally { setUpgrading(false); } }
  return <main className="interior3d-stage" data-testid="chelsea-apartment-3d"><Canvas camera={{fov:48,near:.1,far:80,position:[8,9,14]}} dpr={[1,1.5]} shadows="basic"><Suspense fallback={null}><ApartmentRoom apartmentTier={apartmentTier} hasSkateboard={hasSkateboard} nearDoor={nearDoor} onNearDoor={setNearDoor} onExit={onExitToChelsea} turtleName={turtleName} turtleVariant={turtleVariant} /></Suspense></Canvas><header className="interior3d-title"><p>Chelsea · Apartment 4B</p><h1>Your apartment</h1><span>Tier {apartmentTier} · {labels[apartmentTier] ?? labels[3]}</span></header><button type="button" className="apartment-store-button" onClick={() => setStoreOpen(true)}>🐚 {shells} · Improvements</button><aside className="apartment-upgrade-card"><small>Apartment renovations</small><strong>{apartmentTier >= 3 ? "Fully upgraded" : `Next upgrade · ${cost} shells`}</strong><span>{apartmentTier === 0 ? "Fresh paint and a houseplant" : apartmentTier === 1 ? "Hardwood floors and new furniture" : apartmentTier === 2 ? "Designer lighting and a statement rug" : "Apartment 4B has never looked better."}</span>{upgradeError ? <em role="alert">{upgradeError}</em> : null}{apartmentTier < 3 ? <button type="button" disabled={upgrading || shells < cost} onClick={() => void buyUpgrade()}>{upgrading ? "Renovating…" : shells < cost ? `Need ${cost - shells} more` : `Upgrade for ${cost}`}</button> : null}</aside>{storeOpen ? <section className="apartment-store"><button type="button" className="store-close" onClick={() => setStoreOpen(false)}>×</button><h2>Improvements</h2>{items.map((item) => { const owned = upgrades.includes(item.key); return <div key={item.key}><span><b>{item.name}</b><small>{owned ? "Installed" : `${item.price} Shells`}</small></span><button type="button" disabled={owned || buying !== "" || shells < item.price} onClick={async () => { setBuying(item.key); setUpgradeError(""); try { await onPurchaseUpgrade(item.key); } catch (error) { setUpgradeError(error instanceof Error ? error.message : "Purchase failed."); } finally { setBuying(""); } }}>{owned ? "Owned" : buying === item.key ? "Installing…" : "Buy"}</button></div>; })}</section> : null}<aside className="interior3d-controls">WASD to move{hasSkateboard ? " · R to ride / walk" : ""} · Enter near the door</aside>{nearDoor ? <aside className="interior3d-prompt"><div><strong>Apartment 4B</strong><small>Go outside to Chelsea.</small></div><button type="button" onClick={onExitToChelsea}>Go outside</button></aside> : null}<InteriorStyles /></main>;
}

const FIRST_ARRIVAL_TIME = 1; const ARRIVAL_END = 2; const BOARDING_END = 9; const CYCLE_END = 11;
const TRAIN_TRAVEL_TIME = 2000;
const TRAIN_DOOR_TIME = 5000;
const TRAIN_TURNAROUND_TIME = 60000;

function PlatformTrainModel({ direction }: { direction: SubwayDirection }) {
  const platformSide = direction === "downtown" ? 1 : -1;
  return <group rotation-y={platformSide === 1 ? 0 : Math.PI}>
    <mesh position-y={2.08} castShadow><boxGeometry args={[25,3.95,3.35]} /><meshStandardMaterial color="#c8cecd" metalness={.65} roughness={.28} /></mesh>
    <mesh position={[0,4.08,0]}><boxGeometry args={[24.4,.2,3.12]} /><meshStandardMaterial color="#7f8988" metalness={.7} roughness={.35} /></mesh>
    <mesh position={[0,.25,0]}><boxGeometry args={[24.5,.35,3.18]} /><meshStandardMaterial color="#343c3c" metalness={.45} /></mesh>
    <mesh position={[0,3.58,1.71]}><planeGeometry args={[24.6,.22]} /><meshStandardMaterial color="#d83b36" roughness={.5} /></mesh>
    <mesh position={[0,.72,1.71]}><planeGeometry args={[24.6,.13]} /><meshStandardMaterial color="#4f5958" metalness={.7} /></mesh>
    {[-9.3,-6.9,-4.5,4.5,6.9,9.3].map((x) => <group key={x} position-x={x}><mesh position={[0,2.55,1.69]}><planeGeometry args={[1.75,1.12]} /><meshStandardMaterial color="#102833" emissive="#24546a" emissiveIntensity={.7} /></mesh><mesh position={[0,2.54,1.715]}><planeGeometry args={[1.46,.84]} /><meshStandardMaterial color="#183c49" transparent opacity={.72} /></mesh></group>)}
    {[-7,0,7].map((x) => <Html key={x} center position={[x,3.55,1.78]} distanceFactor={9}><span className="platform-train-side-sign"><b>1</b>{direction}</span></Html>)}
    {[-2.1,2.1].map((x) => <group key={x} position={[x,2.1,1.73]}><mesh position-x={-.82}><planeGeometry args={[1.55,3.25]} /><meshStandardMaterial color="#899392" metalness={.62} /></mesh><mesh position-x={.82}><planeGeometry args={[1.55,3.25]} /><meshStandardMaterial color="#899392" metalness={.62} /></mesh><mesh position={[0,3.04,.02]}><planeGeometry args={[2.8,.28]} /><meshBasicMaterial color="#202928" /></mesh><mesh position={[-.82,.65,.02]}><planeGeometry args={[1.1,.76]} /><meshStandardMaterial color="#173440" emissive="#1d4658" emissiveIntensity={.55} /></mesh><mesh position={[.82,.65,.02]}><planeGeometry args={[1.1,.76]} /><meshStandardMaterial color="#173440" emissive="#1d4658" emissiveIntensity={.55} /></mesh></group>)}
    {[-12.25,-6.25,0,6.25,12.25].map((x) => <mesh key={x} position={[x,2.05,1.72]}><planeGeometry args={[.055,3.65]} /><meshBasicMaterial color="#626c6b" /></mesh>)}
    <group position={[12.55,2.35,0]}><mesh><boxGeometry args={[.35,4.15,3.05]} /><meshStandardMaterial color="#202929" metalness={.45} /></mesh><mesh position={[.19,.7,0]} rotation-y={Math.PI/2}><planeGeometry args={[2.15,1.25]} /><meshStandardMaterial color="#0d2029" emissive="#173c49" emissiveIntensity={.8} /></mesh><Html center position={[.42,1.75,0]} distanceFactor={9}><span className="platform-train-route"><b>1</b>{direction}</span></Html><pointLight position={[.5,-.25,-.85]} intensity={9} distance={7} color="#fff4c7" /><pointLight position={[.5,-.25,.85]} intensity={9} distance={7} color="#fff4c7" /></group>
    {[-8,-4,0,4,8].map((x) => <group key={x} position={[x,.05,0]}><mesh rotation-z={Math.PI/2}><cylinderGeometry args={[.34,.34,.45,16]} /><meshStandardMaterial color="#151b1b" /></mesh><mesh position-z={1.35} rotation-x={Math.PI/2}><torusGeometry args={[.34,.1,8,16]} /><meshStandardMaterial color="#1b2222" /></mesh><mesh position-z={-1.35} rotation-x={Math.PI/2}><torusGeometry args={[.34,.1,8,16]} /><meshStandardMaterial color="#1b2222" /></mesh></group>)}
  </group>;
}

function MovingPlatformTrain({ direction, phase, trackZ }: { direction: SubwayDirection; phase: "waiting" | "arriving" | "boarding" | "departing"; trackZ: number }) {
  const train = useRef<THREE.Group>(null);
  const travelSign = direction === "downtown" ? 1 : -1;
  useEffect(() => { train.current?.position.set(-30 * travelSign, 0, trackZ); }, [trackZ, travelSign]);
  useFrame((state, delta) => {
    if (!train.current) return;
    const target = phase === "waiting" ? -30 * travelSign : phase === "arriving" || phase === "boarding" ? 0 : 30 * travelSign;
    train.current.position.x = THREE.MathUtils.lerp(train.current.position.x, target, 1 - Math.exp(-delta * (phase === "departing" ? 2 : 3.5)));
    if (phase === "boarding") train.current.position.y = Math.sin(state.clock.elapsedTime * 7) * .012;
  });
  return <group ref={train}><PlatformTrainModel direction={direction} /></group>;
}

function PlatformTrain({ phase }: { phase: "waiting" | "arriving" | "boarding" | "departing" }) {
  return <>{[-4,10].map((z) => <group key={z} position={[0,-.22,z]}><mesh><boxGeometry args={[34,.3,4.6]} /><meshStandardMaterial color="#252b2b" /></mesh>{[-1.15,1.15].map((rail) => <mesh key={rail} position={[0,.25,rail]}><boxGeometry args={[34,.12,.13]} /><meshStandardMaterial color="#89908d" metalness={.85} roughness={.24} /></mesh>)}</group>)}<mesh position={[0,.01,7.15]}><boxGeometry args={[30,.06,.42]} /><meshStandardMaterial color="#f1d55a" /></mesh>{[{id:"downtown",z:0},{id:"uptown",z:6}].map((zone) => <group key={zone.id} position={[0,.08,zone.z]}><mesh rotation-x={-Math.PI/2}><ringGeometry args={[1.05,1.25,32]} /><meshBasicMaterial color={phase === "boarding" ? "#fff0a0" : "#73bd82"} opacity={.82} transparent /></mesh><Html center position={[0,.08,0]} distanceFactor={10}><span className={`platform-zone-label is-${zone.id}`}><b>1</b>{zone.id}</span></Html></group>)}<Html center position={[-7,4.7,-1.1]} distanceFactor={13}><span className="platform-direction-sign"><b>1</b> DOWNTOWN · FiDi</span></Html><Html center position={[7,4.7,7.1]} distanceFactor={13}><span className="platform-direction-sign"><b>1</b> UPTOWN · Central Park</span></Html><MovingPlatformTrain direction="downtown" phase={phase} trackZ={-4} /><MovingPlatformTrain direction="uptown" phase={phase} trackZ={10} /></>;
}

export function SubwayPlatform3D({ origin, onBoard, onExit, turtleName, turtleVariant }: { origin: TransitDistrict; onBoard: (direction: SubwayDirection) => void; onExit: () => void; turtleName: string; turtleVariant: TurtleVariant }) {
  const originIndex = getOneLineStopIndex(origin);
  const availableDirections: SubwayDirection[] = [
    ...(originIndex < oneLineStops.length - 1 ? ["downtown" as const] : []),
    ...(originIndex > 0 ? ["uptown" as const] : []),
  ];
  const [direction, setDirection] = useState<SubwayDirection>(availableDirections[0]);
  const [cycleTime, setCycleTime] = useState(0); const [nearTrain, setNearTrain] = useState(false); const station = subwayStations[origin]; const phase = cycleTime < FIRST_ARRIVAL_TIME ? "waiting" : cycleTime < ARRIVAL_END ? "arriving" : cycleTime < BOARDING_END ? "boarding" : "departing";
  const nextStop = oneLineStops[originIndex + (direction === "downtown" ? 1 : -1)];
  const terminus = getDirectionTerminus(direction);
  const trainStatus = phase === "boarding" ? "At platform · doors open" : phase === "arriving" ? "Arriving now" : phase === "departing" ? "Departing" : "Next train · 1 sec";
  useEffect(() => { const timer = window.setInterval(() => setCycleTime((current) => current + .25 >= CYCLE_END ? 0 : current + .25), 250); return () => window.clearInterval(timer); }, []);
  useEffect(() => {
    const boardFromZone = (event: Event) => {
      const requestedDirection = (event as CustomEvent<string>).detail as SubwayDirection;
      const directionIsAvailable = requestedDirection === "downtown"
        ? originIndex < oneLineStops.length - 1
        : originIndex > 0;
      if (phase === "boarding" && directionIsAvailable) onBoard(requestedDirection);
    };
    window.addEventListener("turtle-subway-board", boardFromZone);
    return () => window.removeEventListener("turtle-subway-board", boardFromZone);
  }, [onBoard, originIndex, phase]);
  return <main className="interior3d-stage is-platform" data-testid="subway-platform-3d"><Canvas camera={{fov:48,near:.1,far:100,position:[8,8,15]}} dpr={[1,1.5]} shadows="basic"><Suspense fallback={null}><color attach="background" args={["#111919"]} /><ambientLight intensity={1.1} /><pointLight position={[0,6,3]} intensity={32} color="#e8e2c6" distance={30} /><mesh position={[0,-.12,3]} receiveShadow><boxGeometry args={[30,.24,8]} /><meshStandardMaterial color="#8b887b" /></mesh><mesh position={[0,.02,-1.2]}><boxGeometry args={[30,.05,.45]} /><meshStandardMaterial color="#f1d55a" /></mesh><mesh position={[0,3.2,-6]}><boxGeometry args={[30,6.4,.35]} /><meshStandardMaterial color="#38645c" /></mesh><Html center position={[0,4,-5.75]} distanceFactor={18}><span className="interior3d-station">{station.name} · {direction.toUpperCase()} 1</span></Html>{[-9,0,9].map((x) => <group key={x} position-x={x}><mesh position={[0,3,3]}><cylinderGeometry args={[.12,.12,6,10]} /><meshStandardMaterial color="#303735" /></mesh><mesh position={[0,6,3]}><boxGeometry args={[5,.12,.5]} /><meshStandardMaterial color="#f1e8c9" emissive="#c8b56c" emissiveIntensity={1} /></mesh></group>)}<PlatformTrain phase={phase} /><mesh position={[0,.08,0]} rotation-x={-Math.PI/2}><ringGeometry args={[1.05,1.22,32]} /><meshBasicMaterial color={phase === "boarding" && nearTrain ? "#fff0a0" : "#73bd82"} opacity={.72} transparent /></mesh><InteriorWalker actionActive={phase === "boarding"} actionPosition={[0,0]} bounds={{minX:-11,maxX:11,minZ:0,maxZ:6}} cameraOffset={[7,7,12]} name={turtleName} onEnter={() => onBoard(direction)} onNearChange={setNearTrain} start={[8,4]} variant={turtleVariant} /></Suspense></Canvas><header className="interior3d-title"><p>{station.neighborhood} · 1 train</p><h1>{station.name}</h1><span>{phase === "boarding" ? `Now boarding · ${direction} to ${terminus.neighborhood}` : phase === "arriving" ? "Train arriving" : phase === "departing" ? "Train departing" : "Next train · 1 sec"}</span></header><button className="interior3d-exit" type="button" onClick={onExit}>← Street</button><nav className="platform-directions" aria-label="Platform guide"><p>Trains at this station</p>{availableDirections.map((option) => { const optionNextStop = oneLineStops[originIndex + (option === "downtown" ? 1 : -1)]; return <button key={option} className={option === direction ? "is-active" : ""} type="button" aria-current={option === direction ? "true" : undefined} onClick={() => setDirection(option)}><b>1</b><span><strong>{option} <i aria-hidden="true">{option === "downtown" ? "↓" : "↑"}</i></strong><small>Next: {optionNextStop.name}</small><em>{trainStatus}</em></span></button>; })}<small className="platform-directions-hint">Follow the matching floor marker</small></nav>{phase === "boarding" ? <aside className="interior3d-prompt"><div><strong>{direction} 1 now boarding</strong><small>Next stop: {nextStop.name}. Walk to the doors and press Enter.</small></div><button type="button" onClick={() => onBoard(direction)}>Board</button></aside> : null}<InteriorStyles /></main>;
}

function TrainMotionCues({ doorsOpen }: { doorsOpen: boolean }) {
  const car = useRef<THREE.Group>(null);
  const leftDoor = useRef<THREE.Mesh>(null);
  const rightDoor = useRef<THREE.Mesh>(null);
  const tunnelLights = useRef<THREE.Group>(null);
  useFrame((state, delta) => {
    const doorOffset = doorsOpen ? 1.35 : 0;
    if (leftDoor.current) leftDoor.current.position.x = THREE.MathUtils.damp(leftDoor.current.position.x, -.86 - doorOffset, 9, delta);
    if (rightDoor.current) rightDoor.current.position.x = THREE.MathUtils.damp(rightDoor.current.position.x, .86 + doorOffset, 9, delta);
    if (tunnelLights.current && !doorsOpen) tunnelLights.current.position.x = ((tunnelLights.current.position.x - delta * 18 + 12) % 24) - 12;
    if (car.current) {
      car.current.rotation.z = doorsOpen ? 0 : Math.sin(state.clock.elapsedTime * 8) * .0035;
      car.current.position.y = doorsOpen ? 0 : Math.sin(state.clock.elapsedTime * 11) * .018;
    }
  });
  return <group ref={car}><group position={[0,3.05,-3.83]}>{[-7.1,-4.8,4.8,7.1].map((x) => <group key={x} position-x={x}><mesh><planeGeometry args={[1.82,1.72]} /><meshBasicMaterial color="#394947" /></mesh><mesh position-z={.012}><planeGeometry args={[1.65,1.55]} /><meshStandardMaterial color={doorsOpen ? "#24434b" : "#10242d"} emissive={doorsOpen ? "#315d63" : "#173947"} emissiveIntensity={doorsOpen ? .72 : .8} roughness={.28} metalness={.12} /></mesh></group>)}<group ref={tunnelLights}>{[-12,-8,-4,0,4,8,12].map((x) => <mesh key={x} position={[x,0,.03]} visible={!doorsOpen}><planeGeometry args={[.13,1.4]} /><meshBasicMaterial color="#f8e4a4" /></mesh>)}</group></group><group position={[0,2.2,-3.88]}><mesh ref={leftDoor} position={[-.86,0,0]}><boxGeometry args={[1.65,4.25,.12]} /><meshStandardMaterial color="#778382" metalness={.35} /></mesh><mesh ref={rightDoor} position={[.86,0,0]}><boxGeometry args={[1.65,4.25,.12]} /><meshStandardMaterial color="#778382" metalness={.35} /></mesh></group></group>;
}

type SubwayTurtlePassengerProps = {
  accent: string;
  shell: string;
  skin: string;
  weirdness: number;
};

function SubwayTurtlePassenger({ accent, shell, skin, weirdness }: SubwayTurtlePassengerProps) {
  const eyeColor = weirdness > .7 ? "#ffcc58" : "#e7d9a5";
  return <group scale={[.82 + weirdness * .1, .82 - weirdness * .06, .82]} rotation-z={(weirdness - .5) * .12}>
    {/* A compact, deliberately angular commuter built from the same low-poly primitives as the car. */}
    <mesh position={[0, .82, -.18]} scale={[.72, .88, .38]} castShadow>
      <sphereGeometry args={[1, 9, 7]} />
      <meshStandardMaterial color={shell} roughness={.88} flatShading />
    </mesh>
    <mesh position={[0, .82, .17]} scale={[.54, .69, .27]} castShadow>
      <sphereGeometry args={[1, 9, 7]} />
      <meshStandardMaterial color={accent} roughness={.82} flatShading />
    </mesh>
    {([[-.22,.72],[.22,.72],[-.2,.98],[.2,.98]] as const).map(([x,y]) => <mesh key={`${x}-${y}`} position={[x,y,.445]} scale={[.13,.1,.035]}>
      <sphereGeometry args={[1, 7, 5]} />
      <meshStandardMaterial color="#6d713f" roughness={.9} flatShading />
    </mesh>)}
    <mesh position={[.04 * weirdness, 1.57 + weirdness * .08, .08]} scale={[.53 + weirdness * .08, .46 - weirdness * .05, .48]} castShadow>
      <sphereGeometry args={[1, 9, 7]} />
      <meshStandardMaterial color={skin} roughness={.9} flatShading />
    </mesh>
    <mesh position={[0, 1.53, .45]} scale={[.43, .24, .3]} castShadow>
      <sphereGeometry args={[1, 8, 6]} />
      <meshStandardMaterial color={skin} roughness={.9} flatShading />
    </mesh>
    {[-.22,.22].map((x) => <group key={x} position={[x,1.74,.43]}>
      <mesh scale={[.105 + weirdness * .025,.1 - weirdness * .02,.055]}><sphereGeometry args={[1,8,6]} /><meshStandardMaterial color={eyeColor} emissive={weirdness > .7 ? "#5d2400" : "#000000"} emissiveIntensity={weirdness > .7 ? .45 : 0} flatShading /></mesh>
      <mesh position={[x < 0 ? .025 : -.025,-.015,.055]} scale={[.045,.055,.025]}><sphereGeometry args={[1,7,5]} /><meshBasicMaterial color="#14231c" /></mesh>
      <mesh position={[0,.105,.04]} rotation-z={x < 0 ? -.48 - weirdness * .18 : .48 + weirdness * .18}><boxGeometry args={[.27,.07,.06]} /><meshStandardMaterial color="#17291c" roughness={1} /></mesh>
    </group>)}
    <mesh position={[0,1.43,.73]} rotation-x={.12}><boxGeometry args={[.32,.045,.05]} /><meshBasicMaterial color="#172018" /></mesh>
    {[-.48,.48].map((x) => <mesh key={x} position={[x,.98,-.38]} rotation-z={x < 0 ? -.45 : .45} rotation-x={-.28} castShadow>
      <coneGeometry args={[.13,.38,5]} /><meshStandardMaterial color={shell} roughness={.96} flatShading />
    </mesh>)}
    {/* Folded arms make the passengers read as closed-off without adding violence. */}
    <mesh position={[-.32,.93,.45]} rotation-z={-1.05} rotation-x={.18} castShadow><capsuleGeometry args={[.115,.55,4,7]} /><meshStandardMaterial color={skin} roughness={.9} flatShading /></mesh>
    <mesh position={[.32,.93,.48]} rotation-z={1.05} rotation-x={-.18} castShadow><capsuleGeometry args={[.115,.55,4,7]} /><meshStandardMaterial color={skin} roughness={.9} flatShading /></mesh>
    {[-.27,.27].map((x) => <group key={x} position={[x,.25,.15]}>
      <mesh rotation-x={-.28} castShadow><capsuleGeometry args={[.15,.48,4,7]} /><meshStandardMaterial color={skin} roughness={.92} flatShading /></mesh>
      <mesh position={[0,-.37,.17]} scale={[.23,.12,.32]} castShadow><sphereGeometry args={[1,8,5]} /><meshStandardMaterial color={skin} roughness={.92} flatShading /></mesh>
    </group>)}
  </group>;
}

function SubwayTurtlePassengers() {
  const passengers = [
    { position: [-8, 1.58, -2.72] as const, rotation: -.12, skin: "#536c3d", shell: "#283b29", accent: "#a69849", weirdness: .35 },
    { position: [-4, 1.58, 2.72] as const, rotation: Math.PI + .14, skin: "#727a43", shell: "#3b3028", accent: "#b4984f", weirdness: .82 },
    { position: [4, 1.58, -2.72] as const, rotation: -.18, skin: "#426753", shell: "#233b35", accent: "#99974b", weirdness: 1 },
    { position: [8, 1.58, 2.72] as const, rotation: Math.PI + .08, skin: "#5e6639", shell: "#3c3024", accent: "#b0a15a", weirdness: .62 },
  ];
  return <>{passengers.map((passenger, index) => <group key={index} position={passenger.position} rotation-y={passenger.rotation}>
    <SubwayTurtlePassenger accent={passenger.accent} shell={passenger.shell} skin={passenger.skin} weirdness={passenger.weirdness} />
  </group>)}</>;
}

function SubwayPassengerMess() {
  return <group>
    {/* Familiar game-world transit nuisances: cluttered seats, trash, a leak, and too much noise. */}
    <group position={[-6.9,.18,-1.9]} rotation-y={-.3}>
      <mesh castShadow><cylinderGeometry args={[.18,.13,.42,8]} /><meshStandardMaterial color="#efe2bc" roughness={.85} /></mesh>
      <mesh position-y={.22}><cylinderGeometry args={[.21,.21,.035,8]} /><meshStandardMaterial color="#b93f35" /></mesh>
    </group>
    <mesh position={[-2.4,.018,.95]} rotation-x={-Math.PI/2} scale={[1.4,.65,1]}>
      <circleGeometry args={[.7,18]} /><meshStandardMaterial color="#40584f" roughness={.28} metalness={.05} transparent opacity={.72} />
    </mesh>
    <group position={[5.1,1.66,-3.05]} rotation-y={-.15}>
      <mesh castShadow><boxGeometry args={[1.15,.22,.9]} /><meshStandardMaterial color="#99703a" roughness={.95} /></mesh>
      <mesh position-y={.13}><boxGeometry args={[1.1,.04,.85]} /><meshStandardMaterial color="#bd8b45" /></mesh>
    </group>
    <group position={[7.1,1.75,3.03]}>
      <mesh castShadow><boxGeometry args={[.82,.72,.34]} /><meshStandardMaterial color="#252c2b" roughness={.8} /></mesh>
      {[-.24,.24].map((x) => <mesh key={x} position={[x,0,.2]}><circleGeometry args={[.18,12]} /><meshStandardMaterial color="#101716" /></mesh>)}
      <mesh position={[0,.24,.2]}><boxGeometry args={[.25,.08,.03]} /><meshBasicMaterial color="#cc4d3e" /></mesh>
    </group>
    {[0,.22,.44].map((height) => <mesh key={height} position={[7.1,2.28 + height,3.03]} rotation-z={height === .22 ? .18 : -.12}>
      <torusGeometry args={[.32 + height * .4,.025,6,16,Math.PI]} /><meshBasicMaterial color="#d9a94b" transparent opacity={.65 - height * .55} /></mesh>
    )}
    <group position={[-8.9,1.77,3.1]} rotation-y={Math.PI}>
      <mesh rotation-z={-.3} castShadow><boxGeometry args={[1.05,.78,.55]} /><meshStandardMaterial color="#40362f" roughness={.92} /></mesh>
      <mesh position={[.18,.48,0]} rotation-z={-.45}><torusGeometry args={[.28,.06,7,14,Math.PI]} /><meshStandardMaterial color="#312922" /></mesh>
    </group>
  </group>;
}

function TrainCar({ doorsOpen, name, variant }: { doorsOpen: boolean; name: string; variant: TurtleVariant }) {
  return <><color attach="background" args={[doorsOpen ? "#c6d0c9" : "#aab6b5"]} /><ambientLight intensity={doorsOpen ? 1.8 : 1.35} /><pointLight position={[0,5,0]} intensity={26} color="#f7f1d7" distance={25} /><mesh position={[0,-.12,0]} receiveShadow><boxGeometry args={[22,.24,8]} /><meshStandardMaterial color="#6c7472" /></mesh><mesh position={[0,3.2,-4]}><boxGeometry args={[22,6.4,.28]} /><meshStandardMaterial color="#d0d4cf" /></mesh><mesh position={[0,3.2,4]}><boxGeometry args={[22,6.4,.28]} /><meshStandardMaterial color="#d0d4cf" /></mesh>{[-8,-4,4,8].map((x) => <group key={x}><mesh position={[x,1,-3.2]}><boxGeometry args={[3,1.2,1.2]} /><meshStandardMaterial color="#d5963d" /></mesh><mesh position={[x,1,3.2]}><boxGeometry args={[3,1.2,1.2]} /><meshStandardMaterial color="#d5963d" /></mesh></group>)}<SubwayTurtlePassengers /><SubwayPassengerMess />{[-6,0,6].map((x) => <mesh key={x} position={[x,3,0]}><cylinderGeometry args={[.07,.07,6,10]} /><meshStandardMaterial color="#c4c8c2" metalness={.7} /></mesh>)}<TrainMotionCues doorsOpen={doorsOpen} /><InteriorWalker bounds={{minX:-9,maxX:9,minZ:-2.1,maxZ:2.1}} cameraOffset={[5.8,4.8,2.25]} colliders={[-6,0,6].map((x) => ({minX:x-.25,maxX:x+.25,minZ:-.3,maxZ:.3}))} name={name} start={[1.5,0]} variant={variant} /></>;
}

export function SubwayTrain3D({ direction, onExitAtStop, origin, turtleName, turtleVariant }: { direction: SubwayDirection; onExitAtStop: (district: TransitDistrict) => void; origin: TransitDistrict; turtleName: string; turtleVariant: TurtleVariant }) {
  const [activeDirection, setActiveDirection] = useState(direction);
  const step = activeDirection === "downtown" ? 1 : -1;
  const [stopIndex, setStopIndex] = useState(getOneLineStopIndex(origin));
  const [doorsOpen, setDoorsOpen] = useState(false);
  const [secondsRemaining, setSecondsRemaining] = useState(2);
  const stop = oneLineStops[stopIndex];
  const nextStop = oneLineStops[stopIndex + step];
  const atTerminus = !nextStop;
  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (doorsOpen) {
        if (atTerminus) setActiveDirection((current) => current === "downtown" ? "uptown" : "downtown");
        setDoorsOpen(false);
        setSecondsRemaining(2);
      } else {
        setStopIndex((current) => current + step);
        setDoorsOpen(true);
        const arrivingAtTerminus = !oneLineStops[stopIndex + step + step];
        setSecondsRemaining(arrivingAtTerminus ? TRAIN_TURNAROUND_TIME / 1000 : TRAIN_DOOR_TIME / 1000);
      }
    }, doorsOpen ? (atTerminus ? TRAIN_TURNAROUND_TIME : TRAIN_DOOR_TIME) : TRAIN_TRAVEL_TIME);
    return () => window.clearTimeout(timer);
  }, [atTerminus, doorsOpen, step, stopIndex]);
  useEffect(() => {
    const countdown = window.setInterval(() => setSecondsRemaining((current) => Math.max(0, current - 1)), 1000);
    return () => window.clearInterval(countdown);
  }, []);
  useEffect(() => {
    const exitWithEnter = (event: KeyboardEvent) => {
      if (event.key === "Enter" && !event.repeat && doorsOpen && stop.district) {
        event.preventDefault();
        onExitAtStop(stop.district);
      }
    };
    window.addEventListener("keydown", exitWithEnter, { passive: false });
    return () => window.removeEventListener("keydown", exitWithEnter);
  }, [doorsOpen, onExitAtStop, stop.district]);
  return <main className={`interior3d-stage is-train ${doorsOpen ? "is-stopped" : "is-moving"}`} data-testid="subway-train-3d"><Canvas camera={{fov:52,near:.1,far:80,position:[5.8,5.8,2.25]}} dpr={[1,1.5]} shadows="basic"><Suspense fallback={null}><TrainCar doorsOpen={doorsOpen} name={turtleName} variant={turtleVariant} /></Suspense></Canvas><header className="interior3d-title"><p>1 train · {activeDirection}</p><h1>{doorsOpen ? stop.name : nextStop?.name ?? stop.name}</h1><span>{doorsOpen ? atTerminus ? `YOU ARE AT ${stop.neighborhood} · reversing in ${secondsRemaining}s` : `YOU ARE AT ${stop.neighborhood} · doors close in ${secondsRemaining}s` : `ARRIVING AT ${nextStop?.neighborhood ?? stop.neighborhood} · ${secondsRemaining}s`}</span></header><section className="train-route-card"><header><b>1</b><span><small>{activeDirection} to {getDirectionTerminus(activeDirection).neighborhood}</small><strong>{doorsOpen ? (atTerminus ? "Turning around · stay aboard or exit" : "Doors open · exit for this stop") : "Train in motion"}</strong></span></header><ol>{oneLineStops.map((routeStop, index) => <li key={routeStop.id} className={`${index === stopIndex ? "is-current" : ""}${index === stopIndex + step ? " is-next" : ""}`}><i /><span>{routeStop.name}<small>{routeStop.district ? routeStop.neighborhood : `${routeStop.neighborhood} · coming soon`}</small></span></li>)}</ol></section>{doorsOpen ? <aside className="train-stop-banner" role="status"><div><small>{atTerminus ? "TURNAROUND AT" : "NOW AT"}</small><strong>{stop.name}</strong><span>{stop.neighborhood} · {atTerminus ? `reversing in ${secondsRemaining}s` : `doors close in ${secondsRemaining}s`} · press Enter to exit</span></div>{stop.district ? <button type="button" onClick={() => onExitAtStop(stop.district!)}>Exit train →</button> : <b>Coming soon · stay onboard</b>}</aside> : <aside className="train-next-banner" role="status">Next stop: <strong>{nextStop?.name}</strong></aside>}<InteriorStyles /></main>;
}

function InteriorStyles() {
  return <style jsx global>{`.interior3d-stage{position:relative;width:100vw;height:100vh;overflow:hidden;background:#b9c4c1}.interior3d-stage canvas{display:block}.interior3d-title{position:absolute;top:26px;left:30px;color:#17392b;text-shadow:0 2px rgba(255,255,255,.4);pointer-events:none}.is-platform .interior3d-title{color:#f2ead0;text-shadow:0 2px #10221c}.interior3d-title p{margin:0 0 2px;font:850 12px/1.2 system-ui;letter-spacing:.14em;text-transform:uppercase}.interior3d-title h1{margin:0;font:900 clamp(29px,4vw,46px)/1 system-ui;letter-spacing:-.045em}.interior3d-title span{display:block;margin-top:7px;font:700 12px/1 system-ui;opacity:.72}.interior3d-controls{position:absolute;left:30px;bottom:28px;padding:12px 15px;color:white;background:rgba(20,52,35,.86);border-radius:12px;font:700 12px/1 system-ui}.interior3d-prompt{position:absolute;left:50%;bottom:28px;transform:translateX(-50%);display:flex;align-items:center;gap:22px;min-width:320px;padding:13px 14px;color:white;background:rgba(20,52,35,.92);border-radius:14px}.interior3d-prompt div{display:grid;gap:3px;flex:1}.interior3d-prompt strong{font:800 14px/1 system-ui}.interior3d-prompt small{font:600 11px/1.2 system-ui;opacity:.75}.interior3d-prompt button,.interior3d-exit,.train3d-map-card button{padding:10px 13px;color:#17392b;background:#fff0a0;border:0;border-radius:9px;cursor:pointer;font:800 12px/1 system-ui}.interior3d-exit{position:absolute;top:30px;right:30px}.interior3d-sign,.interior3d-station{white-space:nowrap;padding:5px 8px;color:#fff0b4;background:#173c2e;border-radius:5px;font:900 10px/1 system-ui;letter-spacing:.08em}.interior3d-station{color:white;background:#1d2423;font-size:12px}.train3d-map-card{position:absolute;right:30px;bottom:28px;display:flex;align-items:center;gap:20px;padding:12px 13px 12px 15px;color:white;background:rgba(25,49,43,.9);border-radius:14px}.train3d-map-card div{display:flex;align-items:center;gap:10px}.train3d-map-card b{display:grid;place-items:center;width:30px;height:30px;background:#2d9b59;border-radius:50%;font:900 16px/1 system-ui}.train3d-map-card span{display:grid;gap:2px}.train3d-map-card small{opacity:.7;font:650 10px/1 system-ui}.train3d-map-card strong{font:800 13px/1 system-ui}`}</style>;
}

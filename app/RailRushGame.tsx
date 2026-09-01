"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import * as THREE from "three";
import type { TurtleVariant } from "@/lib/turtles";
import { TurtleBillboard } from "./world3d/TurtleBillboard";
import { useGameReward } from "./GameEconomy";

type RailRushGameProps = { onExit: () => void; turtleName: string; turtleVariant: TurtleVariant };
type RunStatus = "ready" | "running" | "over";
type ItemType = "barrier" | "coin" | "magnet" | "ramp" | "signal" | "train";
type RailItem = { id: number; lane: number; z: number; type: ItemType };
type RunState = { status: RunStatus; lane: number; targetLane: number; jump: number; jumpVelocity: number; rollTime: number; roofTime: number; speed: number; distance: number; score: number; coins: number; combo: number; magnet: number; items: RailItem[]; nextId: number; spawnDistance: number; message: string; messageTime: number };
type RunView = Pick<RunState, "status" | "lane" | "jump" | "rollTime" | "roofTime" | "speed" | "distance" | "score" | "coins" | "combo" | "magnet" | "message" | "items">;

const LANES = [-1, 0, 1] as const;
const LANE_WIDTH = 3.4;
const VIEW_DISTANCE = 105;
const START_SPEED = 25;
const MAX_SPEED = 85;

function createRun(status: RunStatus = "ready"): RunState {
  return { status, lane: 0, targetLane: 0, jump: 0, jumpVelocity: 0, rollTime: 0, roofTime: 0, speed: START_SPEED, distance: 0, score: 0, coins: 0, combo: 1, magnet: 0, items: [], nextId: 0, spawnDistance: 28, message: "", messageTime: 0 };
}

function viewOf(run: RunState): RunView {
  return { status: run.status, lane: run.lane, jump: run.jump, rollTime: run.rollTime, roofTime: run.roofTime, speed: run.speed, distance: run.distance, score: Math.floor(run.score), coins: run.coins, combo: run.combo, magnet: run.magnet, message: run.message, items: [...run.items] };
}

function spawnPattern(run: RunState) {
  const id = run.nextId++;
  const pattern = id % 12;
  const lane = LANES[(id * 7 + Math.floor(id / 2)) % 3];
  if (pattern === 0) {
    run.items.push({ id: id * 10, lane, z: VIEW_DISTANCE, type: "train" });
    const safeLane = lane === 0 ? 1 : 0;
    for (let step = 0; step < 4; step++) run.items.push({ id: id * 10 + step + 1, lane: safeLane, z: VIEW_DISTANCE + step * 7, type: "coin" });
  } else if (pattern === 1 || pattern === 7) {
    const blocked = pattern === 1 ? [-1, 1] : [-1, 0];
    blocked.forEach((blockedLane, index) => run.items.push({ id: id * 10 + index, lane: blockedLane, z: VIEW_DISTANCE, type: "train" }));
    const safeLane = pattern === 1 ? 0 : 1;
    for (let step = 0; step < 5; step++) run.items.push({ id: id * 10 + step + 2, lane: safeLane, z: VIEW_DISTANCE + step * 6, type: "coin" });
  } else if (pattern === 3 || pattern === 8) {
    run.items.push({ id: id * 10, lane, z: VIEW_DISTANCE, type: "barrier" });
    run.items.push({ id: id * 10 + 1, lane, z: VIEW_DISTANCE + 9, type: "coin" });
  } else if (pattern === 4 || pattern === 6) {
    run.items.push({ id: id * 10, lane, z: VIEW_DISTANCE, type: "signal" });
    run.items.push({ id: id * 10 + 1, lane, z: VIEW_DISTANCE + 8, type: "coin" });
  } else if (pattern === 5) {
    run.items.push({ id: id * 10, lane, z: VIEW_DISTANCE, type: "magnet" });
  } else if (pattern === 9) {
    run.items.push({ id: id * 10, lane, z: VIEW_DISTANCE, type: "ramp" });
    run.items.push({ id: id * 10 + 1, lane, z: VIEW_DISTANCE + 12, type: "train" });
    for (let step = 0; step < 4; step++) run.items.push({ id: id * 10 + step + 2, lane, z: VIEW_DISTANCE + 16 + step * 5, type: "coin" });
  } else {
    for (let step = 0; step < 6; step++) run.items.push({ id: id * 10 + step, lane: LANES[(LANES.indexOf(lane) + Math.floor(step / 2)) % 3], z: VIEW_DISTANCE + step * 5.5, type: "coin" });
  }
  run.spawnDistance = Math.max(10, 20 + (id % 4) * 2 - run.speed * .13);
}

function SubwayCar() {
  return <group position-y={1.7}><mesh castShadow><boxGeometry args={[2.75, 3.4, 6.8]} /><meshStandardMaterial color="#d84d45" metalness={.35} roughness={.4} /></mesh><mesh position={[0, 1.76, 0]}><boxGeometry args={[2.58, .18, 6.4]} /><meshStandardMaterial color="#263d40" metalness={.55} /></mesh><mesh position={[0, .45, 3.43]}><boxGeometry args={[2.82, .22, .12]} /><meshStandardMaterial color="#f0c84e" emissive="#8e6410" emissiveIntensity={.3} /></mesh>{[-.72, .72].map((x) => <mesh key={x} position={[x, .92, 3.45]}><boxGeometry args={[.85, .9, .08]} /><meshStandardMaterial color="#9cdce3" emissive="#244d55" emissiveIntensity={.55} /></mesh>)}{[-.78, .78].map((x) => <mesh key={x} position={[x, -.75, 3.5]}><sphereGeometry args={[.18, 14, 10]} /><meshStandardMaterial color="#ffe06c" emissive="#ffbd39" emissiveIntensity={2} /></mesh>)}{[-2.35, 2.35].map((z) => <group key={z} position-z={z}>{[-1.08, 1.08].map((x) => <mesh key={x} position={[x, -1.75, 0]} rotation-z={Math.PI / 2}><cylinderGeometry args={[.28, .28, .18, 14]} /><meshStandardMaterial color="#101a1b" /></mesh>)}</group>)}</group>;
}

function RailObject({ item }: { item: RailItem }) {
  const position: [number, number, number] = [item.lane * LANE_WIDTH, 0, 8 - item.z];
  if (item.type === "train") return <group position={position}><SubwayCar /></group>;
  if (item.type === "coin") return <mesh position={[position[0], 1.25, position[2]]} rotation-y={Math.PI / 2} castShadow><cylinderGeometry args={[.34, .34, .12, 24]} /><meshStandardMaterial color="#ffd94f" emissive="#b97900" emissiveIntensity={.7} metalness={.45} roughness={.25} /></mesh>;
  if (item.type === "barrier") return <group position={position}><mesh position-y={.75} castShadow><boxGeometry args={[2.5, .55, .3]} /><meshStandardMaterial color="#f4eee0" /></mesh>{[-.75, .75].map((x) => <mesh key={x} position={[x, .75, .17]}><boxGeometry args={[.38, .58, .04]} /><meshStandardMaterial color="#e04e43" /></mesh>)}{[-.9, .9].map((x) => <mesh key={x} position={[x, .34, 0]}><boxGeometry args={[.16, .7, .18]} /><meshStandardMaterial color="#19383c" /></mesh>)}</group>;
  if (item.type === "signal") return <group position={position}>{[-1.35, 1.35].map((x) => <mesh key={x} position={[x, 1.5, 0]}><boxGeometry args={[.16, 3, .18]} /><meshStandardMaterial color="#17383c" /></mesh>)}<mesh position-y={2.75} castShadow><boxGeometry args={[2.85, .32, .34]} /><meshStandardMaterial color="#edc64f" /></mesh></group>;
  if (item.type === "ramp") return <group position={position}>
    <mesh position={[0, 1.15, -1.7]} rotation-x={.55} castShadow><boxGeometry args={[2.45, .18, 4.8]} /><meshStandardMaterial color="#d4ad57" metalness={.45} roughness={.55} /></mesh>
    {[-.9, .9].map((x) => <mesh key={x} position={[x, 1.18, -1.7]} rotation-x={.55}><boxGeometry args={[.13, .18, 5]} /><meshStandardMaterial color="#243d3f" metalness={.65} /></mesh>)}
    {Array.from({ length: 7 }, (_, index) => <mesh key={index} position={[0, .25 + index * .32, .05 - index * .58]} rotation-x={.55}><boxGeometry args={[2, .11, .16]} /><meshStandardMaterial color="#f2d27a" /></mesh>)}
  </group>;
  return <group position={[position[0], 1.15, position[2]]}><mesh castShadow><icosahedronGeometry args={[.62, 1]} /><meshStandardMaterial color="#db5c70" emissive="#db5c70" emissiveIntensity={.65} roughness={.25} /></mesh><mesh scale={1.25}><torusGeometry args={[.62, .05, 8, 24]} /><meshBasicMaterial color="#fff5d7" /></mesh></group>;
}

function MovingTrack({ distance }: { distance: number }) {
  const sleepers = useRef<THREE.Group>(null);
  useFrame(() => { if (sleepers.current) sleepers.current.position.z = (distance % 5.5) - 5.5; });
  return <><mesh position={[0, -.35, -43]} receiveShadow><boxGeometry args={[13, .7, 115]} /><meshStandardMaterial color="#263f42" roughness={1} /></mesh>{[-5.1, -1.7, 1.7, 5.1].map((x) => <mesh key={x} position={[x, .04, -43]} receiveShadow><boxGeometry args={[.14, .13, 115]} /><meshStandardMaterial color="#d6d0b6" metalness={.8} roughness={.25} /></mesh>)}<group ref={sleepers}>{Array.from({ length: 23 }, (_, index) => <mesh key={index} position={[0, -.05, 12 - index * 5.5]} receiveShadow><boxGeometry args={[12, .14, .32]} /><meshStandardMaterial color="#142d30" roughness={.9} /></mesh>)}</group>{[-7.3, 7.3].map((x) => <mesh key={x} position={[x, 1.8, -43]}><boxGeometry args={[1.8, 3.6, 115]} /><meshStandardMaterial color="#72564b" roughness={.95} /></mesh>)}</>;
}

function CityBackdrop() {
  return <group position-z={-74}>{Array.from({ length: 15 }, (_, index) => { const x = (index - 7) * 5.4; const height = 8 + index % 4 * 3; return <group key={index} position={[x, height / 2 - .2, -Math.abs(index - 7) * .8]}><mesh><boxGeometry args={[4.5, height, 4]} /><meshStandardMaterial color={index % 2 ? "#153b43" : "#1d4c53"} roughness={.9} /></mesh>{Array.from({ length: Math.floor(height / 2) }, (_, floor) => <mesh key={floor} position={[index < 7 ? 2.26 : -2.26, floor * 2 - height / 2 + 1.3, .5]} rotation-y={Math.PI / 2}><planeGeometry args={[.35, .55]} /><meshBasicMaterial color="#f3ca61" /></mesh>)}</group>; })}</group>;
}

function Runner({ view, turtleName, turtleVariant }: { view: RunView; turtleName: string; turtleVariant: TurtleVariant }) {
  const player = useRef<THREE.Group>(null);
  useFrame((state, delta) => { if (!player.current) return; player.current.position.x = THREE.MathUtils.damp(player.current.position.x, view.lane * LANE_WIDTH, 13, delta); player.current.rotation.z = THREE.MathUtils.damp(player.current.rotation.z, -(view.lane * LANE_WIDTH - player.current.position.x) * .09, 8, delta); player.current.position.y = THREE.MathUtils.damp(player.current.position.y, view.jump * 3.25 + (view.roofTime > 0 ? 3.65 : 0), 9, delta); });
  return <group ref={player} position={[0, 0, 8]} scale-y={view.rollTime > 0 ? .58 : 1}><mesh position={[0, .17, 0]} castShadow><boxGeometry args={[1.65, .16, .62]} /><meshStandardMaterial color="#e65348" roughness={.5} /></mesh>{[-.55, .55].map((x) => <mesh key={x} position={[x, .05, 0]} rotation-z={Math.PI / 2}><cylinderGeometry args={[.14, .14, .18, 12]} /><meshStandardMaterial color="#10252a" /></mesh>)}<group position={[0, .28, 0]}><TurtleBillboard name={turtleName} scale={.67} showShadow={false} variant={turtleVariant} /></group></group>;
}

function RailRushWorld({ view, turtleName, turtleVariant }: { view: RunView; turtleName: string; turtleVariant: TurtleVariant }) {
  return <><color attach="background" args={["#de6a5d"]} /><fog attach="fog" args={["#de7962", 42, 112]} /><ambientLight intensity={1.25} /><hemisphereLight args={["#ffbe7a", "#173a3f", 1.7]} /><directionalLight castShadow intensity={3.2} position={[-8, 14, 10]} shadow-mapSize={[1024, 1024]} /><CityBackdrop /><MovingTrack distance={view.distance} />{view.items.map((item) => <RailObject key={item.id} item={item} />)}<Runner view={view} turtleName={turtleName} turtleVariant={turtleVariant} /></>;
}

export function RailRushGame({ onExit, turtleName, turtleVariant }: RailRushGameProps) {
  const runRef = useRef(createRun()); const pointerRef = useRef<{ x: number; y: number } | null>(null);
  const [view, setView] = useState<RunView>(() => viewOf(createRun())); const [best, setBest] = useState(() => typeof window === "undefined" ? 0 : Number(localStorage.getItem("turtle-city-rail-rush-best") ?? 0));
  useGameReward("rail-rush", view.status === "over" && view.coins >= 10);
  const start = useCallback(() => { const run = createRun("running"); runRef.current = run; setView(viewOf(run)); }, []);
  useEffect(() => { let frame = 0; let previous = performance.now(); let lastView = 0;
    function moveLane(direction: number) { const run = runRef.current; if (run.status === "running") run.targetLane = Math.max(-1, Math.min(1, run.targetLane + direction)); }
    function jump() { const run = runRef.current; if (run.status === "running" && run.jump === 0 && run.rollTime <= 0) run.jumpVelocity = 2.55; }
    function roll() { const run = runRef.current; if (run.status === "running" && run.jump < .22) run.rollTime = .72; }
    function keyDown(event: KeyboardEvent) { const key = event.key.toLowerCase(); if (["arrowleft", "arrowright", "arrowup", "arrowdown", "a", "d", "w", "s"].includes(key) || event.code === "Space") event.preventDefault(); if (!event.repeat && (key === "arrowleft" || key === "a")) moveLane(-1); if (!event.repeat && (key === "arrowright" || key === "d")) moveLane(1); if (!event.repeat && (key === "arrowup" || key === "w" || event.code === "Space")) jump(); if (!event.repeat && (key === "arrowdown" || key === "s")) roll(); }
    function update(time: number) { const dt = Math.min(.04, (time - previous) / 1000); previous = time; const run = runRef.current;
      if (run.status === "running") { run.speed = Math.min(MAX_SPEED, START_SPEED + run.distance / 180); run.distance += run.speed * dt; run.score += run.speed * dt * run.combo; run.spawnDistance -= run.speed * dt; if (run.spawnDistance <= 0) spawnPattern(run); run.lane += (run.targetLane - run.lane) * Math.min(1, dt * 13); if (run.jumpVelocity !== 0 || run.jump > 0) { run.jumpVelocity -= 5.5 * dt; run.jump = Math.max(0, run.jump + run.jumpVelocity * dt); if (run.jump === 0) run.jumpVelocity = 0; } run.rollTime = Math.max(0, run.rollTime - dt); run.roofTime = Math.max(0, run.roofTime - dt); run.magnet = Math.max(0, run.magnet - dt); run.messageTime = Math.max(0, run.messageTime - dt); if (run.messageTime === 0) run.message = "";
        const kept: RailItem[] = []; for (const item of run.items) { item.z -= run.speed * dt; const laneHit = Math.abs(item.lane - run.lane) < .42; const magnetHit = item.type === "coin" && run.magnet > 0 && Math.abs(item.lane - run.lane) < 1.6 && item.z < 16; if ((laneHit || magnetHit) && item.z < 5 && item.z > -4) { if (item.type === "coin") { run.coins++; run.combo = Math.min(8, run.combo + 1); run.score += 75 * run.combo; continue; } if (item.type === "magnet") { run.magnet = 8; run.message = "Coin magnet!"; run.messageTime = 1.4; continue; } if (item.type === "ramp") { run.roofTime = 4.2; run.message = "On the train roof!"; run.messageTime = 1.4; run.score += 250 * run.combo; continue; } const avoided = item.type === "barrier" ? run.jump > .42 || run.roofTime > 0 : item.type === "signal" ? run.rollTime > 0 || run.roofTime > 0 : item.type === "train" ? run.roofTime > 0 : false; if (!avoided) { run.status = "over"; run.message = item.type === "train" ? "Mind the train!" : item.type === "barrier" ? "Jump the barrier!" : "Roll under signals!"; const score = Math.floor(run.score); setBest((old) => { const next = Math.max(old, score); localStorage.setItem("turtle-city-rail-rush-best", String(next)); return next; }); } else { run.score += 140 * run.combo; run.combo = Math.min(8, run.combo + 1); continue; } } if (item.z > -8) kept.push(item); } run.items = kept; }
      if (time - lastView > 45 || run.status === "over") { setView(viewOf(run)); lastView = time; } frame = requestAnimationFrame(update); }
    window.addEventListener("keydown", keyDown, { passive: false }); frame = requestAnimationFrame(update); return () => { cancelAnimationFrame(frame); window.removeEventListener("keydown", keyDown); };
  }, []);
  function pointerDown(event: React.PointerEvent) { pointerRef.current = { x: event.clientX, y: event.clientY }; }
  function pointerUp(event: React.PointerEvent) { const startPoint = pointerRef.current; pointerRef.current = null; if (!startPoint) return; const dx = event.clientX - startPoint.x; const dy = event.clientY - startPoint.y; const run = runRef.current; if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 30) run.targetLane = Math.max(-1, Math.min(1, run.targetLane + Math.sign(dx))); else if (dy < -30 && run.jump === 0) run.jumpVelocity = 2.55; else if (dy > 30 && run.jump < .22) run.rollTime = .72; }
  return <main className="rail-rush-stage" data-testid="rail-rush-game" onPointerDown={pointerDown} onPointerUp={pointerUp}>
    <Canvas camera={{ fov: 56, near: .1, far: 145, position: [0, 5.7, 15] }} dpr={[1, 1.5]} shadows="basic" gl={{ antialias: true, powerPreference: "high-performance" }} aria-label="3D three-lane downtown rail runner"><Suspense fallback={null}><RailRushWorld view={view} turtleName={turtleName} turtleVariant={turtleVariant} /></Suspense></Canvas>
    <header className="rail-rush-brand"><small>FiDi Track Crew</small><strong>Rail Rush 3D</strong></header><button type="button" className="rail-rush-exit" onClick={onExit}>← FiDi</button>
    <section className="rail-rush-hud"><div><small>Score</small><strong>{view.score.toLocaleString()}</strong></div><div><small>Coins</small><strong>● {view.coins}</strong></div><div><small>Combo</small><strong>×{view.combo}</strong></div><div><small>Speed</small><strong>{Math.round(view.speed * 2.2)}</strong></div></section>
    {(view.roofTime > 0 || view.magnet > 0) ? <aside className="rail-rush-powers">{view.roofTime > 0 ? <span>Train roof {Math.ceil(view.roofTime)}s</span> : null}{view.magnet > 0 ? <span>Magnet {Math.ceil(view.magnet)}s</span> : null}</aside> : null}{view.message ? <strong className="rail-rush-message">{view.message}</strong> : null}
    {view.status === "ready" ? <section className="rail-rush-card"><p>New FiDi game</p><h1>Outrun the evening express</h1><span>{turtleName}, switch between three tracks, jump barriers, roll under signals, dodge trains, and build a coin combo as the city gets faster.</span><div className="rail-rush-controls"><b>← →</b><small>Switch tracks</small><b>↑</b><small>Jump</small><b>↓</b><small>Roll</small></div><small>Keyboard: arrows or WASD · Touch: swipe</small><button type="button" onClick={start}>Start running</button></section> : null}
    {view.status === "over" ? <section className="rail-rush-card is-over"><p>Run over</p><h1>{view.score.toLocaleString()} points</h1><span>{view.message} You collected {view.coins} coins and ran {Math.floor(view.distance)} meters.</span><strong>Best {best.toLocaleString()}</strong><div><button type="button" onClick={start}>Run again</button><button type="button" onClick={onExit}>Return to FiDi</button></div></section> : null}
    {view.status === "running" ? <nav className="rail-rush-touch" aria-label="Runner controls"><button type="button" onClick={() => { runRef.current.targetLane = Math.max(-1, runRef.current.targetLane - 1); }}>←</button><button type="button" onClick={() => { if (runRef.current.jump === 0) runRef.current.jumpVelocity = 2.55; }}>↑</button><button type="button" onClick={() => { if (runRef.current.jump < .22) runRef.current.rollTime = .72; }}>↓</button><button type="button" onClick={() => { runRef.current.targetLane = Math.min(1, runRef.current.targetLane + 1); }}>→</button></nav> : null}
  </main>;
}

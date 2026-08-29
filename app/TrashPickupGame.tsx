"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { Suspense, useEffect, useRef, useState } from "react";
import type { Group } from "three";
import type { TurtleVariant } from "@/lib/turtles";
import { TurtleBillboard } from "./world3d/TurtleBillboard";

type TrashPickupGameProps = { onExit: () => void; turtleName: string; turtleVariant: TurtleVariant };
type CleanupStatus = "ready" | "playing" | "finished";
type LitterType = "bag" | "cup" | "paper";
type LitterItem = { id: number; type: LitterType; x: number; y: number };
type CleanupState = { collected: Set<number>; nearbyId: number | null; playerX: number; playerY: number; status: CleanupStatus; timeLeft: number };
type CleanupView = { collected: number[]; nearbyId: number | null; playerX: number; playerY: number; status: CleanupStatus; timeLeft: number };

const SHIFT_LENGTH = 60;
const litter: LitterItem[] = [
  { id: 0, type: "cup", x: 17, y: 31 }, { id: 1, type: "paper", x: 32, y: 25 }, { id: 2, type: "bag", x: 49, y: 34 },
  { id: 3, type: "cup", x: 68, y: 24 }, { id: 4, type: "paper", x: 84, y: 37 }, { id: 5, type: "bag", x: 24, y: 55 },
  { id: 6, type: "paper", x: 41, y: 67 }, { id: 7, type: "cup", x: 59, y: 53 }, { id: 8, type: "bag", x: 76, y: 65 },
  { id: 9, type: "paper", x: 89, y: 57 }, { id: 10, type: "cup", x: 13, y: 77 }, { id: 11, type: "bag", x: 55, y: 82 },
];

function createCleanupState(status: CleanupStatus = "ready"): CleanupState { return { collected: new Set(), nearbyId: null, playerX: 50, playerY: 78, status, timeLeft: SHIFT_LENGTH }; }
function createCleanupView(state: CleanupState): CleanupView { return { collected: [...state.collected], nearbyId: state.nearbyId, playerX: state.playerX, playerY: state.playerY, status: state.status, timeLeft: state.timeLeft }; }
function clamp(value: number, minimum: number, maximum: number) { return Math.min(Math.max(value, minimum), maximum); }
function formatTime(seconds: number) { return `0:${String(Math.max(0, Math.ceil(seconds))).padStart(2, "0")}`; }
function worldPosition(x: number, y: number): [number, number, number] { return [(x - 50) * 0.18, 0, (y - 53) * 0.13]; }

function LitterModel({ item, nearby, onCollect }: { item: LitterItem; nearby: boolean; onCollect: () => void }) {
  return <group position={worldPosition(item.x, item.y)} onClick={(event) => { event.stopPropagation(); if (nearby) onCollect(); }}>
    {nearby ? <mesh position={[0, 0.035, 0]} rotation-x={-Math.PI / 2}><ringGeometry args={[0.42, 0.58, 24]} /><meshBasicMaterial color="#e8c659" /></mesh> : null}
    {item.type === "cup" ? <group rotation-z={item.id * 0.37}><mesh position={[0, 0.18, 0]}><cylinderGeometry args={[0.14, 0.11, 0.36, 12]} /><meshStandardMaterial color="#f1e7cf" /></mesh><mesh position={[0.09, 0.42, 0]} rotation-z={-0.4}><cylinderGeometry args={[0.018, 0.018, 0.35, 6]} /><meshStandardMaterial color="#d75d4f" /></mesh></group> : item.type === "bag" ? <mesh position={[0, 0.22, 0]} rotation-y={item.id}><sphereGeometry args={[0.31, 10, 7]} /><meshStandardMaterial color="#263b3c" roughness={0.95} /></mesh> : <mesh position={[0, 0.045, 0]} rotation={[-Math.PI / 2, 0, item.id * 0.4]}><planeGeometry args={[0.55, 0.4]} /><meshStandardMaterial color="#f2e6c7" side={2} /></mesh>}
  </group>;
}

function CleanupBlock() {
  return <>
    <mesh position={[0, -0.24, 0]} receiveShadow><boxGeometry args={[19, 0.45, 10]} /><meshStandardMaterial color="#bfc2ba" /></mesh>
    <mesh position={[0, -0.12, -3.8]} receiveShadow><boxGeometry args={[19, 0.22, 2.4]} /><meshStandardMaterial color="#303d40" /></mesh>
    <mesh position={[0, -0.09, 4.45]} receiveShadow><boxGeometry args={[19, 0.24, 1.1]} /><meshStandardMaterial color="#6c8b70" /></mesh>
    {[-7.5, -2.5, 2.5, 7.5].map((x, index) => <group key={x} position={[x, 0, -5.8]}><mesh position={[0, 3 + index % 2, 0]} castShadow><boxGeometry args={[4.5, 6 + (index % 2) * 2, 2]} /><meshStandardMaterial color={index % 2 ? "#8d5b52" : "#527a7c"} roughness={0.9} /></mesh>{[-1.2, 0, 1.2].map((wx) => <mesh key={wx} position={[wx, 3.3, 1.02]}><planeGeometry args={[0.5, 0.8]} /><meshBasicMaterial color="#e8c659" /></mesh>)}</group>)}
    {[-8, 8].map((x) => <group key={x} position={[x, 0, 2.9]}><mesh position={[0, 1.15, 0]}><cylinderGeometry args={[0.06, 0.07, 2.3, 8]} /><meshStandardMaterial color="#173633" /></mesh><mesh position={[0, 2.42, 0]}><sphereGeometry args={[0.22, 12, 8]} /><meshStandardMaterial emissive="#f2d98c" emissiveIntensity={0.45} color="#f2d98c" /></mesh></group>)}
    <group position={[8.2, 0, 3.4]}><mesh position={[0, 0.55, 0]}><cylinderGeometry args={[0.48, 0.54, 1.1, 16]} /><meshStandardMaterial color="#315b4e" /></mesh><mesh position={[0, 1.13, 0]}><cylinderGeometry args={[0.54, 0.54, 0.1, 16]} /><meshStandardMaterial color="#173633" /></mesh></group>
  </>;
}

function CleanupWorld({ view, turtleName, turtleVariant, onCollect }: { view: CleanupView; turtleName: string; turtleVariant: TurtleVariant; onCollect: () => void }) {
  const player = useRef<Group>(null); const target = worldPosition(view.playerX, view.playerY); const collected = new Set(view.collected);
  useFrame((_, delta) => { if (!player.current) return; player.current.position.x += (target[0] - player.current.position.x) * Math.min(1, delta * 12); player.current.position.z += (target[2] - player.current.position.z) * Math.min(1, delta * 12); });
  return <><color attach="background" args={["#557d80"]} /><fog attach="fog" args={["#557d80", 22, 40]} /><ambientLight intensity={1.15} /><directionalLight castShadow intensity={1.8} position={[-8, 15, 9]} shadow-mapSize={[1024, 1024]} /><pointLight intensity={8} position={[-8, 4, 3]} color="#f1d898" distance={9} /><pointLight intensity={8} position={[8, 4, 3]} color="#f1d898" distance={9} /><CleanupBlock />{litter.map((item) => collected.has(item.id) ? null : <LitterModel key={item.id} item={item} nearby={view.nearbyId === item.id} onCollect={onCollect} />)}<group ref={player} position={target}><group position={[0, 0.08, 0]}><TurtleBillboard name={turtleName} scale={0.62} variant={turtleVariant} /></group><group position={[0.7, 0.5, 0]}><mesh><boxGeometry args={[0.55, 0.7, 0.55]} /><meshStandardMaterial color="#49705b" /></mesh><mesh position={[0, 0.65, 0]} rotation-z={0.25}><torusGeometry args={[0.28, 0.035, 8, 18]} /><meshStandardMaterial color="#173633" /></mesh></group></group></>;
}

export function TrashPickupGame({ onExit, turtleName, turtleVariant }: TrashPickupGameProps) {
  const stateRef = useRef<CleanupState>(createCleanupState()); const [view, setView] = useState<CleanupView>(() => createCleanupView(createCleanupState()));
  function startCleanup() { const nextState = createCleanupState("playing"); stateRef.current = nextState; setView(createCleanupView(nextState)); }
  function collectNearby() { const state = stateRef.current; if (state.status !== "playing" || state.nearbyId === null) return; state.collected.add(state.nearbyId); state.nearbyId = null; if (state.collected.size === litter.length) state.status = "finished"; setView(createCleanupView(state)); }
  useEffect(() => { if (view.status !== "playing") return; const pressed = new Set<string>(); let previousTime = performance.now(); let lastViewUpdate = 0; let animationFrame = 0;
    function handleKeyDown(event: KeyboardEvent) { const key = event.key.toLowerCase(); if (["arrowup", "arrowdown", "arrowleft", "arrowright", "w", "a", "s", "d"].includes(key)) { event.preventDefault(); pressed.add(key); } else if (event.code === "Space" && !event.repeat) { event.preventDefault(); collectNearby(); } }
    function handleKeyUp(event: KeyboardEvent) { pressed.delete(event.key.toLowerCase()); } function clearInput() { pressed.clear(); }
    function update(time: number) { const state = stateRef.current; const elapsed = Math.min((time - previousTime) / 1000, 0.05); previousTime = time; state.timeLeft = Math.max(0, state.timeLeft - elapsed); const horizontal = Number(pressed.has("arrowright") || pressed.has("d")) - Number(pressed.has("arrowleft") || pressed.has("a")); const vertical = Number(pressed.has("arrowdown") || pressed.has("s")) - Number(pressed.has("arrowup") || pressed.has("w")); const magnitude = Math.hypot(horizontal, vertical) || 1; state.playerX = clamp(state.playerX + horizontal / magnitude * 35 * elapsed, 6, 94); state.playerY = clamp(state.playerY + vertical / magnitude * 48 * elapsed, 20, 86); const nearby = litter.filter((item) => !state.collected.has(item.id)).map((item) => ({ distance: Math.hypot(item.x - state.playerX, (item.y - state.playerY) * 1.4), item })).filter(({ distance }) => distance < 7).sort((a, b) => a.distance - b.distance)[0]?.item; state.nearbyId = nearby?.id ?? null; if (state.timeLeft <= 0) { state.status = "finished"; setView(createCleanupView(state)); return; } if (time - lastViewUpdate >= 32) { setView(createCleanupView(state)); lastViewUpdate = time; } animationFrame = requestAnimationFrame(update); }
    window.addEventListener("keydown", handleKeyDown, { passive: false }); window.addEventListener("keyup", handleKeyUp); window.addEventListener("blur", clearInput); animationFrame = requestAnimationFrame(update); return () => { cancelAnimationFrame(animationFrame); window.removeEventListener("keydown", handleKeyDown); window.removeEventListener("keyup", handleKeyUp); window.removeEventListener("blur", clearInput); };
  }, [view.status]);
  const success = view.collected.length >= 10;
  return <main className="trash-game-stage" data-testid="trash-pickup-game"><div className="trash-game-canvas" aria-label="3D Midtown cleanup block"><Canvas orthographic camera={{ position: [0, 13, 15], zoom: 54 }} dpr={[1, 1.5]} shadows="basic" gl={{ antialias: true, powerPreference: "high-performance" }}><Suspense fallback={null}><CleanupWorld view={view} turtleName={turtleName} turtleVariant={turtleVariant} onCollect={collectNearby} /></Suspense></Canvas></div><header className="trash-game-title"><p>Midtown Clean Team</p><h1>Crossroads Cleanup</h1></header><button type="button" className="midtown-game-exit" onClick={onExit}><span aria-hidden="true">&larr;</span>Midtown</button><section className="trash-game-hud" aria-label="Cleanup status"><div><small>Time</small><strong>{formatTime(view.timeLeft)}</strong></div><div><small>Collected</small><strong>{view.collected.length} / {litter.length}</strong></div></section>{view.nearbyId !== null && view.status === "playing" ? <aside className="trash-pickup-prompt" aria-live="polite"><div><strong>Litter nearby</strong><small>Press Space to add it to the cart.</small></div><button type="button" onClick={collectNearby}>Pick up</button></aside> : null}{view.status === "ready" ? <section className="midtown-game-overlay"><p>One block, one clean sweep</p><h2>Clean the crossroads</h2><span>Move with WASD or the arrow keys. Press Space beside litter. Clear at least 10 pieces before the shift ends.</span><button type="button" onClick={startCleanup}>Start shift</button></section> : null}{view.status === "finished" ? <section className="midtown-game-overlay is-finished"><p>{success ? "Block cleared" : "Shift over"}</p><h2>{view.collected.length} pieces collected</h2><span>{success ? "Midtown is looking sharp again." : "The evening crowd left a few behind."}</span><div><button type="button" onClick={startCleanup}>Clean again</button><button type="button" onClick={onExit}>Return to Midtown</button></div></section> : null}</main>;
}

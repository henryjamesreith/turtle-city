"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { Suspense, useEffect, useRef, useState } from "react";
import type { Group } from "three";
import type { TurtleVariant } from "@/lib/turtles";
import { TurtleBillboard } from "./world3d/TurtleBillboard";

type FallingItemsGameProps = { onExit: () => void; turtleName: string; turtleVariant: TurtleVariant };
type ChallengeStatus = "ready" | "countdown" | "playing" | "finished";
type FallingItemType = "coffee" | "brick" | "paint" | "sign";
type FallingItem = { id: number; type: FallingItemType; lane: number; y: number };
type ChallengeState = { dodged: number; elapsed: number; items: FallingItem[]; lives: number; message: string; nextItemId: number; playerLane: number; spawnCooldown: number; status: ChallengeStatus };
type ChallengeView = Pick<ChallengeState, "dodged" | "elapsed" | "items" | "lives" | "message" | "playerLane" | "status">;

const CHALLENGE_LENGTH = 45;
const laneX = [-4.2, 0, 4.2];
const itemTypes: FallingItemType[] = ["brick", "coffee", "paint", "sign"];

function createChallengeState(status: ChallengeStatus = "ready"): ChallengeState { return { dodged: 0, elapsed: 0, items: [], lives: 3, message: "", nextItemId: 0, playerLane: 1, spawnCooldown: 0.7, status }; }
function createChallengeView(state: ChallengeState): ChallengeView { return { dodged: state.dodged, elapsed: state.elapsed, items: [...state.items], lives: state.lives, message: state.message, playerLane: state.playerLane, status: state.status }; }
function formatTime(seconds: number) { return `0:${String(Math.max(0, Math.ceil(seconds))).padStart(2, "0")}`; }

function HazardModel({ item }: { item: FallingItem }) {
  const y = 0.35 + (100 - item.y) * 0.105;
  return <group position={[laneX[item.lane], y, 0]} rotation={[item.id * 0.17, item.id * 0.31, item.id * 0.23]} scale={item.type === "sign" ? 1.1 : 0.85}>
    {item.type === "brick" ? <mesh castShadow><boxGeometry args={[1.15, 0.65, 0.7]} /><meshStandardMaterial color="#df654f" roughness={0.82} /></mesh> : null}
    {item.type === "coffee" ? <group><mesh castShadow><cylinderGeometry args={[0.42, 0.33, 1.05, 14]} /><meshStandardMaterial color="#f4e8ce" /></mesh><mesh position={[0, 0.2, 0.39]} rotation-x={Math.PI / 2}><torusGeometry args={[0.27, 0.07, 8, 16]} /><meshStandardMaterial color="#f4e8ce" /></mesh><mesh position={[0, 0.53, 0]}><cylinderGeometry args={[0.46, 0.46, 0.08, 14]} /><meshStandardMaterial color="#263b3c" /></mesh></group> : null}
    {item.type === "paint" ? <group><mesh castShadow><cylinderGeometry args={[0.48, 0.48, 0.88, 14]} /><meshStandardMaterial color="#e9c64f" /></mesh><mesh position={[0, 0.25, 0]}><torusGeometry args={[0.58, 0.055, 8, 20]} /><meshStandardMaterial color="#e8eee8" /></mesh></group> : null}
    {item.type === "sign" ? <group><mesh castShadow><boxGeometry args={[1.5, 0.82, 0.16]} /><meshStandardMaterial color="#ef765f" /></mesh><mesh position={[0, -0.75, 0]}><cylinderGeometry args={[0.07, 0.07, 0.9, 8]} /><meshStandardMaterial color="#e8eee8" /></mesh></group> : null}
  </group>;
}

function ConstructionWorld({ view, turtleName, turtleVariant }: { view: ChallengeView; turtleName: string; turtleVariant: TurtleVariant }) {
  const player = useRef<Group>(null); const targetX = laneX[view.playerLane];
  useFrame((_, delta) => { if (player.current) player.current.position.x += (targetX - player.current.position.x) * Math.min(1, delta * 13); });
  return <><color attach="background" args={["#182947"]} /><fog attach="fog" args={["#182947", 18, 38]} /><ambientLight intensity={1.25} /><directionalLight castShadow intensity={2.1} position={[-7, 14, 9]} shadow-mapSize={[1024, 1024]} /><pointLight intensity={12} color="#f4cb55" position={[0, 7, 4]} distance={18} />
    <mesh position={[0, -0.28, 0]} receiveShadow><boxGeometry args={[15, 0.5, 8]} /><meshStandardMaterial color="#7f807b" roughness={0.95} /></mesh>
    {laneX.map((x) => <group key={x} position={[x, 0, 0]}><mesh position={[0, -0.01, 0.2]} receiveShadow><boxGeometry args={[3.65, 0.12, 6.8]} /><meshStandardMaterial color="#9d998e" /></mesh><mesh position={[0, 0.06, -2.6]}><boxGeometry args={[2.25, 0.04, 0.12]} /><meshStandardMaterial emissive="#f4d15d" emissiveIntensity={0.6} color="#f4d15d" /></mesh></group>)}
    {[-7.1, 7.1].map((x) => <group key={x} position={[x, 0, -2]}><mesh position={[0, 3.4, 0]}><boxGeometry args={[0.22, 6.8, 0.22]} /><meshStandardMaterial color="#d7a930" /></mesh>{[0.8, 2.3, 3.8, 5.3, 6.4].map((y) => <mesh key={y} position={[0, y, 0]}><boxGeometry args={[1, 0.16, 0.16]} /><meshStandardMaterial color="#d7a930" /></mesh>)}</group>)}
    <group position={[0, 5.7, -4.2]}>{[-5.2, 0, 5.2].map((x, index) => <group key={x} position={[x, 0, 0]}><mesh><boxGeometry args={[4.6, 9 + index * 1.2, 2]} /><meshStandardMaterial color={index === 1 ? "#394c68" : "#30425e"} roughness={0.92} /></mesh>{[-1.25, 0, 1.25].map((wx) => [1.4, 3.1, 4.8].map((wy) => <mesh key={`${wx}-${wy}`} position={[wx, wy - 4.2, 1.01]}><planeGeometry args={[0.48, 0.7]} /><meshBasicMaterial color="#e4bc54" /></mesh>))}</group>)}</group>
    {view.items.map((item) => <group key={item.id}><mesh position={[laneX[item.lane], 0.04, 0]} rotation-x={-Math.PI / 2}><ringGeometry args={[0.72, 1.05, 32]} /><meshBasicMaterial transparent opacity={Math.max(0.15, item.y / 100) * 0.85} color="#ff6658" /></mesh><HazardModel item={item} /></group>)}
    <group ref={player} position={[targetX, 0.08, 1]}><TurtleBillboard name={turtleName} scale={0.78} variant={turtleVariant} /><group position={[0, 1.65, 0.05]}><mesh><cylinderGeometry args={[0.62, 0.56, 0.24, 18]} /><meshStandardMaterial color="#f3c742" /></mesh><mesh position={[0.32, -0.08, 0]}><boxGeometry args={[0.65, 0.1, 0.62]} /><meshStandardMaterial color="#f3c742" /></mesh></group></group>
  </>;
}

export function FallingItemsGame({ onExit, turtleName, turtleVariant }: FallingItemsGameProps) {
  const stateRef = useRef<ChallengeState>(createChallengeState()); const [view, setView] = useState<ChallengeView>(() => createChallengeView(createChallengeState())); const [countdown, setCountdown] = useState(3);
  function startChallenge() { const nextState = createChallengeState("countdown"); stateRef.current = nextState; setView(createChallengeView(nextState)); setCountdown(3); }
  function movePlayer(direction: -1 | 1) { const state = stateRef.current; if (state.status !== "playing") return; state.playerLane = Math.min(2, Math.max(0, state.playerLane + direction)); setView(createChallengeView(state)); }
  useEffect(() => { if (view.status !== "countdown") return; const timer = window.setInterval(() => setCountdown((value) => { if (value > 1) return value - 1; window.clearInterval(timer); stateRef.current.status = "playing"; setView(createChallengeView(stateRef.current)); return 0; }), 700); return () => window.clearInterval(timer); }, [view.status]);
  useEffect(() => {
    if (view.status !== "playing") return; let previousTime = performance.now(); let lastViewUpdate = 0; let animationFrame = 0;
    function handleKeyDown(event: KeyboardEvent) { if (event.repeat) return; const key = event.key.toLowerCase(); if (key === "arrowleft" || key === "a") { event.preventDefault(); movePlayer(-1); } if (key === "arrowright" || key === "d") { event.preventDefault(); movePlayer(1); } }
    function update(time: number) { const state = stateRef.current; const delta = Math.min((time - previousTime) / 1000, 0.05); previousTime = time; state.elapsed += delta; state.spawnCooldown -= delta; state.message = "";
      if (state.spawnCooldown <= 0) { const id = state.nextItemId; const previousLane = state.items.at(-1)?.lane ?? -1; const proposed = (id * 2 + Math.floor(id / 3)) % 3; const lane = proposed === previousLane ? (proposed + 1) % 3 : proposed; state.items.push({ id, type: itemTypes[id % itemTypes.length], lane, y: 0 }); state.nextItemId += 1; state.spawnCooldown = Math.max(0.68, 1.15 - state.elapsed * 0.007); }
      const remainingItems: FallingItem[] = []; for (const item of state.items) { item.y += (31 + state.elapsed * 0.18) * delta; if (item.y >= 88 && item.y <= 104 && item.lane === state.playerLane) { state.lives -= 1; state.message = "BONK! Switch lanes!"; } else if (item.y > 104) state.dodged += 1; else remainingItems.push(item); } state.items = remainingItems;
      if (state.lives <= 0 || state.elapsed >= CHALLENGE_LENGTH) { state.status = "finished"; setView(createChallengeView(state)); return; } if (time - lastViewUpdate >= 34) { setView(createChallengeView(state)); lastViewUpdate = time; } animationFrame = requestAnimationFrame(update); }
    window.addEventListener("keydown", handleKeyDown, { passive: false }); animationFrame = requestAnimationFrame(update); return () => { cancelAnimationFrame(animationFrame); window.removeEventListener("keydown", handleKeyDown); };
  }, [view.status]);
  const success = view.elapsed >= CHALLENGE_LENGTH && view.lives > 0;
  return <main className="falling-game-stage falling-game-3d" data-testid="falling-items-game"><div className="falling-game-canvas" aria-label="Three lane 3D construction dodge course"><Canvas camera={{ position: [0, 8.5, 15], fov: 42 }} dpr={[1, 1.5]} shadows="basic" gl={{ antialias: true, powerPreference: "high-performance" }}><Suspense fallback={null}><ConstructionWorld view={view} turtleName={turtleName} turtleVariant={turtleVariant} /></Suspense></Canvas></div><header className="falling-game-title"><p>Empire Shell Building</p><h1>Hard Hat Hustle</h1></header><button type="button" className="midtown-game-exit" onClick={onExit}><span aria-hidden="true">&larr;</span> Midtown</button>
    <section className="falling-game-hud" aria-label="Challenge status"><div><small>Survive</small><strong>{formatTime(CHALLENGE_LENGTH - view.elapsed)}</strong></div><div><small>Dodged</small><strong>{view.dodged}</strong></div><div><small>Hard hats</small><strong className="falling-lives" aria-label={`${view.lives} lives remaining`}>{[0, 1, 2].map((life) => <i key={life} className={life < view.lives ? "is-full" : ""}>●</i>)}</strong></div></section>
    {view.status === "playing" ? <><aside className="falling-objective"><b>DODGE THE RED SHADOWS</b><span>Move to a clear lane before they land.</span></aside><div className="falling-touch-controls"><button type="button" aria-label="Move left" onClick={() => movePlayer(-1)}>←</button><span>A / D</span><button type="button" aria-label="Move right" onClick={() => movePlayer(1)}>→</button></div></> : null}{view.message ? <strong className="falling-game-message" role="status">{view.message}</strong> : null}
    {view.status === "ready" ? <section className="midtown-game-overlay falling-intro"><p>45-second rooftop challenge</p><h2>See a red shadow?<br />Switch lanes.</h2><div className="falling-howto"><span><b>1</b><em>Watch</em><small>Debris drops toward the red landing circles.</small></span><span><b>2</b><em>Move</em><small>Tap ← → or press A / D to switch lanes.</small></span><span><b>3</b><em>Survive</em><small>Keep one hard hat for 45 seconds.</small></span></div><button type="button" onClick={startChallenge}>Start hustling <span aria-hidden="true">→</span></button></section> : null}
    {view.status === "countdown" ? <div className="falling-countdown" aria-live="assertive"><span>GET READY</span><strong>{countdown}</strong><small>Find a clear lane!</small></div> : null}
    {view.status === "finished" ? <section className="midtown-game-overlay is-finished falling-results"><p>{success ? "SHIFT COMPLETE" : "HARD-HAT BREAK"}</p><h2>{success ? "You made it!" : "Construction wins this round"}</h2><strong>{view.dodged}</strong><span>falling objects dodged</span><div><button type="button" onClick={startChallenge}>Run it again</button><button type="button" onClick={onExit}>Back to Midtown</button></div></section> : null}</main>;
}

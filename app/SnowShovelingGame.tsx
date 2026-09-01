"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { Suspense, useLayoutEffect, useMemo, useRef, useState, useEffect } from "react";
import { InstancedMesh, Object3D, type Group } from "three";
import type { TurtleVariant } from "@/lib/turtles";
import { useGameReward } from "./GameEconomy";
import { TurtleBillboard } from "./world3d/TurtleBillboard";

type SnowShovelingGameProps = { onExit: () => void; turtleName: string; turtleVariant: TurtleVariant };
type ShiftStatus = "ready" | "playing" | "finished";
type SnowBank = { x: number; y: number; amount: number; seed: number };
type ShiftState = { x: number; y: number; facingX: number; facingY: number; timeLeft: number; status: ShiftStatus; cleared: Set<number>; shovelDown: boolean; shovelLoad: number; banks: SnowBank[]; startedAt: number; message: string; messageUntil: number; stride: number };
type ShiftView = { x: number; y: number; facingX: number; facingY: number; status: ShiftStatus; cleared: Set<number>; shovelDown: boolean; shovelLoad: number; banks: SnowBank[] };
type ShiftHud = { status: ShiftStatus; timeLeft: number; clearedPercent: number; shovelLoad: number; message: string };

const YARD_WIDTH = 1200;
const YARD_HEIGHT = 720;
const SHIFT_LENGTH = 90;
const CLEAR_TARGET = 72;
const WALK_SPEED = 255;
const PUSH_SPEED = 175;
const MAX_LOAD = 34;
const CELL_SIZE = 14;
const WORLD_SCALE = 0.018;
const GRID_COLUMNS = Math.ceil(YARD_WIDTH / CELL_SIZE);
const GRID_ROWS = Math.ceil(YARD_HEIGHT / CELL_SIZE);
const movementKeys = new Set(["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "w", "a", "s", "d", "W", "A", "S", "D"]);

function clamp(value: number, minimum: number, maximum: number) { return Math.min(Math.max(value, minimum), maximum); }
const PATH_POINTS = [
  { x: 600, y: 690, width: 90 }, { x: 585, y: 585, width: 82 },
  { x: 520, y: 500, width: 78 }, { x: 420, y: 445, width: 74 },
  { x: 300, y: 410, width: 72 }, { x: 205, y: 345, width: 70 },
  { x: 155, y: 255, width: 68 }, { x: 205, y: 165, width: 66 },
  { x: 330, y: 125, width: 64 }, { x: 455, y: 155, width: 64 },
  { x: 560, y: 225, width: 68 }, { x: 665, y: 255, width: 70 },
  { x: 780, y: 235, width: 68 }, { x: 900, y: 175, width: 66 },
  { x: 1035, y: 145, width: 72 },
] as const;
const PATH_BRANCHES = [
  [PATH_POINTS[0], PATH_POINTS[1], PATH_POINTS[2], PATH_POINTS[3], PATH_POINTS[4], PATH_POINTS[5], PATH_POINTS[6], PATH_POINTS[7], PATH_POINTS[8], PATH_POINTS[9], PATH_POINTS[10]],
  [PATH_POINTS[10], PATH_POINTS[11], PATH_POINTS[12], PATH_POINTS[13], PATH_POINTS[14]],
] as const;

function distanceToSegment(x: number, y: number, start: { x: number; y: number }, end: { x: number; y: number }) { const dx = end.x - start.x; const dy = end.y - start.y; const lengthSquared = dx * dx + dy * dy; const t = lengthSquared === 0 ? 0 : clamp(((x - start.x) * dx + (y - start.y) * dy) / lengthSquared, 0, 1); return Math.hypot(x - (start.x + dx * t), y - (start.y + dy * t)); }
function isPathPoint(x: number, y: number) { return PATH_BRANCHES.some((branch) => branch.slice(1).some((point, index) => distanceToSegment(x, y, branch[index], point) < (branch[index].width + point.width) / 2)); }
const pathCells = Array.from({ length: GRID_ROWS * GRID_COLUMNS }, (_, index) => { const column = index % GRID_COLUMNS; const row = Math.floor(index / GRID_COLUMNS); return isPathPoint(column * CELL_SIZE + CELL_SIZE / 2, row * CELL_SIZE + CELL_SIZE / 2) ? index : -1; }).filter((index) => index >= 0);
function createShiftState(status: ShiftStatus = "ready"): ShiftState { return { x: 600, y: 625, facingX: 0, facingY: -1, timeLeft: SHIFT_LENGTH, status, cleared: new Set(), shovelDown: false, shovelLoad: 0, banks: [], startedAt: performance.now(), message: "", messageUntil: 0, stride: 0 }; }
function createShiftView(state: ShiftState): ShiftView { return { x: state.x, y: state.y, facingX: state.facingX, facingY: state.facingY, status: state.status, cleared: new Set(state.cleared), shovelDown: state.shovelDown, shovelLoad: state.shovelLoad, banks: state.banks.map((bank) => ({ ...bank })) }; }
function formatTime(seconds: number) { const safe = Math.max(0, Math.ceil(seconds)); return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, "0")}`; }
function worldPosition(x: number, y: number): [number, number, number] { return [(x - YARD_WIDTH / 2) * WORLD_SCALE, 0, (y - YARD_HEIGHT / 2) * WORLD_SCALE]; }
function shovelCenter(state: ShiftState) { return { x: state.x + state.facingX * 76, y: state.y + state.facingY * 76 }; }
function refillSnowAt(state: ShiftState, x: number, y: number, amount: number) { const candidates = [...state.cleared].map((index) => { const column = index % GRID_COLUMNS; const row = Math.floor(index / GRID_COLUMNS); return { index, distance: Math.hypot(column * CELL_SIZE + CELL_SIZE / 2 - x, row * CELL_SIZE + CELL_SIZE / 2 - y) }; }).filter(({ distance }) => distance < 78).sort((a, b) => a.distance - b.distance).slice(0, Math.ceil(amount)); for (const candidate of candidates) state.cleared.delete(candidate.index); }
function dumpShovel(state: ShiftState, time: number) { if (state.shovelLoad < 0.5) return; const center = shovelCenter(state); if (isPathPoint(center.x, center.y)) { refillSnowAt(state, center.x, center.y, state.shovelLoad); state.message = "That snow fell back onto the path"; state.messageUntil = time + 1700; } else { state.banks.push({ x: center.x, y: center.y, amount: state.shovelLoad, seed: state.banks.length * 19 + Math.round(center.x) }); state.message = "Nice dump—keep building the bank"; state.messageUntil = time + 1300; } state.shovelLoad = 0; }
function collectSnow(state: ShiftState, time: number) { const center = shovelCenter(state); let collected = 0; for (const index of pathCells) { if (state.cleared.has(index)) continue; const column = index % GRID_COLUMNS; const row = Math.floor(index / GRID_COLUMNS); const cellX = column * CELL_SIZE + CELL_SIZE / 2; const cellY = row * CELL_SIZE + CELL_SIZE / 2; const forward = (cellX - center.x) * state.facingX + (cellY - center.y) * state.facingY; const sideways = Math.abs((cellX - center.x) * -state.facingY + (cellY - center.y) * state.facingX); if (forward > -18 && forward < 25 && sideways < 38 && state.shovelLoad < MAX_LOAD) { state.cleared.add(index); state.shovelLoad += 0.72; collected += 1; } } if (state.shovelLoad >= MAX_LOAD - 0.5 && collected > 0) { state.message = "Shovel is full—push to the grass and release Space"; state.messageUntil = time + 2200; } }

function SnowField({ cleared }: { cleared: Set<number> }) {
  const mesh = useRef<InstancedMesh>(null);
  const dummy = useMemo(() => new Object3D(), []);
  useLayoutEffect(() => { if (!mesh.current) return; pathCells.forEach((cell, instance) => { const column = cell % GRID_COLUMNS; const row = Math.floor(cell / GRID_COLUMNS); const [x, , z] = worldPosition(column * CELL_SIZE + CELL_SIZE / 2, row * CELL_SIZE + CELL_SIZE / 2); dummy.position.set(x, 0.11, z); const visible = cleared.has(cell) ? 0.001 : 1; dummy.scale.set(0.19 * visible, (0.09 + ((column * 13 + row * 7) % 4) * 0.015) * visible, 0.19 * visible); dummy.updateMatrix(); mesh.current?.setMatrixAt(instance, dummy.matrix); }); mesh.current.instanceMatrix.needsUpdate = true; }, [cleared, dummy]);
  return <instancedMesh ref={mesh} args={[undefined, undefined, pathCells.length]} castShadow receiveShadow><sphereGeometry args={[1, 7, 5]} /><meshStandardMaterial color="#f7f8f2" roughness={0.96} /></instancedMesh>;
}

function ParkYard() {
  return <>
    <mesh position={[0, -0.18, 0]} receiveShadow><boxGeometry args={[22, 0.35, 13.2]} /><meshStandardMaterial color="#a9c6b2" /></mesh>
    {PATH_BRANCHES.flatMap((branch, branchIndex) => branch.slice(1).map((point, index) => { const start = branch[index]; const dx = point.x - start.x; const dy = point.y - start.y; const center = worldPosition((start.x + point.x) / 2, (start.y + point.y) / 2); return <mesh key={`${branchIndex}-${index}`} position={[center[0], -0.02, center[2]]} rotation-y={-Math.atan2(dy, dx)} receiveShadow><boxGeometry args={[Math.hypot(dx, dy) * WORLD_SCALE + 0.12, 0.12, ((start.width + point.width) / 2) * WORLD_SCALE]} /><meshStandardMaterial color="#d8d6cc" /></mesh>; }))}
    {[{ x: -7.8, z: 3.5 }, { x: -5.6, z: -4.5 }, { x: 4.8, z: 4.5 }, { x: 7.6, z: -2.8 }].map((tree, index) => <group key={`tree-${index}`} position={[tree.x, 0, tree.z]}><mesh position={[0, 0.55, 0]} castShadow><cylinderGeometry args={[0.13, 0.18, 1.1, 8]} /><meshStandardMaterial color="#79563b" /></mesh><mesh position={[0, 1.35, 0]} castShadow><coneGeometry args={[0.85, 1.8, 9]} /><meshStandardMaterial color="#4f755f" /></mesh><mesh position={[0, 1.9, 0]} castShadow><coneGeometry args={[0.62, 1.35, 9]} /><meshStandardMaterial color="#63846c" /></mesh></group>)}
    {[{ x: -8.6, z: 0.5, r: 0.3 }, { x: -3.1, z: 4.5, r: -0.9 }, { x: 5.8, z: -4.2, r: 0.45 }].map((bench, index) => <group key={`bench-${index}`} position={[bench.x, 0.35, bench.z]} rotation-y={bench.r}><mesh><boxGeometry args={[1.75, 0.22, 0.55]} /><meshStandardMaterial color="#966744" /></mesh>{[-0.65, 0.65].map((leg) => <mesh key={leg} position={[leg, -0.31, 0]}><boxGeometry args={[0.12, 0.62, 0.16]} /><meshStandardMaterial color="#17342f" /></mesh>)}</group>)}
    {[{ x: -7.2, z: -1.8 }, { x: 0.9, z: 4.4 }, { x: 8.3, z: 2.2 }].map((lamp, index) => <group key={`lamp-${index}`} position={[lamp.x, 0, lamp.z]}><mesh position={[0, 0.55, 0]}><cylinderGeometry args={[0.055, 0.07, 1.1, 8]} /><meshStandardMaterial color="#17342f" /></mesh><mesh position={[0, 1.18, 0]}><sphereGeometry args={[0.2, 12, 8]} /><meshStandardMaterial emissive="#f1d898" emissiveIntensity={0.5} color="#f1d898" /></mesh></group>)}
  </>;
}

function Shovel({ down, load }: { down: boolean; load: number }) {
  return <group position={[0, down ? 0.13 : 0.33, -0.95]} rotation-x={down ? 0 : -0.28}><mesh position={[0, 0.57, 0.42]} rotation-x={-0.68}><cylinderGeometry args={[0.045, 0.045, 1.45, 8]} /><meshStandardMaterial color="#8b5d3d" /></mesh><mesh position={[0, 0.08, -0.12]}><boxGeometry args={[0.9, 0.16, 0.52]} /><meshStandardMaterial color="#e6b84f" /></mesh>{load > 0 ? <mesh position={[0, 0.22, -0.12]} scale={[0.4 + load / MAX_LOAD * 0.45, 0.16 + load / MAX_LOAD * 0.18, 0.3]}><sphereGeometry args={[1, 10, 6]} /><meshStandardMaterial color="#ffffff" /></mesh> : null}</group>;
}

function SnowWorld({ view, turtleName, turtleVariant }: { view: ShiftView; turtleName: string; turtleVariant: TurtleVariant }) {
  const player = useRef<Group>(null); const target = worldPosition(view.x, view.y); const angle = -Math.atan2(view.facingX, -view.facingY);
  useFrame((_, delta) => { if (!player.current) return; player.current.position.x += (target[0] - player.current.position.x) * Math.min(1, delta * 12); player.current.position.z += (target[2] - player.current.position.z) * Math.min(1, delta * 12); player.current.rotation.y += (angle - player.current.rotation.y) * Math.min(1, delta * 10); });
  return <><color attach="background" args={["#adc9bd"]} /><fog attach="fog" args={["#adc9bd", 20, 38]} /><ambientLight intensity={1.4} /><directionalLight castShadow intensity={2.2} position={[-9, 16, 10]} shadow-mapSize={[1024, 1024]} /><ParkYard /><SnowField cleared={view.cleared} />{view.banks.map((bank, index) => { const [x, , z] = worldPosition(bank.x, bank.y); const size = 0.35 + Math.sqrt(bank.amount) * 0.08; return <mesh key={`${bank.seed}-${index}`} position={[x, size * 0.35, z]} scale={[size * 1.5, size * 0.65, size]} castShadow><sphereGeometry args={[1, 12, 7]} /><meshStandardMaterial color="#f5f7f0" /></mesh>; })}<group ref={player} position={target} rotation-y={angle}><Shovel down={view.shovelDown} load={view.shovelLoad} /><group position={[0, 0.15, 0.08]}><TurtleBillboard name={turtleName} scale={0.62} showShadow={false} variant={turtleVariant} /></group></group></>;
}

export function SnowShovelingGame({ onExit, turtleName, turtleVariant }: SnowShovelingGameProps) {
  const gameRef = useRef<ShiftState>(createShiftState());
  const [view, setView] = useState<ShiftView>(() => createShiftView(createShiftState()));
  const [hud, setHud] = useState<ShiftHud>({ status: "ready", timeLeft: SHIFT_LENGTH, clearedPercent: 0, shovelLoad: 0, message: "" });
  function startShift() { const next = createShiftState("playing"); gameRef.current = next; setView(createShiftView(next)); setHud({ status: "playing", timeLeft: SHIFT_LENGTH, clearedPercent: 0, shovelLoad: 0, message: "Hold Space and push forward through the snow" }); }
  useEffect(() => {
    const pressed = new Set<string>(); let animationFrame = 0; let previousTime = performance.now(); let previousHudUpdate = 0;
    function handleKeyDown(event: KeyboardEvent) { if (movementKeys.has(event.key) || event.code === "Space") event.preventDefault(); if (movementKeys.has(event.key)) pressed.add(event.key.toLowerCase()); else if (event.code === "Space") { if (!event.repeat) gameRef.current.shovelDown = true; pressed.add("space"); } }
    function handleKeyUp(event: KeyboardEvent) { if (event.code === "Space") { pressed.delete("space"); gameRef.current.shovelDown = false; dumpShovel(gameRef.current, performance.now()); } else pressed.delete(event.key.toLowerCase()); }
    function handleBlur() { pressed.clear(); gameRef.current.shovelDown = false; }
    function update(time: number) { const state = gameRef.current; const elapsed = Math.min((time - previousTime) / 1000, 0.05); previousTime = time;
      if (state.status === "playing") { const horizontal = Number(pressed.has("arrowright") || pressed.has("d")) - Number(pressed.has("arrowleft") || pressed.has("a")); const vertical = Number(pressed.has("arrowdown") || pressed.has("s")) - Number(pressed.has("arrowup") || pressed.has("w")); const magnitude = Math.hypot(horizontal, vertical);
        if (magnitude > 0) { const inputX = horizontal / magnitude; const inputY = vertical / magnitude; const turnRate = state.shovelDown ? Math.min(1, elapsed * 8) : 1; state.facingX += (inputX - state.facingX) * turnRate; state.facingY += (inputY - state.facingY) * turnRate; const facingLength = Math.hypot(state.facingX, state.facingY) || 1; state.facingX /= facingLength; state.facingY /= facingLength; const loadResistance = 1 - state.shovelLoad / MAX_LOAD * 0.42; const speed = state.shovelDown ? PUSH_SPEED * loadResistance : WALK_SPEED; state.x = clamp(state.x + (state.shovelDown ? state.facingX : inputX) * speed * elapsed, 55, YARD_WIDTH - 55); state.y = clamp(state.y + (state.shovelDown ? state.facingY : inputY) * speed * elapsed, 48, YARD_HEIGHT - 28); state.stride += speed * elapsed * 0.065; if (state.shovelDown) collectSnow(state, time); }
        state.timeLeft = Math.max(0, SHIFT_LENGTH - (time - state.startedAt) / 1000); const clearedPercent = state.cleared.size / pathCells.length * 100; if (clearedPercent >= CLEAR_TARGET || state.timeLeft <= 0) { state.status = "finished"; if (state.shovelLoad > 0) dumpShovel(state, time); }
        if (time - previousHudUpdate > 70 || state.status === "finished") { previousHudUpdate = time; setView(createShiftView(state)); setHud({ status: state.status, timeLeft: state.timeLeft, clearedPercent, shovelLoad: state.shovelLoad, message: time < state.messageUntil ? state.message : "" }); }
      }
      animationFrame = requestAnimationFrame(update);
    }
    window.addEventListener("keydown", handleKeyDown, { passive: false }); window.addEventListener("keyup", handleKeyUp); window.addEventListener("blur", handleBlur); animationFrame = requestAnimationFrame(update); return () => { cancelAnimationFrame(animationFrame); window.removeEventListener("keydown", handleKeyDown); window.removeEventListener("keyup", handleKeyUp); window.removeEventListener("blur", handleBlur); };
  }, []);
  const completed = hud.clearedPercent >= CLEAR_TARGET;
  useGameReward("snow-shoveling", hud.status === "finished" && completed);
  return <main className="shoveling-stage" data-testid="snow-shoveling-game"><div className="shoveling-canvas" aria-label="3D Snow Crew shoveling yard"><Canvas orthographic camera={{ position: [0, 14, 15], zoom: 46 }} dpr={[1, 1.5]} shadows="basic" gl={{ antialias: true, powerPreference: "high-performance" }}><Suspense fallback={null}><SnowWorld view={view} turtleName={turtleName} turtleVariant={turtleVariant} /></Suspense></Canvas></div><button type="button" className="shoveling-exit" onClick={onExit}><span aria-hidden="true">←</span>Central Park</button><section className="shoveling-scoreboard" aria-live="polite"><div><small>Route open</small><strong>{Math.min(100, Math.floor(hud.clearedPercent))}%</strong></div><span aria-hidden="true"><i style={{ width: `${Math.min(100, hud.clearedPercent)}%` }} /></span><time>{formatTime(hud.timeLeft)}</time></section>{hud.status === "playing" ? <><aside className="shovel-load" aria-live="polite"><small>Shovel load</small><span aria-hidden="true"><i style={{ width: `${hud.shovelLoad / MAX_LOAD * 100}%` }} /></span><strong>{hud.shovelLoad >= MAX_LOAD - 1 ? "FULL" : "PUSH"}</strong></aside><p className="shoveling-coach">{hud.message || "Hold Space to lower the blade · Release off the path to dump"}</p></> : null}{hud.status !== "playing" ? <section className="shoveling-start-card"><p>Central Park Snow Crew</p><h1>{hud.status === "ready" ? "Push. Load. Dump." : completed ? "Route open!" : "Shift over"}</h1><span>{hud.status === "ready" ? "Line up a run, hold Space to lower your shovel, and push forward through the drift. A full blade gets heavy. Carry it onto the grass and release Space to build a snowbank." : completed ? `You opened ${Math.floor(hud.clearedPercent)}% of the route and left the snow where it belongs.` : `You opened ${Math.floor(hud.clearedPercent)}% of the route. The next crew will take it from here.`}</span><div className="shoveling-controls" aria-hidden="true"><b>WASD</b><i>line up</i><b>HOLD SPACE</b><i>push</i><b>RELEASE</b><i>dump</i></div><button type="button" onClick={startShift}>{hud.status === "ready" ? "Start shift" : "Shovel again"}</button></section> : null}</main>;
}

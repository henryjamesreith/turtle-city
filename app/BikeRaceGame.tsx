"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import { Suspense, useEffect, useRef, useState } from "react";
import type { Group } from "three";
import type { TurtleVariant } from "@/lib/turtles";
import { useBikeRaceMultiplayer, type BikeRacePlayer } from "@/lib/multiplayer/useBikeRaceMultiplayer";
import { TurtleBillboard } from "./world3d/TurtleBillboard";

type BikeRaceGameProps = { onExit: () => void; turtleName: string; turtleVariant: TurtleVariant };
type RaceStatus = "ready" | "racing" | "finished";
type RaceMode = "choose" | "solo" | "multiplayer";
type RaceState = { boost: number; distance: number; elapsed: number; hitObstacles: Set<number>; lane: number; message: string; opponents: [number, number]; slowTime: number };
type RaceView = Omit<RaceState, "hitObstacles" | "slowTime">;

const COURSE_LENGTH = 6200;
const PLAYER_SPEED = 290;
const SPRINT_SPEED = 385;
const OPPONENT_SPEEDS = [306, 319] as const;
const LANE_X = [-2.15, 0, 2.15] as const;
const WORLD_SCALE = 0.014;
const PLAYER_Z = 5;
const obstacles = [
  { distance: 920, lane: 1, type: "cone" }, { distance: 1540, lane: 2, type: "puddle" },
  { distance: 2280, lane: 0, type: "cone" }, { distance: 3020, lane: 1, type: "crate" },
  { distance: 3860, lane: 2, type: "cone" }, { distance: 4510, lane: 0, type: "puddle" },
  { distance: 5280, lane: 1, type: "crate" },
] as const;

function createRaceState(): RaceState { return { boost: 100, distance: 0, elapsed: 0, hitObstacles: new Set(), lane: 1, message: "", opponents: [0, 0], slowTime: 0 }; }
function createRaceView(race: RaceState): RaceView { return { boost: race.boost, distance: race.distance, elapsed: race.elapsed, lane: race.lane, message: race.message, opponents: [...race.opponents] as [number, number] }; }
function formatTime(seconds: number) { return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}.${Math.floor((seconds % 1) * 10)}`; }
function placeLabel(place: number) { return place === 1 ? "1st" : place === 2 ? "2nd" : "3rd"; }

function Bicycle({ color = "#e4b743" }: { color?: string }) {
  return <group rotation-y={Math.PI}>
    {[-0.62, 0.62].map((z) => <mesh key={z} position={[0, 0.42, z]} rotation-y={Math.PI / 2}><torusGeometry args={[0.38, 0.065, 8, 20]} /><meshStandardMaterial color="#17332f" roughness={0.72} /></mesh>)}
    <mesh position={[0, 0.55, 0]} rotation-x={Math.PI / 2}><torusGeometry args={[0.43, 0.055, 6, 3]} /><meshStandardMaterial color={color} /></mesh>
    <mesh position={[0, 0.88, -0.33]} rotation-x={-0.35}><cylinderGeometry args={[0.045, 0.045, 0.8, 8]} /><meshStandardMaterial color={color} /></mesh>
    <mesh position={[0, 1.16, -0.48]} rotation-z={Math.PI / 2}><cylinderGeometry args={[0.045, 0.045, 0.55, 8]} /><meshStandardMaterial color="#17332f" /></mesh>
  </group>;
}

function Racer({ color, name, player, turtleName, turtleVariant }: { color: string; name?: string; player?: boolean; turtleName?: string; turtleVariant?: TurtleVariant }) {
  return <group><Bicycle color={color} />{player && turtleVariant ? <group position={[0, 0.5, 0.12]}><TurtleBillboard name={turtleName} scale={0.56} variant={turtleVariant} /></group> : <group position={[0, 1.33, 0.08]}><mesh castShadow><sphereGeometry args={[0.43, 14, 10]} /><meshStandardMaterial color={color} /></mesh><mesh position={[0, 0.08, 0.3]} castShadow><sphereGeometry args={[0.34, 14, 10]} /><meshStandardMaterial color="#8caf61" /></mesh>{name ? <Html center position={[0, 0.95, 0]} distanceFactor={13}><span className="world3d-nameplate">{name}</span></Html> : null}</group>}</group>;
}

function RaceObstacle({ type }: { type: (typeof obstacles)[number]["type"] }) {
  if (type === "puddle") return <mesh position={[0, 0.035, 0]} rotation-x={-Math.PI / 2}><circleGeometry args={[0.62, 24]} /><meshStandardMaterial color="#5598aa" roughness={0.2} /></mesh>;
  if (type === "crate") return <mesh position={[0, 0.42, 0]} castShadow><boxGeometry args={[0.8, 0.8, 0.8]} /><meshStandardMaterial color="#9e673d" roughness={0.85} /></mesh>;
  return <mesh position={[0, 0.42, 0]} castShadow><coneGeometry args={[0.34, 0.84, 16]} /><meshStandardMaterial color="#e5673f" /></mesh>;
}

function MovingCourse({ distance }: { distance: number }) {
  const group = useRef<Group>(null);
  useFrame(() => { if (group.current) group.current.position.z = (distance * WORLD_SCALE) % 12; });
  return <group ref={group}>{Array.from({ length: 9 }, (_, index) => {
    const z = 12 - index * 12;
    return <group key={z} position={[0, 0, z]}>
      <mesh position={[0, -0.13, -6]} receiveShadow><boxGeometry args={[7.6, 0.25, 12]} /><meshStandardMaterial color="#78a57c" roughness={0.95} /></mesh>
      {[-1.08, 1.08].map((x) => <mesh key={x} position={[x, 0.015, -6]} rotation-x={-Math.PI / 2}><planeGeometry args={[0.075, 12]} /><meshBasicMaterial color="#e9e1c7" /></mesh>)}
      <mesh position={[-6.5, -0.3, -6]} receiveShadow><boxGeometry args={[5.2, 0.5, 12]} /><meshStandardMaterial color="#66a9b7" roughness={0.3} /></mesh>
      <mesh position={[6.4, 1.4, -6]} castShadow><boxGeometry args={[0.2, 2.8, 12]} /><meshStandardMaterial color="#31564d" /></mesh>
      {[0, 1].map((side) => <mesh key={side} position={[6.4, 2.5 - side * 1.55, -6]} castShadow><boxGeometry args={[0.2, 0.16, 12]} /><meshStandardMaterial color="#31564d" /></mesh>)}
    </group>;
  })}</group>;
}

function FinishGate({ z }: { z: number }) {
  if (z < -72 || z > 14) return null;
  return <group position={[0, 0, z]}>{[-3.55, 3.55].map((x) => <mesh key={x} position={[x, 2.5, 0]} castShadow><boxGeometry args={[0.22, 5, 0.22]} /><meshStandardMaterial color="#f5e6b0" /></mesh>)}<mesh position={[0, 4.55, 0]} castShadow><boxGeometry args={[7.3, 0.72, 0.28]} /><meshStandardMaterial color="#17332f" /></mesh><Html center position={[0, 4.58, 0.18]} distanceFactor={12}><strong className="bike-finish-label">FINISH</strong></Html></group>;
}

function BikeRaceWorld({ race, racers, sessionId, turtleName, turtleVariant }: { race: RaceView; racers?: BikeRacePlayer[]; sessionId?: string; turtleName: string; turtleVariant: TurtleVariant }) {
  const player = useRef<Group>(null);
  useFrame((_, delta) => { if (player.current) { player.current.position.x += (LANE_X[race.lane] - player.current.position.x) * Math.min(1, delta * 9); player.current.rotation.z = (LANE_X[race.lane] - player.current.position.x) * -0.06; } });
  return <>
    <color attach="background" args={["#a8ced2"]} /><fog attach="fog" args={["#a8ced2", 34, 88]} /><ambientLight intensity={1.25} /><directionalLight castShadow intensity={2.2} position={[-10, 18, 12]} shadow-mapSize={[1024, 1024]} />
    <MovingCourse distance={race.distance} />
    <mesh position={[-9.6, 1.7, -30]}><boxGeometry args={[1.1, 3.4, 120]} /><meshStandardMaterial color="#456e57" /></mesh>
    {Array.from({ length: 12 }, (_, index) => <mesh key={index} position={[-11.5 - (index % 3) * 1.4, 2 + (index % 4), -index * 9]}><boxGeometry args={[1.2 + (index % 2), 4 + (index % 4) * 1.3, 3.5]} /><meshStandardMaterial color={index % 2 ? "#657b78" : "#836c55"} /></mesh>)}
    {obstacles.map((obstacle) => { const z = PLAYER_Z - (obstacle.distance - race.distance) * WORLD_SCALE; return z > 14 || z < -72 ? null : <group key={`${obstacle.type}-${obstacle.distance}`} position={[LANE_X[obstacle.lane], 0, z]}><RaceObstacle type={obstacle.type} /></group>; })}
    <FinishGate z={PLAYER_Z - (COURSE_LENGTH - race.distance) * WORLD_SCALE} />
    <group ref={player} position={[LANE_X[race.lane], 0, PLAYER_Z]}><Racer color="#e1b83f" player turtleName={turtleName} turtleVariant={turtleVariant} /></group>
    {racers ? racers.filter((racer) => racer.sessionId !== sessionId).map((racer, index) => <group key={racer.sessionId} position={[LANE_X[racer.lane], 0, PLAYER_Z - (racer.distance - race.distance) * WORLD_SCALE]}><Racer color={index % 2 ? "#d1a44f" : "#6f9558"} name={racer.name} /></group>) : <><group position={[LANE_X[0], 0, PLAYER_Z - (race.opponents[0] - race.distance) * WORLD_SCALE]}><Racer color="#6f9558" name="Moss" /></group><group position={[LANE_X[2], 0, PLAYER_Z - (race.opponents[1] - race.distance) * WORLD_SCALE]}><Racer color="#d1a44f" name="Skipper" /></group></>}
  </>;
}

export function BikeRaceGame({ onExit, turtleName, turtleVariant }: BikeRaceGameProps) {
  const multiplayer = useBikeRaceMultiplayer();
  const [mode, setMode] = useState<RaceMode>("choose");
  const raceRef = useRef<RaceState>(createRaceState());
  const [status, setStatus] = useState<RaceStatus>("ready");
  const [view, setView] = useState<RaceView>(() => createRaceView(createRaceState()));
  const [finishPlace, setFinishPlace] = useState(1);
  const multiplayerPhase = multiplayer.match.phase;
  const multiplayerPlayers = multiplayer.match.players;
  const multiplayerSessionId = multiplayer.sessionId;
  const sendRaceInput = multiplayer.sendInput;
  const multiplayerPlayersRef = useRef(multiplayerPlayers);
  useEffect(() => { multiplayerPlayersRef.current = multiplayerPlayers; }, [multiplayerPlayers]);
  function startRace() { setMode("solo"); raceRef.current = createRaceState(); setView(createRaceView(raceRef.current)); setFinishPlace(1); setStatus("racing"); }

  useEffect(() => {
    if (mode !== "solo" || status !== "racing") return;
    const pressed = new Set<string>(); let previousTime = performance.now(); let lastViewUpdate = 0; let animationFrame = 0;
    function handleKeyDown(event: KeyboardEvent) { const key = event.key.toLowerCase(); if (["arrowup", "arrowdown", "w", "s"].includes(key) || event.code === "Space") event.preventDefault(); if (!event.repeat && (key === "arrowup" || key === "w")) raceRef.current.lane = Math.max(0, raceRef.current.lane - 1); else if (!event.repeat && (key === "arrowdown" || key === "s")) raceRef.current.lane = Math.min(2, raceRef.current.lane + 1); if (event.code === "Space") pressed.add("sprint"); }
    function handleKeyUp(event: KeyboardEvent) { if (event.code === "Space") pressed.delete("sprint"); }
    function clearInput() { pressed.clear(); }
    function update(time: number) {
      const race = raceRef.current; const elapsed = Math.min((time - previousTime) / 1000, 0.05); previousTime = time; race.elapsed += elapsed; race.slowTime = Math.max(0, race.slowTime - elapsed);
      const sprinting = pressed.has("sprint") && race.boost > 0; race.boost = sprinting ? Math.max(0, race.boost - elapsed * 21) : Math.min(100, race.boost + elapsed * 10);
      const targetSpeed = race.slowTime > 0 ? 185 : sprinting ? SPRINT_SPEED : PLAYER_SPEED; race.distance = Math.min(COURSE_LENGTH, race.distance + targetSpeed * elapsed);
      race.opponents[0] = Math.min(COURSE_LENGTH, race.opponents[0] + (OPPONENT_SPEEDS[0] + Math.sin(race.elapsed * 1.4) * 13) * elapsed); race.opponents[1] = Math.min(COURSE_LENGTH, race.opponents[1] + (OPPONENT_SPEEDS[1] + Math.cos(race.elapsed * 1.1) * 11) * elapsed);
      for (const [index, obstacle] of obstacles.entries()) if (!race.hitObstacles.has(index) && obstacle.lane === race.lane && obstacle.distance - race.distance < 55 && obstacle.distance - race.distance > -35) { race.hitObstacles.add(index); race.slowTime = 0.9; race.distance = Math.max(0, race.distance - 75); race.message = obstacle.type === "puddle" ? "Slippery!" : obstacle.type === "crate" ? "Watch the delivery!" : "Traffic cone!"; }
      if (race.message && race.slowTime <= 0.15) race.message = ""; if (time - lastViewUpdate > 32) { setView(createRaceView(race)); lastViewUpdate = time; }
      if (race.distance >= COURSE_LENGTH) { setFinishPlace(1 + race.opponents.filter((distance) => distance >= COURSE_LENGTH).length); setView(createRaceView(race)); setStatus("finished"); return; }
      animationFrame = requestAnimationFrame(update);
    }
    window.addEventListener("keydown", handleKeyDown, { passive: false }); window.addEventListener("keyup", handleKeyUp); window.addEventListener("blur", clearInput); animationFrame = requestAnimationFrame(update);
    return () => { cancelAnimationFrame(animationFrame); window.removeEventListener("keydown", handleKeyDown); window.removeEventListener("keyup", handleKeyUp); window.removeEventListener("blur", clearInput); };
  }, [mode, status]);

  useEffect(() => {
    if (mode !== "multiplayer" || multiplayerPhase !== "playing") return;
    let lane = multiplayerPlayersRef.current.find((player) => player.sessionId === multiplayerSessionId)?.lane ?? 1;
    let sprinting = false;
    function send() { sendRaceInput(lane, sprinting); }
    function handleKeyDown(event: KeyboardEvent) { const key = event.key.toLowerCase(); if (["arrowup", "arrowdown", "w", "s"].includes(key) || event.code === "Space") event.preventDefault(); if (!event.repeat && (key === "arrowup" || key === "w")) { lane = Math.max(0, lane - 1); send(); } else if (!event.repeat && (key === "arrowdown" || key === "s")) { lane = Math.min(2, lane + 1); send(); } if (event.code === "Space" && !sprinting) { sprinting = true; send(); } }
    function handleKeyUp(event: KeyboardEvent) { if (event.code === "Space") { sprinting = false; send(); } }
    function clearInput() { sprinting = false; send(); }
    window.addEventListener("keydown", handleKeyDown, { passive: false }); window.addEventListener("keyup", handleKeyUp); window.addEventListener("blur", clearInput);
    return () => { window.removeEventListener("keydown", handleKeyDown); window.removeEventListener("keyup", handleKeyUp); window.removeEventListener("blur", clearInput); };
  }, [mode, multiplayerPhase, multiplayerSessionId, sendRaceInput]);

  const multiplayerPlayer = multiplayer.match.players.find((player) => player.sessionId === multiplayer.sessionId);
  const displayView: RaceView = mode === "multiplayer" ? { boost: multiplayerPlayer?.boost ?? 100, distance: multiplayerPlayer?.distance ?? 0, elapsed: multiplayer.match.elapsed, lane: multiplayerPlayer?.lane ?? 1, message: "", opponents: [0, 0] } : view;
  const playerProgress = Math.min(100, (displayView.distance / COURSE_LENGTH) * 100);
  return <main className="bike-race-stage" data-testid="bike-race-game">
    <div className="bike-race-canvas" aria-label="3D Hudson Greenway bike race"><Canvas camera={{ fov: 48, position: [0, 5.8, 12.8] }} dpr={[1, 1.5]} shadows="basic" gl={{ antialias: true, powerPreference: "high-performance" }}><Suspense fallback={null}><BikeRaceWorld race={displayView} racers={mode === "multiplayer" ? multiplayer.match.players : undefined} sessionId={multiplayer.sessionId} turtleName={turtleName} turtleVariant={turtleVariant} /></Suspense></Canvas></div>
    <header className="bike-race-header"><p>Hudson Greenway</p><h1>River Run</h1></header><button type="button" className="bike-race-exit" onClick={() => { multiplayer.disconnect(); onExit(); }}><span aria-hidden="true">←</span>West Village</button>
    <section className="bike-race-hud" aria-label="Race status"><div><small>Distance</small><strong>{Math.round(playerProgress)}%</strong></div><div><small>Time</small><strong>{formatTime(displayView.elapsed)}</strong></div><div><small>Sprint</small><span><i style={{ width: `${displayView.boost}%` }} /></span></div></section>
    {displayView.message ? <strong className="bike-race-message">{displayView.message}</strong> : null}
    {mode === "choose" ? <section className="bike-race-overlay"><p>West Side starting line</p><h2>Race the river</h2><span>Use W/S or ↑/↓ to change lanes. Hold Space to sprint. Avoid obstacles.</span><div><button type="button" onClick={startRace}>Solo race</button><button type="button" onClick={() => { setMode("multiplayer"); void multiplayer.connect(); }}>Multiplayer</button></div></section> : null}
    {mode === "solo" && status === "finished" ? <section className="bike-race-overlay is-finished"><p>Race complete</p><h2>{placeLabel(finishPlace)} place</h2><span>You finished the Hudson run in {formatTime(view.elapsed)}.</span><div><button type="button" onClick={startRace}>Race again</button><button type="button" onClick={onExit}>Return to West Village</button></div></section> : null}
    {mode === "multiplayer" && (multiplayer.status === "connecting" || multiplayer.status === "offline") ? <section className="bike-race-overlay"><p>Online River Run</p><h2>{multiplayer.status === "connecting" ? "Joining race…" : "Server unavailable"}</h2><span>{multiplayer.status === "offline" ? "The multiplayer server may be waking up. Try again in a moment." : "Connecting to the Hudson starting line."}</span><div>{multiplayer.status === "offline" ? <button type="button" onClick={() => void multiplayer.connect()}>Try again</button> : null}<button type="button" onClick={() => { multiplayer.disconnect(); setMode("choose"); }}>Back</button></div></section> : null}
    {mode === "multiplayer" && multiplayer.status === "live" && multiplayer.match.phase === "lobby" ? <section className="bike-race-overlay bike-race-lobby"><p>Online River Run</p><h2>Starting line</h2><span>At least two racers must join and ready up.</span><div className="bike-race-roster">{multiplayer.match.players.map((player) => <div key={player.sessionId}><strong>{player.name}</strong><small>{player.ready ? "Ready" : "Waiting"}</small></div>)}</div><button type="button" onClick={multiplayer.ready}>Ready up</button></section> : null}
    {mode === "multiplayer" && multiplayer.match.phase === "countdown" ? <section className="bike-race-countdown"><small>Race starts in</small><strong>{Math.max(1, Math.ceil(multiplayer.match.countdownLeft))}</strong></section> : null}
    {mode === "multiplayer" && multiplayer.match.phase === "finished" ? <section className="bike-race-overlay is-finished"><p>Online race complete</p><h2>{placeLabel(multiplayerPlayer?.place || multiplayer.match.players.length)} place</h2><span>You finished the Hudson run in {formatTime(multiplayer.match.elapsed)}.</span><div><button type="button" onClick={multiplayer.rematch}>Race again</button><button type="button" onClick={() => { multiplayer.disconnect(); onExit(); }}>Return to West Village</button></div></section> : null}
  </main>;
}

"use client";

import { Html } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { Suspense, useEffect, useRef, useState } from "react";
import type { Group } from "three";
import type { TurtleVariant } from "@/lib/turtles";
import { useDeliveryMultiplayer, type DeliveryPlayer } from "@/lib/multiplayer/useDeliveryMultiplayer";
import { TurtleBillboard } from "./world3d/TurtleBillboard";
import { useGameReward } from "./GameEconomy";

type ShellExpressGameProps = {
  onExit: () => void;
  turtleName: string;
  turtleVariant: TurtleVariant;
};

type RouteStatus = "ready" | "playing" | "finished";
type RouteMode = "choose" | "solo" | "multiplayer";
type RouteItemType = "barrier" | "cab" | "dropoff" | "package" | "steam";
type RouteItem = { id: number; lane: number; type: RouteItemType; y: number };
type RouteState = {
  cargo: number;
  delivered: number;
  distance: number;
  elapsed: number;
  items: RouteItem[];
  lane: number;
  lives: number;
  message: string;
  nextItemId: number;
  spawnCooldown: number;
  status: RouteStatus;
};
type RouteView = Pick<RouteState, "cargo" | "delivered" | "distance" | "elapsed" | "items" | "lane" | "lives" | "message" | "status">;

const ROUTE_LENGTH = 5200;
const ROUTE_TIME = 60;
const DELIVERY_TARGET = 6;
const LANE_X = [-2.25, 0, 2.25] as const;
const routeSequence: RouteItemType[] = ["package", "barrier", "package", "cab", "dropoff", "steam", "package", "barrier", "package", "dropoff", "cab", "package"];
const multiplayerCourseItems = Array.from({ length: 18 }, (_, id) => ({ id, distance: 420 + id * 270, lane: (id * 2 + Math.floor(id / 3)) % 3, type: routeSequence[id % routeSequence.length] }));

function createRouteState(status: RouteStatus = "ready"): RouteState {
  return { cargo: 0, delivered: 0, distance: 0, elapsed: 0, items: [], lane: 1, lives: 3, message: "", nextItemId: 0, spawnCooldown: 0.55, status };
}

function createRouteView(state: RouteState): RouteView {
  return { cargo: state.cargo, delivered: state.delivered, distance: state.distance, elapsed: state.elapsed, items: state.items.map((item) => ({ ...item })), lane: state.lane, lives: state.lives, message: state.message, status: state.status };
}

function formatTime(seconds: number) {
  const safeSeconds = Math.max(0, Math.ceil(seconds));
  const minutes = Math.floor(safeSeconds / 60);
  return `${minutes}:${String(safeSeconds % 60).padStart(2, "0")}`;
}

function DeliveryBoard({ cargo }: { cargo: number }) {
  return <group>
    <mesh position={[0, 0.18, 0]} castShadow><boxGeometry args={[1.5, 0.13, 0.52]} /><meshStandardMaterial color="#d75d4f" /></mesh>
    {[-0.53, 0.53].map((x) => <mesh key={x} position={[x, 0.06, 0]} rotation-x={Math.PI / 2}><torusGeometry args={[0.12, 0.04, 8, 16]} /><meshStandardMaterial color="#142f31" /></mesh>)}
    {Array.from({ length: cargo }, (_, index) => <mesh key={index} position={[-0.32 + index * 0.32, 0.55, 0.15]} castShadow><boxGeometry args={[0.28, 0.32, 0.3]} /><meshStandardMaterial color="#e5be4e" /></mesh>)}
  </group>;
}

function DeliveryItem({ type }: { type: RouteItemType }) {
  if (type === "package") return <group><mesh position={[0, 0.5, 0]} castShadow><boxGeometry args={[0.95, 0.95, 0.95]} /><meshStandardMaterial color="#f2c94c" emissive="#6d5310" emissiveIntensity={0.28} /></mesh><mesh position={[0, 0.5, 0.49]}><boxGeometry args={[0.15, 0.97, 0.03]} /><meshBasicMaterial color="#fff1bd" /></mesh><Html center position={[0, 1.35, 0]} distanceFactor={12}><strong className="delivery-item-label is-pickup">PICK UP</strong></Html></group>;
  if (type === "dropoff") return <group><mesh position={[0, 0.035, 0]} rotation-x={-Math.PI / 2}><ringGeometry args={[0.75, 1.28, 32]} /><meshBasicMaterial color="#75e69b" transparent opacity={0.92} /></mesh><mesh position={[0, 0.02, 0]} rotation-x={-Math.PI / 2}><circleGeometry args={[0.72, 32]} /><meshBasicMaterial color="#194f41" transparent opacity={0.5} /></mesh><Html center position={[0, 0.65, 0]} distanceFactor={12}><strong className="delivery-item-label is-dropoff">DELIVER HERE</strong></Html></group>;
  if (type === "cab") return <group><mesh position={[0, 0.55, 0]} castShadow><boxGeometry args={[1.55, 0.72, 2.4]} /><meshStandardMaterial color="#e5bd4a" /></mesh><mesh position={[0, 1.05, -0.15]} castShadow><boxGeometry args={[1.25, 0.52, 1.15]} /><meshStandardMaterial color="#477275" /></mesh></group>;
  if (type === "barrier") return <group>{[-0.6, 0.6].map((x) => <mesh key={x} position={[x, 0.55, 0]}><boxGeometry args={[0.14, 1.1, 0.18]} /><meshStandardMaterial color="#f2ead0" /></mesh>)}<mesh position={[0, 0.83, 0]} rotation-z={-0.08}><boxGeometry args={[1.65, 0.38, 0.2]} /><meshStandardMaterial color="#d75d4f" /></mesh></group>;
  return <group>{[[0, 0], [0.28, 0.32], [-0.25, 0.55]].map(([x, y], index) => <mesh key={index} position={[x, 0.35 + y, 0]}><sphereGeometry args={[0.38 - index * 0.05, 12, 8]} /><meshStandardMaterial color="#edf0df" opacity={0.58} transparent /></mesh>)}</group>;
}

function MovingDowntown({ distance }: { distance: number }) {
  const scenery = useRef<Group>(null);
  useFrame(() => { if (scenery.current) scenery.current.position.z = (distance * 0.08) % 16; });
  return <group ref={scenery}>{Array.from({ length: 7 }, (_, segment) => <group key={segment} position={[0, 0, 8 - segment * 16]}>
    <mesh position={[0, -0.18, -8]} receiveShadow><boxGeometry args={[8.1, 0.35, 16]} /><meshStandardMaterial color="#34494b" roughness={0.96} /></mesh>
    {[-1.3, 1.3].map((x) => <mesh key={x} position={[x, 0.012, -8]} rotation-x={-Math.PI / 2}><planeGeometry args={[0.08, 16]} /><meshBasicMaterial color="#e8d36f" /></mesh>)}
    {[-5.1, 5.1].map((x) => <mesh key={x} position={[x, 0.02, -8]} receiveShadow><boxGeometry args={[2, 0.22, 16]} /><meshStandardMaterial color="#c9cbc3" /></mesh>)}
    {[-7.2, 7.2].map((x, side) => <group key={x}>{[0, 1].map((offset) => { const height = 5 + ((segment + offset + side) % 4) * 1.8; return <mesh key={offset} position={[x + (side ? offset * 2 : -offset * 2), height / 2, -4 - offset * 8]} castShadow><boxGeometry args={[2, height, 6.5]} /><meshStandardMaterial color={(segment + offset) % 2 ? "#537a7c" : "#8d5b52"} roughness={0.86} /></mesh>; })}</group>)}
  </group>)}</group>;
}

function DeliveryWorld({ players, sessionId, view, turtleName, turtleVariant }: { players?: DeliveryPlayer[]; sessionId?: string; view: RouteView; turtleName: string; turtleVariant: TurtleVariant }) {
  const player = useRef<Group>(null);
  useFrame((_, delta) => { if (player.current) { player.current.position.x += (LANE_X[view.lane] - player.current.position.x) * Math.min(1, delta * 10); player.current.rotation.z = (LANE_X[view.lane] - player.current.position.x) * -0.08; } });
  return <>
    <color attach="background" args={["#8dccd3"]} /><fog attach="fog" args={["#8dccd3", 38, 78]} /><ambientLight intensity={1.3} /><directionalLight castShadow intensity={2.1} position={[-10, 18, 12]} shadow-mapSize={[1024, 1024]} />
    <MovingDowntown distance={view.distance} />
    {view.items.map((item) => <group key={item.id} position={[LANE_X[item.lane], 0, 5 + (item.y - 82) * 0.65]}><DeliveryItem type={item.type} /></group>)}
    <group ref={player} position={[LANE_X[view.lane], 0, 5]}><DeliveryBoard cargo={view.cargo} /><group position={[0, 0.38, 0]}><TurtleBillboard name={turtleName} scale={0.57} variant={turtleVariant} /></group></group>
    {players?.filter((courier) => courier.sessionId !== sessionId).map((courier) => <group key={courier.sessionId} position={[LANE_X[courier.lane], 0, 5 - (courier.distance - view.distance) * 0.065]}><DeliveryBoard cargo={courier.cargo} /><group position={[0, 1.45, 0]}><mesh><sphereGeometry args={[0.42, 12, 8]} /><meshStandardMaterial color="#78a85f" /></mesh><Html center position={[0, 0.85, 0]} distanceFactor={13}><span className="world3d-nameplate">{courier.name}</span></Html></group></group>)}
  </>;
}

export function ShellExpressGame({ onExit, turtleName, turtleVariant }: ShellExpressGameProps) {
  const multiplayer = useDeliveryMultiplayer();
  const [mode, setMode] = useState<RouteMode>("choose");
  const stateRef = useRef<RouteState>(createRouteState());
  const [view, setView] = useState<RouteView>(() => createRouteView(createRouteState()));
  function startRoute() { setMode("solo"); const nextState = createRouteState("playing"); stateRef.current = nextState; setView(createRouteView(nextState)); }

  useEffect(() => {
    if (mode !== "solo" || view.status !== "playing") return;
    const pressed = new Set<string>(); let previousTime = performance.now(); let lastViewUpdate = 0; let animationFrame = 0;
    function handleKeyDown(event: KeyboardEvent) { const key = event.key.toLowerCase(); if ((key === "arrowleft" || key === "a") && !event.repeat) { event.preventDefault(); stateRef.current.lane = Math.max(0, stateRef.current.lane - 1); } else if ((key === "arrowright" || key === "d") && !event.repeat) { event.preventDefault(); stateRef.current.lane = Math.min(2, stateRef.current.lane + 1); } else if (key === "arrowup" || key === "w" || event.code === "Space") { event.preventDefault(); pressed.add("boost"); } }
    function handleKeyUp(event: KeyboardEvent) { const key = event.key.toLowerCase(); if (key === "arrowup" || key === "w" || event.code === "Space") pressed.delete("boost"); }
    function clearInput() { pressed.clear(); }
    function update(time: number) {
      const state = stateRef.current; const elapsed = Math.min((time - previousTime) / 1000, 0.05); previousTime = time; state.elapsed += elapsed; state.spawnCooldown -= elapsed;
      const isBoosting = pressed.has("boost"); state.distance = Math.min(ROUTE_LENGTH, state.distance + (isBoosting ? 150 : 105) * elapsed);
      if (state.spawnCooldown <= 0) { const id = state.nextItemId; const type = routeSequence[id % routeSequence.length]; state.items.push({ id, lane: (id * 2 + Math.floor(id / 3)) % 3, type, y: -12 }); state.nextItemId += 1; state.spawnCooldown = type === "dropoff" ? 0.82 : 0.58; }
      const remainingItems: RouteItem[] = [];
      for (const item of state.items) { item.y += (isBoosting ? 68 : 52) * elapsed; const hit = item.lane === state.lane && item.y >= 70 && item.y <= 92; if (hit && item.type === "package") { state.cargo = Math.min(3, state.cargo + 1); state.message = state.cargo === 3 ? "Cargo box full" : "Parcel secured"; } else if (hit && item.type === "dropoff") { if (state.cargo > 0) { state.delivered += state.cargo; state.message = `${state.cargo} delivered`; state.cargo = 0; } else state.message = "No parcels to drop"; } else if (hit && (item.type === "barrier" || item.type === "cab" || item.type === "steam")) { state.lives -= 1; state.message = "Route slowed down"; } else if (item.y <= 108) remainingItems.push(item); }
      state.items = remainingItems;
      if (state.lives <= 0 || state.elapsed >= ROUTE_TIME || state.distance >= ROUTE_LENGTH) { state.status = "finished"; setView(createRouteView(state)); return; }
      if (time - lastViewUpdate >= 32) { setView(createRouteView(state)); state.message = ""; lastViewUpdate = time; }
      animationFrame = requestAnimationFrame(update);
    }
    window.addEventListener("keydown", handleKeyDown, { passive: false }); window.addEventListener("keyup", handleKeyUp); window.addEventListener("blur", clearInput); animationFrame = requestAnimationFrame(update);
    return () => { cancelAnimationFrame(animationFrame); window.removeEventListener("keydown", handleKeyDown); window.removeEventListener("keyup", handleKeyUp); window.removeEventListener("blur", clearInput); };
  }, [mode, view.status]);

  const multiplayerPhase = multiplayer.match.phase;
  const multiplayerPlayers = multiplayer.match.players;
  const multiplayerSessionId = multiplayer.sessionId;
  const sendDeliveryInput = multiplayer.sendInput;
  const multiplayerPlayersRef = useRef(multiplayerPlayers);
  useEffect(() => { multiplayerPlayersRef.current = multiplayerPlayers; }, [multiplayerPlayers]);
  useEffect(() => {
    if (mode !== "multiplayer" || multiplayerPhase !== "playing") return;
    let lane = multiplayerPlayersRef.current.find((player) => player.sessionId === multiplayerSessionId)?.lane ?? 1; let boosting = false;
    function send() { sendDeliveryInput(lane, boosting); }
    function handleKeyDown(event: KeyboardEvent) { const key = event.key.toLowerCase(); if (["arrowleft", "arrowright", "a", "d", "arrowup", "w"].includes(key) || event.code === "Space") event.preventDefault(); if (!event.repeat && (key === "arrowleft" || key === "a")) { lane = Math.max(0, lane - 1); send(); } else if (!event.repeat && (key === "arrowright" || key === "d")) { lane = Math.min(2, lane + 1); send(); } if ((key === "arrowup" || key === "w" || event.code === "Space") && !boosting) { boosting = true; send(); } }
    function handleKeyUp(event: KeyboardEvent) { const key = event.key.toLowerCase(); if (key === "arrowup" || key === "w" || event.code === "Space") { boosting = false; send(); } }
    function clearInput() { boosting = false; send(); }
    window.addEventListener("keydown", handleKeyDown, { passive: false }); window.addEventListener("keyup", handleKeyUp); window.addEventListener("blur", clearInput); return () => { window.removeEventListener("keydown", handleKeyDown); window.removeEventListener("keyup", handleKeyUp); window.removeEventListener("blur", clearInput); };
  }, [mode, multiplayerPhase, multiplayerSessionId, sendDeliveryInput]);

  const multiplayerPlayer = multiplayerPlayers.find((player) => player.sessionId === multiplayerSessionId);
  const multiplayerItems: RouteItem[] = multiplayerCourseItems.map((item) => ({ id: item.id, lane: item.lane, type: item.type, y: 82 - (item.distance - (multiplayerPlayer?.distance ?? 0)) * 0.1 })).filter((item) => item.y > -12 && item.y < 108);
  const displayView: RouteView = mode === "multiplayer" ? { cargo: multiplayerPlayer?.cargo ?? 0, delivered: multiplayerPlayer?.delivered ?? 0, distance: multiplayerPlayer?.distance ?? 0, elapsed: multiplayer.match.elapsed, items: multiplayerItems, lane: multiplayerPlayer?.lane ?? 1, lives: multiplayerPlayer?.lives ?? 3, message: "", status: multiplayerPhase === "finished" ? "finished" : multiplayerPhase === "playing" ? "playing" : "ready" } : view;
  const timeLeft = mode === "multiplayer" ? multiplayer.match.timeLeft : ROUTE_TIME - displayView.elapsed;
  const routeIsPlaying = displayView.status === "playing";
  const isUrgent = routeIsPlaying && timeLeft <= 15;
  const nextAction = displayView.cargo > 0
    ? `Deliver ${displayView.cargo} parcel${displayView.cargo === 1 ? "" : "s"} in a green zone`
    : "Pick up a yellow parcel";
  const success = displayView.delivered >= DELIVERY_TARGET;
  useGameReward("shell-express", displayView.status === "finished" && success);
  return <main className={`shell-express-stage${isUrgent ? " is-urgent" : ""}`} data-testid="shell-express-game" tabIndex={-1}>
    <div className="shell-express-canvas" aria-label="3D downtown delivery route"><Canvas camera={{ fov: 47, position: [0, 6.4, 13.5] }} dpr={[1, 1.5]} shadows="basic" gl={{ antialias: true, powerPreference: "high-performance" }}><Suspense fallback={null}><DeliveryWorld players={mode === "multiplayer" ? multiplayerPlayers : undefined} sessionId={multiplayerSessionId} view={displayView} turtleName={turtleName} turtleVariant={turtleVariant} /></Suspense></Canvas></div>
    <header className="shell-express-title"><p>FiDi Courier Dispatch</p><h1>Shell Express</h1></header><button type="button" className="fidi-game-exit" onClick={() => { multiplayer.disconnect(); onExit(); }}><span aria-hidden="true">&larr;</span>FiDi</button>
    <section className="shell-express-hud" aria-label="Delivery route status"><div className="shell-express-clock"><small>{isUrgent ? "Hurry!" : "Time"}</small><strong>{formatTime(timeLeft)}</strong></div><div><small>Delivered</small><strong>{displayView.delivered} / {DELIVERY_TARGET}</strong></div><div><small>On board</small><strong>{displayView.cargo} / 3</strong></div><div><small>Helmets</small><strong>{displayView.lives} / 3</strong></div></section>
    {routeIsPlaying ? <aside className={`delivery-objective${displayView.cargo > 0 ? " has-cargo" : ""}`} aria-live="polite"><small>Do this now</small><strong>{nextAction}</strong><span>{displayView.cargo > 0 ? "Aim for the glowing green circle" : "Aim for the glowing yellow box"}</span></aside> : null}
    <div className="shell-express-progress" aria-hidden="true"><span style={{ width: `${Math.min(100, displayView.distance / ROUTE_LENGTH * 100)}%` }} /></div>
    {displayView.message ? <strong className="shell-express-message" role="status">{displayView.message}</strong> : null}
    {mode === "choose" ? <section className="fidi-game-overlay delivery-intro"><p>60-second delivery rush</p><h2>Pick up. Drop off. Move!</h2><div className="delivery-how-to"><span><b>1</b><strong>Grab yellow parcels</strong><small>Move into their lane to load them automatically.</small></span><span><b>2</b><strong>Find a green circle</strong><small>Ride through it to deliver everything on board.</small></span><span><b>3</b><strong>Deliver 6 before time runs out</strong><small>Avoid traffic. Hold W, ↑, or Space to boost.</small></span></div><small className="delivery-steer-hint">A / D or ← / → switches lanes</small><div><button type="button" onClick={startRoute}>Start 60-second rush</button><button type="button" onClick={() => { setMode("multiplayer"); void multiplayer.connect(); }}>Multiplayer</button></div></section> : null}
    {mode === "solo" && view.status === "finished" ? <section className="fidi-game-overlay is-finished"><p>{success ? "Route complete" : "Dispatch closed"}</p><h2>{view.delivered} parcels delivered</h2><span>{success ? "Every package made it through the downtown rush." : "Dispatch needed six deliveries. Take the next route cleaner and faster."}</span><div><button type="button" onClick={startRoute}>Run it again</button><button type="button" onClick={onExit}>Return to FiDi</button></div></section> : null}
    {mode === "multiplayer" && (multiplayer.status === "connecting" || multiplayer.status === "offline") ? <section className="fidi-game-overlay"><p>Online dispatch</p><h2>{multiplayer.status === "connecting" ? "Joining route…" : "Server unavailable"}</h2><span>The multiplayer server may need a moment to wake up.</span><div>{multiplayer.status === "offline" ? <button type="button" onClick={() => void multiplayer.connect()}>Try again</button> : null}<button type="button" onClick={() => { multiplayer.disconnect(); setMode("choose"); }}>Back</button></div></section> : null}
    {mode === "multiplayer" && multiplayer.status === "live" && multiplayerPhase === "lobby" ? <section className="fidi-game-overlay delivery-lobby"><p>Online dispatch</p><h2>Courier lineup</h2><span>At least two couriers must join and ready up.</span><div className="delivery-lobby-roster">{multiplayerPlayers.map((player) => <div key={player.sessionId}><strong>{player.name}</strong><small>{player.ready ? "Ready" : "Waiting"}</small></div>)}</div><button type="button" onClick={multiplayer.ready}>Ready up</button></section> : null}
    {mode === "multiplayer" && multiplayerPhase === "countdown" ? <section className="delivery-countdown"><small>Dispatch in</small><strong>{Math.max(1, Math.ceil(multiplayer.match.countdownLeft))}</strong></section> : null}
    {mode === "multiplayer" && multiplayerPhase === "finished" ? <section className="fidi-game-overlay is-finished"><p>Online route complete</p><h2>{displayView.delivered} parcels · {multiplayerPlayer?.place || multiplayerPlayers.length} place</h2><span>Couriers are ranked by deliveries, helmets, then distance.</span><div><button type="button" onClick={multiplayer.rematch}>Run it again</button><button type="button" onClick={() => { multiplayer.disconnect(); onExit(); }}>Return to FiDi</button></div></section> : null}
  </main>;
}

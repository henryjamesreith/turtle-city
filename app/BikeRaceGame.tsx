"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import type { TurtleVariant } from "@/lib/turtles";
import { useBikeRaceMultiplayer, type BikeRacePlayer } from "@/lib/multiplayer/useBikeRaceMultiplayer";
import { TurtleBillboard } from "./world3d/TurtleBillboard";
import { useGameReward } from "./GameEconomy";

type Props = { onExit: () => void; turtleName: string; turtleVariant: TurtleVariant };
type Mode = "choose" | "solo" | "multiplayer";
type Item = "" | "turbo" | "shell" | "peel";
type RacerState = { distance: number; item: Item; offset: number; speed: number };
type SoloState = RacerState & { boost: number; bumpTime: number; elapsed: number; message: string; messageTime: number; opponents: RacerState[]; collected: Set<number>; driftCharge: number; driftWasHeld: boolean; finished: boolean; hitBoosts: Set<number>; lateralSpeed: number; steerVisual: number };
type Controls = { brake: boolean; drift: boolean; steer: number; throttle: boolean };

const COURSE_LENGTH = 18000;
const LAP_LENGTH = COURSE_LENGTH / 3;
const ROAD_HALF_WIDTH = 6.5;
const MAX_SPEED = 300;
const BOOST_SPEED = 390;
const OFF_ROAD_SPEED = 155;
const MAX_COURSE_OFFSET = 3.4;
const ITEM_DISTANCES = [900, 2100, 3300, 4800, 5700, 6900, 8100, 9300, 10800, 11700, 12900, 14100, 15300, 16800, 17700] as const;
const BOOST_PADS = [{ distance: 1700, lane: -0.32 }, { distance: 4550, lane: 0.32 }, { distance: 7700, lane: -0.32 }, { distance: 10550, lane: 0.32 }, { distance: 13700, lane: -0.32 }, { distance: 16550, lane: 0.32 }] as const;
const ITEM_NAMES: Record<string, string> = { turbo: "Turbo Soda", shell: "River Shell", peel: "Slippy Peel" };
const KART_COLORS = ["#4e82dc", "#ef9c39", "#9c5cc2", "#49a778", "#ef6b73", "#f2c84b"];

const COURSE = new THREE.CatmullRomCurve3([
  new THREE.Vector3(0, 0.3, 95), new THREE.Vector3(-45, 0.8, 92),
  new THREE.Vector3(-88, 2, 75), new THREE.Vector3(-118, 4, 45),
  new THREE.Vector3(-108, 6, 13), new THREE.Vector3(-128, 8, -20),
  new THREE.Vector3(-110, 10, -53), new THREE.Vector3(-78, 11, -82),
  new THREE.Vector3(-35, 9, -101), new THREE.Vector3(10, 7, -105),
  new THREE.Vector3(55, 5, -92), new THREE.Vector3(98, 3, -65),
  new THREE.Vector3(125, 0.3, -25), new THREE.Vector3(130, 1, 20),
  new THREE.Vector3(110, 3, 58), new THREE.Vector3(70, 4, 85),
  new THREE.Vector3(30, 3, 96),
], true, "chordal");
const COURSE_CLEARANCE_POINTS = COURSE.getSpacedPoints(180);
const MINIMAP_POINTS = COURSE.getSpacedPoints(100).map((point) => ({ x: 7 + ((point.x + 140) / 280) * 96, y: 7 + ((point.z + 115) / 230) * 96 }));
const MINIMAP_PATH = MINIMAP_POINTS.map((point, index) => `${index === 0 ? "M" : "L"}${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(" ") + " Z";

function clearOfTrack(x: number, z: number) {
  return COURSE_CLEARANCE_POINTS.reduce((closest, point) => Math.min(closest, Math.hypot(point.x - x, point.z - z)), Number.POSITIVE_INFINITY);
}

function initialSolo(): SoloState {
  return { boost: 100, bumpTime: 0, collected: new Set(), distance: 0, driftCharge: 0, driftWasHeld: false, elapsed: 0, finished: false, hitBoosts: new Set(), item: "", message: "", messageTime: 0, offset: 0, opponents: [
    { distance: -22, item: "", offset: -0.5, speed: 0 },
    { distance: -42, item: "", offset: 0.48, speed: 0 },
    { distance: -65, item: "", offset: 0.04, speed: 0 },
    { distance: -88, item: "", offset: -0.22, speed: 0 },
    { distance: -110, item: "", offset: 0.68, speed: 0 },
  ], lateralSpeed: 0, speed: 0, steerVisual: 0 };
}

function formatTime(seconds: number) { return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}.${Math.floor((seconds % 1) * 10)}`; }
function ordinal(value: number) { return value === 1 ? "1st" : value === 2 ? "2nd" : value === 3 ? "3rd" : `${value}th`; }
function lapNumber(distance: number) { return Math.min(3, Math.max(1, Math.floor(Math.max(0, distance) / LAP_LENGTH) + 1)); }
function courseT(distance: number) { return THREE.MathUtils.euclideanModulo(distance, LAP_LENGTH) / LAP_LENGTH; }
function minimapPoint(distance: number) { const point = COURSE.getPointAt(courseT(distance)); return { x: 7 + ((point.x + 140) / 280) * 96, y: 7 + ((point.z + 115) / 230) * 96 }; }
function courseFrame(distance: number, offset: number) {
  const t = courseT(distance);
  const point = COURSE.getPointAt(t);
  const tangent = COURSE.getTangentAt(t).normalize();
  const side = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
  return { point: point.add(side.multiplyScalar(offset * ROAD_HALF_WIDTH * 0.82)), tangent };
}

function stripGeometry(width: number, height = 0, segments = 720) {
  const geometry = new THREE.BufferGeometry();
  const vertices: number[] = [], indices: number[] = [], uvs: number[] = [];
  for (let index = 0; index <= segments; index += 1) {
    const t = index / segments, point = COURSE.getPointAt(t), tangent = COURSE.getTangentAt(t).normalize();
    const side = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
    for (const direction of [-1, 1]) {
      const vertex = point.clone().add(side.clone().multiplyScalar(width * direction));
      vertices.push(vertex.x, vertex.y + height, vertex.z); uvs.push(direction < 0 ? 0 : 1, t * 20);
    }
    if (index < segments) { const base = index * 2; indices.push(base, base + 2, base + 1, base + 1, base + 2, base + 3); }
  }
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices); geometry.computeVertexNormals(); return geometry;
}

function Track() {
  const runoff = useMemo(() => stripGeometry(ROAD_HALF_WIDTH * 3.05, -0.08), []);
  const road = useMemo(() => stripGeometry(ROAD_HALF_WIDTH), []);
  const shoulder = useMemo(() => stripGeometry(ROAD_HALF_WIDTH + 0.65, -0.04), []);
  const center = useMemo(() => stripGeometry(0.07, 0.035), []);
  const start = courseFrame(0, 0);
  const startYaw = Math.atan2(start.tangent.x, start.tangent.z);
  const barrierLength = COURSE.getLength() / 144 + 0.3;
  const barriers = Array.from({ length: 144 }, (_, index) => ({ distance: (index / 144) * LAP_LENGTH, index, t: index / 144 })).filter(({ t }) => (t > 0.08 && t < 0.26) || (t > 0.48 && t < 0.68) || (t > 0.79 && t < 0.91));
  return <group>
    <mesh geometry={runoff} receiveShadow><meshStandardMaterial color="#68a75e" roughness={1} side={THREE.DoubleSide} /></mesh>
    <mesh geometry={shoulder} receiveShadow><meshStandardMaterial color="#e65d49" roughness={0.9} side={THREE.DoubleSide} /></mesh>
    <mesh geometry={road} receiveShadow><meshStandardMaterial color="#33434a" roughness={0.92} side={THREE.DoubleSide} /></mesh>
    <mesh geometry={center}><meshStandardMaterial color="#f6e9b7" emissive="#f6e9b7" emissiveIntensity={0.12} side={THREE.DoubleSide} /></mesh>
    <group position={start.point} rotation-y={startYaw}>
      {Array.from({ length: 12 }, (_, i) => <mesh key={i} position={[(i - 5.5) * 1.08, 0.05, 0]} rotation-x={-Math.PI / 2}><planeGeometry args={[1.08, 1.1]} /><meshBasicMaterial color={i % 2 ? "#f7f0d3" : "#172d31"} /></mesh>)}
      <group position={[0, 0, 1.4]}>{[-6.45, 6.45].map((x) => <mesh key={x} position={[x, 2.7, 0]}><boxGeometry args={[0.25, 5.4, 0.25]} /><meshStandardMaterial color="#173238" /></mesh>)}<mesh position={[0, 5.25, 0]}><boxGeometry args={[13.2, 0.75, 0.3]} /><meshStandardMaterial color="#f2c54e" /></mesh><Html center position={[0, 5.27, 0.2]} distanceFactor={10}><b className="kart-start-sign">SHELL CIRCUIT</b></Html></group>
    </group>
    {barriers.flatMap(({ distance, index }) => [-1, 1].map((side) => { const frame = courseFrame(distance, side * 1.27), yaw = Math.atan2(frame.tangent.x, frame.tangent.z); return <group key={`${index}-${side}`} position={frame.point} rotation-y={yaw}><mesh position={[0, 0.35, 0]} castShadow><boxGeometry args={[0.34, 0.68, barrierLength]} /><meshStandardMaterial color={(index + (side > 0 ? 1 : 0)) % 2 ? "#f6edcf" : "#e95f4a"} roughness={0.78} /></mesh></group>; }))}
  </group>;
}

function KartModel({ color, drifting, player, steer = 0, turtleName, turtleVariant }: { color: string; drifting?: boolean; player?: boolean; steer?: number; turtleName?: string; turtleVariant?: TurtleVariant }) {
  return <group rotation-y={steer * 0.16} rotation-z={drifting ? -steer * 0.1 : -steer * 0.035}>
    <mesh position={[0, 0.42, 0]} castShadow><boxGeometry args={[1.28, 0.34, 1.65]} /><meshStandardMaterial color={color} metalness={0.12} roughness={0.42} /></mesh>
    <mesh position={[0, 0.66, 0.18]} castShadow><boxGeometry args={[0.86, 0.38, 0.78]} /><meshStandardMaterial color="#f4cd52" /></mesh>
    <mesh position={[0, 0.46, -0.92]}><boxGeometry args={[1.48, 0.12, 0.24]} /><meshStandardMaterial color="#183239" /></mesh>
    {[-0.69, 0.69].flatMap((x) => [-0.52, 0.52].map((z) => <mesh key={`${x}-${z}`} position={[x, 0.29, z]} rotation-z={Math.PI / 2} castShadow><cylinderGeometry args={[0.23, 0.23, 0.18, 14]} /><meshStandardMaterial color="#101d20" roughness={0.85} /></mesh>))}
    <mesh position={[0, 0.48, 0.9]}><boxGeometry args={[0.62, 0.16, 0.08]} /><meshStandardMaterial color="#ff6b42" emissive="#d83925" emissiveIntensity={0.8} /></mesh>
    {player && turtleVariant ? <group position={[0, 0.58, 0.08]}><TurtleBillboard name={turtleName} scale={0.52} variant={turtleVariant} /></group> : <group position={[0, 1.02, 0.06]}><mesh castShadow><sphereGeometry args={[0.38, 16, 12]} /><meshStandardMaterial color="#8db765" /></mesh></group>}
    {drifting ? <>{[-0.64, 0.64].map((x) => <mesh key={x} position={[x, 0.08, 0.92]}><sphereGeometry args={[0.12, 8, 6]} /><meshBasicMaterial color="#61d7ff" /></mesh>)}</> : null}
  </group>;
}

function CourseKart({ color, distance, drifting, name, offset, player, steer, turtleName, turtleVariant }: { color: string; distance: number; drifting?: boolean; name?: string; offset: number; player?: boolean; steer?: number; turtleName?: string; turtleVariant?: TurtleVariant }) {
  const frame = courseFrame(distance, offset);
  const yaw = Math.atan2(frame.tangent.x, frame.tangent.z);
  return <group position={frame.point} rotation-y={yaw}><KartModel color={color} drifting={drifting} player={player} steer={steer} turtleName={turtleName} turtleVariant={turtleVariant} />{name ? <Html center position={[0, 2.1, 0]} distanceFactor={12}><span className="world3d-nameplate">{name}</span></Html> : null}</group>;
}

function ItemBox({ distance, lane }: { distance: number; lane: number }) {
  const frame = courseFrame(distance, lane), yaw = Math.atan2(frame.tangent.x, frame.tangent.z);
  const ref = useRef<THREE.Group>(null); useFrame((_, delta) => { if (ref.current) ref.current.rotation.y += delta * 1.8; });
  return <group position={frame.point} rotation-y={yaw}><group ref={ref} position={[0, 0.75, 0]}><mesh castShadow><boxGeometry args={[0.78, 0.78, 0.78]} /><meshStandardMaterial color="#60e5f0" emissive="#258bcc" emissiveIntensity={1.1} transparent opacity={0.86} /></mesh><Html center distanceFactor={11}><b className="kart-question">?</b></Html></group></group>;
}

function BoostPad({ distance, lane }: { distance: number; lane: number }) {
  const frame = courseFrame(distance, lane), yaw = Math.atan2(frame.tangent.x, frame.tangent.z);
  return <group position={frame.point} rotation-y={yaw}>
    <mesh position={[0, 0.055, 0]} receiveShadow><boxGeometry args={[2.25, 0.08, 1.55]} /><meshStandardMaterial color="#25c9e8" emissive="#168ad0" emissiveIntensity={1.2} /></mesh>
    {[-0.55, 0, 0.55].map((x) => <mesh key={x} position={[x, 0.11, -0.04]} rotation-x={-Math.PI / 2}><planeGeometry args={[0.3, 1.05]} /><meshBasicMaterial color="#f8ed9e" /></mesh>)}
  </group>;
}

function Scenery() {
  const buildings = useMemo(() => Array.from({ length: 54 }, (_, i) => ({ x: -245 + (i % 9) * 10, z: -138 + Math.floor(i / 9) * 52, h: 14 + (i * 13) % 43, color: i % 3 === 0 ? "#715f80" : i % 3 === 1 ? "#557786" : "#9b715b" })).filter((building) => clearOfTrack(building.x, building.z) > 24), []);
  const trees = useMemo(() => Array.from({ length: 72 }, (_, i) => ({ x: -80 + (i * 47) % 270, z: -135 + (i * 61) % 270 })).filter((tree) => clearOfTrack(tree.x, tree.z) > 22), []);
  return <>
    <mesh position={[-190, -1.2, -5]} receiveShadow><boxGeometry args={[128, 1.8, 310]} /><meshStandardMaterial color="#499db1" roughness={0.3} /></mesh>
    <mesh position={[5, -1.45, -5]} receiveShadow><boxGeometry args={[390, 2.4, 330]} /><meshStandardMaterial color="#68a75e" roughness={1} /></mesh>
    {buildings.map((b, i) => <mesh key={i} position={[b.x, b.h / 2 - 0.2, b.z]} castShadow receiveShadow><boxGeometry args={[9 + i % 5, b.h, 11]} /><meshStandardMaterial color={b.color} roughness={0.88} /></mesh>)}
    {trees.map((tree, i) => <group key={i} position={[tree.x, 0, tree.z]}><mesh position={[0, 2.2, 0]}><cylinderGeometry args={[0.19, 0.26, 4.4, 8]} /><meshStandardMaterial color="#5a4936" /></mesh><mesh position={[0, 4.9, 0]}><sphereGeometry args={[2.2, 10, 8]} /><meshStandardMaterial color={i % 2 ? "#4f8d55" : "#66a85c"} /></mesh></group>)}
  </>;
}

function ChaseCamera({ distance, offset }: RacerState) {
  const { camera } = useThree();
  useFrame((_, delta) => {
    const frame = courseFrame(distance, offset), look = frame.point.clone().add(frame.tangent.clone().multiplyScalar(6));
    const target = frame.point.clone().add(frame.tangent.clone().multiplyScalar(-7.5)).add(new THREE.Vector3(0, 4.5, 0));
    camera.position.lerp(target, 1 - Math.exp(-delta * 7));
    camera.lookAt(look.add(new THREE.Vector3(0, 1.1, 0)));
  }); return null;
}

function BikeRaceWorld({ race, racers, sessionId, turtleName, turtleVariant }: { race: SoloState; racers?: BikeRacePlayer[]; sessionId?: string; turtleName: string; turtleVariant: TurtleVariant }) {
  return <><color attach="background" args={["#87cce6"]} /><fog attach="fog" args={["#9bd6e8", 120, 320]} /><hemisphereLight intensity={1.25} groundColor="#507452" /><directionalLight castShadow intensity={2.4} position={[-80, 110, 60]} shadow-mapSize={[2048, 2048]} /><Scenery /><Track />
    {ITEM_DISTANCES.map((distance, index) => <ItemBox key={distance} distance={distance} lane={((index % 3) - 1) * 0.42} />)}
    {BOOST_PADS.slice(0, 2).map((pad) => <BoostPad key={pad.distance} distance={pad.distance} lane={pad.lane} />)}
    <CourseKart color="#e65443" distance={race.distance} drifting={race.driftWasHeld} offset={race.offset} player steer={race.steerVisual} turtleName={turtleName} turtleVariant={turtleVariant} />
    {racers ? racers.filter((racer) => racer.sessionId !== sessionId).map((racer, index) => <CourseKart key={racer.sessionId} color={KART_COLORS[index % KART_COLORS.length]} distance={racer.distance} drifting={racer.drifting} name={racer.name} offset={racer.lane} steer={racer.steer} />) : race.opponents.map((opponent, index) => <CourseKart key={index} color={KART_COLORS[index]} distance={opponent.distance} name={["Moss", "Skipper", "Sprout", "Marina", "Pebble"][index]} offset={opponent.offset} />)}
    <ChaseCamera distance={race.distance} item={race.item} offset={race.offset} speed={race.speed} />
  </>;
}

export function BikeRaceGame({ onExit, turtleName, turtleVariant }: Props) {
  const multiplayer = useBikeRaceMultiplayer();
  const [mode, setMode] = useState<Mode>("choose");
  const [status, setStatus] = useState<"ready" | "racing" | "finished">("ready");
  const stateRef = useRef<SoloState>(initialSolo());
  const [race, setRace] = useState<SoloState>(() => initialSolo());
  const [finishPlace, setFinishPlace] = useState(1);
  const [soloCountdown, setSoloCountdown] = useState(0);
  const playersRef = useRef(multiplayer.match.players);
  useEffect(() => { playersRef.current = multiplayer.match.players; }, [multiplayer.match.players]);

  function startSolo() { stateRef.current = initialSolo(); setRace(initialSolo()); setFinishPlace(1); setSoloCountdown(3); setMode("solo"); setStatus("racing"); }

  useEffect(() => {
    if (mode !== "solo" || status !== "racing") return;
    const keys = new Set<string>(); let previous = performance.now(), frame = 0, lastPaint = 0; const startAt = previous + 3000;
    const controls = (): Controls => ({ brake: keys.has("arrowdown") || keys.has("s"), drift: keys.has(" "), steer: (keys.has("arrowright") || keys.has("d") ? 1 : 0) - (keys.has("arrowleft") || keys.has("a") ? 1 : 0), throttle: keys.has("arrowup") || keys.has("w") });
    function fireItem() { const state = stateRef.current, item = state.item; if (!item) return; state.item = ""; state.message = ITEM_NAMES[item]; state.messageTime = 1.2; if (item === "turbo") state.speed = BOOST_SPEED; else { const candidates = state.opponents.filter((opponent) => item === "shell" ? opponent.distance > state.distance : opponent.distance < state.distance).sort((a, b) => item === "shell" ? a.distance - b.distance : b.distance - a.distance); if (candidates[0]) candidates[0].speed *= item === "shell" ? 0.25 : 0.48; } }
    function keyDown(event: KeyboardEvent) { const key = event.key.toLowerCase(); if (["arrowup", "arrowdown", "arrowleft", "arrowright", "w", "a", "s", "d", " ", "e"].includes(key)) event.preventDefault(); keys.add(key); if (!event.repeat && key === "e") fireItem(); }
    function keyUp(event: KeyboardEvent) { keys.delete(event.key.toLowerCase()); }
    function tick(now: number) {
      if (now < startAt) { setSoloCountdown(Math.max(1, Math.ceil((startAt - now) / 1000))); previous = now; frame = requestAnimationFrame(tick); return; }
      setSoloCountdown(0);
      const delta = Math.min(0.05, (now - previous) / 1000), state = stateRef.current, input = controls(); previous = now; state.elapsed += delta;
      state.messageTime = Math.max(0, state.messageTime - delta); if (state.messageTime === 0) state.message = "";
      state.bumpTime = Math.max(0, state.bumpTime - delta);
      const offRoad = Math.abs(state.offset) > 1.08;
      const targetSpeed = offRoad ? OFF_ROAD_SPEED : MAX_SPEED;
      state.steerVisual += (input.steer - state.steerVisual) * Math.min(1, delta * 12);
      if (input.throttle) {
        if (state.speed < targetSpeed) state.speed = Math.min(targetSpeed, state.speed + (offRoad ? 105 : 235) * delta);
      } else state.speed = Math.max(0, state.speed - (offRoad ? 220 : 85) * delta);
      if (input.brake) state.speed = Math.max(0, state.speed - 430 * delta);
      if (state.speed > targetSpeed) state.speed = Math.max(targetSpeed, state.speed - (offRoad ? 180 : 80) * delta);
      const speedGrip = Math.min(1, state.speed / 190), steeringForce = (input.drift ? 5.2 : 3.75) * speedGrip;
      state.lateralSpeed += input.steer * steeringForce * delta;
      state.lateralSpeed *= Math.exp(-delta * (offRoad ? 2.5 : input.drift ? 2.2 : 4.1));
      state.lateralSpeed = THREE.MathUtils.clamp(state.lateralSpeed, -1.65, 1.65);
      state.offset += state.lateralSpeed * delta;
      if (Math.abs(state.offset) > MAX_COURSE_OFFSET) { state.offset = Math.sign(state.offset) * MAX_COURSE_OFFSET; state.lateralSpeed = -Math.sign(state.offset) * Math.min(0.18, Math.abs(state.lateralSpeed) * 0.2); }
      if (input.drift && Math.abs(input.steer) > 0.2 && state.speed > 190 && !offRoad) state.driftCharge = Math.min(1.5, state.driftCharge + delta);
      if (state.driftWasHeld && !input.drift && state.driftCharge > 0.42) { state.speed = Math.min(BOOST_SPEED, state.speed + 55 + state.driftCharge * 55); state.message = "Mini turbo!"; state.messageTime = 1; state.driftCharge = 0; }
      state.driftWasHeld = input.drift; state.distance = Math.min(COURSE_LENGTH, state.distance + state.speed * delta);
      state.opponents.forEach((opponent, index) => { const target = 245 + index * 6 + Math.sin(state.elapsed * 0.8 + index) * 12; opponent.speed += (target - opponent.speed) * delta * 1.7; opponent.distance = Math.min(COURSE_LENGTH, opponent.distance + opponent.speed * delta); opponent.offset = Math.sin(state.elapsed * 0.45 + index * 1.6) * 0.62; });
      if (state.bumpTime === 0 && state.speed > 100) { const bumped = state.opponents.find((opponent) => opponent.speed > 100 && Math.abs(opponent.distance - state.distance) < 15 && Math.abs(opponent.offset - state.offset) < 0.27); if (bumped) { const direction = state.offset <= bumped.offset ? -1 : 1; state.speed *= 0.72; state.lateralSpeed += direction * 0.42; state.bumpTime = 0.45; state.message = "Bump!"; state.messageTime = 0.65; } }
      BOOST_PADS.forEach((pad, index) => { if (!state.hitBoosts.has(index) && Math.abs(pad.distance - state.distance) < 38 && Math.abs(pad.lane - state.offset) < 0.38) { state.hitBoosts.add(index); state.speed = BOOST_SPEED; state.message = "Boost pad!"; state.messageTime = 0.9; } });
      ITEM_DISTANCES.forEach((distance, index) => { const lane = ((index % 3) - 1) * 0.42; if (!state.collected.has(index) && Math.abs(distance - state.distance) < 38 && Math.abs(lane - state.offset) < 0.34) { state.collected.add(index); if (!state.item) state.item = (["turbo", "shell", "peel"] as Item[])[(index + state.opponents.filter((opponent) => opponent.distance > state.distance).length) % 3]; state.message = "Item ready!"; state.messageTime = 1.1; } });
      if (now - lastPaint > 32) { setRace({ ...state, collected: new Set(state.collected), hitBoosts: new Set(state.hitBoosts), opponents: state.opponents.map((opponent) => ({ ...opponent })) }); lastPaint = now; }
      if (state.distance >= COURSE_LENGTH) { setFinishPlace(1 + state.opponents.filter((opponent) => opponent.distance >= COURSE_LENGTH).length); state.finished = true; setRace({ ...state }); setStatus("finished"); return; }
      frame = requestAnimationFrame(tick);
    }
    const clearKeys = () => keys.clear();
    window.addEventListener("keydown", keyDown, { passive: false }); window.addEventListener("keyup", keyUp); window.addEventListener("blur", clearKeys); frame = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(frame); window.removeEventListener("keydown", keyDown); window.removeEventListener("keyup", keyUp); window.removeEventListener("blur", clearKeys); };
  }, [mode, status]);

  const sendInput = multiplayer.sendInput, fireOnlineItem = multiplayer.useItem, sessionId = multiplayer.sessionId, phase = multiplayer.match.phase;
  useEffect(() => {
    if (mode !== "multiplayer" || phase !== "playing") return;
    const keys = new Set<string>();
    const send = () => sendInput((keys.has("arrowright") || keys.has("d") ? 1 : 0) - (keys.has("arrowleft") || keys.has("a") ? 1 : 0), keys.has("arrowup") || keys.has("w"), keys.has("arrowdown") || keys.has("s"), keys.has(" "));
    function keyDown(event: KeyboardEvent) { const key = event.key.toLowerCase(); if (["arrowup", "arrowdown", "arrowleft", "arrowright", "w", "a", "s", "d", " ", "e"].includes(key)) event.preventDefault(); keys.add(key); send(); if (!event.repeat && key === "e") fireOnlineItem(); }
    function keyUp(event: KeyboardEvent) { keys.delete(event.key.toLowerCase()); send(); }
    window.addEventListener("keydown", keyDown, { passive: false }); window.addEventListener("keyup", keyUp);
    return () => { window.removeEventListener("keydown", keyDown); window.removeEventListener("keyup", keyUp); };
  }, [fireOnlineItem, mode, phase, sendInput, sessionId]);

  const me = multiplayer.match.players.find((player) => player.sessionId === sessionId);
  const shown: SoloState = mode === "multiplayer" ? { ...initialSolo(), boost: me?.boost ?? 100, distance: me?.distance ?? 0, driftWasHeld: me?.drifting ?? false, elapsed: multiplayer.match.elapsed, item: (me?.item ?? "") as Item, offset: me?.lane ?? 0, speed: me?.speed ?? 0, steerVisual: me?.steer ?? 0 } : race;
  const racePlace = mode === "multiplayer" ? 1 + multiplayer.match.players.filter((player) => player.distance > shown.distance).length : 1 + shown.opponents.filter((opponent) => opponent.distance > shown.distance).length;
  const mapPlayer = minimapPoint(shown.distance);
  const mapOpponents = mode === "multiplayer" ? multiplayer.match.players.filter((player) => player.sessionId !== sessionId).map((player) => minimapPoint(player.distance)) : shown.opponents.map((opponent) => minimapPoint(opponent.distance));
  useGameReward("bike-race", (mode === "solo" && status === "finished" && finishPlace === 1) || (mode === "multiplayer" && phase === "finished" && me?.place === 1));

  return <main className="bike-race-stage kart-race-stage" data-testid="bike-race-game">
    <div className="bike-race-canvas" aria-label="3D West Side Highway kart racing circuit"><Canvas camera={{ fov: 56, position: [0, 6, 8] }} dpr={[1, 1.5]} shadows="basic" gl={{ antialias: true, powerPreference: "high-performance" }}><Suspense fallback={null}><BikeRaceWorld race={shown} racers={mode === "multiplayer" ? multiplayer.match.players : undefined} sessionId={sessionId} turtleName={turtleName} turtleVariant={turtleVariant} /></Suspense></Canvas></div>
    <header className="bike-race-header"><p>West Side Highway</p><h1>Shell Circuit</h1></header>
    <button type="button" className="bike-race-exit" onClick={() => { multiplayer.disconnect(); onExit(); }}>← West Village</button>
    <section className="bike-race-hud kart-race-hud"><div><small>Place</small><strong>{ordinal(racePlace)}</strong></div><div><small>Lap</small><strong>{lapNumber(shown.distance)}/3</strong></div><div><small>Speed</small><strong>{Math.round(shown.speed * 0.22)} <em>mph</em></strong></div><div><small>Time</small><strong>{formatTime(shown.elapsed)}</strong></div></section>
    <aside className="kart-minimap" aria-label="Course minimap"><svg viewBox="0 0 110 110"><path d={MINIMAP_PATH} />{mapOpponents.map((point, index) => <circle key={index} className="rival" cx={point.x} cy={point.y} r="3" />)}<circle className="player" cx={mapPlayer.x} cy={mapPlayer.y} r="4" /></svg></aside>
    <aside className={`kart-item ${shown.item ? "has-item" : ""}`}><small>ITEM · E</small><strong>{shown.item ? ITEM_NAMES[shown.item] : "—"}</strong></aside>
    {mode === "solo" && shown.driftCharge > 0.05 ? <div className="kart-drift-meter"><small>Mini-turbo</small><span><i style={{ width: `${Math.min(100, (shown.driftCharge / 1.5) * 100)}%` }} /></span></div> : null}
    {shown.message ? <strong className="bike-race-message">{shown.message}</strong> : null}
    {mode === "solo" && status === "racing" && soloCountdown === 0 && shown.speed < 1 ? <div className="kart-control-coach">Hold <kbd>W</kbd> or <kbd>↑</kbd> to accelerate</div> : null}
    {mode === "solo" && soloCountdown > 0 ? <section className="bike-race-countdown"><small>Lights out in</small><strong>{soloCountdown}</strong></section> : null}
    {mode === "choose" ? <section className="bike-race-overlay kart-intro"><p>West Side starting grid</p><h2>Shell Circuit</h2><span>Three fast laps around a real waterfront circuit. W/↑ full throttle · S/↓ brake · A/D steer · hold Space through a corner to drift · E fires your item.</span><div><button type="button" onClick={startSolo}>Grand Prix</button><button type="button" onClick={() => { setMode("multiplayer"); void multiplayer.connect(); }}>Multiplayer</button></div></section> : null}
    {mode === "solo" && status === "finished" ? <section className="bike-race-overlay is-finished"><p>Checkered flag</p><h2>{ordinal(finishPlace)} place</h2><span>Three laps in {formatTime(race.elapsed)}.</span><div><button type="button" onClick={startSolo}>Race again</button><button type="button" onClick={onExit}>Return to West Village</button></div></section> : null}
    {mode === "multiplayer" && (multiplayer.status === "connecting" || multiplayer.status === "offline") ? <section className="bike-race-overlay"><p>Online Shell Circuit</p><h2>{multiplayer.status === "connecting" ? "Joining grid…" : "Server unavailable"}</h2><span>{multiplayer.status === "offline" ? "The race server may be waking up. Try once more in a moment." : "Loading the waterfront circuit."}</span><div>{multiplayer.status === "offline" ? <button type="button" onClick={() => void multiplayer.connect()}>Try again</button> : null}<button type="button" onClick={() => { multiplayer.disconnect(); setMode("choose"); }}>Back</button></div></section> : null}
    {mode === "multiplayer" && multiplayer.status === "live" && phase === "lobby" ? <section className="bike-race-overlay bike-race-lobby"><p>Online Shell Circuit</p><h2>Starting grid</h2><span>Two or more racers must ready up.</span><div className="bike-race-roster">{multiplayer.match.players.map((player) => <div key={player.sessionId}><strong>{player.name}</strong><small>{player.ready ? "Ready" : "Waiting"}</small></div>)}</div><button type="button" onClick={multiplayer.ready}>Ready up</button></section> : null}
    {mode === "multiplayer" && phase === "countdown" ? <section className="bike-race-countdown"><small>Lights out in</small><strong>{Math.max(1, Math.ceil(multiplayer.match.countdownLeft))}</strong></section> : null}
    {mode === "multiplayer" && phase === "finished" ? <section className="bike-race-overlay is-finished"><p>Checkered flag</p><h2>{ordinal(me?.place || multiplayer.match.players.length)} place</h2><span>Three laps in {formatTime(multiplayer.match.elapsed)}.</span><div><button type="button" onClick={multiplayer.rematch}>Race again</button><button type="button" onClick={() => { multiplayer.disconnect(); onExit(); }}>Return to West Village</button></div></section> : null}
  </main>;
}

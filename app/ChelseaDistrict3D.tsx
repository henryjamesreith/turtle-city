"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Html, Instance, Instances, Sky } from "@react-three/drei";
import { Suspense, useEffect, useRef, useState, type MutableRefObject } from "react";
import * as THREE from "three";
import { DistrictLiveStatus } from "./MultiplayerDistrictPlayers";
import { TurtleBillboard } from "./world3d/TurtleBillboard";
import { Skateboard, SKATEBOARD_SPEED } from "./world3d/Skateboard";
import { SubwayEntrance } from "./world3d/SubwayEntrance";
import {
  moveWithCollisions,
  updateCharacterMotion,
  type WorldCollider,
} from "./world3d/movement";
import { useDistrictMultiplayer } from "@/lib/multiplayer/useDistrictMultiplayer";
import { isTurtleVariant, type TurtleVariant } from "@/lib/turtles";

type ChelseaSpawn = "apartment" | "pressure-washing" | "subway";
type InteractionId = ChelseaSpawn | "skate-shop";

type ChelseaDistrict3DProps = {
  onEnterApartment: () => void;
  onEnterPressureWashing: () => void;
  onEnterSubway: () => void;
  spawn: ChelseaSpawn;
  turtleName: string;
  turtleVariant: TurtleVariant;
  hasSkateboard: boolean;
  onClaimSkateboard: () => Promise<void>;
};

const WORLD_HALF_WIDTH = 30;
const WORLD_MIN_Z = -11;
const WORLD_MAX_Z = 11;
const chelseaColliders: WorldCollider[] = [
  { minX: 18.7, maxX: 23.3, minZ: 7.15, maxZ: 11.2 },
  { minX: -10, maxX: -6, minZ: 2.55, maxZ: 4.85 },
  { minX: 11.5, maxX: 12.5, minZ: -7.55, maxZ: -6.3 },
];

const spawnPositions: Record<ChelseaSpawn, THREE.Vector3Tuple> = {
  apartment: [6, 0, -4],
  "pressure-washing": [-17, 0, -4],
  subway: [20, 0, 6.4],
};

const interactions = [
  { id: "pressure-washing", position: [-18, 0, -8], radius: 3.4 },
  { id: "apartment", position: [6, 0, -8], radius: 3.4 },
  { id: "subway", position: [21, 0, 8.3], radius: 3.6 },
  { id: "skate-shop", position: [23, 0, -8], radius: 3.4 },
] as const;

function toNetworkX(x: number) {
  return 0.04 + ((x + WORLD_HALF_WIDTH) / (WORLD_HALF_WIDTH * 2)) * 0.92;
}

function toNetworkY(z: number) {
  return 0.58 + ((z - WORLD_MIN_Z) / (WORLD_MAX_Z - WORLD_MIN_Z)) * 0.3;
}

function fromNetworkX(x: number) {
  return ((x - 0.04) / 0.92) * (WORLD_HALF_WIDTH * 2) - WORLD_HALF_WIDTH;
}

function fromNetworkY(y: number) {
  return WORLD_MIN_Z + ((y - 0.58) / 0.3) * (WORLD_MAX_Z - WORLD_MIN_Z);
}

function Street() {
  return (
    <group>
      <mesh position-y={-0.08} receiveShadow>
        <boxGeometry args={[66, 0.16, 24]} />
        <meshStandardMaterial color="#34393b" roughness={0.97} />
      </mesh>
      <mesh position={[0, 0.09, -8.8]} receiveShadow>
        <boxGeometry args={[66, 0.18, 5.6]} />
        <meshStandardMaterial color="#bab9af" roughness={0.95} />
      </mesh>
      <mesh position={[0, 0.09, 9.1]} receiveShadow>
        <boxGeometry args={[66, 0.18, 5.2]} />
        <meshStandardMaterial color="#b5b5ad" roughness={0.95} />
      </mesh>
      {Array.from({ length: 12 }, (_, index) => (
        <mesh key={index} position={[-28 + index * 5.1, 0.015, 2.3]}>
          <boxGeometry args={[2.8, 0.03, 0.18]} />
          <meshBasicMaterial color="#e9dfb8" />
        </mesh>
      ))}
      {[-26, 26].flatMap((x) =>
        [-5.4, -3.8, -2.2, -0.6, 1, 2.6, 4.2, 5.8].map((z) => (
          <mesh key={`${x}-${z}`} position={[x, 0.02, z]}>
            <boxGeometry args={[2.5, 0.035, 0.48]} />
            <meshBasicMaterial color="#f1ead5" />
          </mesh>
        )),
      )}
    </group>
  );
}

function Building({
  color,
  height,
  label,
  width,
  x,
}: {
  color: string;
  height: number;
  label: string;
  width: number;
  x: number;
}) {
  const columns = Math.max(2, Math.floor(width / 2.3));
  const rows = Math.max(3, Math.floor(height / 2.5));

  return (
    <group position={[x, 0, -13]}>
      <mesh position-y={height / 2} castShadow receiveShadow>
        <boxGeometry args={[width, height, 8]} />
        <meshStandardMaterial color={color} roughness={0.88} />
      </mesh>
      <Instances limit={columns * rows}>
        <planeGeometry args={[0.85, 1.25]} />
        <meshStandardMaterial color="#9bbbc0" emissive="#132326" emissiveIntensity={0.28} roughness={0.4} />
        {Array.from({ length: columns * rows }, (_, index) => {
          const column = index % columns;
          const row = Math.floor(index / columns);
          return <Instance key={index} color={(index + row) % 5 === 0 ? "#f3cc77" : "#9bbbc0"} position={[-width / 2 + 1.2 + column * ((width - 2.4) / Math.max(1, columns - 1)), 3.8 + row * 2.15, 4.015]} />;
        })}
      </Instances>
      <mesh position={[0, 1.25, 4.18]} castShadow>
        <boxGeometry args={[width * 0.82, 2.5, 0.45]} />
        <meshStandardMaterial color="#244f42" roughness={0.78} />
      </mesh>
      <Html center position={[0, 1.3, 4.45]} distanceFactor={18}>
        <span className="world3d-store-sign">{label}</span>
      </Html>
    </group>
  );
}

function ChelseaEntrances({ nearby }: { nearby: InteractionId | null }) {
  const apartmentIsNear = nearby === "apartment";
  const washIsNear = nearby === "pressure-washing";
  return (
    <group>
      {/* West 22: recessed brass-and-glass double doors with a lit canopy */}
      <group position={[6, 0, -8.78]}>
        <mesh position={[0, 2.15, 0]} castShadow>
          <boxGeometry args={[4.3, 4.3, 0.4]} />
          <meshStandardMaterial color="#243b32" roughness={0.78} />
        </mesh>
        {[-0.78, 0.78].map((x) => (
          <group key={x} position-x={x}>
            <mesh position={[0, 1.75, 0.24]} castShadow>
              <boxGeometry args={[1.36, 3.28, 0.18]} />
              <meshStandardMaterial color="#8e6525" metalness={0.42} roughness={0.45} emissive={apartmentIsNear ? "#60400e" : "#000000"} emissiveIntensity={0.45} />
            </mesh>
            <mesh position={[0, 2.05, 0.35]}>
              <boxGeometry args={[0.94, 1.78, 0.07]} />
              <meshStandardMaterial color="#7fa5a2" metalness={0.08} roughness={0.28} />
            </mesh>
            <mesh position={[x < 0 ? 0.48 : -0.48, 1.5, 0.4]}>
              <sphereGeometry args={[0.08, 12, 8]} />
              <meshStandardMaterial color="#ffe09a" metalness={0.65} roughness={0.26} />
            </mesh>
          </group>
        ))}
        <mesh position={[0, 4.28, 0.85]} castShadow>
          <boxGeometry args={[4.7, 0.24, 1.9]} />
          <meshStandardMaterial color="#1e5a43" roughness={0.76} />
        </mesh>
        <Html center position={[0, 4.65, 0.36]} distanceFactor={13}>
          <span className="world3d-door-plaque">WEST 22 · RESIDENTS</span>
        </Html>
        {[-2.08, 2.08].map((x) => (
          <mesh key={x} position={[x, 3.05, 0.5]}>
            <sphereGeometry args={[0.16, 12, 9]} />
            <meshStandardMaterial color="#ffe8a5" emissive="#c68b34" emissiveIntensity={apartmentIsNear ? 2 : 0.8} />
          </mesh>
        ))}
      </group>

      {/* Lettuce & Co.: a recognizable service entrance for the wash job */}
      <group position={[-18, 0, -8.78]}>
        <mesh position={[0, 1.72, 0.08]} castShadow>
          <boxGeometry args={[5.2, 3.45, 0.28]} />
          <meshStandardMaterial color="#b9d2bf" roughness={0.78} emissive={washIsNear ? "#315c40" : "#000000"} emissiveIntensity={0.28} />
        </mesh>
        {Array.from({ length: 6 }, (_, index) => (
          <mesh key={index} position={[0, 0.35 + index * 0.55, 0.25]}>
            <boxGeometry args={[4.65, 0.08, 0.05]} />
            <meshStandardMaterial color="#668d73" roughness={0.8} />
          </mesh>
        ))}
        <mesh position={[0, 3.72, 0.75]} rotation-x={-0.12} castShadow>
          <boxGeometry args={[5.8, 0.22, 1.45]} />
          <meshStandardMaterial color="#e2c55b" roughness={0.72} />
        </mesh>
        <Html center position={[0, 4.12, 0.28]} distanceFactor={13}>
          <span className="world3d-wash-door">WASH CREW · EMPLOYEES</span>
        </Html>
        <mesh position={[2.18, 1.45, 0.38]}>
          <torusGeometry args={[0.38, 0.08, 9, 24]} />
          <meshStandardMaterial color="#2e8d67" roughness={0.6} />
        </mesh>
      </group>

      {/* Shell Repair still reads as a real business even before it is enterable. */}
      <group position={[23, 0, -8.78]}>
        <mesh position-y={1.65} castShadow><boxGeometry args={[2.2, 3.3, 0.28]} /><meshStandardMaterial color="#293f3e" roughness={0.72} /></mesh>
        <mesh position={[0, 1.92, 0.2]}><boxGeometry args={[1.42, 1.8, 0.08]} /><meshStandardMaterial color="#71989c" roughness={0.3} /></mesh>
        <mesh position={[0.7, 1.34, 0.28]}><sphereGeometry args={[0.08, 10, 8]} /><meshStandardMaterial color="#e9c76e" metalness={0.65} /></mesh>
        <mesh position={[0, 3.48, 0.2]}><boxGeometry args={[2.65, 0.2, 0.75]} /><meshStandardMaterial color="#d0a13e" roughness={0.75} /></mesh>
        <pointLight position={[0, 3.15, 0.8]} color="#ffd995" intensity={3.5} distance={3.5} />
      </group>
    </group>
  );
}

function StreetDetails() {
  return (
    <group>
      {[-22, -3, 16].map((x) => (
        <group key={x} position={[x, 0, -6.8]}>
          <mesh position-y={2.25} castShadow>
            <cylinderGeometry args={[0.07, 0.12, 4.5, 8]} />
            <meshStandardMaterial color="#263331" />
          </mesh>
          <mesh position-y={4.48}>
            <sphereGeometry args={[0.28, 12, 9]} />
            <meshStandardMaterial color="#ffe9a8" emissive="#b47a2b" emissiveIntensity={1.1} />
          </mesh>
        </group>
      ))}
      <group position={[-8, 0.62, 3.7]}>
        <mesh castShadow><boxGeometry args={[3.5, 0.82, 1.55]} /><meshStandardMaterial color="#eeb51d" /></mesh>
        <mesh position={[0.25, 0.68, 0]} castShadow><boxGeometry args={[1.7, 0.72, 1.35]} /><meshStandardMaterial color="#dba719" /></mesh>
      </group>
      <mesh position={[12, 0.6, -6.9]} castShadow>
        <cylinderGeometry args={[0.25, 0.32, 1.2, 12]} />
        <meshStandardMaterial color="#d84f36" roughness={0.82} />
      </mesh>
    </group>
  );
}

function InteractionMarkers({ nearby }: { nearby: InteractionId | null }) {
  return (
    <>
      {interactions.map((interaction) => (
        <mesh
          key={interaction.id}
          position={[interaction.position[0], 0.14, interaction.position[2]]}
          rotation-x={-Math.PI / 2}
        >
          <ringGeometry args={[1.15, 1.32, 40]} />
          <meshBasicMaterial
            color={nearby === interaction.id ? "#fff2a3" : "#78c889"}
            opacity={nearby === interaction.id ? 1 : 0.55}
            transparent
          />
        </mesh>
      ))}
    </>
  );
}

type PlayerControllerProps = {
  hasSkateboard: boolean;
  onClaimSkateboard: () => Promise<void>;
  onInteractionChange: (interaction: InteractionId | null) => void;
  onEnterApartment: () => void;
  onEnterPressureWashing: () => void;
  onEnterSubway: () => void;
  sendMovement: (movement: { facing: "left" | "right"; riding?: boolean; x: number; y: number }) => void;
  spawn: ChelseaSpawn;
  turtleName: string;
  turtleVariant: TurtleVariant;
};

function PlayerController(props: PlayerControllerProps) {
  const {
    hasSkateboard,
    onClaimSkateboard,
    onInteractionChange,
    onEnterApartment,
    onEnterPressureWashing,
    onEnterSubway,
    sendMovement,
    spawn,
    turtleName,
    turtleVariant,
  } = props;
  const playerRef = useRef<THREE.Group>(null);
  const visualRef = useRef<THREE.Group>(null);
  const keys = useRef(new Set<string>());
  const activeInteraction = useRef<InteractionId | null>(null);
  const yaw = useRef(0);
  const distance = useRef(18);
  const dragging = useRef(false);
  const lastPointerX = useRef(0);
  const lastNetworkUpdate = useRef(0);
  const facing = useRef<"left" | "right">("right");
  const velocity = useRef(new THREE.Vector3());
  const [riding, setRiding] = useState(hasSkateboard);
  const { camera, gl } = useThree();

  useEffect(() => {
    function keyDown(event: KeyboardEvent) {
      const key = event.key.toLowerCase();
      if (["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(key)) {
        event.preventDefault();
        keys.current.add(key);
      } else if (key === "r" && hasSkateboard && !event.repeat) {
        setRiding((current) => !current);
      } else if (key === "enter" && !event.repeat) {
        if (activeInteraction.current === "apartment") onEnterApartment();
        if (activeInteraction.current === "pressure-washing") onEnterPressureWashing();
        if (activeInteraction.current === "subway") onEnterSubway();
        if (activeInteraction.current === "skate-shop" && !hasSkateboard) void onClaimSkateboard();
      }
    }
    function keyUp(event: KeyboardEvent) { keys.current.delete(event.key.toLowerCase()); }
    function pointerDown(event: PointerEvent) {
      dragging.current = true;
      lastPointerX.current = event.clientX;
      gl.domElement.setPointerCapture(event.pointerId);
    }
    function pointerMove(event: PointerEvent) {
      if (!dragging.current) return;
      yaw.current -= (event.clientX - lastPointerX.current) * 0.007;
      lastPointerX.current = event.clientX;
    }
    function pointerUp() { dragging.current = false; }
    function wheel(event: WheelEvent) {
      event.preventDefault();
      distance.current = THREE.MathUtils.clamp(distance.current + event.deltaY * 0.012, 9, 22);
    }
    function blur() { keys.current.clear(); }

    window.addEventListener("keydown", keyDown, { passive: false });
    window.addEventListener("keyup", keyUp);
    window.addEventListener("blur", blur);
    gl.domElement.addEventListener("pointerdown", pointerDown);
    gl.domElement.addEventListener("pointermove", pointerMove);
    gl.domElement.addEventListener("pointerup", pointerUp);
    gl.domElement.addEventListener("wheel", wheel, { passive: false });
    return () => {
      window.removeEventListener("keydown", keyDown);
      window.removeEventListener("keyup", keyUp);
      window.removeEventListener("blur", blur);
      gl.domElement.removeEventListener("pointerdown", pointerDown);
      gl.domElement.removeEventListener("pointermove", pointerMove);
      gl.domElement.removeEventListener("pointerup", pointerUp);
      gl.domElement.removeEventListener("wheel", wheel);
    };
  }, [gl, hasSkateboard, onClaimSkateboard, onEnterApartment, onEnterPressureWashing, onEnterSubway]);

  useFrame((state, delta) => {
    const player = playerRef.current;
    const visual = visualRef.current;
    if (!player || !visual) return;
    const horizontal = Number(keys.current.has("d") || keys.current.has("arrowright")) - Number(keys.current.has("a") || keys.current.has("arrowleft"));
    const forward = Number(keys.current.has("w") || keys.current.has("arrowup")) - Number(keys.current.has("s") || keys.current.has("arrowdown"));
    const moving = horizontal !== 0 || forward !== 0;

    const targetVelocity = moving
      ? new THREE.Vector3(horizontal, 0, -forward)
        .normalize()
        .applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw.current)
        .multiplyScalar(riding ? SKATEBOARD_SPEED : 4.2)
      : new THREE.Vector3();
    velocity.current.lerp(targetVelocity, 1 - Math.exp(-delta * (moving ? 10 : 8)));
    moveWithCollisions(
      player.position,
      velocity.current.clone().multiplyScalar(Math.min(delta, 0.05)),
      { minX: -WORLD_HALF_WIDTH + 1, maxX: WORLD_HALF_WIDTH - 1, minZ: -7.7, maxZ: WORLD_MAX_Z },
      chelseaColliders,
    );
    if (Math.abs(velocity.current.x) > 0.05) facing.current = velocity.current.x < 0 ? "left" : "right";

    const closest = interactions
      .map((interaction) => ({
        interaction,
        distance: Math.hypot(player.position.x - interaction.position[0], player.position.z - interaction.position[2]),
      }))
      .filter(({ interaction, distance: nextDistance }) => nextDistance <= interaction.radius)
      .sort((a, b) => a.distance - b.distance)[0]?.interaction.id ?? null;
    if (closest !== activeInteraction.current) {
      activeInteraction.current = closest;
      onInteractionChange(closest);
    }

    updateCharacterMotion(visual, state.clock.elapsedTime, velocity.current.length(), delta);

    const target = player.position.clone().add(new THREE.Vector3(0, 1.35, 0));
    const desired = target.clone().add(new THREE.Vector3(Math.sin(yaw.current) * distance.current, distance.current * 0.52, Math.cos(yaw.current) * distance.current));
    camera.position.lerp(desired, 1 - Math.exp(-delta * 6));
    camera.lookAt(target);

    if (state.clock.elapsedTime * 1000 - lastNetworkUpdate.current >= 65) {
      sendMovement({ facing: facing.current, riding, x: toNetworkX(player.position.x), y: toNetworkY(player.position.z) });
      lastNetworkUpdate.current = state.clock.elapsedTime * 1000;
    }
  });

  return (
    <group ref={playerRef} position={spawnPositions[spawn]}>
      <group ref={visualRef}>
        {riding ? <Skateboard /> : null}
        <group position-y={riding ? 0.43 : 0}>
          <TurtleBillboard name={turtleName} variant={turtleVariant} />
        </group>
      </group>
    </group>
  );
}

function RemotePlayers({
  remotePlayers,
  remoteTargetsRef,
}: {
  remotePlayers: Array<{ sessionId: string; turtleName: string; variant: string }>;
  remoteTargetsRef: MutableRefObject<Map<string, { currentX: number; currentY: number; facing: string; riding: boolean; x: number; y: number }>>;
}) {
  const refs = useRef(new Map<string, THREE.Group>());
  useFrame((_, delta) => {
    refs.current.forEach((group, sessionId) => {
      const target = remoteTargetsRef.current.get(sessionId);
      if (!target) return;
      const smoothing = 1 - Math.exp(-delta * 10);
      target.currentX += (target.x - target.currentX) * smoothing;
      target.currentY += (target.y - target.currentY) * smoothing;
      group.position.x = fromNetworkX(target.currentX);
      group.position.z = fromNetworkY(target.currentY);
      const skateboard = group.getObjectByName("remote-skateboard");
      const turtle = group.getObjectByName("remote-turtle");
      if (skateboard) skateboard.visible = target.riding;
      if (turtle) turtle.position.y = target.riding ? 0.43 : 0;
    });
  });

  return remotePlayers.map((player) => (
    <group
      key={player.sessionId}
      ref={(group) => {
        if (group) refs.current.set(player.sessionId, group);
        else refs.current.delete(player.sessionId);
      }}
    >
      <group name="remote-skateboard" visible={false}>
        <Skateboard />
      </group>
      <group name="remote-turtle">
        <TurtleBillboard
          name={player.turtleName}
          scale={0.84}
          variant={isTurtleVariant(player.variant) ? player.variant : "clover"}
        />
      </group>
    </group>
  ));
}

function ChelseaWorld({
  nearby,
  onInteractionChange,
  props,
  remotePlayers,
  remoteTargetsRef,
  sendMovement,
}: {
  nearby: InteractionId | null;
  onInteractionChange: (interaction: InteractionId | null) => void;
  props: ChelseaDistrict3DProps;
  remotePlayers: Array<{ sessionId: string; turtleName: string; variant: string }>;
  remoteTargetsRef: MutableRefObject<Map<string, { currentX: number; currentY: number; facing: string; riding: boolean; x: number; y: number }>>;
  sendMovement: (movement: { facing: "left" | "right"; riding?: boolean; x: number; y: number }) => void;
}) {
  return (
    <>
      <color attach="background" args={["#c4d9e4"]} />
      <fog attach="fog" args={["#c4d9e4", 38, 78]} />
      <Sky sunPosition={[8, 11, 5]} turbidity={8} rayleigh={2.2} />
      <hemisphereLight args={["#e9f4f7", "#505653", 1.65]} />
      <directionalLight castShadow intensity={2.15} position={[12, 18, 8]} shadow-mapSize={[1024, 1024]} shadow-camera-left={-36} shadow-camera-right={36} shadow-camera-top={28} shadow-camera-bottom={-28} />
      <Street />
      <Building x={-19} width={18} height={16} color="#9b654f" label="LETTUCE & CO. · WASH CREW" />
      <Building x={4} width={20} height={23} color="#a4866e" label="WEST 22 APARTMENTS" />
      <Building x={23} width={14} height={18} color="#71888c" label="SHELL & ROLL · SKATE SHOP" />
      <StreetDetails />
      <ChelseaEntrances nearby={nearby} />
      <SubwayEntrance nearby={nearby === "subway"} position={[21, 9.45]} rotationY={Math.PI / 2} stationName="23 ST" />
      <InteractionMarkers nearby={nearby} />
      <PlayerController
        {...props}
        onInteractionChange={onInteractionChange}
        sendMovement={sendMovement}
      />
      <RemotePlayers remotePlayers={remotePlayers} remoteTargetsRef={remoteTargetsRef} />
    </>
  );
}

export function ChelseaDistrict3D(props: ChelseaDistrict3DProps) {
  const [nearby, setNearby] = useState<InteractionId | null>(null);
  const { remotePlayers, remoteTargetsRef, sendMovement, status } = useDistrictMultiplayer("chelsea", props.spawn);

  const prompt = nearby === "apartment"
    ? { title: "West 22 Apartments", detail: "Your apartment · 4B", action: props.onEnterApartment, button: "Enter" }
    : nearby === "pressure-washing"
      ? { title: "Chelsea Wash Crew", detail: "Pressure wash Lettuce & Co.", action: props.onEnterPressureWashing, button: "Start job" }
      : nearby === "subway"
        ? { title: "West 23 Street", detail: "Enter the Turtle City subway.", action: props.onEnterSubway, button: "Enter station" }
        : nearby === "skate-shop"
          ? props.hasSkateboard
            ? { title: "Shell & Roll", detail: "Your skateboard is ready. Press R to ride or walk.", action: () => undefined, button: "Owned" }
            : { title: "Shell & Roll", detail: "Starter skateboard · on the house", action: props.onClaimSkateboard, button: "Pick up free" }
        : null;

  return (
    <main className="chelsea3d-stage" data-testid="chelsea-district-3d">
      <Canvas camera={{ fov: 48, near: 0.1, far: 120, position: [0, 7, 16] }} dpr={[1, 1.5]} gl={{ antialias: true, powerPreference: "high-performance" }} performance={{ min: 0.6 }} shadows="basic">
        <Suspense fallback={null}>
          <ChelseaWorld
            nearby={nearby}
            onInteractionChange={setNearby}
            props={props}
            remotePlayers={remotePlayers}
            remoteTargetsRef={remoteTargetsRef}
            sendMovement={sendMovement}
          />
        </Suspense>
      </Canvas>
      <header className="chelsea3d-title"><p>Turtle City</p><h1>Chelsea</h1></header>
      <DistrictLiveStatus remotePlayerCount={remotePlayers.length} status={status} />
      <aside className="chelsea3d-controls"><strong>Explore Chelsea</strong><span>WASD to move{props.hasSkateboard ? " · R to ride / walk" : " · Find a faster way to travel"}</span><span>Drag camera · Scroll to zoom</span></aside>
      {prompt ? <aside className="chelsea3d-prompt"><div><strong>{prompt.title}</strong><small>{prompt.detail}</small></div><button type="button" onClick={prompt.action}>{prompt.button}</button></aside> : null}
      <style jsx global>{`
        .chelsea3d-stage { position: relative; width: 100vw; height: 100vh; overflow: hidden; background: #c4d9e4; }
        .chelsea3d-stage canvas { display: block; cursor: grab; touch-action: none; }
        .chelsea3d-stage canvas:active { cursor: grabbing; }
        .chelsea3d-title { position: absolute; top: 26px; left: 30px; color: #18392a; text-shadow: 0 2px rgba(255,255,255,.45); pointer-events: none; }
        .chelsea3d-title p { margin: 0 0 2px; font: 850 12px/1.2 system-ui; letter-spacing: .16em; text-transform: uppercase; }
        .chelsea3d-title h1 { margin: 0; font: 900 clamp(30px,4vw,48px)/1 system-ui; letter-spacing: -.045em; }
        .chelsea3d-controls { position: absolute; left: 30px; bottom: 28px; display: grid; gap: 3px; padding: 13px 16px; color: #efffe9; background: rgba(20,52,35,.84); border: 1px solid rgba(255,255,255,.22); border-radius: 13px; backdrop-filter: blur(10px); font: 650 12px/1.4 system-ui; }
        .chelsea3d-controls strong { font-size: 14px; }.chelsea3d-controls span { opacity: .78; }
        .chelsea3d-prompt { position: absolute; left: 50%; bottom: 28px; transform: translateX(-50%); display: flex; align-items: center; gap: 24px; min-width: 330px; padding: 13px 14px 13px 17px; color: white; background: rgba(20,52,35,.9); border: 1px solid rgba(255,255,255,.25); border-radius: 14px; backdrop-filter: blur(12px); }
        .chelsea3d-prompt div { display: grid; gap: 3px; flex: 1; }.chelsea3d-prompt strong { font: 800 14px/1.1 system-ui; }.chelsea3d-prompt small { opacity: .75; font: 600 11px/1.2 system-ui; }
        .chelsea3d-prompt button { padding: 10px 13px; color: #173b29; background: #fff2a3; border: 0; border-radius: 9px; cursor: pointer; font: 800 12px/1 system-ui; }
        .world3d-nameplate { display: inline-block; white-space: nowrap; padding: 4px 7px; color: white; background: rgba(19,43,30,.78); border-radius: 7px; font: 800 10px/1 system-ui; pointer-events: none; }
        .world3d-store-sign { white-space: nowrap; color: #fff3c4; font: 900 11px/1 system-ui; letter-spacing: .08em; text-shadow: 0 1px #17372c; pointer-events: none; }
        .world3d-subway-badge { color: white; font: 950 11px/1 system-ui; pointer-events: none; }
        .world3d-subway-name { white-space: nowrap; color: white; font: 900 10px/1 system-ui; letter-spacing: .08em; pointer-events: none; }
        .world3d-door-plaque, .world3d-wash-door { white-space: nowrap; padding: 4px 7px; color: #fff1b6; background: #17392d; border: 1px solid rgba(255,232,158,.4); border-radius: 4px; font: 900 9px/1 system-ui; letter-spacing: .08em; pointer-events: none; }
        .world3d-wash-door { color: #17392d; background: #f1da78; border-color: #8d772c; }
      `}</style>
    </main>
  );
}

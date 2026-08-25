"use client";

import { useEffect, useRef, useState } from "react";
import {
  DistrictLiveStatus,
  RemoteDistrictPlayers,
} from "./MultiplayerDistrictPlayers";
import { useDistrictMultiplayer } from "@/lib/multiplayer/useDistrictMultiplayer";

type ChelseaDistrictProps = {
  spawn: "apartment" | "pressure-washing" | "subway";
  onEnterApartment: () => void;
  onEnterPressureWashing: () => void;
  onEnterSubway: () => void;
  turtleName: string;
};

const movementKeys = new Set([
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "w",
  "a",
  "s",
  "d",
  "W",
  "A",
  "S",
  "D",
]);

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), maximum);
}

function cameraOffset(
  viewportSize: number,
  worldSize: number,
  focusPosition: number,
) {
  if (worldSize <= viewportSize) {
    return (viewportSize - worldSize) * 0.5;
  }

  return clamp(
    viewportSize * 0.5 - focusPosition,
    viewportSize - worldSize,
    0,
  );
}

export function ChelseaDistrict({
  spawn,
  onEnterApartment,
  onEnterPressureWashing,
  onEnterSubway,
  turtleName,
}: ChelseaDistrictProps) {
  const worldRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<HTMLDivElement>(null);
  const remotePlayerRefs = useRef(new Map<string, HTMLDivElement>());
  const [nearBuilding, setNearBuilding] = useState(false);
  const [nearPressureWashing, setNearPressureWashing] = useState(false);
  const [nearSubway, setNearSubway] = useState(false);
  const {
    remotePlayers,
    remoteTargetsRef,
    sendMovement,
    status: multiplayerStatus,
  } = useDistrictMultiplayer("chelsea", spawn);

  useEffect(() => {
    const pressed = new Set<string>();
    const position = { x: 0, y: 0 };
    const camera = { x: 0, y: 0 };
    let initialized = false;
    let nearEntrance = false;
    let nearWashCrew = false;
    let nearSubwayEntrance = false;
    let previousTime = performance.now();
    let lastNetworkUpdate = 0;
    let facing: "left" | "right" = "left";
    let animationFrame = 0;

    function handleKeyDown(event: KeyboardEvent) {
      if (
        event.target instanceof HTMLElement &&
        (event.target.isContentEditable ||
          event.target.tagName === "INPUT" ||
          event.target.tagName === "TEXTAREA" ||
          event.target.tagName === "SELECT")
      ) {
        return;
      }

      if (event.key === "Enter" && nearWashCrew && !event.repeat) {
        event.preventDefault();
        onEnterPressureWashing();
      } else if (event.key === "Enter" && nearEntrance && !event.repeat) {
        event.preventDefault();
        onEnterApartment();
      } else if (
        event.key === "Enter" &&
        nearSubwayEntrance &&
        !event.repeat
      ) {
        event.preventDefault();
        onEnterSubway();
      } else if (movementKeys.has(event.key)) {
        event.preventDefault();
        pressed.add(event.key.toLowerCase());
      } else if (event.key === "Shift") {
        pressed.add("shift");
      }
    }

    function handleKeyUp(event: KeyboardEvent) {
      pressed.delete(event.key.toLowerCase());
    }

    function clearInput() {
      pressed.clear();
    }

    function update(time: number) {
      const world = worldRef.current;
      const player = playerRef.current;

      if (!world || !player) {
        animationFrame = requestAnimationFrame(update);
        return;
      }

      const worldWidth = world.offsetWidth;
      const worldHeight = world.offsetHeight;

      if (!initialized) {
        position.x =
          spawn === "pressure-washing"
            ? worldWidth * 0.2 + 140
            : spawn === "subway"
              ? worldWidth * 0.86
            : worldWidth * 0.5 + 210;
        position.y = worldHeight * 0.72;
        camera.x = cameraOffset(window.innerWidth, worldWidth, position.x);
        camera.y = cameraOffset(window.innerHeight, worldHeight, position.y);
        initialized = true;
      }

      const elapsed = Math.min((time - previousTime) / 1000, 0.05);
      previousTime = time;
      const horizontal =
        Number(pressed.has("arrowright") || pressed.has("d")) -
        Number(pressed.has("arrowleft") || pressed.has("a"));
      const vertical =
        Number(pressed.has("arrowdown") || pressed.has("s")) -
        Number(pressed.has("arrowup") || pressed.has("w"));
      const magnitude = Math.hypot(horizontal, vertical) || 1;
      const speed = pressed.has("shift") ? 620 : 360;

      position.x = clamp(
        position.x + (horizontal / magnitude) * speed * elapsed,
        110,
        worldWidth - 110,
      );
      position.y = clamp(
        position.y + (vertical / magnitude) * speed * elapsed,
        worldHeight * 0.58,
        worldHeight * 0.88,
      );

      const entranceX = worldWidth * 0.5;
      const entranceY = worldHeight * 0.68;
      const pressureEntranceX = worldWidth * 0.2;
      const pressureEntranceY = worldHeight * 0.68;
      const subwayEntranceX = worldWidth * 0.86;
      const subwayEntranceY = worldHeight * 0.68;
      const isNearApartment =
        Math.hypot(position.x - entranceX, position.y - entranceY) < 175;
      const isNearPressureWashing =
        Math.hypot(
          position.x - pressureEntranceX,
          position.y - pressureEntranceY,
        ) < 175;
      const isNearSubway =
        Math.hypot(
          position.x - subwayEntranceX,
          position.y - subwayEntranceY,
        ) < 175;

      nearEntrance = isNearApartment;
      nearWashCrew = isNearPressureWashing;
      nearSubwayEntrance = isNearSubway;
      setNearBuilding((current) =>
        current === isNearApartment ? current : isNearApartment,
      );
      setNearPressureWashing((current) =>
        current === isNearPressureWashing
          ? current
          : isNearPressureWashing,
      );
      setNearSubway((current) =>
        current === isNearSubway ? current : isNearSubway,
      );

      const targetX = cameraOffset(window.innerWidth, worldWidth, position.x);
      const targetY = cameraOffset(window.innerHeight, worldHeight, position.y);
      const smoothing = Math.min(1, elapsed * 6);
      camera.x += (targetX - camera.x) * smoothing;
      camera.y += (targetY - camera.y) * smoothing;

      if (horizontal < 0) {
        facing = "left";
        player.dataset.facing = "left";
      } else if (horizontal > 0) {
        facing = "right";
        player.dataset.facing = "right";
      }

      player.style.transform = `translate3d(${position.x - 55}px, ${
        position.y - 124
      }px, 0)`;

      if (time - lastNetworkUpdate >= 65) {
        sendMovement({
          facing,
          x: position.x / worldWidth,
          y: position.y / worldHeight,
        });
        lastNetworkUpdate = time;
      }

      remotePlayerRefs.current.forEach((remotePlayer, sessionId) => {
        const target = remoteTargetsRef.current.get(sessionId);
        if (!target) {
          return;
        }

        const remoteSmoothing = Math.min(1, elapsed * 10);
        target.currentX += (target.x - target.currentX) * remoteSmoothing;
        target.currentY += (target.y - target.currentY) * remoteSmoothing;
        remotePlayer.dataset.facing = target.facing;
        remotePlayer.style.transform = `translate3d(${
          target.currentX * worldWidth - 55
        }px, ${target.currentY * worldHeight - 124}px, 0)`;
      });

      world.style.transform = `translate3d(${camera.x}px, ${camera.y}px, 0)`;
      animationFrame = requestAnimationFrame(update);
    }

    window.addEventListener("keydown", handleKeyDown, { passive: false });
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", clearInput);
    animationFrame = requestAnimationFrame(update);

    return () => {
      cancelAnimationFrame(animationFrame);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", clearInput);
    };
  }, [
    onEnterApartment,
    onEnterPressureWashing,
    onEnterSubway,
    remoteTargetsRef,
    sendMovement,
    spawn,
  ]);

  return (
    <main className="chelsea-stage" data-testid="chelsea-district">
      <header className="chelsea-title">
        <p>Turtle City</p>
        <h1>Chelsea</h1>
      </header>

      <DistrictLiveStatus
        remotePlayerCount={remotePlayers.length}
        status={multiplayerStatus}
      />

      <p className="sr-only">
        Move with the arrow keys or W, A, S, and D. Hold Shift to run. Press
        Enter near the apartment building to go home or near the Wash Crew
        entrance to pressure wash the neighboring facade. Enter the subway from
        the stairway at the east end of the block.
      </p>

      <section className="chelsea-viewport" aria-label="Chelsea street">
        <div className="chelsea-world" ref={worldRef}>
          <div className="chelsea-skyline" aria-hidden="true" />

          <section
            className="chelsea-building chelsea-building-west"
            aria-label="Lettuce and Company pressure-washing job"
          >
            <div className="chelsea-building-sign">LETTUCE &amp; CO.</div>
            <div className="chelsea-store-window" aria-hidden="true" />
            <div className="chelsea-store-awning" aria-hidden="true" />
            <div className="chelsea-wash-grime" aria-hidden="true">
              <span />
              <span />
              <span />
            </div>
            <button
              type="button"
              className="chelsea-pressure-marker"
              onClick={onEnterPressureWashing}
            >
              <strong>Wash Crew</strong>
              <small>Pressure-washing job</small>
            </button>
          </section>

          <section
            className="chelsea-apartment-building"
            aria-label="West 22 Apartments"
          >
            <div className="chelsea-roofline" aria-hidden="true" />
            <div className="chelsea-building-plaque">
              <strong>WEST 22</strong>
              <span>APARTMENTS</span>
            </div>
            <div className="chelsea-window-grid" aria-hidden="true">
              {Array.from({ length: 12 }, (_, index) => (
                <span key={index} />
              ))}
            </div>
            <div className="chelsea-fire-escape" aria-hidden="true">
              <span />
              <span />
              <span />
            </div>
            <button
              type="button"
              className="chelsea-building-door"
              aria-label="Enter West 22 Apartments and go to your apartment"
              onClick={onEnterApartment}
            >
              <span>4B</span>
              <small>Enter</small>
            </button>
          </section>

          <section className="chelsea-building chelsea-building-east" aria-hidden="true">
            <div className="chelsea-building-sign">SHELL REPAIR</div>
            <div className="chelsea-store-window" />
            <div className="chelsea-store-awning" />
          </section>

          <section className="chelsea-subway-entrance" aria-label="West 23 Street subway">
            <span className="subway-line-badge">T</span>
            <div>
              <strong>West 23 Street</strong>
              <small>Subway</small>
            </div>
            <button type="button" onClick={onEnterSubway}>
              Enter
            </button>
          </section>

          <div className="chelsea-sidewalk" aria-hidden="true">
            <span className="chelsea-hydrant" />
            <span className="chelsea-trash-bags" />
          </div>
          <span
            className="chelsea-tree street-tree-one"
            aria-hidden="true"
          />
          <span
            className="chelsea-tree street-tree-two"
            aria-hidden="true"
          />
          <div className="chelsea-curb" aria-hidden="true" />
          <div className="chelsea-road" aria-hidden="true">
            <span className="chelsea-parked-car" />
          </div>

          <div
            className={`chelsea-door-zone${nearBuilding ? " is-nearby" : ""}`}
            aria-hidden="true"
          >
            <span />
          </div>

          <div
            className={`chelsea-pressure-zone${
              nearPressureWashing ? " is-nearby" : ""
            }`}
            aria-hidden="true"
          >
            <span />
          </div>

          <div
            className={`chelsea-subway-zone${nearSubway ? " is-nearby" : ""}`}
            aria-hidden="true"
          >
            <span />
          </div>

          <RemoteDistrictPlayers
            playerRefs={remotePlayerRefs}
            remotePlayers={remotePlayers}
          />

          <div
            className="chelsea-player"
            ref={playerRef}
            role="img"
            aria-label="Turtle City player character"
            data-facing="left"
          >
            <span className="turtle-sprite" aria-hidden="true" />
            <span className="turtle-nameplate">{turtleName}</span>
          </div>
        </div>
      </section>

      {nearSubway ? (
        <aside className="chelsea-enter-prompt" aria-live="polite">
          <div>
            <strong>West 23 Street</strong>
            <small>Enter the Turtle City subway.</small>
          </div>
          <button type="button" onClick={onEnterSubway}>
            Enter station
          </button>
        </aside>
      ) : nearPressureWashing ? (
        <aside className="chelsea-enter-prompt" aria-live="polite">
          <div>
            <strong>Chelsea Wash Crew</strong>
            <small>Pressure wash Lettuce &amp; Co.</small>
          </div>
          <button type="button" onClick={onEnterPressureWashing}>
            Start job
          </button>
        </aside>
      ) : nearBuilding ? (
        <aside className="chelsea-enter-prompt" aria-live="polite">
          <div>
            <strong>West 22 Apartments</strong>
            <small>Your apartment · 4B</small>
          </div>
          <button type="button" onClick={onEnterApartment}>
            Enter
          </button>
        </aside>
      ) : null}
    </main>
  );
}

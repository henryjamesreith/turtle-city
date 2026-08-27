"use client";

import { useEffect, useRef, useState } from "react";
import {
  DistrictLiveStatus,
  RemoteDistrictPlayers,
} from "./MultiplayerDistrictPlayers";
import { useDistrictMultiplayer } from "@/lib/multiplayer/useDistrictMultiplayer";

type FidiDistrictProps = {
  onEnterDelivery: () => void;
  onEnterSubway: () => void;
  spawn: "delivery" | "harbor" | "subway";
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

export function FidiDistrict({
  onEnterDelivery,
  onEnterSubway,
  spawn,
  turtleName,
}: FidiDistrictProps) {
  const worldRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<HTMLDivElement>(null);
  const remotePlayerRefs = useRef(new Map<string, HTMLDivElement>());
  const [nearDelivery, setNearDelivery] = useState(false);
  const [nearSubway, setNearSubway] = useState(false);
  const {
    remotePlayers,
    remoteTargetsRef,
    sendMovement,
    status: multiplayerStatus,
  } = useDistrictMultiplayer("fidi", spawn);

  useEffect(() => {
    const pressed = new Set<string>();
    const position = { x: 0, y: 0 };
    const camera = { x: 0, y: 0 };
    let initialized = false;
    let isNearDelivery = false;
    let isNearSubway = false;
    let previousTime = performance.now();
    let lastNetworkUpdate = 0;
    let facing: "left" | "right" = "right";
    let animationFrame = 0;

    function isEditableTarget(target: EventTarget | null) {
      return (
        target instanceof HTMLElement &&
        (target.isContentEditable ||
          target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT")
      );
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (isEditableTarget(event.target)) {
        return;
      }

      if (movementKeys.has(event.key)) {
        event.preventDefault();
        pressed.add(event.key.toLowerCase());
      } else if (event.key === "Enter" && !event.repeat) {
        if (isNearSubway) {
          event.preventDefault();
          onEnterSubway();
        } else if (isNearDelivery) {
          event.preventDefault();
          onEnterDelivery();
        }
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
          worldWidth *
          (spawn === "subway" ? 0.11 : spawn === "delivery" ? 0.71 : 0.88);
        position.y = worldHeight * 0.73;
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
        105,
        worldWidth - 105,
      );
      position.y = clamp(
        position.y + (vertical / magnitude) * speed * elapsed,
        worldHeight * 0.57,
        worldHeight * 0.9,
      );

      const nearStation =
        Math.hypot(
          position.x - worldWidth * 0.11,
          position.y - worldHeight * 0.72,
        ) < 190;
      const nearDispatch =
        Math.hypot(
          position.x - worldWidth * 0.71,
          position.y - worldHeight * 0.71,
        ) < 210;

      isNearSubway = nearStation;
      isNearDelivery = nearDispatch;
      setNearSubway((current) =>
        current === nearStation ? current : nearStation,
      );
      setNearDelivery((current) =>
        current === nearDispatch ? current : nearDispatch,
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
    onEnterDelivery,
    onEnterSubway,
    remoteTargetsRef,
    sendMovement,
    spawn,
  ]);

  return (
    <main className="fidi-stage" data-testid="fidi-district">
      <header className="fidi-title">
        <p>Turtle City</p>
        <h1>FiDi</h1>
        <span>Fast streets, wide harbor</span>
      </header>

      <DistrictLiveStatus
        remotePlayerCount={remotePlayers.length}
        status={multiplayerStatus}
      />

      <p className="sr-only">
        Move with the arrow keys or W, A, S, and D. Hold Shift to run. Press
        Enter near Shell Express dispatch or Fulton Street subway.
      </p>

      <section className="fidi-viewport" aria-label="Financial District streets">
        <div className="fidi-world" ref={worldRef}>
          <div className="fidi-sky" aria-hidden="true">
            <span className="fidi-sun" />
            <span className="fidi-cloud cloud-one" />
            <span className="fidi-cloud cloud-two" />
            <span className="fidi-harbor" />
            <span className="fidi-ferry" />
          </div>

          <section className="fidi-building fidi-building-west">
            <div className="fidi-bank-sign">
              <small>TURTLE CITY</small>
              <strong>SHELL &amp; TRUST</strong>
            </div>
            <div className="fidi-window-grid" aria-hidden="true">
              {Array.from({ length: 24 }, (_, index) => (
                <span key={index} />
              ))}
            </div>
            <div className="fidi-cafe">
              <strong>OPENING BELL CAFE</strong>
              <small>coffee before the market does</small>
            </div>
          </section>

          <section className="fidi-one-shell" aria-label="One Shell Plaza">
            <div className="fidi-one-shell-crown" aria-hidden="true" />
            <div className="fidi-one-shell-label">
              <small>HARBOR OBSERVATORY</small>
              <strong>ONE SHELL PLAZA</strong>
            </div>
            <div className="fidi-one-shell-windows" aria-hidden="true">
              {Array.from({ length: 30 }, (_, index) => (
                <span key={index} />
              ))}
            </div>
          </section>

          <section className="fidi-building fidi-building-east">
            <div className="fidi-window-grid compact" aria-hidden="true">
              {Array.from({ length: 20 }, (_, index) => (
                <span key={index} />
              ))}
            </div>
            <div className="fidi-dispatch">
              <span className="fidi-dispatch-mark" aria-hidden="true">SE</span>
              <div>
                <strong>SHELL EXPRESS</strong>
                <small>Downtown delivery dispatch</small>
              </div>
              <button type="button" onClick={onEnterDelivery}>
                Start a route
              </button>
            </div>
          </section>

          <section className="fidi-subway-entrance" aria-label="Fulton Street subway">
            <span className="subway-line-badge">T</span>
            <div>
              <strong>Fulton Street</strong>
              <small>Subway</small>
            </div>
            <button type="button" onClick={onEnterSubway}>
              Enter
            </button>
          </section>

          <div className="fidi-sidewalk" aria-hidden="true">
            <span className="fidi-clock" />
            <span className="fidi-kiosk" />
            <span className="fidi-bollard bollard-one" />
            <span className="fidi-bollard bollard-two" />
            <span className="fidi-bollard bollard-three" />
          </div>
          <div className="fidi-road" aria-hidden="true">
            <span />
            <span />
            <i className="fidi-bus" />
            <i className="fidi-town-car" />
          </div>

          <div
            className={`fidi-activity-zone delivery-zone${
              nearDelivery ? " is-nearby" : ""
            }`}
            aria-hidden="true"
          >
            <span />
          </div>
          <div
            className={`fidi-activity-zone fidi-subway-zone${
              nearSubway ? " is-nearby" : ""
            }`}
            aria-hidden="true"
          >
            <span />
          </div>

          <RemoteDistrictPlayers
            playerRefs={remotePlayerRefs}
            remotePlayers={remotePlayers}
          />

          <div
            className="fidi-player"
            ref={playerRef}
            role="img"
            aria-label="Turtle City player character"
            data-facing="right"
          >
            <span className="turtle-sprite" aria-hidden="true" />
            <span className="turtle-nameplate">{turtleName}</span>
          </div>
        </div>
      </section>

      {nearSubway ? (
        <aside className="fidi-enter-prompt" aria-live="polite">
          <div>
            <strong>Fulton Street</strong>
            <small>Enter the Turtle City subway.</small>
          </div>
          <button type="button" onClick={onEnterSubway}>
            Enter station
          </button>
        </aside>
      ) : nearDelivery ? (
        <aside className="fidi-enter-prompt" aria-live="polite">
          <div>
            <strong>Shell Express</strong>
            <small>Take a downtown delivery route.</small>
          </div>
          <button type="button" onClick={onEnterDelivery}>
            Start route
          </button>
        </aside>
      ) : null}
    </main>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import {
  DistrictLiveStatus,
  RemoteDistrictPlayers,
} from "./MultiplayerDistrictPlayers";
import { useDistrictMultiplayer } from "@/lib/multiplayer/useDistrictMultiplayer";

type MidtownDistrictProps = {
  onEnterFallingItems: () => void;
  onEnterSubway: () => void;
  onEnterTrashPickup: () => void;
  spawn: "falling-items" | "plaza" | "subway" | "trash-pickup";
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

export function MidtownDistrict({
  onEnterFallingItems,
  onEnterSubway,
  onEnterTrashPickup,
  spawn,
  turtleName,
}: MidtownDistrictProps) {
  const worldRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<HTMLDivElement>(null);
  const remotePlayerRefs = useRef(new Map<string, HTMLDivElement>());
  const [nearFallingItems, setNearFallingItems] = useState(false);
  const [nearSubway, setNearSubway] = useState(false);
  const [nearTrashPickup, setNearTrashPickup] = useState(false);
  const {
    remotePlayers,
    remoteTargetsRef,
    sendMovement,
    status: multiplayerStatus,
  } = useDistrictMultiplayer("midtown", spawn);

  useEffect(() => {
    const pressed = new Set<string>();
    const position = { x: 0, y: 0 };
    const camera = { x: 0, y: 0 };
    let initialized = false;
    let isNearFallingItems = false;
    let isNearSubway = false;
    let isNearTrashPickup = false;
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
        } else if (isNearFallingItems) {
          event.preventDefault();
          onEnterFallingItems();
        } else if (isNearTrashPickup) {
          event.preventDefault();
          onEnterTrashPickup();
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
          (spawn === "subway"
            ? 0.1
            : spawn === "falling-items"
              ? 0.43
              : spawn === "trash-pickup"
                ? 0.78
                : 0.58);
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
        105,
        worldWidth - 105,
      );
      position.y = clamp(
        position.y + (vertical / magnitude) * speed * elapsed,
        worldHeight * 0.56,
        worldHeight * 0.89,
      );

      const nearStation =
        Math.hypot(
          position.x - worldWidth * 0.1,
          position.y - worldHeight * 0.7,
        ) < 185;
      const nearTower =
        Math.hypot(
          position.x - worldWidth * 0.43,
          position.y - worldHeight * 0.67,
        ) < 205;
      const nearCleanup =
        Math.hypot(
          position.x - worldWidth * 0.78,
          position.y - worldHeight * 0.7,
        ) < 205;

      isNearSubway = nearStation;
      isNearFallingItems = nearTower;
      isNearTrashPickup = nearCleanup;
      setNearSubway((current) =>
        current === nearStation ? current : nearStation,
      );
      setNearFallingItems((current) =>
        current === nearTower ? current : nearTower,
      );
      setNearTrashPickup((current) =>
        current === nearCleanup ? current : nearCleanup,
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
    onEnterFallingItems,
    onEnterSubway,
    onEnterTrashPickup,
    remoteTargetsRef,
    sendMovement,
    spawn,
  ]);

  return (
    <main className="midtown-stage" data-testid="midtown-district">
      <header className="midtown-title">
        <p>Turtle City</p>
        <h1>Midtown</h1>
        <span>Electric nights, busy blocks</span>
      </header>

      <DistrictLiveStatus
        remotePlayerCount={remotePlayers.length}
        status={multiplayerStatus}
      />

      <p className="sr-only">
        Move with the arrow keys or W, A, S, and D. Hold Shift to run. Press
        Enter near the Empire Shell Building, Clean Team cart, or subway.
      </p>

      <section className="midtown-viewport" aria-label="Midtown streets">
        <div className="midtown-world" ref={worldRef}>
          <div className="midtown-sky" aria-hidden="true">
            <span className="midtown-moon" />
            <span className="midtown-cloud cloud-one" />
            <span className="midtown-cloud cloud-two" />
          </div>

          <section className="midtown-block midtown-block-west">
            <div className="midtown-billboard billboard-news">
              <small>THE DAILY SHELL</small>
              <strong>CITY NEVER NAPS</strong>
            </div>
            <div className="midtown-window-grid" aria-hidden="true">
              {Array.from({ length: 18 }, (_, index) => (
                <span key={index} />
              ))}
            </div>
            <div className="midtown-storefront">
              <strong>48TH STREET DELI</strong>
              <small>open all night</small>
            </div>
          </section>

          <section
            className="midtown-empire-building"
            aria-label="Empire Shell Building falling-items activity"
          >
            <div className="midtown-spire" aria-hidden="true" />
            <div className="midtown-empire-sign">
              <small>OBSERVATION DECK</small>
              <strong>EMPIRE SHELL</strong>
            </div>
            <div className="midtown-empire-windows" aria-hidden="true">
              {Array.from({ length: 24 }, (_, index) => (
                <span key={index} />
              ))}
            </div>
            <button type="button" onClick={onEnterFallingItems}>
              Dodge the drop
            </button>
          </section>

          <section className="midtown-block midtown-block-east">
            <div className="midtown-billboard billboard-show">
              <strong>SHELL SHOCKED!</strong>
              <small>an original musical</small>
            </div>
            <div className="midtown-window-grid compact" aria-hidden="true">
              {Array.from({ length: 15 }, (_, index) => (
                <span key={index} />
              ))}
            </div>
            <div className="midtown-clean-team">
              <strong>MIDTOWN CLEAN TEAM</strong>
              <small>Keep the crossroads sparkling</small>
              <button type="button" onClick={onEnterTrashPickup}>
                Start cleanup
              </button>
            </div>
          </section>

          <section className="midtown-subway-entrance" aria-label="Times Square subway">
            <span className="subway-line-badge">T</span>
            <div>
              <strong>Times Square</strong>
              <small>Subway</small>
            </div>
            <button type="button" onClick={onEnterSubway}>
              Enter
            </button>
          </section>

          <div className="midtown-sidewalk" aria-hidden="true">
            <span className="midtown-newsstand" />
            <span className="midtown-hotdog-cart" />
            <span className="midtown-planter planter-one" />
            <span className="midtown-planter planter-two" />
          </div>
          <div className="midtown-road" aria-hidden="true">
            <span />
            <span />
            <i className="midtown-taxi taxi-one" />
            <i className="midtown-taxi taxi-two" />
          </div>

          <div
            className={`midtown-activity-zone falling-zone${
              nearFallingItems ? " is-nearby" : ""
            }`}
            aria-hidden="true"
          >
            <span />
          </div>
          <div
            className={`midtown-activity-zone trash-zone${
              nearTrashPickup ? " is-nearby" : ""
            }`}
            aria-hidden="true"
          >
            <span />
          </div>
          <div
            className={`midtown-activity-zone subway-zone${
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
            className="midtown-player"
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
        <aside className="midtown-enter-prompt" aria-live="polite">
          <div>
            <strong>Times Square</strong>
            <small>Enter the Turtle City subway.</small>
          </div>
          <button type="button" onClick={onEnterSubway}>
            Enter station
          </button>
        </aside>
      ) : nearFallingItems ? (
        <aside className="midtown-enter-prompt" aria-live="polite">
          <div>
            <strong>Empire Shell Building</strong>
            <small>Dodge everything falling from above.</small>
          </div>
          <button type="button" onClick={onEnterFallingItems}>
            Start challenge
          </button>
        </aside>
      ) : nearTrashPickup ? (
        <aside className="midtown-enter-prompt" aria-live="polite">
          <div>
            <strong>Midtown Clean Team</strong>
            <small>Clear the busiest block in town.</small>
          </div>
          <button type="button" onClick={onEnterTrashPickup}>
            Start cleanup
          </button>
        </aside>
      ) : null}
    </main>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";

type WestVillageDistrictProps = {
  onEnterSubway: () => void;
  spawn: "neighborhood" | "subway";
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

export function WestVillageDistrict({
  onEnterSubway,
  spawn,
  turtleName,
}: WestVillageDistrictProps) {
  const worldRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<HTMLDivElement>(null);
  const [nearSubway, setNearSubway] = useState(false);

  useEffect(() => {
    const pressed = new Set<string>();
    const position = { x: 0, y: 0 };
    const camera = { x: 0, y: 0 };
    let initialized = false;
    let isNearSubway = false;
    let previousTime = performance.now();
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
      } else if (event.key === "Enter" && isNearSubway && !event.repeat) {
        event.preventDefault();
        onEnterSubway();
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
        position.x = worldWidth * (spawn === "subway" ? 0.88 : 0.39);
        position.y = worldHeight * 0.75;
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
        95,
        worldWidth - 95,
      );
      position.y = clamp(
        position.y + (vertical / magnitude) * speed * elapsed,
        worldHeight * 0.61,
        worldHeight * 0.88,
      );

      const nearStation =
        Math.hypot(
          position.x - worldWidth * 0.88,
          position.y - worldHeight * 0.72,
        ) < 190;
      isNearSubway = nearStation;
      setNearSubway((current) =>
        current === nearStation ? current : nearStation,
      );

      const targetX = cameraOffset(window.innerWidth, worldWidth, position.x);
      const targetY = cameraOffset(window.innerHeight, worldHeight, position.y);
      const smoothing = Math.min(1, elapsed * 6);
      camera.x += (targetX - camera.x) * smoothing;
      camera.y += (targetY - camera.y) * smoothing;

      if (horizontal < 0) {
        player.dataset.facing = "left";
      } else if (horizontal > 0) {
        player.dataset.facing = "right";
      }

      player.style.transform = `translate3d(${position.x - 55}px, ${
        position.y - 124
      }px, 0)`;
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
  }, [onEnterSubway, spawn]);

  return (
    <main className="village-stage" data-testid="west-village-district">
      <header className="village-title">
        <p>Turtle City</p>
        <h1>West Village</h1>
        <span>Quiet corners · late afternoon</span>
      </header>

      <p className="sr-only">
        Move with the arrow keys or W, A, S, and D. Hold Shift to run. Travel
        west from the neighborhood streets to reach the waterfront. The subway
        entrance is at the east end of the neighborhood.
      </p>

      <section className="village-viewport" aria-label="West Village streets">
        <div className="village-world" ref={worldRef}>
          <div className="village-sky" aria-hidden="true">
            <span className="village-sun" />
            <span className="village-water-tower" />
          </div>

          <section className="village-block village-block-east">
            <div className="village-cornice" aria-hidden="true" />
            <div className="village-window-grid" aria-hidden="true">
              {Array.from({ length: 12 }, (_, index) => (
                <span key={index} />
              ))}
            </div>
            <div className="village-fire-escape" aria-hidden="true">
              <span />
              <span />
              <span />
            </div>
            <div className="village-storefront village-cafe">
              <strong>THE NIGHT HERON</strong>
              <small>coffee · pie · late plates</small>
            </div>
            <div className="village-storefront village-bistro">
              <strong>LITTLE LEAF</strong>
              <small>neighborhood kitchen</small>
            </div>
          </section>

          <section className="village-block village-block-center">
            <div className="village-cornice" aria-hidden="true" />
            <div className="village-window-grid compact" aria-hidden="true">
              {Array.from({ length: 9 }, (_, index) => (
                <span key={index} />
              ))}
            </div>
            <div className="village-jazz-club">
              <span>downstairs</span>
              <strong>CELLAR NOTE</strong>
              <small>jazz nightly</small>
            </div>
            <div className="village-record-shop">
              <strong>SIDE B</strong>
              <small>records &amp; repairs</small>
            </div>
          </section>

          <section className="village-townhouses" aria-label="Village row houses">
            {["17", "19", "21"].map((number) => (
              <div key={number} className="village-townhouse">
                <span className="village-townhouse-window" />
                <span className="village-townhouse-window" />
                <span className="village-townhouse-window" />
                <strong>{number}</strong>
              </div>
            ))}
          </section>

          <div className="village-sidewalk" aria-hidden="true">
            <span className="village-stoop village-stoop-one" />
            <span className="village-stoop village-stoop-two" />
            <span className="village-news-box" />
          </div>

          <div className="village-cross-street" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>

          <section className="village-waterfront" aria-label="Hudson waterfront">
            <div className="village-greenway">
              <span className="village-bike-lane-mark">↟</span>
              <span className="village-bike-lane-mark second">↟</span>
              <div className="village-waterfront-sign">
                <strong>HUDSON GREENWAY</strong>
                <small>Bike races coming later</small>
              </div>
            </div>
            <div className="village-river" aria-hidden="true">
              <span />
              <span />
              <span />
              <div className="village-pier">
                <i />
                <i />
                <i />
              </div>
            </div>
          </section>

          <span className="village-tree village-tree-one" aria-hidden="true" />
          <span className="village-tree village-tree-two" aria-hidden="true" />
          <span className="village-tree village-tree-three" aria-hidden="true" />
          <span className="village-lamp village-lamp-one" aria-hidden="true" />
          <span className="village-lamp village-lamp-two" aria-hidden="true" />

          <section className="village-subway-entrance" aria-label="West 4 Street subway">
            <span className="subway-line-badge">T</span>
            <div>
              <strong>West 4 Street</strong>
              <small>Subway</small>
            </div>
            <button type="button" onClick={onEnterSubway}>
              Enter
            </button>
          </section>

          <div
            className={`village-subway-zone${nearSubway ? " is-nearby" : ""}`}
            aria-hidden="true"
          >
            <span />
          </div>

          <div
            className="village-player"
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

      <aside className="village-area-guide" aria-hidden="true">
        <span>← Hudson River</span>
        <span>Village streets →</span>
      </aside>

      {nearSubway ? (
        <aside className="village-enter-prompt" aria-live="polite">
          <div>
            <strong>West 4 Street</strong>
            <small>Enter the Turtle City subway.</small>
          </div>
          <button type="button" onClick={onEnterSubway}>
            Enter station
          </button>
        </aside>
      ) : null}
    </main>
  );
}

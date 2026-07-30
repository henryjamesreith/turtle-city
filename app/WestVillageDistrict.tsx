"use client";

import { useEffect, useRef, useState } from "react";

type WestVillageDistrictProps = {
  onEnterBikeRace: () => void;
  onEnterJazzClub: () => void;
  onEnterSubway: () => void;
  spawn: "jazz-club" | "neighborhood" | "subway" | "waterfront";
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
  onEnterBikeRace,
  onEnterJazzClub,
  onEnterSubway,
  spawn,
  turtleName,
}: WestVillageDistrictProps) {
  const worldRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<HTMLDivElement>(null);
  const [nearBikeRace, setNearBikeRace] = useState(false);
  const [nearJazzClub, setNearJazzClub] = useState(false);
  const [nearSubway, setNearSubway] = useState(false);

  useEffect(() => {
    const pressed = new Set<string>();
    const position = { x: 0, y: 0 };
    const camera = { x: 0, y: 0 };
    let initialized = false;
    let isNearBikeRace = false;
    let isNearJazzClub = false;
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
      } else if (event.key === "Enter" && !event.repeat) {
        if (isNearSubway) {
          event.preventDefault();
          onEnterSubway();
        } else if (isNearBikeRace) {
          event.preventDefault();
          onEnterBikeRace();
        } else if (isNearJazzClub) {
          event.preventDefault();
          onEnterJazzClub();
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
            ? 0.88
            : spawn === "waterfront"
              ? 0.25
              : spawn === "jazz-club"
                ? 0.4
                : 0.48);
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
        95,
        worldWidth - 95,
      );
      position.y = clamp(
        position.y + (vertical / magnitude) * speed * elapsed,
        worldHeight * 0.58,
        worldHeight * 0.9,
      );

      const nearStation =
        Math.hypot(
          position.x - worldWidth * 0.88,
          position.y - worldHeight * 0.72,
        ) < 190;
      const nearRace =
        Math.hypot(
          position.x - worldWidth * 0.25,
          position.y - worldHeight * 0.7,
        ) < 210;
      const nearClub =
        Math.hypot(
          position.x - worldWidth * 0.4,
          position.y - worldHeight * 0.64,
        ) < 190;
      isNearSubway = nearStation;
      isNearBikeRace = nearRace;
      isNearJazzClub = nearClub;
      setNearSubway((current) =>
        current === nearStation ? current : nearStation,
      );
      setNearBikeRace((current) =>
        current === nearRace ? current : nearRace,
      );
      setNearJazzClub((current) =>
        current === nearClub ? current : nearClub,
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
  }, [onEnterBikeRace, onEnterJazzClub, onEnterSubway, spawn]);

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
        entrance is at the east end of the neighborhood. Press Enter at the
        Hudson Greenway start line to begin a bike race.
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
              <button type="button" onClick={onEnterJazzClub}>
                Enter club
              </button>
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

          <div className="village-road" aria-hidden="true">
            <span />
            <span />
          </div>

          <div className="village-waterfront-plaza" aria-hidden="true">
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
                <small>West Village bike race</small>
                <button type="button" onClick={onEnterBikeRace}>
                  Start race
                </button>
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

          <div
            className={`village-bike-zone${nearBikeRace ? " is-nearby" : ""}`}
            aria-hidden="true"
          >
            <span />
          </div>

          <div
            className={`village-jazz-zone${nearJazzClub ? " is-nearby" : ""}`}
            aria-hidden="true"
          >
            <span />
          </div>

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

      {nearBikeRace ? (
        <aside className="village-enter-prompt" aria-live="polite">
          <div>
            <strong>Hudson Greenway</strong>
            <small>Race bikes along the river.</small>
          </div>
          <button type="button" onClick={onEnterBikeRace}>
            Start race
          </button>
        </aside>
      ) : nearJazzClub ? (
        <aside className="village-enter-prompt" aria-live="polite">
          <div>
            <strong>Cellar Note</strong>
            <small>Go downstairs for live music.</small>
          </div>
          <button type="button" onClick={onEnterJazzClub}>
            Enter club
          </button>
        </aside>
      ) : nearSubway ? (
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

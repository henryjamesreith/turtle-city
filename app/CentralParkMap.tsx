"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";

type CentralParkMapProps = {
  onReturnToCity: () => void;
  onEnterHockey: () => void;
  onEnterShoveling: () => void;
  spawn?: "south-gate" | "frozen-pond" | "snow-crew";
  turtleName: string;
};

const trees = [
  ["15%", "3%", "large"],
  ["23%", "7%", "small"],
  ["79%", "5%", "medium"],
  ["87%", "11%", "large"],
  ["16%", "15%", "medium"],
  ["82%", "18%", "small"],
  ["14%", "24%", "large"],
  ["25%", "28%", "small"],
  ["78%", "27%", "large"],
  ["87%", "24%", "medium"],
  ["15%", "35%", "small"],
  ["28%", "42%", "large"],
  ["75%", "39%", "medium"],
  ["86%", "44%", "large"],
  ["15%", "49%", "medium"],
  ["23%", "55%", "large"],
  ["79%", "51%", "small"],
  ["86%", "58%", "medium"],
  ["15%", "63%", "large"],
  ["30%", "66%", "small"],
  ["72%", "64%", "large"],
  ["84%", "68%", "medium"],
  ["14%", "75%", "small"],
  ["24%", "79%", "large"],
  ["76%", "76%", "medium"],
  ["86%", "82%", "large"],
  ["15%", "88%", "medium"],
  ["29%", "91%", "large"],
  ["75%", "89%", "small"],
  ["85%", "95%", "medium"],
] as const;

const pathSegments = [
  {
    id: "south-arrival",
    kind: "primary",
    left: "50%",
    top: 1750,
    width: 104,
    height: 450,
    rotate: -2,
  },
  {
    id: "slopes-spine",
    kind: "primary",
    left: "49%",
    top: 1440,
    width: 100,
    height: 500,
    rotate: 7,
  },
  {
    id: "pond-west",
    kind: "secondary",
    left: "31%",
    top: 905,
    width: 68,
    height: 720,
    rotate: 13,
  },
  {
    id: "pond-east",
    kind: "primary",
    left: "69%",
    top: 900,
    width: 88,
    height: 760,
    rotate: -12,
  },
  {
    id: "north-promenade",
    kind: "primary",
    left: "53%",
    top: 280,
    width: 92,
    height: 700,
    rotate: 8,
  },
  {
    id: "sled-spur",
    kind: "activity",
    left: "61%",
    top: 1680,
    width: 54,
    height: 280,
    rotate: 64,
  },
  {
    id: "snow-crew-spur",
    kind: "activity",
    left: "65%",
    top: 315,
    width: 54,
    height: 390,
    rotate: 58,
  },
] as const;

const pathJunctions = [
  { id: "south-fork", left: "50%", top: 1870, size: 150 },
  { id: "pond-south", left: "50%", top: 1570, size: 142 },
  { id: "pond-north", left: "52%", top: 850, size: 126 },
] as const;

const interactionZones = [
  {
    id: "snow-crew",
    label: "Snow Crew",
    detail: "Shoveling",
    x: 0.7,
    y: 640,
    radius: 180,
  },
  {
    id: "ice-hockey",
    label: "Frozen Pond",
    detail: "Ice hockey",
    x: 0.7,
    y: 1440,
    radius: 190,
  },
  {
    id: "sledding",
    label: "South Slopes",
    detail: "Sledding",
    x: 0.65,
    y: 1980,
    radius: 190,
  },
] as const;

type InteractionZoneId = (typeof interactionZones)[number]["id"];

function isEditableTarget(target: EventTarget | null) {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable ||
      target.tagName === "INPUT" ||
      target.tagName === "TEXTAREA" ||
      target.tagName === "SELECT")
  );
}

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

const WALK_SPEED = 360;
const RUN_SPEED = 620;

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), maximum);
}

function cameraOffset(
  viewportSize: number,
  worldSize: number,
  focusPosition: number,
  zoom: number,
  anchor: number,
) {
  const scaledWorldSize = worldSize * zoom;

  if (scaledWorldSize <= viewportSize) {
    return (viewportSize - scaledWorldSize) * 0.5;
  }

  return clamp(
    viewportSize * anchor - focusPosition * zoom,
    viewportSize - scaledWorldSize,
    0,
  );
}

export function CentralParkMap({
  onReturnToCity,
  onEnterHockey,
  onEnterShoveling,
  spawn = "south-gate",
  turtleName,
}: CentralParkMapProps) {
  const viewportRef = useRef<HTMLElement>(null);
  const worldRef = useRef<HTMLDivElement>(null);
  const markerRef = useRef<HTMLDivElement>(null);
  const targetZoomRef = useRef(1);
  const [nearbyZoneId, setNearbyZoneId] =
    useState<InteractionZoneId | null>(null);

  const nearbyZone =
    interactionZones.find((zone) => zone.id === nearbyZoneId) ?? null;

  function adjustZoom(amount: number) {
    targetZoomRef.current = clamp(targetZoomRef.current + amount, 0.8, 1.35);
  }

  useEffect(() => {
    const viewport = viewportRef.current;
    const pressed = new Set<string>();
    const position = { x: 0, y: 0 };
    const camera = { x: 0, y: 0 };
    let zoom = targetZoomRef.current;
    let initialized = false;
    let animationFrame = 0;
    let previousTime = performance.now();
    let activeZoneId: InteractionZoneId | null = null;

    function handleKeyDown(event: KeyboardEvent) {
      if (isEditableTarget(event.target)) {
        return;
      }

      if (event.key === "Enter" && !event.repeat) {
        if (activeZoneId === "ice-hockey") {
          event.preventDefault();
          onEnterHockey();
        } else if (activeZoneId === "snow-crew") {
          event.preventDefault();
          onEnterShoveling();
        }
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

    function handleWheel(event: WheelEvent) {
      event.preventDefault();
      targetZoomRef.current = clamp(
        targetZoomRef.current - event.deltaY * 0.0008,
        0.8,
        1.35,
      );
    }

    function handleBlur() {
      pressed.clear();
    }

    function update(time: number) {
      const world = worldRef.current;
      const marker = markerRef.current;

      if (!world || !marker) {
        animationFrame = requestAnimationFrame(update);
        return;
      }

      const worldWidth = world.offsetWidth;
      const worldHeight = world.offsetHeight;
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const sideBoundary = Math.max(90, worldWidth * 0.08);

      if (!initialized) {
        position.x =
          worldWidth * (spawn === "south-gate" ? 0.5 : 0.7);
        position.y =
          spawn === "frozen-pond"
            ? 1555
            : spawn === "snow-crew"
              ? 730
              : worldHeight - 210;
        camera.x = cameraOffset(
          viewportWidth,
          worldWidth,
          position.x,
          zoom,
          0.5,
        );
        camera.y = cameraOffset(
          viewportHeight,
          worldHeight,
          position.y,
          zoom,
          0.58,
        );
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
      const speed = pressed.has("shift") ? RUN_SPEED : WALK_SPEED;

      position.x = clamp(
        position.x + (horizontal / magnitude) * speed * elapsed,
        sideBoundary,
        worldWidth - sideBoundary,
      );
      position.y = clamp(
        position.y + (vertical / magnitude) * speed * elapsed,
        100,
        worldHeight - 100,
      );

      const closestZone =
        interactionZones
          .map((zone) => ({
            zone,
            distance: Math.hypot(
              position.x - worldWidth * zone.x,
              position.y - zone.y,
            ),
          }))
          .filter(({ zone, distance }) => distance <= zone.radius)
          .sort((a, b) => a.distance - b.distance)[0]?.zone ?? null;

      activeZoneId = closestZone?.id ?? null;
      setNearbyZoneId((current) =>
        current === closestZone?.id ? current : (closestZone?.id ?? null),
      );

      const zoomSmoothing = Math.min(1, elapsed * 7);
      zoom += (targetZoomRef.current - zoom) * zoomSmoothing;

      const targetX = cameraOffset(
        viewportWidth,
        worldWidth,
        position.x,
        zoom,
        0.5,
      );
      const targetY = cameraOffset(
        viewportHeight,
        worldHeight,
        position.y,
        zoom,
        0.58,
      );
      const smoothing = Math.min(1, elapsed * 5.5);

      camera.x += (targetX - camera.x) * smoothing;
      camera.y += (targetY - camera.y) * smoothing;

      if (horizontal < 0) {
        marker.dataset.facing = "left";
      } else if (horizontal > 0) {
        marker.dataset.facing = "right";
      }
      marker.style.transform = `translate3d(${position.x - 55}px, ${
        position.y - 124
      }px, 0)`;
      world.style.transform = `translate3d(${camera.x}px, ${
        camera.y
      }px, 0) scale(${zoom})`;

      animationFrame = requestAnimationFrame(update);
    }

    window.addEventListener("keydown", handleKeyDown, { passive: false });
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", handleBlur);
    viewport?.addEventListener("wheel", handleWheel, { passive: false });
    animationFrame = requestAnimationFrame(update);

    return () => {
      cancelAnimationFrame(animationFrame);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", handleBlur);
      viewport?.removeEventListener("wheel", handleWheel);
    };
  }, [onEnterHockey, onEnterShoveling, spawn]);

  return (
    <main className="park-camera-stage" data-testid="central-park-map">
      <header className="park-game-title">
        <p>Turtle City</p>
        <h1>Central Park</h1>
      </header>

      <button
        type="button"
        className="park-return"
        onClick={onReturnToCity}
      >
        <span aria-hidden="true">←</span>
        City map
      </button>

      <div className="park-zoom-controls" role="group" aria-label="Camera zoom">
        <button
          type="button"
          aria-label="Zoom out"
          onClick={() => adjustZoom(-0.12)}
        >
          −
        </button>
        <button
          type="button"
          aria-label="Zoom in"
          onClick={() => adjustZoom(0.12)}
        >
          +
        </button>
      </div>

      <details className="park-control-guide">
        <summary>
          <span className="park-control-icon" aria-hidden="true">⌨</span>
          <span className="park-control-label">Controls</span>
        </summary>
        <div className="park-control-card">
          <p className="park-control-heading">How to play</p>
          <div className="park-control-row">
            <div className="park-direction-keys" aria-hidden="true">
              <kbd>↑</kbd>
              <kbd>←</kbd>
              <kbd>↓</kbd>
              <kbd>→</kbd>
            </div>
            <span><strong>Move</strong><small>Arrow keys or WASD</small></span>
          </div>
          <div className="park-control-row">
            <kbd className="park-wide-key">Shift</kbd>
            <span><strong>Run</strong><small>Hold while moving</small></span>
          </div>
          <div className="park-control-row">
            <kbd className="park-wide-key">Enter</kbd>
            <span><strong>Play</strong><small>Start a nearby activity</small></span>
          </div>
        </div>
      </details>

      <p className="sr-only">
        Move the turtle with the arrow keys or W, A, S, and D. Hold Shift to
        run. Press Enter to start a nearby activity. Zoom with the mouse wheel
        or the zoom controls.
      </p>

      <section
        className="park-camera-viewport"
        aria-label="Continuous Central Park camera prototype"
        ref={viewportRef}
      >
        <div className="park-continuous-world" ref={worldRef}>
          <div className="park-city-edge city-edge-west" aria-hidden="true" />
          <div className="park-city-edge city-edge-east" aria-hidden="true" />
          <div className="park-avenue avenue-west" aria-hidden="true" />
          <div className="park-avenue avenue-east" aria-hidden="true" />
          <div className="park-sidewalk sidewalk-west" aria-hidden="true" />
          <div className="park-sidewalk sidewalk-east" aria-hidden="true" />
          <div className="park-fence fence-west" aria-hidden="true" />
          <div className="park-fence fence-east" aria-hidden="true" />

          <div className="continuous-zone zone-north" aria-hidden="true" />
          <div className="continuous-zone zone-pond" aria-hidden="true" />
          <div className="continuous-zone zone-south" aria-hidden="true" />

          <div className="park-path-loop pond-path-loop" aria-hidden="true" />

          {pathSegments.map((path) => (
            <div
              key={path.id}
              className={`park-path-segment path-${path.kind}`}
              style={
                {
                  left: path.left,
                  top: path.top,
                  width: path.width,
                  height: path.height,
                  transform: `translateX(-50%) rotate(${path.rotate}deg)`,
                } satisfies CSSProperties
              }
              aria-hidden="true"
            />
          ))}

          {pathJunctions.map((junction) => (
            <div
              key={junction.id}
              className="park-path-junction"
              style={{
                left: junction.left,
                top: junction.top,
                width: junction.size,
                height: Math.round(junction.size * 0.52),
              }}
              aria-hidden="true"
            />
          ))}

          {trees.map(([left, top, size], index) => (
            <div
              key={`${left}-${top}`}
              className={`winter-tree tree-${size}`}
              style={{
                left,
                top,
                zIndex: Math.round(Number.parseFloat(top) * 32 + 90),
              }}
              aria-hidden="true"
              data-tree={index}
            />
          ))}

          <section className="snow-crew-yard" aria-label="Snow Crew work area">
            <div aria-hidden="true" />
            <p>Snow Crew</p>
            <span>Maintenance yard</span>
          </section>

          <section className="frozen-pond" aria-label="Frozen pond hockey rink">
            <div className="pond-shine" aria-hidden="true" />
            <p>The Frozen Pond</p>
            <span>Pond hockey</span>
          </section>

          <div className="footbridge" aria-hidden="true" />

          <section className="sledding-hills" aria-label="Sledding hills">
            <div className="sled-hill hill-left" aria-hidden="true">
              <span className="sled-run run-left" />
              <span className="sled-rider rider-left" />
            </div>
            <div className="sled-hill hill-right" aria-hidden="true">
              <span className="sled-run run-right" />
              <span className="sled-rider rider-right" />
            </div>
            <div className="sled-fence" aria-hidden="true" />
            <div className="park-place-sign sled-sign">
              <p>South Slopes</p>
              <span>Sledding hills</span>
            </div>
          </section>

          <section className="south-subway" aria-label="South Gate subway">
            <div className="subway-marker" aria-hidden="true">
              T
            </div>
            <p>South Gate</p>
            <span>Subway</span>
          </section>

          {interactionZones.map((zone) => (
            <section
              key={zone.id}
              className={`activity-threshold${
                nearbyZoneId === zone.id ? " is-nearby" : ""
              }${
                zone.id === "ice-hockey" || zone.id === "snow-crew"
                  ? " is-playable"
                  : ""
              }`}
              style={{
                left: `${zone.x * 100}%`,
                top: zone.y,
                zIndex: zone.y + 1000,
              }}
              aria-label={`${zone.label}: ${zone.detail} interaction area`}
              data-interaction-zone={zone.id}
              data-radius={zone.radius}
            >
              <span className="activity-threshold-mark" aria-hidden="true" />
              <span className="activity-threshold-label">
                <strong>{zone.label}</strong>
                <small>{zone.detail}</small>
              </span>
              {zone.id === "ice-hockey" || zone.id === "snow-crew" ? (
                <button
                  type="button"
                  className="activity-threshold-action"
                  aria-label={
                    zone.id === "ice-hockey"
                      ? "Play pond hockey"
                      : "Start snow shoveling"
                  }
                  onClick={
                    zone.id === "ice-hockey"
                      ? onEnterHockey
                      : onEnterShoveling
                  }
                />
              ) : null}
            </section>
          ))}

          <div
            className="player-turtle"
            ref={markerRef}
            role="img"
            aria-label="Turtle City player character"
            data-facing="right"
          >
            <span className="turtle-character" aria-hidden="true" />
            <span className="turtle-nameplate">{turtleName}</span>
          </div>
        </div>
      </section>

      {nearbyZone ? (
        <aside className="nearby-activity" aria-live="polite">
          <span aria-hidden="true" />
          <div>
            <strong>{nearbyZone.label}</strong>
            <small>{nearbyZone.detail} activity entrance</small>
          </div>
          {nearbyZone.id === "ice-hockey" ||
          nearbyZone.id === "snow-crew" ? (
            <button
              type="button"
              onClick={
                nearbyZone.id === "ice-hockey"
                  ? onEnterHockey
                  : onEnterShoveling
              }
            >
              Play
            </button>
          ) : null}
        </aside>
      ) : null}
    </main>
  );
}

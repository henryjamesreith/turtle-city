"use client";

import { useEffect, useRef, useState } from "react";
import {
  subwayStations,
  type TransitDistrict,
} from "@/lib/world/subway";

type SubwayPlatformProps = {
  origin: TransitDistrict;
  onBoard: () => void;
  onExit: () => void;
  turtleName: string;
};

const FIRST_ARRIVAL_TIME = 1;
const ARRIVAL_END = 2;
const BOARDING_END = 9;
const CYCLE_END = 11;
const MOVEMENT_KEYS = new Set([
  "arrowup",
  "arrowdown",
  "arrowleft",
  "arrowright",
  "w",
  "a",
  "s",
  "d",
  "shift",
]);

export function SubwayPlatform({
  origin,
  onBoard,
  onExit,
  turtleName,
}: SubwayPlatformProps) {
  const [cycleTime, setCycleTime] = useState(0);
  const stageRef = useRef<HTMLElement>(null);
  const turtleRef = useRef<HTMLDivElement>(null);
  const phaseRef = useRef<"waiting" | "arriving" | "boarding" | "departing">(
    "waiting",
  );
  const onBoardRef = useRef(onBoard);
  const station = subwayStations[origin];
  const phase =
    cycleTime < FIRST_ARRIVAL_TIME
      ? "waiting"
      : cycleTime < ARRIVAL_END
        ? "arriving"
        : cycleTime < BOARDING_END
          ? "boarding"
          : "departing";
  const firstArrival =
    phase === "boarding"
      ? "NOW"
      : phase === "arriving"
        ? "DUE"
        : `${Math.max(1, Math.ceil(FIRST_ARRIVAL_TIME - cycleTime))} SEC`;

  useEffect(() => {
    const interval = window.setInterval(() => {
      setCycleTime((current) => {
        const next = current + 0.25;
        return next >= CYCLE_END ? 0 : next;
      });
    }, 250);

    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  useEffect(() => {
    onBoardRef.current = onBoard;
  }, [onBoard]);

  useEffect(() => {
    const pressed = new Set<string>();
    const position = {
      x: window.innerWidth * 0.84,
      y: window.innerHeight * 0.93,
    };
    let previousTime = performance.now();
    let animationFrame = 0;

    function handleKeyDown(event: KeyboardEvent) {
      const key = event.key.toLowerCase();

      if (event.key === "Enter" && phaseRef.current === "boarding") {
        event.preventDefault();
        onBoardRef.current();
      } else if (MOVEMENT_KEYS.has(key)) {
        event.preventDefault();
        pressed.add(key);
      }
    }

    function handleKeyUp(event: KeyboardEvent) {
      pressed.delete(event.key.toLowerCase());
    }

    function clearInput() {
      pressed.clear();
    }

    function render(time: number) {
      const stage = stageRef.current;
      const turtle = turtleRef.current;

      if (!stage || !turtle) {
        animationFrame = window.requestAnimationFrame(render);
        return;
      }

      const delta = Math.min((time - previousTime) / 1000, 0.04);
      previousTime = time;
      const horizontal =
        Number(pressed.has("arrowright") || pressed.has("d")) -
        Number(pressed.has("arrowleft") || pressed.has("a"));
      const vertical =
        Number(pressed.has("arrowdown") || pressed.has("s")) -
        Number(pressed.has("arrowup") || pressed.has("w"));
      const length = Math.hypot(horizontal, vertical) || 1;
      const speed = pressed.has("shift") ? 270 : 190;
      const bounds = stage.getBoundingClientRect();

      position.x += (horizontal / length) * speed * delta;
      position.y += (vertical / length) * speed * delta;
      position.x = Math.min(
        Math.max(position.x, 62),
        Math.max(62, bounds.width - 62),
      );
      position.y = Math.min(
        Math.max(position.y, bounds.height * 0.76),
        Math.max(bounds.height * 0.76, bounds.height - 24),
      );

      turtle.style.transform = `translate3d(${position.x}px, ${position.y}px, 0) translate(-50%, -100%)`;
      animationFrame = window.requestAnimationFrame(render);
    }

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", clearInput);
    animationFrame = window.requestAnimationFrame(render);

    return () => {
      window.cancelAnimationFrame(animationFrame);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", clearInput);
    };
  }, []);

  return (
    <main
      ref={stageRef}
      className={`subway-stage is-${phase}`}
      data-testid="subway-platform"
      data-station={station.id}
    >
      <header className="subway-station-title">
        <span className="subway-line-badge">T</span>
        <div>
          <p>{station.neighborhood}</p>
          <h1>{station.name}</h1>
        </div>
      </header>

      <button type="button" className="subway-exit" onClick={onExit}>
        <span aria-hidden="true">←</span>
        Street
      </button>

      <section className="subway-arrivals" aria-label="Upcoming trains">
        <header>
          <div>
            <span className="subway-board-mark">TC</span>
            <strong>{station.platformDirection}</strong>
          </div>
          <time>
            {new Intl.DateTimeFormat("en-US", {
              hour: "numeric",
              minute: "2-digit",
            }).format(new Date())}
          </time>
        </header>
        <ol>
          <li className="is-next">
            <span className="subway-board-arrow">→</span>
            <span className="subway-board-line">T</span>
            <div>
              <strong>{station.terminus}</strong>
              <small>via Turtle City Local</small>
            </div>
            <b>{firstArrival}</b>
          </li>
          <li>
            <span className="subway-board-arrow">→</span>
            <span className="subway-board-line">T</span>
            <div>
              <strong>{station.terminus}</strong>
              <small>via Turtle City Local</small>
            </div>
            <b>20 SEC</b>
          </li>
          <li>
            <span className="subway-board-arrow">→</span>
            <span className="subway-board-line">T</span>
            <div>
              <strong>{station.terminus}</strong>
              <small>via Turtle City Local</small>
            </div>
            <b>35 SEC</b>
          </li>
        </ol>
        <footer>
          <strong>Good service</strong>
          <span>Trains are running on schedule.</span>
        </footer>
      </section>

      <div className="subway-track-wall" aria-hidden="true">
        <span>{station.name}</span>
      </div>
      <div className="subway-platform-edge" aria-hidden="true" />

      <section className="subway-train" aria-label="Turtle City subway train">
        <div className="subway-train-front">
          <span className="subway-line-badge">T</span>
          <small>{station.terminus}</small>
        </div>
        <div className="subway-train-windows" aria-hidden="true">
          <span />
          <span />
          <span />
          <span />
        </div>
        <button
          type="button"
          className="subway-train-door"
          disabled={phase !== "boarding"}
          onClick={onBoard}
        >
          <span />
          <span />
          <strong>{phase === "boarding" ? "Board train" : "Doors closed"}</strong>
        </button>
      </section>

      <div
        ref={turtleRef}
        className="subway-waiting-turtle"
        style={{ top: 0, right: "auto", bottom: "auto", left: 0 }}
        aria-hidden="true"
      >
        <span className="turtle-sprite" />
        <span className="turtle-nameplate">{turtleName}</span>
      </div>

      {phase === "boarding" ? (
        <aside className="subway-board-prompt" aria-live="polite">
          <div>
            <strong>T train now boarding</strong>
            <small>Press Enter to board and choose a destination.</small>
          </div>
          <button type="button" onClick={onBoard}>
            Board
          </button>
        </aside>
      ) : null}
    </main>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";

type SnowShovelingGameProps = {
  onExit: () => void;
};

type ShiftStatus = "ready" | "playing" | "finished";

type ShiftState = {
  x: number;
  y: number;
  facingX: number;
  facingY: number;
  timeLeft: number;
  status: ShiftStatus;
  cleared: Set<number>;
  startedAt: number;
};

type ShiftHud = {
  status: ShiftStatus;
  timeLeft: number;
  clearedPercent: number;
};

const YARD_WIDTH = 1200;
const YARD_HEIGHT = 720;
const SHIFT_LENGTH = 75;
const CLEAR_TARGET = 82;
const TURTLE_SPEED = 285;
const SHOVEL_RADIUS = 43;
const CELL_SIZE = 20;
const GRID_COLUMNS = Math.ceil(YARD_WIDTH / CELL_SIZE);
const GRID_ROWS = Math.ceil(YARD_HEIGHT / CELL_SIZE);

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

function isPathCell(column: number, row: number) {
  const x = column * CELL_SIZE + CELL_SIZE / 2;
  const y = row * CELL_SIZE + CELL_SIZE / 2;
  const verticalPath = x > 515 && x < 685 && y > 85 && y < 650;
  const crossPath = y > 270 && y < 435 && x > 155 && x < 1045;
  const gateApron =
    Math.hypot(x - 600, y - 635) < 145 ||
    Math.hypot(x - 190, y - 352) < 105 ||
    Math.hypot(x - 1010, y - 352) < 105;

  return verticalPath || crossPath || gateApron;
}

const pathCells = Array.from({ length: GRID_ROWS * GRID_COLUMNS }, (_, index) => {
  const column = index % GRID_COLUMNS;
  const row = Math.floor(index / GRID_COLUMNS);
  return isPathCell(column, row) ? index : -1;
}).filter((index) => index >= 0);

function createShiftState(status: ShiftStatus = "ready"): ShiftState {
  return {
    x: 600,
    y: 615,
    facingX: 0,
    facingY: -1,
    timeLeft: SHIFT_LENGTH,
    status,
    cleared: new Set<number>(),
    startedAt: performance.now(),
  };
}

function formatTime(seconds: number) {
  const safeSeconds = Math.max(0, Math.ceil(seconds));
  return `0:${String(safeSeconds).padStart(2, "0")}`;
}

function roundedRectangle(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  context.beginPath();
  context.roundRect(x, y, width, height, radius);
}

function drawYard(context: CanvasRenderingContext2D, state: ShiftState) {
  context.fillStyle = "#b9cec1";
  context.fillRect(0, 0, YARD_WIDTH, YARD_HEIGHT);

  context.fillStyle = "#9caf9c";
  context.fillRect(0, 0, YARD_WIDTH, 92);

  context.fillStyle = "#e7e9de";
  context.fillRect(515, 85, 170, 565);
  context.fillRect(155, 270, 890, 165);

  context.fillStyle = "#153530";
  context.fillRect(0, 78, YARD_WIDTH, 10);

  context.fillStyle = "#d88764";
  roundedRectangle(context, 55, 70, 315, 155, 8);
  context.fill();
  context.lineWidth = 8;
  context.strokeStyle = "#153530";
  context.stroke();

  context.fillStyle = "#153530";
  context.font = "900 28px system-ui, sans-serif";
  context.fillText("SNOW CREW", 90, 128);
  context.font = "italic 18px Georgia, serif";
  context.fillText("Central Park Maintenance", 90, 162);

  context.fillStyle = "#f1d898";
  roundedRectangle(context, 860, 92, 250, 118, 7);
  context.fill();
  context.strokeStyle = "#153530";
  context.lineWidth = 7;
  context.stroke();
  context.fillStyle = "#153530";
  context.font = "900 22px system-ui, sans-serif";
  context.fillText("TOOLS + SALT", 902, 158);

  context.fillStyle = "#456a56";
  for (const [x, y] of [
    [85, 305],
    [90, 560],
    [1100, 300],
    [1095, 565],
  ]) {
    context.beginPath();
    context.arc(x, y, 42, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = "#153530";
    context.lineWidth = 6;
    context.stroke();
  }

  for (const index of pathCells) {
    if (state.cleared.has(index)) {
      continue;
    }

    const column = index % GRID_COLUMNS;
    const row = Math.floor(index / GRID_COLUMNS);
    const x = column * CELL_SIZE;
    const y = row * CELL_SIZE;
    const variation = ((column * 17 + row * 31) % 9) / 9;

    context.fillStyle = variation > 0.5 ? "#f8f7ed" : "#eef3ed";
    context.fillRect(x - 1, y - 1, CELL_SIZE + 2, CELL_SIZE + 2);
  }

  context.strokeStyle = "rgb(21 53 48 / 22%)";
  context.lineWidth = 3;
  context.setLineDash([14, 15]);
  context.strokeRect(527, 96, 146, 542);
  context.strokeRect(166, 282, 868, 141);
  context.setLineDash([]);

  const piles = Math.floor(state.cleared.size / 34);
  for (let index = 0; index < Math.min(piles, 24); index += 1) {
    const side = index % 2 === 0 ? 1 : -1;
    const lane = Math.floor(index / 2);
    const pileX = side > 0 ? 730 + (lane % 3) * 17 : 470 - (lane % 3) * 17;
    const pileY = 215 + Math.floor(lane / 3) * 73;
    context.fillStyle = index % 3 === 0 ? "#f8f7ed" : "#e8efe8";
    context.beginPath();
    context.ellipse(pileX, pileY, 34, 17, side * 0.1, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = "rgb(21 53 48 / 25%)";
    context.lineWidth = 3;
    context.stroke();
  }
}

function drawTurtle(context: CanvasRenderingContext2D, state: ShiftState) {
  const angle = Math.atan2(state.facingY, state.facingX);
  const shovelX = state.x + state.facingX * 60;
  const shovelY = state.y + state.facingY * 60;

  context.save();
  context.translate(state.x, state.y);
  context.rotate(angle + Math.PI / 2);

  context.fillStyle = "rgb(21 53 48 / 20%)";
  context.beginPath();
  context.ellipse(0, 27, 43, 16, 0, 0, Math.PI * 2);
  context.fill();

  context.fillStyle = "#9d5948";
  context.beginPath();
  context.ellipse(0, 0, 39, 45, 0, 0, Math.PI * 2);
  context.fill();
  context.strokeStyle = "#153530";
  context.lineWidth = 6;
  context.stroke();

  context.fillStyle = "#6f8c55";
  context.beginPath();
  context.arc(0, -40, 26, 0, Math.PI * 2);
  context.fill();
  context.stroke();

  context.fillStyle = "#f8f7ed";
  context.beginPath();
  context.arc(-8, -47, 4, 0, Math.PI * 2);
  context.arc(8, -47, 4, 0, Math.PI * 2);
  context.fill();
  context.restore();

  context.strokeStyle = "#8f5f40";
  context.lineWidth = 9;
  context.lineCap = "round";
  context.beginPath();
  context.moveTo(state.x + state.facingX * 18, state.y + state.facingY * 18);
  context.lineTo(shovelX, shovelY);
  context.stroke();

  context.save();
  context.translate(shovelX, shovelY);
  context.rotate(angle);
  context.fillStyle = "#e8bd5f";
  roundedRectangle(context, -10, -35, 20, 70, 5);
  context.fill();
  context.strokeStyle = "#153530";
  context.lineWidth = 5;
  context.stroke();
  context.restore();
}

export function SnowShovelingGame({ onExit }: SnowShovelingGameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<ShiftState>(createShiftState());
  const [hud, setHud] = useState<ShiftHud>({
    status: "ready",
    timeLeft: SHIFT_LENGTH,
    clearedPercent: 0,
  });

  function startShift() {
    const next = createShiftState("playing");
    gameRef.current = next;
    setHud({ status: "playing", timeLeft: SHIFT_LENGTH, clearedPercent: 0 });
  }

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    const pressed = new Set<string>();
    let animationFrame = 0;
    let previousTime = performance.now();
    let previousHudUpdate = 0;

    function handleKeyDown(event: KeyboardEvent) {
      if (movementKeys.has(event.key) || event.code === "Space") {
        event.preventDefault();
        pressed.add(event.code === "Space" ? "space" : event.key.toLowerCase());
      }
    }

    function handleKeyUp(event: KeyboardEvent) {
      pressed.delete(event.code === "Space" ? "space" : event.key.toLowerCase());
    }

    function handleBlur() {
      pressed.clear();
    }

    function clearSnow(state: ShiftState) {
      const shovelX = state.x + state.facingX * 72;
      const shovelY = state.y + state.facingY * 72;

      for (const index of pathCells) {
        if (state.cleared.has(index)) {
          continue;
        }

        const column = index % GRID_COLUMNS;
        const row = Math.floor(index / GRID_COLUMNS);
        const cellX = column * CELL_SIZE + CELL_SIZE / 2;
        const cellY = row * CELL_SIZE + CELL_SIZE / 2;

        if (Math.hypot(cellX - shovelX, cellY - shovelY) <= SHOVEL_RADIUS) {
          state.cleared.add(index);
        }
      }
    }

    function update(time: number) {
      if (!context || !canvas) {
        animationFrame = requestAnimationFrame(update);
        return;
      }

      const state = gameRef.current;
      const elapsed = Math.min((time - previousTime) / 1000, 0.05);
      previousTime = time;

      if (state.status === "playing") {
        const horizontal =
          Number(pressed.has("arrowright") || pressed.has("d")) -
          Number(pressed.has("arrowleft") || pressed.has("a"));
        const vertical =
          Number(pressed.has("arrowdown") || pressed.has("s")) -
          Number(pressed.has("arrowup") || pressed.has("w"));
        const magnitude = Math.hypot(horizontal, vertical);

        if (magnitude > 0) {
          state.facingX = horizontal / magnitude;
          state.facingY = vertical / magnitude;
          state.x = clamp(
            state.x + state.facingX * TURTLE_SPEED * elapsed,
            65,
            YARD_WIDTH - 65,
          );
          state.y = clamp(
            state.y + state.facingY * TURTLE_SPEED * elapsed,
            105,
            YARD_HEIGHT - 55,
          );
        }

        if (pressed.has("space")) {
          clearSnow(state);
        }

        state.timeLeft = Math.max(
          0,
          SHIFT_LENGTH - (time - state.startedAt) / 1000,
        );
        const clearedPercent = (state.cleared.size / pathCells.length) * 100;

        if (clearedPercent >= CLEAR_TARGET || state.timeLeft <= 0) {
          state.status = "finished";
        }

        if (time - previousHudUpdate > 90 || state.status === "finished") {
          previousHudUpdate = time;
          setHud({
            status: state.status,
            timeLeft: state.timeLeft,
            clearedPercent,
          });
        }
      }

      drawYard(context, state);
      drawTurtle(context, state);
      animationFrame = requestAnimationFrame(update);
    }

    window.addEventListener("keydown", handleKeyDown, { passive: false });
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", handleBlur);
    animationFrame = requestAnimationFrame(update);

    return () => {
      cancelAnimationFrame(animationFrame);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", handleBlur);
    };
  }, []);

  const completed = hud.clearedPercent >= CLEAR_TARGET;

  return (
    <main className="shoveling-stage" data-testid="snow-shoveling-game">
      <canvas
        ref={canvasRef}
        className="shoveling-canvas"
        width={YARD_WIDTH}
        height={YARD_HEIGHT}
        aria-label="Snow Crew shoveling yard"
      />

      <button type="button" className="shoveling-exit" onClick={onExit}>
        <span aria-hidden="true">←</span>
        Central Park
      </button>

      <section className="shoveling-scoreboard" aria-live="polite">
        <div>
          <small>Path cleared</small>
          <strong>{Math.min(100, Math.floor(hud.clearedPercent))}%</strong>
        </div>
        <span aria-hidden="true">
          <i style={{ width: `${Math.min(100, hud.clearedPercent)}%` }} />
        </span>
        <time>{formatTime(hud.timeLeft)}</time>
      </section>

      {hud.status !== "playing" ? (
        <section className="shoveling-start-card">
          <p>Central Park Snow Crew</p>
          <h1>
            {hud.status === "ready"
              ? "Clear the paths"
              : completed
                ? "Paths open!"
                : "Shift over"}
          </h1>
          <span>
            {hud.status === "ready"
              ? "Move with WASD or the arrow keys. Hold Space while moving to push the snow into banks. Clear 82% before time runs out."
              : completed
                ? `You cleared ${Math.floor(hud.clearedPercent)}% of the yard. The morning turtles can get through.`
                : `You cleared ${Math.floor(hud.clearedPercent)}%. The next crew will finish the route.`}
          </span>
          <div className="shoveling-controls" aria-hidden="true">
            <b>WASD</b>
            <i>move</i>
            <b>SPACE</b>
            <i>shovel</i>
          </div>
          <button type="button" onClick={startShift}>
            {hud.status === "ready" ? "Start shift" : "Shovel again"}
          </button>
        </section>
      ) : null}
    </main>
  );
}

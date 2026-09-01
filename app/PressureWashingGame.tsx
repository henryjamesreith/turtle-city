"use client";

import { useEffect, useRef, useState } from "react";

type PressureWashingGameProps = {
  onExit: () => void;
  turtleName: string;
};

type ShiftStatus = "ready" | "playing" | "finished";

type DirtCell = {
  id: number;
  x: number;
  y: number;
  size: number;
  tone: number;
};

type WashState = {
  status: ShiftStatus;
  dirt: Map<number, number>;
  splashes: Array<{ x: number; y: number; life: number }>;
  aimX: number;
  aimY: number;
  spraying: boolean;
  startedAt: number;
  timeLeft: number;
  message: string;
};

type WashHud = {
  status: ShiftStatus;
  cleanedPercent: number;
  timeLeft: number;
  message: string;
};

const WALL_WIDTH = 1200;
const WALL_HEIGHT = 720;
const SHIFT_LENGTH = 90;
const CLEAN_TARGET = 100;
const SPRAY_RADIUS = 74;
const CELL_SIZE = 15;

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

function isInsideRectangle(
  x: number,
  y: number,
  rectangle: { x: number; y: number; width: number; height: number },
) {
  return (
    x >= rectangle.x &&
    x <= rectangle.x + rectangle.width &&
    y >= rectangle.y &&
    y <= rectangle.y + rectangle.height
  );
}

const protectedAreas = [
  { x: 125, y: 170, width: 190, height: 135 },
  { x: 392, y: 170, width: 190, height: 135 },
  { x: 658, y: 170, width: 190, height: 135 },
  { x: 925, y: 170, width: 150, height: 135 },
  { x: 470, y: 455, width: 260, height: 265 },
];

const dirtCells: DirtCell[] = [];

for (let y = 62; y < WALL_HEIGHT - 34; y += CELL_SIZE) {
  for (let x = 66; x < WALL_WIDTH - 66; x += CELL_SIZE) {
    if (protectedAreas.some((area) => isInsideRectangle(x, y, area))) {
      continue;
    }

    const id = dirtCells.length;
    const seed = (x * 17 + y * 29 + id * 13) % 101;
    dirtCells.push({
      id,
      x,
      y,
      size: 12 + (seed % 9),
      tone: seed % 3,
    });
  }
}

function createWashState(status: ShiftStatus = "ready"): WashState {
  return {
    status,
    dirt: new Map(dirtCells.map((cell) => [cell.id, 1])),
    splashes: [],
    aimX: WALL_WIDTH * 0.5,
    aimY: WALL_HEIGHT * 0.42,
    spraying: false,
    startedAt: 0,
    timeLeft: SHIFT_LENGTH,
    message: "",
  };
}

function cleanedPercent(state: WashState) {
  let remaining = 0;
  state.dirt.forEach((strength) => { remaining += strength; });
  return Math.min(100, Math.floor((1 - remaining / dirtCells.length) * 100));
}

function formatTime(seconds: number) {
  const safeSeconds = Math.max(0, Math.ceil(seconds));
  const minutes = Math.floor(safeSeconds / 60);
  const remainder = safeSeconds % 60;
  return `${minutes}:${String(remainder).padStart(2, "0")}`;
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

function drawWindow(
  context: CanvasRenderingContext2D,
  rectangle: { x: number; y: number; width: number; height: number },
) {
  context.fillStyle = "#153530";
  context.fillRect(
    rectangle.x - 7,
    rectangle.y - 7,
    rectangle.width + 14,
    rectangle.height + 14,
  );

  const reflection = context.createLinearGradient(
    rectangle.x,
    rectangle.y,
    rectangle.x + rectangle.width,
    rectangle.y + rectangle.height,
  );
  reflection.addColorStop(0, "#9fc9cf");
  reflection.addColorStop(0.46, "#668f94");
  reflection.addColorStop(0.48, "#dce2d3");
  reflection.addColorStop(0.57, "#789fa2");
  reflection.addColorStop(1, "#51787a");
  context.fillStyle = reflection;
  context.fillRect(
    rectangle.x,
    rectangle.y,
    rectangle.width,
    rectangle.height,
  );

  context.fillStyle = "rgb(248 242 223 / 72%)";
  context.fillRect(
    rectangle.x + rectangle.width * 0.48,
    rectangle.y,
    6,
    rectangle.height,
  );
  context.fillRect(
    rectangle.x,
    rectangle.y + rectangle.height * 0.48,
    rectangle.width,
    6,
  );
}

function drawFacade(context: CanvasRenderingContext2D) {
  const wall = context.createLinearGradient(0, 0, 0, WALL_HEIGHT);
  wall.addColorStop(0, "#a96353");
  wall.addColorStop(1, "#8f554a");
  context.fillStyle = wall;
  context.fillRect(0, 0, WALL_WIDTH, WALL_HEIGHT);

  context.strokeStyle = "rgb(248 242 223 / 19%)";
  context.lineWidth = 3;
  for (let y = 36; y < WALL_HEIGHT; y += 44) {
    context.beginPath();
    context.moveTo(0, y);
    context.lineTo(WALL_WIDTH, y);
    context.stroke();
  }
  for (let row = 0; row < 17; row += 1) {
    const offset = row % 2 === 0 ? 0 : 54;
    for (let x = offset; x < WALL_WIDTH; x += 108) {
      context.beginPath();
      context.moveTo(x, row * 44);
      context.lineTo(x, row * 44 + 44);
      context.stroke();
    }
  }

  context.fillStyle = "#153530";
  roundedRectangle(context, 368, 48, 464, 88, 8);
  context.fill();
  context.fillStyle = "#e7c15f";
  context.font = "900 35px Arial, sans-serif";
  context.textAlign = "center";
  context.fillText("LETTUCE & CO.", WALL_WIDTH / 2, 103);

  for (const area of protectedAreas.slice(0, 4)) {
    drawWindow(context, area);
  }

  context.fillStyle = "#153530";
  context.fillRect(445, 425, 310, 32);
  context.fillStyle = "#e4c367";
  context.fillRect(458, 435, 284, 45);
  context.fillStyle = "#f8f2df";
  context.font = "900 19px Arial, sans-serif";
  context.fillText("WASH CREW CHECK-IN", WALL_WIDTH / 2, 464);

  context.fillStyle = "#153530";
  context.fillRect(463, 480, 274, 240);
  const door = context.createLinearGradient(480, 500, 710, 690);
  door.addColorStop(0, "#416f6a");
  door.addColorStop(1, "#294f4b");
  context.fillStyle = door;
  context.fillRect(480, 497, 240, 223);
  context.fillStyle = "#d8bd73";
  context.beginPath();
  context.arc(686, 610, 9, 0, Math.PI * 2);
  context.fill();

  context.fillStyle = "#d1b789";
  context.fillRect(0, WALL_HEIGHT - 26, WALL_WIDTH, 26);
  context.fillStyle = "#153530";
  context.fillRect(0, WALL_HEIGHT - 32, WALL_WIDTH, 7);
}

function drawDirt(context: CanvasRenderingContext2D, state: WashState) {
  for (const cell of dirtCells) {
    const strength = state.dirt.get(cell.id);
    if (strength === undefined) {
      continue;
    }

    const colors = [
      "rgb(46 70 50 / 48%)",
      "rgb(77 75 47 / 45%)",
      "rgb(46 58 47 / 38%)",
    ];
    context.save();
    context.globalAlpha = Math.max(0.08, strength);
    context.fillStyle = colors[cell.tone];
    context.beginPath();
    context.ellipse(
      cell.x,
      cell.y,
      cell.size,
      cell.size * 0.72,
      (cell.id % 7) * 0.17,
      0,
      Math.PI * 2,
    );
    context.fill();
    context.restore();
  }
}

function drawSplashes(context: CanvasRenderingContext2D, state: WashState) {
  for (const splash of state.splashes) {
    context.strokeStyle = `rgb(234 255 255 / ${splash.life * 70}%)`;
    context.lineWidth = 3;
    context.beginPath();
    context.arc(splash.x, splash.y, (1 - splash.life) * 24 + 5, 0, Math.PI * 2);
    context.stroke();
  }
}

function drawWashedEdge(context: CanvasRenderingContext2D, state: WashState) {
  const wash = context.createRadialGradient(
    state.aimX,
    state.aimY,
    3,
    state.aimX,
    state.aimY,
    SPRAY_RADIUS,
  );
  wash.addColorStop(0, "rgb(212 244 244 / 34%)");
  wash.addColorStop(0.72, "rgb(167 221 224 / 13%)");
  wash.addColorStop(1, "transparent");
  context.fillStyle = wash;
  context.beginPath();
  context.arc(state.aimX, state.aimY, SPRAY_RADIUS, 0, Math.PI * 2);
  context.fill();
}

function drawSpray(context: CanvasRenderingContext2D, state: WashState) {
  const nozzleX = clamp(state.aimX + 112, 70, WALL_WIDTH - 50);
  const nozzleY = clamp(state.aimY + 96, 100, WALL_HEIGHT - 28);

  context.strokeStyle = "#153530";
  context.lineWidth = 14;
  context.lineCap = "round";
  context.beginPath();
  context.moveTo(nozzleX + 55, nozzleY + 46);
  context.lineTo(nozzleX, nozzleY);
  context.stroke();

  context.strokeStyle = "#d9c89f";
  context.lineWidth = 8;
  context.beginPath();
  context.moveTo(nozzleX, nozzleY);
  context.lineTo(state.aimX + 14, state.aimY + 12);
  context.stroke();

  if (state.spraying && state.status === "playing") {
    for (let stream = -3; stream <= 3; stream += 1) {
      context.strokeStyle =
        stream % 2 === 0
          ? "rgb(215 248 249 / 84%)"
          : "rgb(137 211 218 / 72%)";
      context.lineWidth = stream === 0 ? 7 : 3;
      context.beginPath();
      context.moveTo(state.aimX + 14, state.aimY + 12);
      context.lineTo(
        state.aimX + stream * 7,
        state.aimY + stream * 3,
      );
      context.stroke();
    }

    for (let droplet = 0; droplet < 13; droplet += 1) {
      const angle = (droplet / 13) * Math.PI * 2;
      const distance = 28 + ((droplet * 19) % 38);
      context.fillStyle = "rgb(206 244 246 / 78%)";
      context.beginPath();
      context.arc(
        state.aimX + Math.cos(angle) * distance,
        state.aimY + Math.sin(angle) * distance * 0.62,
        3 + (droplet % 3),
        0,
        Math.PI * 2,
      );
      context.fill();
    }
  }

  context.strokeStyle = state.spraying ? "#e7c15f" : "#f8f2df";
  context.lineWidth = 4;
  context.beginPath();
  context.arc(state.aimX, state.aimY, 17, 0, Math.PI * 2);
  context.stroke();
}

function washAtAim(state: WashState, elapsed: number) {
  const radiusSquared = SPRAY_RADIUS * SPRAY_RADIUS;
  for (const [cellId, strength] of state.dirt) {
    const cell = dirtCells[cellId];
    const horizontal = cell.x - state.aimX;
    const vertical = cell.y - state.aimY;
    const distanceSquared = horizontal * horizontal + vertical * vertical;
    if (distanceSquared <= radiusSquared) {
      const falloff = 1 - Math.sqrt(distanceSquared) / SPRAY_RADIUS;
      const nextStrength = strength - elapsed * (2.8 + falloff * 7.2);
      if (nextStrength > 0.015) {
        state.dirt.set(cellId, nextStrength);
      } else {
        state.dirt.delete(cellId);
        if (state.splashes.length < 24 && cellId % 3 === 0) {
          state.splashes.push({ x: cell.x, y: cell.y, life: 1 });
        }
      }
    }
  }
}

export function PressureWashingGame({
  onExit,
  turtleName,
}: PressureWashingGameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<WashState>(createWashState());
  const [hud, setHud] = useState<WashHud>({
    status: "ready",
    cleanedPercent: 0,
    timeLeft: SHIFT_LENGTH,
    message: "",
  });

  function beginShift() {
    const nextState = createWashState("playing");
    nextState.startedAt = performance.now();
    stateRef.current = nextState;
    setHud({
      status: "playing",
      cleanedPercent: 0,
      timeLeft: SHIFT_LENGTH,
      message: "",
    });
  }

  useEffect(() => {
    const pressed = new Set<string>();
    let animationFrame = 0;
    let previousTime = performance.now();
    let lastHudUpdate = 0;

    function updatePointer(event: PointerEvent) {
      const canvas = canvasRef.current;
      if (!canvas) {
        return;
      }

      const rectangle = canvas.getBoundingClientRect();
      stateRef.current.aimX = clamp(
        ((event.clientX - rectangle.left) / rectangle.width) * WALL_WIDTH,
        35,
        WALL_WIDTH - 35,
      );
      stateRef.current.aimY = clamp(
        ((event.clientY - rectangle.top) / rectangle.height) * WALL_HEIGHT,
        35,
        WALL_HEIGHT - 35,
      );
    }

    function handlePointerDown(event: PointerEvent) {
      if (stateRef.current.status !== "playing") {
        return;
      }
      updatePointer(event);
      stateRef.current.spraying = true;
      canvasRef.current?.setPointerCapture(event.pointerId);
      event.preventDefault();
    }

    function stopSpraying() {
      stateRef.current.spraying = false;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (movementKeys.has(event.key)) {
        pressed.add(event.key.toLowerCase());
        event.preventDefault();
      } else if (event.code === "Space") {
        if (stateRef.current.status === "playing") {
          stateRef.current.spraying = true;
          event.preventDefault();
        }
      }
    }

    function handleKeyUp(event: KeyboardEvent) {
      pressed.delete(event.key.toLowerCase());
      if (event.code === "Space") {
        stateRef.current.spraying = false;
      }
    }

    function clearInput() {
      pressed.clear();
      stateRef.current.spraying = false;
    }

    function update(time: number) {
      const context = canvasRef.current?.getContext("2d");
      const state = stateRef.current;
      const elapsed = Math.min((time - previousTime) / 1000, 0.05);
      previousTime = time;

      if (state.status === "playing") {
        const horizontal =
          Number(pressed.has("arrowright") || pressed.has("d")) -
          Number(pressed.has("arrowleft") || pressed.has("a"));
        const vertical =
          Number(pressed.has("arrowdown") || pressed.has("s")) -
          Number(pressed.has("arrowup") || pressed.has("w"));

        state.aimX = clamp(
          state.aimX + horizontal * 380 * elapsed,
          35,
          WALL_WIDTH - 35,
        );
        state.aimY = clamp(
          state.aimY + vertical * 380 * elapsed,
          35,
          WALL_HEIGHT - 35,
        );

        if (state.spraying) {
          washAtAim(state, elapsed);
        }

        state.splashes.forEach((splash) => { splash.life -= elapsed * 2.6; });
        state.splashes = state.splashes.filter((splash) => splash.life > 0);

        state.timeLeft = Math.max(
          0,
          SHIFT_LENGTH - (time - state.startedAt) / 1000,
        );
        const percent = cleanedPercent(state);

        if (state.dirt.size === 0) {
          state.status = "finished";
          state.spraying = false;
          state.message = "Every last patch is clean. Facade restored.";
        } else if (state.timeLeft <= 0) {
          state.message = "Overtime — keep washing until the whole facade shines.";
        }

        if (time - lastHudUpdate > 90 || state.status === "finished") {
          lastHudUpdate = time;
          setHud({
            status: state.status,
            cleanedPercent: percent,
            timeLeft: state.timeLeft,
            message: state.message,
          });
        }
      }

      if (context) {
        context.clearRect(0, 0, WALL_WIDTH, WALL_HEIGHT);
        drawFacade(context);
        drawDirt(context, state);
        drawSplashes(context, state);
        if (state.spraying && state.status === "playing") {
          drawWashedEdge(context, state);
        }
        drawSpray(context, state);
      }

      animationFrame = requestAnimationFrame(update);
    }

    const canvas = canvasRef.current;
    canvas?.addEventListener("pointermove", updatePointer);
    canvas?.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("pointerup", stopSpraying);
    window.addEventListener("pointercancel", stopSpraying);
    window.addEventListener("keydown", handleKeyDown, { passive: false });
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", clearInput);
    animationFrame = requestAnimationFrame(update);

    return () => {
      cancelAnimationFrame(animationFrame);
      canvas?.removeEventListener("pointermove", updatePointer);
      canvas?.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("pointerup", stopSpraying);
      window.removeEventListener("pointercancel", stopSpraying);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", clearInput);
    };
  }, []);

  const completed =
    hud.status === "finished" && hud.cleanedPercent >= CLEAN_TARGET;

  return (
    <main className="pressure-stage" data-testid="pressure-washing-game">
      <header className="pressure-scoreboard">
        <div>
          <p>Chelsea Wash Crew</p>
          <strong>{hud.cleanedPercent}% clean</strong>
        </div>
        <div className="pressure-progress" aria-hidden="true">
          <span style={{ width: `${hud.cleanedPercent}%` }} />
        </div>
        <div className="pressure-timer">
          <small>{hud.timeLeft <= 0 && hud.status === "playing" ? "Overtime" : "Shift"}</small>
          <strong>{hud.timeLeft <= 0 && hud.status === "playing" ? "KEEP GOING" : formatTime(hud.timeLeft)}</strong>
        </div>
      </header>

      <button type="button" className="pressure-exit" onClick={onExit}>
        <span aria-hidden="true">←</span>
        Chelsea
      </button>

      <section className="pressure-work-area" aria-label="Dirty brick facade">
        <canvas
          ref={canvasRef}
          width={WALL_WIDTH}
          height={WALL_HEIGHT}
          aria-label="Pressure wash the dirty Lettuce and Company facade"
        />
        <div
          className="pressure-worker"
          role="img"
          aria-label={`${turtleName} pressure washing`}
        >
          <span className="turtle-sprite" aria-hidden="true" />
          <span className="turtle-nameplate">{turtleName}</span>
        </div>
        <div className="pressure-machine" aria-hidden="true">
          <span />
        </div>
      </section>

      {hud.status === "ready" ? (
        <section className="pressure-start-card">
          <p>Chelsea job</p>
          <h1>Pressure Wash</h1>
          <span>
            Hold the mouse button and sweep across the grime. Wash every dirty
            patch—the job ends only when the building reaches 100%.
          </span>
          <small>Arrow keys or WASD aim · Space sprays · overtime never cuts you off</small>
          <button type="button" onClick={beginShift}>
            Start washing
          </button>
        </section>
      ) : null}

      {hud.status === "finished" ? (
        <section
          className={`pressure-result-card${completed ? " is-complete" : ""}`}
          aria-live="polite"
        >
          <p>{completed ? "Job complete" : "Shift complete"}</p>
          <h2>{hud.cleanedPercent}% clean</h2>
          <span>{hud.message}</span>
          <div>
            <button type="button" onClick={beginShift}>
              Wash again
            </button>
            <button type="button" onClick={onExit}>
              Return to Chelsea
            </button>
          </div>
        </section>
      ) : null}
    </main>
  );
}

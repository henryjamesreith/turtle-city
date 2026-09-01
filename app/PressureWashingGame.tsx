"use client";

import { useEffect, useRef, useState } from "react";
import { useGameReward } from "./GameEconomy";

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

const dirtCells: DirtCell[] = [];

for (let y = 54; y < WALL_HEIGHT - 34; y += CELL_SIZE) {
  for (let x = 54; x < WALL_WIDTH - 54; x += CELL_SIZE) {
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

function drawFacade(context: CanvasRenderingContext2D) {
  const sky = context.createLinearGradient(0, 0, 0, WALL_HEIGHT);
  sky.addColorStop(0, "#163c52");
  sky.addColorStop(0.58, "#2c7880");
  sky.addColorStop(1, "#ef9d57");
  context.fillStyle = sky;
  context.fillRect(0, 0, WALL_WIDTH, WALL_HEIGHT);

  // The reward for cleaning: a bold, hand-painted Chelsea community mural.
  context.fillStyle = "#f5cf58";
  context.beginPath();
  context.arc(1030, 125, 70, 0, Math.PI * 2);
  context.fill();
  context.strokeStyle = "#173b43";
  context.lineWidth = 12;
  context.beginPath();
  context.arc(1030, 125, 45, 0.25, Math.PI * 1.75);
  context.stroke();
  context.fillStyle = "#173b43";
  context.beginPath(); context.arc(1013, 111, 5, 0, Math.PI * 2); context.fill();
  context.beginPath(); context.arc(1046, 111, 5, 0, Math.PI * 2); context.fill();

  const buildings = [
    [35, 315, 120, 330, "#69445f"], [140, 245, 115, 400, "#d45d52"],
    [240, 360, 100, 285, "#315b72"], [326, 205, 125, 440, "#794c75"],
    [435, 295, 120, 350, "#df6b4e"], [545, 170, 105, 475, "#31566f"],
    [635, 330, 130, 315, "#9e5264"], [750, 230, 125, 415, "#d96450"],
    [860, 350, 115, 295, "#3b6170"], [960, 285, 110, 360, "#94536b"],
    [1060, 380, 110, 265, "#d76b4f"],
  ] as const;
  for (const [x, y, width, height, color] of buildings) {
    context.fillStyle = color; context.fillRect(x, y, width, height);
    context.fillStyle = "#f7ce69";
    for (let wy = y + 30; wy < y + height - 28; wy += 48) {
      for (let wx = x + 20; wx < x + width - 15; wx += 36) context.fillRect(wx, wy, 13, 20);
    }
  }

  context.fillStyle = "rgb(14 47 55 / 82%)";
  roundedRectangle(context, 185, 48, 830, 112, 18); context.fill();
  context.fillStyle = "#f8e8b0";
  context.font = "900 54px Arial, sans-serif";
  context.textAlign = "center";
  context.fillText("TURTLE CITY", WALL_WIDTH / 2, 122);
  context.font = "800 17px Arial, sans-serif";
  context.letterSpacing = "6px";
  context.fillText("SLOW DOWN · LOOK AROUND", WALL_WIDTH / 2, 148);
  context.letterSpacing = "0px";

  // A bright subway car cuts across the skyline and makes long clean strokes rewarding.
  context.fillStyle = "#f2c94e"; roundedRectangle(context, 145, 510, 910, 135, 22); context.fill();
  context.fillStyle = "#173b43"; context.fillRect(170, 532, 860, 70);
  for (let x = 192; x < 990; x += 92) {
    context.fillStyle = "#8fd0d1"; context.fillRect(x, 545, 60, 44);
    context.fillStyle = "#f7e8b0"; context.beginPath(); context.arc(x + 30, 574, 12, Math.PI, 0); context.fill();
  }
  context.fillStyle = "#d94d48"; context.beginPath(); context.arc(188, 625, 11, 0, Math.PI * 2); context.fill();
  context.font = "900 20px Arial, sans-serif"; context.fillStyle = "#173b43"; context.fillText("CHELSEA LOCAL", 600, 630);

  context.strokeStyle = "#f8e8b0"; context.lineWidth = 9; context.strokeRect(18, 18, WALL_WIDTH - 36, WALL_HEIGHT - 36);
  context.strokeStyle = "#e66f55"; context.lineWidth = 5; context.strokeRect(32, 32, WALL_WIDTH - 64, WALL_HEIGHT - 64);
}

function drawDirt(context: CanvasRenderingContext2D, state: WashState) {
  for (const cell of dirtCells) {
    const strength = state.dirt.get(cell.id);
    if (strength === undefined) {
      continue;
    }

    const colors = ["#4a4940", "#5a4d3d", "#3e4841"];
    context.save();
    context.globalAlpha = Math.max(0.08, strength);
    context.fillStyle = colors[cell.tone];
    context.fillRect(cell.x - CELL_SIZE / 2, cell.y - CELL_SIZE / 2, CELL_SIZE + 1, CELL_SIZE + 1);
    if (strength > .72 && cell.id % 11 === 0) {
      context.fillStyle = "rgb(28 40 34 / 35%)";
      context.beginPath(); context.arc(cell.x + 5, cell.y - 3, cell.size * .55, 0, Math.PI * 2); context.fill();
    }
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
          state.message = "Every last patch is clean. Chelsea's mural is back.";
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
  useGameReward("pressure-washing", completed);

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

      <section className="pressure-work-area" aria-label="Grime-covered Chelsea mural">
        <canvas
          ref={canvasRef}
          width={WALL_WIDTH}
          height={WALL_HEIGHT}
          aria-label="Pressure wash the grime to reveal the Turtle City mural"
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
          <p>Chelsea mural rescue</p>
          <h1>Reveal the city</h1>
          <span>
            A forgotten community mural is buried under years of city grime.
            Wash it clean to uncover the skyline, subway, and hidden turtles.
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

"use client";

import { useEffect, useRef, useState } from "react";

type SnowShovelingGameProps = {
  onExit: () => void;
  turtleImage: string;
  turtleName: string;
};

type ShiftStatus = "ready" | "playing" | "finished";

type SnowBank = {
  x: number;
  y: number;
  amount: number;
  seed: number;
};

type SnowFleck = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
};

type ShiftState = {
  x: number;
  y: number;
  facingX: number;
  facingY: number;
  timeLeft: number;
  status: ShiftStatus;
  cleared: Set<number>;
  shovelDown: boolean;
  shovelLoad: number;
  banks: SnowBank[];
  flecks: SnowFleck[];
  startedAt: number;
  message: string;
  messageUntil: number;
  stride: number;
};

type ShiftHud = {
  status: ShiftStatus;
  timeLeft: number;
  clearedPercent: number;
  shovelLoad: number;
  message: string;
};

const YARD_WIDTH = 1200;
const YARD_HEIGHT = 720;
const SHIFT_LENGTH = 90;
const CLEAR_TARGET = 72;
const WALK_SPEED = 255;
const PUSH_SPEED = 175;
const MAX_LOAD = 34;
const CELL_SIZE = 14;
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

function isPathPoint(x: number, y: number) {
  const verticalPath = x > 505 && x < 695 && y > 36 && y < 680;
  const crossPath = y > 250 && y < 455 && x > 105 && x < 1095;
  const southApron = Math.hypot(x - 600, y - 650) < 128;
  const westApron = Math.hypot(x - 115, y - 352) < 98;
  const eastApron = Math.hypot(x - 1085, y - 352) < 98;

  return verticalPath || crossPath || southApron || westApron || eastApron;
}

const pathCells = Array.from({ length: GRID_ROWS * GRID_COLUMNS }, (_, index) => {
  const column = index % GRID_COLUMNS;
  const row = Math.floor(index / GRID_COLUMNS);
  const x = column * CELL_SIZE + CELL_SIZE / 2;
  const y = row * CELL_SIZE + CELL_SIZE / 2;
  return isPathPoint(x, y) ? index : -1;
}).filter((index) => index >= 0);

function createShiftState(status: ShiftStatus = "ready"): ShiftState {
  return {
    x: 600,
    y: 625,
    facingX: 0,
    facingY: -1,
    timeLeft: SHIFT_LENGTH,
    status,
    cleared: new Set<number>(),
    shovelDown: false,
    shovelLoad: 0,
    banks: [],
    flecks: [],
    startedAt: performance.now(),
    message: "",
    messageUntil: 0,
    stride: 0,
  };
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

function drawSnowBank(
  context: CanvasRenderingContext2D,
  bank: SnowBank,
  index: number,
) {
  const size = 20 + Math.sqrt(bank.amount) * 7;
  context.save();
  context.translate(bank.x, bank.y);
  context.rotate(((bank.seed % 7) - 3) * 0.035);
  context.fillStyle = "rgb(21 53 48 / 12%)";
  context.beginPath();
  context.ellipse(6, 9, size * 1.05, size * 0.48, 0, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = index % 2 === 0 ? "#f7f6ed" : "#edf2ec";
  context.strokeStyle = "rgb(21 53 48 / 18%)";
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(-size, 8);
  context.quadraticCurveTo(-size * 0.68, -size * 0.6, -size * 0.18, -size * 0.27);
  context.quadraticCurveTo(size * 0.2, -size * 0.82, size * 0.58, -size * 0.3);
  context.quadraticCurveTo(size * 0.92, -size * 0.22, size, 8);
  context.closePath();
  context.fill();
  context.stroke();
  context.restore();
}

function drawYard(context: CanvasRenderingContext2D, state: ShiftState) {
  const sky = context.createLinearGradient(0, 0, 0, YARD_HEIGHT);
  sky.addColorStop(0, "#adc9bd");
  sky.addColorStop(1, "#c7d7ca");
  context.fillStyle = sky;
  context.fillRect(0, 0, YARD_WIDTH, YARD_HEIGHT);

  context.fillStyle = "#e4e1d4";
  context.fillRect(505, 0, 190, YARD_HEIGHT);
  context.fillRect(0, 250, YARD_WIDTH, 205);

  context.fillStyle = "rgb(21 53 48 / 12%)";
  for (let x = 518; x < 690; x += 38) {
    context.fillRect(x, 0, 2, YARD_HEIGHT);
  }
  for (let y = 264; y < 450; y += 38) {
    context.fillRect(0, y, YARD_WIDTH, 2);
  }

  context.strokeStyle = "#153530";
  context.lineWidth = 9;
  context.beginPath();
  context.moveTo(0, 28);
  context.lineTo(1200, 28);
  context.stroke();

  for (let x = 18; x < 1200; x += 64) {
    context.fillStyle = "#153530";
    context.fillRect(x, 18, 7, 42);
    context.strokeStyle = "#6f8c55";
    context.lineWidth = 5;
    context.beginPath();
    context.moveTo(x + 7, 47);
    context.lineTo(x + 57, 47);
    context.stroke();
  }

  for (const x of [248, 952]) {
    context.fillStyle = "#966744";
    roundedRectangle(context, x - 78, 104, 156, 36, 5);
    context.fill();
    context.strokeStyle = "#153530";
    context.lineWidth = 5;
    context.stroke();
    context.fillStyle = "#153530";
    context.fillRect(x - 62, 138, 9, 42);
    context.fillRect(x + 53, 138, 9, 42);
  }

  for (const x of [80, 1120]) {
    context.strokeStyle = "#153530";
    context.lineWidth = 8;
    context.beginPath();
    context.moveTo(x, 190);
    context.lineTo(x, 232);
    context.stroke();
    context.fillStyle = "#f1d898";
    context.beginPath();
    context.arc(x, 175, 18, 0, Math.PI * 2);
    context.fill();
    context.stroke();
  }

  for (const index of pathCells) {
    if (state.cleared.has(index)) {
      continue;
    }

    const column = index % GRID_COLUMNS;
    const row = Math.floor(index / GRID_COLUMNS);
    const x = column * CELL_SIZE + CELL_SIZE / 2;
    const y = row * CELL_SIZE + CELL_SIZE / 2;
    const variation = (column * 13 + row * 29) % 5;

    context.fillStyle = variation < 2 ? "#fbfaf3" : "#f0f4ef";
    context.beginPath();
    context.arc(
      x + (variation - 2) * 0.8,
      y + ((column + row) % 3) - 1,
      CELL_SIZE * 0.72,
      0,
      Math.PI * 2,
    );
    context.fill();
  }

  context.strokeStyle = "rgb(21 53 48 / 18%)";
  context.lineWidth = 3;
  context.setLineDash([10, 16]);
  context.strokeRect(520, 44, 160, 622);
  context.strokeRect(118, 266, 964, 173);
  context.setLineDash([]);

  for (const [x, y, rotation] of [
    [478, 112, -0.35],
    [722, 164, 0.4],
    [462, 514, 0.16],
    [737, 560, -0.2],
  ]) {
    context.save();
    context.translate(x, y);
    context.rotate(rotation);
    context.fillStyle = "#f8f7ed";
    context.beginPath();
    context.ellipse(0, 0, 48, 19, 0, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = "rgb(21 53 48 / 15%)";
    context.lineWidth = 2;
    context.stroke();
    context.restore();
  }

  state.banks.forEach((bank, index) => drawSnowBank(context, bank, index));

  for (const fleck of state.flecks) {
    context.globalAlpha = clamp(fleck.life * 1.8, 0, 1);
    context.fillStyle = "#ffffff";
    context.beginPath();
    context.arc(fleck.x, fleck.y, 2.5 + fleck.life * 2, 0, Math.PI * 2);
    context.fill();
  }
  context.globalAlpha = 1;
}

function drawShovel(
  context: CanvasRenderingContext2D,
  state: ShiftState,
) {
  const bladeDistance = state.shovelDown ? 68 : 47;
  const bladeX = state.x + state.facingX * bladeDistance;
  const bladeY = state.y + state.facingY * bladeDistance;
  const angle = Math.atan2(state.facingY, state.facingX);
  const loadRatio = state.shovelLoad / MAX_LOAD;

  context.strokeStyle = "#8b5d3d";
  context.lineWidth = 8;
  context.lineCap = "round";
  context.beginPath();
  context.moveTo(state.x + state.facingX * 4, state.y + state.facingY * 4 - 18);
  context.lineTo(bladeX - state.facingX * 8, bladeY - state.facingY * 8);
  context.stroke();

  context.save();
  context.translate(bladeX, bladeY);
  context.rotate(angle + Math.PI / 2);
  context.fillStyle = state.shovelDown ? "#e6b84f" : "#c8993f";
  context.strokeStyle = "#153530";
  context.lineWidth = 5;
  context.beginPath();
  context.moveTo(-32, -10);
  context.lineTo(32, -10);
  context.lineTo(27, 15);
  context.quadraticCurveTo(0, 24, -27, 15);
  context.closePath();
  context.fill();
  context.stroke();

  if (state.shovelLoad > 0) {
    context.fillStyle = "#fbfaf3";
    context.strokeStyle = "rgb(21 53 48 / 16%)";
    context.lineWidth = 2;
    context.beginPath();
    context.ellipse(0, -10, 16 + loadRatio * 26, 8 + loadRatio * 14, 0, 0, Math.PI * 2);
    context.fill();
    context.stroke();
  }
  context.restore();
}

function drawTurtle(
  context: CanvasRenderingContext2D,
  state: ShiftState,
  turtleImage: HTMLImageElement,
  turtleName: string,
) {
  const bob = state.status === "playing" ? Math.sin(state.stride) * 2 : 0;
  const facingLeft = state.facingX < -0.1;

  context.fillStyle = "rgb(21 53 48 / 18%)";
  context.beginPath();
  context.ellipse(state.x, state.y + 23, 42, 15, 0, 0, Math.PI * 2);
  context.fill();

  drawShovel(context, state);

  if (turtleImage.complete && turtleImage.naturalWidth > 0) {
    context.save();
    context.translate(state.x, state.y - 44 + bob);
    context.scale(facingLeft ? -1 : 1, 1);
    context.drawImage(turtleImage, -47, -91, 94, 149);
    context.restore();
  }

  context.save();
  context.font = '800 13px "Avenir Next", Avenir, sans-serif';
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.lineJoin = "round";
  context.lineWidth = 5;
  context.strokeStyle = "rgb(248 242 223 / 96%)";
  context.strokeText(turtleName, state.x, state.y - 146);
  context.fillStyle = "#153530";
  context.fillText(turtleName, state.x, state.y - 146);
  context.restore();
}

function shovelCenter(state: ShiftState) {
  return {
    x: state.x + state.facingX * 76,
    y: state.y + state.facingY * 76,
  };
}

function refillSnowAt(state: ShiftState, x: number, y: number, amount: number) {
  const candidates = [...state.cleared]
    .map((index) => {
      const column = index % GRID_COLUMNS;
      const row = Math.floor(index / GRID_COLUMNS);
      const cellX = column * CELL_SIZE + CELL_SIZE / 2;
      const cellY = row * CELL_SIZE + CELL_SIZE / 2;
      return { index, distance: Math.hypot(cellX - x, cellY - y) };
    })
    .filter(({ distance }) => distance < 78)
    .sort((first, second) => first.distance - second.distance)
    .slice(0, Math.ceil(amount));

  for (const candidate of candidates) {
    state.cleared.delete(candidate.index);
  }
}

function dumpShovel(state: ShiftState, time: number) {
  if (state.shovelLoad < 0.5) {
    return;
  }

  const center = shovelCenter(state);
  if (isPathPoint(center.x, center.y)) {
    refillSnowAt(state, center.x, center.y, state.shovelLoad);
    state.message = "That snow fell back onto the path";
    state.messageUntil = time + 1700;
  } else {
    state.banks.push({
      x: center.x,
      y: center.y,
      amount: state.shovelLoad,
      seed: state.banks.length * 19 + Math.round(center.x),
    });
    state.message = "Nice dump—keep building the bank";
    state.messageUntil = time + 1300;
  }
  state.shovelLoad = 0;
}

export function SnowShovelingGame({
  onExit,
  turtleImage: turtleImageSrc,
  turtleName,
}: SnowShovelingGameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<ShiftState>(createShiftState());
  const [hud, setHud] = useState<ShiftHud>({
    status: "ready",
    timeLeft: SHIFT_LENGTH,
    clearedPercent: 0,
    shovelLoad: 0,
    message: "",
  });

  function startShift() {
    const next = createShiftState("playing");
    gameRef.current = next;
    setHud({
      status: "playing",
      timeLeft: SHIFT_LENGTH,
      clearedPercent: 0,
      shovelLoad: 0,
      message: "Hold Space and push forward through the snow",
    });
  }

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    const turtleImage = new Image();
    turtleImage.src = turtleImageSrc;
    const pressed = new Set<string>();
    let animationFrame = 0;
    let previousTime = performance.now();
    let previousHudUpdate = 0;

    function handleKeyDown(event: KeyboardEvent) {
      if (movementKeys.has(event.key) || event.code === "Space") {
        event.preventDefault();
      }

      if (movementKeys.has(event.key)) {
        pressed.add(event.key.toLowerCase());
      } else if (event.code === "Space") {
        if (!event.repeat) {
          gameRef.current.shovelDown = true;
        }
        pressed.add("space");
      }
    }

    function handleKeyUp(event: KeyboardEvent) {
      if (event.code === "Space") {
        pressed.delete("space");
        gameRef.current.shovelDown = false;
        dumpShovel(gameRef.current, performance.now());
      } else {
        pressed.delete(event.key.toLowerCase());
      }
    }

    function handleBlur() {
      pressed.clear();
      gameRef.current.shovelDown = false;
    }

    function collectSnow(state: ShiftState, time: number) {
      const center = shovelCenter(state);
      let collected = 0;

      for (const index of pathCells) {
        if (state.cleared.has(index)) {
          continue;
        }

        const column = index % GRID_COLUMNS;
        const row = Math.floor(index / GRID_COLUMNS);
        const cellX = column * CELL_SIZE + CELL_SIZE / 2;
        const cellY = row * CELL_SIZE + CELL_SIZE / 2;
        const forward =
          (cellX - center.x) * state.facingX +
          (cellY - center.y) * state.facingY;
        const sideways = Math.abs(
          (cellX - center.x) * -state.facingY +
            (cellY - center.y) * state.facingX,
        );

        if (
          forward > -18 &&
          forward < 25 &&
          sideways < 38 &&
          state.shovelLoad < MAX_LOAD
        ) {
          state.cleared.add(index);
          state.shovelLoad += 0.72;
          collected += 1;
          if ((index + Math.floor(time)) % 3 === 0) {
            state.flecks.push({
              x: cellX,
              y: cellY,
              vx: state.facingX * 34 + (sideways - 18) * 0.8,
              vy: state.facingY * 34 - 28,
              life: 0.55,
            });
          }
        }
      }

      if (state.shovelLoad >= MAX_LOAD - 0.5 && collected > 0) {
        state.message = "Shovel is full—push to the grass and release Space";
        state.messageUntil = time + 2200;
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

      for (const fleck of state.flecks) {
        fleck.x += fleck.vx * elapsed;
        fleck.y += fleck.vy * elapsed;
        fleck.vy += 80 * elapsed;
        fleck.life -= elapsed;
      }
      state.flecks = state.flecks.filter((fleck) => fleck.life > 0);

      if (state.status === "playing") {
        const horizontal =
          Number(pressed.has("arrowright") || pressed.has("d")) -
          Number(pressed.has("arrowleft") || pressed.has("a"));
        const vertical =
          Number(pressed.has("arrowdown") || pressed.has("s")) -
          Number(pressed.has("arrowup") || pressed.has("w"));
        const magnitude = Math.hypot(horizontal, vertical);

        if (magnitude > 0) {
          const inputX = horizontal / magnitude;
          const inputY = vertical / magnitude;

          if (!state.shovelDown) {
            state.facingX = inputX;
            state.facingY = inputY;
          }

          const alignment = inputX * state.facingX + inputY * state.facingY;
          const pushingForward = state.shovelDown && alignment > 0.35;
          const loadResistance =
            1 - (state.shovelLoad / MAX_LOAD) * 0.42;
          const speed = state.shovelDown
            ? pushingForward
              ? PUSH_SPEED * loadResistance
              : 0
            : WALK_SPEED;

          state.x = clamp(
            state.x + (state.shovelDown ? state.facingX : inputX) * speed * elapsed,
            55,
            YARD_WIDTH - 55,
          );
          state.y = clamp(
            state.y + (state.shovelDown ? state.facingY : inputY) * speed * elapsed,
            82,
            YARD_HEIGHT - 48,
          );
          state.stride += speed * elapsed * 0.065;

          if (pushingForward) {
            collectSnow(state, time);
          }
        }

        state.timeLeft = Math.max(
          0,
          SHIFT_LENGTH - (time - state.startedAt) / 1000,
        );
        const clearedPercent = (state.cleared.size / pathCells.length) * 100;

        if (clearedPercent >= CLEAR_TARGET || state.timeLeft <= 0) {
          state.status = "finished";
          if (state.shovelLoad > 0) {
            dumpShovel(state, time);
          }
        }

        if (time - previousHudUpdate > 80 || state.status === "finished") {
          previousHudUpdate = time;
          setHud({
            status: state.status,
            timeLeft: state.timeLeft,
            clearedPercent,
            shovelLoad: state.shovelLoad,
            message: time < state.messageUntil ? state.message : "",
          });
        }
      }

      drawYard(context, state);
      drawTurtle(context, state, turtleImage, turtleName);
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
  }, [turtleImageSrc, turtleName]);

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
          <small>Route open</small>
          <strong>{Math.min(100, Math.floor(hud.clearedPercent))}%</strong>
        </div>
        <span aria-hidden="true">
          <i style={{ width: `${Math.min(100, hud.clearedPercent)}%` }} />
        </span>
        <time>{formatTime(hud.timeLeft)}</time>
      </section>

      {hud.status === "playing" ? (
        <>
          <aside className="shovel-load" aria-live="polite">
            <small>Shovel load</small>
            <span aria-hidden="true">
              <i style={{ width: `${(hud.shovelLoad / MAX_LOAD) * 100}%` }} />
            </span>
            <strong>{hud.shovelLoad >= MAX_LOAD - 1 ? "FULL" : "PUSH"}</strong>
          </aside>
          <p className="shoveling-coach">
            {hud.message || "Hold Space to lower the blade · Release off the path to dump"}
          </p>
        </>
      ) : null}

      {hud.status !== "playing" ? (
        <section className="shoveling-start-card">
          <p>Central Park Snow Crew</p>
          <h1>
            {hud.status === "ready"
              ? "Push. Load. Dump."
              : completed
                ? "Route open!"
                : "Shift over"}
          </h1>
          <span>
            {hud.status === "ready"
              ? "Line up a run, hold Space to lower your shovel, and push forward through the drift. A full blade gets heavy. Carry it onto the grass and release Space to build a snowbank."
              : completed
                ? `You opened ${Math.floor(hud.clearedPercent)}% of the route and left the snow where it belongs.`
                : `You opened ${Math.floor(hud.clearedPercent)}% of the route. The next crew will take it from here.`}
          </span>
          <div className="shoveling-controls" aria-hidden="true">
            <b>WASD</b>
            <i>line up</i>
            <b>HOLD SPACE</b>
            <i>push</i>
            <b>RELEASE</b>
            <i>dump</i>
          </div>
          <button type="button" onClick={startShift}>
            {hud.status === "ready" ? "Start shift" : "Shovel again"}
          </button>
        </section>
      ) : null}
    </main>
  );
}

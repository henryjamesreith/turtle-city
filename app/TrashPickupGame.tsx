"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";

type TrashPickupGameProps = {
  onExit: () => void;
  turtleName: string;
};

type CleanupStatus = "ready" | "playing" | "finished";
type LitterType = "bag" | "cup" | "paper";

type LitterItem = {
  id: number;
  type: LitterType;
  x: number;
  y: number;
};

type CleanupState = {
  collected: Set<number>;
  nearbyId: number | null;
  playerX: number;
  playerY: number;
  status: CleanupStatus;
  timeLeft: number;
};

type CleanupView = {
  collected: number[];
  nearbyId: number | null;
  playerX: number;
  playerY: number;
  status: CleanupStatus;
  timeLeft: number;
};

const SHIFT_LENGTH = 60;
const litter: LitterItem[] = [
  { id: 0, type: "cup", x: 17, y: 31 },
  { id: 1, type: "paper", x: 32, y: 25 },
  { id: 2, type: "bag", x: 49, y: 34 },
  { id: 3, type: "cup", x: 68, y: 24 },
  { id: 4, type: "paper", x: 84, y: 37 },
  { id: 5, type: "bag", x: 24, y: 55 },
  { id: 6, type: "paper", x: 41, y: 67 },
  { id: 7, type: "cup", x: 59, y: 53 },
  { id: 8, type: "bag", x: 76, y: 65 },
  { id: 9, type: "paper", x: 89, y: 57 },
  { id: 10, type: "cup", x: 13, y: 77 },
  { id: 11, type: "bag", x: 55, y: 82 },
];

function createCleanupState(status: CleanupStatus = "ready"): CleanupState {
  return {
    collected: new Set(),
    nearbyId: null,
    playerX: 50,
    playerY: 78,
    status,
    timeLeft: SHIFT_LENGTH,
  };
}

function createCleanupView(state: CleanupState): CleanupView {
  return {
    collected: [...state.collected],
    nearbyId: state.nearbyId,
    playerX: state.playerX,
    playerY: state.playerY,
    status: state.status,
    timeLeft: state.timeLeft,
  };
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), maximum);
}

function formatTime(seconds: number) {
  return `0:${String(Math.max(0, Math.ceil(seconds))).padStart(2, "0")}`;
}

export function TrashPickupGame({
  onExit,
  turtleName,
}: TrashPickupGameProps) {
  const stateRef = useRef<CleanupState>(createCleanupState());
  const [view, setView] = useState<CleanupView>(() =>
    createCleanupView(createCleanupState()),
  );

  function startCleanup() {
    const nextState = createCleanupState("playing");
    stateRef.current = nextState;
    setView(createCleanupView(nextState));
  }

  function collectNearby() {
    const state = stateRef.current;
    if (state.status !== "playing" || state.nearbyId === null) {
      return;
    }

    state.collected.add(state.nearbyId);
    state.nearbyId = null;
    if (state.collected.size === litter.length) {
      state.status = "finished";
    }
    setView(createCleanupView(state));
  }

  useEffect(() => {
    if (view.status !== "playing") {
      return;
    }

    const pressed = new Set<string>();
    let previousTime = performance.now();
    let lastViewUpdate = 0;
    let animationFrame = 0;

    function handleKeyDown(event: KeyboardEvent) {
      const key = event.key.toLowerCase();
      if (
        key === "arrowup" ||
        key === "arrowdown" ||
        key === "arrowleft" ||
        key === "arrowright" ||
        key === "w" ||
        key === "a" ||
        key === "s" ||
        key === "d"
      ) {
        event.preventDefault();
        pressed.add(key);
      } else if (event.code === "Space" && !event.repeat) {
        event.preventDefault();
        collectNearby();
      }
    }

    function handleKeyUp(event: KeyboardEvent) {
      pressed.delete(event.key.toLowerCase());
    }

    function clearInput() {
      pressed.clear();
    }

    function update(time: number) {
      const state = stateRef.current;
      const elapsed = Math.min((time - previousTime) / 1000, 0.05);
      previousTime = time;
      state.timeLeft = Math.max(0, state.timeLeft - elapsed);

      const horizontal =
        Number(pressed.has("arrowright") || pressed.has("d")) -
        Number(pressed.has("arrowleft") || pressed.has("a"));
      const vertical =
        Number(pressed.has("arrowdown") || pressed.has("s")) -
        Number(pressed.has("arrowup") || pressed.has("w"));
      const magnitude = Math.hypot(horizontal, vertical) || 1;
      state.playerX = clamp(
        state.playerX + (horizontal / magnitude) * 35 * elapsed,
        6,
        94,
      );
      state.playerY = clamp(
        state.playerY + (vertical / magnitude) * 48 * elapsed,
        20,
        86,
      );

      const nearby = litter
        .filter((item) => !state.collected.has(item.id))
        .map((item) => ({
          distance: Math.hypot(
            item.x - state.playerX,
            (item.y - state.playerY) * 1.4,
          ),
          item,
        }))
        .filter(({ distance }) => distance < 7)
        .sort((a, b) => a.distance - b.distance)[0]?.item;
      state.nearbyId = nearby?.id ?? null;

      if (state.timeLeft <= 0) {
        state.status = "finished";
        setView(createCleanupView(state));
        return;
      }

      if (time - lastViewUpdate >= 45) {
        setView(createCleanupView(state));
        lastViewUpdate = time;
      }

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
  }, [view.status]);

  const collectedIds = new Set(view.collected);
  const success = view.collected.length >= 10;

  return (
    <main className="trash-game-stage" data-testid="trash-pickup-game">
      <header className="trash-game-title">
        <p>Midtown Clean Team</p>
        <h1>Crossroads Cleanup</h1>
      </header>

      <button type="button" className="midtown-game-exit" onClick={onExit}>
        <span aria-hidden="true">&larr;</span>
        Midtown
      </button>

      <section className="trash-game-hud" aria-label="Cleanup status">
        <div>
          <small>Time</small>
          <strong>{formatTime(view.timeLeft)}</strong>
        </div>
        <div>
          <small>Collected</small>
          <strong>{view.collected.length} / {litter.length}</strong>
        </div>
      </section>

      <section className="trash-game-block" aria-label="Midtown cleanup block">
        <div className="trash-game-buildings" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <div className="trash-game-sidewalk" aria-hidden="true" />
        <div className="trash-game-curb" aria-hidden="true" />

        {litter.map((item) =>
          collectedIds.has(item.id) ? null : (
            <button
              key={item.id}
              type="button"
              className={`trash-item is-${item.type}${
                view.nearbyId === item.id ? " is-nearby" : ""
              }`}
              style={
                {
                  "--trash-x": `${item.x}%`,
                  "--trash-y": `${item.y}%`,
                  "--trash-turn": `${item.id * 31 - 70}deg`,
                } as CSSProperties
              }
              aria-label={`Pick up ${item.type}`}
              onClick={() => {
                if (view.nearbyId === item.id) {
                  collectNearby();
                }
              }}
            />
          ),
        )}

        <div
          className="trash-game-player"
          style={
            {
              "--cleanup-player-x": `${view.playerX}%`,
              "--cleanup-player-y": `${view.playerY}%`,
            } as CSSProperties
          }
        >
          <span className="turtle-sprite" aria-hidden="true" />
          <span className="turtle-nameplate">{turtleName}</span>
          <i aria-hidden="true" />
        </div>
      </section>

      {view.nearbyId !== null && view.status === "playing" ? (
        <aside className="trash-pickup-prompt" aria-live="polite">
          <div>
            <strong>Litter nearby</strong>
            <small>Press Space to add it to the cart.</small>
          </div>
          <button type="button" onClick={collectNearby}>
            Pick up
          </button>
        </aside>
      ) : null}

      {view.status === "ready" ? (
        <section className="midtown-game-overlay">
          <p>One block, one clean sweep</p>
          <h2>Clean the crossroads</h2>
          <span>
            Move with WASD or the arrow keys. Press Space beside litter. Clear
            at least 10 pieces before the shift ends.
          </span>
          <button type="button" onClick={startCleanup}>
            Start shift
          </button>
        </section>
      ) : null}

      {view.status === "finished" ? (
        <section className="midtown-game-overlay is-finished">
          <p>{success ? "Block cleared" : "Shift over"}</p>
          <h2>{view.collected.length} pieces collected</h2>
          <span>
            {success
              ? "Midtown is looking sharp again."
              : "The evening crowd left a few behind."}
          </span>
          <div>
            <button type="button" onClick={startCleanup}>
              Clean again
            </button>
            <button type="button" onClick={onExit}>
              Return to Midtown
            </button>
          </div>
        </section>
      ) : null}
    </main>
  );
}

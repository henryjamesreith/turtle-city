"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";

type FallingItemsGameProps = {
  onExit: () => void;
  turtleName: string;
};

type ChallengeStatus = "ready" | "playing" | "finished";
type FallingItemType = "coffee" | "coin" | "playbill" | "sign";

type FallingItem = {
  id: number;
  type: FallingItemType;
  x: number;
  y: number;
};

type ChallengeState = {
  dodged: number;
  elapsed: number;
  items: FallingItem[];
  lives: number;
  message: string;
  nextItemId: number;
  playerX: number;
  spawnCooldown: number;
  status: ChallengeStatus;
};

type ChallengeView = Pick<
  ChallengeState,
  "dodged" | "elapsed" | "items" | "lives" | "message" | "playerX" | "status"
>;

const CHALLENGE_LENGTH = 45;
const itemTypes: FallingItemType[] = [
  "coin",
  "coffee",
  "playbill",
  "sign",
];

function createChallengeState(status: ChallengeStatus = "ready"): ChallengeState {
  return {
    dodged: 0,
    elapsed: 0,
    items: [],
    lives: 3,
    message: "",
    nextItemId: 0,
    playerX: 50,
    spawnCooldown: 0.35,
    status,
  };
}

function createChallengeView(state: ChallengeState): ChallengeView {
  return {
    dodged: state.dodged,
    elapsed: state.elapsed,
    items: [...state.items],
    lives: state.lives,
    message: state.message,
    playerX: state.playerX,
    status: state.status,
  };
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), maximum);
}

function formatTime(seconds: number) {
  return `0:${String(Math.max(0, Math.ceil(seconds))).padStart(2, "0")}`;
}

export function FallingItemsGame({
  onExit,
  turtleName,
}: FallingItemsGameProps) {
  const stateRef = useRef<ChallengeState>(createChallengeState());
  const [view, setView] = useState<ChallengeView>(() =>
    createChallengeView(createChallengeState()),
  );

  function startChallenge() {
    const nextState = createChallengeState("playing");
    stateRef.current = nextState;
    setView(createChallengeView(nextState));
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
        key === "arrowleft" ||
        key === "arrowright" ||
        key === "a" ||
        key === "d"
      ) {
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

    function update(time: number) {
      const state = stateRef.current;
      const elapsed = Math.min((time - previousTime) / 1000, 0.05);
      previousTime = time;
      state.elapsed += elapsed;
      state.spawnCooldown -= elapsed;
      state.message = "";

      const direction =
        Number(pressed.has("arrowright") || pressed.has("d")) -
        Number(pressed.has("arrowleft") || pressed.has("a"));
      state.playerX = clamp(state.playerX + direction * 48 * elapsed, 7, 93);

      if (state.spawnCooldown <= 0) {
        const id = state.nextItemId;
        state.items.push({
          id,
          type: itemTypes[id % itemTypes.length],
          x: 8 + ((id * 37) % 84),
          y: -10,
        });
        state.nextItemId += 1;
        state.spawnCooldown = Math.max(0.34, 0.72 - state.elapsed * 0.006);
      }

      const fallSpeed = 28 + state.elapsed * 0.28;
      const remainingItems: FallingItem[] = [];
      for (const item of state.items) {
        item.y += fallSpeed * elapsed;
        const hitPlayer =
          item.y >= 76 &&
          item.y <= 92 &&
          Math.abs(item.x - state.playerX) < 6.5;

        if (hitPlayer) {
          state.lives -= 1;
          state.message = "Ouch! Keep moving.";
        } else if (item.y > 103) {
          state.dodged += 1;
        } else {
          remainingItems.push(item);
        }
      }
      state.items = remainingItems;

      if (state.lives <= 0 || state.elapsed >= CHALLENGE_LENGTH) {
        state.status = "finished";
        setView(createChallengeView(state));
        return;
      }

      if (time - lastViewUpdate >= 45) {
        setView(createChallengeView(state));
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

  return (
    <main className="falling-game-stage" data-testid="falling-items-game">
      <header className="falling-game-title">
        <p>Empire Shell Building</p>
        <h1>Look Out Below!</h1>
      </header>

      <button type="button" className="midtown-game-exit" onClick={onExit}>
        <span aria-hidden="true">&larr;</span>
        Midtown
      </button>

      <section className="falling-game-hud" aria-label="Challenge status">
        <div>
          <small>Time</small>
          <strong>{formatTime(CHALLENGE_LENGTH - view.elapsed)}</strong>
        </div>
        <div>
          <small>Dodged</small>
          <strong>{view.dodged}</strong>
        </div>
        <div>
          <small>Hard hats</small>
          <strong>{view.lives} / 3</strong>
        </div>
      </section>

      <section className="falling-game-scene" aria-label="Falling object challenge">
        <div className="falling-tower" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <div className="falling-street" aria-hidden="true" />

        {view.items.map((item) => (
          <span
            key={item.id}
            className={`falling-item is-${item.type}`}
            style={
              {
                "--item-x": `${item.x}%`,
                "--item-y": `${item.y}%`,
                "--item-turn": `${item.id * 47}deg`,
              } as CSSProperties
            }
            aria-hidden="true"
          />
        ))}

        <div
          className="falling-player"
          data-facing="right"
          style={{ "--player-x": `${view.playerX}%` } as CSSProperties}
        >
          <span className="turtle-sprite" aria-hidden="true" />
          <span className="turtle-nameplate">{turtleName}</span>
          <i aria-hidden="true" />
        </div>

        {view.message ? (
          <strong className="falling-game-message" role="status">
            {view.message}
          </strong>
        ) : null}
      </section>

      {view.status === "ready" ? (
        <section className="midtown-game-overlay">
          <p>Street-level safety challenge</p>
          <h2>Survive the sidewalk</h2>
          <span>
            Move with A/D or the arrow keys. Dodge coins, coffee, playbills,
            and loose signs for 45 seconds.
          </span>
          <button type="button" onClick={startChallenge}>
            Start challenge
          </button>
        </section>
      ) : null}

      {view.status === "finished" ? (
        <section className="midtown-game-overlay is-finished">
          <p>{view.lives > 0 ? "Shift complete" : "Hard-hat break"}</p>
          <h2>{view.dodged} items dodged</h2>
          <span>
            {view.lives > 0
              ? "You made it through the Midtown rush."
              : "That sidewalk got the better of you. Try another route."}
          </span>
          <div>
            <button type="button" onClick={startChallenge}>
              Try again
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

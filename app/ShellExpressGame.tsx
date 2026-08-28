"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";

type ShellExpressGameProps = {
  onExit: () => void;
  turtleName: string;
};

type RouteStatus = "ready" | "playing" | "finished";
type RouteItemType = "barrier" | "cab" | "dropoff" | "package" | "steam";

type RouteItem = {
  id: number;
  lane: number;
  type: RouteItemType;
  y: number;
};

type RouteState = {
  cargo: number;
  delivered: number;
  distance: number;
  elapsed: number;
  items: RouteItem[];
  lane: number;
  lives: number;
  message: string;
  nextItemId: number;
  spawnCooldown: number;
  status: RouteStatus;
};

type RouteView = Pick<
  RouteState,
  | "cargo"
  | "delivered"
  | "distance"
  | "elapsed"
  | "items"
  | "lane"
  | "lives"
  | "message"
  | "status"
>;

const ROUTE_LENGTH = 5200;
const ROUTE_TIME = 60;
const DELIVERY_TARGET = 6;
const routeSequence: RouteItemType[] = [
  "package",
  "barrier",
  "package",
  "cab",
  "dropoff",
  "steam",
  "package",
  "barrier",
  "package",
  "dropoff",
  "cab",
  "package",
];

function createRouteState(status: RouteStatus = "ready"): RouteState {
  return {
    cargo: 0,
    delivered: 0,
    distance: 0,
    elapsed: 0,
    items: [],
    lane: 1,
    lives: 3,
    message: "",
    nextItemId: 0,
    spawnCooldown: 0.55,
    status,
  };
}

function createRouteView(state: RouteState): RouteView {
  return {
    cargo: state.cargo,
    delivered: state.delivered,
    distance: state.distance,
    elapsed: state.elapsed,
    items: state.items.map((item) => ({ ...item })),
    lane: state.lane,
    lives: state.lives,
    message: state.message,
    status: state.status,
  };
}

function formatTime(seconds: number) {
  return `0:${String(Math.max(0, Math.ceil(seconds))).padStart(2, "0")}`;
}

export function ShellExpressGame({
  onExit,
  turtleName,
}: ShellExpressGameProps) {
  const stateRef = useRef<RouteState>(createRouteState());
  const [view, setView] = useState<RouteView>(() =>
    createRouteView(createRouteState()),
  );

  function startRoute() {
    const nextState = createRouteState("playing");
    stateRef.current = nextState;
    setView(createRouteView(nextState));
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

      if ((key === "arrowleft" || key === "a") && !event.repeat) {
        event.preventDefault();
        stateRef.current.lane = Math.max(0, stateRef.current.lane - 1);
      } else if ((key === "arrowright" || key === "d") && !event.repeat) {
        event.preventDefault();
        stateRef.current.lane = Math.min(2, stateRef.current.lane + 1);
      } else if (
        key === "arrowup" ||
        key === "w" ||
        event.code === "Space"
      ) {
        event.preventDefault();
        pressed.add("boost");
      }
    }

    function handleKeyUp(event: KeyboardEvent) {
      const key = event.key.toLowerCase();
      if (key === "arrowup" || key === "w" || event.code === "Space") {
        pressed.delete("boost");
      }
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

      const isBoosting = pressed.has("boost");
      const speed = isBoosting ? 108 : 76;
      state.distance = Math.min(ROUTE_LENGTH, state.distance + speed * elapsed);

      if (state.spawnCooldown <= 0) {
        const id = state.nextItemId;
        const type = routeSequence[id % routeSequence.length];
        state.items.push({
          id,
          lane: (id * 2 + Math.floor(id / 3)) % 3,
          type,
          y: -12,
        });
        state.nextItemId += 1;
        state.spawnCooldown = type === "dropoff" ? 0.82 : 0.58;
      }

      const itemSpeed = isBoosting ? 49 : 37;
      const remainingItems: RouteItem[] = [];
      for (const item of state.items) {
        item.y += itemSpeed * elapsed;
        const hit =
          item.lane === state.lane && item.y >= 72 && item.y <= 90;

        if (hit && item.type === "package") {
          state.cargo = Math.min(3, state.cargo + 1);
          state.message = state.cargo === 3 ? "Cargo box full" : "Parcel secured";
        } else if (hit && item.type === "dropoff") {
          if (state.cargo > 0) {
            state.delivered += state.cargo;
            state.message = `${state.cargo} delivered`;
            state.cargo = 0;
          } else {
            state.message = "No parcels to drop";
          }
        } else if (
          hit &&
          (item.type === "barrier" ||
            item.type === "cab" ||
            item.type === "steam")
        ) {
          state.lives -= 1;
          state.message = "Route slowed down";
        } else if (item.y <= 108) {
          remainingItems.push(item);
        }
      }
      state.items = remainingItems;

      if (
        state.lives <= 0 ||
        state.elapsed >= ROUTE_TIME ||
        state.distance >= ROUTE_LENGTH
      ) {
        state.status = "finished";
        setView(createRouteView(state));
        return;
      }

      if (time - lastViewUpdate >= 45) {
        setView(createRouteView(state));
        state.message = "";
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

  const success = view.delivered >= DELIVERY_TARGET;

  return (
    <main
      className="shell-express-stage"
      data-testid="shell-express-game"
      tabIndex={-1}
    >
      <header className="shell-express-title">
        <p>FiDi Courier Dispatch</p>
        <h1>Shell Express</h1>
      </header>

      <button type="button" className="fidi-game-exit" onClick={onExit}>
        <span aria-hidden="true">&larr;</span>
        FiDi
      </button>

      <section className="shell-express-hud" aria-label="Delivery route status">
        <div>
          <small>Time</small>
          <strong>{formatTime(ROUTE_TIME - view.elapsed)}</strong>
        </div>
        <div>
          <small>Delivered</small>
          <strong>{view.delivered} / {DELIVERY_TARGET}</strong>
        </div>
        <div>
          <small>Cargo</small>
          <strong>{view.cargo} / 3</strong>
        </div>
        <div>
          <small>Helmets</small>
          <strong>{view.lives} / 3</strong>
        </div>
      </section>

      <section className="shell-express-scene" aria-label="Downtown delivery route">
        <div className="shell-express-skyline" aria-hidden="true">
          <span />
          <span />
          <span />
          <span />
          <span />
        </div>
        <div className="shell-express-road" aria-hidden="true">
          <span />
          <span />
        </div>

        {view.items.map((item) => (
          <span
            key={item.id}
            className={`delivery-route-item is-${item.type}`}
            style={
              {
                "--route-x": `${34 + item.lane * 16}%`,
                "--route-y": `${item.y}%`,
              } as CSSProperties
            }
            aria-hidden="true"
          >
            {item.type === "package"
              ? "TC"
              : item.type === "dropoff"
                ? "DROP"
                : ""}
          </span>
        ))}

        <div
          className="shell-express-player"
          style={{ "--player-x": `${34 + view.lane * 16}%` } as CSSProperties}
        >
          <span className="turtle-sprite" aria-hidden="true" />
          <span className="turtle-nameplate">{turtleName}</span>
          <i className="shell-express-board" aria-hidden="true" />
          <i className="shell-express-cargo" aria-hidden="true">
            {view.cargo}
          </i>
        </div>

        <div className="shell-express-progress" aria-hidden="true">
          <span
            style={{
              width: `${Math.min(100, (view.distance / ROUTE_LENGTH) * 100)}%`,
            }}
          />
        </div>

        {view.message ? (
          <strong className="shell-express-message" role="status">
            {view.message}
          </strong>
        ) : null}
      </section>

      {view.status === "ready" ? (
        <section className="fidi-game-overlay">
          <p>Downtown route 01</p>
          <h2>Deliver against the clock</h2>
          <span>
            Switch lanes with A/D or the arrow keys. Collect parcels, cross
            green drop zones, and hold W, Up, or Space to move faster.
          </span>
          <button type="button" onClick={startRoute}>
            Start delivery
          </button>
        </section>
      ) : null}

      {view.status === "finished" ? (
        <section className="fidi-game-overlay is-finished">
          <p>{success ? "Route complete" : "Dispatch closed"}</p>
          <h2>{view.delivered} parcels delivered</h2>
          <span>
            {success
              ? "Every package made it through the downtown rush."
              : "Dispatch needed six deliveries. Take the next route cleaner and faster."}
          </span>
          <div>
            <button type="button" onClick={startRoute}>
              Run it again
            </button>
            <button type="button" onClick={onExit}>
              Return to FiDi
            </button>
          </div>
        </section>
      ) : null}
    </main>
  );
}

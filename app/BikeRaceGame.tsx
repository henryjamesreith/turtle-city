"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";

type BikeRaceGameProps = {
  onExit: () => void;
  turtleName: string;
};

type RaceStatus = "ready" | "racing" | "finished";

type RaceState = {
  boost: number;
  distance: number;
  elapsed: number;
  hitObstacles: Set<number>;
  lane: number;
  message: string;
  opponents: [number, number];
  slowTime: number;
};

type RaceView = {
  boost: number;
  distance: number;
  elapsed: number;
  lane: number;
  message: string;
  opponents: [number, number];
};

const COURSE_LENGTH = 6200;
const PLAYER_SPEED = 290;
const SPRINT_SPEED = 385;
const OPPONENT_SPEEDS = [306, 319] as const;
const LANE_TOPS = [53, 70, 87] as const;
const obstacles = [
  { distance: 920, lane: 1, type: "cone" },
  { distance: 1540, lane: 2, type: "puddle" },
  { distance: 2280, lane: 0, type: "cone" },
  { distance: 3020, lane: 1, type: "crate" },
  { distance: 3860, lane: 2, type: "cone" },
  { distance: 4510, lane: 0, type: "puddle" },
  { distance: 5280, lane: 1, type: "crate" },
] as const;

function createRaceState(): RaceState {
  return {
    boost: 100,
    distance: 0,
    elapsed: 0,
    hitObstacles: new Set(),
    lane: 1,
    message: "",
    opponents: [0, 0],
    slowTime: 0,
  };
}

function createRaceView(race: RaceState): RaceView {
  return {
    boost: race.boost,
    distance: race.distance,
    elapsed: race.elapsed,
    lane: race.lane,
    message: race.message,
    opponents: [...race.opponents] as [number, number],
  };
}

function formatTime(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainder = Math.floor(seconds % 60);
  const tenths = Math.floor((seconds % 1) * 10);
  return `${minutes}:${String(remainder).padStart(2, "0")}.${tenths}`;
}

function placeLabel(place: number) {
  if (place === 1) {
    return "1st";
  }

  if (place === 2) {
    return "2nd";
  }

  return "3rd";
}

export function BikeRaceGame({
  onExit,
  turtleName,
}: BikeRaceGameProps) {
  const raceRef = useRef<RaceState>(createRaceState());
  const [status, setStatus] = useState<RaceStatus>("ready");
  const [view, setView] = useState<RaceView>(() =>
    createRaceView(createRaceState()),
  );
  const [finishPlace, setFinishPlace] = useState(1);

  function startRace() {
    raceRef.current = createRaceState();
    setView(createRaceView(raceRef.current));
    setFinishPlace(1);
    setStatus("racing");
  }

  useEffect(() => {
    if (status !== "racing") {
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
        key === "w" ||
        key === "s" ||
        event.code === "Space"
      ) {
        event.preventDefault();
      }

      if (!event.repeat && (key === "arrowup" || key === "w")) {
        raceRef.current.lane = Math.max(0, raceRef.current.lane - 1);
      } else if (!event.repeat && (key === "arrowdown" || key === "s")) {
        raceRef.current.lane = Math.min(2, raceRef.current.lane + 1);
      }

      if (event.code === "Space") {
        pressed.add("sprint");
      }
    }

    function handleKeyUp(event: KeyboardEvent) {
      if (event.code === "Space") {
        pressed.delete("sprint");
      }
    }

    function clearInput() {
      pressed.clear();
    }

    function update(time: number) {
      const race = raceRef.current;
      const elapsed = Math.min((time - previousTime) / 1000, 0.05);
      previousTime = time;
      race.elapsed += elapsed;
      race.slowTime = Math.max(0, race.slowTime - elapsed);

      const sprinting = pressed.has("sprint") && race.boost > 0;
      if (sprinting) {
        race.boost = Math.max(0, race.boost - elapsed * 21);
      } else {
        race.boost = Math.min(100, race.boost + elapsed * 10);
      }

      const targetSpeed =
        race.slowTime > 0
          ? 185
          : sprinting
            ? SPRINT_SPEED
            : PLAYER_SPEED;
      race.distance = Math.min(
        COURSE_LENGTH,
        race.distance + targetSpeed * elapsed,
      );
      race.opponents[0] = Math.min(
        COURSE_LENGTH,
        race.opponents[0] +
          (OPPONENT_SPEEDS[0] + Math.sin(race.elapsed * 1.4) * 13) * elapsed,
      );
      race.opponents[1] = Math.min(
        COURSE_LENGTH,
        race.opponents[1] +
          (OPPONENT_SPEEDS[1] + Math.cos(race.elapsed * 1.1) * 11) * elapsed,
      );

      for (const [index, obstacle] of obstacles.entries()) {
        if (
          !race.hitObstacles.has(index) &&
          obstacle.lane === race.lane &&
          obstacle.distance - race.distance < 55 &&
          obstacle.distance - race.distance > -35
        ) {
          race.hitObstacles.add(index);
          race.slowTime = 0.9;
          race.distance = Math.max(0, race.distance - 75);
          race.message =
            obstacle.type === "puddle"
              ? "Slippery!"
              : obstacle.type === "crate"
                ? "Watch the delivery!"
                : "Traffic cone!";
        }
      }

      if (race.message && race.slowTime <= 0.15) {
        race.message = "";
      }

      if (time - lastViewUpdate > 45) {
        setView(createRaceView(race));
        lastViewUpdate = time;
      }

      if (race.distance >= COURSE_LENGTH) {
        const place =
          1 +
          race.opponents.filter((distance) => distance >= COURSE_LENGTH).length;
        setFinishPlace(place);
        setView(createRaceView(race));
        setStatus("finished");
        return;
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
  }, [status]);

  const playerProgress = Math.min(100, (view.distance / COURSE_LENGTH) * 100);
  const raceStyle = {
    "--race-scroll": `${-(view.distance % 760) * 0.52}px`,
    "--player-lane": `${LANE_TOPS[view.lane]}%`,
  } as CSSProperties;

  return (
    <main className="bike-race-stage" data-testid="bike-race-game">
      <header className="bike-race-header">
        <p>Hudson Greenway</p>
        <h1>River Run</h1>
      </header>

      <button type="button" className="bike-race-exit" onClick={onExit}>
        <span aria-hidden="true">←</span>
        West Village
      </button>

      <section className="bike-race-hud" aria-label="Race status">
        <div>
          <small>Distance</small>
          <strong>{Math.round(playerProgress)}%</strong>
        </div>
        <div>
          <small>Time</small>
          <strong>{formatTime(view.elapsed)}</strong>
        </div>
        <div>
          <small>Sprint</small>
          <span>
            <i style={{ width: `${view.boost}%` }} />
          </span>
        </div>
      </section>

      <section className="bike-race-scene" style={raceStyle}>
        <div className="bike-race-skyline" aria-hidden="true">
          <span />
          <span />
          <span />
          <span />
          <span />
        </div>
        <div className="bike-race-river" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <div className="bike-race-fence" aria-hidden="true" />
        <div className="bike-race-track" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>

        {obstacles.map((obstacle) => {
          const offset = obstacle.distance - view.distance;
          if (offset < -350 || offset > 4800) {
            return null;
          }

          return (
            <span
              key={`${obstacle.type}-${obstacle.distance}`}
              className={`bike-obstacle is-${obstacle.type}`}
              style={
                {
                  "--obstacle-x": `calc(27% + ${offset * 0.19}px)`,
                  "--obstacle-lane": `${LANE_TOPS[obstacle.lane]}%`,
                } as CSSProperties
              }
              aria-hidden="true"
            />
          );
        })}

        <span
          className="bike-finish-line"
          style={
            {
              "--finish-x": `calc(27% + ${
                (COURSE_LENGTH - view.distance) * 0.19
              }px)`,
            } as CSSProperties
          }
          aria-hidden="true"
        >
          FINISH
        </span>

        <div
          className="bike-racer is-opponent is-moss"
          style={
            {
              "--racer-x": `calc(27% + ${
                (view.opponents[0] - view.distance) * 0.19
              }px)`,
              "--racer-lane": `${LANE_TOPS[0]}%`,
            } as CSSProperties
          }
        >
          <span className="bike-racer-shell" />
          <span className="bike-frame" />
          <small>Moss</small>
        </div>

        <div
          className="bike-racer is-opponent is-skipper"
          style={
            {
              "--racer-x": `calc(27% + ${
                (view.opponents[1] - view.distance) * 0.19
              }px)`,
              "--racer-lane": `${LANE_TOPS[2]}%`,
            } as CSSProperties
          }
        >
          <span className="bike-racer-shell" />
          <span className="bike-frame" />
          <small>Skipper</small>
        </div>

        <div className="bike-racer is-player">
          <span className="turtle-sprite" aria-hidden="true" />
          <span className="bike-frame" aria-hidden="true" />
          <small>{turtleName}</small>
        </div>

        {view.message ? (
          <strong className="bike-race-message">{view.message}</strong>
        ) : null}
      </section>

      {status === "ready" ? (
        <section className="bike-race-overlay">
          <p>West Side starting line</p>
          <h2>Race the river</h2>
          <span>
            Use W/S or ↑/↓ to change lanes. Hold Space to sprint. Avoid
            obstacles.
          </span>
          <button type="button" onClick={startRace}>
            Start race
          </button>
        </section>
      ) : null}

      {status === "finished" ? (
        <section className="bike-race-overlay is-finished">
          <p>Race complete</p>
          <h2>{placeLabel(finishPlace)} place</h2>
          <span>
            You finished the Hudson run in {formatTime(view.elapsed)}.
          </span>
          <div>
            <button type="button" onClick={startRace}>
              Race again
            </button>
            <button type="button" onClick={onExit}>
              Return to West Village
            </button>
          </div>
        </section>
      ) : null}
    </main>
  );
}

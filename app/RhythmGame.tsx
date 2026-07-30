"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";

type RhythmGameProps = {
  onExit: () => void;
};

type RhythmStatus = "ready" | "playing" | "finished";

type ChartNote = {
  id: number;
  lane: number;
  time: number;
};

type RhythmState = {
  combo: number;
  hits: Set<number>;
  judgment: string;
  judgmentUntil: number;
  maxCombo: number;
  misses: Set<number>;
  score: number;
  startTime: number;
};

type RhythmView = {
  combo: number;
  hits: number[];
  judgment: string;
  maxCombo: number;
  misses: number[];
  score: number;
  time: number;
};

const LANE_KEYS = ["a", "s", "d", "f", "g"] as const;
const LANE_COLORS = ["#d85f56", "#e2b34f", "#65a66f", "#4e8fc4", "#a371b4"];
const HIT_WINDOW = 0.2;
const VISIBLE_WINDOW = 3.5;
const chart: ChartNote[] = [];
const lanePattern = [0, 1, 2, 3, 4, 2, 1, 3, 0, 4, 3, 2, 1, 0, 2, 4];

for (let step = 0; step < 64; step += 1) {
  const time = 2 + step * 0.48;
  chart.push({
    id: chart.length,
    lane: lanePattern[step % lanePattern.length],
    time,
  });

  if (step > 0 && step % 8 === 0) {
    chart.push({
      id: chart.length,
      lane: (lanePattern[step % lanePattern.length] + 2) % 5,
      time,
    });
  }
}

const SONG_LENGTH = chart.at(-1)!.time + 2;

function createRhythmState(): RhythmState {
  return {
    combo: 0,
    hits: new Set(),
    judgment: "",
    judgmentUntil: 0,
    maxCombo: 0,
    misses: new Set(),
    score: 0,
    startTime: 0,
  };
}

function createRhythmView(state: RhythmState, time = 0): RhythmView {
  return {
    combo: state.combo,
    hits: [...state.hits],
    judgment: state.judgment,
    maxCombo: state.maxCombo,
    misses: [...state.misses],
    score: state.score,
    time,
  };
}

function scheduleBackingTrack(context: AudioContext) {
  const start = context.currentTime + 0.6;
  const chordRoots = [110, 130.81, 146.83, 98];

  for (let beat = 0; beat < 72; beat += 1) {
    const at = start + beat * 0.48;
    const root = chordRoots[Math.floor(beat / 8) % chordRoots.length];
    const bass = context.createOscillator();
    const bassGain = context.createGain();
    bass.type = "triangle";
    bass.frequency.value = beat % 2 === 0 ? root : root * 1.5;
    bassGain.gain.setValueAtTime(0.0001, at);
    bassGain.gain.exponentialRampToValueAtTime(0.055, at + 0.012);
    bassGain.gain.exponentialRampToValueAtTime(0.0001, at + 0.2);
    bass.connect(bassGain);
    bassGain.connect(context.destination);
    bass.start(at);
    bass.stop(at + 0.22);

    if (beat % 2 === 0) {
      for (const ratio of [2, 2.5, 3]) {
        const chordTone = context.createOscillator();
        const chordGain = context.createGain();
        chordTone.type = "sine";
        chordTone.frequency.value = root * ratio;
        chordGain.gain.setValueAtTime(0.0001, at);
        chordGain.gain.exponentialRampToValueAtTime(0.012, at + 0.02);
        chordGain.gain.exponentialRampToValueAtTime(0.0001, at + 0.34);
        chordTone.connect(chordGain);
        chordGain.connect(context.destination);
        chordTone.start(at);
        chordTone.stop(at + 0.36);
      }
    }
  }
}

export function RhythmGame({ onExit }: RhythmGameProps) {
  const gameRef = useRef<RhythmState>(createRhythmState());
  const audioContextRef = useRef<AudioContext | null>(null);
  const [status, setStatus] = useState<RhythmStatus>("ready");
  const [view, setView] = useState<RhythmView>(() =>
    createRhythmView(createRhythmState()),
  );
  const [activeLane, setActiveLane] = useState<number | null>(null);

  function startSong() {
    if (audioContextRef.current) {
      void audioContextRef.current.close();
    }

    const state = createRhythmState();
    state.startTime = performance.now() + 600;
    gameRef.current = state;
    setView(createRhythmView(state));
    setStatus("playing");

    try {
      const context = new AudioContext();
      audioContextRef.current = context;
      scheduleBackingTrack(context);
    } catch {
      audioContextRef.current = null;
    }
  }

  useEffect(() => {
    return () => {
      if (audioContextRef.current) {
        void audioContextRef.current.close();
      }
    };
  }, []);

  useEffect(() => {
    if (status !== "playing") {
      return;
    }

    let animationFrame = 0;
    let lastViewUpdate = 0;

    function handleKeyDown(event: KeyboardEvent) {
      const lane = LANE_KEYS.indexOf(
        event.key.toLowerCase() as (typeof LANE_KEYS)[number],
      );

      if (lane < 0 || event.repeat) {
        return;
      }

      event.preventDefault();
      setActiveLane(lane);
      window.setTimeout(() => {
        setActiveLane((current) => (current === lane ? null : current));
      }, 110);

      const state = gameRef.current;
      const songTime = (performance.now() - state.startTime) / 1000;
      const candidate = chart
        .filter(
          (note) =>
            note.lane === lane &&
            !state.hits.has(note.id) &&
            !state.misses.has(note.id),
        )
        .map((note) => ({ note, offset: Math.abs(note.time - songTime) }))
        .sort((first, second) => first.offset - second.offset)[0];

      if (!candidate || candidate.offset > HIT_WINDOW) {
        state.combo = 0;
        state.judgment = "MISS";
        state.judgmentUntil = performance.now() + 350;
        return;
      }

      state.hits.add(candidate.note.id);
      state.combo += 1;
      state.maxCombo = Math.max(state.maxCombo, state.combo);
      const multiplier = Math.min(4, 1 + Math.floor(state.combo / 10));
      state.score +=
        candidate.offset < 0.075 ? 100 * multiplier : 70 * multiplier;
      state.judgment = candidate.offset < 0.075 ? "PERFECT" : "GOOD";
      state.judgmentUntil = performance.now() + 350;
    }

    function update(time: number) {
      const state = gameRef.current;
      const songTime = Math.max(0, (time - state.startTime) / 1000);

      for (const note of chart) {
        if (
          note.time < songTime - HIT_WINDOW &&
          !state.hits.has(note.id) &&
          !state.misses.has(note.id)
        ) {
          state.misses.add(note.id);
          state.combo = 0;
        }
      }

      if (time > state.judgmentUntil) {
        state.judgment = "";
      }

      if (time - lastViewUpdate > 32) {
        setView(createRhythmView(state, songTime));
        lastViewUpdate = time;
      }

      if (songTime >= SONG_LENGTH) {
        setView(createRhythmView(state, SONG_LENGTH));
        setStatus("finished");
        return;
      }

      animationFrame = requestAnimationFrame(update);
    }

    window.addEventListener("keydown", handleKeyDown, { passive: false });
    animationFrame = requestAnimationFrame(update);

    return () => {
      cancelAnimationFrame(animationFrame);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [status]);

  const hitIds = new Set(view.hits);
  const missedIds = new Set(view.misses);
  const visibleNotes = chart.filter(
    (note) =>
      !hitIds.has(note.id) &&
      !missedIds.has(note.id) &&
      note.time >= view.time - HIT_WINDOW &&
      note.time <= view.time + VISIBLE_WINDOW,
  );
  const accuracy = Math.round((view.hits.length / chart.length) * 100);
  const multiplier = Math.min(4, 1 + Math.floor(view.combo / 10));

  return (
    <main className="rhythm-stage" data-testid="rhythm-game">
      <header className="rhythm-title">
        <p>Cellar Note presents</p>
        <h1>Shell Shredder</h1>
      </header>

      <button type="button" className="rhythm-exit" onClick={onExit}>
        <span aria-hidden="true">←</span>
        Leave stage
      </button>

      <section className="rhythm-scoreboard" aria-label="Performance score">
        <div>
          <small>Score</small>
          <strong>{view.score.toLocaleString()}</strong>
        </div>
        <div>
          <small>Combo</small>
          <strong>{view.combo}</strong>
        </div>
        <div>
          <small>Multiplier</small>
          <strong>×{multiplier}</strong>
        </div>
      </section>

      <section className="rhythm-board" aria-label="Five note lanes">
        <div className="rhythm-lane-grid" aria-hidden="true">
          {LANE_KEYS.map((key, lane) => (
            <span
              key={key}
              className={activeLane === lane ? "is-active" : ""}
              style={{ "--lane-color": LANE_COLORS[lane] } as CSSProperties}
            />
          ))}
        </div>

        {visibleNotes.map((note) => {
          const progress = 1 - (note.time - view.time) / VISIBLE_WINDOW;
          return (
            <span
              key={note.id}
              className="rhythm-note"
              style={
                {
                  "--note-color": LANE_COLORS[note.lane],
                  "--note-x": `${10 + note.lane * 20}%`,
                  "--note-y": `${8 + progress * 74}%`,
                } as CSSProperties
              }
            />
          );
        })}

        <div className="rhythm-hit-line">
          {LANE_KEYS.map((key, lane) => (
            <kbd
              key={key}
              className={activeLane === lane ? "is-active" : ""}
              style={{ "--lane-color": LANE_COLORS[lane] } as CSSProperties}
            >
              {key.toUpperCase()}
            </kbd>
          ))}
        </div>

        {view.judgment ? (
          <strong className={`rhythm-judgment is-${view.judgment.toLowerCase()}`}>
            {view.judgment}
          </strong>
        ) : null}
      </section>

      {status === "ready" ? (
        <section className="rhythm-overlay">
          <p>Open shell session</p>
          <h2>Play the five lanes</h2>
          <span>
            Tap A, S, D, F, and G as the colored notes reach the circles. Build
            a combo to raise your multiplier.
          </span>
          <button type="button" onClick={startSong}>
            Start the set
          </button>
        </section>
      ) : null}

      {status === "finished" ? (
        <section className="rhythm-overlay is-results">
          <p>Set complete</p>
          <h2>{accuracy}% notes hit</h2>
          <span>
            Final score: {view.score.toLocaleString()} · Best combo:{" "}
            {view.maxCombo}
          </span>
          <div>
            <button type="button" onClick={startSong}>
              Play again
            </button>
            <button type="button" onClick={onExit}>
              Return to club
            </button>
          </div>
        </section>
      ) : null}
    </main>
  );
}

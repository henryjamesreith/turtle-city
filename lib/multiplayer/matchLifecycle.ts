export type MatchPhase = "lobby" | "countdown" | "playing" | "goal" | "finished";

export type MatchLifecycle = {
  countdownLeft: number;
  phase: MatchPhase;
  roundLeft: number;
};

export function createMatchLifecycle(roundLength: number): MatchLifecycle {
  return { countdownLeft: 0, phase: "lobby", roundLeft: roundLength };
}

export function beginCountdown(match: MatchLifecycle, seconds = 3) {
  match.countdownLeft = seconds;
  match.phase = "countdown";
}

export function beginGoalPause(match: MatchLifecycle, seconds = 1.5) {
  match.countdownLeft = seconds;
  match.phase = "goal";
}

export function finishMatch(match: MatchLifecycle) {
  match.countdownLeft = 0;
  match.phase = "finished";
}

export function resetMatch(match: MatchLifecycle, roundLength: number) {
  match.countdownLeft = 0;
  match.phase = "lobby";
  match.roundLeft = roundLength;
}

export function tickMatchLifecycle(match: MatchLifecycle, deltaSeconds: number) {
  if (match.phase === "countdown" || match.phase === "goal") {
    match.countdownLeft = Math.max(0, match.countdownLeft - deltaSeconds);
    if (match.countdownLeft === 0) match.phase = "playing";
    return;
  }
  if (match.phase === "playing") {
    match.roundLeft = Math.max(0, match.roundLeft - deltaSeconds);
  }
}

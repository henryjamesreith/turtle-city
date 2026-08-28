import { type AuthContext, type Client, Room, ServerError } from "@colyseus/core";
import {
  HockeyMatchState,
  HockeyPlayerState,
} from "../lib/multiplayer/hockeySchema.js";
import {
  beginCountdown,
  beginGoalPause,
  createMatchLifecycle,
  finishMatch,
  resetMatch,
  tickMatchLifecycle,
} from "../lib/multiplayer/matchLifecycle.js";
import { authenticatePlayer, type PlayerAuth } from "./playerAuth.js";

type HockeyClient = Client<{ auth: PlayerAuth }>;
type InputMessage = { action?: unknown; sequence?: unknown; x?: unknown; y?: unknown };

const WIDTH = 1200;
const HEIGHT = 680;
const ICE_LEFT = 70;
const ICE_RIGHT = WIDTH - 70;
const ICE_TOP = 54;
const ICE_BOTTOM = HEIGHT - 54;
const GOAL_TOP = 254;
const GOAL_BOTTOM = 426;
const ROUND_LENGTH = 90;
const OVERTIME_LENGTH = 30;
const PLAYER_SPEED = 340;
const PLAYER_RADIUS = 25;
const PUCK_RADIUS = 12;

type PlayerInput = { action: "pass" | "shoot" | null; sequence: number; x: number; y: number };

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), maximum);
}

export class HockeyRoom extends Room<{
  client: HockeyClient;
  state: HockeyMatchState;
}> {
  maxClients = 6;
  state = new HockeyMatchState();
  private lifecycle = createMatchLifecycle(ROUND_LENGTH);
  private readonly inputs = new Map<string, PlayerInput>();

  messages = {
    ready: (client: HockeyClient) => {
      const player = this.state.players.get(client.sessionId);
      if (!player || this.state.phase !== "lobby") return;
      player.ready = true;
      this.tryStartMatch();
    },
    input: (client: HockeyClient, message: InputMessage) => {
      if (this.state.phase !== "playing") return;
      const previous = this.inputs.get(client.sessionId);
      const sequence = typeof message.sequence === "number" ? message.sequence : 0;
      if (previous && sequence <= previous.sequence) return;
      const rawX = typeof message.x === "number" && Number.isFinite(message.x) ? message.x : 0;
      const rawY = typeof message.y === "number" && Number.isFinite(message.y) ? message.y : 0;
      const magnitude = Math.hypot(rawX, rawY);
      const action = message.action === "pass" || message.action === "shoot" ? message.action : null;
      this.inputs.set(client.sessionId, {
        action,
        sequence,
        x: magnitude > 1 ? rawX / magnitude : rawX,
        y: magnitude > 1 ? rawY / magnitude : rawY,
      });
    },
    rematch: (client: HockeyClient) => {
      if (this.state.phase !== "finished") return;
      const player = this.state.players.get(client.sessionId);
      if (!player) return;
      player.ready = true;
      if ([...this.state.players.values()].every((entry) => entry.ready)) {
        this.resetRound();
        beginCountdown(this.lifecycle);
        this.syncLifecycle();
      }
    },
  };

  async onAuth(_client: HockeyClient, _options: unknown, context: AuthContext) {
    if (!context.token) throw new ServerError(401, "Sign in before joining hockey.");
    return authenticatePlayer(context.token);
  }

  onCreate() {
    this.setSimulationInterval((deltaMilliseconds) => {
      this.update(deltaMilliseconds / 1000);
    }, 1000 / 60);
  }

  onJoin(client: HockeyClient, _options: unknown, auth: PlayerAuth) {
    const player = new HockeyPlayerState();
    const homeCount = [...this.state.players.values()].filter((entry) => entry.team === "home").length;
    const awayCount = this.state.players.size - homeCount;
    player.team = homeCount <= awayCount ? "home" : "away";
    player.userId = auth.userId;
    player.turtleName = auth.turtleName;
    player.variant = auth.variant;
    this.state.players.set(client.sessionId, player);
    this.inputs.set(client.sessionId, { action: null, sequence: -1, x: 0, y: 0 });
    this.placePlayers();
  }

  onLeave(client: HockeyClient) {
    this.inputs.delete(client.sessionId);
    this.state.players.delete(client.sessionId);
    if (this.state.players.size < 2 && this.state.phase !== "lobby") {
      resetMatch(this.lifecycle, ROUND_LENGTH);
      this.state.winner = "";
      this.state.homeScore = 0;
      this.state.awayScore = 0;
      this.state.overtime = false;
      for (const player of this.state.players.values()) player.ready = false;
      this.resetPositions();
      this.syncLifecycle();
    }
  }

  private tryStartMatch() {
    const players = [...this.state.players.values()];
    if (players.length >= 2 && players.every((player) => player.ready)) {
      beginCountdown(this.lifecycle);
      this.resetPositions();
      this.syncLifecycle();
    }
  }

  private resetRound() {
    resetMatch(this.lifecycle, ROUND_LENGTH);
    this.state.homeScore = 0;
    this.state.awayScore = 0;
    this.state.overtime = false;
    this.state.winner = "";
    this.resetPositions();
  }

  private resetPositions() {
    this.state.puck.x = WIDTH / 2;
    this.state.puck.y = HEIGHT / 2;
    this.state.puck.vx = 0;
    this.state.puck.vy = 0;
    this.placePlayers();
  }

  private placePlayers() {
    const teams = { home: 0, away: 0 };
    for (const player of this.state.players.values()) {
      const team = player.team === "away" ? "away" : "home";
      const slot = teams[team]++;
      player.x = team === "home" ? 300 + slot * 55 : 900 - slot * 55;
      player.y = HEIGHT / 2 + (slot - 1) * 100;
      player.vx = 0;
      player.vy = 0;
      player.facingX = team === "home" ? 1 : -1;
      player.facingY = 0;
    }
  }

  private syncLifecycle() {
    this.state.phase = this.lifecycle.phase;
    this.state.countdownLeft = this.lifecycle.countdownLeft;
    this.state.timeLeft = this.lifecycle.roundLeft;
  }

  private score(team: "home" | "away") {
    if (team === "home") this.state.homeScore += 1;
    else this.state.awayScore += 1;
    if (this.state.overtime) {
      this.state.winner = team;
      finishMatch(this.lifecycle);
    } else {
      beginGoalPause(this.lifecycle);
      this.resetPositions();
    }
    this.syncLifecycle();
  }

  private update(delta: number) {
    const previousPhase = this.lifecycle.phase;
    tickMatchLifecycle(this.lifecycle, delta);
    if (previousPhase === "goal" && this.lifecycle.phase === "playing") this.resetPositions();
    if (this.lifecycle.phase === "playing") this.simulate(delta);
    if (this.lifecycle.roundLeft === 0 && this.lifecycle.phase === "playing") {
      if (this.state.homeScore === this.state.awayScore && !this.state.overtime) {
        this.state.overtime = true;
        this.lifecycle.roundLeft = OVERTIME_LENGTH;
        beginCountdown(this.lifecycle);
        this.resetPositions();
      } else {
        this.state.winner = this.state.homeScore > this.state.awayScore ? "home" : "away";
        finishMatch(this.lifecycle);
      }
    }
    this.syncLifecycle();
  }

  private simulate(delta: number) {
    const step = Math.min(delta, 0.05);
    for (const [sessionId, player] of this.state.players) {
      const input = this.inputs.get(sessionId);
      if (!input) continue;
      player.vx = input.x * PLAYER_SPEED;
      player.vy = input.y * PLAYER_SPEED;
      if (Math.hypot(input.x, input.y) > 0.05) {
        player.facingX = input.x;
        player.facingY = input.y;
      }
      player.x = clamp(player.x + player.vx * step, ICE_LEFT + PLAYER_RADIUS, ICE_RIGHT - PLAYER_RADIUS);
      player.y = clamp(player.y + player.vy * step, ICE_TOP + PLAYER_RADIUS, ICE_BOTTOM - PLAYER_RADIUS);
      const dx = this.state.puck.x - player.x;
      const dy = this.state.puck.y - player.y;
      const distance = Math.hypot(dx, dy) || 1;
      if (distance < PLAYER_RADIUS + PUCK_RADIUS + 8) {
        const nx = dx / distance;
        const ny = dy / distance;
        const speed = input.action === "shoot" ? 720 : input.action === "pass" ? 480 : 120;
        this.state.puck.x = player.x + nx * (PLAYER_RADIUS + PUCK_RADIUS);
        this.state.puck.y = player.y + ny * (PLAYER_RADIUS + PUCK_RADIUS);
        this.state.puck.vx = nx * speed + player.vx * 0.35;
        this.state.puck.vy = ny * speed + player.vy * 0.35;
      }
      input.action = null;
    }
    const puck = this.state.puck;
    puck.x += puck.vx * step;
    puck.y += puck.vy * step;
    const friction = Math.pow(0.3, step);
    puck.vx *= friction;
    puck.vy *= friction;
    if (puck.y < ICE_TOP + PUCK_RADIUS || puck.y > ICE_BOTTOM - PUCK_RADIUS) {
      puck.y = clamp(puck.y, ICE_TOP + PUCK_RADIUS, ICE_BOTTOM - PUCK_RADIUS);
      puck.vy *= -0.82;
    }
    const inGoal = puck.y > GOAL_TOP && puck.y < GOAL_BOTTOM;
    if (puck.x < ICE_LEFT + PUCK_RADIUS) {
      if (inGoal) this.score("away");
      else { puck.x = ICE_LEFT + PUCK_RADIUS; puck.vx = Math.abs(puck.vx) * 0.82; }
    } else if (puck.x > ICE_RIGHT - PUCK_RADIUS) {
      if (inGoal) this.score("home");
      else { puck.x = ICE_RIGHT - PUCK_RADIUS; puck.vx = -Math.abs(puck.vx) * 0.82; }
    }
  }
}

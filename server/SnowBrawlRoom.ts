import { type AuthContext, type Client, Room, ServerError } from "@colyseus/core";
import { SnowballState, SnowBrawlMatchState, SnowBrawlPlayerState } from "../lib/multiplayer/snowBrawlSchema.js";
import { authenticatePlayer, type PlayerAuth } from "./playerAuth.js";

type BrawlClient = Client<{ auth: PlayerAuth }>;
type Input = { aimX?: unknown; aimY?: unknown; sequence?: unknown; throwBall?: unknown; x?: unknown; y?: unknown };
type Motion = { aimX: number; aimY: number; sequence: number; throwQueued: boolean; x: number; y: number };
const WIDTH = 1200, HEIGHT = 700, LINE_X = WIDTH / 2, PLAYER_SPEED = 300, BALL_SPEED = 640, ROUND_TIME = 75;
const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

export class SnowBrawlRoom extends Room<{ client: BrawlClient; state: SnowBrawlMatchState }> {
  maxClients = 8;
  state = new SnowBrawlMatchState();
  private inputs = new Map<string, Motion>();
  private nextBallId = 1;
  private botTime = 0;

  messages = {
    ready: (client: BrawlClient) => { const p = this.state.players.get(client.sessionId); if (p && this.state.phase === "lobby") { p.ready = true; this.tryStart(); } },
    solo: (client: BrawlClient) => {
      const player = this.state.players.get(client.sessionId);
      if (!player || this.state.phase !== "lobby" || [...this.state.players.keys()].some((id) => id.startsWith("bot-"))) return;
      const realRival = [...this.state.players.entries()].some(([id, entry]) => id !== client.sessionId && !id.startsWith("bot-") && entry.userId !== player.userId);
      if (realRival) return;
      for (const [id, entry] of [...this.state.players.entries()]) {
        if (id !== client.sessionId && !id.startsWith("bot-") && entry.userId === player.userId) {
          this.state.players.delete(id);
          this.inputs.delete(id);
        }
      }
      const bot = new SnowBrawlPlayerState();
      bot.userId = "bot"; bot.turtleName = "Snowshoe"; bot.variant = "pebble"; bot.team = player.team === "blue" ? "red" : "blue"; bot.ready = true;
      this.state.players.set("bot-snowshoe", bot);
      this.inputs.set("bot-snowshoe", { aimX: -1, aimY: 0, sequence: 0, throwQueued: false, x: 0, y: 0 });
      player.ready = true;
      this.beginRound();
    },
    rematch: (client: BrawlClient) => { const p = this.state.players.get(client.sessionId); if (p && this.state.phase === "finished") { p.ready = true; for (const [id, entry] of this.state.players) if (id.startsWith("bot-")) entry.ready = true; if ([...this.state.players.values()].every((entry) => entry.ready)) this.beginRound(); } },
    input: (client: BrawlClient, message: Input) => {
      if (this.state.phase !== "playing") return;
      const old = this.inputs.get(client.sessionId); const sequence = typeof message.sequence === "number" ? message.sequence : 0;
      if (old && sequence <= old.sequence) return;
      const rawX = typeof message.x === "number" ? message.x : 0, rawY = typeof message.y === "number" ? message.y : 0;
      const length = Math.hypot(rawX, rawY) || 1;
      const rawAimX = typeof message.aimX === "number" ? message.aimX : rawX, rawAimY = typeof message.aimY === "number" ? message.aimY : rawY;
      const aimLength = Math.hypot(rawAimX, rawAimY) || 1;
      this.inputs.set(client.sessionId, { aimX: rawAimX / aimLength, aimY: rawAimY / aimLength, sequence, throwQueued: message.throwBall === true || old?.throwQueued === true, x: clamp(rawX / Math.max(1, length), -1, 1), y: clamp(rawY / Math.max(1, length), -1, 1) });
    },
  };

  async onAuth(_client: BrawlClient, _options: unknown, context: AuthContext) { if (!context.token) throw new ServerError(401, "Sign in before joining Snow Brawl."); return authenticatePlayer(context.token); }
  onCreate() { this.setSimulationInterval((ms) => this.update(ms / 1000), 1000 / 30); }
  onJoin(client: BrawlClient, _options: unknown, auth: PlayerAuth) {
    const p = new SnowBrawlPlayerState(); const blue = [...this.state.players.values()].filter((v) => v.team === "blue").length;
    p.team = blue <= this.state.players.size - blue ? "blue" : "red"; p.userId = auth.userId; p.turtleName = auth.turtleName; p.variant = auth.variant;
    this.state.players.set(client.sessionId, p); this.inputs.set(client.sessionId, { aimX: p.team === "blue" ? 1 : -1, aimY: 0, sequence: -1, throwQueued: false, x: 0, y: 0 }); this.placePlayers();
  }
  onLeave(client: BrawlClient) { this.state.players.delete(client.sessionId); this.inputs.delete(client.sessionId); for (const id of [...this.state.players.keys()]) if (id.startsWith("bot-")) { this.state.players.delete(id); this.inputs.delete(id); } if (this.state.players.size < 2) this.resetLobby(); }
  private tryStart() { const players = [...this.state.players.values()]; if (players.length >= 2 && players.every((p) => p.ready)) this.beginRound(); }
  private beginRound() { this.state.phase = "countdown"; this.state.countdownLeft = 3; this.state.timeLeft = ROUND_TIME; this.state.winner = ""; this.state.snowballs.clear(); for (const p of this.state.players.values()) { p.ready = false; p.hearts = 3; p.knockedOut = false; p.cooldown = 0; p.invulnerable = 0; } this.placePlayers(); }
  private resetLobby() { this.state.phase = "lobby"; this.state.countdownLeft = 0; this.state.timeLeft = ROUND_TIME; this.state.snowballs.clear(); for (const p of this.state.players.values()) p.ready = false; this.placePlayers(); }
  private placePlayers() { const count = { blue: 0, red: 0 }; for (const p of this.state.players.values()) { const team = p.team === "red" ? "red" : "blue"; const slot = count[team]++; p.x = team === "blue" ? 300 : 900; p.y = 230 + slot * 120; p.facingX = team === "blue" ? 1 : -1; p.facingY = 0; } }
  private update(delta: number) {
    const step = Math.min(delta, .05);
    if (this.state.phase === "countdown") { this.state.countdownLeft = Math.max(0, this.state.countdownLeft - step); if (!this.state.countdownLeft) this.state.phase = "playing"; return; }
    if (this.state.phase !== "playing") return;
    this.botTime += step;
    this.state.timeLeft = Math.max(0, this.state.timeLeft - step);
    for (const [id, p] of this.state.players) {
      p.cooldown = Math.max(0, p.cooldown - step); p.invulnerable = Math.max(0, p.invulnerable - step); if (p.knockedOut) continue;
      const input = this.inputs.get(id); if (!input) continue;
      if (id.startsWith("bot-")) {
        const targets = [...this.state.players.values()].filter((target) => target.team !== p.team && !target.knockedOut);
        const target = targets.sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y))[0];
        if (target) {
          const dx = target.x - p.x, dy = target.y - p.y, distance = Math.hypot(dx, dy) || 1;
          input.x = clamp(dx / distance * .34, -.34, .34);
          input.y = clamp(dy / distance + Math.sin(this.botTime * 2.7) * .48, -1, 1);
          p.facingX = dx / distance; p.facingY = dy / distance;
          input.aimX = p.facingX; input.aimY = p.facingY;
          input.throwQueued = p.cooldown === 0 && Math.abs(dy) < 150;
        }
      }
      if (!id.startsWith("bot-") && Math.hypot(input.aimX, input.aimY) > .05) { p.facingX = input.aimX; p.facingY = input.aimY; }
      const minX = p.team === "blue" ? 55 : LINE_X + 42, maxX = p.team === "blue" ? LINE_X - 42 : WIDTH - 55;
      p.x = clamp(p.x + input.x * PLAYER_SPEED * step, minX, maxX); p.y = clamp(p.y + input.y * PLAYER_SPEED * step, 80, HEIGHT - 55);
      if (input.throwQueued && p.cooldown === 0) { const ball = new SnowballState(); const aimX = p.facingX || (p.team === "blue" ? 1 : -1); const aimY = p.facingY; const m = Math.hypot(aimX, aimY) || 1; ball.id = this.nextBallId++; ball.owner = id; ball.team = p.team; ball.x = p.x + aimX * 35; ball.y = p.y + aimY * 35; ball.vx = aimX / m * BALL_SPEED; ball.vy = aimY / m * BALL_SPEED; this.state.snowballs.push(ball); p.cooldown = .72; this.emitEvent("throw", ball.x, ball.y, ball.team); }
      input.throwQueued = false;
    }
    for (let i = this.state.snowballs.length - 1; i >= 0; i--) { const ball = this.state.snowballs[i]; ball.x += ball.vx * step; ball.y += ball.vy * step; let remove = ball.x < -20 || ball.x > WIDTH + 20 || ball.y < -20 || ball.y > HEIGHT + 20;
      for (const p of this.state.players.values()) { if (remove || p.team === ball.team || p.knockedOut || p.invulnerable > 0 || Math.hypot(ball.x - p.x, ball.y - p.y) > 34) continue; p.hearts -= 1; p.invulnerable = .9; let eventType = "hit"; if (p.hearts <= 0) { p.hearts = 0; p.knockedOut = true; eventType = "knockout"; if (ball.team === "blue") this.state.blueScore += 1; else this.state.redScore += 1; } this.emitEvent(eventType, p.x, p.y, ball.team); remove = true; }
      if (remove) this.state.snowballs.splice(i, 1);
    }
    const aliveBlue = [...this.state.players.values()].some((p) => p.team === "blue" && !p.knockedOut), aliveRed = [...this.state.players.values()].some((p) => p.team === "red" && !p.knockedOut);
    if (!aliveBlue || !aliveRed || this.state.timeLeft === 0) { const blueHearts = [...this.state.players.values()].filter((p) => p.team === "blue").reduce((n, p) => n + p.hearts, 0); const redHearts = [...this.state.players.values()].filter((p) => p.team === "red").reduce((n, p) => n + p.hearts, 0); this.state.winner = blueHearts === redHearts ? "draw" : blueHearts > redHearts ? "blue" : "red"; this.state.phase = "finished"; for (const p of this.state.players.values()) p.ready = false; }
  }
  private emitEvent(type: string, x: number, y: number, team: string) { this.state.eventId += 1; this.state.eventType = type; this.state.eventX = x; this.state.eventY = y; this.state.eventTeam = team; }
}

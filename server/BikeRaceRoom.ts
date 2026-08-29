import { type AuthContext, type Client, Room, ServerError } from "@colyseus/core";
import { BikeRaceMatchState, BikeRacePlayerState } from "../lib/multiplayer/bikeRaceSchema.js";
import { authenticatePlayer, type PlayerAuth } from "./playerAuth.js";

type RaceClient = Client<{ auth: PlayerAuth }>;
type InputMessage = { lane?: unknown; sequence?: unknown; sprinting?: unknown };
const COURSE_LENGTH = 6200;
const PLAYER_SPEED = 290;
const SPRINT_SPEED = 385;
const obstacles = [{ distance: 920, lane: 1 }, { distance: 1540, lane: 2 }, { distance: 2280, lane: 0 }, { distance: 3020, lane: 1 }, { distance: 3860, lane: 2 }, { distance: 4510, lane: 0 }, { distance: 5280, lane: 1 }] as const;

export class BikeRaceRoom extends Room<{ client: RaceClient; state: BikeRaceMatchState }> {
  maxClients = 8;
  state = new BikeRaceMatchState();
  private readonly sequences = new Map<string, number>();
  private readonly hits = new Map<string, Set<number>>();

  messages = {
    ready: (client: RaceClient) => { const player = this.state.players.get(client.sessionId); if (!player || this.state.phase !== "lobby") return; player.ready = true; this.tryStart(); },
    input: (client: RaceClient, message: InputMessage) => { const player = this.state.players.get(client.sessionId); if (!player || this.state.phase !== "playing") return; const sequence = typeof message.sequence === "number" ? message.sequence : 0; if (sequence <= (this.sequences.get(client.sessionId) ?? -1)) return; this.sequences.set(client.sessionId, sequence); if (typeof message.lane === "number") player.lane = Math.max(0, Math.min(2, Math.round(message.lane))); player.sprinting = message.sprinting === true; },
    rematch: (client: RaceClient) => { if (this.state.phase !== "finished") return; const player = this.state.players.get(client.sessionId); if (!player) return; player.ready = true; if ([...this.state.players.values()].every((entry) => entry.ready)) this.beginCountdown(); },
  };

  async onAuth(_client: RaceClient, _options: unknown, context: AuthContext) { if (!context.token) throw new ServerError(401, "Sign in before joining the bike race."); return authenticatePlayer(context.token); }
  onCreate() { this.setSimulationInterval((milliseconds) => this.update(milliseconds / 1000), 1000 / 30); }
  onJoin(client: RaceClient, _options: unknown, auth: PlayerAuth) { const player = new BikeRacePlayerState(); player.userId = auth.userId; player.turtleName = auth.turtleName; player.variant = auth.variant; this.state.players.set(client.sessionId, player); this.sequences.set(client.sessionId, -1); this.hits.set(client.sessionId, new Set()); }
  onLeave(client: RaceClient) { this.state.players.delete(client.sessionId); this.sequences.delete(client.sessionId); this.hits.delete(client.sessionId); if (this.state.players.size < 2 && this.state.phase !== "lobby") this.resetLobby(); }

  private tryStart() { const players = [...this.state.players.values()]; if (players.length >= 2 && players.every((player) => player.ready)) this.beginCountdown(); }
  private beginCountdown() { this.state.phase = "countdown"; this.state.countdownLeft = 3; this.state.elapsed = 0; this.state.finishCount = 0; for (const [sessionId, player] of this.state.players) { player.distance = 0; player.boost = 100; player.lane = 1; player.place = 0; player.slowTime = 0; player.sprinting = false; player.ready = false; this.hits.set(sessionId, new Set()); } }
  private resetLobby() { this.state.phase = "lobby"; this.state.countdownLeft = 0; this.state.elapsed = 0; this.state.finishCount = 0; for (const player of this.state.players.values()) { player.ready = false; player.distance = 0; player.place = 0; } }
  private update(delta: number) { const step = Math.min(delta, 0.05); if (this.state.phase === "countdown") { this.state.countdownLeft = Math.max(0, this.state.countdownLeft - step); if (this.state.countdownLeft === 0) this.state.phase = "playing"; return; } if (this.state.phase !== "playing") return; this.state.elapsed += step;
    for (const [sessionId, player] of this.state.players) { if (player.place > 0) continue; player.slowTime = Math.max(0, player.slowTime - step); const sprinting = player.sprinting && player.boost > 0; player.boost = sprinting ? Math.max(0, player.boost - step * 21) : Math.min(100, player.boost + step * 10); const speed = player.slowTime > 0 ? 185 : sprinting ? SPRINT_SPEED : PLAYER_SPEED; player.distance = Math.min(COURSE_LENGTH, player.distance + speed * step); const hitSet = this.hits.get(sessionId) ?? new Set<number>(); obstacles.forEach((obstacle, index) => { if (!hitSet.has(index) && obstacle.lane === player.lane && obstacle.distance - player.distance < 55 && obstacle.distance - player.distance > -35) { hitSet.add(index); player.slowTime = 0.9; player.distance = Math.max(0, player.distance - 75); } }); this.hits.set(sessionId, hitSet); if (player.distance >= COURSE_LENGTH) { this.state.finishCount += 1; player.place = this.state.finishCount; player.sprinting = false; } }
    if (this.state.players.size > 0 && [...this.state.players.values()].every((player) => player.place > 0)) { this.state.phase = "finished"; for (const player of this.state.players.values()) player.ready = false; }
  }
}

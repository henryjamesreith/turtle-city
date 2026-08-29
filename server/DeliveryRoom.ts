import { type AuthContext, type Client, Room, ServerError } from "@colyseus/core";
import { DeliveryMatchState, DeliveryPlayerState } from "../lib/multiplayer/deliverySchema.js";
import { authenticatePlayer, type PlayerAuth } from "./playerAuth.js";

type DeliveryClient = Client<{ auth: PlayerAuth }>;
type InputMessage = { boosting?: unknown; lane?: unknown; sequence?: unknown };
type ItemType = "barrier" | "cab" | "dropoff" | "package" | "steam";
const ROUTE_TIME = 60;
const routeSequence: ItemType[] = ["package", "barrier", "package", "cab", "dropoff", "steam", "package", "barrier", "package", "dropoff", "cab", "package"];
const courseItems = Array.from({ length: 18 }, (_, id) => ({ id, distance: 420 + id * 270, lane: (id * 2 + Math.floor(id / 3)) % 3, type: routeSequence[id % routeSequence.length] }));

export class DeliveryRoom extends Room<{ client: DeliveryClient; state: DeliveryMatchState }> {
  maxClients = 8;
  state = new DeliveryMatchState();
  private readonly sequences = new Map<string, number>();
  private readonly hits = new Map<string, Set<number>>();
  messages = {
    ready: (client: DeliveryClient) => { const player = this.state.players.get(client.sessionId); if (!player || this.state.phase !== "lobby") return; player.ready = true; this.tryStart(); },
    input: (client: DeliveryClient, message: InputMessage) => { const player = this.state.players.get(client.sessionId); if (!player || this.state.phase !== "playing") return; const sequence = typeof message.sequence === "number" ? message.sequence : 0; if (sequence <= (this.sequences.get(client.sessionId) ?? -1)) return; this.sequences.set(client.sessionId, sequence); if (typeof message.lane === "number") player.lane = Math.max(0, Math.min(2, Math.round(message.lane))); player.boosting = message.boosting === true; },
    rematch: (client: DeliveryClient) => { if (this.state.phase !== "finished") return; const player = this.state.players.get(client.sessionId); if (!player) return; player.ready = true; if ([...this.state.players.values()].every((entry) => entry.ready)) this.beginCountdown(); },
  };
  async onAuth(_client: DeliveryClient, _options: unknown, context: AuthContext) { if (!context.token) throw new ServerError(401, "Sign in before joining Shell Express."); return authenticatePlayer(context.token); }
  onCreate() { this.setSimulationInterval((milliseconds) => this.update(milliseconds / 1000), 1000 / 30); }
  onJoin(client: DeliveryClient, _options: unknown, auth: PlayerAuth) { const player = new DeliveryPlayerState(); player.userId = auth.userId; player.turtleName = auth.turtleName; player.variant = auth.variant; this.state.players.set(client.sessionId, player); this.sequences.set(client.sessionId, -1); this.hits.set(client.sessionId, new Set()); }
  onLeave(client: DeliveryClient) { this.state.players.delete(client.sessionId); this.sequences.delete(client.sessionId); this.hits.delete(client.sessionId); if (this.state.players.size < 2 && this.state.phase !== "lobby") this.resetLobby(); }
  private tryStart() { const players = [...this.state.players.values()]; if (players.length >= 2 && players.every((player) => player.ready)) this.beginCountdown(); }
  private beginCountdown() { this.state.phase = "countdown"; this.state.countdownLeft = 3; this.state.elapsed = 0; this.state.timeLeft = ROUTE_TIME; for (const [sessionId, player] of this.state.players) { player.ready = false; player.lane = 1; player.distance = 0; player.cargo = 0; player.delivered = 0; player.lives = 3; player.place = 0; player.boosting = false; this.hits.set(sessionId, new Set()); } }
  private resetLobby() { this.state.phase = "lobby"; this.state.countdownLeft = 0; this.state.elapsed = 0; this.state.timeLeft = ROUTE_TIME; for (const player of this.state.players.values()) player.ready = false; }
  private update(delta: number) { const step = Math.min(delta, 0.05); if (this.state.phase === "countdown") { this.state.countdownLeft = Math.max(0, this.state.countdownLeft - step); if (this.state.countdownLeft === 0) this.state.phase = "playing"; return; } if (this.state.phase !== "playing") return; this.state.elapsed += step; this.state.timeLeft = Math.max(0, ROUTE_TIME - this.state.elapsed);
    for (const [sessionId, player] of this.state.players) { if (player.lives <= 0) continue; player.distance += (player.boosting ? 108 : 76) * step; const hitSet = this.hits.get(sessionId) ?? new Set<number>(); for (const item of courseItems) { if (hitSet.has(item.id) || item.lane !== player.lane || item.distance - player.distance > 34 || item.distance - player.distance < -24) continue; hitSet.add(item.id); if (item.type === "package") player.cargo = Math.min(3, player.cargo + 1); else if (item.type === "dropoff") { player.delivered += player.cargo; player.cargo = 0; } else player.lives = Math.max(0, player.lives - 1); } this.hits.set(sessionId, hitSet); }
    if (this.state.timeLeft === 0 || [...this.state.players.values()].every((player) => player.lives <= 0)) { const ranking = [...this.state.players.values()].sort((a, b) => b.delivered - a.delivered || b.lives - a.lives || b.distance - a.distance); ranking.forEach((player, index) => { player.place = index + 1; player.boosting = false; player.ready = false; }); this.state.phase = "finished"; }
  }
}

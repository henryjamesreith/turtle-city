import { type AuthContext, type Client, Room, ServerError } from "@colyseus/core";
import { BikeRaceMatchState, BikeRacePlayerState } from "../lib/multiplayer/bikeRaceSchema.js";
import { authenticatePlayer, type PlayerAuth } from "./playerAuth.js";

type RaceClient = Client<{ auth: PlayerAuth }>;
type InputMessage = { braking?: unknown; drifting?: unknown; sequence?: unknown; steer?: unknown; throttle?: unknown };

const COURSE_LENGTH = 18000;
const MAX_SPEED = 300;
const BOOST_SPEED = 390;
const OFF_ROAD_SPEED = 155;
const ACCELERATION = 235;
const MAX_COURSE_OFFSET = 3.4;
const ITEMS = ["turbo", "shell", "peel"] as const;
const ITEM_BOXES = [900, 2100, 3300, 4800, 5700, 6900, 8100, 9300, 10800, 11700, 12900, 14100, 15300, 16800, 17700] as const;
const BOOST_PADS = [{ distance: 1700, lane: -0.32 }, { distance: 4550, lane: 0.32 }, { distance: 7700, lane: -0.32 }, { distance: 10550, lane: 0.32 }, { distance: 13700, lane: -0.32 }, { distance: 16550, lane: 0.32 }] as const;

export class BikeRaceRoom extends Room<{ client: RaceClient; state: BikeRaceMatchState }> {
  maxClients = 8;
  state = new BikeRaceMatchState();
  private readonly sequences = new Map<string, number>();
  private readonly collectedBoxes = new Map<string, Set<number>>();
  private readonly collectedBoosts = new Map<string, Set<number>>();
  private readonly driftCharge = new Map<string, number>();
  private readonly lateralSpeeds = new Map<string, number>();

  messages = {
    ready: (client: RaceClient) => {
      const player = this.state.players.get(client.sessionId);
      if (!player || this.state.phase !== "lobby") return;
      player.ready = true;
      this.tryStart();
    },
    input: (client: RaceClient, message: InputMessage) => {
      const player = this.state.players.get(client.sessionId);
      if (!player || this.state.phase !== "playing") return;
      const sequence = typeof message.sequence === "number" ? message.sequence : 0;
      if (sequence <= (this.sequences.get(client.sessionId) ?? -1)) return;
      this.sequences.set(client.sessionId, sequence);
      player.steer = typeof message.steer === "number" ? Math.max(-1, Math.min(1, message.steer)) : 0;
      player.throttle = message.throttle === true;
      player.braking = message.braking === true;
      player.drifting = message.drifting === true;
    },
    item: (client: RaceClient) => this.fireItem(client),
    rematch: (client: RaceClient) => {
      if (this.state.phase !== "finished") return;
      const player = this.state.players.get(client.sessionId);
      if (!player) return;
      player.ready = true;
      if ([...this.state.players.values()].every((entry) => entry.ready)) this.beginCountdown();
    },
  };

  async onAuth(_client: RaceClient, _options: unknown, context: AuthContext) {
    if (!context.token) throw new ServerError(401, "Sign in before joining Shell Circuit.");
    return authenticatePlayer(context.token);
  }

  onCreate() { this.setSimulationInterval((ms) => this.update(ms / 1000), 1000 / 30); }

  onJoin(client: RaceClient, _options: unknown, auth: PlayerAuth) {
    const player = new BikeRacePlayerState();
    player.userId = auth.userId;
    player.turtleName = auth.turtleName;
    player.variant = auth.variant;
    this.state.players.set(client.sessionId, player);
    this.sequences.set(client.sessionId, -1);
    this.collectedBoxes.set(client.sessionId, new Set());
    this.collectedBoosts.set(client.sessionId, new Set());
    this.driftCharge.set(client.sessionId, 0);
    this.lateralSpeeds.set(client.sessionId, 0);
  }

  onLeave(client: RaceClient) {
    this.state.players.delete(client.sessionId);
    this.sequences.delete(client.sessionId);
    this.collectedBoxes.delete(client.sessionId);
    this.collectedBoosts.delete(client.sessionId);
    this.driftCharge.delete(client.sessionId);
    this.lateralSpeeds.delete(client.sessionId);
    if (this.state.players.size < 2 && this.state.phase !== "lobby") this.resetLobby();
  }

  private tryStart() {
    const players = [...this.state.players.values()];
    if (players.length >= 2 && players.every((player) => player.ready)) this.beginCountdown();
  }

  private beginCountdown() {
    this.state.phase = "countdown";
    this.state.countdownLeft = 3;
    this.state.elapsed = 0;
    this.state.finishCount = 0;
    let gridIndex = 0;
    for (const [sessionId, player] of this.state.players) {
      Object.assign(player, { boost: 100, braking: false, distance: -gridIndex * 18, drifting: false, item: "", itemCooldown: 0, lane: gridIndex % 2 ? 0.42 : -0.2, place: 0, ready: false, shieldTime: 0, slowTime: 0, speed: 0, steer: 0, throttle: false });
      this.collectedBoxes.set(sessionId, new Set());
      this.collectedBoosts.set(sessionId, new Set());
      this.driftCharge.set(sessionId, 0);
      this.lateralSpeeds.set(sessionId, 0);
      gridIndex += 1;
    }
  }

  private resetLobby() {
    this.state.phase = "lobby";
    this.state.countdownLeft = 0;
    this.state.elapsed = 0;
    this.state.finishCount = 0;
    for (const [sessionId, player] of this.state.players) {
      Object.assign(player, { distance: 0, place: 0, ready: false, speed: 0 });
      this.lateralSpeeds.set(sessionId, 0);
    }
  }

  private fireItem(client: RaceClient) {
    const player = this.state.players.get(client.sessionId);
    if (!player || this.state.phase !== "playing" || !player.item || player.itemCooldown > 0) return;
    const item = player.item;
    player.item = "";
    player.itemCooldown = 0.45;
    this.state.eventId += 1;
    this.state.eventType = item;
    this.state.eventOwner = client.sessionId;
    if (item === "turbo") {
      player.speed = BOOST_SPEED;
      player.shieldTime = 1.1;
      return;
    }
    const rivals = [...this.state.players.entries()].filter(([id, rival]) => id !== client.sessionId && rival.place === 0);
    const target = item === "shell"
      ? rivals.filter(([, rival]) => rival.distance > player.distance).sort((a, b) => a[1].distance - b[1].distance)[0]
      : rivals.filter(([, rival]) => rival.distance < player.distance).sort((a, b) => b[1].distance - a[1].distance)[0];
    if (target && target[1].shieldTime <= 0) {
      target[1].slowTime = item === "shell" ? 1.2 : 0.9;
      target[1].speed *= item === "shell" ? 0.35 : 0.55;
    }
  }

  private update(delta: number) {
    const step = Math.min(delta, 0.05);
    if (this.state.phase === "countdown") {
      this.state.countdownLeft = Math.max(0, this.state.countdownLeft - step);
      if (this.state.countdownLeft === 0) this.state.phase = "playing";
      return;
    }
    if (this.state.phase !== "playing") return;
    this.state.elapsed += step;
    for (const [sessionId, player] of this.state.players) {
      if (player.place > 0) continue;
      player.slowTime = Math.max(0, player.slowTime - step);
      player.itemCooldown = Math.max(0, player.itemCooldown - step);
      player.shieldTime = Math.max(0, player.shieldTime - step);
      const offRoad = Math.abs(player.lane) > 1.08;
      const targetSpeed = player.slowTime > 0 ? 205 : offRoad ? OFF_ROAD_SPEED : MAX_SPEED;
      if (player.throttle) {
        if (player.speed < targetSpeed) player.speed = Math.min(targetSpeed, player.speed + (offRoad ? 105 : ACCELERATION) * step);
      } else player.speed = Math.max(0, player.speed - (offRoad ? 220 : 85) * step);
      if (player.braking) player.speed = Math.max(0, player.speed - 430 * step);
      if (player.speed > targetSpeed) player.speed = Math.max(targetSpeed, player.speed - (offRoad ? 180 : 80) * step);
      const speedGrip = Math.min(1, player.speed / 190);
      let lateralSpeed = this.lateralSpeeds.get(sessionId) ?? 0;
      lateralSpeed += player.steer * (player.drifting ? 5.2 : 3.75) * speedGrip * step;
      lateralSpeed *= Math.exp(-step * (offRoad ? 2.5 : player.drifting ? 2.2 : 4.1));
      lateralSpeed = Math.max(-1.65, Math.min(1.65, lateralSpeed));
      player.lane += lateralSpeed * step;
      if (Math.abs(player.lane) > MAX_COURSE_OFFSET) { player.lane = Math.sign(player.lane) * MAX_COURSE_OFFSET; lateralSpeed = -Math.sign(player.lane) * Math.min(0.18, Math.abs(lateralSpeed) * 0.2); }
      this.lateralSpeeds.set(sessionId, lateralSpeed);

      const charge = this.driftCharge.get(sessionId) ?? 0;
      if (player.drifting && Math.abs(player.steer) > 0.2 && player.speed > 190 && !offRoad) this.driftCharge.set(sessionId, Math.min(1.5, charge + step));
      else if (charge > 0) {
        if (charge > 0.45) player.speed = Math.min(BOOST_SPEED, player.speed + 55 + charge * 55);
        this.driftCharge.set(sessionId, 0);
      }

      player.distance = Math.min(COURSE_LENGTH, player.distance + player.speed * step);
      const boxSet = this.collectedBoxes.get(sessionId) ?? new Set<number>();
      ITEM_BOXES.forEach((distance, index) => {
        if (!boxSet.has(index) && Math.abs(distance - player.distance) < 38 && Math.abs(player.lane - ((index % 3) - 1) * 0.42) < 0.35) {
          boxSet.add(index);
          if (!player.item) {
            const trailing = [...this.state.players.values()].filter((rival) => rival.distance > player.distance).length;
            player.item = ITEMS[(index + trailing) % ITEMS.length];
          }
        }
      });
      this.collectedBoxes.set(sessionId, boxSet);
      const boostSet = this.collectedBoosts.get(sessionId) ?? new Set<number>();
      BOOST_PADS.forEach((pad, index) => { if (!boostSet.has(index) && Math.abs(pad.distance - player.distance) < 38 && Math.abs(pad.lane - player.lane) < 0.38) { boostSet.add(index); player.speed = BOOST_SPEED; } });
      this.collectedBoosts.set(sessionId, boostSet);
      if (player.distance >= COURSE_LENGTH) {
        this.state.finishCount += 1;
        player.place = this.state.finishCount;
        player.speed = 0;
      }
    }
    const racers = [...this.state.players.entries()].filter(([, player]) => player.place === 0);
    for (let first = 0; first < racers.length; first += 1) for (let second = first + 1; second < racers.length; second += 1) { const [aId, a] = racers[first], [bId, b] = racers[second]; if (a.speed > 100 && b.speed > 100 && a.slowTime === 0 && b.slowTime === 0 && Math.abs(a.distance - b.distance) < 15 && Math.abs(a.lane - b.lane) < 0.27) { const direction = a.lane <= b.lane ? -1 : 1; a.speed *= 0.72; b.speed *= 0.72; this.lateralSpeeds.set(aId, direction * 0.42); this.lateralSpeeds.set(bId, -direction * 0.42); a.slowTime = 0.16; b.slowTime = 0.16; } }
    if (this.state.players.size > 0 && [...this.state.players.values()].every((player) => player.place > 0)) {
      this.state.phase = "finished";
      for (const player of this.state.players.values()) player.ready = false;
    }
  }
}

import {
  type AuthContext,
  type Client,
  Room,
  ServerError,
} from "@colyseus/core";
import {
  districtMultiplayerConfigs,
  type MultiplayerDistrictId,
} from "../lib/multiplayer/districts.js";
import {
  DistrictPlayer,
  DistrictState,
} from "../lib/multiplayer/schema.js";
import { authenticatePlayer, type PlayerAuth } from "./playerAuth.js";

type DistrictClient = Client<{
  auth: PlayerAuth;
}>;

type MovementMessage = {
  facing?: unknown;
  riding?: unknown;
  x?: unknown;
  y?: unknown;
};

type MovementLimit = {
  lastMoveAt: number;
};

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), maximum);
}

abstract class DistrictRoom extends Room<{
  client: DistrictClient;
  state: DistrictState;
}> {
  protected abstract readonly districtId: MultiplayerDistrictId;
  maxClients = 20;
  state = new DistrictState();
  private readonly movementLimits = new Map<string, MovementLimit>();

  messages = {
    move: (client: DistrictClient, message: MovementMessage) => {
      const player = this.state.players.get(client.sessionId);
      if (
        !player ||
        typeof message.x !== "number" ||
        typeof message.y !== "number" ||
        !Number.isFinite(message.x) ||
        !Number.isFinite(message.y)
      ) {
        return;
      }

      const config = districtMultiplayerConfigs[this.districtId];
      const now = Date.now();
      const movementLimit = this.movementLimits.get(client.sessionId);
      const elapsedMilliseconds = movementLimit
        ? now - movementLimit.lastMoveAt
        : 100;

      if (elapsedMilliseconds < 40) {
        return;
      }

      const elapsed = clamp(elapsedMilliseconds / 1000, 0.04, 0.25);
      const maximumXChange =
        config.maximumMovementPerSecond.x * elapsed + 0.004;
      const maximumYChange =
        config.maximumMovementPerSecond.y * elapsed + 0.008;
      const requestedX = clamp(
        message.x,
        config.bounds.minimumX,
        config.bounds.maximumX,
      );
      const requestedY = clamp(
        message.y,
        config.bounds.minimumY,
        config.bounds.maximumY,
      );

      player.x = clamp(
        requestedX,
        player.x - maximumXChange,
        player.x + maximumXChange,
      );
      player.y = clamp(
        requestedY,
        player.y - maximumYChange,
        player.y + maximumYChange,
      );

      if (message.facing === "left" || message.facing === "right") {
        player.facing = message.facing;
      }

      if (typeof message.riding === "boolean") {
        player.riding = message.riding;
      }

      this.movementLimits.set(client.sessionId, { lastMoveAt: now });
    },
  };

  async onAuth(
    _client: DistrictClient,
    _options: unknown,
    context: AuthContext,
  ) {
    if (!context.token) {
      throw new ServerError(401, "Sign in before joining Turtle City.");
    }

    return authenticatePlayer(context.token);
  }

  onJoin(
    client: DistrictClient,
    options: { spawn?: unknown },
    auth: PlayerAuth,
  ) {
    const config = districtMultiplayerConfigs[this.districtId];
    const requestedSpawn =
      typeof options.spawn === "string" && options.spawn in config.spawns
        ? options.spawn
        : Object.keys(config.spawns)[0];
    const spawn = config.spawns[requestedSpawn];
    const player = new DistrictPlayer();
    player.userId = auth.userId;
    player.turtleName = auth.turtleName;
    player.variant = auth.variant;
    player.x = spawn.x;
    player.y = spawn.y;
    this.state.players.set(client.sessionId, player);
    this.movementLimits.set(client.sessionId, { lastMoveAt: Date.now() });
  }

  onLeave(client: DistrictClient) {
    this.movementLimits.delete(client.sessionId);
    this.state.players.delete(client.sessionId);
  }
}

export class CentralParkRoom extends DistrictRoom {
  protected readonly districtId = "central-park" as const;
}

export class ChelseaRoom extends DistrictRoom {
  protected readonly districtId = "chelsea" as const;
}

export class EastVillageLesRoom extends DistrictRoom {
  protected readonly districtId = "east-village-les" as const;
}

export class FidiRoom extends DistrictRoom {
  protected readonly districtId = "fidi" as const;
}

export class MidtownRoom extends DistrictRoom {
  protected readonly districtId = "midtown" as const;
}

export class WestVillageRoom extends DistrictRoom {
  protected readonly districtId = "west-village" as const;
}

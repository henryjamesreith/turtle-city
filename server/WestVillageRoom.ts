import { createClient } from "@supabase/supabase-js";
import {
  type AuthContext,
  type Client,
  Room,
  ServerError,
} from "@colyseus/core";
import {
  WestVillagePlayer,
  WestVillageState,
} from "../lib/multiplayer/schema.js";
import { isTurtleVariant } from "../lib/turtles.js";

type PlayerAuth = {
  turtleName: string;
  userId: string;
  variant: string;
};

type WestVillageClient = Client<{
  auth: PlayerAuth;
}>;

type MovementMessage = {
  facing?: unknown;
  x?: unknown;
  y?: unknown;
};

type MovementLimit = {
  lastMoveAt: number;
};

const spawnPositions = {
  "jazz-club": { x: 0.4, y: 0.72 },
  neighborhood: { x: 0.48, y: 0.72 },
  subway: { x: 0.88, y: 0.72 },
  waterfront: { x: 0.25, y: 0.72 },
} as const;

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), maximum);
}

function getSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !publishableKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY are required.",
    );
  }

  return { publishableKey, url };
}

async function authenticatePlayer(token: string): Promise<PlayerAuth> {
  const { publishableKey, url } = getSupabaseConfig();
  const authClient = createClient(url, publishableKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
  const {
    data: { user },
    error: userError,
  } = await authClient.auth.getUser(token);

  if (userError || !user) {
    throw new ServerError(401, "Your Turtle City session has expired.");
  }

  const playerClient = createClient(url, publishableKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  });
  const { data: profile, error: profileError } = await playerClient
    .from("profiles")
    .select("turtle_name, appearance")
    .eq("user_id", user.id)
    .single();

  if (profileError || !profile?.turtle_name) {
    throw new ServerError(403, "Create your turtle before joining the city.");
  }

  const appearance =
    profile.appearance &&
    typeof profile.appearance === "object" &&
    !Array.isArray(profile.appearance)
      ? profile.appearance
      : null;
  const variant =
    appearance &&
    "variant" in appearance &&
    isTurtleVariant(appearance.variant)
      ? appearance.variant
      : "clover";

  return {
    turtleName: profile.turtle_name.slice(0, 24),
    userId: user.id,
    variant,
  };
}

export class WestVillageRoom extends Room<{
  client: WestVillageClient;
  state: WestVillageState;
}> {
  maxClients = 20;
  state = new WestVillageState();
  private readonly movementLimits = new Map<string, MovementLimit>();

  messages = {
    move: (client: WestVillageClient, message: MovementMessage) => {
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

      const now = Date.now();
      const movementLimit = this.movementLimits.get(client.sessionId);
      const elapsedMilliseconds = movementLimit
        ? now - movementLimit.lastMoveAt
        : 100;

      if (elapsedMilliseconds < 40) {
        return;
      }

      const elapsed = clamp(
        elapsedMilliseconds / 1000,
        0.04,
        0.25,
      );
      const maximumXChange = 0.22 * elapsed + 0.004;
      const maximumYChange = 0.75 * elapsed + 0.008;
      const requestedX = clamp(message.x, 0.027, 0.973);
      const requestedY = clamp(message.y, 0.58, 0.9);

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

      this.movementLimits.set(client.sessionId, { lastMoveAt: now });
    },
  };

  async onAuth(
    _client: WestVillageClient,
    _options: unknown,
    context: AuthContext,
  ) {
    if (!context.token) {
      throw new ServerError(401, "Sign in before joining Turtle City.");
    }

    return authenticatePlayer(context.token);
  }

  onJoin(
    client: WestVillageClient,
    options: { spawn?: unknown },
    auth: PlayerAuth,
  ) {
    const requestedSpawn =
      typeof options.spawn === "string" && options.spawn in spawnPositions
        ? (options.spawn as keyof typeof spawnPositions)
        : "neighborhood";
    const spawn = spawnPositions[requestedSpawn];
    const player = new WestVillagePlayer();
    player.userId = auth.userId;
    player.turtleName = auth.turtleName;
    player.variant = auth.variant;
    player.x = spawn.x;
    player.y = spawn.y;
    this.state.players.set(client.sessionId, player);
    this.movementLimits.set(client.sessionId, { lastMoveAt: Date.now() });
  }

  onLeave(client: WestVillageClient) {
    this.movementLimits.delete(client.sessionId);
    this.state.players.delete(client.sessionId);
  }
}

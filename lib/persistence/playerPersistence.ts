import { getSupabaseBrowserClient } from "../supabase/client";
import type { Database, Json } from "../supabase/database.types";
import {
  defaultTurtleVariant,
  isTurtleVariant,
  type TurtleVariant,
} from "../turtles";

export type PersistedLocation =
  | "apartment"
  | "chelsea"
  | "central-park"
  | "east-village-les"
  | "fidi"
  | "midtown"
  | "west-village";

export type TurtleAppearance = {
  variant: TurtleVariant;
};

type Profile = Database["public"]["Tables"]["profiles"]["Row"];
type PlayerState = Database["public"]["Tables"]["player_states"]["Row"];
type Apartment = Database["public"]["Tables"]["apartments"]["Row"];
type Wallet = Database["public"]["Tables"]["wallets"]["Row"];
type InventoryItem =
  Database["public"]["Tables"]["inventory_items"]["Row"];

export type PlayerSnapshot = {
  apartment: Apartment;
  inventory: InventoryItem[];
  isAnonymous: boolean;
  playerState: PlayerState;
  profile: Profile;
  userId: string;
  wallet: Wallet;
};

export const defaultTurtleAppearance: TurtleAppearance = {
  variant: defaultTurtleVariant,
};

function isPersistedLocation(value: string): value is PersistedLocation {
  return (
    value === "apartment" ||
    value === "chelsea" ||
    value === "central-park" ||
    value === "east-village-les" ||
    value === "fidi" ||
    value === "midtown" ||
    value === "west-village"
  );
}

async function loadPlayerSession() {
  const client = getSupabaseBrowserClient();
  if (!client) {
    return null;
  }

  const {
    data: { session },
    error: sessionError,
  } = await client.auth.getSession();

  if (sessionError) {
    throw sessionError;
  }

  if (session?.user) {
    return session.user;
  }

  return null;
}

export async function getPlayerAccessToken() {
  const client = getSupabaseBrowserClient();
  if (!client) {
    return null;
  }

  const {
    data: { session },
    error,
  } = await client.auth.getSession();

  if (error) {
    throw error;
  }

  return session?.access_token ?? null;
}

export async function signInPlayer(input: {
  email: string;
  password: string;
}) {
  const client = getSupabaseBrowserClient();

  if (!client) {
    throw new Error("Supabase is not configured.");
  }

  const { error } = await client.auth.signInWithPassword({
    email: input.email.trim().toLowerCase(),
    password: input.password,
  });

  if (error) {
    throw error;
  }
}

export async function signUpPlayer(input: {
  email: string;
  password: string;
}) {
  const client = getSupabaseBrowserClient();

  if (!client) {
    throw new Error("Supabase is not configured.");
  }

  const {
    data: { session },
    error,
  } = await client.auth.signUp({
    email: input.email.trim().toLowerCase(),
    password: input.password,
  });

  if (error) {
    throw error;
  }

  if (!session?.user) {
    throw new Error(
      "Email confirmation is still enabled in Supabase. Turn off Confirm email in Authentication settings.",
    );
  }
}

export async function sendPlayerPasswordReset(email: string) {
  const client = getSupabaseBrowserClient();

  if (!client) {
    throw new Error("Supabase is not configured.");
  }

  const { error } = await client.auth.resetPasswordForEmail(
    email.trim().toLowerCase(),
    { redirectTo: window.location.origin },
  );

  if (error) {
    throw error;
  }
}

export async function updatePlayerPassword(password: string) {
  const client = getSupabaseBrowserClient();

  if (!client) {
    throw new Error("Supabase is not configured.");
  }

  const { error } = await client.auth.updateUser({ password });

  if (error) {
    throw error;
  }
}

export function onPlayerPasswordRecovery(callback: () => void) {
  const client = getSupabaseBrowserClient();

  if (!client) {
    return () => undefined;
  }

  const {
    data: { subscription },
  } = client.auth.onAuthStateChange((event) => {
    if (event === "PASSWORD_RECOVERY") {
      callback();
    }
  });

  return () => subscription.unsubscribe();
}

export async function loadPlayerSnapshot(): Promise<PlayerSnapshot | null> {
  const client = getSupabaseBrowserClient();
  const user = await loadPlayerSession();

  if (!client || !user) {
    return null;
  }

  const [profileResult, stateResult, apartmentResult, walletResult, inventoryResult] =
    await Promise.all([
      client.from("profiles").select("*").eq("user_id", user.id).single(),
      client
        .from("player_states")
        .select("*")
        .eq("user_id", user.id)
        .single(),
      client.from("apartments").select("*").eq("user_id", user.id).single(),
      client.from("wallets").select("*").eq("user_id", user.id).single(),
      client
        .from("inventory_items")
        .select("*")
        .eq("user_id", user.id)
        .order("acquired_at"),
    ]);

  const firstError = [
    profileResult.error,
    stateResult.error,
    apartmentResult.error,
    walletResult.error,
    inventoryResult.error,
  ].find(Boolean);

  if (firstError) {
    throw firstError;
  }

  if (
    !profileResult.data ||
    !stateResult.data ||
    !apartmentResult.data ||
    !walletResult.data
  ) {
    throw new Error("The player persistence records are incomplete.");
  }

  return {
    apartment: apartmentResult.data,
    inventory: inventoryResult.data ?? [],
    isAnonymous: user.is_anonymous ?? false,
    playerState: stateResult.data,
    profile: profileResult.data,
    userId: user.id,
    wallet: walletResult.data,
  };
}

export async function saveLastLocation(location: PersistedLocation) {
  const client = getSupabaseBrowserClient();
  const user = await loadPlayerSession();

  if (!client) {
    throw new Error("Supabase is not configured.");
  }

  if (!user) {
    throw new Error("Your session has expired. Sign in again.");
  }

  const lastDistrict =
    location === "central-park" ||
    location === "east-village-les" ||
    location === "fidi" ||
    location === "midtown" ||
    location === "west-village"
      ? location
      : "chelsea";
  const { error } = await client
    .from("player_states")
    .update({
      last_district: lastDistrict,
      last_location: location,
    })
    .eq("user_id", user.id);

  if (error) {
    throw error;
  }
}

export async function claimFreeSkateboard() {
  const client = getSupabaseBrowserClient();
  const user = await loadPlayerSession();

  if (!client) throw new Error("Supabase is not configured.");
  if (!user) throw new Error("Your session has expired. Sign in again.");

  const { error } = await client.from("inventory_items").insert({
    equipped: true,
    item_key: "chelsea-skateboard",
    metadata: { color: "sunset-yellow", source: "shell-and-roll" },
    quantity: 1,
    user_id: user.id,
  });

  // Claiming an already-owned free board is a successful no-op.
  if (error && error.code !== "23505") throw error;
}

export async function purchaseApartmentUpgrade(itemKey: string) {
  const client = getSupabaseBrowserClient();
  if (!client) throw new Error("Supabase is not configured.");
  const { data, error } = await client.rpc("purchase_apartment_upgrade", { requested_item_key: itemKey });
  if (error) throw error;
  if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("The upgrade purchase returned an invalid result.");
  const shells = typeof data.shells === "number" ? data.shells : Number(data.shells);
  if (!Number.isSafeInteger(shells) || shells < 0) throw new Error("The upgrade purchase returned an invalid balance.");
  const upgrades = data.upgrades && typeof data.upgrades === "object" && !Array.isArray(data.upgrades)
    ? Object.keys(data.upgrades).filter((key) => data.upgrades && typeof data.upgrades === "object" && !Array.isArray(data.upgrades) && data.upgrades[key] === true)
    : [];
  return { shells, upgrades };
}

export async function awardGameWin(activityKey: string, runId: string) {
  const client = getSupabaseBrowserClient();
  if (!client) throw new Error("Supabase is not configured.");
  const { data, error } = await client.rpc("award_game_win", {
    p_activity_key: activityKey,
    p_run_id: runId,
  });
  if (error) throw error;
  return Number(data);
}

export async function upgradeApartment() {
  const client = getSupabaseBrowserClient();
  if (!client) throw new Error("Supabase is not configured.");
  const { data, error } = await client.rpc("upgrade_apartment", {});
  if (error) throw error;
  const result = data?.[0];
  if (!result) throw new Error("The apartment upgrade could not be completed.");
  return { shells: Number(result.shells), tier: Number(result.tier) };
}

export async function saveTurtleProfile(input: {
  appearance: TurtleAppearance;
  personality?: string;
  turtleName: string;
}) {
  const client = getSupabaseBrowserClient();
  const user = await loadPlayerSession();

  if (!client) {
    throw new Error("Supabase is not configured.");
  }

  if (!user) {
    throw new Error("Your session has expired. Sign in again.");
  }

  const { error } = await client
    .from("profiles")
    .update({
      appearance: input.appearance as Json,
      onboarding_completed_at: new Date().toISOString(),
      personality: input.personality?.trim() || null,
      turtle_name: input.turtleName.trim(),
    })
    .eq("user_id", user.id);

  if (error) {
    throw error;
  }
}

export async function signOutPlayer() {
  const client = getSupabaseBrowserClient();

  if (!client) {
    return;
  }

  const { error } = await client.auth.signOut({ scope: "local" });

  if (error) {
    throw error;
  }
}

export function getTurtleAppearance(profile: Profile): TurtleAppearance {
  if (
    typeof profile.appearance !== "object" ||
    profile.appearance === null ||
    Array.isArray(profile.appearance)
  ) {
    return defaultTurtleAppearance;
  }

  return {
    variant: isTurtleVariant(profile.appearance.variant)
      ? profile.appearance.variant
      : defaultTurtleAppearance.variant,
  };
}

export function hasCompletedOnboarding(snapshot: PlayerSnapshot) {
  return Boolean(
    snapshot.profile.onboarding_completed_at && snapshot.profile.turtle_name,
  );
}

export function getPersistedLocation(snapshot: PlayerSnapshot) {
  const location = snapshot.playerState.last_location;
  return isPersistedLocation(location) ? location : "apartment";
}

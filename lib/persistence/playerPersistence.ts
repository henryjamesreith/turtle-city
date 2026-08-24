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
    location === "central-park" || location === "west-village"
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

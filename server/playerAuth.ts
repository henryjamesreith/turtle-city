import { createClient } from "@supabase/supabase-js";
import { ServerError } from "@colyseus/core";
import { isTurtleVariant } from "../lib/turtles.js";

export type PlayerAuth = {
  turtleName: string;
  userId: string;
  variant: string;
};

function getSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !publishableKey) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY are required.");
  }
  return { publishableKey, url };
}

export async function authenticatePlayer(token: string): Promise<PlayerAuth> {
  const { publishableKey, url } = getSupabaseConfig();
  const authClient = createClient(url, publishableKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: { user }, error: userError } = await authClient.auth.getUser(token);
  if (userError || !user) throw new ServerError(401, "Your Turtle City session has expired.");

  const playerClient = createClient(url, publishableKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: profile, error: profileError } = await playerClient
    .from("profiles")
    .select("turtle_name, appearance")
    .eq("user_id", user.id)
    .single();
  if (profileError || !profile?.turtle_name) {
    throw new ServerError(403, "Create your turtle before joining the city.");
  }
  const appearance = profile.appearance && typeof profile.appearance === "object" && !Array.isArray(profile.appearance)
    ? profile.appearance
    : null;
  const variant = appearance && "variant" in appearance && isTurtleVariant(appearance.variant)
    ? appearance.variant
    : "clover";
  return { turtleName: profile.turtle_name.slice(0, 24), userId: user.id, variant };
}

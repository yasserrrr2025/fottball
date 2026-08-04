import { createClient } from "@supabase/supabase-js";

export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder-key";
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export function createBrowserSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "placeholder-key";
  return createClient(url, key);
}

export async function requireAdmin(request: Request) {
  const auth = request.headers.get("authorization");
  const token = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) throw new Error("UNAUTHORIZED");
  const supabase = createServiceClient();
  const { data: userData, error } = await supabase.auth.getUser(token);
  if (error || !userData.user) throw new Error("UNAUTHORIZED");
  const { data: admin } = await supabase
    .from("admin_users")
    .select("user_id, full_name, is_active")
    .eq("user_id", userData.user.id)
    .eq("is_active", true)
    .maybeSingle();
  if (!admin) throw new Error("FORBIDDEN");
  return { supabase, user: userData.user, admin };
}

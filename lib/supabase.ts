import { createClient } from "@supabase/supabase-js";

const DEFAULT_SUPABASE_URL = "https://rbjfyzysactrtwzhyzpr.supabase.co";
const DEFAULT_SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJiamZ5enlzYWN0cnR3emh5enByIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU4NjEwMTIsImV4cCI6MjEwMTQzNzAxMn0.DUD2MytR3YFHlfS0s4lYM32Ssf_19qPMv8iT1nXGDso";
const DEFAULT_SUPABASE_SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJiamZ5enlzYWN0cnR3emh5enByIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NTg2MTAxMiwiZXhwIjoyMTAxNDM3MDEyfQ.NomSSAyI13UrOHXbSYvVYXSx6reo0Dj9OlB_rvXuqnw";

export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || DEFAULT_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || DEFAULT_SUPABASE_SERVICE_ROLE_KEY;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export function createBrowserSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || DEFAULT_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || DEFAULT_SUPABASE_ANON_KEY;
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

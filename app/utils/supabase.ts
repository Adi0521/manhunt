import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const hasSupabaseEnv = Boolean(supabaseUrl && supabaseAnonKey);

// Exported for the keepalive REST write in LocationPublisher — supabase-js
// can't set `keepalive` per request, and that flag is what lets a final
// position land while the tab is being frozen.
export const SUPABASE_URL = supabaseUrl;
export const SUPABASE_ANON_KEY = supabaseAnonKey;

const supabase: SupabaseClient | null = hasSupabaseEnv ? createClient(supabaseUrl as string, supabaseAnonKey as string) : null;

export default supabase;

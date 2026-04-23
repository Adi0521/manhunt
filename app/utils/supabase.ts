import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const hasSupabaseEnv = Boolean(supabaseUrl && supabaseAnonKey);

const supabase: SupabaseClient | null = hasSupabaseEnv ? createClient(supabaseUrl as string, supabaseAnonKey as string) : null;

export default supabase;

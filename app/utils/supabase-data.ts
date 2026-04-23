import supabase, { hasSupabaseEnv } from "../utils/supabase";

export default async function getHunts(){
  if (!hasSupabaseEnv || !supabase) {
    return [];
  }

  let { data } = await supabase
    .from("hunts")
    .select();

  console.log(data);

  return data ?? [];
}
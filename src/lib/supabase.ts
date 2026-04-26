import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

function getClient() {
  if (!supabaseUrl || !supabaseAnonKey) return null;
  return createClient(supabaseUrl, supabaseAnonKey);
}

export interface ReplayLink {
  id: string;
  game_id: string;
  title: string;
  url: string;
  source: string;
  created_at: string;
}

export async function getReplayLinks(gameId: string): Promise<ReplayLink[]> {
  const supabase = getClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("replay_links")
    .select("*")
    .eq("game_id", gameId)
    .order("created_at", { ascending: false });
  if (error) {
    console.error("Error fetching replay links:", error);
    return [];
  }
  return data || [];
}

export async function getAllReplayGameIds(): Promise<string[]> {
  const supabase = getClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("replay_links")
    .select("game_id");
  if (error) {
    console.error("Error fetching replay game IDs:", error);
    return [];
  }
  return [...new Set((data || []).map((d) => d.game_id as string))];
}

export async function addReplayLink(
  gameId: string,
  title: string,
  url: string,
  source: string
): Promise<ReplayLink | null> {
  const supabase = getClient();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("replay_links")
    .insert({ game_id: gameId, title, url, source })
    .select()
    .single();
  if (error) {
    console.error("Error adding replay link:", error);
    return null;
  }
  return data;
}

export async function deleteReplayLink(id: string): Promise<boolean> {
  const supabase = getClient();
  if (!supabase) return false;
  const { error } = await supabase.from("replay_links").delete().eq("id", id);
  if (error) {
    console.error("Error deleting replay link:", error);
    return false;
  }
  return true;
}

/*
  Supabase SQL — run this to update the table:

  -- If you already created with INTEGER, run:
  ALTER TABLE replay_links ALTER COLUMN game_id TYPE TEXT;

  -- Or create fresh:
  DROP TABLE IF EXISTS replay_links;
  CREATE TABLE replay_links (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    game_id TEXT NOT NULL,
    title TEXT NOT NULL,
    url TEXT NOT NULL,
    source TEXT NOT NULL DEFAULT 'cloud',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
  );
  CREATE INDEX idx_replay_links_game_id ON replay_links(game_id);
*/

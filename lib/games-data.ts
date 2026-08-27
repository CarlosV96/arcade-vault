import { createClient } from "@/lib/supabase/server";
import { GAMES, type Game } from "@/lib/data";
import { REAL_GAME_IDS } from "@/lib/games/real-game-ids";

export interface ScoreRow {
  rank: number;
  name: string;
  score: number;
  date: string; // DD/MM/YYYY, formateado desde created_at
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const day = String(d.getDate()).padStart(2, "0");
  const mon = String(d.getMonth() + 1).padStart(2, "0");
  return `${day}/${mon}/${d.getFullYear()}`;
}

function formatPlays(count: number): string {
  if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
  return String(count);
}

async function getRealPlaysCounts(): Promise<Record<string, number>> {
  if (REAL_GAME_IDS.length === 0) return {};
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.from("scores").select("game_id").in("game_id", REAL_GAME_IDS);
    if (error || !data) return {};
    const counts: Record<string, number> = {};
    for (const row of data) {
      counts[row.game_id] = (counts[row.game_id] ?? 0) + 1;
    }
    return counts;
  } catch {
    return {};
  }
}

type GameRow = Omit<Game, "best">;

function toGame(row: GameRow): Game {
  return { ...row, best: 0 };
}

export async function getGames(): Promise<Game[]> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.from("games").select("*");
    if (error || !data) return GAMES;
    const playsCounts = await getRealPlaysCounts();
    return (data as GameRow[]).map(toGame).map((g) =>
      REAL_GAME_IDS.includes(g.id) ? { ...g, plays: formatPlays(playsCounts[g.id] ?? 0) } : g
    );
  } catch {
    return GAMES;
  }
}

export async function getGame(id: string): Promise<Game | undefined> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.from("games").select("*").eq("id", id).maybeSingle();
    if (error || !data) return GAMES.find((g) => g.id === id);
    const game = toGame(data as GameRow);
    if (!REAL_GAME_IDS.includes(id)) return game;
    const { count } = await supabase
      .from("scores")
      .select("*", { count: "exact", head: true })
      .eq("game_id", id);
    return { ...game, plays: formatPlays(count ?? 0) };
  } catch {
    return GAMES.find((g) => g.id === id);
  }
}

export async function getLeaderboard(gameId: string, limit = 10): Promise<ScoreRow[]> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("scores")
      .select("player_name, score, created_at")
      .eq("game_id", gameId)
      .order("score", { ascending: false })
      .limit(limit);
    if (error || !data) return [];
    return data.map((row, i) => ({
      rank: i + 1,
      name: row.player_name,
      score: row.score,
      date: formatDate(row.created_at),
    }));
  } catch {
    return [];
  }
}

export async function getBestScores(): Promise<Record<string, number>> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("scores")
      .select("game_id, score")
      .order("score", { ascending: false });
    if (error || !data) return {};
    const best: Record<string, number> = {};
    for (const row of data) {
      if (best[row.game_id] === undefined) best[row.game_id] = row.score;
    }
    return best;
  } catch {
    return {};
  }
}

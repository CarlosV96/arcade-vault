import { createClient } from "@/lib/supabase/client";

export interface ScoreEntry {
  game: string;
  score: number;
  name: string;
}

export function saveScore(entry: ScoreEntry): void {
  try {
    const all = JSON.parse(localStorage.getItem("av_scores") || "[]");
    all.push({ ...entry, at: Date.now() });
    localStorage.setItem("av_scores", JSON.stringify(all));
  } catch {
    // localStorage no disponible o corrupto — ignorar, igual que el prototipo.
  }
}

export async function saveRealScore(entry: ScoreEntry): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("scores").insert({
    game_id: entry.game,
    player_name: entry.name,
    score: entry.score,
  });
  if (error) throw error;
}

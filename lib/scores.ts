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

import { Library } from "@/components/Library";
import { getGames, getBestScores } from "@/lib/games-data";

export default async function BibliotecaPage() {
  const [games, bestScores] = await Promise.all([getGames(), getBestScores()]);
  return <Library games={games} bestScores={bestScores} />;
}

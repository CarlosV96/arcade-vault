import { HallOfFame } from "@/components/HallOfFame";
import { getGames, getLeaderboard, type ScoreRow } from "@/lib/games-data";

export default async function SalonPage() {
  const games = await getGames();
  const leaderboardEntries = await Promise.all(
    games.map(async (g) => [g.id, await getLeaderboard(g.id, 12)] as [string, ScoreRow[]])
  );
  const leaderboards = Object.fromEntries(leaderboardEntries);

  return <HallOfFame games={games} leaderboards={leaderboards} />;
}

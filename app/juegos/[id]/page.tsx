import { notFound } from "next/navigation";
import { getGame, getLeaderboard } from "@/lib/games-data";
import { GameDetail } from "@/components/GameDetail";

export default async function GameDetailPage({ params }: PageProps<"/juegos/[id]">) {
  const { id } = await params;
  const game = await getGame(id);
  if (!game) notFound();

  const scores = await getLeaderboard(id, 10);

  return <GameDetail game={game} scores={scores} />;
}

import { notFound } from "next/navigation";
import { getGame } from "@/lib/games-data";
import { GamePlayer } from "@/components/GamePlayer";

export default async function GamePlayerPage({ params }: PageProps<"/juegos/[id]/jugar">) {
  const { id } = await params;
  const game = await getGame(id);
  if (!game) notFound();

  return <GamePlayer game={game} />;
}

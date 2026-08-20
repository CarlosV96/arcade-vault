import { notFound } from "next/navigation";
import { GAMES } from "@/lib/data";
import { GameDetail } from "@/components/GameDetail";

export default async function GameDetailPage({ params }: PageProps<"/juegos/[id]">) {
  const { id } = await params;
  const game = GAMES.find((g) => g.id === id);
  if (!game) notFound();

  return <GameDetail game={game} />;
}

import type { ForwardRefExoticComponent, RefAttributes } from "react";
import { AsteroidsCanvas } from "./AsteroidsCanvas";
import type { RealGameHandle, RealGameProps } from "@/lib/games/types";
import { REAL_GAME_IDS } from "@/lib/games/real-game-ids";

const COMPONENTS: Record<
  string,
  ForwardRefExoticComponent<RealGameProps & RefAttributes<RealGameHandle>>
> = {
  asteroides: AsteroidsCanvas,
};

export const REAL_GAMES: Record<
  string,
  ForwardRefExoticComponent<RealGameProps & RefAttributes<RealGameHandle>>
> = Object.fromEntries(REAL_GAME_IDS.map((id) => [id, COMPONENTS[id]]));

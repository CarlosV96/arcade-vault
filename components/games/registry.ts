import type { ForwardRefExoticComponent, RefAttributes } from "react";
import { AsteroidsCanvas } from "./AsteroidsCanvas";
import { TetrisCanvas } from "./TetrisCanvas";
import type { RealGameHandle, RealGameProps } from "@/lib/games/types";
import { REAL_GAME_IDS } from "@/lib/games/real-game-ids";

const COMPONENTS: Record<
  string,
  ForwardRefExoticComponent<RealGameProps & RefAttributes<RealGameHandle>>
> = {
  asteroides: AsteroidsCanvas,
  tetris: TetrisCanvas,
};

export const REAL_GAMES: Record<
  string,
  ForwardRefExoticComponent<RealGameProps & RefAttributes<RealGameHandle>>
> = Object.fromEntries(REAL_GAME_IDS.map((id) => [id, COMPONENTS[id]]));

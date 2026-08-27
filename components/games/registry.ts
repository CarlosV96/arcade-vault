import type { ForwardRefExoticComponent, RefAttributes } from "react";
import { AsteroidsCanvas } from "./AsteroidsCanvas";
import type { RealGameHandle, RealGameProps } from "@/lib/games/types";

export const REAL_GAMES: Record<
  string,
  ForwardRefExoticComponent<RealGameProps & RefAttributes<RealGameHandle>>
> = {
  asteroides: AsteroidsCanvas,
};

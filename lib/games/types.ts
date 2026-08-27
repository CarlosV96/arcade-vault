export interface RealGameProps {
  paused: boolean;
  onScoreChange(score: number): void;
  onLivesChange(lives: number): void;
  onLevelChange(level: number): void;
  onGameOver(score: number): void;
}

export interface RealGameHandle {
  end(): void; // termina la partida ya, dispara onGameOver(score) con el score actual
}

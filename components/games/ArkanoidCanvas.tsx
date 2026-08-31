"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import {
  createArkanoidEngine,
  type ArkanoidEngine,
} from "@/lib/games/arkanoid-engine";
import type { RealGameHandle, RealGameProps } from "@/lib/games/types";

export const ArkanoidCanvas = forwardRef<RealGameHandle, RealGameProps>(
  function ArkanoidCanvas(
    { paused, onScoreChange, onLivesChange, onLevelChange, onGameOver },
    ref
  ) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const engineRef = useRef<ArkanoidEngine | null>(null);
    const callbacksRef = useRef({
      onScoreChange,
      onLivesChange,
      onLevelChange,
      onGameOver,
    });
    callbacksRef.current = {
      onScoreChange,
      onLivesChange,
      onLevelChange,
      onGameOver,
    };

    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const engine = createArkanoidEngine(canvas, {
        onScoreChange: (score) => callbacksRef.current.onScoreChange(score),
        onLivesChange: (lives) => callbacksRef.current.onLivesChange(lives),
        onLevelChange: (level) => callbacksRef.current.onLevelChange(level),
        onGameOver: (score) => callbacksRef.current.onGameOver(score),
      });
      engineRef.current = engine;

      return () => {
        engine.destroy();
        engineRef.current = null;
      };
    }, []);

    useEffect(() => {
      if (paused) engineRef.current?.pause();
      else engineRef.current?.resume();
    }, [paused]);

    useImperativeHandle(ref, () => ({
      end() {
        engineRef.current?.endNow();
      },
    }));

    return (
      <canvas
        ref={canvasRef}
        width={800}
        height={600}
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
      />
    );
  }
);

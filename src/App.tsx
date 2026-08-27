import { useEffect, useRef, useState } from 'react';
import { Game } from './game/Game';
import { InfoPanel, ShopPanel, TopBar, ViewControls } from './ui/panels';
import { Overlays } from './ui/overlays';
import { CodexModal, StartScreen } from './ui/codex';

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<Game | null>(null);
  const [, force] = useState(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const game = new Game(canvas);
    gameRef.current = game;
    game.start();
    const unsub = game.subscribe(() => force((x) => x + 1));
    return () => {
      unsub();
      game.destroy();
      gameRef.current = null;
    };
  }, []);

  const game = gameRef.current;
  const snap = game?.getSnapshot();

  return (
    <div className="fixed inset-0 overflow-hidden bg-[#0f141a] select-none" onContextMenu={(e) => e.preventDefault()}>
      <canvas ref={canvasRef} className="absolute inset-0 block touch-none cursor-crosshair" />
      {game && snap && (
        <>
          <TopBar game={game} />
          <ShopPanel game={game} />
          <InfoPanel game={game} />
          <ViewControls game={game} />
          <Overlays game={game} />
          {snap.codexOpen && <CodexModal game={game} snap={snap} />}
          {!snap.started && !snap.codexOpen && <StartScreen game={game} snap={snap} />}
        </>
      )}
    </div>
  );
}

import { useEffect, useRef, useState } from 'react';
import { Game } from './game/Game';
import { Overlays } from './ui/overlays';
import { InfoPanel, ShopPanel, TopBar } from './ui/panels';

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [game, setGame] = useState<Game | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const g = new Game(canvas);
    g.start();
    setGame(g);
    return () => g.destroy();
  }, []);

  return (
    <div className="fixed inset-0 overflow-hidden bg-[#0f141a] select-none">
      <canvas ref={canvasRef} className="absolute inset-0 touch-none cursor-crosshair" />

      {/* vignette + scanline flavor, purely decorative */}
      <div
        className="absolute inset-0 pointer-events-none z-10"
        style={{ background: 'radial-gradient(ellipse at center, transparent 55%, rgba(5,8,12,0.55) 100%)' }}
      />
      <div
        className="absolute inset-0 pointer-events-none z-10 opacity-[0.05]"
        style={{ background: 'repeating-linear-gradient(0deg, transparent 0 2px, #9fc2e8 2px 3px)' }}
      />

      {game && (
        <>
          <TopBar game={game} />
          <ShopPanel game={game} />
          <InfoPanel game={game} />
          <Overlays game={game} />
        </>
      )}
    </div>
  );
}

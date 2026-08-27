import type { ReactNode } from 'react';
import { GOAL_FRAGMENTS, tr } from '../game/data';
import type { Game } from '../game/Game';
import { ResIcon, useGameUI } from './panels';

export function Overlays({ game }: { game: Game }) {
  const s = useGameUI(game);
  const L = (k: string) => tr(s.lang, k);

  return (
    <>
      {/* toasts */}
      <div className="absolute top-14 inset-x-0 z-40 flex flex-col items-center gap-1.5 pointer-events-none">
        {s.toasts.map((t) => (
          <div
            key={t.id}
            className={`px-3 py-1.5 text-[11px] font-bold tracking-wider border animate-[toastin_0.18s_ease-out] ${
              t.kind === 'ok'
                ? 'bg-[#0f1f18]/95 border-[#45e08c]/50 text-[#45e08c]'
                : t.kind === 'err'
                  ? 'bg-[#231015]/95 border-[#ff5d5d]/50 text-[#ff5d5d]'
                  : 'bg-[#101823]/95 border-[#3fc1ff]/50 text-[#3fc1ff]'
            }`}
          >
            {L(t.textKey)}
          </div>
        ))}
      </div>

      {/* placement hint */}
      {s.placement && (
        <div className={`absolute inset-x-0 z-30 flex justify-center pointer-events-none ${s.tutorial ? 'bottom-40 md:bottom-44' : 'bottom-24 md:bottom-6'}`}>
          <div className="px-4 py-2 bg-[#1d1a0f]/95 border border-[#ffb02e]/60 text-[#ffb02e] text-[11px] font-bold tracking-wider animate-[toastin_0.18s_ease-out]">
            ▣ {L('msg.place')}
          </div>
        </div>
      )}

      {/* tutorial */}
      {s.tutorial && (
        <div className="absolute bottom-4 inset-x-0 z-30 flex justify-center px-3 pointer-events-none">
          <div className="pointer-events-auto max-w-[440px] w-full panel border-[#3fc1ff]/40 p-3 animate-[toastin_0.2s_ease-out]">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[9px] font-bold tracking-[0.18em] text-[#3fc1ff]">
                {L('tut.step')} {s.tutorial.index + 1} / {s.tutorial.total}
              </span>
              <div className="flex gap-1">
                {Array.from({ length: s.tutorial.total }).map((_, i) => (
                  <span key={i} className={`w-3 h-1 ${i <= s.tutorial!.index ? 'bg-[#3fc1ff]' : 'bg-[#24303f]'}`} />
                ))}
              </div>
            </div>
            <p className="text-[12px] leading-snug text-[#cfd9e6] m-0">{L(s.tutorial.textKey)}</p>
            <button
              onClick={() => game.skipTutorial()}
              className="mt-2 text-[10px] text-[#5c6b7f] hover:text-[#a9bad0] tracking-wider font-bold transition-colors"
            >
              {L('tut.skip')} ▸
            </button>
          </div>
        </div>
      )}

      {/* control hints (desktop) */}
      {!s.tutorial && !s.placement && (
        <div className="absolute bottom-2 right-3 z-10 hidden md:block text-[9.5px] text-[#46586e] tracking-wide pointer-events-none">
          {L('help.d4')} · {L('help.d3')}
        </div>
      )}

      {/* offline modal */}
      {s.offline && (
        <Modal>
          <div className="text-[10px] font-bold tracking-[0.2em] text-[#45e08c] mb-1">◈ {L('off.title')}</div>
          <h2 className="font-display font-bold text-[20px] text-[#d5e1ef] m-0 leading-tight">{L('off.body')}</h2>
          <div className="text-[10px] text-[#5c6b7f] mt-1">
            {L('off.time')}: {(s.offline.hours).toFixed(1)} {L('off.h')}
          </div>
          <div className="mt-3 space-y-1.5">
            {s.offline.data > 0 && (
              <div className="flex items-center gap-2 text-[14px] font-bold text-[#3fc1ff]">
                <ResIcon res="data" size={14} /> +{Math.floor(s.offline.data).toLocaleString()}
              </div>
            )}
            {s.offline.credits > 0 && (
              <div className="flex items-center gap-2 text-[14px] font-bold text-[#ffd24a]">
                <ResIcon res="credits" size={14} /> +{Math.floor(s.offline.credits).toLocaleString()}
              </div>
            )}
          </div>
          <button
            onClick={() => game.collectOffline()}
            className="mt-4 w-full py-2 border border-[#45e08c]/60 text-[#45e08c] font-display font-bold text-[13px] tracking-[0.15em] hover:bg-[#45e08c]/10 active:scale-[0.98] transition-all"
          >
            {L('off.collect')}
          </button>
        </Modal>
      )}

      {/* core online modal */}
      {s.showCoreModal && (
        <Modal accent="#45e08c">
          <div className="text-[10px] font-bold tracking-[0.2em] text-[#ffd24a] mb-1">★ {GOAL_FRAGMENTS} / {GOAL_FRAGMENTS}</div>
          <h2 className="font-display font-bold text-[24px] text-[#45e08c] m-0 leading-tight tracking-wide">{L('core.title')}</h2>
          <p className="text-[12px] text-[#a9bad0] leading-snug mt-2 mb-0">{L('core.body')}</p>
          <button
            onClick={() => game.closeCoreModal()}
            className="mt-4 w-full py-2 border border-[#45e08c]/60 text-[#45e08c] font-display font-bold text-[13px] tracking-[0.15em] hover:bg-[#45e08c]/10 active:scale-[0.98] transition-all"
          >
            {L('core.go')}
          </button>
        </Modal>
      )}

      {/* help */}
      {s.helpOpen && (
        <Modal>
          <h2 className="font-display font-bold text-[18px] text-[#d5e1ef] m-0 tracking-wide">{L('help.title')}</h2>
          <div className="mt-3 space-y-1.5 text-[11px] text-[#a9bad0] leading-snug">
            <p className="m-0 hidden md:block">▸ {L('help.d1')}</p>
            <p className="m-0 hidden md:block">▸ {L('help.d2')}</p>
            <p className="m-0 hidden md:block">▸ {L('help.d3')}</p>
            <p className="m-0 hidden md:block">▸ {L('help.d4')}</p>
            <p className="m-0 md:hidden">▸ {L('help.m1')}</p>
            <p className="m-0 md:hidden">▸ {L('help.m2')}</p>
            <p className="m-0 pt-2 text-[#3fc1ff] font-bold tracking-wide">{L('help.rule')}</p>
          </div>
          <button
            onClick={() => game.setHelpOpen(false)}
            className="mt-4 w-full py-2 border border-[#3fc1ff]/50 text-[#3fc1ff] font-display font-bold text-[12px] tracking-[0.15em] hover:bg-[#3fc1ff]/10 transition-colors"
          >
            {L('help.close')}
          </button>
        </Modal>
      )}
    </>
  );
}

function Modal({ children, accent = '#3fc1ff' }: { children: ReactNode; accent?: string }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#070a0f]/70">
      <div
        className="w-full max-w-[360px] bg-[#121926] border p-5 animate-[modalin_0.2s_ease-out]"
        style={{ borderColor: accent + '55', boxShadow: `0 0 40px ${accent}22, 0 20px 60px rgba(0,0,0,0.6)` }}
      >
        {children}
      </div>
    </div>
  );
}

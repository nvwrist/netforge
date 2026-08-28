import { useEffect, useRef, useState } from 'react';
import {
  CATEGORY_ORDER, NODE_DEFS, RES_META, RES_ORDER, TECH_DEFS, TUNE, tr,
} from '../game/data';
import type { Game } from '../game/Game';
import { drawNodeIcon } from '../game/icons';
import type { Lang, NodeDef, NodeTypeId, ResourceId, UISnapshot } from '../game/types';
import { ResIcon } from './panels';

// ── canvas node icon (shared art with the world renderer) ────────────────────

export function NodeIcon({ type, size = 44 }: { type: NodeTypeId; size?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    c.width = Math.round(size * dpr);
    c.height = Math.round(size * dpr);
    const ctx = c.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size, size);
    drawNodeIcon(ctx, type, size / 2, size / 2);
  }, [type, size]);
  return <canvas ref={ref} style={{ width: size, height: size }} aria-hidden />;
}

function ResChip({ res, lang, amount }: { res: ResourceId; lang: Lang; amount?: number }) {
  return (
    <span
      className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[9.5px] font-bold tracking-wide"
      style={{ color: RES_META[res].color, background: RES_META[res].color + '14', border: `1px solid ${RES_META[res].color}44` }}
    >
      <ResIcon res={res} size={10} />
      {tr(lang, RES_META[res].nameKey)}
      {amount !== undefined && <b>×{amount}</b>}
    </span>
  );
}

function PortsRow({ def, lang }: { def: NodeDef; lang: Lang }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[9px] text-[#5c6b7f] font-bold tracking-wider">
      <span className="inline-flex items-center gap-1">
        <span className="text-[#7d8ca0]">{tr(lang, 'codex.in')}:</span>
        {def.inputs.length === 0
          ? <span className="text-[#45e08c] normal-case font-semibold">{tr(lang, 'codex.src')}</span>
          : def.inputs.map((r, i) => <ResChip key={i} res={r} lang={lang} />)}
      </span>
      <span className="inline-flex items-center gap-1">
        <span className="text-[#7d8ca0]">{tr(lang, 'codex.out')}:</span>
        {def.outputs.length === 0
          ? <span className="text-[#5c6b7f]">{tr(lang, 'codex.none')}</span>
          : def.outputs.map((r, i) => <ResChip key={i} res={r} lang={lang} />)}
      </span>
    </div>
  );
}

function RecipeRow({ def, lang }: { def: NodeDef; lang: Lang }) {
  const r = def.recipe;
  if (!r) {
    return (
      <div className="text-[10px] text-[#5c6b7f]">
        {tr(lang, 'codex.buf')}: <b className="text-[#a9bad0]">{def.capacity}</b>
      </div>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
      {r.inputs.length > 0 && (
        <>
          {r.inputs.map((i, idx) => (
            <span key={idx} className="inline-flex items-center gap-1">
              {idx > 0 && <span className="text-[#5c6b7f]">+</span>}
              <ResChip res={i.resource} lang={lang} amount={i.amount} />
            </span>
          ))}
          <span className="text-[#7d8ca0]">→</span>
        </>
      )}
      {r.outputs.map((o, idx) => (
        <span key={idx} className="inline-flex items-center gap-1">
          <ResChip res={o.resource} lang={lang} amount={o.amount} />
          {o.resource === 'credits' && <span className="text-[9px] text-[#5c6b7f]">({tr(lang, 'codex.wallet')})</span>}
          {o.resource === 'fragment' && <span className="text-[9px] text-[#5c6b7f]">({tr(lang, 'codex.goal')})</span>}
        </span>
      ))}
      <span className="text-[#5c6b7f] ml-1">/ {r.time} {tr(lang, 'codex.sec')}</span>
    </div>
  );
}

// ── codex modal ──────────────────────────────────────────────────────────────

type CodexTab = 'nodes' | 'res' | 'links' | 'faq';

export function CodexModal({ game, snap }: { game: Game; snap: UISnapshot }) {
  const [tab, setTab] = useState<CodexTab>('nodes');
  const L = (k: string) => tr(snap.lang, k);
  const techName = (id: string) => TECH_DEFS.find((t) => t.id === id)?.nameKey ?? '';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4" style={{ background: 'rgba(7,10,14,0.82)', animation: 'fadein 0.15s ease-out' }}>
      <div className="panel w-full max-w-3xl max-h-[92vh] flex flex-col" style={{ animation: 'modalin 0.18s ease-out' }}>
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#223041]">
          <span className="font-display font-bold text-[15px] tracking-[0.16em] text-[#d7e3f4]">
            <span className="text-[#3fc1ff]">▣</span> {L('codex.title')}
          </span>
          <button className="hud-btn" onClick={() => game.setCodexOpen(false)}>✕</button>
        </div>

        <div className="flex gap-1 px-4 pt-2.5">
          {(['nodes', 'res', 'links', 'faq'] as CodexTab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-3 py-1.5 text-[10.5px] font-display font-bold tracking-widest border border-b-0 transition-colors ${
                tab === t
                  ? 'bg-[#1b2634] border-[#3fc1ff]/50 text-[#3fc1ff]'
                  : 'border-[#223041] text-[#7d8ca0] hover:text-[#a9bad0]'
              }`}
            >
              {L(t === 'nodes' ? 'codex.tabNodes' : t === 'res' ? 'codex.tabRes' : t === 'links' ? 'codex.tabLinks' : 'codex.tabFaq')}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3 bg-[#10161f]">
          {tab === 'nodes' && CATEGORY_ORDER.map((cat) => {
            const defs = Object.values(NODE_DEFS).filter((d) => d.category === cat);
            return (
              <div key={cat} className="mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="font-display font-bold text-[11px] tracking-[0.2em] text-[#7d8ca0]">{L('codex.cat.' + cat)}</span>
                  <span className="flex-1 h-px bg-[#223041]" />
                </div>
                <div className="grid sm:grid-cols-2 gap-2">
                  {defs.map((def) => (
                    <div key={def.id} className="panel p-2.5 bg-[#131a24]">
                      <div className="flex items-start gap-2.5">
                        <div className="shrink-0 w-11 h-11 border border-[#223041] bg-[#10161d] flex items-center justify-center">
                          <NodeIcon type={def.id} size={36} />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-display font-bold text-[12px] tracking-wide text-[#d5e1ef]">{L(def.nameKey)}</span>
                            {def.requireCore
                              ? <span className="text-[8px] font-bold px-1 py-px bg-[#ffd24a]/15 text-[#ffd24a] border border-[#ffd24a]/40 tracking-wider">{L('goal.title')}</span>
                              : def.tech
                                ? <span className="text-[8px] font-bold px-1 py-px bg-[#3fc1ff]/10 text-[#3fc1ff] border border-[#3fc1ff]/30 tracking-wider">{L(techName(def.tech))}</span>
                                : <span className="text-[8px] font-bold px-1 py-px bg-[#45e08c]/10 text-[#45e08c] border border-[#45e08c]/30 tracking-wider">{L('codex.basic')}</span>}
                          </div>
                          <div className="text-[9.5px] text-[#7d8ca0] leading-snug mt-0.5">{L(def.descKey)}</div>
                        </div>
                      </div>
                      <div className="mt-2 pt-2 border-t border-[#1c2735] space-y-1.5">
                        <PortsRow def={def} lang={snap.lang} />
                        <RecipeRow def={def} lang={snap.lang} />
                        <div className="text-[8.5px] text-[#5c6b7f] leading-snug">
                          {tr(snap.lang, 'codex.lvl.' + def.category, {
                            t: String(Math.round((1 - TUNE.nodeTimePerLevel) * 100)),
                            q: String(Math.round(TUNE.nodeQtyPerLevel * 100)),
                            c: String(Math.round(TUNE.nodeCapPerLevel * 100)),
                            d: String(Math.round(TUNE.nodeDrainPerLevel * 100)),
                          })}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}

          {tab === 'res' && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="font-display font-bold text-[11px] tracking-[0.2em] text-[#7d8ca0]">{L('codex.resTitle')}</span>
                <span className="flex-1 h-px bg-[#223041]" />
              </div>
              <p className="text-[11px] text-[#a9bad0] leading-relaxed mb-3 max-w-xl">{L('codex.resBody')}</p>
              <div className="space-y-1.5">
                {RES_ORDER.map((r) => (
                  <div key={r} className="flex items-start gap-3 panel p-2.5 bg-[#131a24]">
                    <span className="mt-0.5 w-3 h-3 shrink-0" style={{ background: RES_META[r].color }} />
                    <div>
                      <div className="font-display font-bold text-[12px] tracking-wide" style={{ color: RES_META[r].color }}>
                        {L(RES_META[r].nameKey)}
                      </div>
                      <div className="text-[10px] text-[#7d8ca0] leading-snug mt-0.5">{L('resd.' + r)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab === 'links' && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="font-display font-bold text-[11px] tracking-[0.2em] text-[#7d8ca0]">{L('codex.linksTitle')}</span>
                <span className="flex-1 h-px bg-[#223041]" />
              </div>
              <div className="space-y-2 max-w-xl">
                {['cx.r1', 'cx.r2', 'cx.r3', 'cx.r4', 'cx.r5'].map((k, i) => (
                  <div key={k} className="flex gap-3 panel p-2.5 bg-[#131a24]">
                    <span className="font-display font-bold text-[13px] text-[#3fc1ff] w-5 shrink-0">{i + 1}</span>
                    <span className="text-[11px] text-[#c3cfdd] leading-relaxed">{L(k)}</span>
                  </div>
                ))}
                <div className="flex gap-3 p-2.5 border border-[#ffb02e]/35 bg-[#ffb02e]/8">
                  <span className="font-display font-bold text-[13px] text-[#ffb02e] w-5 shrink-0">⚡</span>
                  <span className="text-[11px] text-[#d8c9a8] leading-relaxed">{L('cx.bw')}</span>
                </div>
              </div>
            </div>
          )}

          {tab === 'faq' && (
            <div className="space-y-1.5 max-w-2xl">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13].map((i) => (
                <details key={i} className="panel bg-[#131a24] group" open={i <= 2}>
                  <summary className="cursor-pointer list-none px-3 py-2 flex items-center gap-2 select-none">
                    <span className="text-[#3fc1ff] font-display font-bold text-[11px] transition-transform group-open:rotate-90">▸</span>
                    <span className="text-[11.5px] font-bold text-[#d5e1ef]">{L(`faq.q${i}`)}</span>
                  </summary>
                  <div className="px-3 pb-2.5 pl-7 text-[10.5px] text-[#93a5bb] leading-relaxed">{L(`faq.a${i}`)}</div>
                </details>
              ))}
            </div>
          )}
        </div>

        <div className="px-4 py-2 border-t border-[#223041] flex items-center justify-between text-[9px] text-[#5c6b7f] tracking-wider">
          <span>{L('help.rule')}</span>
          <span>{L('goal.title')}: ∞ {L('hud.tier').toLowerCase()}</span>
        </div>
      </div>
    </div>
  );
}

// ── start screen ─────────────────────────────────────────────────────────────

export function StartScreen({ game, snap }: { game: Game; snap: UISnapshot }) {
  const L = (k: string) => tr(snap.lang, k);
  const hasProgress = snap.nodeCount > 2 || snap.walletData > 60 || snap.fragments > 0 || snap.credits > 0 || snap.coreTier > 0;

  const chain: [string, string][] = [
    [L('nd.relay'), L('nd.storage')],
    [L('nd.storage'), L('nd.router') + ' → ' + L('nd.processor')],
    [L('nd.compute'), L('nd.processor')],
    [L('nd.processor'), L('res.fragment') + ' → ' + L('goal.title')],
  ];

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-3 overflow-y-auto"
      style={{
        background: 'radial-gradient(1200px 700px at 30% 20%, rgba(63,193,255,0.07), transparent 60%), radial-gradient(900px 600px at 80% 85%, rgba(255,176,46,0.05), transparent 60%), rgba(9,12,17,0.94)',
        animation: 'fadein 0.25s ease-out',
      }}
    >
      <div className="w-full max-w-2xl my-auto" style={{ animation: 'modalin 0.25s ease-out' }}>
        <div className="panel bg-[#10161f]/95 p-5 sm:p-7 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-0.5" style={{ background: 'linear-gradient(90deg, #3fc1ff, #3fc1ff22 40%, transparent)' }} />

          <div className="flex items-center gap-2 text-[9px] tracking-[0.3em] text-[#5c6b7f] font-bold">
            <span className="w-1.5 h-1.5 bg-[#45e08c] animate-pulse" />
            {L('start.tag')}
          </div>

          <h1 className="font-display font-bold leading-none mt-3" style={{ fontSize: 'clamp(40px, 8vw, 64px)', letterSpacing: '0.06em', color: '#e8f0fa' }}>
            NET<span className="text-[#3fc1ff]">FORGE</span>
          </h1>
          <p className="text-[12px] sm:text-[13px] text-[#93a5bb] leading-relaxed mt-2.5 max-w-lg">{L('start.desc')}</p>

          <div className="grid sm:grid-cols-2 gap-3 mt-5">
            <div className="border border-[#223041] bg-[#0d131b] p-3">
              <div className="font-display font-bold text-[10px] tracking-[0.22em] text-[#7d8ca0] mb-2">{L('start.controls')}</div>
              <ul className="space-y-1.5 text-[10px] text-[#a9bad0] leading-snug">
                {['help.d1', 'help.d2', 'help.d3', 'help.d4'].map((k) => (
                  <li key={k} className="flex gap-2"><span className="text-[#3fc1ff]">▸</span>{L(k)}</li>
                ))}
                <li className="pt-1 border-t border-[#1c2735] flex gap-2 text-[#7d8ca0]"><span className="text-[#ffb02e]">▸</span>{L('help.m1')}</li>
                <li className="flex gap-2 text-[#7d8ca0]"><span className="text-[#ffb02e]">▸</span>{L('help.m2')}</li>
              </ul>
            </div>
            <div className="border border-[#223041] bg-[#0d131b] p-3">
              <div className="font-display font-bold text-[10px] tracking-[0.22em] text-[#7d8ca0] mb-2">{L('start.chain')}</div>
              <div className="space-y-2">
                {chain.map(([a, b], i) => (
                  <div key={i} className="flex items-center gap-2 text-[10px] font-semibold">
                    <span className="px-1.5 py-0.5 border border-[#2a3a4e] text-[#c3cfdd] bg-[#131b26] whitespace-nowrap">{a}</span>
                    <span className="text-[#3fc1ff]">──▸</span>
                    <span className="px-1.5 py-0.5 border border-[#2a3a4e] text-[#c3cfdd] bg-[#131b26]">{b}</span>
                  </div>
                ))}
                <div className="text-[9.5px] text-[#5c6b7f] leading-snug pt-1 border-t border-[#1c2735]">
                  {L('help.rule')}
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 mt-5">
            <button
              onClick={() => game.startGame()}
              className="font-display font-bold text-[16px] tracking-[0.14em] px-6 py-3 border border-[#3fc1ff]/70 text-[#3fc1ff] bg-[#3fc1ff]/10 hover:bg-[#3fc1ff]/20 hover:shadow-[0_0_24px_rgba(63,193,255,0.25)] transition-all active:scale-[0.98]"
            >
              ▶ {hasProgress ? L('start.continue') : L('start.play')}
            </button>
            <button
              onClick={() => game.setCodexOpen(true)}
              className="font-display font-bold text-[12px] tracking-[0.14em] px-5 py-3 border border-[#33465e] text-[#a9bad0] hover:border-[#ffb02e]/60 hover:text-[#ffb02e] transition-colors active:scale-[0.98]"
            >
              ▣ {L('start.codex')}
            </button>
          </div>
          <div className="mt-3 text-[9px] text-[#5c6b7f] tracking-wider">{L('start.tip')}</div>
        </div>
      </div>
    </div>
  );
}

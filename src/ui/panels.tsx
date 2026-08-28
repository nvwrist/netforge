import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { CATEGORY_ORDER, NODE_DEFS, RES_META, fmt, fmtRate, tr } from '../game/data';
import { MODULE_DEFS } from '../game/data/modules';
import type { Game } from '../game/Game';
import type { CostEntry, ResourceId, UISnapshot } from '../game/types';

export function useGameUI(game: Game): UISnapshot {
  return useSyncExternalStore(game.subscribe, game.getSnapshot);
}

// ── resource icons (inline SVG, themed) ─────────────────────────────────────

export function ResIcon({ res, size = 12 }: { res: ResourceId; size?: number }) {
  const c = RES_META[res].color;
  const s = { width: size, height: size };
  switch (res) {
    case 'data':
      return (
        <svg style={s} viewBox="0 0 12 12" fill="none">
          <ellipse cx="6" cy="2.6" rx="4.4" ry="1.7" stroke={c} strokeWidth="1.2" />
          <path d="M1.6 2.6v6.8c0 .9 2 1.7 4.4 1.7s4.4-.8 4.4-1.7V2.6" stroke={c} strokeWidth="1.2" />
          <path d="M1.6 6c0 .9 2 1.7 4.4 1.7S10.4 6.9 10.4 6" stroke={c} strokeWidth="1.2" />
        </svg>
      );
    case 'compute':
      return (
        <svg style={s} viewBox="0 0 12 12" fill="none">
          <rect x="2.5" y="2.5" width="7" height="7" stroke={c} strokeWidth="1.2" />
          <rect x="4.6" y="4.6" width="2.8" height="2.8" fill={c} />
          <path d="M4 2.5V.8M8 2.5V.8M4 11.2V9.5M8 11.2V9.5M2.5 4H.8M2.5 8H.8M11.2 4H9.5M11.2 8H9.5" stroke={c} strokeWidth="1.1" />
        </svg>
      );
    case 'credits':
      return (
        <svg style={s} viewBox="0 0 12 12" fill="none">
          <path d="M6 .9 10.6 3.4v5.2L6 11.1 1.4 8.6V3.4L6 .9Z" stroke={c} strokeWidth="1.2" />
          <circle cx="6" cy="6" r="1.6" fill={c} />
        </svg>
      );
    case 'fragment':
      return (
        <svg style={s} viewBox="0 0 12 12" fill="none">
          <path d="M6 .8 11 6 6 11.2 1 6 6 .8Z" stroke={c} strokeWidth="1.2" />
          <path d="M6 3.4 8.4 6 6 8.6 3.6 6 6 3.4Z" fill={c} />
        </svg>
      );
    case 'processed':
      return (
        <svg style={s} viewBox="0 0 12 12" fill="none">
          <circle cx="6" cy="6" r="4.2" stroke={c} strokeWidth="1.2" />
          <path d="M6 3.4v2.6l2 1.4" stroke={c} strokeWidth="1.2" />
        </svg>
      );
    case 'filtered':
      return (
        <svg style={s} viewBox="0 0 12 12" fill="none">
          <path d="M1.4 1.8h9.2L7.2 6.4v4L4.8 9V6.4L1.4 1.8Z" stroke={c} strokeWidth="1.2" />
        </svg>
      );
    case 'encrypted':
      return (
        <svg style={s} viewBox="0 0 12 12" fill="none">
          <rect x="2.4" y="5" width="7.2" height="5.6" stroke={c} strokeWidth="1.2" />
          <path d="M3.8 5V3.6a2.2 2.2 0 0 1 4.4 0V5" stroke={c} strokeWidth="1.2" />
          <circle cx="6" cy="7.8" r="1" fill={c} />
        </svg>
      );
    case 'signal':
      return (
        <svg style={s} viewBox="0 0 12 12" fill="none">
          <path d="M1.4 8.6 4 6l2 2 2.4-3 2.2 1.6" stroke={c} strokeWidth="1.2" strokeLinejoin="round" />
          <circle cx="6" cy="2.4" r="1.2" fill={c} />
        </svg>
      );
    default:
      return (
        <svg style={s} viewBox="0 0 12 12" fill="none">
          <rect x="2" y="2" width="8" height="8" stroke={c} strokeWidth="1.2" />
          <circle cx="6" cy="6" r="1.5" fill={c} />
        </svg>
      );
  }
}

export function CostChips({ cost, afford, lang }: { cost: CostEntry[]; afford: boolean; lang: 'ru' | 'en' }) {
  return (
    <span className="inline-flex items-center gap-2 flex-wrap">
      {cost.map((e) => (
        <span key={e.res} className={`inline-flex items-center gap-1 text-[11px] font-semibold ${afford ? 'text-[#a9bad0]' : 'text-[#ff5d5d]'}`}>
          <ResIcon res={e.res} />{fmt(e.amount)}
        </span>
      ))}
      {cost.length === 0 && <span className="text-[10px] text-[#5c6b7f]">{tr(lang, 'info.max')}</span>}
    </span>
  );
}

// ── top bar ──────────────────────────────────────────────────────────────────

function RateLabel({ rate, lang }: { rate: number; lang: 'ru' | 'en' }) {
  if (Math.abs(rate) < 0.05) return <span className="text-[8px] text-[#46586e] leading-none">&nbsp;</span>;
  const up = rate > 0;
  return (
    <span className={`text-[8px] font-bold leading-none ${up ? 'text-[#45e08c]' : 'text-[#ff5d5d]'}`}>
      {up ? '▲ +' : '▼ '}{fmtRate(rate)}{tr(lang, 'hud.pcs')}
    </span>
  );
}

export function TopBar({ game }: { game: Game }) {
  const s = useGameUI(game);
  const [armReset, setArmReset] = useState(false);
  const L = (k: string) => tr(s.lang, k);
  const dataRef = useRef<HTMLSpanElement>(null);
  const creditsRef = useRef<HTMLSpanElement>(null);
  const fragRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const t: Record<string, { x: number; y: number }> = {};
    const put = (key: string, el: HTMLSpanElement | null) => {
      if (!el) return;
      const r = el.getBoundingClientRect();
      t[key] = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    };
    put('data', dataRef.current);
    put('credits', creditsRef.current);
    put('fragment', fragRef.current);
    game.setHudTargets(t);
  });

  const tierPct = Math.min(100, (s.coreFragments / Math.max(1, s.coreGoal)) * 100);
  const R = 11;
  const CIRC = 2 * Math.PI * R;

  return (
    <div className="absolute top-0 inset-x-0 z-30 h-12 flex items-center gap-3 px-3 bg-[#10161f]/95 border-b border-[#223041]">
      <div className="font-display font-bold text-[18px] tracking-[0.12em] text-[#d7e3f4] leading-none whitespace-nowrap">
        NET<span className="text-[#3fc1ff]">FORGE</span>
      </div>

      <div className="h-6 w-px bg-[#223041] hidden sm:block" />

      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar flex-1 min-w-0">
        <span ref={dataRef} className="hud-chip flex-col !items-start !gap-0 !py-1">
          <span className="flex items-center gap-1.5">
            <ResIcon res="data" size={13} />
            <b className="text-[#3fc1ff] text-[12px]">{fmt(s.walletData)}</b>
          </span>
          <RateLabel rate={s.dataRate} lang={s.lang} />
        </span>
        <span ref={creditsRef} className="hud-chip flex-col !items-start !gap-0 !py-1">
          <span className="flex items-center gap-1.5">
            <ResIcon res="credits" size={13} />
            <b className="text-[#ffd24a] text-[12px]">{fmt(s.credits)}</b>
          </span>
          <RateLabel rate={s.creditsRate} lang={s.lang} />
        </span>
        <span ref={fragRef} className="hud-chip min-w-[120px]">
          <svg width="26" height="26" viewBox="0 0 26 26" className="-rotate-90">
            <circle cx="13" cy="13" r={R} fill="none" stroke="#1c2735" strokeWidth="2.5" />
            <circle
              cx="13" cy="13" r={R} fill="none"
              stroke={s.coreOnline ? '#45e08c' : '#45e08c'}
              strokeWidth="2.5"
              strokeDasharray={CIRC}
              strokeDashoffset={CIRC * (1 - tierPct / 100)}
              style={{ transition: 'stroke-dashoffset 0.3s' }}
            />
          </svg>
          <span className="absolute" />
          <b className="text-[#45e08c] text-[12px] -ml-[22px] mr-1">{fmt(s.coreFragments)}</b>
          <span className="text-[#5c6b7f] text-[9px] whitespace-nowrap">/ {fmt(s.coreGoal)}</span>
          <span className={`text-[9px] font-bold px-1 border ${s.coreOnline ? 'text-[#ffd24a] border-[#ffd24a]/50' : 'text-[#5c6b7f] border-[#33465e]'}`}>
            T{s.coreTier + 1}
          </span>
        </span>
        {s.legacy > 0 && (
          <span className="hud-chip" title={L('hud.legacy')}>
            <span className="text-[#c792ff] font-bold text-[11px]">◆ {fmt(s.legacy)}</span>
          </span>
        )}
      </div>

      <div className="hidden lg:flex items-center gap-3 text-[10px] text-[#7d8ca0] whitespace-nowrap">
        <span className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-[#45e08c] animate-pulse" />
          <span className="text-[#a9bad0] font-semibold">{L('hud.net')}: {L('hud.online')}</span>
        </span>
        <span>{L('hud.nodes')}: <b className="text-[#cfd9e6]">{s.nodeCount}</b></span>
        <span>{L('hud.links')}: <b className="text-[#cfd9e6]">{s.connCount}</b></span>
        <span>{L('hud.flow')}: <b className="text-[#cfd9e6]">{fmtRate(s.flowRate)}{L('hud.pcs')}</b></span>
      </div>

      <div className="flex items-center gap-1">
        <button className="hud-btn" onClick={() => game.setLeaderboardOpen(true)} title={L('lb.title')}>
          <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
            <path d="M3.5 2h7v3.5a3.5 3.5 0 0 1-7 0V2Z" stroke="#ffd24a" strokeWidth="1.2" />
            <path d="M3.5 3H1.8v1.2A2.3 2.3 0 0 0 4 6.4M10.5 3h1.7v1.2a2.3 2.3 0 0 1-2.2 2.2M7 9v2M4.8 12.2h4.4" stroke="#ffd24a" strokeWidth="1.2" />
          </svg>
        </button>
        <button className="hud-btn" onClick={() => game.setCodexOpen(true)} title={L('menu.codex')}>
          <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
            <path d="M2.5 2.2h4A1.5 1.5 0 0 1 8 3.7v7.6a1.5 1.5 0 0 0-1.5-1.5h-4V2.2ZM11.5 2.2h-4A1.5 1.5 0 0 0 6 3.7v7.6A1.5 1.5 0 0 1 7.5 9.8h4V2.2Z" stroke="#3fc1ff" strokeWidth="1.1" />
          </svg>
        </button>
        <button className="hud-btn" onClick={() => game.setHelpOpen(true)} title={L('help.title')}>?</button>
        <button className="hud-btn" onClick={() => game.toggleMute()} title="sound">
          <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
            <path d="M2 5.5v3h2.5L8 11V3L4.5 5.5H2Z" fill="#a9bad0" />
            {s.muted
              ? <path d="M9.5 5l3 4M12.5 5l-3 4" stroke="#ff5d5d" strokeWidth="1.4" />
              : <path d="M9.8 4.6a3.4 3.4 0 0 1 0 4.8M11.4 3a5.6 5.6 0 0 1 0 8" stroke="#a9bad0" strokeWidth="1.2" />}
          </svg>
        </button>
        <button className="hud-btn font-display font-bold text-[11px]" onClick={() => game.setLang(s.lang === 'ru' ? 'en' : 'ru')}>
          {s.lang === 'ru' ? 'EN' : 'RU'}
        </button>
        {s.prestigeReady && (
          <button
            className="hud-btn font-display font-bold text-[10px] !text-[#c792ff] !border-[#c792ff]/40 hover:!border-[#c792ff]"
            onClick={() => game.setPrestigeOpen(true)}
            title={L('prestige.title')}
          >
            ⟳+
          </button>
        )}
        <button
          className={`hud-btn ${armReset ? '!text-[#ff5d5d] !border-[#ff5d5d]/60' : ''}`}
          onClick={() => {
            if (armReset) { game.resetGame(); setArmReset(false); }
            else { setArmReset(true); setTimeout(() => setArmReset(false), 2500); }
          }}
          title={L('menu.reset')}
        >
          {armReset ? L('menu.confirm') : '↺'}
        </button>
      </div>
    </div>
  );
}

// ── floating view controls (zoom / grid / recenter) ──────────────────────────

export function ViewControls({ game }: { game: Game }) {
  const s = useGameUI(game);
  const L = (k: string) => tr(s.lang, k);
  return (
    <div className="absolute right-3 bottom-3 z-20 flex flex-col gap-1">
      <button className="hud-btn !h-8 !w-8 text-[15px]" onClick={() => game.zoomBy(1.25)} title={L('menu.zoomIn')}>+</button>
      <button className="hud-btn !h-8 !w-8 text-[15px]" onClick={() => game.zoomBy(1 / 1.25)} title={L('menu.zoomOut')}>−</button>
      <button className="hud-btn !h-8 !w-8" onClick={() => game.resetView()} title={L('menu.fit')}>⌖</button>
      <button
        className={`hud-btn !h-8 !w-8 ${s.gridOn ? '!text-[#3fc1ff] !border-[#3fc1ff]/50' : ''}`}
        onClick={() => game.toggleGrid()}
        title={L('menu.grid')}
      >
        ▦
      </button>
    </div>
  );
}

// ── shop / tech / upgrades / achievements ────────────────────────────────────

type Tab = 'nodes' | 'tech' | 'upgrades' | 'ach';

export function ShopPanel({ game }: { game: Game }) {
  const s = useGameUI(game);
  const [tab, setTab] = useState<Tab>('nodes');
  const [pathTab, setPathTab] = useState<'A' | 'B'>('A');
  const L = (k: string) => tr(s.lang, k);

  if (!s.shopOpen) {
    return (
      <button
        onClick={() => game.setShopOpen(true)}
        className="absolute left-3 top-16 z-20 panel px-3 py-2 font-display font-bold text-[13px] tracking-widest text-[#3fc1ff] hover:border-[#3fc1ff]/60 transition-colors"
      >
        ▸ {L('shop.title')}
      </button>
    );
  }

  const baseTech = s.techs.find((t) => t.path === null);
  const pathA = s.techs.filter((t) => t.path === 'A');
  const pathB = s.techs.filter((t) => t.path === 'B');

  return (
    <div className="absolute left-0 top-12 bottom-0 z-20 w-[248px] max-w-[78vw] bg-[#111722]/97 border-r border-[#223041] flex flex-col">
      <div className="flex items-center justify-between px-3 pt-2.5 pb-1.5">
        <span className="font-display font-bold text-[13px] tracking-[0.14em] text-[#8fa3bd]">{L('shop.title')}</span>
        <button className="hud-btn" onClick={() => game.setShopOpen(false)}>✕</button>
      </div>
      <div className="flex gap-1 px-3 pb-2">
        {(['nodes', 'tech', 'upgrades', 'ach'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-1 text-[9px] font-display font-bold tracking-wider border transition-colors ${
              tab === t
                ? 'bg-[#1b2634] border-[#3fc1ff]/50 text-[#3fc1ff]'
                : 'border-[#223041] text-[#7d8ca0] hover:text-[#a9bad0]'
            }`}
          >
            {L(t === 'nodes' ? 'shop.tabNodes' : t === 'tech' ? 'shop.tabTech' : t === 'upgrades' ? 'shop.tabUpg' : 'shop.tabAch')}
            {t === 'ach' && <span className="text-[#5c6b7f]"> {s.achDone}/{s.achTotal}</span>}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-2">
        {tab === 'nodes' && s.blueprintShop.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mt-0.5 mb-1.5">
              <span className="font-display font-bold text-[9.5px] tracking-[0.2em] text-[#c792ff]">◈ {L('bp.shop')}</span>
              <span className="flex-1 h-px bg-[#1c2735]" />
            </div>
            <div className="space-y-2">
              {s.blueprintShop.map((bp) => (
                <button
                  key={bp.id}
                  onClick={() => game.buyBlueprint(bp.id)}
                  className="w-full text-left panel p-2.5 relative transition-all group hover:bg-[#152030] active:scale-[0.99]"
                  style={{ borderColor: bp.afford ? bp.color + '55' : undefined }}
                >
                  <div className="font-display font-bold text-[12.5px] tracking-wide group-hover:text-[#3fc1ff] transition-colors" style={{ color: bp.color }}>
                    {bp.name}
                  </div>
                  <div className="text-[9px] text-[#5c6b7f] mt-0.5">{L(bp.baseNameKey)} · {L('bp.built')}</div>
                  <div className="text-[9.5px] text-[#a9bad0] mt-1 leading-relaxed">
                    {bp.recipe.inputs.map((i, idx) => (
                      <span key={'i' + idx}>{idx > 0 && ' + '}<b style={{ color: RES_META[i.resource].color }}>{i.amount}{L(RES_META[i.resource].nameKey).slice(0, 3)}</b></span>
                    ))}
                    {bp.recipe.inputs.length > 0 && ' → '}
                    {bp.recipe.outputs.map((o, idx) => (
                      <span key={'o' + idx}>{idx > 0 && ' + '}<b style={{ color: RES_META[o.resource].color }}>{o.amount}{L(RES_META[o.resource].nameKey).slice(0, 3)}</b></span>
                    ))}
                    <span className="text-[#5c6b7f]"> · {bp.recipe.time.toFixed(1)}{L('codex.sec')}</span>
                  </div>
                  <div className="mt-1"><CostChips cost={bp.cost} afford={bp.afford} lang={s.lang} /></div>
                </button>
              ))}
            </div>
          </div>
        )}

        {tab === 'nodes' && CATEGORY_ORDER.map((cat) => {
          const items = s.shop.filter((i) => NODE_DEFS[i.id].category === cat);
          if (items.length === 0) return null;
          return (
            <div key={cat}>
              <div className="flex items-center gap-2 mt-2 mb-1.5 first:mt-0">
                <span className="font-display font-bold text-[9.5px] tracking-[0.2em] text-[#5c6b7f]">{L('codex.cat.' + cat)}</span>
                <span className="flex-1 h-px bg-[#1c2735]" />
              </div>
              <div className="space-y-2">
                {items.map((item) => (
                  <button
                    key={item.id}
                    disabled={!item.unlocked}
                    onClick={() => game.buyFromShop(item.id)}
                    className={`w-full text-left panel p-2.5 relative transition-all group ${
                      item.unlocked
                        ? item.afford
                          ? 'hover:border-[#3fc1ff]/70 hover:bg-[#152030] cursor-pointer active:scale-[0.99]'
                          : 'opacity-80 cursor-pointer hover:border-[#33465e]'
                        : 'opacity-45 cursor-not-allowed'
                    }`}
                  >
                    {item.owned > 0 && (
                      <span className="absolute top-1.5 right-2 text-[10px] text-[#5c6b7f] font-semibold">×{item.owned}</span>
                    )}
                    <div className="font-display font-bold text-[12.5px] tracking-wide text-[#d5e1ef] group-hover:text-[#3fc1ff] transition-colors">
                      {L(item.nameKey)}
                    </div>
                    <div className="text-[10px] text-[#7d8ca0] leading-snug mt-0.5 mb-1.5">{L(item.descKey)}</div>
                    {item.unlocked
                      ? <CostChips cost={item.cost} afford={item.afford} lang={s.lang} />
                      : (
                        <span className="text-[9px] font-bold tracking-wider text-[#ffb02e]">
                          ▣ {L(item.requireCore ? 'shop.lockedCore' : 'shop.locked')}
                        </span>
                      )}
                  </button>
                ))}
              </div>
            </div>
          );
        })}

        {tab === 'tech' && (
          <>
            {/* endless research */}
            <div className="panel p-2.5 border-[#c792ff]/30">
              <div className="flex items-center justify-between">
                <span className="font-display font-bold text-[12px] tracking-wide text-[#c792ff]">{L('research.name')}</span>
                <span className="text-[10px] font-bold text-[#c792ff]">{L('hud.tier')} {s.researchTier}</span>
              </div>
              <div className="text-[10px] text-[#7d8ca0] leading-snug mt-0.5 mb-1">{L('research.d')}</div>
              <div className="text-[9px] font-bold text-[#c792ff] mb-1.5" title={L('mod.choice.title')}>
                ◈ {s.unlockedModuleCount}/{s.totalModuleCount}
                {s.blueprintShop.length > 0 && <span className="ml-2 text-[#8fb7ff]">◈ {L('bp.shop')}: {s.blueprintShop.length}</span>}
              </div>
              <button
                onClick={() => game.buyResearch()}
                className={`inline-flex items-center gap-2 border px-2 py-1 text-[10px] font-bold tracking-wider transition-colors ${
                  s.researchAfford
                    ? 'border-[#c792ff]/50 text-[#c792ff] hover:bg-[#c792ff]/10'
                    : 'border-[#33465e] text-[#5c6b7f] cursor-not-allowed'
                }`}
              >
                <CostChips cost={s.researchCost} afford={s.researchAfford} lang={s.lang} />
              </button>
            </div>

            {baseTech && (
              <TechCard t={baseTech} game={game} s={s} />
            )}

            <div className="flex gap-1">
              {([['A', pathA, '#4fe3c1', 'shop.pathA'], ['B', pathB, '#8fb7ff', 'shop.pathB']] as const).map(([p, list, accent, key]) => {
                const unlockedInPath = list.filter((t) => t.unlocked).length;
                return (
                  <button
                    key={p}
                    onClick={() => setPathTab(p)}
                    className={`flex-1 py-1.5 border font-display font-bold text-[10px] tracking-[0.12em] transition-colors ${
                      pathTab === p
                        ? 'bg-[#1b2634]'
                        : 'border-[#223041] text-[#5c6b7f] hover:text-[#a9bad0]'
                    }`}
                    style={pathTab === p ? { borderColor: accent + '66', color: accent } : undefined}
                  >
                    {L(key)}
                    {unlockedInPath > 0 && (
                      <span className="ml-1.5 text-[#45e08c]">✓{unlockedInPath}</span>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="space-y-2">
              <div
                className="text-[8.5px] text-[#5c6b7f] leading-snug"
                style={{ color: pathTab === 'A' ? '#4fe3c1' : '#8fb7ff' }}
              >
                {L(pathTab === 'A' ? 'shop.pathA.d' : 'shop.pathB.d')}
              </div>
              {(pathTab === 'A' ? pathA : pathB).map((t) => <TechCard key={t.id} t={t} game={game} s={s} />)}
            </div>
          </>
        )}

        {tab === 'upgrades' && s.upgrades.map((u) => (
          <div key={u.id} className="w-full text-left panel p-2.5">
            <div className="flex items-center justify-between">
              <span className="font-display font-bold text-[12px] tracking-wide text-[#d5e1ef]">{L(u.nameKey)}</span>
              <span className="text-[10px] font-bold text-[#ffb02e]">{L('info.lvl')} {u.level}</span>
            </div>
            <div className="text-[10px] text-[#7d8ca0] leading-snug mt-0.5 mb-1.5">{L(u.descKey)}</div>
            {u.level >= u.max ? (
              <span className="text-[10px] font-bold text-[#45e08c]">✓ {L('info.max')}</span>
            ) : (
              <button
                onClick={() => game.buyUpgrade(u.id)}
                className={`inline-flex items-center gap-2 border px-2 py-1 text-[10px] font-bold tracking-wider transition-colors ${
                  u.afford
                    ? 'border-[#ffb02e]/50 text-[#ffb02e] hover:bg-[#ffb02e]/10'
                    : 'border-[#33465e] text-[#5c6b7f] cursor-not-allowed'
                }`}
              >
                <CostChips cost={u.cost} afford={u.afford} lang={s.lang} />
              </button>
            )}
          </div>
        ))}

        {tab === 'ach' && s.achievements.map((a) => (
          <div key={a.id} className={`w-full text-left panel p-2.5 ${a.done ? 'border-[#45e08c]/40' : ''}`}>
            <div className="flex items-center justify-between gap-2">
              <span className={`font-display font-bold text-[12px] tracking-wide ${a.done ? 'text-[#45e08c]' : 'text-[#d5e1ef]'}`}>
                {a.done ? '✓ ' : ''}{L(a.nameKey)}
              </span>
              <span className="text-[9px] font-bold text-[#ffd24a] whitespace-nowrap">{a.bonusText}</span>
            </div>
            <div className="text-[10px] text-[#7d8ca0] leading-snug mt-0.5">{L(a.descKey)}</div>
            {a.done && <div className="text-[9px] font-bold text-[#45e08c] mt-1">{L('ach.done')}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}

function TechCard({ t, game, s }: { t: UISnapshot['techs'][number]; game: Game; s: UISnapshot }) {
  const L = (k: string) => tr(s.lang, k);
  return (
    <div className={`w-full text-left panel p-2.5 ${t.unlocked ? 'opacity-70' : !t.available ? 'opacity-45' : ''}`}>
      <div className="font-display font-bold text-[11.5px] tracking-wide text-[#d5e1ef]">{L(t.nameKey)}</div>
      <div className="text-[9.5px] text-[#7d8ca0] leading-snug mt-0.5">{L(t.descKey)}</div>
      <div className="text-[8.5px] text-[#5c6b7f] mt-0.5 mb-1.5">
        ▸ {t.unlocksKeys.map((k) => L(k)).join(' · ')}
      </div>
      {t.unlocked ? (
        <span className="text-[10px] font-bold text-[#45e08c]">✓ {L('hud.online')}</span>
      ) : !t.available ? (
        <span className="text-[9px] font-bold tracking-wider text-[#5c6b7f]">
          {L('shop.requires')}: {t.requiresKey ? L(t.requiresKey) : ''}
        </span>
      ) : (
        <button
          onClick={() => game.unlockTech(t.id)}
          className={`mt-0.5 inline-flex items-center gap-2 border px-2 py-1 text-[10px] font-bold tracking-wider transition-colors ${
            t.afford
              ? 'border-[#45e08c]/50 text-[#45e08c] hover:bg-[#45e08c]/10'
              : 'border-[#33465e] text-[#5c6b7f] cursor-not-allowed'
          }`}
        >
          <CostChips cost={t.cost} afford={t.afford} lang={s.lang} />
        </button>
      )}
      {!t.unlocked && t.late && (
        <div className="text-[8.5px] font-bold tracking-wider text-[#ffb02e] mt-1">⚠ {L('shop.late')}</div>
      )}
    </div>
  );
}

// ── selected node info ───────────────────────────────────────────────────────

export function InfoPanel({ game }: { game: Game }) {
  const s = useGameUI(game);
  const sel = s.selected;
  const L = (k: string) => tr(s.lang, k);
  if (!sel) return null;

  const statusColor =
    sel.statusKey === 'st.online' ? '#45e08c' : sel.statusKey === 'st.waiting' ? '#ffb02e' : sel.statusKey === 'st.full' ? '#ff5d5d' : '#5c6b7f';

  return (
    <div className="absolute right-3 top-16 z-20 w-[236px] max-w-[70vw] panel p-3 animate-[fadein_0.15s_ease-out]">
      <div className="flex items-center justify-between">
        <span className="font-display font-bold text-[13.5px] tracking-wide text-[#d5e1ef]">{L(sel.nameKey)}</span>
        <span className="text-[10px] font-bold text-[#ffb02e]">{L('info.lvl')} {sel.level}</span>
      </div>
      {sel.blueprintName && (
        <div className="text-[9px] font-bold tracking-wider mt-0.5" style={{ color: '#c792ff' }}>
          ◈ {L('bp.title')}: {sel.blueprintName}
        </div>
      )}
      <div className="flex items-center gap-1.5 mt-1">
        <span className="w-1.5 h-1.5 rounded-full" style={{ background: statusColor }} />
        <span className="text-[10px] font-bold tracking-wider" style={{ color: statusColor }}>{L(sel.statusKey)}</span>
        {sel.surge > 0 && <span className="text-[10px] font-bold text-[#ffb02e] ml-1">×3 · {Math.ceil(sel.surge)}s</span>}
      </div>

      <div className="mt-2 space-y-1.5">
        {sel.bars.map((b) => (
          <div key={b.res}>
            <div className="flex justify-between text-[9.5px] text-[#7d8ca0]">
              <span className="flex items-center gap-1"><ResIcon res={b.res} size={10} />{L(RES_META[b.res].nameKey)}</span>
              <span>{fmt(b.cur)} / {fmt(b.cap)}</span>
            </div>
            <div className="h-1.5 bg-[#10161d] border border-[#24303f] mt-0.5">
              <div className="h-full" style={{ width: `${Math.min(100, (b.cur / Math.max(1, b.cap)) * 100)}%`, background: RES_META[b.res].color }} />
            </div>
          </div>
        ))}
      </div>

      {sel.recipe && (
        <div className="mt-2 pt-2 border-t border-[#223041] text-[9.5px] text-[#a9bad0] leading-relaxed">
          <span className="text-[#5c6b7f] font-bold">{L('info.recipe')}: </span>
          {sel.recipe.inputs.map((i, idx) => (
            <span key={'i' + idx}>
              {idx > 0 && ' + '}<b style={{ color: RES_META[i.resource].color }}>{i.amount} {L(RES_META[i.resource].nameKey)}</b>
            </span>
          ))}
          {sel.recipe.inputs.length > 0 && ' → '}
          {sel.recipe.outputs.map((o, idx) => (
            <span key={'o' + idx}>
              {idx > 0 && ' + '}<b style={{ color: RES_META[o.resource].color }}>{o.amount} {L(RES_META[o.resource].nameKey)}</b>
            </span>
          ))}
          <span className="text-[#5c6b7f]"> · {sel.recipe.time.toFixed(1)}{L('codex.sec')}</span>
        </div>
      )}
      {sel.rateLine && (
        <div className="mt-1.5 text-[9.5px] text-[#7d8ca0]">
          {L('info.rate')}: <b className="text-[#3fc1ff]">{fmtRate(sel.rateLine.qty / sel.rateLine.time)}</b> {L(RES_META.data.nameKey).toLowerCase()}{L('hud.pcs')}
        </div>
      )}

      {sel.modules && (
        <div className="mt-2 pt-2 border-t border-[#223041]">
          <div className="flex items-center justify-between mb-1">
            <span className="font-display font-bold text-[9.5px] tracking-[0.18em] text-[#4fe3c1]">{L('mod.slots')}</span>
            <span className="text-[9.5px] text-[#7d8ca0] font-bold">{sel.modules.used}/{sel.modules.slots}</span>
          </div>
          {sel.modules.installed.length === 0 && sel.modules.available.length === 0 && (
            <div className="text-[9px] text-[#46586e] italic">{L('mod.empty')}</div>
          )}
          <div className="space-y-1">
            {sel.modules.installed.map((m, i) => (
              <div key={m.id + i} className="flex items-center gap-1.5 bg-[#10161d] border border-[#1c2735] px-1.5 py-1">
                <span className="text-[#4fe3c1] text-[10px] leading-none">◈</span>
                <div className="min-w-0 flex-1">
                  <div className="text-[9.5px] font-bold text-[#a9bad0] leading-tight">
                    {L(m.nameKey)}{m.slotCost > 1 && <span className="text-[#5c6b7f]"> ·{m.slotCost}⬚</span>}
                  </div>
                  <div className="text-[8.5px] text-[#5c6b7f] leading-tight">{L(m.descKey)}</div>
                </div>
                <button
                  onClick={() => game.removeModule(sel.id, i)}
                  className="shrink-0 text-[8px] font-bold text-[#ff5d5d] border border-[#ff5d5d]/30 px-1 py-0.5 hover:bg-[#ff5d5d]/10 transition-colors"
                  title={L('mod.refund')}
                >
                  {L('mod.remove')}
                </button>
              </div>
            ))}
          </div>
          {sel.modules.available.length > 0 && (
            <div className="mt-1.5 space-y-1">
              {sel.modules.available.map((m) => (
                <div key={m.id} className={`flex items-center gap-1.5 border px-1.5 py-1 ${m.afford ? 'border-[#4fe3c1]/25' : 'border-[#1c2735] opacity-60'}`}>
                  <div className="min-w-0 flex-1">
                    <div className="text-[9.5px] font-bold text-[#d5e1ef] leading-tight">
                      {L(m.nameKey)}{m.slotCost > 1 && <span className="text-[#5c6b7f]"> ·{m.slotCost}⬚</span>}
                    </div>
                    <div className="text-[8.5px] text-[#5c6b7f] leading-tight">{L(m.descKey)}</div>
                  </div>
                  <button
                    onClick={() => game.installModule(sel.id, m.id)}
                    disabled={!m.afford}
                    className={`shrink-0 inline-flex items-center gap-1 text-[8px] font-bold border px-1 py-0.5 transition-colors ${
                      m.afford
                        ? 'text-[#4fe3c1] border-[#4fe3c1]/40 hover:bg-[#4fe3c1]/10'
                        : 'text-[#5c6b7f] border-[#24303f] cursor-not-allowed'
                    }`}
                  >
                    {L('mod.install')} <CostChips cost={m.cost} afford={m.afford} lang={s.lang} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="flex gap-2 mt-2.5">
        <button
          onClick={() => game.upgradeNode(sel.id)}
          disabled={sel.maxed || !sel.canUpgrade}
          className={`flex-1 py-1.5 text-[10px] font-bold tracking-wider border transition-colors ${
            sel.maxed
              ? 'border-[#24303f] text-[#5c6b7f] cursor-default'
              : sel.canUpgrade
                ? 'border-[#ffb02e]/60 text-[#ffb02e] hover:bg-[#ffb02e]/10'
                : 'border-[#24303f] text-[#5c6b7f] cursor-not-allowed'
          }`}
        >
          {sel.maxed ? L('info.max') : (
            <span>{L('info.upgrade')} · <CostChips cost={[sel.upgradeCost]} afford={sel.canUpgrade} lang={s.lang} /></span>
          )}
        </button>
        <button
          onClick={() => game.deleteNodeById(sel.id)}
          className="px-2.5 py-1.5 text-[10px] font-bold tracking-wider border border-[#ff5d5d]/40 text-[#ff5d5d] hover:bg-[#ff5d5d]/10 transition-colors"
        >
          {L('info.delete')}
        </button>
      </div>
    </div>
  );
}

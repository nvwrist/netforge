import { useState, useSyncExternalStore } from 'react';
import { GOAL_FRAGMENTS, RES_META, fmt, fmtRate, tr } from '../game/data';
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
  }
}

export function CostChips({ cost, afford, lang }: { cost: CostEntry[]; afford: boolean; lang: 'ru' | 'en' }) {
  return (
    <span className="inline-flex items-center gap-2">
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

export function TopBar({ game }: { game: Game }) {
  const s = useGameUI(game);
  const [armReset, setArmReset] = useState(false);
  const L = (k: string) => tr(s.lang, k);
  const goalPct = Math.min(100, (s.fragments / GOAL_FRAGMENTS) * 100);

  return (
    <div className="absolute top-0 inset-x-0 z-30 h-12 flex items-center gap-3 px-3 bg-[#10161f]/95 border-b border-[#223041]">
      <div className="font-display font-bold text-[18px] tracking-[0.12em] text-[#d7e3f4] leading-none whitespace-nowrap">
        NET<span className="text-[#3fc1ff]">FORGE</span>
      </div>

      <div className="h-6 w-px bg-[#223041] hidden sm:block" />

      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar flex-1 min-w-0">
        <span className="hud-chip">
          <ResIcon res="data" size={13} />
          <b className="text-[#3fc1ff]">{fmt(s.data)}</b>
        </span>
        <span className="hud-chip">
          <ResIcon res="credits" size={13} />
          <b className="text-[#ffd24a]">{fmt(s.credits)}</b>
        </span>
        <span className="hud-chip min-w-[128px]">
          <ResIcon res="fragment" size={13} />
          <b className="text-[#45e08c]">{fmt(s.fragments)}</b>
          <span className="text-[#5c6b7f] text-[10px]">/ {GOAL_FRAGMENTS}</span>
          <span className="w-10 h-1.5 bg-[#10161d] border border-[#24303f] inline-block ml-1">
            <span className="block h-full bg-[#45e08c]" style={{ width: `${goalPct}%` }} />
          </span>
        </span>
      </div>

      <div className="hidden md:flex items-center gap-3 text-[10px] text-[#7d8ca0] whitespace-nowrap">
        <span className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-[#45e08c] animate-pulse" />
          <span className="text-[#a9bad0] font-semibold">{L('hud.net')}: {L('hud.online')}</span>
        </span>
        <span>{L('hud.nodes')}: <b className="text-[#cfd9e6]">{s.nodeCount}</b></span>
        <span>{L('hud.links')}: <b className="text-[#cfd9e6]">{s.connCount}</b></span>
        <span>{L('hud.flow')}: <b className="text-[#cfd9e6]">{fmtRate(s.flowRate)}{L('hud.pcs')}</b></span>
      </div>

      <div className="flex items-center gap-1">
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

// ── shop / tech / upgrades ───────────────────────────────────────────────────

type Tab = 'nodes' | 'tech' | 'upgrades';

export function ShopPanel({ game }: { game: Game }) {
  const s = useGameUI(game);
  const [tab, setTab] = useState<Tab>('nodes');
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

  return (
    <div className="absolute left-0 top-12 bottom-0 z-20 w-[248px] max-w-[78vw] bg-[#111722]/97 border-r border-[#223041] flex flex-col">
      <div className="flex items-center justify-between px-3 pt-2.5 pb-1.5">
        <span className="font-display font-bold text-[13px] tracking-[0.14em] text-[#8fa3bd]">{L('shop.title')}</span>
        <button className="hud-btn" onClick={() => game.setShopOpen(false)}>✕</button>
      </div>
      <div className="flex gap-1 px-3 pb-2">
        {(['nodes', 'tech', 'upgrades'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-1 text-[10px] font-display font-bold tracking-wider border transition-colors ${
              tab === t
                ? 'bg-[#1b2634] border-[#3fc1ff]/50 text-[#3fc1ff]'
                : 'border-[#223041] text-[#7d8ca0] hover:text-[#a9bad0]'
            }`}
          >
            {L(t === 'nodes' ? 'shop.tabNodes' : t === 'tech' ? 'shop.tabTech' : 'shop.tabUpg')}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-2">
        {tab === 'nodes' && s.shop.map((item) => (
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
              : <span className="text-[9px] font-bold tracking-wider text-[#ffb02e]">▣ {L('shop.locked')}</span>}
          </button>
        ))}

        {tab === 'tech' && s.techs.map((t) => (
          <div key={t.id} className={`w-full text-left panel p-2.5 ${t.unlocked ? 'opacity-70' : ''}`}>
            <div className="font-display font-bold text-[12.5px] tracking-wide text-[#d5e1ef]">{L(t.nameKey)}</div>
            <div className="text-[10px] text-[#7d8ca0] leading-snug mt-0.5">{L(t.descKey)}</div>
            <div className="text-[9px] text-[#5c6b7f] mt-0.5 mb-1.5">
              ▸ {t.unlocksKeys.map((k) => L(k)).join(' · ')}
            </div>
            {t.unlocked ? (
              <span className="text-[10px] font-bold text-[#45e08c]">✓ {L('hud.online')}</span>
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
          </div>
        ))}

        {tab === 'upgrades' && s.upgrades.map((u) => (
          <div key={u.id} className="w-full text-left panel p-2.5">
            <div className="flex items-center justify-between">
              <span className="font-display font-bold text-[12px] tracking-wide text-[#d5e1ef]">{L(u.nameKey)}</span>
              <span className="flex gap-0.5">
                {Array.from({ length: u.max }).map((_, i) => (
                  <span key={i} className={`w-2 h-2 border ${i < u.level ? 'bg-[#ffb02e] border-[#ffb02e]' : 'border-[#33465e]'}`} />
                ))}
              </span>
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
      </div>
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
      <div className="flex items-center gap-1.5 mt-1">
        <span className="w-1.5 h-1.5 rounded-full" style={{ background: statusColor }} />
        <span className="text-[10px] font-bold tracking-wider" style={{ color: statusColor }}>{L(sel.statusKey)}</span>
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
            <span key={idx}>
              {idx > 0 && <span className="text-[#5c6b7f]"> + </span>}
              <span style={{ color: RES_META[i.resource].color }}>{i.amount} {L(RES_META[i.resource].nameKey)}</span>
            </span>
          ))}
          {sel.recipe.inputs.length > 0 && <span className="text-[#5c6b7f]"> → </span>}
          {sel.recipe.outputs.map((o, idx) => (
            <span key={idx}>
              {idx > 0 && <span className="text-[#5c6b7f]"> + </span>}
              <span style={{ color: RES_META[o.resource].color }}>{o.amount} {L(RES_META[o.resource].nameKey)}</span>
            </span>
          ))}
          <span className="text-[#5c6b7f]"> / {sel.recipe.time.toFixed(1)}s</span>
        </div>
      )}

      {sel.rateLine && (
        <div className="mt-1 text-[9.5px] text-[#7d8ca0]">
          {L('info.rate')}: <b className="text-[#3fc1ff]">{fmtRate(sel.rateLine.qty / sel.rateLine.time)}{L('hud.pcs')}</b>
        </div>
      )}

      <div className="mt-2.5 flex gap-1.5">
        <button
          onClick={() => game.upgradeNode(sel.id)}
          disabled={sel.maxed || !sel.canUpgrade}
          className={`flex-1 border px-2 py-1.5 text-[10px] font-display font-bold tracking-wider transition-colors ${
            sel.maxed
              ? 'border-[#24303f] text-[#5c6b7f] cursor-not-allowed'
              : sel.canUpgrade
                ? 'border-[#ffb02e]/60 text-[#ffb02e] hover:bg-[#ffb02e]/10 active:scale-[0.98]'
                : 'border-[#33465e] text-[#5c6b7f] cursor-not-allowed'
          }`}
        >
          {sel.maxed ? L('info.max') : (
            <span className="inline-flex items-center justify-center gap-1.5">
              {L('info.upgrade')}
              <ResIcon res={sel.upgradeCost.res} size={10} />{fmt(sel.upgradeCost.amount)}
            </span>
          )}
        </button>
        <button
          onClick={() => game.deleteNodeById(sel.id)}
          className="border border-[#ff5d5d]/40 text-[#ff5d5d] px-2 py-1.5 text-[10px] font-display font-bold tracking-wider hover:bg-[#ff5d5d]/10 active:scale-[0.98] transition-colors"
        >
          {L('info.delete')}
        </button>
      </div>
    </div>
  );
}

import { NODE_DEFS, TUNE } from './data';
import { defaultUpgrades } from './state';
import type { GameState, Lang, LifeStats, NodeTypeId, OfflineGain, ResourceId, ScoreEntry, TechId, UpgradeId, Wallet } from './types';

const KEY = 'netforge-save-v2';
const SCORE_KEY = 'netforge-scores-v1';

interface SaveNode { id: string; type: string; x: number; y: number; level: number; inv: Record<string, number>; prod: number; modules?: string[]; blueprintId?: string | null }
interface SaveConn { id: string; from: string; to: string }

export interface SaveData {
  v: number; ts: number;
  wallet: Wallet;
  fragments: number;
  coreTier: number; coreFragments: number;
  legacy: number; prestigeCount: number; researchTier: number;
  achievements: string[];
  unlockedModules?: string[];
  moduleChoice?: string[] | null;
  blueprints?: GameState['blueprints'];
  nodes: SaveNode[]; conns: SaveConn[];
  techs: string[]; upgrades: Record<string, number>;
  tutorialStep: number;
  cam: [number, number, number];
  lang: string; muted: boolean; seq: number;
  storageTipShown: boolean;
  stats: {
    delivered: number; placed: number; runCredits: number;
    life?: Partial<LifeStats>;
  };
}

export class SaveManager {
  save(state: GameState): boolean {
    try {
      const d: SaveData = {
        v: 2, ts: Date.now(),
        wallet: { ...state.wallet },
        fragments: state.fragments,
        coreTier: state.coreTier, coreFragments: state.coreFragments,
        legacy: state.legacy, prestigeCount: state.prestigeCount, researchTier: state.researchTier,
        achievements: [...state.achievements],
        unlockedModules: [...state.unlockedModules],
        moduleChoice: state.moduleChoice,
        blueprints: [...state.blueprints],
        nodes: state.nodes.map((n) => ({
          id: n.id, type: n.type, x: n.x, y: n.y, level: n.level,
          inv: { ...n.inv } as Record<string, number>, prod: n.prod,
          modules: [...n.modules], blueprintId: n.blueprintId,
        })),
        conns: state.connections.map((c) => ({ id: c.id, from: c.fromPort, to: c.toPort })),
        techs: [...state.techs],
        upgrades: { ...state.upgrades } as Record<string, number>,
        tutorialStep: state.tutorialStep,
        cam: [state.camX, state.camY, state.camZoom],
        lang: state.lang, muted: state.muted, seq: state.seq,
        storageTipShown: state.storageTipShown,
        stats: {
          delivered: state.stats.delivered, placed: state.stats.placed,
          runCredits: state.stats.runCredits, life: { ...state.stats.life },
        },
      };
      localStorage.setItem(KEY, JSON.stringify(d));
      return true;
    } catch {
      return false;
    }
  }

  load(): SaveData | null {
    try {
      const raw = localStorage.getItem(KEY) ?? localStorage.getItem('netforge-save-v1');
      if (!raw) return null;
      const d = JSON.parse(raw) as SaveData;
      if (!d || !Array.isArray(d.nodes)) return null;
      return d;
    } catch {
      return null;
    }
  }

  clear(): void {
    try { localStorage.removeItem(KEY); localStorage.removeItem('netforge-save-v1'); } catch { /* noop */ }
  }

  // ── leaderboard (endless metric: network power) ───────────────────────────
  loadScores(): ScoreEntry[] {
    try {
      const raw = localStorage.getItem(SCORE_KEY);
      if (!raw) return [];
      const list = JSON.parse(raw) as ScoreEntry[];
      return Array.isArray(list) ? list : [];
    } catch {
      return [];
    }
  }

  submitScore(entry: ScoreEntry): void {
    try {
      const prev = this.loadScores().find((e) => e.name === entry.name);
      // keep the operator's best power, never downgrade it
      const best = prev && prev.power > entry.power ? { ...prev, ts: entry.ts } : entry;
      const list = this.loadScores().filter((e) => e.name !== entry.name);
      list.push(best);
      list.sort((a, b) => b.power - a.power);
      localStorage.setItem(SCORE_KEY, JSON.stringify(list.slice(0, 10)));
    } catch { /* noop */ }
  }
}

const TECH_IDS: TechId[] = ['routing', 'processing', 'security', 'encryptionTech', 'distributed'];

// Apply a validated save onto a fresh state. Broken entries are skipped, never crash.
export function applySave(d: SaveData): GameState {
  const wallet = { credits: Number(d.wallet?.credits) || 0 } as GameState['wallet'];
  wallet.data = Number(d.wallet?.data) || 0;
  const life: LifeStats = { credits: 0, fragments: 0, conns: 0, nodes: 0, upgrades: 0, time: 0 } as LifeStats;
  life.data = 0;
  if (d.stats?.life) {
    life.data = Number(d.stats.life.data) || 0;
    life.credits = Number(d.stats.life.credits) || 0;
    life.fragments = Number(d.stats.life.fragments) || 0;
    life.conns = Number(d.stats.life.conns) || 0;
    life.nodes = Number(d.stats.life.nodes) || 0;
    life.upgrades = Number(d.stats.life.upgrades) || 0;
    life.time = Number(d.stats.life.time) || 0;
  }
  const coreOnlineLegacy = !!(d as unknown as { coreOnline?: boolean }).coreOnline; // v1 saves
  const coreTier = Math.max(0, Math.floor(Number(d.coreTier) || 0));
  const state: GameState = {
    wallet,
    fragments: Number(d.fragments) || 0,
    coreTier: coreTier || (coreOnlineLegacy ? 1 : 0),
    coreFragments: coreTier > 0 ? (Number(d.coreFragments) || 0) : Math.min(Number(d.fragments) || 0, 100),
    legacy: Math.max(0, Number(d.legacy) || 0),
    prestigeCount: Math.max(0, Math.floor(Number(d.prestigeCount) || 0)),
    researchTier: Math.max(0, Math.floor(Number(d.researchTier) || 0)),
    achievements: Array.isArray(d.achievements) ? d.achievements.filter((a) => typeof a === 'string') : [],
    boosts: {},
    unlockedModules: Array.isArray(d.unlockedModules) ? d.unlockedModules.filter((m) => typeof m === 'string') : [],
    moduleChoice: Array.isArray(d.moduleChoice) ? d.moduleChoice.filter((m) => typeof m === 'string') : null,
    blueprints: Array.isArray(d.blueprints) ? d.blueprints.filter((b) => !!b && typeof b.id === 'string' && typeof b.baseType === 'string') : [],
    nodes: [], connections: [],
    techs: (d.techs ?? []).filter((t): t is TechId => TECH_IDS.includes(t as TechId)),
    upgrades: defaultUpgrades(),
    tutorialStep: typeof d.tutorialStep === 'number' ? d.tutorialStep : -1,
    camX: d.cam?.[0] ?? -110, camY: d.cam?.[1] ?? 0, camZoom: Math.min(2.5, Math.max(0.35, d.cam?.[2] ?? 1)),
    lang: (d.lang === 'en' ? 'en' : 'ru') as Lang,
    muted: !!d.muted,
    seq: Number(d.seq) || 1000,
    storageTipShown: !!d.storageTipShown,
    stats: {
      delivered: Number(d.stats?.delivered) || 0,
      placed: Number(d.stats?.placed) || 0,
      runCredits: Number(d.stats?.runCredits) || 0,
      life,
    },
  };
  (Object.keys(state.upgrades) as UpgradeId[]).forEach((u) => {
    const v = Number((d.upgrades as Record<string, number> | undefined)?.[u]);
    if (isFinite(v) && v > 0) state.upgrades[u] = Math.floor(v);
  });

  for (const sn of d.nodes) {
    const type = sn.type as NodeTypeId;
    if (!NODE_DEFS[type]) continue;
    const def = NODE_DEFS[type];
    const node = {
      id: String(sn.id), type, x: Number(sn.x) || 0, y: Number(sn.y) || 0,
      level: Math.min(TUNE.nodeMaxLevel, Math.max(1, Math.floor(Number(sn.level) || 1))),
      inv: {} as Partial<Record<ResourceId, number>>,
      prod: Math.max(0, Number(sn.prod) || 0),
      status: 'idle' as const, statusT: 0, ports: [] as GameState['nodes'][number]['ports'],
      flash: 0, flashColor: '#3fc1ff', surgeWindow: 0, surgeActive: 0,
      modules: Array.isArray(sn.modules) ? sn.modules.filter((m) => typeof m === 'string') : [],
      blueprintId: typeof sn.blueprintId === 'string' ? sn.blueprintId : null,
      redundancyT: 0,
    };
    def.inputs.forEach((res, i) => node.ports.push({ id: `${node.id}|in${i}`, nodeId: node.id, dir: 'in', resource: res, connectionId: null }));
    def.outputs.forEach((res, i) => node.ports.push({ id: `${node.id}|out${i}`, nodeId: node.id, dir: 'out', resource: res, connectionId: null }));
    if (sn.inv) {
      (Object.keys(sn.inv) as ResourceId[]).forEach((r) => {
        const v = Number(sn.inv[r]);
        if (isFinite(v) && v > 0) node.inv[r] = v;
      });
    }
    state.nodes.push(node);
  }

  const nodeIds = new Set(state.nodes.map((n) => n.id));
  const usedPorts = new Set<string>();
  for (const sc of d.conns ?? []) {
    const fromNodeId = String(sc.from).split('|')[0];
    const toNodeId = String(sc.to).split('|')[0];
    if (!nodeIds.has(fromNodeId) || !nodeIds.has(toNodeId) || fromNodeId === toNodeId) continue;
    if (usedPorts.has(String(sc.from)) || usedPorts.has(String(sc.to))) continue;
    state.connections.push({
      id: String(sc.id), fromPort: String(sc.from), toPort: String(sc.to),
      packets: [], acc: 0, throttled: false,
    });
    usedPorts.add(String(sc.from));
    usedPorts.add(String(sc.to));
    for (const n of state.nodes) {
      for (const p of n.ports) {
        if (p.id === sc.from || p.id === sc.to) p.connectionId = String(sc.id);
      }
    }
  }
  return state;
}

// Offline progress: pure timestamp math. No background timers, capped.
export function estimateOffline(d: SaveData): { data: number; credits: number; hours: number } {
  const elapsed = Math.min(TUNE.offlineCapHours * 3600, Math.max(0, (Date.now() - (d.ts || Date.now())) / 1000));
  const hours = elapsed / 3600;
  let produced = 0;
  let credits = 0;
  for (const n of d.nodes) {
    const def = NODE_DEFS[n.type as NodeTypeId];
    if (!def || !def.recipe) continue;
    const recipe = def.recipe;
    if (def.category === 'generator') {
      const out = recipe.outputs[0];
      if (out.resource === 'data') produced += (out.amount / recipe.time) * elapsed * TUNE.offlineEfficiency;
    } else if (def.category === 'processor') {
      recipe.outputs.forEach((o) => {
        if (o.resource === 'credits') credits += (o.amount / recipe.time) * elapsed * TUNE.offlineEfficiency * 0.5;
      });
    }
  }
  // offline production lands in the reserve directly
  const out = { credits: Math.floor(credits), hours } as OfflineGain;
  out.data = Math.floor(produced);
  return out;
}

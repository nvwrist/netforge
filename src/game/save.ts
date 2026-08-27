import { NODE_DEFS, TUNE } from './data';
import { defaultUpgrades } from './state';
import type { GameState, Lang, NodeTypeId, ResourceId, TechId, UpgradeId } from './types';

const KEY = 'netforge-save-v1';

interface SaveNode { id: string; type: string; x: number; y: number; level: number; inv: Record<string, number>; prod: number }
interface SaveConn { id: string; from: string; to: string }

export interface SaveData {
  v: number; ts: number;
  wallet: { data: number; credits: number };
  fragments: number; coreOnline: boolean;
  nodes: SaveNode[]; conns: SaveConn[];
  techs: string[]; upgrades: Record<string, number>;
  tutorialStep: number;
  cam: [number, number, number];
  lang: string; muted: boolean; seq: number;
  stats: { delivered: number; placed: number };
}

export class SaveManager {
  save(state: GameState): boolean {
    try {
      const data: SaveData = {
        v: 1, ts: Date.now(),
        wallet: { ...state.wallet },
        fragments: state.fragments, coreOnline: state.coreOnline,
        nodes: state.nodes.map((n) => ({
          id: n.id, type: n.type, x: n.x, y: n.y, level: n.level,
          inv: { ...n.inv } as Record<string, number>, prod: n.prod,
        })),
        conns: state.connections.map((c) => ({ id: c.id, from: c.fromPort, to: c.toPort })),
        techs: [...state.techs],
        upgrades: { ...state.upgrades } as Record<string, number>,
        tutorialStep: state.tutorialStep,
        cam: [state.camX, state.camY, state.camZoom],
        lang: state.lang, muted: state.muted, seq: state.seq,
        stats: { ...state.stats },
      };
      localStorage.setItem(KEY, JSON.stringify(data));
      return true;
    } catch {
      return false;
    }
  }

  load(): SaveData | null {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return null;
      const d = JSON.parse(raw) as SaveData;
      if (!d || d.v !== 1 || !Array.isArray(d.nodes)) return null;
      return d;
    } catch {
      return null;
    }
  }

  clear(): void {
    try { localStorage.removeItem(KEY); } catch { /* noop */ }
  }
}

// Apply a validated save onto a fresh state. Broken entries are skipped, never crash.
export function applySave(d: SaveData): GameState {
  const state: GameState = {
    wallet: { data: Number(d.wallet?.data) || 0, credits: Number(d.wallet?.credits) || 0 },
    fragments: Number(d.fragments) || 0,
    coreOnline: !!d.coreOnline,
    nodes: [], connections: [],
    techs: (d.techs ?? []).filter((t): t is TechId => ['routing', 'processing', 'security', 'encryptionTech', 'distributed'].includes(t)),
    upgrades: defaultUpgrades(),
    tutorialStep: typeof d.tutorialStep === 'number' ? d.tutorialStep : -1,
    camX: d.cam?.[0] ?? -110, camY: d.cam?.[1] ?? 0, camZoom: Math.min(2.5, Math.max(0.35, d.cam?.[2] ?? 1)),
    lang: (d.lang === 'en' ? 'en' : 'ru') as Lang,
    muted: !!d.muted,
    seq: Number(d.seq) || 1000,
    stats: { delivered: Number(d.stats?.delivered) || 0, placed: Number(d.stats?.placed) || 0 },
  };
  (Object.keys(state.upgrades) as UpgradeId[]).forEach((u) => {
    const v = Number((d.upgrades as Record<string, number> | undefined)?.[u]);
    if (isFinite(v) && v > 0) state.upgrades[u] = Math.min(6, Math.floor(v));
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
      flash: 0, flashColor: '#3fc1ff',
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
  let data = 0;
  let credits = 0;
  for (const n of d.nodes) {
    const def = NODE_DEFS[n.type as NodeTypeId];
    if (!def || !def.recipe) continue;
    const recipe = def.recipe;
    if (def.category === 'generator') {
      const out = recipe.outputs[0];
      if (out.resource === 'data') data += (out.amount / recipe.time) * elapsed * TUNE.offlineEfficiency;
    } else if (def.category === 'processor') {
      recipe.outputs.forEach((o) => {
        if (o.resource === 'credits') credits += (o.amount / recipe.time) * elapsed * TUNE.offlineEfficiency * 0.5;
      });
    }
  }
  return { data: Math.floor(data), credits: Math.floor(credits), hours };
}

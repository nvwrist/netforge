import { NODE_DEFS, TECH_DEFS, TUNE } from './data';
import type {
  Connection, CostEntry, GameNode, GameState, NodeDef, NodeTypeId, Port,
  ResourceId, TechDef, TechId, UpgradeId, Wallet,
} from './types';

export const NODE_W = 176;
const HEADER_H = 26;

// ── Geometry / layout (world units) ──────────────────────────────────────────

export function invResources(def: NodeDef): ResourceId[] {
  const out: ResourceId[] = [];
  const push = (r: ResourceId) => { if (!out.includes(r)) out.push(r); };
  if (def.category === 'generator') def.outputs.forEach(push);
  else if (def.category === 'storage') def.inputs.forEach(push);
  else if (def.category === 'transfer') def.inputs.forEach(push);
  else if (def.recipe) {
    def.inputs.forEach(push);
    def.recipe.outputs.forEach((o) => {
      if (o.resource !== 'fragment' && o.resource !== 'credits') push(o.resource);
    });
  }
  return out;
}

export function nodeH(def: NodeDef): number {
  const bars = invResources(def).length;
  const hasProd = def.category === 'generator' || def.category === 'processor';
  return HEADER_H + 10 + 30 + bars * 18 + (hasProd ? 16 : 0) + 10;
}

export function nodeSize(def: NodeDef): { w: number; h: number } {
  return { w: NODE_W, h: nodeH(def) };
}

export function portPos(node: GameNode, port: Port): { x: number; y: number } {
  const def = NODE_DEFS[node.type];
  const list = node.ports.filter((p) => p.dir === port.dir);
  const idx = list.indexOf(port);
  const h = nodeH(def);
  const usable = h - HEADER_H - 14;
  const y = node.y + HEADER_H + 7 + usable * ((idx + 1) / (list.length + 1));
  const x = port.dir === 'out' ? node.x + NODE_W : node.x;
  return { x, y };
}

// ── Node factory ─────────────────────────────────────────────────────────────

export function makeNode(state: GameState, type: NodeTypeId, x: number, y: number): GameNode {
  const def = NODE_DEFS[type];
  const id = 'n' + (state.seq++);
  const ports: Port[] = [];
  def.inputs.forEach((res, i) => ports.push({ id: `${id}|in${i}`, nodeId: id, dir: 'in', resource: res, connectionId: null }));
  def.outputs.forEach((res, i) => ports.push({ id: `${id}|out${i}`, nodeId: id, dir: 'out', resource: res, connectionId: null }));
  const node: GameNode = {
    id, type, x, y, level: 1, inv: {}, prod: 0,
    status: 'idle', statusT: 0, ports, flash: 0, flashColor: '#3fc1ff',
  };
  state.nodes.push(node);
  return node;
}

// ── Graph queries ────────────────────────────────────────────────────────────

export function findNode(state: GameState, id: string): GameNode | null {
  for (const n of state.nodes) if (n.id === id) return n;
  return null;
}

export function findPort(state: GameState, portId: string): { node: GameNode; port: Port } | null {
  const nodeId = portId.split('|')[0];
  const node = findNode(state, nodeId);
  if (!node) return null;
  const port = node.ports.find((p) => p.id === portId);
  return port ? { node, port } : null;
}

export type ConnValidation =
  | { ok: true }
  | { ok: false; reason: 'toast.errPort' | 'toast.errCompat' | 'toast.errSelf' | 'toast.errDir' };

export function validateConnection(state: GameState, fromPortId: string, toPortId: string): ConnValidation {
  const from = findPort(state, fromPortId);
  const to = findPort(state, toPortId);
  if (!from || !to) return { ok: false, reason: 'toast.errDir' };
  if (from.port.dir !== 'out' || to.port.dir !== 'in') return { ok: false, reason: 'toast.errDir' };
  if (from.node.id === to.node.id) return { ok: false, reason: 'toast.errSelf' };
  if (from.port.connectionId || to.port.connectionId) return { ok: false, reason: 'toast.errPort' };
  if (from.port.resource !== to.port.resource) return { ok: false, reason: 'toast.errCompat' };
  return { ok: true };
}

export function createConnection(state: GameState, fromPortId: string, toPortId: string): Connection | null {
  const v = validateConnection(state, fromPortId, toPortId);
  if (!v.ok) return null;
  const conn: Connection = {
    id: 'c' + (state.seq++), fromPort: fromPortId, toPort: toPortId,
    packets: [], acc: 0, throttled: false,
  };
  state.connections.push(conn);
  const f = findPort(state, fromPortId);
  const t = findPort(state, toPortId);
  if (f) f.port.connectionId = conn.id;
  if (t) t.port.connectionId = conn.id;
  return conn;
}

export function removeConnection(state: GameState, connId: string): void {
  const idx = state.connections.findIndex((c) => c.id === connId);
  if (idx < 0) return;
  const conn = state.connections[idx];
  const f = findPort(state, conn.fromPort);
  const t = findPort(state, conn.toPort);
  if (f) f.port.connectionId = null;
  if (t) t.port.connectionId = null;
  state.connections.splice(idx, 1);
}

export function removeNode(state: GameState, nodeId: string): void {
  const node = findNode(state, nodeId);
  if (!node) return;
  const doomed: string[] = [];
  for (const c of state.connections) {
    if (c.fromPort.startsWith(nodeId + '|') || c.toPort.startsWith(nodeId + '|')) doomed.push(c.id);
  }
  doomed.forEach((id) => removeConnection(state, id));
  state.nodes = state.nodes.filter((n) => n.id !== nodeId);
}

// ── Economy helpers ──────────────────────────────────────────────────────────

export function costOf(def: NodeDef, owned: number): Partial<Record<ResourceId, number>> {
  const out: Partial<Record<ResourceId, number>> = {};
  (Object.keys(def.cost) as ResourceId[]).forEach((r) => {
    out[r] = Math.ceil((def.cost[r] ?? 0) * Math.pow(def.costGrowth, owned));
  });
  return out;
}

export function toEntries(cost: Partial<Record<ResourceId, number>>): CostEntry[] {
  return (Object.keys(cost) as ResourceId[]).map((r) => ({ res: r, amount: cost[r] ?? 0 }));
}

export function canPay(wallet: Wallet, cost: Partial<Record<ResourceId, number>>): boolean {
  return (Object.keys(cost) as ResourceId[]).every((r) => {
    const need = cost[r] ?? 0;
    const have = r === 'data' ? wallet.data : r === 'credits' ? wallet.credits : 0;
    return have >= need;
  });
}

export function pay(wallet: Wallet, cost: Partial<Record<ResourceId, number>>): void {
  (Object.keys(cost) as ResourceId[]).forEach((r) => {
    const need = cost[r] ?? 0;
    if (r === 'data') wallet.data -= need;
    else if (r === 'credits') wallet.credits -= need;
  });
}

export function nodeUpgradeCost(node: GameNode): CostEntry {
  const def = NODE_DEFS[node.type];
  const res: ResourceId = def.cost.credits ? 'credits' : 'data';
  const base = res === 'credits' ? (def.cost.credits ?? 10) : (def.cost.data ?? 20);
  return { res, amount: Math.ceil(base * 4 * Math.pow(2.2, node.level - 1)) };
}

export function ownedCount(state: GameState, type: NodeTypeId): number {
  return state.nodes.filter((n) => n.type === type).length;
}

export function isUnlocked(state: GameState, def: NodeDef): boolean {
  if (def.requireCore) return state.coreOnline;
  if (!def.tech) return true;
  return state.techs.includes(def.tech);
}

// ── Capacities ───────────────────────────────────────────────────────────────

export function storageCapacity(state: GameState): number {
  return Math.round(NODE_DEFS.storage.capacity * (1 + TUNE.capPerLevel * state.upgrades.storageCap));
}

export function inputCapFor(state: GameState, node: GameNode, res: ResourceId): number {
  const def = NODE_DEFS[node.type];
  if (def.category === 'storage') return storageCapacity(state);
  if (def.category === 'transfer') return def.capacity;
  if (def.recipe) {
    const need = def.recipe.inputs.find((i) => i.resource === res);
    if (need) return Math.max(8, need.amount * 4);
  }
  return 12;
}

export function techById(id: TechId): TechDef | null {
  return TECH_DEFS.find((t) => t.id === id) ?? null;
}

export function defaultUpgrades(): Record<UpgradeId, number> {
  return { bandwidth: 0, storageCap: 0, prodSpeed: 0, procSpeed: 0, packetSize: 0 };
}

// ── Initial state ────────────────────────────────────────────────────────────

export function newGame(): GameState {
  const state: GameState = {
    wallet: { data: 60, credits: 0 },
    fragments: 0,
    coreOnline: false,
    nodes: [],
    connections: [],
    techs: [],
    upgrades: defaultUpgrades(),
    tutorialStep: 0,
    camX: -110, camY: 0, camZoom: 1,
    lang: 'ru',
    muted: false,
    seq: 1,
    stats: { delivered: 0, placed: 2 },
  };
  // Starter factory: RELAY → STORAGE (spec §44)
  const relay = makeNode(state, 'relay', -300, -55);
  const storage = makeNode(state, 'storage', 40, -60);
  createConnection(state, relay.ports.find((p) => p.dir === 'out')!.id, storage.ports.find((p) => p.dir === 'in')!.id);
  return state;
}

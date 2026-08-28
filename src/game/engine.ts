import { ACHIEVEMENTS, NODE_DEFS, SURGE_CFG, TUNE } from './data';
import { MODULE_DEFS } from './data/modules';
import { defFor, inputCapFor, storageCapFor } from './state';
import type { GameNode, GameState, ResourceId } from './types';

// Events emitted toward the presentation layer (floats, sounds). Engine stays pure logic.
export interface EngineEvents {
  onWallet(res: 'fragment' | 'credits', amount: number, node: GameNode): void;
  onCycleDone(node: GameNode): void;
  onReserve(amount: number, node: GameNode): void;
}

const RES_TO_WALLET: ResourceId[] = ['fragment', 'credits'];

// ── Global multipliers (endless progression) ─────────────────────────────────

export function globalMult(state: GameState): number {
  return (1 + 0.02 * state.legacy)
    * (1 + 0.10 * state.coreTier)
    * (1 + 0.08 * state.researchTier);
}

export function boostMult(state: GameState, target: 'gen' | 'proc', now: number): number {
  let m = 1;
  for (const id of Object.keys(state.boosts)) {
    const until = state.boosts[id];
    if (!(until > now)) continue;
    const def = ACHIEVEMENTS.find((a) => a.id === id);
    if (!def || def.bonus.kind !== 'boost') continue;
    if (def.bonus.target === target || def.bonus.target === 'all') m = Math.max(m, def.bonus.mult);
  }
  return m;
}

function moduleSpeedMult(node: GameNode): number {
  let s = 1;
  for (const mid of node.modules) {
    const m = MODULE_DEFS.find((x) => x.id === mid);
    if (m?.effect.speedMult) s *= m.effect.speedMult;
  }
  return s;
}

export function effTime(state: GameState, node: GameNode, now: number): number {
  const def = defFor(state, node);
  if (!def.recipe) return 1;
  const up = def.category === 'generator'
    ? Math.pow(TUNE.speedPerLevel, state.upgrades.prodSpeed)
    : Math.pow(TUNE.speedPerLevel, state.upgrades.procSpeed);
  const target = def.category === 'generator' ? 'gen' as const : 'proc' as const;
  const m = globalMult(state) * boostMult(state, target, now);
  let t = def.recipe.time * Math.pow(TUNE.nodeTimePerLevel, node.level - 1) * up / m;
  t /= moduleSpeedMult(node);
  if (node.surgeActive > 0) t /= SURGE_CFG.mult;
  return t;
}

// Side output from modules («byproduct» family). Wallet resources go straight to the reserve.
function applyOutputBonus(state: GameState, node: GameNode, def: ReturnType<typeof defFor>): void {
  for (const mid of node.modules) {
    const m = MODULE_DEFS.find((x) => x.id === mid);
    const b = m?.effect.outputBonus;
    if (!b) continue;
    const amt = Math.max(1, Math.round(b.amount * (1 + TUNE.nodeQtyPerLevel * (node.level - 1))));
    if (b.resource === 'credits') {
      state.wallet.credits += amt;
      state.stats.runCredits += amt;
      state.stats.life.credits += amt;
    } else if (b.resource === 'fragment') {
      state.fragments += amt;
      state.coreFragments += amt;
      state.stats.life.fragments += amt;
    } else if (b.resource === 'data') {
      state.wallet.data += amt;
      state.stats.life.data += amt;
    } else {
      node.inv[b.resource] = Math.min(def.capacity, (node.inv[b.resource] ?? 0) + amt);
    }
  }
}

function redundancySeconds(node: GameNode): number {
  let total = 0;
  for (const mid of node.modules) {
    const m = MODULE_DEFS.find((x) => x.id === mid);
    if (m?.effect.redundancySec) total += m.effect.redundancySec;
  }
  return total;
}

function outQty(node: GameNode, base: number): number {
  return Math.max(1, Math.round(base * (1 + TUNE.nodeQtyPerLevel * (node.level - 1))));
}

// ── Production ───────────────────────────────────────────────────────────────

export function updateProduction(state: GameState, dt: number, now: number, ev: EngineEvents): void {
  const capMult = 1 + TUNE.capPerLevel * state.upgrades.storageCap;
  for (const node of state.nodes) {
    const def = defFor(state, node);
    const prevStatus = node.status;

    // surge timers tick on every node
    if (node.surgeWindow > 0) node.surgeWindow = Math.max(0, node.surgeWindow - dt);
    if (node.surgeActive > 0) node.surgeActive = Math.max(0, node.surgeActive - dt);

    if (def.category === 'generator' && def.recipe) {
      const out = def.recipe.outputs[0];
      const cap = def.capacity;
      const cur = node.inv[out.resource] ?? 0;
      const time = effTime(state, node, now);
      if (cur >= cap - 1e-6) {
        node.status = 'full';
        node.prod = 0;
      } else {
        node.prod += dt;
        let guard = 0;
          while (node.prod >= time && guard++ < 8) {
            node.prod -= time;
            const add = outQty(node, out.amount);
            node.inv[out.resource] = Math.min(cap, (node.inv[out.resource] ?? 0) + add);
            state.stats.life.data += add;
            applyOutputBonus(state, node, def);
            if ((node.inv[out.resource] ?? 0) >= cap - 1e-6) { node.prod = 0; break; }
          }        node.status = (node.inv[out.resource] ?? 0) >= cap - 1e-6 ? 'full' : 'online';
      }
    } else if (def.category === 'processor' && def.recipe) {
      const time = effTime(state, node, now);
      const hasInputs = def.recipe.inputs.every((i) => (node.inv[i.resource] ?? 0) >= i.amount - 1e-6);
      const hasSpace = def.recipe.outputs.every((o) => {
        if (RES_TO_WALLET.includes(o.resource)) return true;
        return (node.inv[o.resource] ?? 0) + outQty(node, o.amount) <= def.capacity + 1e-6;
      });
      // Redundancy module: internal buffer keeps the node running while starved.
      const rMax = redundancySeconds(node);
      if (hasInputs && rMax > 0) node.redundancyT = rMax;
      const onRedundancy = !hasInputs && rMax > 0 && node.redundancyT > 0;
      if (onRedundancy) node.redundancyT = Math.max(0, node.redundancyT - dt);
      if (!hasSpace) {
        node.status = 'full';
        node.prod = Math.min(node.prod, time);
      } else if (!hasInputs && !onRedundancy) {
        node.status = 'waiting';
        node.prod = Math.max(0, node.prod - dt * 0.5);
      } else {
        node.prod += dt;
        let guard = 0;
        while (node.prod >= time && guard++ < 8) {
          const stillHas = def.recipe.inputs.every((i) => (node.inv[i.resource] ?? 0) >= i.amount - 1e-6);
          if (!stillHas && !onRedundancy) { node.prod = time * 0.999; break; }
          if (!stillHas && onRedundancy && def.recipe.inputs.every((i) => (node.inv[i.resource] ?? 0) < 1e-6)) {
            node.prod = time * 0.999; break; // buffer exhausted
          }
          node.prod -= time;
          def.recipe.inputs.forEach((i) => {
            const cur = node.inv[i.resource] ?? 0;
            node.inv[i.resource] = cur - Math.min(cur, i.amount);
          });
          def.recipe.outputs.forEach((o) => {
            const amt = outQty(node, o.amount);
            if (o.resource === 'fragment') {
              state.fragments += amt;
              state.coreFragments += amt;
              state.stats.life.fragments += amt;
              ev.onWallet('fragment', amt, node);
            } else if (o.resource === 'credits') {
              state.wallet.credits += amt;
              state.stats.runCredits += amt;
              state.stats.life.credits += amt;
              ev.onWallet('credits', amt, node);
            } else {
              node.inv[o.resource] = Math.min(def.capacity, (node.inv[o.resource] ?? 0) + amt);
            }
          });
          applyOutputBonus(state, node, def);
          ev.onCycleDone(node);
        }
        node.status = 'online';
      }
    } else if (def.category === 'storage') {
      // Хранилище может держать любой ресурс (data / compute / signal).
      // В резерв (wallet) стекают только валютные ресурсы — data и credits.
      const res = def.inputs[0];
      const cap = storageCapFor(state, node);
      void capMult;
      const fill = node.inv[res] ?? 0;
      if (res === 'data' || res === 'credits') {
        // The fuller the buffer, the faster it drains into the reserve (modules can throttle it).
        let drainMult = 1;
        for (const mid of node.modules) {
          const m = MODULE_DEFS.find((x) => x.id === mid);
          if (m?.effect.drainMult) drainMult *= m.effect.drainMult;
        }
        const rate = TUNE.storageDrainMax * drainMult * Math.pow(Math.max(0, fill) / cap, TUNE.storageDrainExp);
        const take = Math.min(fill, rate * dt);
        if (take > 0) {
          node.inv[res] = fill - take;
          if (res === 'data') state.wallet.data += take;
          else state.wallet.credits += take;
          ev.onReserve(take, node);
        }
      }
      node.status = fill >= cap - 1e-6 ? 'full' : fill > 0.5 ? 'online' : 'idle';
    } else if (def.category === 'transfer') {
      node.status = (node.inv.data ?? 0) > 0.01 ? 'online' : 'idle';
    }

    if (node.status !== prevStatus) node.statusT = 0;
    node.statusT += dt;
  }
}

// ── Connections / packets ────────────────────────────────────────────────────

export function updateConnections(state: GameState, dt: number): { delivered: number } {
  const bwRate = TUNE.baseRate * Math.pow(TUNE.bwMultPerLevel, state.upgrades.bandwidth);
  const pktSize = 1 + state.upgrades.packetSize;
  let delivered = 0;

  for (const conn of state.connections) {
    const fromNodeId = conn.fromPort.split('|')[0];
    const toNodeId = conn.toPort.split('|')[0];
    const src = state.nodes.find((n) => n.id === fromNodeId);
    const dst = state.nodes.find((n) => n.id === toNodeId);
    if (!src || !dst) continue;
    const res = conn.fromPort.includes('|out')
      ? src.ports.find((p) => p.id === conn.fromPort)?.resource
      : undefined;
    if (!res) continue;

    conn.acc = Math.min(2, conn.acc + dt * bwRate);
    while (conn.acc >= 1 && conn.packets.length < 10) {
      const avail = src.inv[res] ?? 0;
      const take = Math.min(pktSize, Math.floor(avail + 1e-6));
      if (take < 1) { conn.acc = Math.min(conn.acc, 0.999); break; }
      src.inv[res] = avail - take;
      conn.packets.push({ t: 0, amount: take, resource: res });
      conn.acc -= 1;
    }

    conn.throttled = false;
    for (const p of conn.packets) {
      if (p.t < 1) p.t = Math.min(1, p.t + dt / TUNE.travelTime);
      if (p.t >= 1) {
        const cap = inputCapFor(state, dst, p.resource);
        const cur = dst.inv[p.resource] ?? 0;
        const space = cap - cur;
        if (space <= 1e-6) {
          conn.throttled = true;
          continue;
        }
        const add = Math.min(p.amount, space);
        dst.inv[p.resource] = cur + add;
        p.amount -= add;
        delivered += add;
        state.stats.delivered += add;
        if (p.amount <= 1e-6) p.t = 2;
        else conn.throttled = true;
      }
    }
    conn.packets = conn.packets.filter((p) => p.t < 2);
    if (conn.packets.length >= 10 && (src.inv[res] ?? 0) >= 1) conn.throttled = true;
  }
  return { delivered };
}

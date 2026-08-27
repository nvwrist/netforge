import { NODE_DEFS, TUNE } from './data';
import { inputCapFor, storageCapacity } from './state';
import type { GameNode, GameState, ResourceId } from './types';

// Events emitted toward the presentation layer (floats, sounds). Engine stays pure logic.
export interface EngineEvents {
  onWallet(res: 'fragment' | 'credits', amount: number, node: GameNode): void;
  onCycleDone(node: GameNode): void;
}

const RES_TO_WALLET: ResourceId[] = ['fragment', 'credits'];

export function effTime(state: GameState, node: GameNode): number {
  const def = NODE_DEFS[node.type];
  if (!def.recipe) return 1;
  const up = def.category === 'generator'
    ? Math.pow(TUNE.speedPerLevel, state.upgrades.prodSpeed)
    : Math.pow(TUNE.speedPerLevel, state.upgrades.procSpeed);
  return def.recipe.time * Math.pow(TUNE.nodeTimePerLevel, node.level - 1) * up;
}

function outQty(state: GameState, node: GameNode, base: number): number {
  void state;
  return Math.max(1, Math.round(base * (1 + TUNE.nodeQtyPerLevel * (node.level - 1))));
}

export function updateProduction(state: GameState, dt: number, ev: EngineEvents): void {
  const capMult = 1 + TUNE.capPerLevel * state.upgrades.storageCap;
  for (const node of state.nodes) {
    const def = NODE_DEFS[node.type];
    const prevStatus = node.status;

    if (def.category === 'generator' && def.recipe) {
      const out = def.recipe.outputs[0];
      const cap = def.capacity;
      const cur = node.inv[out.resource] ?? 0;
      const time = effTime(state, node);
      if (cur >= cap - 1e-6) {
        node.status = 'full';
        node.prod = 0;
      } else {
        node.prod += dt;
        let guard = 0;
        while (node.prod >= time && guard++ < 8) {
          node.prod -= time;
          const add = outQty(state, node, out.amount);
          node.inv[out.resource] = Math.min(cap, (node.inv[out.resource] ?? 0) + add);
          if ((node.inv[out.resource] ?? 0) >= cap - 1e-6) { node.prod = 0; break; }
        }
        node.status = (node.inv[out.resource] ?? 0) >= cap - 1e-6 ? 'full' : 'online';
      }
    } else if (def.category === 'processor' && def.recipe) {
      const time = effTime(state, node);
      const hasInputs = def.recipe.inputs.every((i) => (node.inv[i.resource] ?? 0) >= i.amount - 1e-6);
      // Output space check (wallet outputs always fit)
      const hasSpace = def.recipe.outputs.every((o) => {
        if (RES_TO_WALLET.includes(o.resource)) return true;
        return (node.inv[o.resource] ?? 0) + outQty(state, node, o.amount) <= def.capacity + 1e-6;
      });
      if (!hasSpace) {
        node.status = 'full';
        node.prod = Math.min(node.prod, time);
      } else if (!hasInputs) {
        node.status = 'waiting';
        node.prod = Math.max(0, node.prod - dt * 0.5); // decay progress while starved
      } else {
        node.prod += dt;
        let guard = 0;
        while (node.prod >= time && guard++ < 8) {
          // re-check mid-burst
          const stillHas = def.recipe.inputs.every((i) => (node.inv[i.resource] ?? 0) >= i.amount - 1e-6);
          if (!stillHas) { node.prod = time * 0.999; break; }
          node.prod -= time;
          def.recipe.inputs.forEach((i) => { node.inv[i.resource] = (node.inv[i.resource] ?? 0) - i.amount; });
          def.recipe.outputs.forEach((o) => {
            const amt = outQty(state, node, o.amount);
            if (o.resource === 'fragment') {
              state.fragments += amt;
              ev.onWallet('fragment', amt, node);
            } else if (o.resource === 'credits') {
              state.wallet.credits += amt;
              ev.onWallet('credits', amt, node);
            } else {
              node.inv[o.resource] = Math.min(def.capacity, (node.inv[o.resource] ?? 0) + amt);
            }
          });
          ev.onCycleDone(node);
        }
        node.status = 'online';
      }
    } else if (def.category === 'storage') {
      const drain = Math.min(node.inv.data ?? 0, TUNE.storageDrain * dt);
      if (drain > 0) {
        node.inv.data = (node.inv.data ?? 0) - drain;
        state.wallet.data += drain;
      }
      const cap = storageCapacity(state);
      void capMult;
      node.status = (node.inv.data ?? 0) >= cap - 1e-6 ? 'full' : (node.inv.data ?? 0) > 0.5 ? 'online' : 'idle';
    } else if (def.category === 'transfer') {
      node.status = (node.inv.data ?? 0) > 0.01 ? 'online' : 'idle';
    }

    if (node.status !== prevStatus) node.statusT = 0;
    node.statusT += dt;
  }
}

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

    // throughput-limited queueing from source output inventory
    conn.acc = Math.min(2, conn.acc + dt * bwRate);
    while (conn.acc >= 1 && conn.packets.length < 10) {
      const avail = src.inv[res] ?? 0;
      const take = Math.min(pktSize, Math.floor(avail + 1e-6));
      if (take < 1) { conn.acc = Math.min(conn.acc, 0.999); break; }
      src.inv[res] = avail - take;
      conn.packets.push({ t: 0, amount: take, resource: res });
      conn.acc -= 1;
    }

    // move packets; deliver at t >= 1 (with back-pressure)
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
        if (p.amount <= 1e-6) p.t = 2; // mark for removal
        else conn.throttled = true;
      }
    }
    conn.packets = conn.packets.filter((p) => p.t < 2);
    if (conn.packets.length >= 10 && (src.inv[res] ?? 0) >= 1) conn.throttled = true;
  }
  return { delivered };
}

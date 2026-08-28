import { ACHIEVEMENTS, NODE_DEFS } from './data';
import { ownedCount } from './state';
import type { AchievementDef, GameState, ResourceId } from './types';

// Longest directed chain of connected nodes (for chain achievements).
function longestChain(state: GameState): number {
  if (state.connections.length === 0) return state.nodes.length > 0 ? 1 : 0;
  const adj = new Map<string, string[]>();
  for (const c of state.connections) {
    const a = c.fromPort.split('|')[0];
    const b = c.toPort.split('|')[0];
    const list = adj.get(a);
    if (list) list.push(b);
    else adj.set(a, [b]);
  }
  let best = 1;
  const visit = (id: string, depth: number, seen: Set<string>): void => {
    if (depth > best) best = depth;
    if (depth > 40) return;
    const next = adj.get(id);
    if (!next) return;
    for (const nx of next) {
      if (!seen.has(nx)) {
        seen.add(nx);
        visit(nx, depth + 1, seen);
        seen.delete(nx);
      }
    }
  };
  for (const n of state.nodes) {
    const seen = new Set<string>([n.id]);
    visit(n.id, 1, seen);
  }
  return best;
}

function countType(state: GameState, type: string): number {
  return ownedCount(state, type as GameState['nodes'][number]['type']);
}

function check(state: GameState, id: string, chain: number): boolean {
  const s = state.stats;
  switch (id) {
    case 'relay3': return countType(state, 'relay') >= 3;
    case 'relay8': return countType(state, 'relay') >= 8;
    case 'storage3': return countType(state, 'storage') >= 3;
    case 'conn5': return s.life.conns >= 5;
    case 'conn15': return s.life.conns >= 15;
    case 'credits50': return s.runCredits >= 50;
    case 'credits500': return s.runCredits >= 500;
    case 'frag10': return s.life.fragments >= 10;
    case 'frag50': return s.life.fragments >= 50;
    case 'chain4': return chain >= 4;
    case 'chain6': return chain >= 6;
    case 'nodes10': return state.nodes.length >= 10;
    case 'nodes25': return state.nodes.length >= 25;
    case 'tech2': return state.techs.length >= 2;
    case 'upg3': return s.life.upgrades >= 3;
    case 'time5': return s.life.time >= 300;
    case 'time20': return s.life.time >= 1200;
    case 'tier1': return state.coreTier >= 1;
    case 'prestige1': return state.prestigeCount >= 1;
    default: return false;
  }
}

export class AchievementManager {
  private acc = 0;

  update(state: GameState, dt: number, now: number, ev: {
    unlock(def: AchievementDef): void;
    resBonus(res: ResourceId, amount: number): void;
  }): void {
    this.acc += dt;
    if (this.acc < 1) return;
    this.acc = 0;

    let chain = -1;
    for (const def of ACHIEVEMENTS) {
      if (state.achievements.includes(def.id)) continue;
      if (chain < 0 && (def.id === 'chain4' || def.id === 'chain6')) chain = longestChain(state);
      if (!check(state, def.id, chain)) continue;

      state.achievements.push(def.id);
      if (def.bonus.kind === 'res') {
        if (def.bonus.res === 'credits') {
          state.wallet.credits += def.bonus.amount;
          state.stats.runCredits += def.bonus.amount;
          state.stats.life.credits += def.bonus.amount;
        } else {
          state.wallet.data += def.bonus.amount;
        }
        ev.resBonus(def.bonus.res, def.bonus.amount);
      } else {
        state.boosts[def.id] = now + def.bonus.dur;
      }
      ev.unlock(def);
    }
    void NODE_DEFS;
  }
}

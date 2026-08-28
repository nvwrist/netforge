import { ACHIEVEMENTS, NODE_DEFS } from './data';
import { ownedCount } from './state';
import type {
  AchievementCondition, AchievementDef, GameState, NodeTypeId, ResourceId,
} from './types';

// Самая длинная направленная цепочка связанных узлов (для условий chainLength).
function longestChain(state: GameState): number {
  if (state.nodes.length === 0) return 0;
  if (state.connections.length === 0) return 1;
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
    if (depth > 40) return; // предохранитель от глубокой рекурсии
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

type StatKey = 'delivered' | 'credits' | 'fragments' | 'conns' | 'nodes' | 'upgrades' | 'time' | 'placed' | 'data';

function statValue(state: GameState, stat: StatKey): number {
  const s = state.stats;
  const life = s.life;
  switch (stat) {
    case 'delivered': return s.delivered;
    case 'placed': return s.placed;
    case 'credits': return s.runCredits; // кредиты за текущий забег
    case 'data': return life.data;
    case 'fragments': return life.fragments;
    case 'conns': return life.conns;
    case 'nodes': return life.nodes;
    case 'upgrades': return life.upgrades;
    case 'time': return life.time;
    default: return 0;
  }
}

// Универсальный интерпретатор условий. Новое достижение не требует правки этого файла.
export function evaluateCondition(state: GameState, cond: AchievementCondition, chain: number): boolean {
  switch (cond.type) {
    case 'nodeCount':
      return ownedCount(state, cond.nodeType as NodeTypeId) >= cond.count;
    case 'anyNodeCount':
      return state.nodes.length >= cond.count;
    case 'connectionCount':
      return state.connections.length >= cond.count;
    case 'statThreshold':
      return statValue(state, cond.stat) >= cond.value;
    case 'chainLength':
      return chain >= cond.length;
    case 'techCount':
      return state.techs.length >= cond.count;
    case 'coreTier':
      return state.coreTier >= cond.tier;
    case 'prestigeCount':
      return state.prestigeCount >= cond.count;
    case 'nodeTypeVariety': {
      const types = new Set(state.nodes.map((n) => n.type));
      return types.size >= cond.count;
    }
    case 'modulesInstalled': {
      let total = 0;
      for (const n of state.nodes) total += n.modules.length;
      return total >= cond.count;
    }
    case 'modulesOnNode':
      return state.nodes.some((n) => n.modules.length >= cond.count);
    case 'uniqueModules': {
      const set = new Set<string>();
      for (const n of state.nodes) for (const m of n.modules) set.add(m);
      return set.size >= cond.count;
    }
    case 'blueprints':
      return state.blueprints.length >= cond.count;
    case 'moduleCategories': {
      const cats = new Set<string>();
      for (const n of state.nodes) if (n.modules.length > 0) cats.add(NODE_DEFS[n.type].category);
      return cats.size >= cond.count;
    }
    default:
      return false;
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

    let chain = -1; // считаем лениво и один раз
    for (const def of ACHIEVEMENTS) {
      if (state.achievements.includes(def.id)) continue;
      const needsChain = def.condition.type === 'chainLength';
      if (needsChain && chain < 0) chain = longestChain(state);
      if (!evaluateCondition(state, def.condition, needsChain ? chain : 0)) continue;

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
  }
}

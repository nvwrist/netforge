import { NODE_DEFS, SURGE_CFG } from './data';
import type { GameNode, GameState } from './types';

// Random "Data Surge" events — a golden-cookie style hook.
// Picks a random generator, offers an 8s click window, grants x3 for 15s.
export class SurgeManager {
  private timer = SURGE_CFG.intervalMin;

  private roll(): number {
    return SURGE_CFG.intervalMin + Math.random() * (SURGE_CFG.intervalMax - SURGE_CFG.intervalMin);
  }

  update(state: GameState, dt: number): void {
    this.timer -= dt;
    if (this.timer <= 0) {
      this.timer = this.roll();
      const candidates = state.nodes.filter(
        (n) => NODE_DEFS[n.type].category === 'generator' && n.surgeWindow <= 0 && n.surgeActive <= 0,
      );
      if (candidates.length > 0) {
        const pick = candidates[Math.floor(Math.random() * candidates.length)];
        pick.surgeWindow = SURGE_CFG.window;
      }
    }
  }

  // Returns true when the player caught the surge.
  tryActivate(node: GameNode): boolean {
    if (node.surgeWindow <= 0) return false;
    node.surgeWindow = 0;
    node.surgeActive = SURGE_CFG.active;
    node.flash = 1;
    node.flashColor = '#ffb02e';
    return true;
  }

  reset(): void {
    this.timer = this.roll();
  }
}

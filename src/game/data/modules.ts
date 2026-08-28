import type { BlueprintDef, ModuleDef, NodeTypeId } from '../types';

const D = 'data' as const;

// ── Module slot / economy config ─────────────────────────────────────────────

export const MODULE_CFG = {
  baseSlots: 2,       // basic nodes
  advancedSlots: 3,   // tech-gated nodes
  maxSlots: 5,
  refundRate: 0.5,    // remove a module → 50% of cost back
};

// ── Modules (qualitative per-node customization, always a trade-off) ─────────

export const MODULE_DEFS: ModuleDef[] = [
  {
    id: 'overclock', nameKey: 'mod.overclock', descKey: 'mod.overclock.d',
    appliesToCategory: ['generator', 'processor'],
    cost: { credits: 40 }, effect: { speedMult: 1.5, capacityMult: 0.7 }, slotCost: 1,
  },
  {
    id: 'bulkBuffer', nameKey: 'mod.bulkBuffer', descKey: 'mod.bulkBuffer.d',
    appliesToCategory: ['storage', 'transfer'],
    cost: { [D]: 300 }, effect: { capacityMult: 1.8, speedMult: 0.8 }, slotCost: 1,
  },
  {
    id: 'deepStore', nameKey: 'mod.deepStore', descKey: 'mod.deepStore.d',
    appliesToCategory: ['storage'],
    cost: { [D]: 600 }, effect: { capacityMult: 2.5, drainMult: 0.6 }, slotCost: 1,
  },
  {
    id: 'coldStorage', nameKey: 'mod.coldStorage', descKey: 'mod.coldStorage.d',
    appliesToCategory: ['storage'],
    cost: { [D]: 350 }, effect: { capacityMult: 1.6, drainMult: 0.75 }, slotCost: 1,
  },
  {
    id: 'byproduct', nameKey: 'mod.byproduct', descKey: 'mod.byproduct.d',
    appliesToCategory: ['processor'],
    cost: { credits: 120 },
    effect: { outputBonus: { resource: 'credits', amount: 1 }, inputExtra: 1 }, slotCost: 1,
  },
  {
    id: 'scrapHarvester', nameKey: 'mod.scrapHarvester', descKey: 'mod.scrapHarvester.d',
    appliesToCategory: ['processor'],
    cost: { credits: 100 },
    effect: { outputBonus: { resource: D, amount: 1 }, inputExtra: 1 }, slotCost: 1,
  },
  {
    id: 'efficiencyCore', nameKey: 'mod.efficiencyCore', descKey: 'mod.efficiencyCore.d',
    appliesToCategory: ['processor'],
    cost: { credits: 200 }, effect: { inputReduction: 1 }, slotCost: 2,
  },
  {
    id: 'redundancy', nameKey: 'mod.redundancy', descKey: 'mod.redundancy.d',
    appliesToCategory: ['processor'],
    cost: { credits: 90 }, effect: { redundancySec: 8, speedMult: 0.85 }, slotCost: 1,
  },
  {
    id: 'neuralCache', nameKey: 'mod.neuralCache', descKey: 'mod.neuralCache.d',
    appliesToCategory: ['processor'],
    cost: { credits: 180 }, effect: { speedMult: 1.6, capacityMult: 0.6 }, slotCost: 2,
  },
  {
    id: 'heatSink', nameKey: 'mod.heatSink', descKey: 'mod.heatSink.d',
    appliesToCategory: ['processor'],
    cost: { [D]: 300 }, effect: { capacityMult: 1.5, speedMult: 0.9 }, slotCost: 1,
  },
  {
    id: 'fluxCapacitor', nameKey: 'mod.fluxCapacitor', descKey: 'mod.fluxCapacitor.d',
    appliesToCategory: ['generator'],
    cost: { [D]: 250 }, effect: { speedMult: 1.3, capacityMult: 0.85 }, slotCost: 1,
  },
  {
    id: 'twinCoil', nameKey: 'mod.twinCoil', descKey: 'mod.twinCoil.d',
    appliesToCategory: ['generator'],
    cost: { credits: 150 },
    effect: { outputBonus: { resource: D, amount: 1 } }, slotCost: 2,
  },
  {
    id: 'surgeTap', nameKey: 'mod.surgeTap', descKey: 'mod.surgeTap.d',
    appliesToCategory: ['generator'],
    cost: { credits: 70 }, effect: { surgeWindowBonus: 4 }, slotCost: 1,
  },
  {
    id: 'packetRouter', nameKey: 'mod.packetRouter', descKey: 'mod.packetRouter.d',
    appliesToCategory: ['transfer'],
    cost: { [D]: 400 }, effect: { capacityMult: 2.0 }, slotCost: 1,
  },
  {
    id: 'qosBalancer', nameKey: 'mod.qosBalancer', descKey: 'mod.qosBalancer.d',
    appliesToCategory: ['transfer'],
    cost: { credits: 30 }, effect: { capacityMult: 1.4 }, slotCost: 1,
  },
  {
    id: 'harmonicFilter', nameKey: 'mod.harmonicFilter', descKey: 'mod.harmonicFilter.d',
    appliesToCategory: ['processor'],
    cost: { credits: 110 },
    effect: { outputBonus: { resource: 'filtered', amount: 1 }, inputExtra: 1 }, slotCost: 1,
  },
];

// ── Procedural blueprints ────────────────────────────────────────────────────

export const BLUEPRINT_CFG = {
  everyTier: 3,                       // a blueprint drops every N research tiers
  inputJitter: [0.6, 1.4] as [number, number],
  outputJitter: [0.8, 1.6] as [number, number],
  timeJitter: [0.7, 1.2] as [number, number],
  capacityJitter: [0.8, 1.5] as [number, number],
};

export const BLUEPRINT_BASES: NodeTypeId[] = [
  'relay', 'compute', 'proxy', 'processor', 'firewall', 'archive', 'encryption',
];

export const BLUEPRINT_NAMES = [
  'Pulse', 'Quantum', 'Vector', 'Neuron', 'Photon', 'Resonance',
  'Helios', 'Vertex', 'Onyx', 'Zenith', 'Delta', 'Orbit', 'Mirage', 'Cobalt',
];

export const BLUEPRINT_COLORS = [
  '#4fe3c1', '#ffb02e', '#c792ff', '#8fb7ff', '#ff8a5c', '#45e08c', '#ffd24a',
];

function rand(a: number, b: number): number {
  return a + Math.random() * (b - a);
}

// Generates a balanced-random variant of an existing node type.
// Efficiency (output/time per input) drifts at most ~±25% so nothing breaks the curve.
export function rollBlueprint(id: string, seq: number): BlueprintDef {
  const baseType = BLUEPRINT_BASES[Math.floor(Math.random() * BLUEPRINT_BASES.length)];
  const name = BLUEPRINT_NAMES[Math.floor(Math.random() * BLUEPRINT_NAMES.length)] + '-' + seq;
  const color = BLUEPRINT_COLORS[Math.floor(Math.random() * BLUEPRINT_COLORS.length)];
  const [i0, i1] = BLUEPRINT_CFG.inputJitter;
  const [o0, o1] = BLUEPRINT_CFG.outputJitter;
  const [t0, t1] = BLUEPRINT_CFG.timeJitter;
  const [c0, c1] = BLUEPRINT_CFG.capacityJitter;
  const inputMult = rand(i0, i1);
  const outputMult = rand(o0, o1);
  const timeMult = rand(t0, t1);
  const efficiency = outputMult / (inputMult * timeMult);
  return {
    id, baseType, name, color,
    inputMult, outputMult, timeMult,
    capacityMult: rand(c0, c1),
    // price follows efficiency: better rolls cost noticeably more
    costMult: Math.max(0.8, Math.min(3, 0.9 + efficiency)),
  };
}

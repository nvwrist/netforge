// ── NetForge core types ──────────────────────────────────────────────────────

export type ResourceId =
  | 'data' | 'compute' | 'processed' | 'filtered' | 'encrypted' | 'fragment' | 'credits' | 'signal';

export type NodeTypeId =
  | 'relay' | 'storage' | 'cache' | 'compute' | 'router' | 'balancer' | 'proxy'
  | 'processor' | 'archive' | 'firewall' | 'encryption' | 'refinery' | 'datacenter' | 'hub' | 'core'
  | 'sensor' | 'computebank' | 'signalbuffer' | 'smartrouter' | 'analyzer' | 'compressor' | 'assembler' | 'forge';

export type TechId = 'routing' | 'processing' | 'security' | 'encryptionTech' | 'distributed' | 'telemetry';
export type UpgradeId = 'bandwidth' | 'storageCap' | 'prodSpeed' | 'procSpeed' | 'packetSize';
export type Lang = 'ru' | 'en';
export type NodeCategory = 'generator' | 'storage' | 'transfer' | 'processor';
export type PortDir = 'in' | 'out';
export type NodeStatus = 'online' | 'idle' | 'waiting' | 'full';
export type TechPath = 'A' | 'B';

export interface RecipeIo { resource: ResourceId; amount: number }
export interface NodeRecipe { inputs: RecipeIo[]; outputs: RecipeIo[]; time: number }

export interface NodeDef {
  id: NodeTypeId;
  nameKey: string;
  descKey: string;
  category: NodeCategory;
  cost: Partial<Record<ResourceId, number>>;
  costGrowth: number;
  inputs: ResourceId[];
  outputs: ResourceId[];
  recipe?: NodeRecipe;
  capacity: number;
  tech?: TechId;
  requireCore?: boolean;
}

export interface TechDef {
  id: TechId;
  nameKey: string;
  descKey: string;
  cost: Partial<Record<ResourceId, number>>;
  unlocks: NodeTypeId[];
  requires?: TechId;
  path?: TechPath;
}

export interface UpgradeDef {
  id: UpgradeId;
  nameKey: string;
  descKey: string;
  max: number; // Infinity = endless
  cost: (level: number) => Partial<Record<ResourceId, number>>;
}

export interface AchievementBonusRes { kind: 'res'; res: ResourceId; amount: number }
export interface AchievementBonusBoost { kind: 'boost'; target: 'gen' | 'proc' | 'all'; mult: number; dur: number }

// Декларативные условия достижений: новое достижение добавляется ТОЛЬКО в data.ts.
export type AchievementCondition =
  | { type: 'nodeCount'; nodeType: NodeTypeId; count: number }
  | { type: 'anyNodeCount'; count: number }
  | { type: 'connectionCount'; count: number }
  | { type: 'statThreshold'; stat: 'delivered' | 'credits' | 'fragments' | 'conns' | 'nodes' | 'upgrades' | 'time' | 'placed' | 'data'; value: number }
  | { type: 'chainLength'; length: number }
  | { type: 'techCount'; count: number }
  | { type: 'coreTier'; tier: number }
  | { type: 'prestigeCount'; count: number }
  | { type: 'nodeTypeVariety'; count: number }
  | { type: 'modulesInstalled'; count: number }
  | { type: 'modulesOnNode'; count: number }
  | { type: 'uniqueModules'; count: number }
  | { type: 'blueprints'; count: number }
  | { type: 'moduleCategories'; count: number };

export interface AchievementDef {
  id: string;
  nameKey: string;
  descKey: string;
  condition: AchievementCondition;
  bonus: AchievementBonusRes | AchievementBonusBoost;
}

// ── Modules (per-node qualitative customization) ─────────────────────────────

export interface ModuleEffect {
  speedMult?: number;          // e.g. 1.5 — 50% faster cycles
  capacityMult?: number;       // e.g. 0.7 — trade-off: smaller buffers
  outputBonus?: { resource: ResourceId; amount: number }; // byproduct per cycle
  inputReduction?: number;     // −N from the first recipe input (min 1)
  inputExtra?: number;         // +N to the first recipe input (byproduct cost)
  drainMult?: number;          // storage → reserve conversion multiplier
  redundancySec?: number;      // keep producing while starved (internal buffer)
  surgeWindowBonus?: number;   // extra seconds to catch a data surge
}

export interface ModuleDef {
  id: string;
  nameKey: string;
  descKey: string;
  appliesToCategory: NodeCategory[];
  cost: Partial<Record<ResourceId, number>>;
  effect: ModuleEffect;
  slotCost: number;
}

// ── Procedural blueprints (endless research rewards) ─────────────────────────

export interface BlueprintDef {
  id: string;
  baseType: NodeTypeId;
  name: string;        // procedurally generated display name
  color: string;       // accent color
  inputMult: number;   // recipe input amounts multiplier
  outputMult: number;  // recipe output amounts multiplier
  timeMult: number;    // recipe time multiplier
  capacityMult: number;
  costMult: number;
}

export interface Port {
  id: string;
  nodeId: string;
  dir: PortDir;
  resource: ResourceId;
  connectionId: string | null;
}

export interface GameNode {
  id: string;
  type: NodeTypeId;
  x: number;
  y: number;
  level: number;
  inv: Partial<Record<ResourceId, number>>;
  prod: number;
  status: NodeStatus;
  statusT: number;
  ports: Port[];
  flash: number;
  flashColor: string;
  surgeWindow: number;  // s left to click
  surgeActive: number;  // s of x3 left
  modules: string[];        // installed ModuleDef ids
  blueprintId: string | null;
  redundancyT: number;      // s of redundancy buffer left
}

export interface Packet { t: number; amount: number; resource: ResourceId }

export interface Connection {
  id: string;
  fromPort: string;
  toPort: string;
  packets: Packet[];
  acc: number;
  throttled: boolean;
}

export type Wallet = { [K in 'data' | 'credits']: number };
export type OfflineGain = { [K in 'data' | 'credits']: number } & { hours: number };

export interface LifeStats {
  data: number; credits: number; fragments: number;
  conns: number; nodes: number; upgrades: number; time: number;
}

export interface GameState {
  wallet: Wallet;
  fragments: number;       // legacy total counter (kept for saves compat)
  coreTier: number;        // completed tiers
  coreFragments: number;   // progress inside current tier
  legacy: number;          // permanent legacy points
  prestigeCount: number;
  researchTier: number;    // endless research level
  achievements: string[];
  boosts: Record<string, number>; // achievementId → expires at playtime seconds
  unlockedModules: string[];      // ModuleDef ids unlocked via research
  moduleChoice: string[] | null;  // pending roguelite pick of 2 modules
  blueprints: BlueprintDef[];     // procedurally generated node variants
  nodes: GameNode[];
  connections: Connection[];
  techs: TechId[];
  upgrades: Record<UpgradeId, number>;
  tutorialStep: number;
  camX: number; camY: number; camZoom: number;
  lang: Lang;
  muted: boolean;
  seq: number;
  storageTipShown: boolean;
  stats: { delivered: number; placed: number; runCredits: number; life: LifeStats };
}

// ── UI snapshot ──────────────────────────────────────────────────────────────

export interface CostEntry { res: ResourceId; amount: number }

export interface ShopItem {
  id: NodeTypeId; nameKey: string; descKey: string;
  cost: CostEntry[]; afford: boolean; unlocked: boolean; owned: number;
  requireCore: boolean;
}
export interface TechItem {
  id: TechId; nameKey: string; descKey: string;
  cost: CostEntry[]; afford: boolean; unlocked: boolean; available: boolean;
  late: boolean; path: TechPath | null; requiresKey: string | null;
  unlocksKeys: string[];
}
export interface UpgradeItem {
  id: UpgradeId; nameKey: string; descKey: string;
  level: number; max: number; cost: CostEntry[]; afford: boolean;
}
export interface AchievementItem {
  id: string; nameKey: string; descKey: string; done: boolean;
  bonusText: string;
}
export interface ScoreEntry { name: string; power: number; tier: number; ts: number }

export interface BlueprintShopItem {
  id: string; name: string; color: string;
  baseType: NodeTypeId; baseNameKey: string;
  cost: CostEntry[]; afford: boolean;
  recipe: { inputs: RecipeIo[]; outputs: RecipeIo[]; time: number };
}

export interface InstalledModuleInfo { id: string; nameKey: string; descKey: string; slotCost: number }
export interface AvailableModuleInfo { id: string; nameKey: string; descKey: string; slotCost: number; cost: CostEntry[]; afford: boolean }
export interface NodeModulesInfo {
  slots: number; used: number;
  installed: InstalledModuleInfo[];
  available: AvailableModuleInfo[];
}

export interface SelectedInfo {
  id: string; type: NodeTypeId; nameKey: string; level: number;
  statusKey: string;
  bars: { res: ResourceId; cur: number; cap: number }[];
  recipe: { inputs: RecipeIo[]; outputs: RecipeIo[]; time: number } | null;
  rateLine: { qty: number; time: number } | null;
  upgradeCost: CostEntry; canUpgrade: boolean; maxed: boolean;
  surge: number;
  modules: NodeModulesInfo | null;
  blueprintName: string | null;
}

export interface Toast { id: number; kind: 'ok' | 'err' | 'info' | 'ach'; textKey: string; vars?: Record<string, string>; until: number }

export interface UISnapshot {
  v: number;
  lang: Lang; muted: boolean;
  started: boolean;
  gridOn: boolean;
  codexOpen: boolean;
  walletData: number; credits: number; fragments: number;
  dataRate: number; creditsRate: number;
  coreOnline: boolean; showCoreModal: boolean;
  coreTier: number; coreGoal: number; coreFragments: number;
  legacy: number; prestigeCount: number;
  prestigeGain: number; prestigeReady: boolean;
  prestigeOpen: boolean; leaderboardOpen: boolean;
  leaderboard: ScoreEntry[]; power: number;
  researchTier: number; researchCost: CostEntry[]; researchAfford: boolean;
  moduleChoice: string[] | null;
  unlockedModuleCount: number; totalModuleCount: number;
  blueprintShop: BlueprintShopItem[];
  nodeCount: number; connCount: number; flowRate: number;
  selected: SelectedInfo | null;
  placement: NodeTypeId | null;
  shop: ShopItem[]; techs: TechItem[]; upgrades: UpgradeItem[];
  achievements: AchievementItem[]; achDone: number; achTotal: number;
  tutorial: { index: number; total: number; textKey: string } | null;
  offline: OfflineGain | null;
  toasts: Toast[];
  saveTick: number;
  shopOpen: boolean;
  helpOpen: boolean;
}

// ── render-only transient objects ────────────────────────────────────────────

export interface FloatText { x: number; y: number; text: string; color: string; life: number }
export interface Particle {
  x: number; y: number; vx: number; vy: number;
  life: number; max: number; color: string; size: number;
}
export interface Flyer { wx: number; wy: number; res: 'data' | 'credits' | 'fragment'; t: number }

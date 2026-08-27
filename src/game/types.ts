// ── NetForge core types ──────────────────────────────────────────────────────

export type ResourceId =
  | 'data' | 'compute' | 'processed' | 'filtered' | 'encrypted' | 'fragment' | 'credits';

export type NodeTypeId =
  | 'relay' | 'storage' | 'cache' | 'compute' | 'router' | 'balancer' | 'proxy'
  | 'processor' | 'archive' | 'firewall' | 'encryption' | 'refinery' | 'datacenter' | 'hub' | 'core';

export type TechId = 'routing' | 'processing' | 'security' | 'encryptionTech' | 'distributed';
export type UpgradeId = 'bandwidth' | 'storageCap' | 'prodSpeed' | 'procSpeed' | 'packetSize';
export type Lang = 'ru' | 'en';
export type NodeCategory = 'generator' | 'storage' | 'transfer' | 'processor';
export type PortDir = 'in' | 'out';
export type NodeStatus = 'online' | 'idle' | 'waiting' | 'full';

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
  requireCore?: boolean; // unlocked when the Network Core goal is achieved
}

export interface TechDef {
  id: TechId;
  nameKey: string;
  descKey: string;
  cost: Partial<Record<ResourceId, number>>;
  unlocks: NodeTypeId[];
}

export interface UpgradeDef {
  id: UpgradeId;
  nameKey: string;
  descKey: string;
  max: number;
  cost: (level: number) => Partial<Record<ResourceId, number>>;
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

export interface Wallet { data: number; credits: number }

export interface GameState {
  wallet: Wallet;
  fragments: number;
  coreOnline: boolean;
  nodes: GameNode[];
  connections: Connection[];
  techs: TechId[];
  upgrades: Record<UpgradeId, number>;
  tutorialStep: number; // -1 = finished / skipped
  camX: number; camY: number; camZoom: number;
  lang: Lang;
  muted: boolean;
  seq: number;
  stats: { delivered: number; placed: number };
}

// ── UI snapshot ──────────────────────────────────────────────────────────────

export interface CostEntry { res: ResourceId; amount: number }

export interface ShopItem {
  id: NodeTypeId; nameKey: string; descKey: string;
  cost: CostEntry[]; afford: boolean; unlocked: boolean; owned: number;
}
export interface TechItem {
  id: TechId; nameKey: string; descKey: string;
  cost: CostEntry[]; afford: boolean; unlocked: boolean;
  unlocksKeys: string[];
}
export interface UpgradeItem {
  id: UpgradeId; nameKey: string; descKey: string;
  level: number; max: number; cost: CostEntry[]; afford: boolean;
}

export interface SelectedInfo {
  id: string; type: NodeTypeId; nameKey: string; level: number;
  statusKey: string;
  bars: { res: ResourceId; cur: number; cap: number }[];
  recipe: { inputs: RecipeIo[]; outputs: RecipeIo[]; time: number } | null;
  rateLine: { qty: number; time: number } | null; // generator: qty per time
  upgradeCost: CostEntry; canUpgrade: boolean; maxed: boolean;
}

export interface Toast { id: number; kind: 'ok' | 'err' | 'info'; textKey: string; until: number }

export interface UISnapshot {
  v: number;
  lang: Lang; muted: boolean;
  started: boolean;
  gridOn: boolean;
  codexOpen: boolean;
  data: number; credits: number; fragments: number;
  coreOnline: boolean; showCoreModal: boolean;
  nodeCount: number; connCount: number; flowRate: number;
  selected: SelectedInfo | null;
  placement: NodeTypeId | null;
  shop: ShopItem[]; techs: TechItem[]; upgrades: UpgradeItem[];
  tutorial: { index: number; total: number; textKey: string } | null;
  offline: { data: number; credits: number; hours: number } | null;
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

import type {
  Lang, NodeDef, NodeTypeId, ResourceId, TechDef, TechId, UpgradeDef, UpgradeId,
} from './types';

// ── Resources ────────────────────────────────────────────────────────────────

export const RES_META: Record<ResourceId, { color: string; nameKey: string }> = {
  data:      { color: '#3fc1ff', nameKey: 'res.data' },
  compute:   { color: '#ffb02e', nameKey: 'res.compute' },
  processed: { color: '#4fe3c1', nameKey: 'res.processed' },
  filtered:  { color: '#8fb7ff', nameKey: 'res.filtered' },
  encrypted: { color: '#c792ff', nameKey: 'res.encrypted' },
  fragment:  { color: '#45e08c', nameKey: 'res.fragment' },
  credits:   { color: '#ffd24a', nameKey: 'res.credits' },
};

// ── Tuning constants ─────────────────────────────────────────────────────────

export const TUNE = {
  travelTime: 1.15,        // seconds a packet travels a connection
  baseRate: 2.0,           // connection items/sec at bandwidth level 0
  bwMultPerLevel: 1.5,
  storageDrain: 4,         // storage → wallet units/sec
  capPerLevel: 0.5,        // +50% storage capacity per level
  speedPerLevel: 0.88,     // generator / processor speed multiplier per level
  nodeTimePerLevel: 0.85,
  nodeQtyPerLevel: 0.25,
  nodeMaxLevel: 5,
  offlineCapHours: 8,
  offlineEfficiency: 0.5,
  autosaveSec: 5,
};

// ── Node definitions (data-driven) ───────────────────────────────────────────

export const NODE_DEFS: Record<NodeTypeId, NodeDef> = {
  relay: {
    id: 'relay', nameKey: 'nd.relay', descKey: 'nd.relay.d',
    category: 'generator', cost: { data: 20 }, costGrowth: 1.12,
    inputs: [], outputs: ['data'],
    recipe: { inputs: [], outputs: [{ resource: 'data', amount: 1 }], time: 1.8 },
    capacity: 20,
  },
  storage: {
    id: 'storage', nameKey: 'nd.storage', descKey: 'nd.storage.d',
    category: 'storage', cost: { data: 50 }, costGrowth: 1.15,
    inputs: ['data'], outputs: [],
    capacity: 120,
  },
  compute: {
    id: 'compute', nameKey: 'nd.compute', descKey: 'nd.compute.d',
    category: 'generator', cost: { data: 100 }, costGrowth: 1.15,
    inputs: [], outputs: ['compute'],
    recipe: { inputs: [], outputs: [{ resource: 'compute', amount: 1 }], time: 3 },
    capacity: 15,
  },
  router: {
    id: 'router', nameKey: 'nd.router', descKey: 'nd.router.d',
    category: 'transfer', cost: { data: 100 }, costGrowth: 1.18,
    inputs: ['data', 'data'], outputs: ['data', 'data'],
    capacity: 12,
  },
  proxy: {
    id: 'proxy', nameKey: 'nd.proxy', descKey: 'nd.proxy.d',
    category: 'processor', cost: { data: 250 }, costGrowth: 1.2,
    inputs: ['data'], outputs: ['processed'],
    recipe: { inputs: [{ resource: 'data', amount: 2 }], outputs: [{ resource: 'processed', amount: 1 }], time: 2.5 },
    capacity: 10, tech: 'routing',
  },
  processor: {
    id: 'processor', nameKey: 'nd.processor', descKey: 'nd.processor.d',
    category: 'processor', cost: { data: 350 }, costGrowth: 1.2,
    inputs: ['data', 'compute'], outputs: [],
    recipe: {
      inputs: [{ resource: 'data', amount: 2 }, { resource: 'compute', amount: 1 }],
      outputs: [{ resource: 'fragment', amount: 1 }], time: 4,
    },
    capacity: 10, tech: 'processing',
  },
  firewall: {
    id: 'firewall', nameKey: 'nd.firewall', descKey: 'nd.firewall.d',
    category: 'processor', cost: { data: 600 }, costGrowth: 1.2,
    inputs: ['data'], outputs: ['filtered'],
    recipe: { inputs: [{ resource: 'data', amount: 3 }], outputs: [{ resource: 'filtered', amount: 2 }], time: 3 },
    capacity: 10, tech: 'security',
  },
  encryption: {
    id: 'encryption', nameKey: 'nd.encryption', descKey: 'nd.encryption.d',
    category: 'processor', cost: { data: 800 }, costGrowth: 1.25,
    inputs: ['filtered', 'compute'], outputs: ['encrypted'],
    recipe: {
      inputs: [{ resource: 'filtered', amount: 2 }, { resource: 'compute', amount: 1 }],
      outputs: [{ resource: 'encrypted', amount: 1 }], time: 4,
    },
    capacity: 8, tech: 'encryptionTech',
  },
  datacenter: {
    id: 'datacenter', nameKey: 'nd.datacenter', descKey: 'nd.datacenter.d',
    category: 'processor', cost: { data: 1500 }, costGrowth: 1.3,
    inputs: ['processed', 'encrypted', 'compute'], outputs: [],
    recipe: {
      inputs: [
        { resource: 'processed', amount: 1 }, { resource: 'encrypted', amount: 1 },
        { resource: 'compute', amount: 2 },
      ],
      outputs: [{ resource: 'credits', amount: 5 }], time: 6,
    },
    capacity: 8, tech: 'distributed',
  },
  hub: {
    id: 'hub', nameKey: 'nd.hub', descKey: 'nd.hub.d',
    category: 'transfer', cost: { credits: 80 }, costGrowth: 1.3,
    inputs: ['data', 'data', 'data', 'data'],
    outputs: ['data', 'data', 'data', 'data'],
    capacity: 24, tech: 'distributed',
  },
};

export const SHOP_ORDER: NodeTypeId[] = [
  'relay', 'storage', 'compute', 'router', 'proxy',
  'processor', 'firewall', 'encryption', 'datacenter', 'hub',
];

// ── Technologies ─────────────────────────────────────────────────────────────

export const TECH_DEFS: TechDef[] = [
  { id: 'routing',        nameKey: 'tc.routing',        descKey: 'tc.routing.d',        cost: { data: 150 },  unlocks: ['proxy'] },
  { id: 'processing',     nameKey: 'tc.processing',     descKey: 'tc.processing.d',     cost: { data: 300 },  unlocks: ['processor'] },
  { id: 'security',       nameKey: 'tc.security',       descKey: 'tc.security.d',       cost: { data: 500 },  unlocks: ['firewall'] },
  { id: 'encryptionTech', nameKey: 'tc.encryptionTech', descKey: 'tc.encryptionTech.d', cost: { data: 800 },  unlocks: ['encryption'] },
  { id: 'distributed',    nameKey: 'tc.distributed',    descKey: 'tc.distributed.d',    cost: { data: 1200 }, unlocks: ['datacenter', 'hub'] },
];

// ── Global upgrades ──────────────────────────────────────────────────────────

export const UPGRADE_DEFS: UpgradeDef[] = [
  {
    id: 'bandwidth', nameKey: 'up.bandwidth', descKey: 'up.bandwidth.d', max: 6,
    cost: (l) => l < 3 ? { data: Math.round(150 * Math.pow(2.2, l)) } : { credits: Math.round(15 * Math.pow(2, l - 3)) },
  },
  {
    id: 'storageCap', nameKey: 'up.storageCap', descKey: 'up.storageCap.d', max: 5,
    cost: (l) => ({ data: Math.round(200 * Math.pow(2.3, l)) }),
  },
  {
    id: 'prodSpeed', nameKey: 'up.prodSpeed', descKey: 'up.prodSpeed.d', max: 5,
    cost: (l) => ({ data: Math.round(250 * Math.pow(2.4, l)) }),
  },
  {
    id: 'procSpeed', nameKey: 'up.procSpeed', descKey: 'up.procSpeed.d', max: 5,
    cost: (l) => ({ data: Math.round(250 * Math.pow(2.4, l)) }),
  },
  {
    id: 'packetSize', nameKey: 'up.packetSize', descKey: 'up.packetSize.d', max: 3,
    cost: (l) => ({ credits: Math.round(15 * Math.pow(2, l)) }),
  },
];

// ── Tutorial ─────────────────────────────────────────────────────────────────

export const TUTORIAL_STEPS: { textKey: string }[] = [
  { textKey: 'tut.1' },
  { textKey: 'tut.2' },
  { textKey: 'tut.3' },
  { textKey: 'tut.4' },
  { textKey: 'tut.5' },
];

export const GOAL_FRAGMENTS = 100;

// ── Localization ─────────────────────────────────────────────────────────────

const RU: Record<string, string> = {
  'hud.net': 'СЕТЬ', 'hud.online': 'В СЕТИ', 'hud.nodes': 'УЗЛЫ', 'hud.links': 'СВЯЗИ',
  'hud.flow': 'ПОТОК', 'hud.pcs': '/с',
  'goal.title': 'ЯДРО СЕТИ', 'goal.done': 'ЯДРО ОНЛАЙН',
  'shop.tabNodes': 'УЗЛЫ', 'shop.tabTech': 'ТЕХНОЛОГИИ', 'shop.tabUpg': 'УЛУЧШЕНИЯ',
  'shop.locked': 'НУЖНА ТЕХНОЛОГИЯ',
  'shop.title': 'СЕТЕВЫЕ УЗЛЫ',
  'info.upgrade': 'УЛУЧШИТЬ', 'info.delete': 'УДАЛИТЬ', 'info.lvl': 'УР.', 'info.max': 'МАКС',
  'info.recipe': 'Цикл', 'info.rate': 'Скорость',
  'st.online': 'АКТИВЕН', 'st.idle': 'ПРОСТОЙ', 'st.waiting': 'НЕТ ВХОДА', 'st.full': 'ПОЛНЫЙ',
  'tut.skip': 'Пропустить', 'tut.step': 'ШАГ',
  'tut.1': 'Это стартовая сеть: реле передаёт ДАННЫЕ в хранилище. Пакеты уже в пути.',
  'tut.2': 'Откройте магазин и купите ещё один РЕЛЕЙНЫЙ СЕРВЕР.',
  'tut.3': 'Перетащите связь с выхода DATA нового реле на вход хранилища.',
  'tut.4': 'Купите МАРШРУТИЗАТОР — он ветвит поток данных.',
  'tut.5': 'Сервер вычислений + Процессор данных = ФРАГМЕНТЫ. Соберите 100 для Ядра.',
  'off.title': 'СВЯЗЬ ВОССТАНОВЛЕНА',
  'off.body': 'Пока вас не было, сеть продолжала работать:',
  'off.time': 'Оффлайн', 'off.h': 'ч',
  'off.collect': 'ЗАБРАТЬ',
  'core.title': 'ЯДРО СЕТИ ОНЛАЙН',
  'core.body': '100 фрагментов данных собраны. Ядро запущено — сеть выходит на новый уровень. Строительство продолжается.',
  'core.go': 'ПРОДОЛЖИТЬ',
  'help.title': 'РУКОВОДСТВО ОПЕРАТОРА',
  'help.d1': 'ЛКМ — выбрать узел, тянуть — переместить',
  'help.d2': 'Тянуть с порта OUT на порт IN — создать связь',
  'help.d3': 'ПКМ — удалить узел или связь, отменить размещение',
  'help.d4': 'Колесо — масштаб · WASD / средняя кнопка — камера',
  'help.m1': 'Палец по узлу — перенос · с порта — связь',
  'help.m2': 'Палец по фону — камера · щипок — масштаб',
  'help.rule': 'ОДИН ПОРТ = ОДНА СВЯЗЬ · ТОЛЬКО ВЫХОД → ВХОД',
  'help.close': 'ЗАКРЫТЬ',
  'menu.help': '?', 'menu.reset': 'СБРОС СЕТИ', 'menu.confirm': 'ТОЧНО СБРОСИТЬ?',
  'msg.place': 'Кликните по карте — разместить · ПКМ / Esc — отмена',
  'toast.notEnough': 'Недостаточно ресурсов',
  'toast.conn': 'Связь установлена',
  'toast.errPort': 'Порт занят',
  'toast.errCompat': 'Несовместимые ресурсы',
  'toast.errSelf': 'Нельзя соединить узел с собой',
  'toast.errDir': 'Связь: только ВЫХОД → ВХОД',
  'toast.tech': 'Технология открыта',
  'toast.saved': 'Сохранено',
  'toast.tutDone': 'Обучение завершено',
  'toast.nodeUpg': 'Узел улучшен',
  'toast.upg': 'Улучшение куплено',
  'toast.reset': 'Сеть сброшена',
  'toast.core': 'ЯДРО СЕТИ ОНЛАЙН',
  'res.data': 'ДАННЫЕ', 'res.compute': 'ВЫЧИСЛЕНИЯ', 'res.processed': 'ОБРАБОТАННЫЕ',
  'res.filtered': 'ОТФИЛЬТРОВАННЫЕ', 'res.encrypted': 'ЗАШИФРОВАННЫЕ',
  'res.fragment': 'ФРАГМЕНТЫ', 'res.credits': 'КРЕДИТЫ',
  'nd.relay': 'РЕЛЕЙНЫЙ СЕРВЕР', 'nd.relay.d': 'Генерирует ДАННЫЕ. Основа любой сети.',
  'nd.storage': 'ХРАНИЛИЩЕ ДАННЫХ', 'nd.storage.d': 'Принимает ДАННЫЕ и пополняет ваш резерв.',
  'nd.compute': 'СЕРВЕР ВЫЧИСЛЕНИЙ', 'nd.compute.d': 'Генерирует ВЫЧИСЛЕНИЯ для процессоров.',
  'nd.router': 'МАРШРУТИЗАТОР', 'nd.router.d': 'Раздаёт ДАННЫЕ по нескольким направлениям.',
  'nd.proxy': 'ПРОКСИ-СЕРВЕР', 'nd.proxy.d': 'Преобразует ДАННЫЕ в ОБРАБОТАННЫЕ ДАННЫЕ.',
  'nd.processor': 'ПРОЦЕССОР ДАННЫХ', 'nd.processor.d': 'Собирает ФРАГМЕНТЫ из ДАННЫХ и ВЫЧИСЛЕНИЙ.',
  'nd.firewall': 'ФАЙРВОЛ', 'nd.firewall.d': 'Фильтрует ДАННЫЕ в ОТФИЛЬТРОВАННЫЕ ДАННЫЕ.',
  'nd.encryption': 'ЯДРО ШИФРОВАНИЯ', 'nd.encryption.d': 'Создаёт ЗАШИФРОВАННЫЕ ДАННЫЕ.',
  'nd.datacenter': 'ДАТА-ЦЕНТР', 'nd.datacenter.d': 'Монетизирует поток: производит СЕТЕВЫЕ КРЕДИТЫ.',
  'nd.hub': 'СЕТЕВОЙ ХАБ', 'nd.hub.d': 'Многопортовый узел для крупных магистралей.',
  'tc.routing': 'РАСШИР. МАРШРУТИЗАЦИЯ', 'tc.routing.d': 'Открывает Прокси-сервер.',
  'tc.processing': 'ОБРАБОТКА ДАННЫХ', 'tc.processing.d': 'Открывает Процессор данных.',
  'tc.security': 'УРОВЕНЬ БЕЗОПАСНОСТИ', 'tc.security.d': 'Открывает Файрвол.',
  'tc.encryptionTech': 'ШИФРОВАНИЕ', 'tc.encryptionTech.d': 'Открывает Ядро шифрования.',
  'tc.distributed': 'РАСПРЕД. ВЫЧИСЛЕНИЯ', 'tc.distributed.d': 'Открывает Дата-центр и Сетевой хаб.',
  'up.bandwidth': 'ПРОПУСКНАЯ СПОСОБНОСТЬ', 'up.bandwidth.d': '+50% к пропускной способности всех связей.',
  'up.storageCap': 'ОБЪЁМ ХРАНИЛИЩ', 'up.storageCap.d': '+50% к вместимости хранилищ данных.',
  'up.prodSpeed': 'СКОРОСТЬ ГЕНЕРАЦИИ', 'up.prodSpeed.d': 'Генераторы работают на 12% быстрее.',
  'up.procSpeed': 'СКОРОСТЬ ОБРАБОТКИ', 'up.procSpeed.d': 'Процессоры работают на 12% быстрее.',
  'up.packetSize': 'РАЗМЕР ПАКЕТА', 'up.packetSize.d': 'Каждый пакет несёт +1 единицу ресурса.',
};

const EN: Record<string, string> = {
  'hud.net': 'NETWORK', 'hud.online': 'ONLINE', 'hud.nodes': 'NODES', 'hud.links': 'LINKS',
  'hud.flow': 'FLOW', 'hud.pcs': '/s',
  'goal.title': 'NETWORK CORE', 'goal.done': 'CORE ONLINE',
  'shop.tabNodes': 'NODES', 'shop.tabTech': 'TECH', 'shop.tabUpg': 'UPGRADES',
  'shop.locked': 'REQUIRES TECH',
  'shop.title': 'NETWORK NODES',
  'info.upgrade': 'UPGRADE', 'info.delete': 'DELETE', 'info.lvl': 'LV.', 'info.max': 'MAX',
  'info.recipe': 'Cycle', 'info.rate': 'Rate',
  'st.online': 'ONLINE', 'st.idle': 'IDLE', 'st.waiting': 'NO INPUT', 'st.full': 'FULL',
  'tut.skip': 'Skip', 'tut.step': 'STEP',
  'tut.1': 'This is your starter network: the relay feeds DATA into storage. Packets are already flowing.',
  'tut.2': 'Open the shop and buy another RELAY SERVER.',
  'tut.3': 'Drag a link from the new relay DATA OUT port to the storage input.',
  'tut.4': 'Buy a ROUTER — it branches your data flow.',
  'tut.5': 'Compute Server + Data Processor = FRAGMENTS. Collect 100 to build the Core.',
  'off.title': 'CONNECTION RESTORED',
  'off.body': 'While you were away, the network kept running:',
  'off.time': 'Offline', 'off.h': 'h',
  'off.collect': 'COLLECT',
  'core.title': 'NETWORK CORE ONLINE',
  'core.body': '100 data fragments assembled. The core is live — your network reaches a new tier. Keep building.',
  'core.go': 'CONTINUE',
  'help.title': "OPERATOR'S GUIDE",
  'help.d1': 'LMB — select node, drag to move',
  'help.d2': 'Drag from an OUT port to an IN port — create a link',
  'help.d3': 'RMB — delete node or link, cancel placement',
  'help.d4': 'Wheel — zoom · WASD / middle button — camera',
  'help.m1': 'Finger on node — move · from a port — link',
  'help.m2': 'Finger on background — camera · pinch — zoom',
  'help.rule': 'ONE PORT = ONE LINK · OUTPUT → INPUT ONLY',
  'help.close': 'CLOSE',
  'menu.help': '?', 'menu.reset': 'RESET NETWORK', 'menu.confirm': 'SURE? RESET?',
  'msg.place': 'Click the map to place · RMB / Esc — cancel',
  'toast.notEnough': 'Not enough resources',
  'toast.conn': 'Link established',
  'toast.errPort': 'Port is busy',
  'toast.errCompat': 'Incompatible resources',
  'toast.errSelf': 'Cannot link a node to itself',
  'toast.errDir': 'Links go OUTPUT → INPUT only',
  'toast.tech': 'Technology unlocked',
  'toast.saved': 'Saved',
  'toast.tutDone': 'Tutorial complete',
  'toast.nodeUpg': 'Node upgraded',
  'toast.upg': 'Upgrade purchased',
  'toast.reset': 'Network reset',
  'toast.core': 'NETWORK CORE ONLINE',
  'res.data': 'DATA', 'res.compute': 'COMPUTE', 'res.processed': 'PROCESSED',
  'res.filtered': 'FILTERED', 'res.encrypted': 'ENCRYPTED',
  'res.fragment': 'FRAGMENTS', 'res.credits': 'CREDITS',
  'nd.relay': 'RELAY SERVER', 'nd.relay.d': 'Generates DATA. The backbone of any network.',
  'nd.storage': 'DATA STORAGE', 'nd.storage.d': 'Accepts DATA and fills your reserve.',
  'nd.compute': 'COMPUTE SERVER', 'nd.compute.d': 'Generates COMPUTE for processors.',
  'nd.router': 'ROUTER', 'nd.router.d': 'Splits DATA flow across multiple directions.',
  'nd.proxy': 'PROXY SERVER', 'nd.proxy.d': 'Converts DATA into PROCESSED DATA.',
  'nd.processor': 'DATA PROCESSOR', 'nd.processor.d': 'Assembles FRAGMENTS from DATA and COMPUTE.',
  'nd.firewall': 'FIREWALL', 'nd.firewall.d': 'Filters DATA into FILTERED DATA.',
  'nd.encryption': 'ENCRYPTION CORE', 'nd.encryption.d': 'Produces ENCRYPTED DATA.',
  'nd.datacenter': 'DATA CENTER', 'nd.datacenter.d': 'Monetizes your flow: produces NETWORK CREDITS.',
  'nd.hub': 'NETWORK HUB', 'nd.hub.d': 'Multi-port node for large backbones.',
  'tc.routing': 'ADVANCED ROUTING', 'tc.routing.d': 'Unlocks the Proxy Server.',
  'tc.processing': 'DATA PROCESSING', 'tc.processing.d': 'Unlocks the Data Processor.',
  'tc.security': 'SECURITY LAYER', 'tc.security.d': 'Unlocks the Firewall.',
  'tc.encryptionTech': 'ENCRYPTION', 'tc.encryptionTech.d': 'Unlocks the Encryption Core.',
  'tc.distributed': 'DISTRIBUTED COMPUTING', 'tc.distributed.d': 'Unlocks the Data Center and Network Hub.',
  'up.bandwidth': 'BANDWIDTH', 'up.bandwidth.d': '+50% throughput on all connections.',
  'up.storageCap': 'STORAGE CAPACITY', 'up.storageCap.d': '+50% capacity on data storages.',
  'up.prodSpeed': 'GENERATION SPEED', 'up.prodSpeed.d': 'Generators run 12% faster.',
  'up.procSpeed': 'PROCESSING SPEED', 'up.procSpeed.d': 'Processors run 12% faster.',
  'up.packetSize': 'PACKET SIZE', 'up.packetSize.d': 'Each packet carries +1 resource unit.',
};

const DICTS: Record<Lang, Record<string, string>> = { ru: RU, en: EN };

export function tr(lang: Lang, key: string): string {
  return DICTS[lang][key] ?? DICTS.en[key] ?? key;
}

export function fmt(n: number): string {
  if (!isFinite(n)) return '0';
  if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M';
  if (n >= 1e4) return (n / 1e3).toFixed(1) + 'K';
  return String(Math.floor(n));
}

export function fmtRate(n: number): string {
  if (n >= 100) return fmt(n);
  return (Math.round(n * 10) / 10).toString();
}

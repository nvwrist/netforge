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

export const RES_ORDER: ResourceId[] = ['data', 'compute', 'processed', 'filtered', 'encrypted', 'fragment', 'credits'];

// ── Tuning constants ─────────────────────────────────────────────────────────

export const TUNE = {
  travelTime: 1.15,        // seconds a packet travels a connection
  baseRate: 2.0,           // connection items/sec at bandwidth level 0
  bwMultPerLevel: 1.5,
  storageDrain: 0.5,       // storage → wallet conversion units/sec (slow, buffer stays visible)
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
    inputs: ['data'], outputs: ['data'],
    capacity: 120,
  },
  cache: {
    id: 'cache', nameKey: 'nd.cache', descKey: 'nd.cache.d',
    category: 'transfer', cost: { data: 35 }, costGrowth: 1.15,
    inputs: ['data'], outputs: ['data'],
    capacity: 40,
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
  balancer: {
    id: 'balancer', nameKey: 'nd.balancer', descKey: 'nd.balancer.d',
    category: 'transfer', cost: { data: 400 }, costGrowth: 1.22,
    inputs: ['data', 'data'], outputs: ['data', 'data', 'data', 'data'],
    capacity: 60, tech: 'routing',
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
  archive: {
    id: 'archive', nameKey: 'nd.archive', descKey: 'nd.archive.d',
    category: 'processor', cost: { data: 300 }, costGrowth: 1.22,
    inputs: ['data'], outputs: [],
    recipe: { inputs: [{ resource: 'data', amount: 4 }], outputs: [{ resource: 'credits', amount: 2 }], time: 4 },
    capacity: 12, tech: 'processing',
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
  refinery: {
    id: 'refinery', nameKey: 'nd.refinery', descKey: 'nd.refinery.d',
    category: 'processor', cost: { credits: 120 }, costGrowth: 1.3,
    inputs: ['processed', 'filtered'], outputs: [],
    recipe: {
      inputs: [{ resource: 'processed', amount: 1 }, { resource: 'filtered', amount: 1 }],
      outputs: [{ resource: 'fragment', amount: 1 }], time: 5,
    },
    capacity: 8, tech: 'distributed',
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
  core: {
    id: 'core', nameKey: 'nd.core', descKey: 'nd.core.d',
    category: 'processor', cost: { credits: 2500 }, costGrowth: 1.5,
    inputs: ['data', 'compute'], outputs: [],
    recipe: {
      inputs: [{ resource: 'data', amount: 5 }, { resource: 'compute', amount: 2 }],
      outputs: [{ resource: 'credits', amount: 8 }], time: 3,
    },
    capacity: 20, requireCore: true,
  },
};

export const SHOP_ORDER: NodeTypeId[] = [
  'relay', 'storage', 'cache', 'compute', 'router', 'balancer', 'proxy', 'processor',
  'archive', 'firewall', 'encryption', 'refinery', 'datacenter', 'hub', 'core',
];

export const CATEGORY_ORDER: NodeDef['category'][] = ['generator', 'storage', 'transfer', 'processor'];

// ── Technologies ─────────────────────────────────────────────────────────────

export const TECH_DEFS: TechDef[] = [
  { id: 'routing',        nameKey: 'tc.routing',        descKey: 'tc.routing.d',        cost: { data: 150 },  unlocks: ['proxy', 'balancer'] },
  { id: 'processing',     nameKey: 'tc.processing',     descKey: 'tc.processing.d',     cost: { data: 300 },  unlocks: ['processor', 'archive'] },
  { id: 'security',       nameKey: 'tc.security',       descKey: 'tc.security.d',       cost: { data: 500 },  unlocks: ['firewall'] },
  { id: 'encryptionTech', nameKey: 'tc.encryptionTech', descKey: 'tc.encryptionTech.d', cost: { data: 800 },  unlocks: ['encryption'] },
  { id: 'distributed',    nameKey: 'tc.distributed',    descKey: 'tc.distributed.d',    cost: { data: 1200 }, unlocks: ['datacenter', 'hub', 'refinery'] },
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
  'shop.locked': 'НУЖНА ТЕХНОЛОГИЯ', 'shop.lockedCore': 'НУЖНО ЯДРО СЕТИ',
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
  'core.body': '100 фрагментов данных собраны. Ядро запущено — сеть выходит на новый уровень. Открыт узел «Ядро сети». Строительство продолжается.',
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
  'menu.help': 'УПРАВЛЕНИЕ', 'menu.codex': 'СПРАВОЧНИК', 'menu.reset': 'СБРОС СЕТИ',
  'menu.confirm': 'ТОЧНО СБРОСИТЬ?', 'menu.grid': 'Сетка', 'menu.zoomIn': 'Приблизить',
  'menu.zoomOut': 'Отдалить', 'menu.fit': 'Камера к стартовой зоне',
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
  'resd.data': 'Сырьё сети. Производится реле, потребляется почти всеми узлами. Также это валюта покупок (верхняя панель).',
  'resd.compute': 'Вычислительный ресурс серверов фермы. Нужен процессорам, шифрованию и дата-центру.',
  'resd.processed': 'Продукт прокси-серверов. Компонент для дата-центра и синтезатора.',
  'resd.filtered': 'Продукт файрволов. Нужен для шифрования и синтезатора.',
  'resd.encrypted': 'Продукт ядер шифрования. Компонент дата-центра.',
  'resd.fragment': 'Ресурс прогресса. 100 фрагментов запускают Ядро сети.',
  'resd.credits': 'Сетевая валюта. Покупка продвинутых узлов, технологий и улучшений.',
  'nd.relay': 'РЕЛЕЙНЫЙ СЕРВЕР', 'nd.relay.d': 'Генерирует ДАННЫЕ. Основа любой сети.',
  'nd.storage': 'ХРАНИЛИЩЕ ДАННЫХ', 'nd.storage.d': 'Буфер: накапливает ДАННЫЕ, медленно конвертирует их в резерв и может подавать дальше через DATA OUT.',
  'nd.cache': 'КЭШ ДАННЫХ', 'nd.cache.d': 'Компактный буфер между узлами: сглаживает поток ДАННЫХ.',
  'nd.compute': 'СЕРВЕР ВЫЧИСЛЕНИЙ', 'nd.compute.d': 'Генерирует ВЫЧИСЛЕНИЯ для процессоров.',
  'nd.router': 'МАРШРУТИЗАТОР', 'nd.router.d': 'Раздаёт ДАННЫЕ по двум направлениям.',
  'nd.balancer': 'БАЛАНСИРОВЩИК', 'nd.balancer.d': 'Мощная развязка: до 4 направлений из 2 входов.',
  'nd.proxy': 'ПРОКСИ-СЕРВЕР', 'nd.proxy.d': 'Преобразует ДАННЫЕ в ОБРАБОТАННЫЕ ДАННЫЕ.',
  'nd.processor': 'ПРОЦЕССОР ДАННЫХ', 'nd.processor.d': 'Собирает ФРАГМЕНТЫ из ДАННЫХ и ВЫЧИСЛЕНИЙ.',
  'nd.archive': 'АРХИВ', 'nd.archive.d': 'Архивирует ДАННЫЕ напрямую в СЕТЕВЫЕ КРЕДИТЫ.',
  'nd.firewall': 'ФАЙРВОЛ', 'nd.firewall.d': 'Фильтрует ДАННЫЕ в ОТФИЛЬТРОВАННЫЕ ДАННЫЕ.',
  'nd.encryption': 'ЯДРО ШИФРОВАНИЯ', 'nd.encryption.d': 'Создаёт ЗАШИФРОВАННЫЕ ДАННЫЕ.',
  'nd.refinery': 'СИНТЕЗАТОР', 'nd.refinery.d': 'Синтезирует ФРАГМЕНТЫ из обработанных и отфильтрованных данных.',
  'nd.datacenter': 'ДАТА-ЦЕНТР', 'nd.datacenter.d': 'Монетизирует поток: производит СЕТЕВЫЕ КРЕДИТЫ.',
  'nd.hub': 'СЕТЕВОЙ ХАБ', 'nd.hub.d': 'Многопортовый узел для крупных магистралей.',
  'nd.core': 'ЯДРО СЕТИ', 'nd.core.d': 'Сердце инфраструктуры: ДАННЫЕ + ВЫЧИСЛЕНИЯ в большой поток кредитов.',
  'tc.routing': 'РАСШИР. МАРШРУТИЗАЦИЯ', 'tc.routing.d': 'Открывает Прокси-сервер и Балансировщик.',
  'tc.processing': 'ОБРАБОТКА ДАННЫХ', 'tc.processing.d': 'Открывает Процессор данных и Архив.',
  'tc.security': 'УРОВЕНЬ БЕЗОПАСНОСТИ', 'tc.security.d': 'Открывает Файрвол.',
  'tc.encryptionTech': 'ШИФРОВАНИЕ', 'tc.encryptionTech.d': 'Открывает Ядро шифрования.',
  'tc.distributed': 'РАСПРЕД. ВЫЧИСЛЕНИЯ', 'tc.distributed.d': 'Открывает Дата-центр, Хаб и Синтезатор.',
  'up.bandwidth': 'ПРОПУСКНАЯ СПОСОБНОСТЬ', 'up.bandwidth.d': '+50% к пропускной способности всех связей.',
  'up.storageCap': 'ОБЪЁМ ХРАНИЛИЩ', 'up.storageCap.d': '+50% к вместимости хранилищ данных.',
  'up.prodSpeed': 'СКОРОСТЬ ГЕНЕРАЦИИ', 'up.prodSpeed.d': 'Генераторы работают на 12% быстрее.',
  'up.procSpeed': 'СКОРОСТЬ ОБРАБОТКИ', 'up.procSpeed.d': 'Процессоры работают на 12% быстрее.',
  'up.packetSize': 'РАЗМЕР ПАКЕТА', 'up.packetSize.d': 'Каждый пакет несёт +1 единицу ресурса.',
  // start screen
  'start.tag': 'ОПЕРАТОР ЭКСПЕРИМЕНТАЛЬНОЙ ЦИФРОВОЙ СЕТИ',
  'start.desc': 'Размещайте узлы, соединяйте порты — потоки данных сами разгонят сеть до полноценной цифровой инфраструктуры.',
  'start.play': 'ЗАПУСТИТЬ СЕТЬ',
  'start.continue': 'ПРОДОЛЖИТЬ',
  'start.codex': 'ОТКРЫТЬ СПРАВОЧНИК',
  'start.tip': 'Автосейв каждые 5 секунд · оффлайн-прогресс до 8 часов',
  'start.chain': 'БАЗОВАЯ ЦЕПОЧКА',
  'start.controls': 'УПРАВЛЕНИЕ',
  // codex
  'codex.title': 'СПРАВОЧНИК ОПЕРАТОРА',
  'codex.tabNodes': 'УЗЛЫ', 'codex.tabRes': 'РЕСУРСЫ', 'codex.tabLinks': 'СВЯЗИ', 'codex.tabFaq': 'FAQ',
  'codex.cat.generator': 'ГЕНЕРАТОРЫ', 'codex.cat.storage': 'ХРАНИЛИЩЕ',
  'codex.cat.transfer': 'МАРШРУТИЗАЦИЯ', 'codex.cat.processor': 'ОБРАБОТКА',
  'codex.in': 'ВХОД', 'codex.out': 'ВЫХОД', 'codex.none': '—', 'codex.src': 'источник',
  'codex.cycle': 'ЦИКЛ', 'codex.buf': 'БУФЕР', 'codex.sec': 'с',
  'codex.basic': 'БАЗОВЫЙ', 'codex.wallet': 'в резерв', 'codex.goal': 'в прогресс',
  'codex.linksTitle': 'КАК СОЕДИНЯТЬ УЗЛЫ',
  'cx.r1': 'Связь создаётся только из порта OUT в порт IN: зажмите OUT и дотяните до IN.',
  'cx.r2': 'Цвет порта — это ресурс. Соединяются только порты одного цвета.',
  'cx.r3': 'Один порт = одна связь. Занятый порт подсвечен заполненным квадратом.',
  'cx.r4': 'Генераторы (реле, сервер вычислений) не имеют входов — они источники. Хранилище имеет и вход, и выход.',
  'cx.r5': 'ПКМ по линии или узлу — удаление. На мобильном — выделить узел и нажать «УДАЛИТЬ».',
  'cx.bw': 'У каждой связи есть пропускная способность (по умолчанию 2 ед/с). Янтарная линия — связь перегружена. Улучшайте вкладку «ПРОПУСКНАЯ СПОСОБНОСТЬ».',
  'codex.resTitle': 'ДВА СЛОЯ РЕСУРСОВ',
  'codex.resBody': 'Цветные ресурсы текут по связям между узлами. DATA и CREDITS дополнительно живут в глобальном резерве (верхняя панель) — именно из резерва оплачиваются покупки. ФРАГМЕНТЫ — прогресс к Ядру сети.',
  'faq.q1': 'С чего начать?',
  'faq.a1': 'Реле производит ДАННЫЕ → хранилище накапливает и медленно переводит в резерв. Накопив ДАННЫЕ, купите маршрутизатор и сервер вычислений, затем процессор — он начнёт собирать ФРАГМЕНТЫ.',
  'faq.q2': 'Почему хранилище показывало 0?',
  'faq.a2': 'Хранилище конвертирует ДАННЫЕ в резерв (0,5/с). Если приток выше — буфер заполняется. Подключите его DATA OUT к потребителю (процессор, прокси, маршрутизатор), чтобы раздавать накопленное.',
  'faq.q3': 'Как раздать данные нескольким узлам?',
  'faq.a3': 'Маршрутизатор: 1 вход → 2 выхода. Балансировщик: 2 входа → 4 выхода. Хранилище и кэш работают как промежуточные буферы с собственным выходом.',
  'faq.q4': 'Почему не создаётся связь?',
  'faq.a4': 'Проверьте правила: только OUT → IN; цвета портов совпадают; оба порта свободны; нельзя соединить узел с собой. Красная вспышка у курсора — нарушение правила.',
  'faq.q5': 'Где брать ФРАГМЕНТЫ?',
  'faq.a5': 'Процессор данных: 2 ДАННЫХ + 1 ВЫЧИСЛЕНИЕ → 1 ФРАГМЕНТ. Позже — синтезатор: обработанные + отфильтрованные данные → фрагмент.',
  'faq.q6': 'Как зарабатывать СЕТЕВЫЕ КРЕДИТЫ?',
  'faq.a6': 'Архив (данные → кредиты), дата-центр (обработанные + зашифрованные + вычисления → кредиты) и Ядро сети после главной цели.',
  'faq.q7': 'Что значат статусы узлов?',
  'faq.a7': 'АКТИВЕН — работает. НЕТ ВХОДА — ждёт ресурс на входе, проверьте связи. ПОЛНЫЙ — буфер заполнен, некому забирать: подключите OUT-порт. ПРОСТОЙ — нет данных для передачи.',
  'faq.q8': 'Что делать после 100 фрагментов?',
  'faq.a8': 'Запускается Ядро сети и открывается одноимённый узел — мощный генератор кредитов. Продолжайте расширять сеть, прокачивайте пропускную способность и уровни узлов.',
  'faq.q9': 'Работает ли сеть без меня?',
  'faq.a9': 'Да. При возвращении игра посчитает оффлайн-производство (до 8 часов, 50% эффективности) и предложит его забрать.',
  'faq.q10': 'Как удалить узел или связь?',
  'faq.a10': 'ПКМ по узлу или линии (на мобильном — выделить узел → «УДАЛИТЬ»). Связи узла удаляются вместе с ним. Стоимость не возвращается.',
};

const EN: Record<string, string> = {
  'hud.net': 'NETWORK', 'hud.online': 'ONLINE', 'hud.nodes': 'NODES', 'hud.links': 'LINKS',
  'hud.flow': 'FLOW', 'hud.pcs': '/s',
  'goal.title': 'NETWORK CORE', 'goal.done': 'CORE ONLINE',
  'shop.tabNodes': 'NODES', 'shop.tabTech': 'TECH', 'shop.tabUpg': 'UPGRADES',
  'shop.locked': 'REQUIRES TECH', 'shop.lockedCore': 'REQUIRES NETWORK CORE',
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
  'core.body': '100 data fragments assembled. The core is live — your network reaches a new tier. The Network Core node is now available. Keep building.',
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
  'menu.help': 'CONTROLS', 'menu.codex': 'CODEX', 'menu.reset': 'RESET NETWORK',
  'menu.confirm': 'SURE? RESET?', 'menu.grid': 'Grid', 'menu.zoomIn': 'Zoom in',
  'menu.zoomOut': 'Zoom out', 'menu.fit': 'Camera to start zone',
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
  'resd.data': 'The raw flow of the network. Produced by relays, consumed by almost everything. Also the purchase currency (top bar).',
  'resd.compute': 'Compute power from server farms. Feeds processors, encryption and the data center.',
  'resd.processed': 'Proxy server output. An ingredient for the data center and refinery.',
  'resd.filtered': 'Firewall output. Needed for encryption and the refinery.',
  'resd.encrypted': 'Encryption core output. A data center ingredient.',
  'resd.fragment': 'Progress resource. 100 fragments bring the Network Core online.',
  'resd.credits': 'Network currency. Buys advanced nodes, technologies and upgrades.',
  'nd.relay': 'RELAY SERVER', 'nd.relay.d': 'Generates DATA. The backbone of any network.',
  'nd.storage': 'DATA STORAGE', 'nd.storage.d': 'A buffer: accumulates DATA, slowly converts it to your reserve, and can feed it onward via DATA OUT.',
  'nd.cache': 'DATA CACHE', 'nd.cache.d': 'A compact buffer between nodes: smooths the DATA flow.',
  'nd.compute': 'COMPUTE SERVER', 'nd.compute.d': 'Generates COMPUTE for processors.',
  'nd.router': 'ROUTER', 'nd.router.d': 'Splits DATA flow across two directions.',
  'nd.balancer': 'LOAD BALANCER', 'nd.balancer.d': 'Heavy distribution: up to 4 directions from 2 inputs.',
  'nd.proxy': 'PROXY SERVER', 'nd.proxy.d': 'Converts DATA into PROCESSED DATA.',
  'nd.processor': 'DATA PROCESSOR', 'nd.processor.d': 'Assembles FRAGMENTS from DATA and COMPUTE.',
  'nd.archive': 'ARCHIVE VAULT', 'nd.archive.d': 'Archives DATA directly into NETWORK CREDITS.',
  'nd.firewall': 'FIREWALL', 'nd.firewall.d': 'Filters DATA into FILTERED DATA.',
  'nd.encryption': 'ENCRYPTION CORE', 'nd.encryption.d': 'Produces ENCRYPTED DATA.',
  'nd.refinery': 'REFINERY', 'nd.refinery.d': 'Synthesizes FRAGMENTS from processed and filtered data.',
  'nd.datacenter': 'DATA CENTER', 'nd.datacenter.d': 'Monetizes your flow: produces NETWORK CREDITS.',
  'nd.hub': 'NETWORK HUB', 'nd.hub.d': 'Multi-port node for large backbones.',
  'nd.core': 'NETWORK CORE', 'nd.core.d': 'Heart of the infrastructure: DATA + COMPUTE into a heavy credit stream.',
  'tc.routing': 'ADVANCED ROUTING', 'tc.routing.d': 'Unlocks the Proxy Server and Load Balancer.',
  'tc.processing': 'DATA PROCESSING', 'tc.processing.d': 'Unlocks the Data Processor and Archive Vault.',
  'tc.security': 'SECURITY LAYER', 'tc.security.d': 'Unlocks the Firewall.',
  'tc.encryptionTech': 'ENCRYPTION', 'tc.encryptionTech.d': 'Unlocks the Encryption Core.',
  'tc.distributed': 'DISTRIBUTED COMPUTING', 'tc.distributed.d': 'Unlocks the Data Center, Hub and Refinery.',
  'up.bandwidth': 'BANDWIDTH', 'up.bandwidth.d': '+50% throughput on all connections.',
  'up.storageCap': 'STORAGE CAPACITY', 'up.storageCap.d': '+50% capacity on data storages.',
  'up.prodSpeed': 'GENERATION SPEED', 'up.prodSpeed.d': 'Generators run 12% faster.',
  'up.procSpeed': 'PROCESSING SPEED', 'up.procSpeed.d': 'Processors run 12% faster.',
  'up.packetSize': 'PACKET SIZE', 'up.packetSize.d': 'Each packet carries +1 resource unit.',
  // start screen
  'start.tag': 'OPERATOR OF AN EXPERIMENTAL DIGITAL NETWORK',
  'start.desc': 'Place nodes, connect ports — the data flows will grow your grid into full-scale digital infrastructure.',
  'start.play': 'BOOT THE NETWORK',
  'start.continue': 'CONTINUE',
  'start.codex': 'OPEN CODEX',
  'start.tip': 'Autosave every 5 seconds · offline progress up to 8 hours',
  'start.chain': 'BASIC CHAIN',
  'start.controls': 'CONTROLS',
  // codex
  'codex.title': "OPERATOR'S CODEX",
  'codex.tabNodes': 'NODES', 'codex.tabRes': 'RESOURCES', 'codex.tabLinks': 'LINKS', 'codex.tabFaq': 'FAQ',
  'codex.cat.generator': 'GENERATORS', 'codex.cat.storage': 'STORAGE',
  'codex.cat.transfer': 'ROUTING', 'codex.cat.processor': 'PROCESSING',
  'codex.in': 'IN', 'codex.out': 'OUT', 'codex.none': '—', 'codex.src': 'source',
  'codex.cycle': 'CYCLE', 'codex.buf': 'BUFFER', 'codex.sec': 's',
  'codex.basic': 'BASIC', 'codex.wallet': 'to reserve', 'codex.goal': 'to progress',
  'codex.linksTitle': 'HOW TO CONNECT NODES',
  'cx.r1': 'Links only go OUT port → IN port: hold an OUT port and drag onto an IN port.',
  'cx.r2': 'Port color is the resource. Only same-color ports can link.',
  'cx.r3': 'One port = one link. A filled square means the port is taken.',
  'cx.r4': 'Generators (relay, compute server) have no inputs — they are sources. Storage has both an input and an output.',
  'cx.r5': 'RMB on a line or node deletes it. On mobile — select the node and press DELETE.',
  'cx.bw': 'Every link has bandwidth (2 units/s by default). An amber line means the link is saturated. Upgrade BANDWIDTH in the shop.',
  'codex.resTitle': 'TWO RESOURCE LAYERS',
  'codex.resBody': 'Colored resources flow through links between nodes. DATA and CREDITS also live in your global reserve (top bar) — purchases are paid from the reserve. FRAGMENTS track progress toward the Network Core.',
  'faq.q1': 'Where do I start?',
  'faq.a1': 'The relay produces DATA → storage accumulates it and slowly converts it to your reserve. Save up DATA, buy a router and a compute server, then a processor — it will start assembling FRAGMENTS.',
  'faq.q2': 'Why did storage always show 0?',
  'faq.a2': 'Storage converts DATA into your reserve (0.5/s). When the inflow is higher, the buffer fills up. Connect its DATA OUT to a consumer (processor, proxy, router) to distribute what it holds.',
  'faq.q3': 'How do I feed several nodes at once?',
  'faq.a3': 'Router: 1 input → 2 outputs. Load balancer: 2 inputs → 4 outputs. Storage and cache act as intermediate buffers with their own outputs.',
  'faq.q4': 'Why does my link fail?',
  'faq.a4': 'Check the rules: OUT → IN only; port colors must match; both ports must be free; no self-links. A red flash at the cursor means a rule was broken.',
  'faq.q5': 'Where do FRAGMENTS come from?',
  'faq.a5': 'Data Processor: 2 DATA + 1 COMPUTE → 1 FRAGMENT. Later — the Refinery: processed + filtered data → fragment.',
  'faq.q6': 'How do I earn NETWORK CREDITS?',
  'faq.a6': 'Archive Vault (data → credits), Data Center (processed + encrypted + compute → credits), and the Network Core after the main goal.',
  'faq.q7': 'What do node statuses mean?',
  'faq.a7': 'ONLINE — working. NO INPUT — waiting for resources, check its links. FULL — output buffer is full, nobody is taking the resource: connect the OUT port. IDLE — nothing to transfer.',
  'faq.q8': 'What happens after 100 fragments?',
  'faq.a8': 'The Network Core comes online and the node of the same name unlocks — a heavy credit generator. Keep expanding, upgrade bandwidth and node levels.',
  'faq.q9': 'Does the network run while I am away?',
  'faq.a9': 'Yes. On return, the game computes offline production (up to 8 hours at 50% efficiency) and offers a COLLECT window.',
  'faq.q10': 'How do I delete a node or link?',
  'faq.a10': 'RMB on the node or line (mobile: select the node → DELETE). A node’s links are removed with it. No refunds.',
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

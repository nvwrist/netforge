# NetForge

Инкрементальный билдер цифровой сети (HTML5, TypeScript + Canvas, без игрового движка).
Игрок размещает узлы на бесконечном поле, соединяет порты `OUT → IN` и наблюдает, как по
связям текут пакеты данных, а сеть разрастается в сложную инфраструктуру.

- Сеть — это настоящий граф (`Node` / `Port` / `Connection` / `Packet`), живущий независимо от рендера.
- Производство, соединения и пакеты считаются в едином `requestAnimationFrame`-цикле с delta-time.
- Вся экономика и контент — **data-driven**: новые узлы, технологии и вехи добавляются правкой
  данных, а не логики.

> **Главное правило:** игрок строит сеть сам. Это НЕ головоломка, НЕ уровни, НЕ «правильный путь».
> См. `AGENTS.md` (раздел 2) — список механик, которые запрещено добавлять.

---

## Архитектура (кратко)

```
src/
├── game/
│   ├── types.ts        # все типы: NodeDef, TechDef, AchievementCondition, GameState…
│   ├── data.ts         # ЕДИНСТВЕННАЯ точка контента: NODE_DEFS, TECH_DEFS, UPGRADE_DEFS,
│   │                   #   ACHIEVEMENTS, RES_META, баланс (TUNE, SURGE_CFG, TIER_CFG…), локализация RU/EN
│   ├── state.ts        # фабрика узлов, ёмкости, валидация/создание связей, стоимость
│   ├── engine.ts       # ProductionEngine + ConnectionEngine (delta-time, пакеты, back-pressure)
│   ├── Game.ts         # оркестратор: цикл, ввод, камера, placement, экономика, снапшот для UI
│   ├── render.ts       # Canvas-рендер мира (читает GameState, ничего не владеет)
│   ├── icons.ts        # процедурные иконки узлов + default-fallback
│   ├── surge.ts        # менеджер случайных всплесков (SurgeManager)
│   ├── achievements.ts # интерпретатор декларативных условий вех (AchievementManager)
│   ├── save.ts         # SaveManager (localStorage) + оффлайн-прогресс + миграции
│   ├── camera.ts       # worldToScreen / screenToWorld, zoom к курсору
│   └── audio.ts        # процедурный WebAudio (без ассетов)
├── ui/                 # HUD, магазин, инфопанель, оверлеи, стартовый экран и справочник (React)
└── sdk/YandexSDK.ts    # изолированный слой Yandex Games с browser-fallback
```

Ядро (граф, ProductionEngine, ConnectionManager) **не переписывать** — только расширять.

---

## Как добавить новый узел (node)

Почти всё — правка данных. Обязательная правка кода ровно одна (union-тип).

### 1. Добавьте id в `NodeTypeId` — `src/game/types.ts`

```ts
export type NodeTypeId =
  | 'relay' | 'storage' | … | 'core'
  | 'mynode';                       // ← ваш id
```

Это единственное место, где меняется код. TypeScript дальше сам подсветит все точки,
где нужно дополнить данные.

### 2. Добавьте запись в `NODE_DEFS` — `src/game/data.ts`

```ts
mynode: {
  id: 'mynode',
  nameKey: 'nd.mynode',        // ключ названия (локализация)
  descKey: 'nd.mynode.d',      // ключ описания (локализация)
  category: 'processor',       // 'generator' | 'storage' | 'transfer' | 'processor'
  cost: { data: 400 },         // базовая цена (data и/или credits)
  costGrowth: 1.2,             // ×1.2 к цене за каждый купленный экземпляр
  inputs: ['data', 'compute'], // входные порты (ресурс на каждый)
  outputs: ['processed'],      // выходные порты
  recipe: {                    // только для generator/processor
    inputs:  [{ resource: 'data', amount: 2 }, { resource: 'compute', amount: 1 }],
    outputs: [{ resource: 'processed', amount: 1 }],
    time: 3,                   // секунд на цикл
  },
  capacity: 10,                // внутренний буфер
  tech: 'processing',          // (опц.) технология, открывающая узел
  // requireCore: true,        // (опц.) доступен только после запуска Ядра
},
```

Смысл полей:
- `category` — поведение в движке:
  - `generator` — производит `recipe.outputs[0]` каждые `time` сек, копит в буфер до `capacity`;
  - `processor` — ждёт все `recipe.inputs`, потребляет их и кладёт `recipe.outputs`
    (`fragment`/`credits` уходят сразу в прогресс/кошелёк, остальное — в буфер);
  - `storage` — буфер: копит `inputs[0]`, `data`-хранилище ещё и медленно конвертирует
    заполненность в резерв (чем полнее — тем быстрее);
  - `transfer` — пассивно пропускает ресурс (роутеры/хабы/кэши).
- `inputs`/`outputs` — каждый элемент становится **портом** (`ONE PORT = ONE CONNECTION`).
- `recipe` — для `storage`/`transfer` не нужен.
- `tech` / `requireCore` — гейты доступности в магазине.

### 3. Добавьте id в `SHOP_ORDER` — `src/game/data.ts`

```ts
export const SHOP_ORDER: NodeTypeId[] = [ 'relay', …, 'mynode' ];
```

Без этого узел не появится в магазине (и в справочнике он группируется по `category`
автоматически — там править ничего не нужно).

### 4. Добавьте локализацию — словари `RU` и `EN` в `src/game/data.ts`

```ts
'nd.mynode':   'МОЙ УЗЕЛ',
'nd.mynode.d': 'Короткое описание того, что он делает.',
```

(и то же самое в английском словаре ниже по файлу).

### 5. (опционально) Иконка — `src/game/icons.ts`

Если не добавлять `case 'mynode':` — сработает `default:` и отрисуется generic-иконка.
Узел будет полностью рабочим без кастомной иконки.

Готово: узел покупается, размещается, соединяется портами, производит, сохраняется.

---

## Как добавить новое достижение

Полностью data-driven — **код править не нужно**. Условия интерпретирует
`AchievementManager` (`src/game/achievements.ts`) через `evaluateCondition()`.

Просто допишите объект в `ACHIEVEMENTS` (`src/game/data.ts`) + 2 строки локализации:

```ts
{ id: 'hub2', nameKey: 'ach.hub2', descKey: 'ach.hub2.d',
  condition: { type: 'nodeCount', nodeType: 'hub', count: 2 },
  bonus: { kind: 'res', res: 'credits', amount: 100 } },
```

### Типы условий (`AchievementCondition`, `src/game/types.ts`)

| type | поля | пример |
|---|---|---|
| `nodeCount` | `nodeType`, `count` | `{ type:'nodeCount', nodeType:'relay', count:8 }` — 8 реле |
| `anyNodeCount` | `count` | `{ type:'anyNodeCount', count:25 }` — 25 узлов любых типов |
| `connectionCount` | `count` | `{ type:'connectionCount', count:30 }` |
| `statThreshold` | `stat`, `value` | `{ type:'statThreshold', stat:'credits', value:2000 }` |
| `chainLength` | `length` | `{ type:'chainLength', length:10 }` — цепочка из 10 узлов |
| `techCount` | `count` | `{ type:'techCount', count:5 }` |
| `coreTier` | `tier` | `{ type:'coreTier', tier:3 }` |
| `prestigeCount` | `count` | `{ type:'prestigeCount', count:3 }` |
| `nodeTypeVariety` | `count` | `{ type:'nodeTypeVariety', count:12 }` — 12 разных типов |

Допустимые `stat`: `delivered`, `credits`, `fragments`, `conns`, `nodes`, `upgrades`,
`time` (сек), `placed`, `data`.

### Типы наград (`bonus`)

- `{ kind:'res', res, amount }` — разовая пачка ресурса (`data` / `credits`).
- `{ kind:'boost', target:'gen'|'proc'|'all', mult, dur }` — временный множитель скорости.

**Правило:** награда должна расти вместе со сложностью условия — не делайте позднее
достижение с наградой меньше раннего.

Старые сохранённые id достижений читаются как раньше (хранятся только `id`-строки),
помена структуры условий совместима со старыми сейвами.

---

## Как добавить технологию / апгрейд

### Технология — `TECH_DEFS` (`src/game/data.ts`)

```ts
{ id: 'mytech', nameKey: 'tc.mytech', descKey: 'tc.mytech.d',
  cost: { data: 600 },
  unlocks: ['mynode'],          // какие узлы открывает
  requires: 'processing',       // (опц.) предшествующая технология
  path: 'A' },                  // (опц.) 'A' | 'B' — ветка дерева; без path = базовая
```

+ строки `tc.mytech` / `tc.mytech.d` в `RU` и `EN`. Ветка (`path`) определяет, в какой
вкладке магазина («ВЕТКА A» / «ВЕТКА B») окажется технология.

### Апгрейд — `UPGRADE_DEFS` (`src/game/data.ts`)

```ts
{ id: 'myupg', nameKey: 'up.myupg', descKey: 'up.myupg.d',
  max: Infinity,                                   // Infinity = бесконечный
  cost: (l) => ({ data: Math.round(200 * Math.pow(2.1, l)) }) },
```

Уровень и эффект читаются движком через `state.upgrades[id]` — если нужен новый
*эффект* (не просто стоимость), его применение добавляется в `engine.ts` точечно.

---

## Как добавить новый модуль (module)

Полностью data-driven — **код править не нужно**. Все модули лежат в
`src/game/data/modules.ts` в массиве `MODULE_DEFS`. Движок применяет их как
модификаторы поверх базового рецепта (см. `defFor()` в `src/game/state.ts`),
поэтому новый модуль не может сломать production-логику.

```ts
{
  id: 'turboCoil',                       // уникальный id
  nameKey: 'mod.turboCoil',              // ключи локализации (RU + EN словари в data.ts)
  descKey: 'mod.turboCoil.d',
  appliesToCategory: ['generator'],      // generator | storage | transfer | processor
  cost: { credits: 90 },                 // цена установки (data и/или credits)
  effect: {
    speedMult: 1.4,        // множитель скорости цикла (опционально)
    capacityMult: 0.8,     // множитель вместимости — типичный трейд-офф (опционально)
    outputBonus: { resource: 'credits', amount: 1 }, // побочный выход за цикл (опционально)
    inputReduction: 1,     // −N к первому входу рецепта, минимум 1 (опционально)
    inputExtra: 1,         // +N к первому входу — цена побочных модулей (опционально)
    drainMult: 0.7,        // множитель конвертации хранилища в резерв (опционально)
    redundancySec: 8,      // секунд работы без входа (опционально)
    surgeWindowBonus: 4,   // дополнительные секунды окна всплеска (опционально)
  },
  slotCost: 1,             // сколько слотов занимает (1–2)
},
```

Правила дизайна модуля:

- каждый модуль обязан иметь **трейд-офф** (скорость ↔ вместимость, бонус ↔
  доп. вход, цена/слоты ↔ сила) — чистых бустов не добавляем;
- модуль открывается через **endless research**: каждая покупка исследования
  предлагает игроку выбор 1 из 2 случайных ещё не открытых модулей
  (roguelite-выбор в `Game.buyResearch()`);
- слоты узла: 2 у базовых узлов, 3 у технологических, +1 на уровнях 3 и 5
  (`moduleSlots()` в `state.ts`, лимиты в `MODULE_CFG`).

## Blueprint-узлы

Каждый третий тир исследования (`BLUEPRINT_CFG.everyTier`) генерирует
процедурный вариант существующего узла: случайные множители входа/выхода/времени
в разумных пределах (`BLUEPRINT_CFG.*Jitter`), цена следует за эффективностью
(`costMult`). Blueprint-узлы хранятся в рантайм-списке `state.blueprints`
(сериализуется в save) и применяются через тот же `defFor()` — параллельной
системы производства нет. Имена и цвета генерируются из пулов
`BLUEPRINT_NAMES` / `BLUEPRINT_COLORS`.

## Dev-режим (ускоренное время для тестов)

Нажмите клавишу **`** (тильда) в игре — симуляция ускоряется в 8 раз
(время ×8, вехи/экономика считаются честно). Повторное нажатие возвращает ×1.
Используйте для ручной проверки баланса поздней игры.

## Баланс — на что обращать внимание

- **`costGrowth`** держите в диапазоне `1.1–1.3` для массовых узлов и `1.3–1.5` для
  уникальных. Слишком низкий рост (<1.1) ломает позднюю экономику (всё становится
  бесплатным), слишком высокий (>1.6) делает узел «одноразовым».
- **`capacity` / `recipe.time`** соотносите с соседями той же категории. Новый узел не
  должен быть *автоматически строго лучше* старого при той же цене — иначе старый
  перестаёт иметь смысл. Либо новый узел дороже, либо у него другой ресурс/ниша.
- **Цена ↔ окупаемость:** processor, производящий `credits`, должен окупаться заметно
  дольше, чем стоит, иначе кредиты обесценятся. Ориентир — существующие `archive` /
  `datacenter` / `core`.
- **Пропускная способность** связей (`TUNE.baseRate`, апгрейд `bandwidth`) — главный
  ограничитель роста. Не поднимайте `baseRate`, лучше дайте игроку апгрейд.
- **Вехи (achievements)** должны закрываться часто в первые 10–15 минут — это источник
  раннего азарта. Пороги берите с запасом: первые 3–4 вехи — за 1–3 минуты игры.
- **Бесконечность:** ничего не должно иметь «потолка». Апгрейды — `max: Infinity`,
  тиры Ядра и исследования генерируются по формуле, не списком.

---

## Проверка после изменений

После каждой контентной правки (см. `AGENTS.md`, разделы 24/31):

```
npm run build        # TypeScript должен быть зелёным
```

и в рантайме: игра стартует, узлы производят, связи переносят пакеты,
save/load не corrupt'ит состояние (старые сейвы мигрируются в `save.ts:applySave`).

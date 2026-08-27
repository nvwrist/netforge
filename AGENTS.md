# AGENTS.md

## Project

NetForge is an HTML5 incremental network-building game.

Technology:

- TypeScript
- Canvas API
- HTML/CSS where appropriate
- No game engine
- No React required
- No heavy rendering framework

Target platform:

- Desktop browsers
- Mobile browsers
- Yandex Games

---

## 1. CORE GAME CONCEPT

The game is an:

**Incremental Network Builder / Cyber Infrastructure Automation Game**

The player builds a persistent digital network by:

1. purchasing nodes;
2. placing nodes on a large world canvas;
3. connecting output ports to input ports;
4. moving data packets through connections;
5. processing resources;
6. earning resources and currency;
7. unlocking new technologies;
8. upgrading the network.

The network graph itself is the main gameplay system.

---

## 2. ABSOLUTELY DO NOT TURN THIS INTO A PUZZLE GAME

Never introduce these mechanics unless explicitly requested:

- levels;
- Level 1 / Level 2 / Level 3;
- Source / Target;
- predefined puzzle paths;
- correct path validation;
- stars;
- boss levels;
- level timers;
- Game Over;
- stability;
- level energy;
- mandatory node sequences;
- "connect A to B to win".

The player freely constructs the network.

There is no predefined correct network layout.

---

## 3. NETWORK GRAPH IS THE CORE

The game is based on a persistent graph.

Nodes are entities.

Ports are connection endpoints.

Connections are real gameplay objects.

Packets travel through connections.

Do not implement connections as decorative lines only.

The graph must exist independently of rendering.

---

## 4. PORT RULE

Connections are always:

OUTPUT PORT → INPUT PORT

Never implement node-to-node connections without ports.

Every port may have at most one connection.

ONE PORT = ONE CONNECTION.

Connection validation must check:

- source port direction;
- target port direction;
- whether ports are already connected;
- resource compatibility;
- valid node references;
- self-connections.

---

## 5. WORLD VS UI

World objects use world coordinates.

UI uses screen coordinates.

Always keep these systems separate.

Use:

```text
Camera.worldToScreen()
Camera.screenToWorld()
```

Nodes must not store screen coordinates.

The camera controls:

- x;
- y;
- zoom.

The UI must remain fixed while the world zooms.

---

## 6. RENDERING

Use Canvas for world rendering.

Do not create a DOM element for every node.

Do not create a DOM element for every connection.

Rendering must be driven by GameState.

Renderer should not own gameplay state.

Renderer should display state.

---

## 7. GAME LOOP

Use a single requestAnimationFrame loop.

Do not create one setInterval/setTimeout production loop per node.

Preferred flow:

```text
requestAnimationFrame
        ↓
input update
        ↓
camera update
        ↓
production update
        ↓
connection update
        ↓
packet update
        ↓
animation update
        ↓
world render
        ↓
UI render
```

All time-dependent logic must use delta time.

---

## 8. PRODUCTION

Production must be data-driven.

Nodes should not contain large amounts of hard-coded recipe logic.

Use NodeDefinition / Recipe configuration.

Example:

```json
{
    "id": "data-processor",
    "inputs": [
        { "resource": "data", "amount": 2 },
        { "resource": "compute", "amount": 1 }
    ],
    "outputs": [
        { "resource": "dataFragment", "amount": 1 }
    ],
    "productionTime": 4
}
```

Adding a new node should require mostly configuration changes.

---

## 9. DATA FLOW

The intended resource pipeline is:

```text
node production
      ↓
output inventory
      ↓
connection queue
      ↓
packet
      ↓
connection
      ↓
input port
      ↓
target inventory
```

Do not instantly teleport resources between nodes.

Visual packet movement is an important part of the game feel.

---

## 10. NODE MOVEMENT

Nodes are freely movable.

Dragging a node must update all connected lines automatically.

Connections belong to ports, not screen coordinates.

Never bake connection endpoints into the renderer.

---

## 11. INPUT PRIORITY

Desktop:

- Left click: select
- Left drag on node body: move node
- Drag from output port: create connection
- Right click: delete node/connection
- Middle mouse: pan
- Mouse wheel: zoom

Mobile:

- Tap: select
- Drag node: move
- Drag from port: create connection
- Drag empty world: pan
- Pinch: zoom

Interactive port hitboxes should be larger than their visual representation.

---

## 12. DATA MODEL

Keep the core state centralized.

Recommended structure:

```text
GameState {
    resources
    nodes
    connections
    technologies
    upgrades
    goalProgress
    camera
}
```

Do not put global state inside renderers.

Do not make the Canvas object the source of truth.

---

## 13. SAVE SYSTEM

Use SaveManager.

Core gameplay must not directly call localStorage.

Save:

- resources;
- nodes;
- positions;
- inventories;
- node levels;
- connections;
- upgrades;
- technology unlocks;
- goal progress;
- timestamp.

Autosave approximately every 5 seconds.

Also save after important state changes.

---

## 14. OFFLINE PROGRESS

Offline progress must be calculated from timestamps.

Never run a background timer while the game is closed.

Use:

```text
offlineTime = currentTimestamp - savedTimestamp
```

Cap offline progress at a reasonable maximum.

---

## 15. DATA-DRIVEN DESIGN

Prefer:

- definitions
- recipes
- upgrades
- localization

over:

- large switch statements
- large if/else chains
- hard-coded UI values
- hard-coded prices

Node definitions belong in `/src/data`.

---

## 16. ARCHITECTURE

Preferred project structure:

```text
src/
├── core/
├── world/
├── nodes/
├── production/
├── input/
├── render/
├── ui/
├── progression/
├── save/
├── audio/
├── sdk/
└── data/
```

Keep responsibilities separated.

---

## 17. YANDEX SDK

Yandex SDK must be isolated behind:

```text
src/sdk/YandexSDK.ts
```

Gameplay must not depend directly on Yandex APIs.

The game must still run in a normal browser.

Use fallback implementations where possible.

Before implementing Yandex functionality, verify the current official API documentation.

Do not invent SDK method names.

---

## 18. ADS

Ads are not part of the core gameplay engine.

Rewarded ads and interstitial ads must be handled by the SDK layer.

Never put advertising calls inside:

- Node;
- Connection;
- ProductionEngine;
- GameState.

---

## 19. LOCALIZATION

All player-facing strings must be localized.

Do not hard-code Russian or English text inside gameplay classes.

Use:

```text
src/data/localization.ts
```

At minimum:

- ru;
- en.

---

## 20. VISUAL STYLE

Target visual direction:

technical digital infrastructure.

Use:

- dark gray;
- steel gray;
- muted blue;
- cyan;
- amber;
- red for errors;
- green for active state.

Nodes should be rectangular technical cards.

Avoid:

- excessive neon;
- huge glows;
- circular node UI;
- overly busy cyberpunk effects.

The canvas should remain readable when dozens of nodes exist.

---

## 21. PERFORMANCE

Target:

- 60 FPS desktop.
- 30–60 FPS mobile depending on device.

Avoid:

- thousands of particles;
- unnecessary object allocations every frame;
- DOM elements per node;
- DOM elements per connection;
- expensive canvas redraw operations when unnecessary.

Prefer object reuse for packets/particles if the number becomes large.

---

## 22. IMPLEMENTATION ORDER

Always prioritize:

1. graph model;
2. ports;
3. connections;
4. resource flow;
5. production;
6. economy;
7. save/load;
8. input;
9. UI;
10. visual effects;
11. audio;
12. Yandex SDK.

Do not implement advanced UI before the core graph works.

---

## 23. VERTICAL SLICE FIRST

Before implementing the whole game, create:

```text
Relay Server
      |
      v
    Storage
```

It must:

- produce DATA;
- create packets;
- move packets;
- deliver DATA to Storage;
- update inventory;
- show production progress.

Then add:

```text
    Relay
      |
    Router
    /    \
Storage  Processor
```

Only after this works should more node types be added.

---

## 24. TESTING REQUIREMENTS

After every significant implementation step:

- run TypeScript build;
- fix all compiler errors;
- check runtime console;
- test mouse interaction;
- test camera;
- test connection creation;
- test connection deletion;
- test resource flow.

Do not move forward while the previous core mechanic is broken.

---

## 25. DO NOT REWRITE WORKING SYSTEMS WITHOUT A REASON

Before changing an existing implementation:

- inspect it;
- understand its responsibility;
- modify the smallest necessary part.

Do not replace working systems just to use a preferred architecture.

---

## 26. NO UNREQUESTED FEATURES

Do not add random game mechanics because they are common in other games.

Do not add:

- quests;
- characters;
- combat;
- enemies;
- inventory grids;
- cards;
- RPG stats;
- energy timers;
- levels;
- stars;
- bosses;
- unrelated minigames.

Only add features that support the network-building concept.

---

## 27. GAMEPLAY PRIORITY

If there is a conflict between visual polish and gameplay functionality:

choose gameplay functionality.

If there is a conflict between a complex feature and a stable simple implementation:

choose the stable implementation.

---

## 28. IMPORTANT TERMINOLOGY

Use this terminology consistently:

- Node
- Port
- Connection
- Packet
- Network
- Bandwidth
- Data
- Compute
- Storage
- Processing
- Technology
- Upgrade
- Network Credits
- Data Fragment

Do not randomly rename these concepts across files.

---

## 29. SECURITY / HACKING THEME

The hacking/cyber theme is fictional game flavor.

Do not implement functionality for:

- real-world hacking;
- credential theft;
- malware;
- real network exploitation;
- scanning real networks;
- bypassing real authentication;
- attacking external systems.

All cyber mechanics are abstract gameplay systems.

For example:

- "Encryption Core" means a fictional production node.
- "Firewall" means a fictional processing node.
- "Proxy" means a fictional resource-processing node.

---

## 30. CODE QUALITY

Prefer:

- small focused classes;
- clear interfaces;
- typed data;
- enums/unions for resource types;
- centralized definitions;
- predictable state transitions.

Avoid:

- giant Game.ts;
- global mutable variables;
- duplicated production logic;
- duplicated rendering logic;
- hard-coded node-specific behavior everywhere.

---

## 31. BEFORE FINISHING A TASK

Always verify:

- build succeeds;
- no TypeScript errors;
- no obvious runtime exceptions;
- game starts;
- camera works;
- nodes render;
- ports render;
- connections render;
- production updates;
- save/load does not corrupt state.

If something is incomplete, state exactly what remains incomplete.

Do not claim a feature is implemented if it is only a visual placeholder.

---

## 32. DEFINITION OF DONE

A feature is DONE only when:

- it exists in the data model;
- it works in gameplay;
- it renders correctly;
- it responds to input if needed;
- it survives save/load if persistent;
- it does not introduce TypeScript errors;
- it does not break existing mechanics.

A button that does nothing is not a completed feature.

A visual connection without resource flow is not a completed connection system.

A production bar without actual production is not a completed production system.

---

## FINAL RULE

When uncertain, preserve this principle:

**THE PLAYER BUILDS A NETWORK.**

The game is about watching that network become larger, faster and more complex.

Do not turn the game into a puzzle.

Do not turn the game into a level-based game.

Do not replace the graph with a tree.

The graph is the product.

---

## Что я бы ещё изменил относительно NodeForge

Есть одна концептуальная вещь, которая может сделать твою версию **интереснее оригинала**.

Не делай сеть просто:

> ресурс A → машина → ресурс B.

Сделай так, чтобы у сети были **три одновременно развивающиеся характеристики**:

```text
DATA
BANDWIDTH
COMPUTE
```

Например:

**Relay Server** — генерирует DATA.

**Router** — позволяет распределять DATA по сети.

**Compute Server** — генерирует COMPUTE.

**Processor** — потребляет:

```text
2 DATA
  +
1 COMPUTE
```

и создаёт:

```text
1 DATA FRAGMENT
```

**Data Center** — потребляет:

- DATA
- COMPUTE
- DATA FRAGMENTS

и создаёт:

- NETWORK CREDITS

Получается уже не дерево:

```text
A → B → C → D
```

а настоящая сеть:

```text
                  ┌── STORAGE
                  │
RELAY ─── ROUTER ┼── PROCESSOR ─── DATA CORE
           │      │       ↑
           │      └── PROXY
           │              ↑
           └──────────────┘
                  COMPUTE
                    ↑
              SERVER FARM
```

И здесь появляется интересная оптимизация: куда направить трафик, где поставить процессор, где не хватает bandwidth, какую ветку прокачать.

Это уже гораздо ближе к ощущению управления цифровой инфраструктурой, чем обычная производственная цепочка.

### И самое важное

Я бы не называл главную валюту BTC. Для такой игры гораздо органичнее:

- **DATA** — сырьё;
- **COMPUTE** — вычислительный ресурс;
- **BANDWIDTH** — пропускная способность;
- **DATA FRAGMENTS** — прогресс;
- **NETWORK CREDITS** — деньги.

Тогда весь интерфейс можно переосмыслить как панель управления сетью, а не как фабрику.

И при этом визуальная структура остаётся очень близкой к исходной игре: большой grid, свободное пространство, карточки-ноды, маленькие порты, линии между ними, ресурсы сверху, магазин сбоку и постоянно работающая сеть на canvas.

import { AudioManager } from './audio';
import { Camera } from './camera';
import {
  GOAL_FRAGMENTS, NODE_DEFS, RES_META, SHOP_ORDER, TECH_DEFS, TUNE, TUTORIAL_STEPS, UPGRADE_DEFS,
} from './data';
import { effTime, updateConnections, updateProduction } from './engine';
import { Renderer } from './render';
import { applySave, estimateOffline, SaveManager } from './save';
import {
  canPay, costOf, createConnection, findNode, inputCapFor, invResources, isUnlocked,
  makeNode, newGame, nodeH, nodeUpgradeCost, ownedCount, pay, portPos, removeConnection,
  removeNode, storageCapacity, toEntries, validateConnection, NODE_W,
} from './state';
import type {
  FloatText, GameNode, GameState, NodeTypeId, Particle, Port, ResourceId, TechId, Toast,
  UISnapshot, UpgradeId,
} from './types';
import { YandexSDK } from '../sdk/YandexSDK';

type Drag =
  | { kind: 'pan'; lastX: number; lastY: number; midX: number; midY: number }
  | { kind: 'node'; id: string; dx: number; dy: number; moved: boolean }
  | { kind: 'conn'; fromPortId: string; x: number; y: number };

export class Game {
  state: GameState;
  camera = new Camera();
  audio = new AudioManager();
  private renderer = new Renderer();
  private saveMgr = new SaveManager();
  private sdk = new YandexSDK();
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;

  private raf = 0;
  private lastT = 0;
  private time = 0;
  private running = false;
  private dpr = 1;
  private w = 1;
  private h = 1;

  // interaction
  private drag: Drag | null = null;
  private pointers = new Map<number, { x: number; y: number }>();
  private pinchDist = 0;
  private keys = new Set<string>();
  private spaceDown = false;
  selectedId: string | null = null;
  ghostType: NodeTypeId | null = null;
  private ghostPos = { x: 0, y: 0 };
  private hoverPortId: string | null = null;
  private hoverConnId: string | null = null;

  // presentation transient
  private particles: Particle[] = [];
  private floats: FloatText[] = [];
  private toasts: Toast[] = [];
  private toastSeq = 0;
  private flowRate = 0;

  // ui sync
  private snapshot: UISnapshot;
  private listeners = new Set<() => void>();
  private uiTimer = 0;
  private saveTimer = 0;
  private saveTick = 0;

  shopOpen = typeof window !== 'undefined' && window.innerWidth > 900;
  helpOpen = false;
  private offlinePending: { data: number; credits: number; hours: number } | null = null;
  private showCoreModal = false;

  private boundKeyDown = (e: KeyboardEvent) => this.onKeyDown(e);
  private boundKeyUp = (e: KeyboardEvent) => this.onKeyUp(e);
  private boundResize = () => this.resize();
  private boundUnload = () => this.persist();
  private boundBlur = () => { this.keys.clear(); this.spaceDown = false; };

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D context unavailable');
    this.ctx = ctx;

    const saved = this.saveMgr.load();
    if (saved) {
      this.state = applySave(saved);
      const off = estimateOffline(saved);
      if ((off.data > 0 || off.credits > 0) && off.hours > 0.03) this.offlinePending = off;
    } else {
      this.state = newGame();
    }
    this.audio.setMuted(this.state.muted);
    this.camera.x = this.state.camX;
    this.camera.y = this.state.camY;
    this.camera.zoom = this.state.camZoom;

    this.resize();
    this.bindInput();
    this.snapshot = this.buildSnapshot();
    void this.sdk.init();
  }

  // ── lifecycle ──────────────────────────────────────────────────────────────

  start(): void {
    if (this.running) return;
    this.running = true;
    this.lastT = performance.now();
    this.raf = requestAnimationFrame(this.loop);
  }

  destroy(): void {
    this.running = false;
    cancelAnimationFrame(this.raf);
    this.unbindInput();
    this.persist();
  }

  private loop = (t: number): void => {
    if (!this.running) return;
    const dt = Math.min(0.1, Math.max(0, (t - this.lastT) / 1000));
    this.lastT = t;
    this.time += dt;
    this.update(dt);
    this.render();
    this.raf = requestAnimationFrame(this.loop);
  };

  private update(dt: number): void {
    // camera keys
    const sp = 520 * dt / this.camera.zoom;
    if (this.keys.has('w') || this.keys.has('arrowup')) this.camera.y -= sp;
    if (this.keys.has('s') || this.keys.has('arrowdown')) this.camera.y += sp;
    if (this.keys.has('a') || this.keys.has('arrowleft')) this.camera.x -= sp;
    if (this.keys.has('d') || this.keys.has('arrowright')) this.camera.x += sp;
    this.camera.clamp();

    // production
    updateProduction(this.state, dt, {
      onWallet: (res, amount, node) => {
        const color = RES_META[res].color;
        this.floats.push({
          x: node.x + NODE_W / 2, y: node.y - 8,
          text: '+' + amount + ' ' + (res === 'credits' ? 'CR' : 'DF'),
          color, life: 1.3,
        });
        if (this.floats.length > 30) this.floats.shift();
        if (res === 'fragment') this.audio.fragment();
        this.spawnParticles(node.x + NODE_W / 2, node.y + 10, color, 5);
      },
      onCycleDone: () => undefined,
    });

    // connections + packets
    const { delivered } = updateConnections(this.state, dt);
    if (dt > 0) this.flowRate += (delivered / dt - this.flowRate) * Math.min(1, dt * 2);

    // transient decay
    for (const n of this.state.nodes) {
      if (n.flash > 0) n.flash = Math.max(0, n.flash - dt * 2.2);
    }
    for (const p of this.particles) {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 1 - 3 * dt;
      p.vy *= 1 - 3 * dt;
    }
    this.particles = this.particles.filter((p) => p.life > 0);
    for (const f of this.floats) { f.life -= dt; f.y -= 26 * dt; }
    this.floats = this.floats.filter((f) => f.life > 0);
    const now = this.time;
    this.toasts = this.toasts.filter((t) => t.until > now);

    // tutorial
    this.checkTutorial();

    // main goal
    if (!this.state.coreOnline && this.state.fragments >= GOAL_FRAGMENTS) {
      this.state.coreOnline = true;
      this.showCoreModal = true;
      this.audio.goal();
      this.toast('ok', 'toast.core');
      this.spawnParticles(this.camera.x, this.camera.y, '#45e08c', 40);
      this.spawnParticles(this.camera.x, this.camera.y, '#ffd24a', 30);
      this.persist();
    }

    // autosave
    this.saveTimer += dt;
    if (this.saveTimer >= TUNE.autosaveSec) {
      this.saveTimer = 0;
      this.persist();
    }

    // ui sync
    this.uiTimer += dt;
    if (this.uiTimer >= 0.12) {
      this.uiTimer = 0;
      this.bump();
    }
  }

  private render(): void {
    const s = this.state;
    let dragConn: { fromPortId: string; x: number; y: number; targetPortId: string | null; valid: boolean } | null = null;
    if (this.drag?.kind === 'conn') {
      const target = this.portAt(this.drag.x, this.drag.y);
      let valid = false;
      if (target && target.port.dir === 'in') {
        valid = validateConnection(s, this.drag.fromPortId, target.port.id).ok;
      }
      dragConn = { fromPortId: this.drag.fromPortId, x: this.drag.x, y: this.drag.y, targetPortId: target?.port.id ?? null, valid };
    }
    this.renderer.draw(this.ctx, {
      state: s, camera: this.camera, time: this.time,
      selectedId: this.selectedId,
      hoverPortId: this.hoverPortId,
      hoverConnId: this.hoverConnId,
      ghost: this.ghostType ? { type: this.ghostType, x: this.ghostPos.x, y: this.ghostPos.y } : null,
      dragConn,
      particles: this.particles,
      floats: this.floats,
      w: this.w, h: this.h, dpr: this.dpr,
    });
  }

  // ── input ──────────────────────────────────────────────────────────────────

  private onPointerDown = (e: PointerEvent): void => {
    this.audio.unlock();
    if (e.button === 2) return;
    const rect = this.canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (this.pointers.size === 2) {
      const pts = [...this.pointers.values()];
      this.pinchDist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      this.drag = { kind: 'pan', lastX: e.clientX, lastY: e.clientY, midX: (pts[0].x + pts[1].x) / 2, midY: (pts[0].y + pts[1].y) / 2 };
      return;
    }

    if (e.button === 1 || this.spaceDown) {
      e.preventDefault();
      this.drag = { kind: 'pan', lastX: e.clientX, lastY: e.clientY, midX: e.clientX, midY: e.clientY };
      this.canvas.setPointerCapture(e.pointerId);
      return;
    }

    const world = this.camera.screenToWorld(sx, sy);

    if (this.ghostType) {
      this.place(world.x, world.y);
      this.canvas.setPointerCapture(e.pointerId);
      return;
    }

    const hit = this.portAt(world.x, world.y);
    if (hit) {
      if (hit.port.dir === 'out') {
        this.drag = { kind: 'conn', fromPortId: hit.port.id, x: world.x, y: world.y };
      } else {
        this.selectedId = hit.node.id;
      }
      this.canvas.setPointerCapture(e.pointerId);
      return;
    }

    const node = this.nodeAt(world.x, world.y);
    if (node) {
      this.selectedId = node.id;
      this.drag = { kind: 'node', id: node.id, dx: world.x - node.x, dy: world.y - node.y, moved: false };
    } else {
      this.selectedId = null;
      this.drag = { kind: 'pan', lastX: e.clientX, lastY: e.clientY, midX: e.clientX, midY: e.clientY };
    }
    this.canvas.setPointerCapture(e.pointerId);
    this.bump();
  };

  private onPointerMove = (e: PointerEvent): void => {
    const rect = this.canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    const world = this.camera.screenToWorld(sx, sy);
    if (this.pointers.has(e.pointerId)) this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    // pinch zoom + pan
    if (this.pointers.size === 2 && this.drag?.kind === 'pan') {
      const pts = [...this.pointers.values()];
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      const midX = (pts[0].x + pts[1].x) / 2;
      const midY = (pts[0].y + pts[1].y) / 2;
      if (this.pinchDist > 0 && dist > 0) {
        this.camera.zoomAt(midX - rect.left, midY - rect.top, dist / this.pinchDist);
      }
      this.pinchDist = dist;
      this.camera.pan(midX - this.drag.midX, midY - this.drag.midY);
      this.drag.midX = midX;
      this.drag.midY = midY;
      return;
    }

    if (!this.drag) {
      // hover feedback
      const p = this.portAt(world.x, world.y);
      this.hoverPortId = p?.port.id ?? null;
      this.hoverConnId = this.hoverPortId ? null : this.connectionAt(world.x, world.y);
      if (this.ghostType) this.ghostPos = { x: world.x - NODE_W / 2, y: world.y - nodeH(NODE_DEFS[this.ghostType]) / 2 };
      return;
    }

    if (this.drag.kind === 'pan') {
      this.camera.pan(e.clientX - this.drag.lastX, e.clientY - this.drag.lastY);
      this.drag.lastX = e.clientX;
      this.drag.lastY = e.clientY;
    } else if (this.drag.kind === 'node') {
      const node = findNode(this.state, this.drag.id);
      if (node) {
        const nx = world.x - this.drag.dx;
        const ny = world.y - this.drag.dy;
        if (Math.abs(nx - node.x) + Math.abs(ny - node.y) > 2) this.drag.moved = true;
        node.x = Math.max(-4000, Math.min(4000, nx));
        node.y = Math.max(-4000, Math.min(4000, ny));
      }
    } else if (this.drag.kind === 'conn') {
      this.drag.x = world.x;
      this.drag.y = world.y;
    }
  };

  private onPointerUp = (e: PointerEvent): void => {
    this.pointers.delete(e.pointerId);
    const rect = this.canvas.getBoundingClientRect();
    const world = this.camera.screenToWorld(e.clientX - rect.left, e.clientY - rect.top);
    const drag = this.drag;
    if (this.pointers.size < 2 && this.pinchDist > 0 && this.pointers.size > 0) {
      // remaining finger continues as pan anchor
      const rest = [...this.pointers.values()][0];
      this.drag = { kind: 'pan', lastX: rest.x, lastY: rest.y, midX: rest.x, midY: rest.y };
      this.pinchDist = 0;
      return;
    }
    this.pinchDist = 0;
    this.drag = null;

    if (!drag) return;
    if (drag.kind === 'node') {
      if (drag.moved) this.persist();
    } else if (drag.kind === 'conn') {
      const target = this.portAt(world.x, world.y);
      if (target && target.port.dir === 'in') {
        const v = validateConnection(this.state, drag.fromPortId, target.port.id);
        if (v.ok) {
          createConnection(this.state, drag.fromPortId, target.port.id);
          this.audio.connect();
          this.toast('ok', 'toast.conn');
          const pos = portPos(target.node, target.port);
          this.spawnParticles(pos.x, pos.y, '#45e08c', 10);
          const src = findNode(this.state, drag.fromPortId.split('|')[0]);
          if (src) { src.flash = 1; src.flashColor = '#45e08c'; }
          target.node.flash = 1;
          target.node.flashColor = '#45e08c';
          this.persist();
        } else {
          this.audio.error();
          this.toast('err', v.reason);
          this.spawnParticles(world.x, world.y, '#ff5d5d', 8);
        }
      }
      this.bump();
    }
  };

  private onContextMenu = (e: MouseEvent): void => {
    e.preventDefault();
    const rect = this.canvas.getBoundingClientRect();
    const world = this.camera.screenToWorld(e.clientX - rect.left, e.clientY - rect.top);

    if (this.ghostType) { this.cancelPlacement(); return; }
    if (this.drag?.kind === 'conn') { this.drag = null; return; }

    const node = this.nodeAt(world.x, world.y);
    if (node) {
      this.deleteNodeById(node.id);
      return;
    }
    const connId = this.connectionAt(world.x, world.y);
    if (connId) {
      removeConnection(this.state, connId);
      this.audio.remove();
      this.spawnParticles(world.x, world.y, '#ff5d5d', 8);
      this.persist();
      this.bump();
    }
  };

  private onWheel = (e: WheelEvent): void => {
    e.preventDefault();
    const rect = this.canvas.getBoundingClientRect();
    const factor = Math.exp(-e.deltaY * 0.0012);
    this.camera.zoomAt(e.clientX - rect.left, e.clientY - rect.top, factor);
  };

  private onKeyDown(e: KeyboardEvent): void {
    const k = e.key.toLowerCase();
    if (k === ' ') { this.spaceDown = true; e.preventDefault(); return; }
    if (k === 'escape') {
      if (this.ghostType) this.cancelPlacement();
      else if (this.drag?.kind === 'conn') this.drag = null;
      else if (this.helpOpen) this.helpOpen = false;
      else this.selectedId = null;
      this.bump();
      return;
    }
    if ((k === 'delete' || k === 'backspace') && this.selectedId) {
      this.deleteNodeById(this.selectedId);
      return;
    }
    this.keys.add(k);
  }

  private onKeyUp(e: KeyboardEvent): void {
    const k = e.key.toLowerCase();
    if (k === ' ') this.spaceDown = false;
    this.keys.delete(k);
  }

  private bindInput(): void {
    const c = this.canvas;
    c.addEventListener('pointerdown', this.onPointerDown);
    c.addEventListener('pointermove', this.onPointerMove);
    c.addEventListener('pointerup', this.onPointerUp);
    c.addEventListener('pointercancel', this.onPointerUp);
    c.addEventListener('contextmenu', this.onContextMenu);
    c.addEventListener('wheel', this.onWheel, { passive: false });
    window.addEventListener('keydown', this.boundKeyDown);
    window.addEventListener('keyup', this.boundKeyUp);
    window.addEventListener('resize', this.boundResize);
    window.addEventListener('beforeunload', this.boundUnload);
    window.addEventListener('blur', this.boundBlur);
  }

  private unbindInput(): void {
    const c = this.canvas;
    c.removeEventListener('pointerdown', this.onPointerDown);
    c.removeEventListener('pointermove', this.onPointerMove);
    c.removeEventListener('pointerup', this.onPointerUp);
    c.removeEventListener('pointercancel', this.onPointerUp);
    c.removeEventListener('contextmenu', this.onContextMenu);
    c.removeEventListener('wheel', this.onWheel);
    window.removeEventListener('keydown', this.boundKeyDown);
    window.removeEventListener('keyup', this.boundKeyUp);
    window.removeEventListener('resize', this.boundResize);
    window.removeEventListener('beforeunload', this.boundUnload);
    window.removeEventListener('blur', this.boundBlur);
  }

  // ── hit tests (world coords) ───────────────────────────────────────────────

  private nodeAt(wx: number, wy: number): GameNode | null {
    for (let i = this.state.nodes.length - 1; i >= 0; i--) {
      const n = this.state.nodes[i];
      const h = nodeH(NODE_DEFS[n.type]);
      if (wx >= n.x - 4 && wx <= n.x + NODE_W + 4 && wy >= n.y - 4 && wy <= n.y + h + 4) return n;
    }
    return null;
  }

  private portAt(wx: number, wy: number): { port: Port; node: GameNode } | null {
    const radius = Math.max(13, 13 / this.camera.zoom);
    let best: { port: Port; node: GameNode; d: number } | null = null;
    for (const n of this.state.nodes) {
      for (const p of n.ports) {
        const pos = portPos(n, p);
        const d = Math.hypot(wx - pos.x, wy - pos.y);
        if (d <= radius && (!best || d < best.d)) best = { port: p, node: n, d };
      }
    }
    return best ? { port: best.port, node: best.node } : null;
  }

  private connectionAt(wx: number, wy: number): string | null {
    const threshold = Math.max(8, 9 / this.camera.zoom);
    for (const conn of this.state.connections) {
      const fromNode = findNode(this.state, conn.fromPort.split('|')[0]);
      const toNode = findNode(this.state, conn.toPort.split('|')[0]);
      if (!fromNode || !toNode) continue;
      const fp = fromNode.ports.find((p) => p.id === conn.fromPort);
      const tp = toNode.ports.find((p) => p.id === conn.toPort);
      if (!fp || !tp) continue;
      const a = portPos(fromNode, fp);
      const b = portPos(toNode, tp);
      const dx = Math.max(46, Math.abs(b.x - a.x) * 0.5);
      for (let i = 1; i <= 14; i++) {
        const t = i / 15;
        const u = 1 - t;
        const x = u * u * u * a.x + 3 * u * u * t * (a.x + dx) + 3 * u * t * t * (b.x - dx) + t * t * t * b.x;
        const y = u * u * u * a.y + 3 * u * u * t * a.y + 3 * u * t * t * b.y + t * t * t * b.y;
        if (Math.hypot(wx - x, wy - y) <= threshold) return conn.id;
      }
    }
    return null;
  }

  // ── actions ────────────────────────────────────────────────────────────────

  buyFromShop(type: NodeTypeId): void {
    const def = NODE_DEFS[type];
    if (!isUnlocked(this.state, def)) return;
    const cost = costOf(def, ownedCount(this.state, type));
    if (!canPay(this.state.wallet, cost)) {
      this.toast('err', 'toast.notEnough');
      this.audio.error();
      return;
    }
    this.ghostType = type;
    const c = this.camera.screenToWorld(this.w / 2, this.h / 2);
    this.ghostPos = { x: c.x - NODE_W / 2, y: c.y - nodeH(def) / 2 };
    this.selectedId = null;
    this.audio.buy();
    if (window.innerWidth < 900) this.shopOpen = false;
    this.bump();
  }

  private place(wx: number, wy: number): void {
    const type = this.ghostType;
    if (!type) return;
    const def = NODE_DEFS[type];
    const cost = costOf(def, ownedCount(this.state, type));
    if (!canPay(this.state.wallet, cost)) {
      this.toast('err', 'toast.notEnough');
      this.audio.error();
      this.ghostType = null;
      this.bump();
      return;
    }
    pay(this.state.wallet, cost);
    const x = Math.max(-4000, Math.min(4000, wx - NODE_W / 2));
    const y = Math.max(-4000, Math.min(4000, wy - nodeH(def) / 2));
    const node = makeNode(this.state, type, x, y);
    node.flash = 1;
    node.flashColor = '#3fc1ff';
    this.selectedId = node.id;
    this.state.stats.placed++;
    this.audio.place();
    this.spawnParticles(x + NODE_W / 2, y + nodeH(def) / 2, '#3fc1ff', 12);
    const stillAfford = canPay(this.state.wallet, costOf(def, ownedCount(this.state, type)));
    if (!stillAfford) this.ghostType = null;
    this.persist();
    this.bump();
  }

  cancelPlacement(): void {
    this.ghostType = null;
    this.bump();
  }

  deleteNodeById(id: string): void {
    const node = findNode(this.state, id);
    if (!node) return;
    const cx = node.x + NODE_W / 2;
    const cy = node.y + nodeH(NODE_DEFS[node.type]) / 2;
    removeNode(this.state, id);
    if (this.selectedId === id) this.selectedId = null;
    this.audio.remove();
    this.spawnParticles(cx, cy, '#ff5d5d', 14);
    this.persist();
    this.bump();
  }

  upgradeNode(id: string): void {
    const node = findNode(this.state, id);
    if (!node || node.level >= TUNE.nodeMaxLevel) return;
    const cost = nodeUpgradeCost(node);
    const partial: Partial<Record<ResourceId, number>> = { [cost.res]: cost.amount };
    if (!canPay(this.state.wallet, partial)) {
      this.toast('err', 'toast.notEnough');
      this.audio.error();
      return;
    }
    pay(this.state.wallet, partial);
    node.level++;
    node.flash = 1;
    node.flashColor = '#ffb02e';
    this.audio.upgrade();
    this.toast('ok', 'toast.nodeUpg');
    this.spawnParticles(node.x + NODE_W / 2, node.y + 20, '#ffb02e', 12);
    this.persist();
    this.bump();
  }

  unlockTech(id: TechId): void {
    const def = TECH_DEFS.find((t) => t.id === id);
    if (!def || this.state.techs.includes(id)) return;
    if (!canPay(this.state.wallet, def.cost)) {
      this.toast('err', 'toast.notEnough');
      this.audio.error();
      return;
    }
    pay(this.state.wallet, def.cost);
    this.state.techs.push(id);
    this.audio.tech();
    this.toast('ok', 'toast.tech');
    this.persist();
    this.bump();
  }

  buyUpgrade(id: UpgradeId): void {
    const def = UPGRADE_DEFS.find((u) => u.id === id);
    if (!def) return;
    const level = this.state.upgrades[id];
    if (level >= def.max) return;
    const cost = def.cost(level);
    if (!canPay(this.state.wallet, cost)) {
      this.toast('err', 'toast.notEnough');
      this.audio.error();
      return;
    }
    pay(this.state.wallet, cost);
    this.state.upgrades[id] = level + 1;
    this.audio.upgrade();
    this.toast('ok', 'toast.upg');
    this.persist();
    this.bump();
  }

  collectOffline(): void {
    if (!this.offlinePending) return;
    this.state.wallet.data += this.offlinePending.data;
    this.state.wallet.credits += this.offlinePending.credits;
    this.audio.buy();
    this.offlinePending = null;
    this.persist();
    this.bump();
  }

  resetGame(): void {
    this.saveMgr.clear();
    this.state = newGame();
    this.selectedId = null;
    this.ghostType = null;
    this.offlinePending = null;
    this.showCoreModal = false;
    this.flowRate = 0;
    this.particles = [];
    this.floats = [];
    this.camera.x = this.state.camX;
    this.camera.y = this.state.camY;
    this.camera.zoom = this.state.camZoom;
    this.toast('info', 'toast.reset');
    this.persist();
    this.bump();
  }

  toggleMute(): void {
    this.state.muted = !this.state.muted;
    this.audio.setMuted(this.state.muted);
    this.persist();
    this.bump();
  }

  setLang(lang: 'ru' | 'en'): void {
    this.state.lang = lang;
    this.persist();
    this.bump();
  }

  setShopOpen(open: boolean): void { this.shopOpen = open; this.bump(); }
  setHelpOpen(open: boolean): void { this.helpOpen = open; this.bump(); }
  closeCoreModal(): void { this.showCoreModal = false; this.bump(); }

  skipTutorial(): void {
    this.state.tutorialStep = -1;
    this.persist();
    this.bump();
  }

  private checkTutorial(): void {
    const step = this.state.tutorialStep;
    if (step < 0) return;
    const s = this.state;
    let done = false;
    if (step === 0) done = s.nodes.some((n) => n.type === 'storage' && (n.inv.data ?? 0) >= 4);
    else if (step === 1) done = ownedCount(s, 'relay') >= 2;
    else if (step === 2) done = s.connections.length >= 2;
    else if (step === 3) done = ownedCount(s, 'router') >= 1;
    else if (step === 4) done = ownedCount(s, 'processor') >= 1;
    if (done) {
      if (step >= TUTORIAL_STEPS.length - 1) {
        s.tutorialStep = -1;
        this.toast('ok', 'toast.tutDone');
        this.audio.tech();
      } else {
        s.tutorialStep = step + 1;
        this.audio.buy();
      }
      this.bump();
    }
  }

  // ── persistence ────────────────────────────────────────────────────────────

  private persist(): void {
    this.state.camX = this.camera.x;
    this.state.camY = this.camera.y;
    this.state.camZoom = this.camera.zoom;
    if (this.saveMgr.save(this.state)) {
      this.saveTick++;
      void this.sdk.saveGame('netforge');
    }
  }

  // ── fx helpers ─────────────────────────────────────────────────────────────

  private spawnParticles(x: number, y: number, color: string, n: number): void {
    if (this.particles.length > 240) return;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 40 + Math.random() * 120;
      this.particles.push({
        x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        life: 0.4 + Math.random() * 0.5, max: 0.9, color,
        size: 2 + Math.random() * 3,
      });
    }
  }

  private toast(kind: Toast['kind'], textKey: string): void {
    this.toasts.push({ id: this.toastSeq++, kind, textKey, until: this.time + 2.6 });
    if (this.toasts.length > 4) this.toasts.shift();
    this.bump();
  }

  // ── UI snapshot ────────────────────────────────────────────────────────────

  subscribe = (fn: () => void): (() => void) => {
    this.listeners.add(fn);
    return () => { this.listeners.delete(fn); };
  };

  getSnapshot = (): UISnapshot => this.snapshot;

  private bump(): void {
    this.snapshot = this.buildSnapshot();
    this.listeners.forEach((fn) => fn());
  }

  private buildSnapshot(): UISnapshot {
    const s = this.state;
    const shop = SHOP_ORDER.map((id) => {
      const def = NODE_DEFS[id];
      const cost = costOf(def, ownedCount(s, id));
      return {
        id, nameKey: def.nameKey, descKey: def.descKey,
        cost: toEntries(cost),
        afford: canPay(s.wallet, cost),
        unlocked: isUnlocked(s, def),
        owned: ownedCount(s, id),
      };
    });
    const techs = TECH_DEFS.map((t) => ({
      id: t.id, nameKey: t.nameKey, descKey: t.descKey,
      cost: toEntries(t.cost),
      afford: canPay(s.wallet, t.cost),
      unlocked: s.techs.includes(t.id),
      unlocksKeys: t.unlocks.map((u) => NODE_DEFS[u].nameKey),
    }));
    const upgrades = UPGRADE_DEFS.map((u) => {
      const level = s.upgrades[u.id];
      const maxed = level >= u.max;
      const cost = maxed ? {} : u.cost(level);
      return {
        id: u.id, nameKey: u.nameKey, descKey: u.descKey,
        level, max: u.max, cost: toEntries(cost), afford: !maxed && canPay(s.wallet, cost),
      };
    });

    let selected: UISnapshot['selected'] = null;
    const node = this.selectedId ? findNode(s, this.selectedId) : null;
    if (node) {
      const def = NODE_DEFS[node.type];
      const bars = invResources(def).map((res) => ({
        res,
        cur: node.inv[res] ?? 0,
        cap: def.category === 'storage' ? storageCapacity(s) : inputCapFor(s, node, res),
      }));
      const t = effTime(s, node);
      const uc = nodeUpgradeCost(node);
      selected = {
        id: node.id, type: node.type, nameKey: def.nameKey, level: node.level,
        statusKey: 'st.' + node.status,
        bars,
        recipe: def.recipe ? { inputs: def.recipe.inputs, outputs: def.recipe.outputs, time: t } : null,
        rateLine: def.category === 'generator' && def.recipe
          ? { qty: def.recipe.outputs[0].amount * (1 + TUNE.nodeQtyPerLevel * (node.level - 1)), time: t }
          : null,
        upgradeCost: uc,
        canUpgrade: node.level < TUNE.nodeMaxLevel && canPay(s.wallet, { [uc.res]: uc.amount }),
        maxed: node.level >= TUNE.nodeMaxLevel,
      };
    }

    return {
      v: (this.snapshot?.v ?? 0) + 1,
      lang: s.lang, muted: s.muted,
      data: s.wallet.data, credits: s.wallet.credits, fragments: s.fragments,
      coreOnline: s.coreOnline, showCoreModal: this.showCoreModal,
      nodeCount: s.nodes.length, connCount: s.connections.length,
      flowRate: this.flowRate,
      selected,
      placement: this.ghostType,
      shop, techs, upgrades,
      tutorial: s.tutorialStep >= 0 && s.tutorialStep < TUTORIAL_STEPS.length
        ? { index: s.tutorialStep, total: TUTORIAL_STEPS.length, textKey: TUTORIAL_STEPS[s.tutorialStep].textKey }
        : null,
      offline: this.offlinePending,
      toasts: [...this.toasts],
      saveTick: this.saveTick,
      shopOpen: this.shopOpen,
      helpOpen: this.helpOpen,
    };
  }

  private resize(): void {
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.w = window.innerWidth;
    this.h = window.innerHeight;
    this.canvas.width = Math.round(this.w * this.dpr);
    this.canvas.height = Math.round(this.h * this.dpr);
    this.canvas.style.width = this.w + 'px';
    this.canvas.style.height = this.h + 'px';
    this.camera.setViewport(this.w, this.h);
  }
}



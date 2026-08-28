import type { Camera } from './camera';
import { NODE_DEFS, RES_META, TUNE, fmt, fmtRate, tr } from './data';
import { drawNodeIcon } from './icons';
import { NODE_W, inputCapFor, invResources, nodeH, portPos, storageCapFor } from './state';
import type {
  FloatText, Flyer, GameNode, GameState, NodeTypeId, Particle,
} from './types';

export interface RenderView {
  state: GameState;
  camera: Camera;
  time: number;
  selectedId: string | null;
  hoverPortId: string | null;
  hoverConnId: string | null;
  ghost: { type: NodeTypeId; x: number; y: number } | null;
  dragConn: { fromPortId: string; x: number; y: number; targetPortId: string | null; valid: boolean; reasonKey: string | null } | null;
  particles: Particle[];
  floats: FloatText[];
  flyers: Flyer[];
  hudTargets: Partial<Record<Flyer['res'], { x: number; y: number }>>;
  tip: { x: number; y: number; alpha: number } | null;
  w: number;
  h: number;
  dpr: number;
  gridOn: boolean;
}

const STATUS_COLOR: Record<string, string> = {
  online: '#45e08c', idle: '#5c6b7f', waiting: '#ffb02e', full: '#ff5d5d',
};

function cubic(p0: number, p1: number, p2: number, p3: number, t: number): number {
  const u = 1 - t;
  return u * u * u * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t * p3;
}

export class Renderer {
  draw(ctx: CanvasRenderingContext2D, v: RenderView): void {
    const { state, camera } = v;
    ctx.setTransform(v.dpr, 0, 0, v.dpr, 0, 0);
    ctx.fillStyle = '#0f141a';
    ctx.fillRect(0, 0, v.w, v.h);

    // world transform
    const z = camera.zoom;
    ctx.setTransform(v.dpr * z, 0, 0, v.dpr * z, v.dpr * (v.w / 2 - camera.x * z), v.dpr * (v.h / 2 - camera.y * z));

    this.drawGrid(ctx, v);

    // connections under nodes
    for (const conn of state.connections) {
      this.drawConnection(ctx, v, conn.id);
    }

    for (const node of state.nodes) {
      if (node.id !== v.selectedId) this.drawNode(ctx, v, node, false);
    }
    const sel = state.nodes.find((n) => n.id === v.selectedId);
    if (sel) this.drawNode(ctx, v, sel, true);

    if (v.ghost) this.drawGhost(ctx, v, v.ghost.type, v.ghost.x, v.ghost.y);
    if (v.dragConn) this.drawPreview(ctx, v);

    this.drawParticles(ctx, v);
    this.drawFloats(ctx, v);

    ctx.setTransform(v.dpr, 0, 0, v.dpr, 0, 0);
    this.drawScreenOverlay(ctx, v);
  }

  // ── screen-space layer: reason labels, storage tip balloon, HUD flyers ─────
  private drawScreenOverlay(ctx: CanvasRenderingContext2D, v: RenderView): void {
    const cam = v.camera;

    // drag rejection reason at cursor (contextual hint)
    if (v.dragConn && v.dragConn.reasonKey) {
      const p = cam.worldToScreen(v.dragConn.x, v.dragConn.y);
      const text = tr(v.state.lang, v.dragConn.reasonKey);
      ctx.font = '700 11px Rajdhani, sans-serif';
      const w = ctx.measureText(text).width + 14;
      const x = Math.min(v.w - w - 6, p.x + 16);
      const y = Math.max(6, p.y - 30);
      ctx.fillStyle = 'rgba(40,16,20,0.92)';
      ctx.fillRect(x, y, w, 20);
      ctx.strokeStyle = '#ff5d5d';
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 0.5, y + 0.5, w - 1, 19);
      ctx.fillStyle = '#ff9d9d';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, x + 7, y + 10.5);
    }

    // one-time storage explanation balloon
    if (v.tip) {
      const p = cam.worldToScreen(v.tip.x, v.tip.y);
      const text = tr(v.state.lang, 'tip.storage');
      ctx.font = '500 11px "IBM Plex Mono", monospace';
      const maxW = 230;
      const words = text.split(' ');
      const lines: string[] = [];
      let cur = '';
      for (const wd of words) {
        const t = cur ? cur + ' ' + wd : wd;
        if (ctx.measureText(t).width > maxW && cur) { lines.push(cur); cur = wd; }
        else cur = t;
      }
      if (cur) lines.push(cur);
      const bw = Math.min(260, Math.max(...lines.map((l) => ctx.measureText(l).width)) + 20);
      const bh = lines.length * 15 + 16;
      const bx = Math.max(8, Math.min(v.w - bw - 8, p.x - bw / 2));
      const by = Math.max(8, p.y - bh - 12);
      ctx.globalAlpha = v.tip.alpha;
      ctx.fillStyle = 'rgba(16,24,34,0.96)';
      ctx.fillRect(bx, by, bw, bh);
      ctx.strokeStyle = '#3fc1ff';
      ctx.lineWidth = 1;
      ctx.strokeRect(bx + 0.5, by + 0.5, bw - 1, bh - 1);
      // pointer
      const px = Math.max(bx + 12, Math.min(bx + bw - 12, p.x));
      ctx.beginPath();
      ctx.moveTo(px - 6, by + bh);
      ctx.lineTo(px, by + bh + 8);
      ctx.lineTo(px + 6, by + bh);
      ctx.closePath();
      ctx.fillStyle = 'rgba(16,24,34,0.96)';
      ctx.fill();
      ctx.strokeStyle = '#3fc1ff';
      ctx.beginPath();
      ctx.moveTo(px - 6, by + bh); ctx.lineTo(px, by + bh + 8); ctx.lineTo(px + 6, by + bh);
      ctx.stroke();
      ctx.fillStyle = '#cfe4f7';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      lines.forEach((l, i) => ctx.fillText(l, bx + 10, by + 8 + i * 15));
      ctx.globalAlpha = 1;
    }

    // resource flyers: node → HUD chip
    for (const fl of v.flyers) {
      const target = v.hudTargets[fl.res];
      if (!target) continue;
      const start = cam.worldToScreen(fl.wx, fl.wy);
      const t = fl.t;
      const e = t * t * (3 - 2 * t); // smoothstep
      const x = start.x + (target.x - start.x) * e;
      const y = start.y + (target.y - start.y) * e - Math.sin(t * Math.PI) * 26;
      const color = RES_META[fl.res].color;
      ctx.globalAlpha = 1 - t * t;
      ctx.fillStyle = color;
      ctx.fillRect(x - 3.5, y - 3.5, 7, 7);
      ctx.globalAlpha = (1 - t) * 0.35;
      ctx.fillRect(x - 6, y - 6, 12, 12);
      ctx.globalAlpha = 1;
    }
    ctx.textBaseline = 'alphabetic';
  }

  // ── grid ───────────────────────────────────────────────────────────────────
  private drawGrid(ctx: CanvasRenderingContext2D, v: RenderView): void {
    if (!v.gridOn) return;
    const cam = v.camera;
    const tl = cam.screenToWorld(0, 0);
    const br = cam.screenToWorld(v.w, v.h);
    const step = 40;
    const major = 200;
    ctx.lineWidth = 1 / cam.zoom;

    if (cam.zoom > 0.55) {
      ctx.strokeStyle = 'rgba(64,84,108,0.10)';
      ctx.beginPath();
      for (let x = Math.floor(tl.x / step) * step; x <= br.x; x += step) { ctx.moveTo(x, tl.y); ctx.lineTo(x, br.y); }
      for (let y = Math.floor(tl.y / step) * step; y <= br.y; y += step) { ctx.moveTo(tl.x, y); ctx.lineTo(br.x, y); }
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(84,110,140,0.16)';
    ctx.beginPath();
    for (let x = Math.floor(tl.x / major) * major; x <= br.x; x += major) { ctx.moveTo(x, tl.y); ctx.lineTo(x, br.y); }
    for (let y = Math.floor(tl.y / major) * major; y <= br.y; y += major) { ctx.moveTo(tl.x, y); ctx.lineTo(br.x, y); }
    ctx.stroke();

    // sparse cross markers
    ctx.strokeStyle = 'rgba(120,150,185,0.22)';
    ctx.beginPath();
    for (let x = Math.floor(tl.x / major) * major; x <= br.x; x += major) {
      for (let y = Math.floor(tl.y / major) * major; y <= br.y; y += major) {
        ctx.moveTo(x - 5, y); ctx.lineTo(x + 5, y);
        ctx.moveTo(x, y - 5); ctx.lineTo(x, y + 5);
      }
    }
    ctx.stroke();
  }

  private connGeometry(v: RenderView, connId: string) {
    const conn = v.state.connections.find((c) => c.id === connId)!;
    const from = conn.fromPort.split('|')[0];
    const to = conn.toPort.split('|')[0];
    const nFrom = v.state.nodes.find((n) => n.id === from);
    const nTo = v.state.nodes.find((n) => n.id === to);
    if (!nFrom || !nTo) return null;
    const pFrom = nFrom.ports.find((p) => p.id === conn.fromPort);
    const pTo = nTo.ports.find((p) => p.id === conn.toPort);
    if (!pFrom || !pTo) return null;
    const a = portPos(nFrom, pFrom);
    const b = portPos(nTo, pTo);
    const dx = Math.max(46, Math.abs(b.x - a.x) * 0.5);
    return { conn, a, b, c1x: a.x + dx, c1y: a.y, c2x: b.x - dx, c2y: b.y, res: pFrom.resource };
  }

  private drawConnection(ctx: CanvasRenderingContext2D, v: RenderView, connId: string): void {
    const g = this.connGeometry(v, connId);
    if (!g) return;
    const color = RES_META[g.res].color;
    const active = g.conn.packets.length > 0;
    const hovered = v.hoverConnId === connId;

    if (active) {
      ctx.strokeStyle = color;
      ctx.globalAlpha = 0.14;
      ctx.lineWidth = 5;
      this.strokeConn(ctx, g);
      ctx.globalAlpha = 1;
    }
    ctx.strokeStyle = hovered ? '#8fb0d4' : g.conn.throttled ? '#8a6a3a' : '#334254';
    ctx.lineWidth = hovered ? 3 : 2;
    this.strokeConn(ctx, g);

    // chevron showing direction
    const mx = cubic(g.a.x, g.c1x, g.c2x, g.b.x, 0.5);
    const my = cubic(g.a.y, g.c1y, g.c2y, g.b.y, 0.5);
    const tx = cubic(g.a.x, g.c1x, g.c2x, g.b.x, 0.52) - mx;
    const ty = cubic(g.a.y, g.c1y, g.c2y, g.b.y, 0.52) - my;
    const ang = Math.atan2(ty, tx);
    ctx.save();
    ctx.translate(mx, my);
    ctx.rotate(ang);
    ctx.fillStyle = color;
    ctx.globalAlpha = active ? 0.85 : 0.3;
    ctx.beginPath();
    ctx.moveTo(5, 0); ctx.lineTo(-3, -4); ctx.lineTo(-3, 4);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.globalAlpha = 1;

    // packets
    for (const p of g.conn.packets) {
      const t = Math.min(1, p.t);
      const px = cubic(g.a.x, g.c1x, g.c2x, g.b.x, t);
      const py = cubic(g.a.y, g.c1y, g.c2y, g.b.y, t);
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.28;
      ctx.fillRect(px - 5, py - 5, 10, 10);
      ctx.globalAlpha = 1;
      ctx.fillRect(px - 3, py - 3, 6, 6);
      ctx.fillStyle = '#0f141a';
      ctx.fillRect(px - 1, py - 1, 2, 2);
    }
  }

  private strokeConn(ctx: CanvasRenderingContext2D, g: NonNullable<ReturnType<Renderer['connGeometry']>>): void {
    ctx.beginPath();
    ctx.moveTo(g.a.x, g.a.y);
    ctx.bezierCurveTo(g.c1x, g.c1y, g.c2x, g.c2y, g.b.x, g.b.y);
    ctx.stroke();
  }

  // ── nodes ──────────────────────────────────────────────────────────────────
  private drawNode(ctx: CanvasRenderingContext2D, v: RenderView, node: GameNode, selected: boolean): void {
    const def = NODE_DEFS[node.type];
    const w = NODE_W;
    const h = nodeH(def);
    const x = node.x;
    const y = node.y;

    ctx.fillStyle = 'rgba(6,9,13,0.5)';
    ctx.fillRect(x + 3, y + 4, w, h);
    ctx.fillStyle = '#1a222d';
    ctx.fillRect(x, y, w, h);

    // header
    ctx.fillStyle = selected ? '#253345' : '#212c39';
    ctx.fillRect(x, y, w, 26);
    ctx.fillStyle = '#31405266';
    ctx.fillStyle = '#2b3948';
    ctx.fillRect(x, y + 25, w, 1);

    ctx.fillStyle = '#d5e1ef';
    ctx.font = '700 11px Rajdhani, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    const bp = node.blueprintId ? v.state.blueprints.find((b) => b.id === node.blueprintId) : undefined;
    const name = bp ? bp.name : tr(v.state.lang, def.nameKey);
    if (bp) {
      ctx.fillStyle = bp.color;
      ctx.fillRect(x, y, 3, h);
      ctx.fillStyle = bp.color;
    }
    ctx.fillText(name, x + 8, y + 13.5, w - 70);
    ctx.fillStyle = '#d5e1ef';
    if (node.level > 1) {
      ctx.fillStyle = '#ffb02e';
      ctx.font = '700 9px Rajdhani, sans-serif';
      ctx.fillText('L' + node.level, x + 8 + Math.min(ctx.measureText(name).width, w - 78) + 6, y + 13);
    }

    // status LED + label
    const sc = STATUS_COLOR[node.status];
    ctx.font = '600 7px Rajdhani, sans-serif';
    ctx.fillStyle = sc;
    const stLabel = tr(v.state.lang, 'st.' + node.status);
    ctx.textAlign = 'right';
    ctx.fillText(stLabel, x + w - 18, y + 13.5);
    ctx.textAlign = 'left';
    const pulse = node.status === 'online' ? 0.55 + 0.45 * Math.sin(v.time * 4 + node.x) : 1;
    ctx.globalAlpha = pulse;
    ctx.fillStyle = sc;
    ctx.beginPath();
    ctx.arc(x + w - 10, y + 13, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    // cause icon for problem statuses (P6: reason visible without codex)
    if (node.status === 'waiting' || node.status === 'full') {
      const ix = x + w - 64;
      const iy = y + 13;
      ctx.strokeStyle = sc;
      ctx.lineWidth = 1.3;
      if (node.status === 'waiting') {
        // broken chain
        ctx.beginPath();
        ctx.arc(ix - 3.5, iy, 3, Math.PI * 0.25, Math.PI * 1.75);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(ix + 4.5, iy, 3, Math.PI * 1.25, Math.PI * 0.75);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(ix - 1.5, iy - 2.5); ctx.lineTo(ix + 1.5, iy + 2.5);
        ctx.stroke();
      } else {
        // overflowing container
        ctx.strokeRect(ix - 4, iy - 1, 8, 5);
        ctx.beginPath();
        ctx.moveTo(ix, iy - 6.5); ctx.lineTo(ix, iy - 3);
        ctx.moveTo(ix - 2, iy - 5); ctx.lineTo(ix, iy - 7); ctx.lineTo(ix + 2, iy - 5);
        ctx.stroke();
      }
    }

    // icon
    this.drawIcon(ctx, node.type, x + 24, y + 52);

    // inventory bars
    const bars = invResources(def);
    let by = y + 38;
    for (const res of bars) {
      const cur = node.inv[res] ?? 0;
      const cap = def.category === 'storage'
        ? storageCapFor(v.state, node)
        : inputCapFor(v.state, node, res) || def.capacity;
      const meta = RES_META[res];
      ctx.fillStyle = '#7d8ca0';
      ctx.font = '500 8px "IBM Plex Mono", monospace';
      ctx.fillText(tr(v.state.lang, meta.nameKey), x + 46, by + 4, w - 100);
      ctx.textAlign = 'right';
      ctx.fillStyle = '#a9bad0';
      ctx.fillText(`${fmt(cur)}/${fmt(cap)}`, x + w - 10, by + 4);
      ctx.textAlign = 'left';
      const bw = w - 56;
      ctx.fillStyle = '#10161d';
      ctx.fillRect(x + 46, by + 8, bw, 4);
      ctx.fillStyle = meta.color;
      ctx.globalAlpha = 0.85;
      ctx.fillRect(x + 46, by + 8, bw * Math.min(1, cur / Math.max(1, cap)), 4);
      ctx.globalAlpha = 1;
      by += 18;
    }

    // production progress
    if (def.recipe && (def.category === 'generator' || def.category === 'processor')) {
      const time = def.recipe.time;
      const frac = Math.min(1, node.prod / time);
      const py = y + h - 20;
      ctx.fillStyle = '#10161d';
      ctx.fillRect(x + 10, py, w - 20, 6);
      let fill = def.category === 'generator' ? '#3fc1ff' : '#ffb02e';
      if (node.status === 'full') fill = '#ff5d5d';
      if (node.status === 'waiting') fill = '#5c6b7f';
      ctx.fillStyle = fill;
      ctx.fillRect(x + 10, py, (w - 20) * frac, 6);
      ctx.strokeStyle = '#2b3948';
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 10.5, py + 0.5, w - 21, 6);
    }

    // storage → reserve live indicator (P1: visible cause & effect).
    // Only data-storage drains into the wallet reserve.
    if (def.category === 'storage' && def.inputs[0] === 'data') {
      const cap = storageCapFor(v.state, node);
      const fill = node.inv.data ?? 0;
      const lvlDrain = 1 + TUNE.nodeDrainPerLevel * (node.level - 1);
      const rate = TUNE.storageDrainMax * lvlDrain * Math.pow(Math.max(0, fill) / cap, TUNE.storageDrainExp);
      const py = y + h - 19;
      const pulse = 0.45 + 0.4 * Math.sin(v.time * 5);
      ctx.fillStyle = '#3fc1ff';
      for (let i = 0; i < 3; i++) {
        ctx.globalAlpha = rate > 0.02 ? (0.25 + 0.6 * pulse) * (1 - i * 0.25) : 0.18;
        const cx0 = x + 14 + i * 6;
        ctx.beginPath();
        ctx.moveTo(cx0 - 2, py - 3);
        ctx.lineTo(cx0 + 1, py);
        ctx.lineTo(cx0 - 2, py + 3);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      ctx.font = '600 8px "IBM Plex Mono", monospace';
      ctx.fillStyle = rate > 0.02 ? '#7fd4ff' : '#5c6b7f';
      ctx.textAlign = 'left';
      ctx.fillText(`+${fmtRate(rate)}/s`, x + 34, py + 3);
      ctx.fillStyle = '#5c6b7f';
      ctx.textAlign = 'right';
      ctx.fillText('→ ' + tr(v.state.lang, 'node.reserve'), x + w - 10, py + 3);
      ctx.textAlign = 'left';
    }

    // frame
    ctx.lineWidth = selected ? 1.5 : 1;
    ctx.strokeStyle = selected ? '#3fc1ff' : '#314052';
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);

    if (node.flash > 0) {
      ctx.globalAlpha = Math.min(1, node.flash) * 0.9;
      ctx.strokeStyle = node.flashColor;
      ctx.lineWidth = 2;
      ctx.strokeRect(x - 2, y - 2, w + 4, h + 4);
      ctx.globalAlpha = 1;
    }

    if (selected) {
      ctx.strokeStyle = '#3fc1ff';
      ctx.lineWidth = 2;
      const L = 10;
      const corners: [number, number, number, number][] = [
        [x - 5, y - 5, 1, 1], [x + w + 5, y - 5, -1, 1],
        [x - 5, y + h + 5, 1, -1], [x + w + 5, y + h + 5, -1, -1],
      ];
      for (const [cx, cy, sx, sy] of corners) {
        ctx.beginPath();
        ctx.moveTo(cx + sx * L, cy);
        ctx.lineTo(cx, cy);
        ctx.lineTo(cx, cy + sy * L);
        ctx.stroke();
      }
    }

    // random surge: click window
    if (node.surgeWindow > 0) {
      const blink = 0.5 + 0.5 * Math.sin(v.time * 10);
      ctx.strokeStyle = '#ffb02e';
      ctx.globalAlpha = 0.3 + 0.5 * blink;
      ctx.lineWidth = 2.5;
      ctx.strokeRect(x - 3.5, y - 3.5, w + 7, h + 7);
      ctx.globalAlpha = 1;
      ctx.font = '700 11px Rajdhani, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#0f141a';
      const tag = tr(v.state.lang, 'surge.tag') + ' ' + Math.ceil(node.surgeWindow) + 's';
      const tw = ctx.measureText(tag).width + 12;
      ctx.fillStyle = 'rgba(60,40,8,0.9)';
      ctx.fillRect(x + w / 2 - tw / 2, y - 24, tw, 16);
      ctx.strokeStyle = '#ffb02e';
      ctx.lineWidth = 1;
      ctx.strokeRect(x + w / 2 - tw / 2 + 0.5, y - 23.5, tw - 1, 15);
      ctx.fillStyle = '#ffd24a';
      ctx.fillText(tag, x + w / 2, y - 12.5);
      ctx.textAlign = 'left';
    }
    // surge active: x3 badge
    if (node.surgeActive > 0) {
      ctx.strokeStyle = '#ffb02e';
      ctx.globalAlpha = 0.45 + 0.3 * Math.sin(v.time * 6);
      ctx.lineWidth = 2;
      ctx.strokeRect(x - 2.5, y - 2.5, w + 5, h + 5);
      ctx.globalAlpha = 1;
      ctx.font = '700 10px Rajdhani, sans-serif';
      ctx.fillStyle = '#ffb02e';
      ctx.fillText(tr(v.state.lang, 'surge.x') + ' · ' + Math.ceil(node.surgeActive) + 's', x + 8, y - 8);
    }

    // network core tier rings (endless tier visual)
    if (node.type === 'core') {
      const rings = 1 + Math.min(4, v.state.coreTier);
      const cx0 = x + w / 2;
      const cy0 = y + h / 2;
      ctx.strokeStyle = '#ffd24a';
      ctx.lineWidth = 1.2;
      for (let i = 0; i < rings; i++) {
        const r0 = Math.max(w, h) / 2 + 10 + i * 7;
        ctx.globalAlpha = Math.max(0.08, 0.3 - i * 0.045);
        ctx.setLineDash([8, 10]);
        ctx.lineDashOffset = v.time * (14 + i * 8) * (i % 2 ? -1 : 1);
        ctx.beginPath();
        ctx.arc(cx0, cy0, r0, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
      ctx.font = '700 9px Rajdhani, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ffd24a';
      ctx.fillText('T' + v.state.coreTier, cx0, y + h + 14);
      ctx.textAlign = 'left';
    }

    // ports
    for (const port of node.ports) {
      const p = portPos(node, port);
      const color = RES_META[port.resource].color;
      const hovered = v.hoverPortId === port.id;
      const s = hovered ? 13 : 9;
      ctx.fillStyle = '#141b24';
      ctx.fillRect(p.x - s / 2, p.y - s / 2, s, s);
      if (port.connectionId) {
        ctx.fillStyle = color;
        ctx.fillRect(p.x - s / 2 + 2, p.y - s / 2 + 2, s - 4, s - 4);
      }
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = color;
      ctx.strokeRect(p.x - s / 2, p.y - s / 2, s, s);
      if (hovered) {
        ctx.strokeStyle = '#d5e1ef';
        ctx.strokeRect(p.x - s / 2 - 3, p.y - s / 2 - 3, s + 6, s + 6);
      }
      // tiny dir tag
      ctx.fillStyle = '#5c6b7f';
      ctx.font = '600 7px Rajdhani, sans-serif';
      ctx.textAlign = port.dir === 'out' ? 'right' : 'left';
      ctx.fillText(port.dir === 'out' ? 'OUT' : 'IN', port.dir === 'out' ? p.x - 9 : p.x + 9, p.y + 0.5);
      ctx.textAlign = 'left';
    }
  }

  private drawGhost(ctx: CanvasRenderingContext2D, v: RenderView, type: NodeTypeId, gx: number, gy: number): void {
    const def = NODE_DEFS[type];
    const w = NODE_W;
    const h = nodeH(def);
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = '#1a222d';
    ctx.fillRect(gx, gy, w, h);
    ctx.fillStyle = '#212c39';
    ctx.fillRect(gx, gy, w, 26);
    ctx.fillStyle = '#d5e1ef';
    ctx.font = '700 11px Rajdhani, sans-serif';
    ctx.fillText(tr(v.state.lang, def.nameKey), gx + 8, gy + 14);
    this.drawIcon(ctx, type, gx + 24, gy + 52);
    ctx.setLineDash([6, 4]);
    ctx.strokeStyle = '#45e08c';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(gx - 3, gy - 3, w + 6, h + 6);
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
    // port hints
    const tmp: GameNode = {
      id: 'ghost', type, x: gx, y: gy, level: 1, inv: {}, prod: 0,
      status: 'idle', statusT: 0, flash: 0, flashColor: '#fff', surgeWindow: 0, surgeActive: 0,
      modules: [], blueprintId: null, redundancyT: 0,
      ports: def.outputs.map((r, i) => ({ id: `g|out${i}`, nodeId: 'g', dir: 'out' as const, resource: r, connectionId: null })),
    };
    for (const port of tmp.ports) {
      const p = portPos(tmp, port);
      ctx.strokeStyle = RES_META[port.resource].color;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(p.x - 4.5, p.y - 4.5, 9, 9);
    }
  }

  private drawPreview(ctx: CanvasRenderingContext2D, v: RenderView): void {
    const d = v.dragConn!;
    const found = v.state.nodes.flatMap((n) => n.ports).find((p) => p.id === d.fromPortId);
    const node = v.state.nodes.find((n) => n.id === d.fromPortId.split('|')[0]);
    if (!found || !node) return;
    const a = portPos(node, found);
    const color = d.valid ? '#45e08c' : '#ff5d5d';
    const dx = Math.max(46, Math.abs(d.x - a.x) * 0.5);
    ctx.setLineDash([7, 5]);
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.bezierCurveTo(a.x + dx, a.y, d.x - dx, d.y, d.x, d.y);
    ctx.stroke();
    ctx.setLineDash([]);
    // arrowhead
    const ang = Math.atan2(d.y - a.y, d.x - (d.x - dx));
    ctx.save();
    ctx.translate(d.x, d.y);
    ctx.rotate(ang);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(8, 0); ctx.lineTo(-4, -5); ctx.lineTo(-4, 5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    const tpId = d.targetPortId;
    if (tpId) {
      const tNode = v.state.nodes.find((n) => n.id === tpId.split('|')[0]);
      const tPort = tNode?.ports.find((p) => p.id === tpId);
      if (tNode && tPort) {
        const p = portPos(tNode, tPort);
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.strokeRect(p.x - 9, p.y - 9, 18, 18);
      }
    }
  }

  private drawParticles(ctx: CanvasRenderingContext2D, v: RenderView): void {
    for (const p of v.particles) {
      ctx.globalAlpha = Math.max(0, p.life / p.max);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    ctx.globalAlpha = 1;
  }

  private drawFloats(ctx: CanvasRenderingContext2D, v: RenderView): void {
    ctx.font = '700 12px "IBM Plex Mono", monospace';
    ctx.textAlign = 'center';
    for (const f of v.floats) {
      const a = Math.min(1, f.life / 0.4);
      ctx.globalAlpha = a;
      ctx.fillStyle = '#0a0e13';
      ctx.fillText(f.text, f.x + 1, f.y + 1);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x, f.y);
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = 'left';
  }

  // ── procedural icons ───────────────────────────────────────────────────────
  private drawIcon(ctx: CanvasRenderingContext2D, type: NodeTypeId, cx: number, cy: number): void {
    drawNodeIcon(ctx, type, cx, cy);
  }

}

import type { Camera } from './camera';
import { NODE_DEFS, RES_META, fmt, tr } from './data';
import { NODE_W, inputCapFor, invResources, nodeH, portPos, storageCapacity } from './state';
import type {
  FloatText, GameNode, GameState, NodeTypeId, Particle,
} from './types';

export interface RenderView {
  state: GameState;
  camera: Camera;
  time: number;
  selectedId: string | null;
  hoverPortId: string | null;
  hoverConnId: string | null;
  ghost: { type: NodeTypeId; x: number; y: number } | null;
  dragConn: { fromPortId: string; x: number; y: number; targetPortId: string | null; valid: boolean } | null;
  particles: Particle[];
  floats: FloatText[];
  w: number;
  h: number;
  dpr: number;
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
  }

  // ── grid ───────────────────────────────────────────────────────────────────
  private drawGrid(ctx: CanvasRenderingContext2D, v: RenderView): void {
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
    const name = tr(v.state.lang, def.nameKey);
    ctx.fillText(name, x + 8, y + 13.5, w - 70);
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

    // icon
    this.drawIcon(ctx, node.type, x + 24, y + 52);

    // inventory bars
    const bars = invResources(def);
    let by = y + 38;
    for (const res of bars) {
      const cur = node.inv[res] ?? 0;
      const cap = def.category === 'storage'
        ? storageCapacity(v.state)
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
      status: 'idle', statusT: 0, flash: 0, flashColor: '#fff',
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
    ctx.save();
    ctx.translate(cx, cy);
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = '#9fb4cc';
    ctx.fillStyle = '#2a3644';
    const r = (x: number, y: number, w: number, h: number) => ctx.strokeRect(x, y, w, h);
    switch (type) {
      case 'relay':
        r(-10, -9, 20, 5); r(-10, -2, 20, 5); r(-10, 5, 20, 5);
        ctx.fillStyle = '#3fc1ff';
        ctx.fillRect(-7, -7.5, 4, 2); ctx.fillRect(-7, -0.5, 4, 2); ctx.fillRect(-7, 6.5, 4, 2);
        break;
      case 'storage':
        ctx.beginPath();
        ctx.ellipse(0, -7, 10, 4, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(-10, -7); ctx.lineTo(-10, 7);
        ctx.ellipse(0, 7, 10, 4, 0, Math.PI, 0, true);
        ctx.lineTo(10, -7);
        ctx.stroke();
        ctx.beginPath(); ctx.ellipse(0, 0, 10, 4, 0, 0, Math.PI); ctx.stroke();
        break;
      case 'compute':
        r(-8, -8, 16, 16); r(-4, -4, 8, 8);
        ctx.beginPath();
        for (const o of [-5, 0, 5]) {
          ctx.moveTo(o, -8); ctx.lineTo(o, -12);
          ctx.moveTo(o, 8); ctx.lineTo(o, 12);
          ctx.moveTo(-8, o); ctx.lineTo(-12, o);
          ctx.moveTo(8, o); ctx.lineTo(12, o);
        }
        ctx.stroke();
        break;
      case 'router':
        ctx.beginPath();
        ctx.moveTo(-10, 0); ctx.lineTo(10, 0);
        ctx.moveTo(0, -10); ctx.lineTo(0, 10);
        ctx.stroke();
        ctx.fillStyle = '#9fb4cc';
        for (const [ax, ay, rot] of [[10, 0, 0], [-10, 0, Math.PI], [0, -10, -Math.PI / 2], [0, 10, Math.PI / 2]] as [number, number, number][]) {
          ctx.save(); ctx.translate(ax, ay); ctx.rotate(rot);
          ctx.beginPath(); ctx.moveTo(3, 0); ctx.lineTo(-2, -3); ctx.lineTo(-2, 3); ctx.closePath(); ctx.fill();
          ctx.restore();
        }
        ctx.fillStyle = '#2a3644'; r(-3, -3, 6, 6);
        break;
      case 'proxy':
        ctx.beginPath();
        ctx.moveTo(-11, -4); ctx.lineTo(7, -4);
        ctx.moveTo(11, 4); ctx.lineTo(-7, 4);
        ctx.stroke();
        ctx.fillStyle = '#9fb4cc';
        ctx.save(); ctx.translate(9, -4); ctx.beginPath(); ctx.moveTo(3, 0); ctx.lineTo(-3, -3); ctx.lineTo(-3, 3); ctx.fill(); ctx.restore();
        ctx.save(); ctx.translate(-9, 4); ctx.rotate(Math.PI); ctx.beginPath(); ctx.moveTo(3, 0); ctx.lineTo(-3, -3); ctx.lineTo(-3, 3); ctx.fill(); ctx.restore();
        r(-2, -9, 4, 18);
        break;
      case 'processor':
        r(-9, -9, 18, 18);
        r(-4, -4, 8, 8);
        ctx.beginPath();
        ctx.moveTo(-9, -4); ctx.lineTo(-13, -4); ctx.moveTo(-9, 4); ctx.lineTo(-13, 4);
        ctx.moveTo(9, -4); ctx.lineTo(13, -4); ctx.moveTo(9, 4); ctx.lineTo(13, 4);
        ctx.stroke();
        ctx.fillStyle = '#ffb02e';
        ctx.fillRect(-2, -2, 4, 4);
        break;
      case 'firewall':
        ctx.beginPath();
        ctx.moveTo(0, -11); ctx.lineTo(9, -7); ctx.lineTo(9, 2);
        ctx.quadraticCurveTo(9, 9, 0, 12);
        ctx.quadraticCurveTo(-9, 9, -9, 2);
        ctx.lineTo(-9, -7);
        ctx.closePath();
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(-4, 0); ctx.lineTo(4, 0);
        ctx.moveTo(0, -4); ctx.lineTo(0, 4);
        ctx.stroke();
        break;
      case 'encryption':
        r(-7, -2, 14, 11);
        ctx.beginPath();
        ctx.arc(0, -2, 5, Math.PI, 0);
        ctx.stroke();
        ctx.fillStyle = '#c792ff';
        ctx.fillRect(-1.5, 1.5, 3, 4);
        break;
      case 'datacenter':
        r(-10, -11, 20, 22);
        ctx.beginPath();
        ctx.moveTo(-10, -4); ctx.lineTo(10, -4);
        ctx.moveTo(-10, 3); ctx.lineTo(10, 3);
        ctx.stroke();
        ctx.fillStyle = '#3fc1ff';
        ctx.fillRect(-7, -9, 3, 2); ctx.fillRect(-7, -2, 3, 2); ctx.fillRect(-7, 5, 3, 2);
        ctx.fillStyle = '#ffb02e';
        ctx.fillRect(2, -9, 5, 2);
        break;
      case 'hub':
        for (let i = -1; i <= 1; i++) {
          for (let j = -1; j <= 1; j++) {
            if (i === 0 && j === 0) continue;
            ctx.strokeRect(i * 8 - 2.5, j * 8 - 2.5, 5, 5);
          }
        }
        ctx.fillStyle = '#3fc1ff';
        ctx.fillRect(-3, -3, 6, 6);
        ctx.strokeStyle = '#3fc1ff';
        ctx.strokeRect(-3.5, -3.5, 7, 7);
        break;
    }
    ctx.restore();
  }
}

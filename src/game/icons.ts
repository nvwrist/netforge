import type { NodeTypeId } from './types';

// Shared procedural node icons. Used by the world renderer and the codex UI.
export function drawNodeIcon(ctx: CanvasRenderingContext2D, type: NodeTypeId, cx: number, cy: number): void {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = '#9fb4cc';
  ctx.fillStyle = '#2a3644';
  const r = (x: number, y: number, w: number, h: number) => ctx.strokeRect(x, y, w, h);
  const arrow = (x: number, y: number, rot: number) => {
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
    ctx.beginPath(); ctx.moveTo(3, 0); ctx.lineTo(-2, -3); ctx.lineTo(-2, 3); ctx.closePath(); ctx.fill();
    ctx.restore();
  };
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
    case 'cache':
      r(-9, -8, 14, 6); r(-7, -1, 14, 6); r(-5, 6, 14, 6);
      ctx.fillStyle = '#3fc1ff';
      ctx.fillRect(-6, -6, 3, 2); ctx.fillRect(-4, 1, 3, 2);
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
      arrow(10, 0, 0); arrow(-10, 0, Math.PI); arrow(0, -10, -Math.PI / 2); arrow(0, 10, Math.PI / 2);
      ctx.fillStyle = '#2a3644'; r(-3, -3, 6, 6);
      break;
    case 'balancer':
      ctx.beginPath();
      ctx.moveTo(-11, 0); ctx.lineTo(-4, 0);
      ctx.moveTo(-4, 0); ctx.lineTo(8, -8);
      ctx.moveTo(-4, 0); ctx.lineTo(8, 0);
      ctx.moveTo(-4, 0); ctx.lineTo(8, 8);
      ctx.stroke();
      ctx.fillStyle = '#9fb4cc';
      arrow(8, -8, -Math.PI / 6); arrow(8, 0, 0); arrow(8, 8, Math.PI / 6);
      ctx.fillStyle = '#2a3644'; r(-4.5, -3, 5, 6);
      break;
    case 'proxy':
      ctx.beginPath();
      ctx.moveTo(-11, -4); ctx.lineTo(7, -4);
      ctx.moveTo(11, 4); ctx.lineTo(-7, 4);
      ctx.stroke();
      ctx.fillStyle = '#9fb4cc';
      arrow(9, -4, 0); arrow(-9, 4, Math.PI);
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
    case 'archive':
      r(-9, -10, 18, 20);
      ctx.beginPath();
      ctx.moveTo(-9, -3); ctx.lineTo(9, -3);
      ctx.moveTo(-9, 4); ctx.lineTo(9, 4);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, -9); ctx.lineTo(0, -5);
      ctx.moveTo(-2, -7); ctx.lineTo(0, -5); ctx.lineTo(2, -7);
      ctx.stroke();
      ctx.fillStyle = '#ffd24a';
      ctx.fillRect(-5, 0, 3, 2); ctx.fillRect(-5, 7, 3, 2);
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
    case 'refinery':
      ctx.beginPath();
      ctx.moveTo(-3, -11); ctx.lineTo(3, -11);
      ctx.moveTo(-2, -11); ctx.lineTo(-2, -4);
      ctx.moveTo(2, -11); ctx.lineTo(2, -4);
      ctx.moveTo(-2, -4); ctx.lineTo(-8, 8);
      ctx.moveTo(2, -4); ctx.lineTo(8, 8);
      ctx.moveTo(-8, 8); ctx.lineTo(8, 8);
      ctx.stroke();
      ctx.fillStyle = '#4fe3c1';
      ctx.fillRect(-3, 3, 2, 2); ctx.fillRect(1, 5, 2, 2); ctx.fillRect(-1, 0, 2, 2);
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
    case 'core': {
      ctx.strokeStyle = '#ffd24a';
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = Math.PI / 6 + (i * Math.PI) / 3;
        const x = Math.cos(a) * 11;
        const y = Math.sin(a) * 11;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.stroke();
      ctx.strokeStyle = '#9fb4cc';
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = Math.PI / 6 + (i * Math.PI) / 3;
        const x = Math.cos(a) * 6;
        const y = Math.sin(a) * 6;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.stroke();
      ctx.fillStyle = '#ffd24a';
      ctx.beginPath();
      ctx.arc(0, 0, 2.4, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'sensor':
      ctx.beginPath(); ctx.arc(-6, 6, 2, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-6, 6); ctx.lineTo(3, -3); ctx.stroke();
      for (const rr of [4, 8]) {
        ctx.beginPath(); ctx.arc(4, -4, rr, -Math.PI / 2, 0); ctx.stroke();
      }
      ctx.fillStyle = '#ff8a5c';
      ctx.beginPath(); ctx.arc(-6, 6, 1.2, 0, Math.PI * 2); ctx.fill();
      break;
    case 'computebank':
      r(-9, -10, 18, 20);
      ctx.beginPath(); ctx.moveTo(-9, -4); ctx.lineTo(9, -4); ctx.moveTo(-9, 3); ctx.lineTo(9, 3); ctx.stroke();
      ctx.fillStyle = '#ffb02e';
      ctx.fillRect(-6, -8, 3, 2); ctx.fillRect(-6, -1, 3, 2); ctx.fillRect(-6, 6, 3, 2);
      break;
    case 'signalbuffer':
      r(-9, -8, 12, 16);
      ctx.beginPath(); ctx.moveTo(5, -4); ctx.lineTo(10, -4); ctx.moveTo(5, 0); ctx.lineTo(10, 0); ctx.moveTo(5, 4); ctx.lineTo(10, 4); ctx.stroke();
      ctx.fillStyle = '#ff8a5c';
      ctx.fillRect(-6, -5, 6, 2); ctx.fillRect(-6, -1, 4, 2); ctx.fillRect(-6, 3, 5, 2);
      break;
    case 'smartrouter':
      ctx.beginPath();
      ctx.moveTo(-10, 0); ctx.lineTo(-2, 0);
      ctx.moveTo(-2, 0); ctx.lineTo(8, -7);
      ctx.moveTo(-2, 0); ctx.lineTo(8, 0);
      ctx.moveTo(-2, 0); ctx.lineTo(8, 7);
      ctx.stroke();
      ctx.fillStyle = '#9fb4cc';
      arrow(8, -7, -Math.PI / 5); arrow(8, 0, 0); arrow(8, 7, Math.PI / 5);
      ctx.fillStyle = '#2a3644'; r(-3, -3, 5, 6);
      break;
    case 'analyzer':
      ctx.beginPath(); ctx.arc(-2, -2, 7, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(3, 3); ctx.lineTo(9, 9); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-6, -2); ctx.lineTo(-3, -2); ctx.lineTo(-2, -5); ctx.lineTo(0, 0); ctx.lineTo(1, -2); ctx.lineTo(3, -2);
      ctx.stroke();
      break;
    case 'compressor':
      ctx.beginPath();
      ctx.moveTo(-10, -5); ctx.lineTo(-4, -2); ctx.moveTo(-10, 5); ctx.lineTo(-4, 2);
      ctx.stroke();
      ctx.fillStyle = '#9fb4cc';
      arrow(-4, -2, Math.PI / 6); arrow(-4, 2, -Math.PI / 6);
      r(0, -6, 9, 12);
      ctx.fillStyle = '#4fe3c1';
      ctx.fillRect(3, -3, 3, 6);
      break;
    case 'assembler':
      r(-10, -10, 8, 8); r(2, -10, 8, 8); r(-4, 2, 8, 8);
      ctx.fillStyle = '#c792ff';
      ctx.fillRect(-7, -7, 2, 2); ctx.fillRect(5, -7, 2, 2); ctx.fillRect(-1, 5, 2, 2);
      break;
    case 'forge':
      ctx.beginPath();
      ctx.moveTo(-9, 2); ctx.lineTo(9, 2);
      ctx.moveTo(-6, 2); ctx.lineTo(-6, 8); ctx.lineTo(6, 8); ctx.lineTo(6, 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, -9); ctx.quadraticCurveTo(5, -5, 0, -1); ctx.quadraticCurveTo(-5, -5, 0, -9);
      ctx.stroke();
      ctx.fillStyle = '#ffb02e';
      ctx.beginPath(); ctx.arc(0, -5, 1.4, 0, Math.PI * 2); ctx.fill();
      break;
    default: {
      // Generic fallback so a node added to data.ts renders even without a custom icon.
      r(-9, -9, 18, 18);
      ctx.beginPath(); ctx.moveTo(-9, -3); ctx.lineTo(9, -3); ctx.stroke();
      ctx.fillStyle = '#3fc1ff';
      ctx.fillRect(-6, -7, 3, 2);
      ctx.strokeStyle = '#5c6b7f';
      ctx.strokeRect(-5, 1, 10, 5);
      break;
    }
  }
  ctx.restore();
}

// Blocky avatar renderer with simple procedural animation.
import { shade, rgba } from '../util.js';

function limb(ctx, x, y, w, h, angle, color, outline = true) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(-w / 2, 0, w, h, Math.min(w, h) * 0.3);
  ctx.fill();
  if (outline) {
    ctx.lineWidth = Math.max(1, w * 0.1);
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.stroke();
  }
  ctx.restore();
}

/**
 * opts: { x, y (feet), h, dir, pose, t, skin, shirt, pants, hat, tool, toolC1, toolC2,
 *         swing (0..1 dig swing progress), raise (0..1 shovel raise while charging),
 *         shaking, alpha, glow }
 */
export function drawCharacter(ctx, o) {
  const h = o.h;
  const dir = o.dir >= 0 ? 1 : -1;
  const t = o.t || 0;
  const legH = h * 0.36, torsoH = h * 0.33, headS = h * 0.29, torsoW = h * 0.34;
  const legW = h * 0.15, armW = h * 0.12, armH = h * 0.32;
  let crouch = 0, bob = 0, lean = 0;
  let legA = 0, armFront = 0, armBack = 0;
  const pose = o.pose || 'idle';

  if (pose === 'walk') {
    const ph = t * 9;
    legA = Math.sin(ph) * 0.55;
    armFront = -Math.sin(ph) * 0.5;
    armBack = Math.sin(ph) * 0.5;
    bob = Math.abs(Math.sin(ph)) * h * 0.025;
  } else if (pose === 'idle') {
    bob = Math.sin(t * 2) * h * 0.008;
    armFront = 0.06; armBack = -0.06;
  } else if (pose === 'pan') {
    crouch = h * 0.13;
    lean = 0.12;
  } else if (pose === 'cheer') {
    bob = -Math.abs(Math.sin(t * 7)) * h * 0.12;
  } else if (pose === 'dig') {
    lean = 0.06;
  }

  ctx.save();
  if (o.alpha !== undefined) ctx.globalAlpha = o.alpha;
  ctx.translate(o.x, o.y + bob);
  ctx.scale(dir, 1);

  // shadow
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  ctx.beginPath();
  ctx.ellipse(0, 1 - bob, h * 0.22, h * 0.045, 0, 0, Math.PI * 2);
  ctx.fill();

  const hipY = -legH + crouch;
  const shoulderY = hipY - torsoH;
  const skin = o.skin || '#f5cd30';
  const shirt = o.shirt || '#e53935';
  const pants = o.pants || '#1565c0';

  // back arm (behind body)
  const backArmAngle = pose === 'cheer' ? Math.PI - 0.5 + Math.sin(t * 7) * 0.2 : pose === 'pan' ? -1.2 : pose === 'dig' ? digArmAngle(o) - 0.2 : armBack;
  limb(ctx, -torsoW * 0.32, shoulderY + h * 0.02, armW, armH, backArmAngle, shade(skin, -0.18));

  // legs
  if (pose === 'pan') {
    // crouched: thighs forward, shins down
    for (const [side, c] of [[-1, shade(pants, -0.15)], [1, pants]]) {
      const lx = side * legW * 0.45;
      ctx.save();
      ctx.translate(lx, hipY);
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.roundRect(-legW / 2, -legW * 0.1, legH * 0.62, legW, legW * 0.3);
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.35)';
      ctx.lineWidth = Math.max(1, legW * 0.1);
      ctx.stroke();
      ctx.beginPath();
      ctx.roundRect(legH * 0.62 - legW * 0.95, 0, legW, legH - crouch + legW * 0.1, legW * 0.3);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
  } else {
    limb(ctx, -legW * 0.5, hipY, legW, legH, -legA, shade(pants, -0.15));
    limb(ctx, legW * 0.5, hipY, legW, legH, legA, pants);
  }

  // torso
  ctx.save();
  ctx.translate(0, hipY);
  ctx.rotate(lean);
  ctx.translate(0, -hipY);
  const tg = ctx.createLinearGradient(-torsoW / 2, 0, torsoW / 2, 0);
  tg.addColorStop(0, shade(shirt, -0.12));
  tg.addColorStop(0.6, shirt);
  tg.addColorStop(1, shade(shirt, 0.12));
  ctx.fillStyle = tg;
  ctx.beginPath();
  ctx.roundRect(-torsoW / 2, shoulderY, torsoW, torsoH + h * 0.02, h * 0.05);
  ctx.fill();
  ctx.lineWidth = Math.max(1, h * 0.012);
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.stroke();

  // head
  const headY = shoulderY - headS * 0.98;
  ctx.fillStyle = skin;
  ctx.beginPath();
  ctx.roundRect(-headS * 0.5, headY, headS, headS, headS * 0.28);
  ctx.fill();
  ctx.stroke();
  // face (shifted towards facing direction)
  const fx = headS * 0.1;
  ctx.fillStyle = '#1b1b1b';
  ctx.beginPath();
  ctx.ellipse(fx - headS * 0.13, headY + headS * 0.4, headS * 0.055, headS * 0.09, 0, 0, Math.PI * 2);
  ctx.ellipse(fx + headS * 0.17, headY + headS * 0.4, headS * 0.055, headS * 0.09, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#1b1b1b';
  ctx.lineWidth = Math.max(1, headS * 0.06);
  ctx.beginPath();
  if (pose === 'cheer') ctx.arc(fx + headS * 0.02, headY + headS * 0.6, headS * 0.13, 0.1, Math.PI - 0.1);
  else ctx.arc(fx + headS * 0.02, headY + headS * 0.56, headS * 0.16, 0.35, Math.PI - 0.35);
  ctx.stroke();
  drawHat(ctx, o.hat, -headS * 0.5, headY, headS, t);
  ctx.restore();

  // front arm + tool
  if (pose === 'dig' || o.tool === 'shovel') drawShovelArm(ctx, o, h, torsoW, shoulderY, armW, armH, skin, pose);
  else if (pose === 'pan') drawPanArms(ctx, o, h, torsoW, shoulderY, armW, armH, skin, crouch, t);
  else {
    const a = pose === 'cheer' ? Math.PI + 0.45 + Math.sin(t * 7 + 1) * 0.2 : armFront;
    limb(ctx, torsoW * 0.32, shoulderY + h * 0.02, armW, armH, a, skin);
    if (o.tool === 'pan' && pose !== 'cheer') {
      // pan carried at the side
      ctx.save();
      ctx.translate(torsoW * 0.32 + Math.sin(-a) * armH, shoulderY + armH);
      drawPanTool(ctx, h * 0.34, o.toolC1, o.toolC2);
      ctx.restore();
    }
  }
  ctx.restore();
}

function digArmAngle(o) {
  // 0 = arm down; negative = forward. Swing: raise then plunge.
  const raise = o.raise || 0;
  const s = o.swing || 0;
  if (s > 0) {
    // s goes 1 → 0 over the dig cooldown
    const p = 1 - s;
    if (p < 0.35) return -0.4 - 1.6 * (1 - p / 0.35) * 0.6;
    if (p < 0.6) return -0.35 + (p - 0.35) * 1.2;
    return -0.05 - (p - 0.6) * 1.2;
  }
  return -0.4 - raise * 1.3;
}

function drawShovelArm(ctx, o, h, torsoW, shoulderY, armW, armH, skin) {
  const a = digArmAngle(o);
  const sx = torsoW * 0.32, sy = shoulderY + h * 0.02;
  limb(ctx, sx, sy, armW, armH, a, skin);
  // hand position
  const hx = sx - Math.sin(a) * armH * 0.95;
  const hy = sy + Math.cos(a) * armH * 0.95;
  ctx.save();
  ctx.translate(hx, hy);
  // shovel points down-forward; its angle follows the arm
  ctx.rotate(a * 0.8 - 0.35);
  const L = h * 0.75;
  ctx.fillStyle = o.toolC2 || '#6b4a2a';
  ctx.beginPath();
  ctx.roundRect(-h * 0.022, -L * 0.25, h * 0.044, L, h * 0.02);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = Math.max(1, h * 0.01);
  ctx.stroke();
  // blade
  ctx.translate(0, L * 0.75);
  ctx.fillStyle = o.toolC1 || '#9aa4b0';
  ctx.beginPath();
  ctx.moveTo(-h * 0.07, 0);
  ctx.lineTo(h * 0.07, 0);
  ctx.lineTo(h * 0.065, h * 0.11);
  ctx.quadraticCurveTo(0, h * 0.19, -h * 0.065, h * 0.11);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.fillRect(-h * 0.045, h * 0.015, h * 0.015, h * 0.08);
  ctx.restore();
}

function drawPanArms(ctx, o, h, torsoW, shoulderY, armW, armH, skin, crouch, t) {
  const shake = o.shaking ? Math.sin(t * 34) * h * 0.035 : 0;
  const tilt = o.shaking ? Math.sin(t * 34 + 1) * 0.08 : 0;
  const sx = torsoW * 0.32, sy = shoulderY + h * 0.02;
  limb(ctx, sx, sy, armW, armH, -1.15, skin);
  const px = sx + armH * 0.95 + shake;
  const py = sy + armH * 0.38;
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(tilt);
  drawPanTool(ctx, h * 0.5, o.toolC1, o.toolC2, o.panFill, o.glint);
  ctx.restore();
}

export function drawPanTool(ctx, w, c1 = '#9a6b4a', c2 = '#5c3a24', fill = 0, glint = false) {
  ctx.fillStyle = c2;
  ctx.beginPath();
  ctx.ellipse(0, 0, w / 2, w * 0.13, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = c1;
  ctx.beginPath();
  ctx.ellipse(0, -w * 0.02, w / 2, w * 0.11, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.4)';
  ctx.lineWidth = Math.max(1, w * 0.025);
  ctx.stroke();
  if (fill > 0) {
    ctx.fillStyle = 'rgba(122,86,52,0.95)';
    ctx.beginPath();
    ctx.ellipse(0, -w * 0.02, w * 0.4 * Math.min(1, 0.4 + fill * 0.6), w * 0.07, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  if (glint) {
    ctx.fillStyle = '#fff6a8';
    ctx.beginPath();
    ctx.arc(w * 0.08, -w * 0.04, w * 0.05, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawHat(ctx, hat, x, y, s, t) {
  if (!hat || hat === 'none') return;
  ctx.save();
  ctx.lineWidth = Math.max(1, s * 0.05);
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  const cx = x + s / 2;
  const fillStroke = (col) => { ctx.fillStyle = col; ctx.fill(); ctx.stroke(); };
  switch (hat) {
    case 'cap':
      ctx.beginPath(); ctx.roundRect(x - s * 0.02, y - s * 0.12, s * 1.04, s * 0.38, [s * 0.3, s * 0.3, 0, 0]); fillStroke('#1e88e5');
      ctx.beginPath(); ctx.roundRect(x + s * 0.6, y + s * 0.16, s * 0.6, s * 0.1, s * 0.05); fillStroke('#1565c0');
      break;
    case 'cowboy':
      ctx.beginPath(); ctx.ellipse(cx, y + s * 0.06, s * 0.85, s * 0.13, 0, 0, Math.PI * 2); fillStroke('#8d5a33');
      ctx.beginPath(); ctx.roundRect(x + s * 0.12, y - s * 0.38, s * 0.76, s * 0.46, [s * 0.25, s * 0.25, s * 0.04, s * 0.04]); fillStroke('#a0693d');
      ctx.fillStyle = '#5d3a1f'; ctx.fillRect(x + s * 0.12, y - s * 0.06, s * 0.76, s * 0.09);
      break;
    case 'hardhat':
      ctx.beginPath(); ctx.ellipse(cx, y + s * 0.06, s * 0.66, s * 0.1, 0, 0, Math.PI * 2); fillStroke('#fbc02d');
      ctx.beginPath(); ctx.ellipse(cx, y + s * 0.04, s * 0.54, s * 0.42, 0, Math.PI, 0); fillStroke('#fdd835');
      ctx.beginPath(); ctx.arc(cx + s * 0.38, y - s * 0.08, s * 0.1, 0, Math.PI * 2); fillStroke('#fffde7');
      break;
    case 'beanie':
      ctx.beginPath(); ctx.ellipse(cx, y + s * 0.1, s * 0.56, s * 0.48, 0, Math.PI, 0); fillStroke('#e53935');
      ctx.beginPath(); ctx.roundRect(x - s * 0.04, y + s * 0.02, s * 1.08, s * 0.16, s * 0.06); fillStroke('#c62828');
      ctx.beginPath(); ctx.arc(cx, y - s * 0.42, s * 0.1, 0, Math.PI * 2); fillStroke('#ffffff');
      break;
    case 'tophat':
      ctx.beginPath(); ctx.ellipse(cx, y + s * 0.04, s * 0.72, s * 0.1, 0, 0, Math.PI * 2); fillStroke('#212121');
      ctx.beginPath(); ctx.roundRect(x + s * 0.14, y - s * 0.62, s * 0.72, s * 0.68, s * 0.05); fillStroke('#263238');
      ctx.fillStyle = '#c62828'; ctx.fillRect(x + s * 0.14, y - s * 0.12, s * 0.72, s * 0.1);
      break;
    case 'crown':
      ctx.beginPath();
      ctx.moveTo(x + s * 0.06, y + s * 0.08); ctx.lineTo(x + s * 0.06, y - s * 0.3); ctx.lineTo(x + s * 0.28, y - s * 0.1);
      ctx.lineTo(cx, y - s * 0.4); ctx.lineTo(x + s * 0.72, y - s * 0.1); ctx.lineTo(x + s * 0.94, y - s * 0.3); ctx.lineTo(x + s * 0.94, y + s * 0.08); ctx.closePath();
      fillStroke('#ffca28');
      ctx.fillStyle = '#e53935'; ctx.beginPath(); ctx.arc(cx, y - s * 0.04, s * 0.07, 0, Math.PI * 2); ctx.fill();
      break;
    case 'wizard':
      ctx.beginPath(); ctx.ellipse(cx, y + s * 0.06, s * 0.7, s * 0.11, 0, 0, Math.PI * 2); fillStroke('#5e35b1');
      ctx.beginPath(); ctx.moveTo(x + s * 0.1, y + s * 0.04); ctx.quadraticCurveTo(cx, y - s * 0.4, cx + s * 0.3, y - s * 0.95); ctx.lineTo(x + s * 0.92, y + s * 0.04); ctx.closePath(); fillStroke('#673ab7');
      ctx.fillStyle = '#ffeb3b'; ctx.beginPath(); ctx.arc(cx, y - s * 0.25, s * 0.06, 0, Math.PI * 2); ctx.fill();
      break;
    case 'headphones':
      ctx.strokeStyle = '#212121'; ctx.lineWidth = s * 0.09;
      ctx.beginPath(); ctx.arc(cx, y + s * 0.3, s * 0.56, Math.PI * 1.08, Math.PI * 1.92); ctx.stroke();
      ctx.fillStyle = '#e91e63'; ctx.beginPath(); ctx.roundRect(x - s * 0.1, y + s * 0.22, s * 0.18, s * 0.3, s * 0.06); ctx.roundRect(x + s * 0.92, y + s * 0.22, s * 0.18, s * 0.3, s * 0.06); ctx.fill();
      break;
    case 'bandana':
      ctx.beginPath(); ctx.roundRect(x - s * 0.02, y - s * 0.04, s * 1.04, s * 0.26, [s * 0.25, s * 0.25, 0, 0]); fillStroke('#d32f2f');
      ctx.fillStyle = '#fff'; for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.arc(x + s * (0.16 + i * 0.22), y + s * 0.08, s * 0.03, 0, Math.PI * 2); ctx.fill(); }
      break;
    case 'hair':
      ctx.beginPath(); ctx.roundRect(x - s * 0.04, y - s * 0.1, s * 1.08, s * 0.32, [s * 0.3, s * 0.3, s * 0.05, s * 0.05]); fillStroke('#4e342e');
      ctx.beginPath(); ctx.roundRect(x - s * 0.06, y + s * 0.05, s * 0.2, s * 0.45, s * 0.06); fillStroke('#4e342e');
      break;
    case 'bucket':
      ctx.beginPath(); ctx.ellipse(cx, y + s * 0.08, s * 0.7, s * 0.14, 0, 0, Math.PI * 2); fillStroke('#c5b358');
      ctx.beginPath(); ctx.roundRect(x + s * 0.1, y - s * 0.3, s * 0.8, s * 0.4, [s * 0.3, s * 0.3, 0, 0]); fillStroke('#d4c26a');
      break;
    case 'captain':
      ctx.beginPath(); ctx.roundRect(x - s * 0.04, y - s * 0.24, s * 1.08, s * 0.32, [s * 0.2, s * 0.2, 0, 0]); fillStroke('#ffffff');
      ctx.beginPath(); ctx.roundRect(x + s * 0.5, y + s * 0.04, s * 0.62, s * 0.1, s * 0.05); fillStroke('#212121');
      ctx.fillStyle = '#ffca28'; ctx.beginPath(); ctx.arc(cx, y - s * 0.08, s * 0.07, 0, Math.PI * 2); ctx.fill();
      break;
    case 'witch':
      ctx.beginPath(); ctx.ellipse(cx, y + s * 0.06, s * 0.8, s * 0.12, 0, 0, Math.PI * 2); fillStroke('#263238');
      ctx.beginPath(); ctx.moveTo(x + s * 0.12, y + s * 0.04); ctx.lineTo(cx - s * 0.25, y - s * 0.9); ctx.lineTo(x + s * 0.9, y + s * 0.04); ctx.closePath(); fillStroke('#37474f');
      ctx.fillStyle = '#7cb342'; ctx.fillRect(x + s * 0.16, y - s * 0.08, s * 0.7, s * 0.09);
      break;
    case 'safari':
      ctx.beginPath(); ctx.ellipse(cx, y + s * 0.06, s * 0.78, s * 0.13, 0, 0, Math.PI * 2); fillStroke('#c8b07a');
      ctx.beginPath(); ctx.ellipse(cx, y + s * 0.04, s * 0.5, s * 0.36, 0, Math.PI, 0); fillStroke('#d7c08a');
      ctx.fillStyle = '#6d4c41'; ctx.fillRect(x + s * 0.02, y - s * 0.02, s * 0.96, s * 0.06);
      break;
    case 'turban':
      ctx.beginPath(); ctx.ellipse(cx, y - s * 0.02, s * 0.6, s * 0.36, 0, 0, Math.PI * 2); fillStroke('#fff3e0');
      ctx.fillStyle = '#e53935'; ctx.beginPath(); ctx.arc(cx + s * 0.1, y - s * 0.04, s * 0.08, 0, Math.PI * 2); ctx.fill();
      break;
    case 'hood':
      ctx.beginPath(); ctx.roundRect(x - s * 0.1, y - s * 0.16, s * 1.2, s * 0.9, [s * 0.5, s * 0.5, s * 0.1, s * 0.1]); fillStroke('#311b92');
      break;
    case 'halo':
      ctx.strokeStyle = '#ffe082'; ctx.lineWidth = s * 0.08;
      ctx.shadowColor = '#fff59d'; ctx.shadowBlur = s * 0.4;
      ctx.beginPath(); ctx.ellipse(cx, y - s * 0.28 + Math.sin(t * 3) * s * 0.04, s * 0.42, s * 0.11, 0, 0, Math.PI * 2); ctx.stroke();
      break;
    default:
      break;
  }
  ctx.restore();
}

export function drawNameTag(ctx, x, y, name, level, color = '#fff', isMe = false, title) {
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.font = `600 ${isMe ? 12 : 11}px Fredoka, ui-rounded, system-ui, sans-serif`;
  ctx.lineWidth = 3;
  ctx.strokeStyle = 'rgba(0,0,0,0.6)';
  const label = name;
  ctx.strokeText(label, x, y);
  ctx.fillStyle = isMe ? '#ffd54f' : color;
  ctx.fillText(label, x, y);
  if (level) {
    ctx.font = '600 9px Fredoka, ui-rounded, system-ui, sans-serif';
    const lv = `Lv ${level}`;
    ctx.strokeText(lv, x, y - 13);
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillText(lv, x, y - 13);
  }
  if (title) {
    ctx.font = 'italic 600 9px Fredoka, ui-rounded, system-ui, sans-serif';
    ctx.strokeText(title, x, y - (level ? 24 : 13));
    ctx.fillStyle = '#b3e5fc';
    ctx.fillText(title, x, y - (level ? 24 : 13));
  }
  ctx.restore();
}

export function drawBubble(ctx, x, y, text, alpha = 1) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.font = '500 11px Fredoka, ui-rounded, system-ui, sans-serif';
  const maxW = 150;
  const words = text.split(' ');
  const lines = [];
  let line = '';
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    if (ctx.measureText(test).width > maxW && line) { lines.push(line); line = w; } else line = test;
  }
  if (line) lines.push(line);
  if (lines.length > 3) { lines.length = 3; lines[2] += '…'; }
  const w = Math.min(maxW, Math.max(...lines.map((l) => ctx.measureText(l).width))) + 14;
  const h = lines.length * 14 + 8;
  const bx = x - w / 2, by = y - h - 8;
  ctx.fillStyle = 'rgba(255,255,255,0.95)';
  ctx.beginPath();
  ctx.roundRect(bx, by, w, h, 8);
  ctx.moveTo(x - 5, by + h);
  ctx.lineTo(x, by + h + 6);
  ctx.lineTo(x + 5, by + h);
  ctx.fill();
  ctx.fillStyle = '#1d2433';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  lines.forEach((l, i) => ctx.fillText(l, x, by + 4 + i * 14));
  ctx.restore();
}

export { rgba };

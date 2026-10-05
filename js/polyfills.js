// Small polyfills for older iOS Safari versions (canvas roundRect landed in
// Safari 16). Imported first by main.js.
const proto = globalThis.CanvasRenderingContext2D?.prototype;
if (proto && !proto.roundRect) {
  proto.roundRect = function roundRect(x, y, w, h, r = 0) {
    let radii = Array.isArray(r) ? r : [r];
    if (radii.length === 1) radii = [radii[0], radii[0], radii[0], radii[0]];
    else if (radii.length === 2) radii = [radii[0], radii[1], radii[0], radii[1]];
    else if (radii.length === 3) radii = [radii[0], radii[1], radii[2], radii[1]];
    const max = Math.min(Math.abs(w), Math.abs(h)) / 2;
    const [tl, tr, br, bl] = radii.map((v) => Math.min(max, Math.max(0, typeof v === 'number' ? v : v?.x || 0)));
    this.moveTo(x + tl, y);
    this.lineTo(x + w - tr, y);
    this.quadraticCurveTo(x + w, y, x + w, y + tr);
    this.lineTo(x + w, y + h - br);
    this.quadraticCurveTo(x + w, y + h, x + w - br, y + h);
    this.lineTo(x + bl, y + h);
    this.quadraticCurveTo(x, y + h, x, y + h - bl);
    this.lineTo(x, y + tl);
    this.quadraticCurveTo(x, y, x + tl, y);
    this.closePath();
    return this;
  };
}

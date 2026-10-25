// Δημιουργεί τα PNG εικονίδια της PWA χωρίς εξωτερικά εργαλεία.
// Εκτέλεση: npm run icons
import fs from 'node:fs';
import zlib from 'node:zlib';

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
};
function png(size, pixel) {
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = pixel(x / size, y / size);
      const o = y * (size * 4 + 1) + 1 + x * 4;
      raw[o] = r; raw[o + 1] = g; raw[o + 2] = b; raw[o + 3] = a;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

const BG = [67, 56, 202, 255], FG = [255, 255, 255, 255], ACC = [251, 191, 36, 255];
const seg = (px, py, ax, ay, bx, by, w) => {
  const dx = bx - ax, dy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy)) <= w;
};
function art(x, y, inset) {
  // Κλιμάκωση ώστε το σχέδιο να χωράει στη «ασφαλή ζώνη» (maskable).
  const s = 1 - inset * 2;
  const u = (x - inset) / s, v = (y - inset) / s;
  const w = 0.035;
  if (seg(u, v, 0.2, 0.85, 0.62, 0.85, w)) return FG;
  if (seg(u, v, 0.3, 0.85, 0.3, 0.15, w)) return FG;
  if (seg(u, v, 0.3, 0.15, 0.68, 0.15, w)) return FG;
  if (seg(u, v, 0.68, 0.15, 0.68, 0.3, w * 0.6)) return FG;
  const d = Math.hypot(u - 0.68, v - 0.4);
  if (d <= 0.1 && d >= 0.1 - w * 1.4) return ACC;
  if (seg(u, v, 0.68, 0.5, 0.68, 0.68, w * 0.8)) return ACC;
  if (seg(u, v, 0.68, 0.55, 0.58, 0.62, w * 0.7) || seg(u, v, 0.68, 0.55, 0.78, 0.62, w * 0.7)) return ACC;
  if (seg(u, v, 0.68, 0.68, 0.6, 0.79, w * 0.7) || seg(u, v, 0.68, 0.68, 0.76, 0.79, w * 0.7)) return ACC;
  return null;
}
function icon(size, { maskable = false } = {}) {
  return png(size, (x, y) => {
    if (!maskable) {
      const r = 0.2, cx = Math.min(Math.max(x, r), 1 - r), cy = Math.min(Math.max(y, r), 1 - r);
      if (Math.hypot(x - cx, y - cy) > r) return [0, 0, 0, 0];
    }
    return art(x, y, maskable ? 0.14 : 0.04) ?? BG;
  });
}

fs.mkdirSync('client/public/icons', { recursive: true });
fs.writeFileSync('client/public/icons/icon-192.png', icon(192));
fs.writeFileSync('client/public/icons/icon-512.png', icon(512));
fs.writeFileSync('client/public/icons/icon-maskable-512.png', icon(512, { maskable: true }));
fs.writeFileSync('client/public/icons/apple-touch-icon.png', icon(180, { maskable: true }));
console.log('Εικονίδια δημιουργήθηκαν στο client/public/icons');

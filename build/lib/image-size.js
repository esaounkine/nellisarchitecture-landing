const fs = require('node:fs');

const SOF = new Set([0xc0, 0xc1, 0xc2]);

/* Walk the JPEG segments up to the first SOF0/1/2 frame header. */
function jpegSize(b) {
  let i = 2;
  while (i + 9 < b.length && b[i] === 0xff) {
    if (SOF.has(b[i + 1])) {
      return { width: b.readUInt16BE(i + 7), height: b.readUInt16BE(i + 5), type: 'image/jpeg' };
    }
    i += 2 + b.readUInt16BE(i + 2);
  }
  return null;
}

/* JPEG and PNG only (no deps). Other formats and bad files → null.
   SHORTCUT: WebP heroes get the minis.png fallback. Upgrade: add a RIFF/VP8X reader here. */
function imageSize(file) {
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) return null;
  const b = fs.readFileSync(file);
  const png = b.length >= 24 && b.toString('latin1', 1, 4) === 'PNG'
    && b.toString('latin1', 12, 16) === 'IHDR';
  if (png) {
    return { width: b.readUInt32BE(16), height: b.readUInt32BE(20), type: 'image/png' };
  }
  if (b[0] === 0xff && b[1] === 0xd8) return jpegSize(b);
  return null;
}

module.exports = { imageSize };

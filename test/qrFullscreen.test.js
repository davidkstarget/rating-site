const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.join(__dirname, '..');

test('admin QR can open in a full-screen overlay', () => {
  const html = fs.readFileSync(path.join(root, 'public', 'admin.html'), 'utf8');
  const js = fs.readFileSync(path.join(root, 'public', 'admin.js'), 'utf8');
  const css = fs.readFileSync(path.join(root, 'public', 'styles.css'), 'utf8');

  assert.match(html, /id="qr-open-button"/);
  assert.match(html, /id="qr-fullscreen"/);
  assert.match(html, /id="qr-code-large"/);
  assert.match(js, /openQrFullscreen/);
  assert.match(js, /closeQrFullscreen/);
  assert.match(js, /event\.key === 'Escape'/);
  assert.match(css, /\.qr-fullscreen/);
  assert.match(css, /\.qr-fullscreen\.is-open/);
});

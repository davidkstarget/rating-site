const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.join(__dirname, '..');

test('admin UI exposes connection status and backup download controls', () => {
  const html = fs.readFileSync(path.join(root, 'public', 'admin.html'), 'utf8');
  const js = fs.readFileSync(path.join(root, 'public', 'admin.js'), 'utf8');

  assert.match(html, /id="connection-banner"/);
  assert.match(html, /id="backup-button"/);
  assert.match(html, /Download backup/);
  assert.match(js, /function setConnectionStatus/);
  assert.match(js, /socket\.on\('disconnect'/);
  assert.match(js, /socket\.on\('connect'/);
  assert.match(js, /function downloadBackup/);
  assert.match(js, /application\/json/);
  assert.match(js, /let adminPin = ''/);
  assert.match(js, /function loginAdmin/);
  assert.match(js, /if \(adminPin\)/);
});

test('student UI warns voters when the live connection is interrupted', () => {
  const html = fs.readFileSync(path.join(root, 'public', 'vote.html'), 'utf8');
  const js = fs.readFileSync(path.join(root, 'public', 'vote.js'), 'utf8');

  assert.match(html, /id="connection-banner"/);
  assert.match(js, /function setConnectionStatus/);
  assert.match(js, /socket\.on\('disconnect'/);
  assert.match(js, /socket\.on\('connect'/);
});

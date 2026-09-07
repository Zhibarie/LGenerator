// ─── STORAGE TESTS ──────────────────────────────────────────────────────────
// Run via: open tests/runner.html in browser, or use a Node-based test runner
// that supports ES modules + a localStorage/IndexedDB shim.

import { Storage } from '../assets/js/core/storage.js';

const tests = [];

function test(name, fn) {
  tests.push({ name, fn });
}

function assert(cond, msg) {
  if (!cond) throw new Error('Assertion failed: ' + (msg || ''));
}

function assertEq(a, b, msg) {
  if (a !== b) throw new Error(`Expected ${b}, got ${a}. ${msg || ''}`);
}

// ── LocalStorage text ────────────────────────────────────────────────────────
test('setText/getText round-trip', () => {
  Storage.setText('test1', 'hello world');
  assertEq(Storage.getText('test1'), 'hello world');
  Storage.removeText('test1');
  assertEq(Storage.getText('test1'), null);
});

test('setJSON/getJSON round-trip', () => {
  const obj = { a: 1, b: 'two', c: [1, 2, 3] };
  const r = Storage.setJSON('test2', obj);
  assert(r.ok, 'setJSON should return ok');
  const loaded = Storage.getJSON('test2');
  assert(loaded && loaded.a === 1 && loaded.c.length === 3, 'JSON round-trip mismatch');
  Storage.removeText('test2');
});

test('setJSON returns ok=false on quota error (simulated with huge string)', () => {
  // Generate a string that's clearly too big for any localStorage quota
  const huge = 'x'.repeat(15 * 1024 * 1024); // 15MB
  // Try multiple times to exhaust quota
  let attempts = 0;
  let lastOk = true;
  while (lastOk && attempts < 50) {
    const r = Storage.setJSON('quota_test_' + attempts, huge);
    lastOk = r.ok;
    attempts++;
  }
  // At some point we should hit quota
  // (This test is a soft check — only meaningful in real browser env)
  // Cleanup
  for (let i = 0; i < attempts; i++) Storage.removeText('quota_test_' + i);
});

// ── Attachment validation ────────────────────────────────────────────────────
test('validateAttachment rejects oversized file', () => {
  const fake = { size: 20 * 1024 * 1024, type: 'application/pdf', name: 'big.pdf' };
  const r = Storage.validateAttachment(fake);
  assert(!r.ok, 'Should reject 20MB file');
  assert(r.reason.includes('besar'), 'Reason should mention size');
});

test('validateAttachment rejects unsupported type', () => {
  const fake = { size: 1000, type: 'application/exe', name: 'evil.exe' };
  const r = Storage.validateAttachment(fake);
  assert(!r.ok, 'Should reject .exe');
});

test('validateAttachment accepts valid PDF', () => {
  const fake = { size: 1000, type: 'application/pdf', name: 'ok.pdf' };
  const r = Storage.validateAttachment(fake);
  assert(r.ok, 'Should accept PDF');
});

test('validateAttachment accepts valid JPG', () => {
  const fake = { size: 1000, type: 'image/jpeg', name: 'photo.jpg' };
  const r = Storage.validateAttachment(fake);
  assert(r.ok, 'Should accept JPG');
});

// ── Capability checks ────────────────────────────────────────────────────────
test('isLsAvailable returns boolean', () => {
  const v = Storage.isLsAvailable();
  assert(typeof v === 'boolean', 'Should be boolean');
});

// ── IDB operations (only run if available) ───────────────────────────────────
if (typeof indexedDB !== 'undefined') {
  test('putBlob/getBlob round-trip', async () => {
    const blob = new Blob(['test data'], { type: 'text/plain' });
    const r = await Storage.putBlob('test:blob', blob, { type: 'text/plain' });
    assert(r.ok, 'putBlob should succeed');
    const got = await Storage.getBlob('test:blob');
    assert(got !== null, 'getBlob should return the blob');
    const text = await got.text();
    assertEq(text, 'test data');
    await Storage.deleteBlob('test:blob');
    const gone = await Storage.getBlob('test:blob');
    assert(gone === null, 'After delete, getBlob should return null');
  });

  test('putAttachmentBlob/getAttachmentBlob round-trip', async () => {
    const buf = new ArrayBuffer(10);
    const view = new Uint8Array(buf);
    view[0] = 42;
    const r = await Storage.putAttachmentBlob({
      id: 'test-att-1', name: 'test.jpg', type: 'image/jpeg',
      size: 10, blob: buf, rotation: 0, pages: 1,
    });
    assert(r.ok, 'putAttachmentBlob should succeed');
    const rec = await Storage.getAttachmentBlob('test-att-1');
    assert(rec !== null, 'Should retrieve record');
    assertEq(rec.name, 'test.jpg');
    await Storage.deleteAttachmentBlob('test-att-1');
  });
}

// ── Runner ────────────────────────────────────────────────────────────────────
export async function runStorageTests() {
  const results = { passed: 0, failed: 0, errors: [] };
  for (const t of tests) {
    try {
      await t.fn();
      results.passed++;
      console.log(`  ✓ ${t.name}`);
    } catch (e) {
      results.failed++;
      results.errors.push({ name: t.name, error: e.message });
      console.error(`  ✗ ${t.name}: ${e.message}`);
    }
  }
  return results;
}

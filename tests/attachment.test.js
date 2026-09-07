// ─── ATTACHMENT TESTS ────────────────────────────────────────────────────────

import { AttachmentStorage } from '../assets/js/attachments/attachment-storage.js';
import { rotateImageBlob, imageToA4Canvas, isImageLandscape } from '../assets/js/attachments/attachment-image.js';
import { AppState } from '../assets/js/core/state.js';

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }
function assert(cond, msg) { if (!cond) throw new Error('Assertion failed: ' + (msg || '')); }

// ── AttachmentStorage.save ─────────────────────────────────────────────────
test('save rejects oversized file', async () => {
  const fake = new File([new Uint8Array(20 * 1024 * 1024)], 'big.pdf', { type: 'application/pdf' });
  const r = await AttachmentStorage.save(fake);
  assert(!r.ok, 'Should reject 20MB file');
});

test('save rejects unsupported type', async () => {
  const fake = new File(['hello'], 'evil.exe', { type: 'application/exe' });
  const r = await AttachmentStorage.save(fake);
  assert(!r.ok, 'Should reject .exe');
});

test('save accepts valid image', async () => {
  // Generate a small PNG via canvas
  const canvas = document.createElement('canvas');
  canvas.width = 10; canvas.height = 10;
  const blob = await new Promise(r => canvas.toBlob(r, 'image/png'));
  const file = new File([blob], 'test.png', { type: 'image/png' });
  const r = await AttachmentStorage.save(file);
  assert(r.ok, 'Should accept valid PNG: ' + (r.reason || ''));
  if (r.ok) {
    // Cleanup
    await AttachmentStorage.remove(r.attachment.id);
  }
});

// ── Image rotation ──────────────────────────────────────────────────────────
test('rotateImageBlob produces valid Blob', async () => {
  const canvas = document.createElement('canvas');
  canvas.width = 20; canvas.height = 10;
  const blob = await new Promise(r => canvas.toBlob(r, 'image/jpeg'));
  const rotated = await rotateImageBlob(blob, 90);
  assert(rotated instanceof Blob, 'Should return Blob');
  assert(rotated.size > 0, 'Should have non-zero size');
});

test('isImageLandscape detects landscape image', async () => {
  const canvas = document.createElement('canvas');
  canvas.width = 100; canvas.height = 50; // landscape
  const blob = await new Promise(r => canvas.toBlob(r, 'image/png'));
  const landscape = await isImageLandscape(blob, 0);
  assert(landscape === true, 'Should detect landscape');
});

test('isImageLandscape detects portrait after 90° rotation', async () => {
  const canvas = document.createElement('canvas');
  canvas.width = 100; canvas.height = 50; // landscape, but rotated 90° becomes portrait
  const blob = await new Promise(r => canvas.toBlob(r, 'image/png'));
  const portraitAfterRotation = await isImageLandscape(blob, 90);
  assert(portraitAfterRotation === false, 'Should be portrait after 90° rotation');
});

// ── imageToA4Canvas aspect ratio preservation (B3 fix) ──────────────────────
test('imageToA4Canvas returns A4-sized canvas', async () => {
  const canvas = document.createElement('canvas');
  canvas.width = 100; canvas.height = 100;
  const blob = await new Promise(r => canvas.toBlob(r, 'image/png'));
  const result = await imageToA4Canvas(blob, 0);
  // Should be A4 portrait dimensions (scaled)
  assert(result.canvas.width > 0, 'Canvas should have width');
  assert(result.canvas.height > 0, 'Canvas should have height');
  // Aspect ratio of canvas should match A4 portrait
  const ratio = result.canvas.width / result.canvas.height;
  const a4Ratio = 794 / 1123;
  assert(Math.abs(ratio - a4Ratio) < 0.05, 'Canvas should be A4 aspect ratio');
});

// ── AppState integration ───────────────────────────────────────────────────
test('addAttachment + removeAttachment', () => {
  const before = AppState.get().attachments.length;
  AppState.addAttachment({ id: 'test-x', name: 'test', type: 'image/png', size: 100, rotation: 0, pages: 1 });
  assertEq(AppState.get().attachments.length, before + 1);
  AppState.removeAttachment('test-x');
  assertEq(AppState.get().attachments.length, before);
});

test('updateAttachment updates rotation', () => {
  AppState.addAttachment({ id: 'test-y', name: 'test', type: 'image/png', size: 100, rotation: 0, pages: 1 });
  AppState.updateAttachment('test-y', { rotation: 90 });
  assertEq(AppState.get().getAttachment?.('test-y')?.rotation, 90);
  AppState.removeAttachment('test-y');
});

function assertEq(a, b, msg) {
  if (a !== b) throw new Error(`Expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}. ${msg || ''}`);
}

export async function runAttachmentTests() {
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

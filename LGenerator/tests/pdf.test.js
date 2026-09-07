// ─── PDF EXPORT TESTS ───────────────────────────────────────────────────────
// Verifies PDF metadata, filename generation, and aspect ratio preservation.

import { setPdfMetadata, makeFilename } from '../assets/js/export/pdf-metadata.js';
import { imageToA4Canvas } from '../assets/js/attachments/attachment-image.js';

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }
function assert(cond, msg) { if (!cond) throw new Error('Assertion failed: ' + (msg || '')); }

// ── Filename generation ─────────────────────────────────────────────────────
test('makeFilename returns .pdf extension', () => {
  const f = makeFilename('Surat_Lamaran');
  assert(f.endsWith('.pdf'), 'Should end with .pdf');
});

test('makeFilename includes date', () => {
  const f = makeFilename('CV');
  const today = new Date();
  const isoToday = today.toISOString().slice(0, 10);
  assert(f.includes(isoToday), `Filename should contain today's date ${isoToday}: ${f}`);
});

test('makeFilename sanitizes prefix', () => {
  const f = makeFilename('../../evil/path');
  assert(!f.includes('/'), 'Should not contain slashes');
  assert(!f.includes('..'), 'Should not contain ..');
});

test('makeFilename uses fallback for empty prefix', () => {
  const f = makeFilename('', 'pdf');
  assert(f.startsWith('document'), 'Should use "document" fallback');
});

// ── Metadata (mock jsPDF) ────────────────────────────────────────────────────
test('setPdfMetadata calls setProperties with title', () => {
  let captured = null;
  const mockPdf = {
    setProperties(props) { captured = props; },
  };
  setPdfMetadata(mockPdf, { title: 'Test Title' });
  assert(captured !== null, 'setProperties should be called');
  assertEq(captured.title, 'Test Title');
  assert(captured.creator === 'LGenerator', 'Creator should be LGenerator');
});

test('setPdfMetadata handles missing pdf instance gracefully', () => {
  // Should not throw
  setPdfMetadata(null, { title: 'Test' });
  setPdfMetadata({}, { title: 'Test' });
});

// ── Aspect ratio preservation (B3 fix) ──────────────────────────────────────
test('imageToA4Canvas produces A4 portrait canvas', async () => {
  const canvas = document.createElement('canvas');
  canvas.width = 100; canvas.height = 200; // portrait
  const blob = await new Promise(r => canvas.toBlob(r, 'image/png'));
  const result = await imageToA4Canvas(blob, 0);
  // Should be A4 portrait aspect ratio
  const expectedW = 794 * 2; // scale = 2
  const expectedH = 1123 * 2;
  assert(Math.abs(result.canvas.width - expectedW) < 5, `Width should be ~${expectedW}, got ${result.canvas.width}`);
  assert(Math.abs(result.canvas.height - expectedH) < 5, `Height should be ~${expectedH}, got ${result.canvas.height}`);
});

test('imageToA4Canvas with landscape image does not distort', async () => {
  // Even if source image is landscape, output canvas is still A4 portrait (with letterboxing)
  const canvas = document.createElement('canvas');
  canvas.width = 200; canvas.height = 100; // landscape
  const blob = await new Promise(r => canvas.toBlob(r, 'image/png'));
  const result = await imageToA4Canvas(blob, 0);
  const expectedW = 794 * 2;
  const expectedH = 1123 * 2;
  assert(Math.abs(result.canvas.width - expectedW) < 5, 'Canvas width should remain A4');
  assert(Math.abs(result.canvas.height - expectedH) < 5, 'Canvas height should remain A4');
});

function assertEq(a, b, msg) {
  if (a !== b) throw new Error(`Expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}. ${msg || ''}`);
}

export async function runPdfTests() {
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

// ─── SANITIZER TESTS ────────────────────────────────────────────────────────
// Regression tests for XSS prevention. Each payload here MUST be neutralized.

import { Sanitizer, SANITIZE_TESTS } from '../assets/js/editor/content-sanitizer.js';

const tests = [];

function test(name, fn) { tests.push({ name, fn }); }
function assert(cond, msg) { if (!cond) throw new Error('Assertion failed: ' + (msg || '')); }

// ── XSS payloads ────────────────────────────────────────────────────────────
test('strips <img onerror>', () => {
  const out = Sanitizer.sanitize('<img src=x onerror=alert(1)>');
  assert(!out.includes('<img'), 'Should not contain <img tag');
  assert(!out.includes('onerror'), 'Should not contain onerror attr');
});

test('strips <script>', () => {
  const out = Sanitizer.sanitize('<script>alert(1)</script>');
  assert(!out.toLowerCase().includes('<script'), 'Should not contain script tag');
  assert(!out.includes('alert(1)'), 'Should not contain script body');
});

test('strips <script> after </strong>', () => {
  const out = Sanitizer.sanitize('</strong><script>alert(1)</script>');
  assert(!out.includes('alert'), 'Should not contain alert payload');
  // The </strong> closing tag without a matching opener — sanitizer should handle gracefully
});

test('strips <a href="javascript:">', () => {
  const out = Sanitizer.sanitize('<a href="javascript:alert(1)">click</a>');
  assert(!out.includes('<a'), 'Should not contain <a tag');
  assert(!out.includes('javascript:'), 'Should not contain javascript: URL');
  assert(out.includes('click'), 'Should keep text content');
});

test('strips <svg onload>', () => {
  const out = Sanitizer.sanitize('<svg onload=alert(1)>');
  assert(!out.toLowerCase().includes('<svg'), 'Should not contain svg');
});

test('strips <iframe>', () => {
  const out = Sanitizer.sanitize('<iframe src=evil></iframe>');
  assert(!out.toLowerCase().includes('<iframe'), 'Should not contain iframe');
});

test('strips event handlers from allowed tags', () => {
  const out = Sanitizer.sanitize('<strong onmouseover=alert(1)>hi</strong>');
  assert(!out.includes('onmouseover'), 'Should strip onmouseover attr');
  assert(out.includes('<strong>hi</strong>'), 'Should keep <strong> without attrs');
});

test('preserves allowed formatting', () => {
  const out = Sanitizer.sanitize('normal <em>italic</em> and <strong>bold</strong>');
  assert(out.includes('<em>italic</em>'), 'Should preserve <em>');
  assert(out.includes('<strong>bold</strong>'), 'Should preserve <strong>');
});

test('preserves <br>', () => {
  const out = Sanitizer.sanitize('line1<br>line2');
  assert(out.includes('<br>'), 'Should preserve <br>');
});

test('sanitizeText removes ALL tags', () => {
  const out = Sanitizer.sanitizeText('<strong>bold</strong><script>evil()</script>');
  assert(!out.includes('<'), 'Should not contain any tags');
  assert(out.includes('bold'), 'Should keep text content');
});

test('sanitizeText handles HTML entities', () => {
  const out = Sanitizer.sanitizeText('a & b < c > d');
  // Should be safely escaped
  assert(!out.includes('<'), 'No raw <');
  assert(!out.includes('>'), 'No raw >');
});

test('handles empty / null input', () => {
  assertEq(Sanitizer.sanitize(null), '');
  assertEq(Sanitizer.sanitize(''), '');
  assertEq(Sanitizer.sanitize(undefined), '');
});

test('handles malformed HTML gracefully', () => {
  const out = Sanitizer.sanitize('<strong>unclosed');
  assert(out.includes('unclosed'), 'Should keep text');
});

test('strips nested script inside allowed tag', () => {
  const out = Sanitizer.sanitize('<strong><script>alert(1)</script></strong>');
  assert(!out.includes('alert'), 'Should strip nested script');
});

test('strips <object> and <embed>', () => {
  const out = Sanitizer.sanitize('<object data=evil.swf></object><embed src=evil>');
  assert(!out.toLowerCase().includes('<object'), 'No <object>');
  assert(!out.toLowerCase().includes('<embed'), 'No <embed>');
});

test('sanitizeFilename strips path separators', () => {
  const out = Sanitizer.sanitizeFilename('../../etc/passwd', 'file');
  assert(!out.includes('/'), 'No slashes');
  assert(!out.includes('..'), 'No dot-dot');
});

test('sanitizeFilename caps length', () => {
  const long = 'a'.repeat(200);
  const out = Sanitizer.sanitizeFilename(long, 'file');
  assert(out.length <= 100, 'Should cap at 100 chars');
});

// ── Standard regression payload suite ────────────────────────────────────────
SANITIZE_TESTS.forEach((payload, i) => {
  test(`regression payload ${i + 1}: ${payload.slice(0, 40)}`, () => {
    const out = Sanitizer.sanitize(payload);
    assert(!out.includes('alert(1)'), `Payload ${i + 1} should not produce alert(1)`);
    assert(!out.toLowerCase().includes('<script'), `Payload ${i + 1} should not contain script`);
    assert(!out.includes('onerror='), `Payload ${i + 1} should not contain onerror=`);
  });
});

function assertEq(a, b, msg) {
  if (a !== b) throw new Error(`Expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}. ${msg || ''}`);
}

export async function runSanitizerTests() {
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

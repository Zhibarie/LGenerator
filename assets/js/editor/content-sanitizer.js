// ─── CONTENT SANITIZER ──────────────────────────────────────────────────────
// Whitelist-based HTML sanitizer. All user input is treated as untrusted.
//
// Default policy: allow ONLY inline formatting tags (<strong>, <b>, <em>, <i>,
// <br>, <u>) with NO attributes. Everything else is escaped or stripped.
//
// Use:
//   el.innerHTML = Sanitizer.sanitize(userInput);
//   el.textContent = userText;           // simpler, no formatting — preferred

import { SANITIZE_WHITELIST } from '../core/constants.js';

const ALLOWED = new Set(SANITIZE_WHITELIST.tags);
const DENIED_ATTRS = [
  'onerror', 'onload', 'onclick', 'onmouseover', 'onmouseenter', 'onmouseleave',
  'onmousedown', 'onmouseup', 'onmousemove', 'onkeydown', 'onkeyup', 'onkeypress',
  'onfocus', 'onblur', 'onchange', 'oninput', 'onsubmit', 'onreset',
  'ontoggle', 'onanimationstart', 'onanimationend', 'ontransitionend',
];

/**
 * Sanitize an HTML string. Returns safe HTML that may be set via innerHTML.
 * Strategy:
 *   - Parse with DOMParser (off-main-thread-ish, no script execution)
 *   - Walk the tree, drop disallowed tags (but keep their text children)
 *   - Strip ALL attributes (defense in depth — even on allowed tags)
 *   - Drop <script>, <iframe>, <object>, <embed>, <svg>, <style> entirely
 *   - Strip javascript: URLs
 *
 * If parsing fails, fall back to escaping everything.
 */
export const Sanitizer = {
  sanitize(input, opts = {}) {
    if (input == null) return '';
    const str = String(input);
    if (!str) return '';

    try {
      const doc = new DOMParser().parseFromString(str, 'text/html');
      const out = walk(doc.body, opts);
      return out.innerHTML;
    } catch (e) {
      // DOMParser shouldn't throw on strings, but be defensive
      return escapeAll(str);
    }
  },

  /** Sanitize a plain text input — strips ALL tags, returns safe text. */
  sanitizeText(input) {
    if (input == null) return '';
    const str = String(input);
    // Remove anything that looks like a tag
    const stripped = str.replace(/<[^>]*>/g, '');
    return escapeAll(stripped);
  },

  /**
   * Allow inline formatting by transforming user-typed text into safe HTML.
   * Use for fields where the user explicitly types bold/italic via our UI
   * controls (NOT for arbitrary pasted content).
   */
  sanitizeWithFormatting(input) {
    return Sanitizer.sanitize(input, { allowFormatting: true });
  },

  /**
   * Sanitize a filename for safe filesystem usage.
   * Strips path separators, control chars, leading dots, collapses whitespace.
   */
  sanitizeFilename(name, fallback = 'file') {
    if (!name) return fallback;
    const cleaned = String(name)
      .replace(/[<>:"/\\|?*\x00-\x1F]/g, '')
      .replace(/\s+/g, '_')
      .replace(/\.{2,}/g, '.')
      .replace(/^\.+/, '')
      .slice(0, 100);
    return cleaned || fallback;
  },
};

function walk(node, opts) {
  // Build a clean fragment
  const frag = document.createDocumentFragment();
  node.childNodes.forEach(child => {
    if (child.nodeType === Node.TEXT_NODE) {
      frag.appendChild(document.createTextNode(child.textContent));
      return;
    }
    if (child.nodeType !== Node.ELEMENT_NODE) return;

    const tag = child.tagName.toUpperCase();

    // Always drop these entirely
    if (['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'SVG', 'META', 'LINK', 'BASE', 'FORM'].includes(tag)) {
      return;
    }

    if (ALLOWED.has(tag)) {
      const clean = document.createElement(tag.toLowerCase());
      // NO attributes allowed — strip all
      // Recurse into children
      const inner = walk(child, opts);
      while (inner.firstChild) clean.appendChild(inner.firstChild);
      frag.appendChild(clean);
    } else {
      // Unknown tag — unwrap: keep its (sanitized) children
      const inner = walk(child, opts);
      while (inner.firstChild) frag.appendChild(inner.firstChild);
    }
  });
  return frag;
}

function escapeAll(s) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ── Regression test payloads (verify these never execute) ──────────────────
export const SANITIZE_TESTS = [
  '<img src=x onerror=alert(1)>',                       // expect: text only, no img, no onerror
  '<script>alert(1)</script>',                          // expect: stripped
  '</strong><script>alert(1)</script>',                 // expect: <strong></strong> + script removed
  '<a href="javascript:alert(1)">click</a>',            // expect: "click" text, no <a>
  '<svg onload=alert(1)>',                              // expect: stripped
  '<iframe src=evil></iframe>',                         // expect: stripped
  '<strong onmouseover=alert(1)>hi</strong>',           // expect: <strong>hi</strong>
  'normal text with <em>emphasis</em>',                 // expect: kept as-is
];

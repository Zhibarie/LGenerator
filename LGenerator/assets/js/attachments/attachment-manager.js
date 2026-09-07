// ─── ATTACHMENT MANAGER ────────────────────────────────────────────────────
// Central orchestrator for the lampiran (attachment) subsystem.
//
// Owns the link between AppState.letter.attachments (rows with id + text +
// attachmentId) and AppState.attachments (binary metadata).
//
// Listens to:
//   - 'attachment:open-modal'   — from LetterEditor upload button
//   - 'attachment:link'         — from AttachmentPreview apply/remove
//   - 'attachment:detach'       — from LetterEditor remove button (text row kept)
//   - 'attachment:rotate'       — from AttachmentPreview rotate90

import { AppState } from '../core/state.js';
import { EventBus, EVT } from '../core/events.js';
import { AttachmentStorage } from './attachment-storage.js';
import { AttachmentPreview } from './attachment-preview.js';

export const AttachmentManager = {
  init() {
    AttachmentPreview.init();

    // Link an attachment to a letter row (or unlink if attachmentId is null)
    EventBus.on('attachment:link', ({ lampId, attachmentId, meta }) => {
      const items = AppState.get().letter.attachments.slice();
      const idx = items.findIndex(a => a.id === lampId);
      if (idx === -1) return;

      items[idx] = { ...items[idx], attachmentId };

      // Maintain AppState.attachments[] — the binary metadata index
      const attachments = AppState.get().attachments.slice();
      if (attachmentId) {
        const existIdx = attachments.findIndex(a => a.id === attachmentId);
        if (existIdx >= 0) {
          attachments[existIdx] = { ...attachments[existIdx], ...(meta || {}) };
        } else if (meta) {
          attachments.push({ id: attachmentId, ...meta });
        }
      } else {
        // Detach: keep meta in AppState.attachments[] (blob stays in IDB until explicit removal)
        // Or remove entirely if requested — for now just unlink.
      }

      AppState.setLetterAttachments(items);
      // Direct internal update to attachments (no public setter for bulk)
      // Use a hack: call hydrate-style patch
      AppState.get().attachments = attachments;
      EventBus.emit(EVT.STATE_DIRTY);
    });

    // Detach (remove binary file) from a letter row, but keep text row
    EventBus.on('attachment:detach', async ({ lampId }) => {
      const items = AppState.get().letter.attachments.slice();
      const idx = items.findIndex(a => a.id === lampId);
      if (idx === -1) return;
      const oldId = items[idx].attachmentId;
      if (!oldId) {
        // No file attached — just remove the text row entirely
        const next = items.filter(a => a.id !== lampId);
        AppState.setLetterAttachments(next);
        return;
      }
      // Remove binary blob
      await AttachmentStorage.remove(oldId);
      items[idx] = { ...items[idx], attachmentId: null };
      AppState.setLetterAttachments(items);
      // Remove from attachments index too
      AppState.get().attachments = AppState.get().attachments.filter(a => a.id !== oldId);
      EventBus.emit(EVT.NOTIFY, { type: 'info', msg: 'Lampiran dilepas.' });
    });
  },

  /** Returns the total count of attachments linked to the letter. */
  countLinked() {
    return AppState.get().letter.attachments.filter(a => a.attachmentId).length;
  },

  /** Returns metadata for all linked attachments (for export). */
  async getLinkedForExport() {
    const linked = AppState.get().letter.attachments.filter(a => a.attachmentId);
    const out = [];
    for (const la of linked) {
      const rec = await AttachmentStorage.getRecord(la.attachmentId);
      if (rec) {
        out.push({
          lampId: la.id,
          name: la.text || rec.name,
          id: la.attachmentId,
          blob: rec.blob,
          type: rec.type,
          size: rec.size,
          rotation: rec.rotation || 0,
          pages: rec.pages || 1,
        });
      }
    }
    return out;
  },

  /** Wipe all attachments (used by Reset All). */
  async wipeAll() {
    const all = AppState.get().attachments.slice();
    for (const a of all) {
      await AttachmentStorage.remove(a.id);
    }
    AppState.get().attachments = [];
  },
};

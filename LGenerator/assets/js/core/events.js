// ─── EVENT BUS ──────────────────────────────────────────────────────────────
// Decoupled pub/sub. Modules communicate through named events, not direct calls.

const listeners = new Map();

export const EventBus = {
  /**
   * Subscribe to an event. Returns an unsubscribe function.
   * @param {string} type
   * @param {(payload:any, type:string)=>void} fn
   */
  on(type, fn) {
    if (!listeners.has(type)) listeners.set(type, new Set());
    listeners.get(type).add(fn);
    return () => this.off(type, fn);
  },

  off(type, fn) {
    const set = listeners.get(type);
    if (set) set.delete(fn);
  },

  emit(type, payload) {
    const set = listeners.get(type);
    if (!set) return;
    // Spread to array so handlers can safely unsubscribe during emit
    [...set].forEach(fn => {
      try { fn(payload, type); }
      catch (e) { console.error(`[EventBus] handler error for "${type}":`, e); }
    });
  },

  /** Test helper: clear all listeners */
  _clear() { listeners.clear(); },
};

// Standard event names — kept as constants to avoid typos
export const EVT = {
  // State
  STATE_CHANGED: 'state:changed',
  STATE_DIRTY:   'state:dirty',
  STATE_SAVED:   'state:saved',
  STATE_SAVE_FAILED: 'state:save-failed',

  // Letter
  LETTER_FIELD_CHANGED: 'letter:field-changed',
  LETTER_ATTACHMENTS_CHANGED: 'letter:attachments-changed',

  // CV
  CV_CHANGED: 'cv:changed',
  CV_PHOTO_CHANGED: 'cv:photo-changed',

  // Signature
  SIG_CHANGED: 'sig:changed',

  // Attachments
  ATTACHMENT_ADDED:    'attachment:added',
  ATTACHMENT_REMOVED:  'attachment:removed',
  ATTACHMENT_ROTATED:  'attachment:rotated',

  // UI
  MODAL_OPEN:  'ui:modal-open',
  MODAL_CLOSE: 'ui:modal-close',
  TAB_CHANGED: 'ui:tab-changed',
  NOTIFY:      'ui:notify',
  LOADING:     'ui:loading',

  // Export
  EXPORT_START:    'export:start',
  EXPORT_PROGRESS: 'export:progress',
  EXPORT_DONE:     'export:done',
  EXPORT_ERROR:    'export:error',
  EXPORT_CANCEL:   'export:cancel',

  // Responsive
  VIEWPORT_RESIZE: 'viewport:resize',
  ORIENTATION_CHANGE: 'viewport:orientation',
};

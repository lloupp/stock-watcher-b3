// toast.js — Notificações toast (Fase 7: polimento e extras)
// Sistema de toasts leve, sem dependências. Cria um container fixo no canto
// inferior direito e empilha as notificações. Auto-dismiss configurável.
//
// API pública (exportada):
//   toast(message, opts?)  → exibe um toast; retorna o elemento criado
//   toast.success(msg)     → atalho verde
//   toast.error(msg)       → atalho vermelho
//   toast.info(msg)        → atalho neutro (accent)
//   toast.dismiss(el)      → remove um toast específico
//   toast.clear()          → remove todos os toasts

const TOAST_CSS_INJECTED = '__sw_toast_injected__';

const ICONS = {
  success: '✓',
  error:   '✕',
  info:    'ℹ',
  warn:    '⚠',
};

function injectStyles() {
  if (window[TOAST_CSS_INJECTED]) return;
  window[TOAST_CSS_INJECTED] = true;
  const css = `
/* ===== Fase 7 — Toast notifications ===== */
.sw-toast-container {
  position: fixed;
  bottom: 20px;
  right: 20px;
  z-index: 500;
  display: flex;
  flex-direction: column-reverse;
  gap: 10px;
  pointer-events: none;
  max-width: calc(100vw - 40px);
}

.sw-toast {
  pointer-events: auto;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  min-width: 220px;
  max-width: 360px;
  background: #131822;
  border: 1px solid #2a3144;
  border-left-width: 4px;
  border-radius: 10px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
  color: #e4e7ef;
  font-size: 0.88rem;
  line-height: 1.4;
  opacity: 0;
  transform: translateX(120%);
  transition: opacity 0.25s ease, transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.sw-toast.is-visible {
  opacity: 1;
  transform: translateX(0);
}

.sw-toast.is-leaving {
  opacity: 0;
  transform: translateX(120%);
  pointer-events: none;
}

.sw-toast__icon {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  font-size: 0.85rem;
  font-weight: 700;
  line-height: 1;
}

.sw-toast__body {
  flex: 1;
  min-width: 0;
  word-break: break-word;
}

.sw-toast__close {
  flex-shrink: 0;
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  color: #5a606f;
  font-size: 0.7rem;
  background: transparent;
  cursor: pointer;
  transition: color 0.15s ease, background 0.15s ease;
  padding: 0;
  border: none;
}

.sw-toast__close:hover {
  color: #e4e7ef;
  background: rgba(255, 255, 255, 0.08);
}

/* Variantes (cor da borda esquerda + ícone) */
.sw-toast--success { border-left-color: #22c55e; }
.sw-toast--success .sw-toast__icon { background: rgba(34,197,94,0.15); color: #22c55e; }

.sw-toast--error { border-left-color: #ef4444; }
.sw-toast--error .sw-toast__icon { background: rgba(239,68,68,0.15); color: #ef4444; }

.sw-toast--warn { border-left-color: #f59e0b; }
.sw-toast--warn .sw-toast__icon { background: rgba(245,158,11,0.15); color: #f59e0b; }

.sw-toast--info { border-left-color: #3b82f6; }
.sw-toast--info .sw-toast__icon { background: rgba(59,130,246,0.15); color: #3b82f6; }

/* Mobile: toasts ocupam largura total na base */
@media (max-width: 480px) {
  .sw-toast-container {
    left: 12px;
    right: 12px;
    bottom: 12px;
    max-width: none;
  }
  .sw-toast {
    max-width: 100%;
    min-width: 0;
    width: 100%;
  }
}

/* Respeita prefers-reduced-motion */
@media (prefers-reduced-motion: reduce) {
  .sw-toast, .sw-toast.is-visible, .sw-toast.is-leaving {
    transition-duration: 0.01ms !important;
    transform: none !important;
  }
}
`;
  const style = document.createElement('style');
  style.setAttribute('data-sw-toast', '');
  style.textContent = css;
  document.head.appendChild(style);
}

function ensureContainer() {
  let el = document.querySelector('.sw-toast-container');
  if (!el) {
    el = document.createElement('div');
    el.className = 'sw-toast-container';
    el.setAttribute('aria-live', 'polite');
    el.setAttribute('aria-atomic', 'false');
    el.setAttribute('role', 'status');
    document.body.appendChild(el);
  }
  return el;
}

/**
 * Exibe um toast.
 * @param {string} message — texto da notificação
 * @param {object} opts — { type: 'success'|'error'|'warn'|'info', duration: ms (0 = sticky), dismissible: bool }
 * @returns {HTMLElement} o elemento .sw-toast criado
 */
export function toast(message, opts = {}) {
  const {
    type = 'info',
    duration = 4000,
    dismissible = true,
  } = opts;

  injectStyles();
  const container = ensureContainer();

  const el = document.createElement('div');
  el.className = `sw-toast sw-toast--${type}`;
  el.setAttribute('role', type === 'error' ? 'alert' : 'status');

  const icon = ICONS[type] || ICONS.info;
  el.innerHTML = `
    <span class="sw-toast__icon" aria-hidden="true">${icon}</span>
    <span class="sw-toast__body"></span>
    ${dismissible ? '<button class="sw-toast__close" type="button" aria-label="Fechar notificação">✕</button>' : ''}
  `;
  // setText em vez de innerHTML evita injeção de HTML
  el.querySelector('.sw-toast__body').textContent = String(message ?? '');

  // Botão de fechar
  if (dismissible) {
    el.querySelector('.sw-toast__close')?.addEventListener('click', () => dismiss(el));
  }

  container.appendChild(el);
  // Força reflow para a animação de entrada disparar
  void el.offsetWidth;
  el.classList.add('is-visible');

  // Auto-dismiss
  if (duration > 0) {
    const timer = setTimeout(() => dismiss(el), duration);
    el._swToastTimer = timer;
  }

  return el;
}

/** Remove um toast específico (com animação de saída). */
export function dismiss(el) {
  if (!el || !el.isConnected) return;
  if (el._swToastTimer) {
    clearTimeout(el._swToastTimer);
    el._swToastTimer = null;
  }
  el.classList.add('is-leaving');
  el.classList.remove('is-visible');
  const remove = () => {
    if (el.isConnected) el.remove();
  };
  el.addEventListener('transitionend', remove, { once: true });
  // Fallback caso transitionend não dispare (reduced-motion, etc.)
  setTimeout(remove, 350);
}

/** Remove todos os toasts. */
export function clearToasts() {
  const container = document.querySelector('.sw-toast-container');
  if (!container) return;
  container.querySelectorAll('.sw-toast').forEach(dismiss);
}

// Atalhos semânticos
toast.success = (msg, opts) => toast(msg, { ...opts, type: 'success' });
toast.error   = (msg, opts) => toast(msg, { ...opts, type: 'error',   duration: opts?.duration ?? 6000 });
toast.warn    = (msg, opts) => toast(msg, { ...opts, type: 'warn',    duration: opts?.duration ?? 5000 });
toast.info    = (msg, opts) => toast(msg, { ...opts, type: 'info' });
toast.dismiss = dismiss;
toast.clear   = clearToasts;

export { clearToasts as clearAllToasts };

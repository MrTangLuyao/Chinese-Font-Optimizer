// Popup picker — reads/writes chrome.storage.sync; content.js listens for
// the change and re-injects styles in every tab without a reload.

const FONT_KEY = 'font';
const DISABLED_KEY = 'disabledSites';
const DEFAULT_FONT = 'harmony';

const opts       = document.querySelectorAll('.opt');
const optsWrap   = document.getElementById('opts');
const toggle     = document.getElementById('site-toggle');
const hostLabel  = document.getElementById('site-host');
const siteLabel  = document.getElementById('site-label');

let currentHost = '';

// ─── Helpers ─────────────────────────────────────────────────────────────
function setFontActive(font) {
  opts.forEach(opt => {
    const isActive = opt.dataset.font === font;
    opt.classList.toggle('active', isActive);
    const input = opt.querySelector('input');
    if (input) input.checked = isActive;
  });
}

function setSwitchState(enabled) {
  toggle.setAttribute('aria-checked', enabled ? 'true' : 'false');
  siteLabel.textContent = enabled ? '在此网站启用' : '在此网站已禁用';
  optsWrap.classList.toggle('is-disabled', !enabled);
}

function disableSwitch(reason) {
  toggle.disabled = true;
  hostLabel.textContent = reason;
  siteLabel.textContent = '此页面无法切换';
  optsWrap.classList.remove('is-disabled');
}

// Ripple effect — port of louie.css ripple onto the font cards.
function attachRipple(el) {
  el.addEventListener('pointerdown', (e) => {
    const rect = el.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    const ripple = document.createElement('span');
    ripple.className = 'ripple';
    ripple.style.width = ripple.style.height = `${size}px`;
    ripple.style.left = `${e.clientX - rect.left - size / 2}px`;
    ripple.style.top  = `${e.clientY - rect.top - size / 2}px`;
    el.appendChild(ripple);
    setTimeout(() => ripple.remove(), 600);
  });
}

// ─── Init ────────────────────────────────────────────────────────────────
async function init() {
  // 1. Resolve current tab's hostname (granted by activeTab on action click)
  let tab;
  try {
    [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  } catch (e) { tab = null; }

  if (tab && tab.url) {
    try {
      const u = new URL(tab.url);
      if (u.protocol === 'http:' || u.protocol === 'https:' || u.protocol === 'file:') {
        currentHost = u.hostname || u.protocol.slice(0, -1);
      } else {
        // chrome://, edge://, about:, etc. — content scripts don't run on these
        disableSwitch(u.protocol.slice(0, -1) + '://');
      }
    } catch (e) {
      disableSwitch('未知页面');
    }
  } else {
    disableSwitch('未知页面');
  }

  // 2. Load stored state
  let font = DEFAULT_FONT;
  let disabledSites = [];
  try {
    const got = await chrome.storage.sync.get([FONT_KEY, DISABLED_KEY]);
    if (got[FONT_KEY]) font = got[FONT_KEY];
    if (Array.isArray(got[DISABLED_KEY])) disabledSites = got[DISABLED_KEY];
  } catch (e) { /* default state */ }

  setFontActive(font);

  if (currentHost) {
    hostLabel.textContent = currentHost;
    setSwitchState(!disabledSites.includes(currentHost));
  }
}

// ─── Toggle (per-site enable/disable) ────────────────────────────────────
toggle.addEventListener('click', async () => {
  if (toggle.disabled || !currentHost) return;

  const wasEnabled = toggle.getAttribute('aria-checked') === 'true';
  const nextEnabled = !wasEnabled;
  setSwitchState(nextEnabled); // optimistic

  try {
    const got = await chrome.storage.sync.get(DISABLED_KEY);
    const list = Array.isArray(got[DISABLED_KEY]) ? got[DISABLED_KEY] : [];
    let next;
    if (nextEnabled) {
      next = list.filter(h => h !== currentHost);
    } else {
      next = list.includes(currentHost) ? list : [...list, currentHost];
    }
    await chrome.storage.sync.set({ [DISABLED_KEY]: next });
  } catch (e) {
    // revert UI if storage write fails
    setSwitchState(wasEnabled);
  }
});

// ─── Font cards ──────────────────────────────────────────────────────────
opts.forEach(opt => {
  attachRipple(opt);
  opt.addEventListener('click', async (e) => {
    e.preventDefault();
    if (optsWrap.classList.contains('is-disabled')) return;
    const font = opt.dataset.font;
    setFontActive(font);
    try { await chrome.storage.sync.set({ [FONT_KEY]: font }); } catch (e) {}
  });
});

init();

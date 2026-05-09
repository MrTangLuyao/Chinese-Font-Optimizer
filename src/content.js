// 中文字体优化 — content script
//
// Replaces CJK glyphs site-wide with the user's chosen font (HarmonyOS Sans /
// OPPO Sans / MiSans). Latin characters are NOT touched: the @font-face's
// unicode-range gates our font to CJK ranges only, and the * override keeps
// the page's original body font as the fallback for everything else.
//
// Per-site disable: hostnames in chrome.storage.sync.disabledSites cause the
// extension to skip injection (and remove an already-injected style if the
// user disables mid-session via the popup switch).

(() => {
  const STYLE_ID    = '__cn_font_optimizer__';
  const FAMILY      = '__cn_font_optimizer_face__';
  const FONT_KEY    = 'font';
  const DISABLED_KEY = 'disabledSites';
  const DEFAULT_FONT = 'harmony';

  const url = (path) => chrome.runtime.getURL(path);

  // CJK ranges only — Latin/Greek/Cyrillic etc. fall through to the next
  // font in the stack, which we set to the page's original body font.
  const CJK_RANGE = [
    'U+2E80-2FFF',   // CJK Radicals Supplement, Kangxi Radicals
    'U+3000-303F',   // CJK Symbols and Punctuation
    'U+3040-309F',   // Hiragana
    'U+30A0-30FF',   // Katakana
    'U+3100-312F',   // Bopomofo
    'U+3200-33FF',   // Enclosed CJK Letters, CJK Compatibility
    'U+3400-4DBF',   // CJK Extension A
    'U+4E00-9FFF',   // CJK Unified Ideographs
    'U+F900-FAFF',   // CJK Compatibility Ideographs
    'U+FE30-FE4F',   // CJK Compatibility Forms
    'U+FF00-FFEF',   // Halfwidth and Fullwidth Forms
  ].join(', ');

  const FONTS = {
    harmony: {
      label: 'HarmonyOS Sans',
      faces: [
        { file: 'fonts/HarmonyOS-Regular.ttf', weight: 400, format: 'truetype' },
        { file: 'fonts/HarmonyOS-Bold.ttf',    weight: 700, format: 'truetype' },
      ],
    },
    oppo: {
      label: 'OPPO Sans',
      faces: [
        { file: 'fonts/OppoSans-Regular.ttf', weight: 400, format: 'truetype' },
        { file: 'fonts/OppoSans-Bold.ttf',    weight: 700, format: 'truetype' },
      ],
    },
    mi: {
      label: 'MiSans',
      faces: [
        { file: 'fonts/MiSans-Regular.woff2', weight: 400, format: 'woff2' },
        { file: 'fonts/MiSans-Bold.woff2',    weight: 700, format: 'woff2' },
      ],
    },
  };

  // Tracks whether the current site is disabled, so the SPA-reinject observer
  // doesn't reinstate the style after the user just turned it off.
  let isDisabled = false;
  const currentHost = location.hostname || '';

  // Cache the page's ORIGINAL body font-family before we ever inject our
  // override, so subsequent re-injections (after font switch) still use the
  // true original as the fallback chain.
  let originalBodyFont = null;
  function captureOriginalBodyFont() {
    if (originalBodyFont !== null) return originalBodyFont;
    if (!document.body) return 'sans-serif';
    const computed = getComputedStyle(document.body).fontFamily || '';
    const cleaned = computed
      .split(',')
      .map(s => s.trim())
      .filter(s => s && !s.includes(FAMILY))
      .join(', ');
    originalBodyFont = cleaned || 'sans-serif';
    return originalBodyFont;
  }

  function buildCSS(config) {
    const faceRules = config.faces.map(f => `
@font-face {
  font-family: '${FAMILY}';
  src: url('${url(f.file)}') format('${f.format}');
  font-weight: ${f.weight};
  font-style: normal;
  font-display: swap;
  unicode-range: ${CJK_RANGE};
}`).join('\n');

    const fallback = captureOriginalBodyFont();
    // The selector excludes:
    //   • icon-font containers (Font Awesome, Material, glyphicon, codicon, <i>, <svg>)
    //   • code containers (<pre>, <code>, <kbd>, <samp>, <tt>) AND all their
    //     descendants — so syntax-highlight token spans inside <pre><code>
    //     keep the site's monospace font for Latin chars instead of falling
    //     back to body's sans-serif. CJK in code blocks then rides the site's
    //     monospace stack, which is an acceptable trade-off.
    //   • code-editor wrappers (Monaco, CodeMirror 5/6) and their descendants.
    const overrideRules = `
*:not([class*="icon"]):not([class*="Icon"]):not([class*="fa-"]):not([class*="fas-"]):not([class*="far-"]):not([class*="fab-"]):not([class^="fa "]):not(.material-icons):not(.material-icons-outlined):not(.material-icons-round):not(.material-icons-sharp):not(.material-icons-two-tone):not(.material-symbols-outlined):not(.material-symbols-rounded):not(.material-symbols-sharp):not(.glyphicon):not([class*="codicon"]):not(i):not(svg):not(svg *):not(pre):not(pre *):not(code):not(code *):not(kbd):not(samp):not(tt):not(.monaco-editor):not(.monaco-editor *):not(.CodeMirror):not(.CodeMirror *):not(.cm-editor):not(.cm-editor *) {
  font-family: '${FAMILY}', ${fallback} !important;
}
`;
    return faceRules + '\n' + overrideRules;
  }

  function injectStyle(css) {
    let style = document.getElementById(STYLE_ID);
    if (!style) {
      style = document.createElement('style');
      style.id = STYLE_ID;
      (document.head || document.documentElement).appendChild(style);
    }
    style.textContent = css;
  }

  function removeStyle() {
    const style = document.getElementById(STYLE_ID);
    if (style) style.remove();
  }

  async function apply() {
    let choice = DEFAULT_FONT;
    let disabledSites = [];
    try {
      const got = await chrome.storage.sync.get([FONT_KEY, DISABLED_KEY]);
      if (got && got[FONT_KEY] && FONTS[got[FONT_KEY]]) choice = got[FONT_KEY];
      if (Array.isArray(got && got[DISABLED_KEY])) disabledSites = got[DISABLED_KEY];
    } catch (e) { /* storage unavailable — fall through with defaults */ }

    isDisabled = currentHost && disabledSites.includes(currentHost);
    if (isDisabled) {
      removeStyle();
      return;
    }
    injectStyle(buildCSS(FONTS[choice]));
  }

  function whenBodyReady(cb) {
    if (document.body) { cb(); return; }
    const obs = new MutationObserver(() => {
      if (document.body) { obs.disconnect(); cb(); }
    });
    obs.observe(document.documentElement || document, { childList: true, subtree: true });
  }

  whenBodyReady(apply);

  // Re-apply when the user changes font OR toggles the per-site switch
  if (chrome.storage && chrome.storage.onChanged) {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== 'sync') return;
      if (changes[FONT_KEY] || changes[DISABLED_KEY]) apply();
    });
  }

  // Some SPAs wipe <head> on navigation — re-inject if our style disappears,
  // unless the site is currently disabled.
  const reinjectObserver = new MutationObserver(() => {
    if (isDisabled) return;
    if (!document.getElementById(STYLE_ID)) apply();
  });
  function startReinjectWatch() {
    if (document.documentElement) {
      reinjectObserver.observe(document.documentElement, { childList: true, subtree: true });
    }
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startReinjectWatch, { once: true });
  } else {
    startReinjectWatch();
  }
})();

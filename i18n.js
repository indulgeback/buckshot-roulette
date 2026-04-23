// ====== i18n Module ======
// Lightweight internationalization for Buckshot Roulette

const STORAGE_KEY = 'buckshot_lang';
const SUPPORTED_LANGS = ['zh-CN', 'en', 'ja'];
const FALLBACK_LANG = 'en';

let currentLang = FALLBACK_LANG;
let packs = {};       // cached language packs
let listeners = [];   // callbacks on lang change

// ====== Core API ======

/**
 * Translate a key, with optional variable interpolation.
 * t('event.roundStart', {live: 2, blank: 3})
 * → "回合开始！2发实弹 3发空弹"
 */
export function t(key, vars) {
    const pack = packs[currentLang] || packs[FALLBACK_LANG] || {};
    let str = pack[key];
    if (str === undefined) {
        // fallback: try fallback lang
        const fallback = packs[FALLBACK_LANG] || {};
        str = fallback[key];
    }
    if (str === undefined) return key; // last resort: show key

    if (vars) {
        for (const [k, v] of Object.entries(vars)) {
            str = str.replace(new RegExp(`\\{${k}\\}`, 'g'), v);
        }
    }
    return str;
}

/** Get current language code */
export function getLang() {
    return currentLang;
}

/** Get all supported languages */
export function getSupportedLangs() {
    return SUPPORTED_LANGS;
}

/** Register a callback to run when language changes */
export function onLangChange(fn) {
    listeners.push(fn);
}

/**
 * Switch language. Loads pack if not cached, updates DOM, fires listeners.
 */
export async function setLang(lang) {
    if (!SUPPORTED_LANGS.includes(lang)) return;
    if (lang === currentLang && packs[lang]) return; // already loaded

    currentLang = lang;
    localStorage.setItem(STORAGE_KEY, lang);

    await loadPack(lang);
    updateDOM();

    for (const fn of listeners) {
        try { fn(lang); } catch (e) { console.warn('i18n listener error:', e); }
    }
}

/**
 * Update all DOM elements with data-i18n attribute.
 * - data-i18n="key"           → set textContent
 * - data-i18n="key" data-i18n-html="true" → set innerHTML
 * - data-i18n="key" data-i18n-attr="title" → set attribute
 */
export function updateDOM() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        const isHtml = el.getAttribute('data-i18n-html') === 'true';
        const attr = el.getAttribute('data-i18n-attr');

        // Parse interpolation vars from data-i18n-vars (JSON)
        let vars = undefined;
        const varsAttr = el.getAttribute('data-i18n-vars');
        if (varsAttr) {
            try { vars = JSON.parse(varsAttr); } catch (e) { /* ignore */ }
        }

        if (attr) {
            el.setAttribute(attr, t(key, vars));
        } else if (isHtml) {
            el.innerHTML = t(key, vars);
        } else {
            el.textContent = t(key, vars);
        }
    });

    // Update html lang attribute
    document.documentElement.lang = currentLang;
}

/**
 * Initialize i18n: load saved language preference (or default), load pack, update DOM.
 */
export async function initI18n() {
    const saved = localStorage.getItem(STORAGE_KEY);
    currentLang = SUPPORTED_LANGS.includes(saved) ? saved : FALLBACK_LANG;

    // Always load fallback + current
    if (currentLang !== FALLBACK_LANG) {
        await loadPack(FALLBACK_LANG);
    }
    await loadPack(currentLang);

    updateDOM();
}

// ====== Internal ======

async function loadPack(lang) {
    if (packs[lang]) return; // already cached
    try {
        const resp = await fetch(`lang/${lang}.json`);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        packs[lang] = await resp.json();
    } catch (e) {
        console.warn(`Failed to load language pack: ${lang}`, e);
        packs[lang] = {};
    }
}

// ==UserScript==
// @name         CDN Bakery — Mobile Fix
// @namespace    https://chat.cdnbakery.com
// @version      1.5
// @description  Зум, скролл, скрытие элементов, сворачивание блоков, панель управления
// @author       MobileAdapter
// @match        https://chat.cdnbakery.com/*
// @run-at       document-start
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  // ══════════════════════════════════════════════════════════════
  // VIEWPORT
  // ══════════════════════════════════════════════════════════════
  function fixViewport() {
    let vp = document.querySelector('meta[name=viewport]');
    if (!vp) { vp = document.createElement('meta'); vp.name = 'viewport'; document.head.appendChild(vp); }
    vp.content = 'width=device-width, initial-scale=1.0, maximum-scale=5.0, user-scalable=yes';
  }

  // ══════════════════════════════════════════════════════════════
  // НАСТРОЙКИ
  // ══════════════════════════════════════════════════════════════
  const STORAGE_KEY = '_cdnbakery_prefs';
  function loadPrefs() { try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; } catch(e) { return {}; } }
  function savePrefs(patch) { try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...loadPrefs(), ...patch })); } catch(e) {} }

  // ══════════════════════════════════════════════════════════════
  // CSS-ФИКСЫ
  // ══════════════════════════════════════════════════════════════
  function injectCSS(overflowMode, constrainEls) {
    let style = document.getElementById('_cdnbakery_fix');
    if (!style) { style = document.createElement('style'); style.id = '_cdnbakery_fix'; document.head.appendChild(style); }

    const overflowCSS =
      overflowMode === 'scroll' ? `html, body { overflow-x: auto !important; }` :
      overflowMode === 'free'   ? `` :
      `html, body { max-width: 100vw !important; overflow-x: hidden !important; }`;

    style.textContent = `
      ${overflowCSS}
      ${constrainEls ? `*:not(#_cdnbakery_panel):not(#_cdnbakery_panel *) { max-width: 100% !important; box-sizing: border-box !important; }` : ''}
      img, video, embed, object { width: auto !important; max-width: 100% !important; height: auto !important; }
      table { display: block !important; overflow-x: auto !important; -webkit-overflow-scrolling: touch !important; }
      pre, code, textarea { white-space: pre-wrap !important; word-break: break-word !important; overflow-x: auto !important; }
      [data-cdnfix-was-fixed] { position: sticky !important; top: 0 !important; z-index: 100 !important; }
      [data-cdnfix-hidden] { display: none !important; }

      /* Кнопка сворачивания блоков */
      ._cdn_collapse_btn {
        display: inline-flex !important;
        align-items: center !important;
        justify-content: center !important;
        width: 20px !important; height: 20px !important;
        background: rgba(108,99,255,0.7) !important;
        color: #fff !important;
        border: none !important;
        border-radius: 4px !important;
        font-size: 11px !important;
        cursor: pointer !important;
        margin-right: 4px !important;
        vertical-align: middle !important;
        flex-shrink: 0 !important;
        line-height: 1 !important;
        font-family: -apple-system, sans-serif !important;
        z-index: 9999 !important;
        position: relative !important;
        -webkit-tap-highlight-color: transparent !important;
      }
      ._cdn_collapse_btn:active { opacity: 0.7 !important; }
      [data-cdn-collapsed] > *:not(._cdn_collapse_btn):not([data-cdn-collapse-header]) {
        display: none !important;
      }
      [data-cdn-collapse-header] {
        display: flex !important;
        align-items: center !important;
      }

      /* Оверлей режима скрытия */
      body._cdn_hide_mode * {
        cursor: crosshair !important;
      }
      body._cdn_hide_mode *:hover {
        outline: 2px solid rgba(255,80,80,0.8) !important;
        outline-offset: 1px !important;
      }
      #_cdnbakery_panel,
      #_cdnbakery_panel * { max-width: none !important; box-sizing: border-box !important; cursor: default !important; }
    `;
  }

  // ══════════════════════════════════════════════════════════════
  // FIXED-ЭЛЕМЕНТЫ
  // ══════════════════════════════════════════════════════════════
  let fixedHidden = false;
  function processFixedElements() {
    document.querySelectorAll('*:not(#_cdnbakery_panel):not(#_cdnbakery_panel *)').forEach(el => {
      if (window.getComputedStyle(el).position === 'fixed') {
        if (el.getBoundingClientRect().width > window.innerWidth * 0.5)
          el.setAttribute('data-cdnfix-was-fixed', '1');
      }
    });
  }
  function toggleFixedElements() {
    fixedHidden = !fixedHidden;
    document.querySelectorAll('[data-cdnfix-was-fixed]').forEach(el => {
      if (fixedHidden) el.setAttribute('data-cdnfix-hidden', '1');
      else el.removeAttribute('data-cdnfix-hidden');
    });
    return fixedHidden;
  }

  // ══════════════════════════════════════════════════════════════
  // РЕЖИМ СКРЫТИЯ ЭЛЕМЕНТОВ
  //   Нажал кнопку 🚫 → тап по любому элементу → он скрывается
  //   Повторный тап по уже скрытому (через список) → показать
  // ══════════════════════════════════════════════════════════════
  let hideMode = false;
  let hiddenElements = []; // { el, origDisplay }
  let hideModeHandler = null;

  function enterHideMode() {
    hideMode = true;
    document.body.classList.add('_cdn_hide_mode');
    hideModeHandler = function(e) {
      const panel = document.getElementById('_cdnbakery_panel');
      if (panel && panel.contains(e.target)) return;
      e.preventDefault();
      e.stopPropagation();
      const el = e.target;
      hiddenElements.push({ el, origDisplay: el.style.display });
      el.style.setProperty('display', 'none', 'important');
      el.setAttribute('data-cdn-user-hidden', '1');
    };
    document.addEventListener('click', hideModeHandler, true);
  }

  function exitHideMode() {
    hideMode = false;
    document.body.classList.remove('_cdn_hide_mode');
    if (hideModeHandler) {
      document.removeEventListener('click', hideModeHandler, true);
      hideModeHandler = null;
    }
  }

  function restoreAllHidden() {
    hiddenElements.forEach(({ el, origDisplay }) => {
      el.style.display = origDisplay;
      el.removeAttribute('data-cdn-user-hidden');
    });
    hiddenElements = [];
  }

  // ══════════════════════════════════════════════════════════════
  // РЕЖИМ СВОРАЧИВАНИЯ БЛОКОВ
  //   Нажал 🗜 → тап по блоку → блок сворачивается (видна только первая строка)
  //   Ещё раз тап — разворачивается
  // ══════════════════════════════════════════════════════════════
  let collapseMode = false;
  let collapseModeHandler = null;

  // Блоковые теги, которые можно сворачивать
  const BLOCK_TAGS = new Set(['DIV','SECTION','ARTICLE','ASIDE','NAV','HEADER','FOOTER',
    'MAIN','FORM','UL','OL','TABLE','DETAILS','FIGURE','FIELDSET','LI']);

  function enterCollapseMode() {
    collapseMode = true;
    document.body.classList.add('_cdn_hide_mode'); // тот же курсор crosshair
    collapseModeHandler = function(e) {
      const panel = document.getElementById('_cdnbakery_panel');
      if (panel && panel.contains(e.target)) return;

      // Ищем ближайший блоковый элемент
      let target = e.target;
      while (target && target !== document.body) {
        if (BLOCK_TAGS.has(target.tagName)) break;
        target = target.parentElement;
      }
      if (!target || target === document.body) return;

      e.preventDefault();
      e.stopPropagation();

      if (target.hasAttribute('data-cdn-collapsed')) {
        // Разворачиваем
        target.removeAttribute('data-cdn-collapsed');
        const btn = target.querySelector(':scope > ._cdn_collapse_btn');
        if (btn) { btn.textContent = '▼'; btn.title = 'Развернуть'; }
      } else {
        // Сворачиваем
        target.setAttribute('data-cdn-collapsed', '1');
        // Добавляем кнопку если нет
        if (!target.querySelector(':scope > ._cdn_collapse_btn')) {
          const btn = document.createElement('button');
          btn.className = '_cdn_collapse_btn';
          btn.textContent = '▶';
          btn.title = 'Развернуть';
          btn.addEventListener('click', function(ev) {
            ev.stopPropagation();
            target.removeAttribute('data-cdn-collapsed');
            btn.textContent = '▼';
            btn.title = 'Свернуть';
          });
          target.insertBefore(btn, target.firstChild);
        } else {
          const btn = target.querySelector(':scope > ._cdn_collapse_btn');
          btn.textContent = '▶';
          btn.title = 'Развернуть';
          btn.onclick = function(ev) {
            ev.stopPropagation();
            target.removeAttribute('data-cdn-collapsed');
            btn.textContent = '▼';
            btn.title = 'Свернуть';
          };
        }
      }
    };
    document.addEventListener('click', collapseModeHandler, true);
  }

  function exitCollapseMode() {
    collapseMode = false;
    document.body.classList.remove('_cdn_hide_mode');
    if (collapseModeHandler) {
      document.removeEventListener('click', collapseModeHandler, true);
      collapseModeHandler = null;
    }
  }

  function restoreAllCollapsed() {
    document.querySelectorAll('[data-cdn-collapsed]').forEach(el => {
      el.removeAttribute('data-cdn-collapsed');
    });
    document.querySelectorAll('._cdn_collapse_btn').forEach(btn => btn.remove());
  }

  // ══════════════════════════════════════════════════════════════
  // ПАНЕЛЬ УПРАВЛЕНИЯ
  // ══════════════════════════════════════════════════════════════
  function buildPanel() {
    if (document.getElementById('_cdnbakery_panel')) return;

    const prefs = loadPrefs();
    let zoom = prefs.zoom || 100;
    let overflowMode = prefs.overflowMode || 'hide';
    let cssOn = true;
    let constrainEls = prefs.constrainElements !== false;

    const overflowIcons  = { hide: '↔️', scroll: '⟺', free: '🔓' };
    const overflowTitles = { hide: 'Скролл: скрыт', scroll: 'Скролл: включён', free: 'Скролл: свободный' };
    const overflowOrder  = ['hide', 'scroll', 'free'];

    const panel = document.createElement('div');
    panel.id = '_cdnbakery_panel';
    panel.innerHTML = `
      <style>
        #_cdnbakery_panel {
          position: fixed;
          bottom: calc(16px + env(safe-area-inset-bottom, 0px));
          left: 50%;
          transform: translateX(-50%);
          z-index: 2147483647;
          background: rgba(10,10,20,0.9);
          backdrop-filter: blur(18px) saturate(1.6);
          -webkit-backdrop-filter: blur(18px) saturate(1.6);
          border: 1px solid rgba(255,255,255,0.12);
          border-radius: 20px;
          padding: 8px 10px;
          display: flex;
          align-items: center;
          gap: 3px;
          box-shadow: 0 4px 24px rgba(0,0,0,0.5);
          touch-action: none;
          user-select: none;
          -webkit-user-select: none;
          max-width: calc(100vw - 24px);
          flex-wrap: nowrap;
          overflow-x: auto;
          -webkit-overflow-scrolling: touch;
        }
        #_cdnbakery_panel.collapsed .panel-inner { display: none !important; }
        ._cdn_btn {
          width: 34px; height: 34px;
          border: none; outline: none;
          background: rgba(255,255,255,0.08);
          color: #fff;
          border-radius: 10px;
          font-size: 15px;
          cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          -webkit-tap-highlight-color: transparent;
          transition: background 0.12s, transform 0.1s;
          flex-shrink: 0;
          font-family: -apple-system, sans-serif;
          position: relative;
        }
        ._cdn_btn:active { background: rgba(255,255,255,0.22) !important; transform: scale(0.88); }
        ._cdn_btn.on     { background: rgba(108,99,255,0.55) !important; }
        ._cdn_btn.warn   { background: rgba(255,160,0,0.45) !important; }
        ._cdn_btn.active-mode { background: rgba(255,60,60,0.55) !important; animation: _cdn_pulse 1s infinite; }
        @keyframes _cdn_pulse { 0%,100%{opacity:1} 50%{opacity:0.6} }
        ._cdn_div { width:1px; height:20px; background:rgba(255,255,255,0.1); flex-shrink:0; margin:0 1px; }
        ._cdn_lbl { color:rgba(255,255,255,0.6); font-size:11px; font-weight:700; min-width:34px; text-align:center; font-variant-numeric:tabular-nums; font-family:-apple-system,sans-serif; }
        ._cdn_hint {
          position: absolute;
          bottom: calc(100% + 8px);
          left: 50%;
          transform: translateX(-50%);
          background: rgba(0,0,0,0.85);
          color: #fff;
          font-size: 11px;
          white-space: nowrap;
          padding: 4px 8px;
          border-radius: 6px;
          pointer-events: none;
          opacity: 0;
          transition: opacity 0.2s;
          font-family: -apple-system, sans-serif;
        }
        #_cdnbakery_panel._cdn_show_hint ._cdn_hint { opacity: 1; }
      </style>

      <button class="_cdn_btn" id="_cdn_toggle" title="Свернуть / перетащить">⚙️</button>

      <div class="panel-inner" style="display:flex;align-items:center;gap:3px;">

        <!-- Зум -->
        <div class="_cdn_div"></div>
        <button class="_cdn_btn" id="_cdn_zm">−</button>
        <span class="_cdn_lbl" id="_cdn_zl">${zoom}%</span>
        <button class="_cdn_btn" id="_cdn_zp">+</button>
        <button class="_cdn_btn" id="_cdn_zr">⊙</button>

        <!-- Скролл -->
        <div class="_cdn_div"></div>
        <button class="_cdn_btn" id="_cdn_ovf">${overflowIcons[overflowMode]}</button>

        <!-- Ограничение ширины -->
        <button class="_cdn_btn ${constrainEls ? 'on' : ''}" id="_cdn_con">📐</button>

        <!-- Шапка -->
        <div class="_cdn_div"></div>
        <button class="_cdn_btn" id="_cdn_fix" title="Скрыть/показать шапку">☰</button>

        <!-- 🚫 Скрыть элемент по тапу -->
        <button class="_cdn_btn" id="_cdn_hide" title="Скрыть элемент (тап по элементу)">🚫
          <span class="_cdn_hint">Тапни по элементу чтобы скрыть</span>
        </button>

        <!-- Восстановить скрытые -->
        <button class="_cdn_btn" id="_cdn_unhide" title="Показать все скрытые">👁</button>

        <!-- Свернуть блок -->
        <button class="_cdn_btn" id="_cdn_col" title="Свернуть блок (тап по блоку)">🗜
          <span class="_cdn_hint">Тапни по блоку чтобы свернуть</span>
        </button>

        <!-- Развернуть все -->
        <button class="_cdn_btn" id="_cdn_uncol" title="Развернуть все блоки">⊞</button>

        <!-- CSS -->
        <div class="_cdn_div"></div>
        <button class="_cdn_btn" id="_cdn_css">🎨</button>

        <!-- Reload -->
        <div class="_cdn_div"></div>
        <button class="_cdn_btn" id="_cdn_rld">↺</button>

      </div>
    `;

    document.body.appendChild(panel);

    // ── Зум ──
    function applyZoom(z) {
      zoom = Math.max(30, Math.min(300, z));
      document.documentElement.style.zoom = (zoom / 100).toFixed(2);
      document.getElementById('_cdn_zl').textContent = zoom + '%';
      savePrefs({ zoom });
    }
    applyZoom(zoom);

    // ── Overflow ──
    const ovfBtn = document.getElementById('_cdn_ovf');
    function applyOverflow(mode) {
      overflowMode = mode;
      ovfBtn.textContent = overflowIcons[mode];
      ovfBtn.title = overflowTitles[mode];
      ovfBtn.classList.toggle('warn', mode !== 'hide');
      injectCSS(mode, constrainEls);
      savePrefs({ overflowMode: mode });
    }
    applyOverflow(overflowMode);
    ovfBtn.addEventListener('click', () => {
      applyOverflow(overflowOrder[(overflowOrder.indexOf(overflowMode) + 1) % overflowOrder.length]);
    });

    // ── Constrain ──
    const conBtn = document.getElementById('_cdn_con');
    conBtn.addEventListener('click', function() {
      constrainEls = !constrainEls;
      this.classList.toggle('on', constrainEls);
      savePrefs({ constrainElements: constrainEls });
      injectCSS(overflowMode, constrainEls);
    });

    // ── Свернуть панель ──
    let collapsed = false;
    document.getElementById('_cdn_toggle').addEventListener('click', () => {
      collapsed = !collapsed;
      panel.classList.toggle('collapsed', collapsed);
    });

    // ── Зум кнопки ──
    document.getElementById('_cdn_zm').addEventListener('click', () => applyZoom(zoom - 10));
    document.getElementById('_cdn_zp').addEventListener('click', () => applyZoom(zoom + 10));
    document.getElementById('_cdn_zr').addEventListener('click', () => applyZoom(100));

    // ── Шапка ──
    document.getElementById('_cdn_fix').addEventListener('click', function() {
      processFixedElements();
      this.classList.toggle('on', toggleFixedElements());
    });

    // ── 🚫 Режим скрытия ──
    const hideBtn = document.getElementById('_cdn_hide');
    hideBtn.addEventListener('click', function() {
      if (collapseMode) { exitCollapseMode(); document.getElementById('_cdn_col').classList.remove('active-mode'); }
      if (!hideMode) {
        enterHideMode();
        this.classList.add('active-mode');
        panel.classList.add('_cdn_show_hint');
        // убираем подсказку через 3 сек
        setTimeout(() => panel.classList.remove('_cdn_show_hint'), 3000);
      } else {
        exitHideMode();
        this.classList.remove('active-mode');
        panel.classList.remove('_cdn_show_hint');
      }
    });

    // ── 👁 Показать всё скрытое ──
    document.getElementById('_cdn_unhide').addEventListener('click', function() {
      restoreAllHidden();
      hideBtn.classList.remove('active-mode');
      if (hideMode) { exitHideMode(); }
    });

    // ── 🗜 Режим сворачивания ──
    const colBtn = document.getElementById('_cdn_col');
    colBtn.addEventListener('click', function() {
      if (hideMode) { exitHideMode(); hideBtn.classList.remove('active-mode'); }
      if (!collapseMode) {
        enterCollapseMode();
        this.classList.add('active-mode');
        panel.classList.add('_cdn_show_hint');
        setTimeout(() => panel.classList.remove('_cdn_show_hint'), 3000);
      } else {
        exitCollapseMode();
        this.classList.remove('active-mode');
        panel.classList.remove('_cdn_show_hint');
      }
    });

    // ── ⊞ Развернуть все ──
    document.getElementById('_cdn_uncol').addEventListener('click', function() {
      restoreAllCollapsed();
      colBtn.classList.remove('active-mode');
      if (collapseMode) exitCollapseMode();
    });

    // ── CSS ──
    document.getElementById('_cdn_css').addEventListener('click', function() {
      cssOn = !cssOn;
      const s = document.getElementById('_cdnbakery_fix');
      if (s) s.disabled = !cssOn;
      this.classList.toggle('on', !cssOn);
    });

    // ── Reload ──
    document.getElementById('_cdn_rld').addEventListener('click', () => location.reload());

    // ── Перетаскивание ──
    let dragging = false, startX = 0, startY = 0, panelL = 0, panelB = 0;
    document.getElementById('_cdn_toggle').addEventListener('touchstart', e => {
      dragging = true;
      const t = e.touches[0];
      startX = t.clientX; startY = t.clientY;
      const rect = panel.getBoundingClientRect();
      panelL = rect.left + rect.width / 2;
      panelB = window.innerHeight - rect.bottom;
      panel.style.transition = 'none';
    }, { passive: true });
    window.addEventListener('touchmove', e => {
      if (!dragging) return;
      const t = e.touches[0];
      panel.style.left   = Math.max(20, Math.min(window.innerWidth - 20, panelL + t.clientX - startX)) + 'px';
      panel.style.bottom = Math.max(8, panelB + startY - t.clientY) + 'px';
      panel.style.transform = 'translateX(-50%)';
    }, { passive: true });
    window.addEventListener('touchend', () => { dragging = false; });
  }

  // ══════════════════════════════════════════════════════════════
  // ЗАПУСК
  // ══════════════════════════════════════════════════════════════
  fixViewport();

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  function init() {
    const prefs = loadPrefs();
    injectCSS(prefs.overflowMode || 'hide', prefs.constrainElements !== false);
    setTimeout(() => { processFixedElements(); buildPanel(); }, 1500);
    const observer = new MutationObserver(() => setTimeout(processFixedElements, 800));
    observer.observe(document.body, { childList: true, subtree: false });
  }

})();

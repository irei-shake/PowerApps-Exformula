(() => {
  // 状態
  const state = new Map(); // 要素 -> { placeholder, floater, minimized, prevBounds }

  function isDetachable(el) {
    if (!el || el === document.documentElement || el === document.body) return false;
    // Avoid detaching our own UI
    if (el.classList && (el.classList.contains('paff-floater') || el.closest('.paff-floater'))) return false;
    // Avoid obvious app chrome
    const role = el.getAttribute && el.getAttribute('role');
    if (role === 'banner' || role === 'navigation') return false;
    return true;
  }

  function findCandidate(target) {
    let el = target;
    // 意味のある親コンテナ（切り離し対象）を上方向に探索
    const maxDepth = 12;
    for (let i = 0; i < maxDepth && el; i++) {
      if (!isDetachable(el)) { el = el.parentElement; continue; }
      // ヒューリスティック: monaco/textarea/input など入力領域や十分な大きさのパネル
      const cl = el.className ? el.className.toString() : '';
      if (
        cl.includes('monaco-editor') ||
        cl.includes('monaco') ||
        cl.includes('formula') ||
        cl.includes('text-area') ||
        cl.includes('editor') ||
        el.tagName === 'TEXTAREA' ||
        el.tagName === 'INPUT' ||
        (el.getAttribute && (el.getAttribute('contenteditable') === 'true' || el.getAttribute('role') === 'textbox')) ||
        el.getBoundingClientRect().height > 40
      ) {
        return el;
      }
      el = el.parentElement;
    }
    return target;
  }

  function isFormulaPanel(el) {
    try {
      if (!el) return false;
      if (el.id === 'formulabar') return true;
      if (el.querySelector && el.querySelector('#formulabar')) return true;
      const hasMonaco = el.querySelector && el.querySelector('.monaco-editor, [class*="monaco"]');
      const hasCombo = el.querySelector && el.querySelector('#powerapps-property-combo-box');
      const globalCombo = document.getElementById('powerapps-property-combo-box');
      if (hasMonaco && (hasCombo || globalCombo)) return true;
    } catch {}
    return false;
  }

  function detachElement(target) {
    if (!target || state.has(target)) return;
    const placeholder = document.createElement('div');
    placeholder.style.display = target.style.display || 'block';
    placeholder.style.width = target.style.width || target.getBoundingClientRect().width + 'px';
    placeholder.style.height = '0px';
    placeholder.dataset.paffPlaceholder = '1';
    target.parentElement?.insertBefore(placeholder, target);

    // フローティングパネルの生成
    const floater = document.createElement('div');
    floater.className = 'paff-floater';
    floater.style.position = 'fixed';
    floater.style.zIndex = '2147483647';
    floater.style.width = Math.max(400, target.getBoundingClientRect().width) + 'px';
    floater.style.height = Math.max(160, target.getBoundingClientRect().height) + 'px';

    const header = document.createElement('div');
    header.className = 'paff-floater-header';
    const title = document.createElement('div');
    title.className = 'paff-floater-title';
    title.textContent = 'Detached panel';
    const actions = document.createElement('div');
    actions.className = 'paff-floater-actions';
    const btnMin = document.createElement('button');
    btnMin.className = 'paff-button';
    btnMin.textContent = 'Minimize';
    const btnClose = document.createElement('button');
    btnClose.className = 'paff-button';
    btnClose.textContent = 'Close';
    actions.appendChild(btnMin);
    actions.appendChild(btnClose);
    header.appendChild(title);
    header.appendChild(actions);

    const tabs = document.createElement('div');
    tabs.className = 'paff-tabs';
    const filter = document.createElement('input');
    filter.type = 'text';
    filter.className = 'paff-filter';
    filter.placeholder = 'Filter properties…';
    const tabsList = document.createElement('div');
    tabsList.className = 'paff-tabs-list';

    // Pinned bar (between header and tabs)
    const pins = document.createElement('div');
    pins.className = 'paff-pins';
    const pinsList = document.createElement('div');
    pinsList.className = 'paff-pins-list';

    const body = document.createElement('div');
    body.className = 'paff-floater-body';
    body.style.paddingLeft = '2px';

    floater.appendChild(header);
    // コードコピー用ボタンをアクションに追加（省略）

    pins.appendChild(pinsList);
    floater.appendChild(pins);
    tabs.appendChild(filter);
    tabs.appendChild(tabsList);
    floater.appendChild(tabs);
    floater.appendChild(body);
    const resizeBL = document.createElement('div');
    resizeBL.className = 'paff-resize-bl';
    floater.appendChild(resizeBL);

    // タブのマウスホイール横スクロールを有効化
    try {
      tabsList.addEventListener('wheel', (ev) => {
        if (ev.deltaY === 0 && ev.deltaX === 0) return;
        const delta = Math.abs(ev.deltaX) > Math.abs(ev.deltaY) ? ev.deltaX : ev.deltaY;
        if (delta) {
          ev.preventDefault();
          tabsList.scrollLeft += delta;
        }
      }, { passive: false });
      pinsList.addEventListener('wheel', (ev) => {
        if (ev.deltaY === 0 && ev.deltaX === 0) return;
        const delta = Math.abs(ev.deltaX) > Math.abs(ev.deltaY) ? ev.deltaX : ev.deltaY;
        if (delta) {
          ev.preventDefault();
          pinsList.scrollLeft += delta;
        }
      }, { passive: false });
    } catch {}
    document.documentElement.appendChild(floater);

    // フォーミュラバー切り離し時のみ、ページ全体の調整を有効化
    const isFormula = isFormulaPanel(target);
    let moMarginFix = null;
    if (isFormula) {
      try {
        floater.setAttribute('data-paff-formula', '1');
        document.documentElement.classList.add('paff-detached-formula');
        const applyMarginFix = () => {
          try {
            const root = floater.querySelector('.monaco-editor');
            const margin = root && root.querySelector('.margin');
            if (margin) {
              margin.style.setProperty('pointer-events', 'none', 'important');
              margin.style.setProperty('width', '0px', 'important');
            }
            // const scrollable = root && root.querySelector('.monaco-scrollable-element');
            // if (scrollable) scrollable.style.setProperty('left', '0px', 'important');
          } catch {}
        };
        applyMarginFix();
        try {
          moMarginFix = new MutationObserver(() => applyMarginFix());
          moMarginFix.observe(floater, { subtree: true, childList: true, attributes: true });
        } catch {}
      } catch {}
    }

    // 初期位置
    const fRectInit = floater.getBoundingClientRect();
    floater.style.left = fRectInit.left + 'px';
    floater.style.top = Math.max(16, fRectInit.top) + 'px';
    floater.style.right = 'auto';

    // 対象要素をパネル本体へ移動（デフォルトは通常表示）
    body.appendChild(target);
    try {
      target.style.width = '100%';
      target.style.maxWidth = 'none';
      target.style.boxSizing = 'border-box';
    } catch {}

    // セクション高さ自動調整
    const cleanupSection = setupSectionAutoHeight(target, floater);
    let cleanupTabs = null;

    // フローティングごとのピン留め一覧（アプリ単位で永続化）
    const pinned = [];
    const STORAGE_NS = 'paff:pins:';
    let APP_KEY = null;
    function deriveAppKeyFromUrl(urlStr) {
      try {
        if (!urlStr) return null;
        const href = String(urlStr);
        // Try GUID in pathname segments like /e/{env}/apps/{GUID}/..., /apps/{GUID}
        const mPath = href.match(/\/(?:e\/[^\/]+\/)?apps\/([0-9a-fA-F-]{36})(?:\b|\/)/);
        if (mPath && mPath[1]) return mPath[1].toLowerCase();
        // Try short forms /a/{GUID}
        const mShort = href.match(/\/a\/([0-9a-fA-F-]{36})(?:\b|\/)/);
        if (mShort && mShort[1]) return mShort[1].toLowerCase();
        // Search and hash params: appId, AppId, id, app-id
        const all = [];
        const u = new URL(href);
        u.searchParams.forEach((v, k) => all.push([k, v]));
        const hash = (u.hash || '').replace(/^#/, '');
        if (hash) {
          try {
            const uh = new URL('https://x/?' + hash);
            uh.searchParams.forEach((v, k) => all.push([k, v]));
          } catch {}
        }
        for (const [k, v] of all) {
          if (/^(appId|appid|app-id|id)$/i.test(k) && /[0-9a-fA-F-]{36}/.test(v)) {
            const g = v.match(/[0-9a-fA-F-]{36}/);
            if (g) return g[0].toLowerCase();
          }
        }
        return null;
      } catch { return null; }
    }
    function resolveAppKey(cb) {
      try {
        // 1) From current frame URL
        const k1 = deriveAppKeyFromUrl(location.href);
        if (k1) { APP_KEY = k1; return void (cb && cb(k1)); }
        // 2) From top-level tab URL via background
        if (chrome?.runtime?.sendMessage) {
          chrome.runtime.sendMessage({ type: 'PAFF_GET_TAB_URL' }, (resp) => {
            const url = resp && resp.url;
            const k2 = deriveAppKeyFromUrl(url);
            if (k2) { APP_KEY = k2; cb && cb(k2); }
            else {
              // 3) Fallback: origin + first two segments of top URL or current
              try {
                const base = url || location.href;
                const u = new URL(base);
                const seg = u.pathname.split('/').filter(Boolean).slice(0, 2).join('/');
                APP_KEY = (u.origin + '/' + seg).toLowerCase();
              } catch { APP_KEY = location.host.toLowerCase(); }
              cb && cb(APP_KEY);
            }
          });
        } else {
          // Fallback only
          try {
            const u = new URL(location.href);
            const seg = u.pathname.split('/').filter(Boolean).slice(0, 2).join('/');
            APP_KEY = (u.origin + '/' + seg).toLowerCase();
          } catch { APP_KEY = location.host.toLowerCase(); }
          cb && cb(APP_KEY);
        }
      } catch { APP_KEY = location.host.toLowerCase(); cb && cb(APP_KEY); }
    }
    function savePins() {
      try {
        const doSave = (key) => {
          const data = pinned.slice();
          if (chrome?.storage?.sync?.set) {
            chrome.storage.sync.set({ [key]: data });
          } else {
            try { localStorage.setItem(key, JSON.stringify(data)); } catch {}
          }
        };
        if (!APP_KEY) return resolveAppKey((k) => doSave(STORAGE_NS + k));
        const key = STORAGE_NS + APP_KEY;
        doSave(key);
      } catch {}
    }
    function loadPins() {
      try {
        const doLoad = (key) => {
          if (chrome?.storage?.sync?.get) {
            chrome.storage.sync.get(key, (obj) => {
              try {
                const arr = Array.isArray(obj?.[key]) ? obj[key] : [];
                if (arr && arr.length) {
                  arr.forEach(p => { if (p && p.control && p.prop) pinned.push({ control: p.control, prop: p.prop }); });
                }
                renderPins();
              } catch { renderPins(); }
            });
          } else {
            try {
              const raw = localStorage.getItem(key);
              const arr = raw ? JSON.parse(raw) : [];
              if (arr && arr.length) {
                arr.forEach(p => { if (p && p.control && p.prop) pinned.push({ control: p.control, prop: p.prop }); });
              }
              renderPins();
            } catch { renderPins(); }
          }
        };
        if (!APP_KEY) return resolveAppKey((k) => doLoad(STORAGE_NS + k));
        const key = STORAGE_NS + APP_KEY;
        doLoad(key);
      } catch {}
    }
    let switching = false;
    let loadingEl = null;
    function setBusy(on, text) {
      try {
        if (on) {
          if (!loadingEl) {
            loadingEl = document.createElement('div');
            loadingEl.className = 'paff-loading';
            const box = document.createElement('div');
            box.className = 'paff-loading-box';
            box.textContent = text || 'Switching...';
            loadingEl.appendChild(box);
            floater.appendChild(loadingEl);
          } else {
            const box = loadingEl.firstChild;
            if (box) box.textContent = text || 'Switching...';
            loadingEl.style.display = 'flex';
          }
          switching = true;
        } else {
          switching = false;
          if (loadingEl) loadingEl.style.display = 'none';
        }
      } catch {}
    }
    function renderPins() {
      try { while (pinsList.firstChild) pinsList.removeChild(pinsList.firstChild); } catch {}
      pinned.forEach(({ control, prop }, idx) => {
        const chip = document.createElement('button');
        chip.className = 'paff-pin';
        chip.title = `${control}.${prop}`;
        chip.textContent = `${control}.${prop}`;
        chip.addEventListener('click', async () => {
          if (switching) return;
          setBusy(true, `Switching to ${control}.${prop}...`);
          try {
            const okCtrl = await selectControlByName(control);
            await selectGlobalPropertyByName(prop);
          } finally {
            setBusy(false);
          }
        });
        const btnPinClose  = document.createElement('button');
        btnPinClose.className = 'paff-pin-close';
        btnPinClose.textContent = '×';
        btnPinClose.addEventListener('click', (ev) => {
          ev.stopPropagation();
          pinned.splice(idx, 1);
          renderPins();
          savePins();
        });
        chip.appendChild(btnPinClose);
        pinsList.appendChild(chip);
      });
    }
    function addPin(control, prop) {
      if (!control || !prop) return;
      if (pinned.some(p => p.control === control && p.prop === prop)) return;
      pinned.push({ control, prop });
      renderPins();
      savePins();
    }

    // 起動時にアプリ単位のピンを復元（AppKeyを解決してから）
    try { loadPins(); } catch {}

    // 可能なら右側の Advanced タブからプロパティ一覧を取得
    const advancedPanel = document.getElementById('appmagic-control-sidebar-advanced-tab-content');
    const comboInside = target.querySelector('#powerapps-property-combo-box');
    if (advancedPanel) {
      cleanupTabs = setupTabsFromAdvanced(advancedPanel, tabs, tabsList, filter, title, addPin);
    } else if (comboInside) {
      cleanupTabs = setupTabsFromCombo(comboInside, tabs, tabsList, filter, title, addPin);
    } else {
      cleanupTabs = setupPropertyTabs(tabs, tabsList, filter, title, addPin);
    }

    // タイトル更新
    const cleanupTitle = setupTitleAutoUpdate(title, target);

    // ドラッグ移動
    let dragging = false;
    let startX = 0, startY = 0, startLeft = 0, startTop = 0;
    header.addEventListener('mousedown', (ev) => {
      dragging = true;
      startX = ev.clientX;
      startY = ev.clientY;
      const rect = floater.getBoundingClientRect();
      startLeft = rect.left;
      startTop = rect.top;
      ev.preventDefault();
    });
    window.addEventListener('mousemove', (ev) => {
      if (!dragging) return;
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      const newLeft = Math.min(window.innerWidth - 32, Math.max(16, startLeft + dx));
      const newTop = Math.min(window.innerHeight - 32, Math.max(16, startTop + dy));
      floater.style.left = newLeft + 'px';
      floater.style.top = newTop + 'px';
      floater.style.right = 'auto';
    });
    window.addEventListener('mouseup', () => { dragging = false; });

    // 左下リサイズ
    let resizingBL = false;
    let rsStartX = 0, rsStartY = 0, rsStartLeft = 0, rsStartTop = 0, rsStartW = 0, rsStartH = 0;
    resizeBL.addEventListener('mousedown', (ev) => {
      try {
        ev.preventDefault();
        ev.stopPropagation();
      } catch {}
      resizingBL = true;
      rsStartX = ev.clientX;
      rsStartY = ev.clientY;
      const r = floater.getBoundingClientRect();
      rsStartLeft = r.left;
      rsStartTop = r.top;
      rsStartW = r.width;
      rsStartH = r.height;
    });
    window.addEventListener('mousemove', (ev) => {
      if (!resizingBL) return;
      const dx = ev.clientX - rsStartX;
      const dy = ev.clientY - rsStartY;
      let newW = Math.max(360, rsStartW - dx);
      let newH = Math.max(120, rsStartH + dy);
      let newLeft = rsStartLeft + (rsStartW - newW);
      newLeft = Math.max(8, Math.min(newLeft, Math.max(8, window.innerWidth - newW - 8)));
      const maxH = Math.max(120, window.innerHeight - rsStartTop - 8);
      if (newH > maxH) newH = maxH;
      floater.style.width = Math.round(newW) + 'px';
      floater.style.height = Math.round(newH) + 'px';
      floater.style.left = Math.round(newLeft) + 'px';
      floater.style.right = 'auto';
    }, true);
    window.addEventListener('mouseup', () => { resizingBL = false; }, true);

    function restore() {
      if (!placeholder.parentElement) return;
      placeholder.parentElement.insertBefore(target, placeholder);
      floater.remove();
      placeholder.remove();
      try { cleanupSection && cleanupSection(); } catch {}
      try { cleanupTabs && cleanupTabs(); } catch {}
      try { cleanupTitle && cleanupTitle(); } catch {}
      state.delete(target);
      // 他にフォーミュラ用フロートが残っていなければページ調整を解除
      try {
        if (moMarginFix) { try { moMarginFix.disconnect(); } catch {} moMarginFix = null; }
        if (!document.querySelector('.paff-floater[data-paff-formula="1"]')) {
          document.documentElement.classList.remove('paff-detached-formula');
        }
      } catch {}
    }

    btnClose.addEventListener('click', restore);

    // 最小化/展開の切り替え
    btnMin.addEventListener('click', () => {
      const st = state.get(target);
      if (!st) return;
      if (!st.minimized) {
        const r = floater.getBoundingClientRect();
        st.prevBounds = {
          width: r.width,
          height: r.height,
          left: r.left,
          top: r.top,
        };
        floater.classList.add('paff-minimized');
        floater.style.width = '';
        floater.style.height = '';
        btnMin.textContent = 'Expand';
        st.minimized = true;
      } else {
        floater.classList.remove('paff-minimized');
        const b = st.prevBounds;
        if (b) {
          floater.style.width = Math.max(360, Math.round(b.width)) + 'px';
          floater.style.height = Math.max(120, Math.round(b.height)) + 'px';
          floater.style.left = Math.min(window.innerWidth - 16, Math.max(8, Math.round(b.left))) + 'px';
          floater.style.top = Math.min(window.innerHeight - 16, Math.max(8, Math.round(b.top))) + 'px';
          floater.style.right = 'auto';
        }
        btnMin.textContent = 'Minimize';
        st.minimized = false;
      }
    });

    // 状態を保存
    const st = { placeholder, floater, minimized: false, prevBounds: null };
    state.set(target, st);

  }

  // プロパティタブ（#powerapps-property-combo-box 連携）
  function setupPropertyTabs(tabsEl, listEl, filterInput, titleEl, addPin) {
    const combo = document.getElementById('powerapps-property-combo-box');
    if (!tabsEl || !combo) return null;

    let disposed = false;
    const clearList = () => { while (listEl.firstChild) listEl.removeChild(listEl.firstChild); };
    let renderScheduled = false;
    const scheduleRender = () => {
      if (renderScheduled) return;
      renderScheduled = true;
      setTimeout(() => { renderScheduled = false; render(); }, 120);
    };

    const waitForListbox = (timeout = 1000) => new Promise(resolve => {
      const start = performance.now();
      const tick = () => {
        const lb = document.querySelector('[role="listbox"], .ms-ComboBox-optionsContainer, .ms-Dropdown-callout');
        if (lb) return resolve(lb);
        if (performance.now() - start > timeout) return resolve(null);
        requestAnimationFrame(tick);
      };
      tick();
    });

    function safeClick(el) {
      try { el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })); } catch {}
      try { el.click(); } catch {}
    }
    function escClose() {
      try { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); } catch {}
      try { document.dispatchEvent(new KeyboardEvent('keyup', { key: 'Escape', bubbles: true })); } catch {}
    }

    async function readOptions() {
      safeClick(combo);
      const lb = await waitForListbox();
      const items = lb ? Array.from(lb.querySelectorAll('[role="option"], .ms-ComboBox-option, .ms-Dropdown-item')) : [];
      const names = items.map(li => (li.getAttribute('aria-label') || li.textContent || '').trim()).filter(Boolean);
      escClose();
      return Array.from(new Set(names));
    }

    async function selectByName(name) {
      if (!name) return;
      safeClick(combo);
      const lb = await waitForListbox();
      if (!lb) return;
      const opt = Array.from(lb.querySelectorAll('[role="option"], .ms-ComboBox-option, .ms-Dropdown-item'))
        .find(li => ((li.getAttribute('aria-label') || li.textContent || '').trim()) === name);
      if (opt) safeClick(opt);
      escClose();
    }

    let allNames = [];
    const applyFilterAndRender = () => {
      const q = (filterInput?.value || '').trim().toLowerCase();
      clearList();
      allNames.filter(n => !q || n.toLowerCase().includes(q)).forEach(n => {
        const btn = document.createElement('button');
        btn.className = 'paff-tab';
        btn.textContent = n;
        btn.addEventListener('click', async (ev) => {
          if (ev.altKey || ev.ctrlKey) {
            const control = readCurrentControlName();
            addPin && addPin(control, n);
          } else {
            await selectByName(n);
          }
        });
        listEl.appendChild(btn);
      });
    };

    async function render() {
      if (disposed) return;
      const controlName = (titleEl && (titleEl.textContent || '').trim()) || '';
      if (controlName && tabsEl.dataset.controlName === controlName && listEl.childElementCount > 0) {
        applyFilterAndRender();
        return;
      }
      const names = await readOptions().catch(() => []);
      allNames = names || [];
      applyFilterAndRender();
      tabsEl.dataset.controlName = controlName;
    }

    // ループ抑止: タイトル変更時のみ再描画
    let moTitle;
    try {
      if (titleEl) {
        moTitle = new MutationObserver(() => scheduleRender());
        moTitle.observe(titleEl, { subtree: true, characterData: true, childList: true });
      }
    } catch {}

    // フィルタ入力
    try {
      let rafId;
      filterInput?.addEventListener('input', () => {
        if (rafId) cancelAnimationFrame(rafId);
        rafId = requestAnimationFrame(applyFilterAndRender);
      });
    } catch {}

    // 初期描画
    render();

    return () => {
      disposed = true;
      try { moTitle && moTitle.disconnect(); } catch {}
      clearList();
    };
  }

  // Advancedタブからプロパティ名を抽出してタブを描画
  function setupTabsFromAdvanced(advEl, tabsEl, listEl, filterInput, titleEl, addPin) {
    if (!advEl || !tabsEl) return null;

    let disposed = false;
    const clearList = () => { while (listEl.firstChild) listEl.removeChild(listEl.firstChild); };
    let renderScheduled = false;
    const scheduleRender = () => {
      if (renderScheduled) return;
      renderScheduled = true;
      setTimeout(() => { renderScheduled = false; render(); }, 120);
    };

    async function selectByName(name) {
      const combo = document.getElementById('powerapps-property-combo-box');
      if (!combo || !name) return;
      try { combo.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })); } catch {}
      try { combo.click(); } catch {}
      const lb = await (new Promise(resolve => {
        const start = performance.now();
        const tick = () => {
          const el = document.querySelector('[role="listbox"], .ms-ComboBox-optionsContainer, .ms-Dropdown-callout');
          if (el) return resolve(el);
          if (performance.now() - start > 1000) return resolve(null);
          requestAnimationFrame(tick);
        };
        tick();
      }));
      if (lb) {
        const opt = Array.from(lb.querySelectorAll('[role="option"], .ms-ComboBox-option, .ms-Dropdown-item'))
          .find(li => ((li.getAttribute('aria-label') || li.textContent || '').trim()) === name);
        if (opt) {
          try { opt.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })); } catch {}
          try { opt.click(); } catch {}
        }
      }
      try { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); } catch {}
      try { document.dispatchEvent(new KeyboardEvent('keyup', { key: 'Escape', bubbles: true })); } catch {}
    }

    function extractPropertyNames() {
      const names = new Set();
      // 方法1: DetailsList の行から取得
      const rows = advEl.querySelectorAll('[role="row"], [data-automationid^="DetailsRow"], .ms-DetailsRow');
      rows.forEach(row => {
        let text = '';
        const cell = row.querySelector('[role="gridcell"], [data-automationid^="DetailsRowCell"], .ms-DetailsRow-cell');
        if (cell) text = (cell.textContent || '').trim();
        if (!text) {
          const label = row.querySelector('label, [aria-label]');
          if (label) text = (label.getAttribute('aria-label') || label.textContent || '').trim();
        }
        if (text) names.add(text);
      });
      // 方法2: パネル内の入力ラベルから取得
      const labels = advEl.querySelectorAll('label, [data-automationid*="PropertyName"], .property-name');
      labels.forEach(l => {
        const t = (l.getAttribute && l.getAttribute('aria-label')) || l.textContent || '';
        const v = (t || '').trim();
        if (v) names.add(v);
      });
      return Array.from(names);
    }

    let allProps = [];
    const applyFilterAndRender = () => {
      const q = (filterInput?.value || '').trim().toLowerCase();
      clearList();
      allProps.filter(n => !q || n.toLowerCase().includes(q)).forEach(n => {
        const btn = document.createElement('button');
        btn.className = 'paff-tab';
        btn.textContent = n;
        btn.addEventListener('click', async (ev) => {
          if (ev.altKey || ev.ctrlKey) {
            const control = readCurrentControlName();
            addPin && addPin(control, n);
          } else {
            await selectByName(n);
          }
        });
        btn.addEventListener('dblclick', (ev) => {
          ev.preventDefault();
          const control = readCurrentControlName();
          addPin && addPin(control, n);
        });
        listEl.appendChild(btn);
      });
    };

    async function render() {
      if (disposed) return;
      allProps = extractPropertyNames();
      applyFilterAndRender();
    }

    // Advancedパネルやタイトルの変更時に再描画
    let moAdv, moTitle;
    try {
      moAdv = new MutationObserver(() => scheduleRender());
      moAdv.observe(advEl, { subtree: true, childList: true, characterData: true, attributes: true });
    } catch {}
    try {
      if (titleEl) {
        moTitle = new MutationObserver(() => scheduleRender());
        moTitle.observe(titleEl, { subtree: true, childList: true, characterData: true });
      }
    } catch {}

    // フィルタ入力
    try {
      let rafId;
      filterInput?.addEventListener('input', () => {
        if (rafId) cancelAnimationFrame(rafId);
        rafId = requestAnimationFrame(applyFilterAndRender);
      });
    } catch {}

    // 初期処理
    render();

    return () => {
      disposed = true;
      try { moAdv && moAdv.disconnect(); } catch {}
      try { moTitle && moTitle.disconnect(); } catch {}
      clearList();
    };
  }

  // フローティング内の既存コンボからタブを生成
  function setupTabsFromCombo(comboEl, tabsEl, listEl, filterInput, titleEl, addPin) {
    if (!comboEl || !tabsEl) return null;
    let disposed = false;
    const clearList = () => { while (listEl.firstChild) listEl.removeChild(listEl.firstChild); };

    // コンボは非表示だが機能は維持
    const prevDisplay = comboEl.style.display;
    comboEl.style.display = 'none';

    const waitForListbox = (timeout = 1200) => new Promise(resolve => {
      const start = performance.now();
      const tick = () => {
        const lb = document.querySelector('[role="listbox"], .ms-ComboBox-optionsContainer, .ms-Dropdown-callout');
        if (lb) return resolve(lb);
        if (performance.now() - start > timeout) return resolve(null);
        requestAnimationFrame(tick);
      };
      tick();
    });

    function safeClick(el) {
      try { el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })); } catch {}
      try { el.click(); } catch {}
    }
    function escClose() {
      try { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); } catch {}
      try { document.dispatchEvent(new KeyboardEvent('keyup', { key: 'Escape', bubbles: true })); } catch {}
    }

    async function readOptions() {
      safeClick(comboEl);
      const lb = await waitForListbox();
      const items = lb ? Array.from(lb.querySelectorAll('[role="option"], .ms-ComboBox-option, .ms-Dropdown-item')) : [];
      const names = items.map(li => (li.getAttribute('aria-label') || li.textContent || '').trim()).filter(Boolean);
      escClose();
      return Array.from(new Set(names));
    }

    async function selectByName(name) {
      if (!name) return;
      safeClick(comboEl);
      const lb = await waitForListbox();
      if (!lb) return;
      const opt = Array.from(lb.querySelectorAll('[role="option"], .ms-ComboBox-option, .ms-Dropdown-item'))
        .find(li => ((li.getAttribute('aria-label') || li.textContent || '').trim()) === name);
      if (opt) safeClick(opt);
      escClose();
    }

    let allNames = [];
    const applyFilterAndRender = () => {
      const q = (filterInput?.value || '').trim().toLowerCase();
      clearList();
      allNames.filter(n => !q || n.toLowerCase().includes(q)).forEach(n => {
        const btn = document.createElement('button');
        btn.className = 'paff-tab';
        btn.textContent = n;
        btn.addEventListener('click', async (ev) => {
          if (ev.altKey || ev.ctrlKey) {
            const control = readCurrentControlName();
            addPin && addPin(control, n);
          } else {
            await selectByName(n);
          }
        });
        btn.addEventListener('dblclick', (ev) => {
          ev.preventDefault();
          const control = readCurrentControlName();
          addPin && addPin(control, n);
        });
        listEl.appendChild(btn);
      });
    };

    async function render() {
      if (disposed) return;
      const names = await readOptions().catch(() => []);
      allNames = names || [];
      applyFilterAndRender();
    }

    // タイトル更新（コントロール変更）時に再描画
    let moTitle;
    try {
      if (titleEl) {
        moTitle = new MutationObserver(() => { setTimeout(render, 120); });
        moTitle.observe(titleEl, { subtree: true, characterData: true, childList: true });
      }
    } catch {}
    // フィルタ入力
    try {
      let rafId;
      filterInput?.addEventListener('input', () => {
        if (rafId) cancelAnimationFrame(rafId);
        rafId = requestAnimationFrame(applyFilterAndRender);
      });
    } catch {}

    // 初期描画
    render();

    return () => {
      disposed = true;
      try { moTitle && moTitle.disconnect(); } catch {}
      comboEl.style.display = prevDisplay;
      clearList();
    };
  }

  // タイトルに現在のコントロール名を推定・維持
  function setupTitleAutoUpdate(titleEl, container) {
    if (!titleEl) return null;
    let disposed = false;

    const fbRoot =
      (container && (container.id === 'formulabar' ? container : (container.querySelector('#formulabar') || container))) || document;
    const nameNode = document.getElementById('control-sidebar-header-control-name');

    function getControlName() {
      try {
        if (nameNode) {
          const t = (nameNode.textContent || nameNode.getAttribute('title') || '').trim();
          if (t) return t;
        }
      } catch {}
      try {
        const sel = document.querySelector('[role="treeitem"][aria-selected="true"]');
        if (sel) {
          const name = (sel.getAttribute('aria-label') || sel.textContent || '').trim();
          if (name) return name;
        }
      } catch {}
      try {
        const el = fbRoot.querySelector('[data-control-name], [data-selected-control], [data-automationid*="SelectedControl" i]');
        const name = el && (el.getAttribute('data-control-name') || el.getAttribute('data-selected-control') || el.textContent || '').trim();
        if (name) return name;
      } catch {}
      try {
        const labelled = fbRoot.querySelector('[aria-label]');
        const text = labelled && labelled.getAttribute('aria-label');
        if (text) {
          const m1 = text.match(/[\-–]\s*(.+)$/);
          if (m1 && m1[1]) return m1[1].trim();
          const m2 = text.match(/(?:of|の)\s+(.+)$/i);
          if (m2 && m2[1]) return m2[1].trim();
        }
      } catch {}
      return '';
    }

    let lastTitle = (titleEl.textContent || '').trim();
    const apply = () => {
      if (disposed) return;
      const control = (getControlName() || '').trim();
      if (!control) return;
      if (control === lastTitle) return;
      lastTitle = control;
      titleEl.textContent = control;
    };
    apply();

    // 変化しやすい箇所を監視
    let moTree, moFb, moName, moProp;
    try {
      const tree = document.querySelector('[role="tree"]') || document.body;
      moTree = new MutationObserver(apply);
      moTree.observe(tree, { subtree: true, attributes: true, attributeFilter: ['aria-selected', 'aria-label'], childList: true, characterData: true });
    } catch {}
    try {
      moFb = new MutationObserver(apply);
      moFb.observe(fbRoot, { subtree: true, attributes: true, attributeFilter: ['aria-label', 'data-control-name', 'data-selected-control'], childList: true, characterData: true });
    } catch {}
    try {
      if (nameNode) {
        moName = new MutationObserver(apply);
        moName.observe(nameNode, { subtree: true, attributes: true, childList: true, characterData: true });
      }
    } catch {}
    try {
      const combo = document.getElementById('powerapps-property-combo-box');
      if (combo) {
        moProp = new MutationObserver(apply);
        moProp.observe(combo, { subtree: true, attributes: true, childList: true, characterData: true });
      }
    } catch {}
    window.addEventListener('click', apply, true);

    return () => {
      disposed = true;
      try { moTree && moTree.disconnect(); } catch {}
      try { moFb && moFb.disconnect(); } catch {}
      try { moName && moName.disconnect(); } catch {}
      try { moProp && moProp.disconnect(); } catch {}
      window.removeEventListener('click', apply, true);
    };
  }

  // Auto-size the editor section inside #formulabar
  function setupSectionAutoHeight(container, floaterEl) {
    if (!container) return null;
    const panel = floaterEl || container.closest('.paff-floater');
    if (!panel) return null;
    const fbRoot = (container.id === 'formulabar' ? container : (container.querySelector('#formulabar') || container));
    if (!fbRoot) return null;
    const editor = fbRoot.querySelector('#powerFxFormulaEditor');

    // Section 推定（editorを内包するセクション優先）
    let section =
      (editor && editor.closest('section, .Section, [data-role="Section"]')) ||
      fbRoot.querySelector('section, Section, .Section, [data-role="Section"]');
    if (!section) return null;

    const prevHeight = section.style.height;
    const prevMaxH = section.style.maxHeight;
    const prevMinH = section.style.minHeight;
    const prevOverflow = section.style.overflow;
    const prevFbHeight = fbRoot.style.height;

    try { fbRoot.style.setProperty('width', 'auto', 'important'); } catch {}

    const apply = () => {
      const headerEl = panel.querySelector('.paff-floater-header');
      const tabsEl = panel.querySelector('.paff-tabs');
      const pinsEl = panel.querySelector('.paff-pins');
      const panelH = panel.getBoundingClientRect().height;
      const headerH = headerEl ? headerEl.getBoundingClientRect().height : 0;
      const tabsH = tabsEl ? tabsEl.getBoundingClientRect().height : 0;
      const pinsH = pinsEl ? pinsEl.getBoundingClientRect().height : 0;
      const available = Math.max(0, Math.round(panelH - headerH - pinsH - tabsH));

      // 非エディタ要素の総高さ（#formulabar の直下の子）
      let nonEditorSum = 0;
      Array.from(fbRoot.children).forEach(ch => {
        if (!ch) return;
        if (editor && (ch === editor || ch.contains(editor))) return; // 除外
        const r = ch.getBoundingClientRect();
        const cs = getComputedStyle(ch);
        const mt = parseFloat(cs.marginTop || '0');
        const mb = parseFloat(cs.marginBottom || '0');
        nonEditorSum += Math.max(0, Math.round(r.height + mt + mb));
      });

      const targetHeight = Math.max(0, available - nonEditorSum - 5);
      section.style.height = targetHeight + 'px';
      section.style.width = '100%';
      section.style.maxWidth = 'none';
      section.style.boxSizing = 'border-box';
      section.style.maxHeight = 'none';
      section.style.minHeight = '0px';
      section.style.overflow = 'auto';
    };
    apply();

    const roPanel = new ResizeObserver(() => apply());
    try { roPanel.observe(panel); } catch {}
    const roFb = new ResizeObserver(() => apply());
    try { roFb.observe(fbRoot); } catch {}
    const wrapper = fbRoot.querySelector('#ufb-resizer-wrapper');
    let roWrapper;
    if (wrapper) {
      roWrapper = new ResizeObserver(() => apply());
      try { roWrapper.observe(wrapper); } catch {}
    }
    const onWin = () => apply();
    window.addEventListener('resize', onWin, true);

    return () => {
      try { roPanel.disconnect(); } catch {}
      try { roFb.disconnect(); } catch {}
      try { roWrapper && roWrapper.disconnect(); } catch {}
      window.removeEventListener('resize', onWin, true);
      section.style.height = prevHeight;
      section.style.maxHeight = prevMaxH;
      section.style.minHeight = prevMinH;
      section.style.overflow = prevOverflow;
      fbRoot.style.height = prevFbHeight;
    };
  }

  // 自動切り離しの橋渡し
  window.addEventListener('paff-detach-request', (ev) => {
    try {
      const t = ev?.detail?.target;
      if (!t) return;
      const cand = findCandidate(t);
      detachElement(cand);
    } catch {}
  }, true);
  try { window.__paffDetach = (t) => detachElement(findCandidate(t)); } catch {}

  // バックグラウンドからのメッセージ
  chrome.runtime?.onMessage?.addListener?.((msg) => {
    if (msg && msg.type === 'PAFF_DETACH_FORMULA') {
      tryAutoDetachFormula();
    }
  });

  // ページ内ショートカット
  window.addEventListener('keydown', (e) => {
    if (e.altKey && e.shiftKey && (e.key.toLowerCase() === 'f')) {
      tryAutoDetachFormula();
    } else if (e.altKey && e.shiftKey && (e.key.toLowerCase() === 'b')) {
      tryAutoDetachFormula();
    }
  }, true);
})();

// プロパティ用の軽量ピン留めパネルを開く
function openPinnedPropertyPanel(propertyName) {
  try {
    const controlName = readCurrentControlName();
    const floater = document.createElement('div');
    floater.className = 'paff-floater';
    floater.style.position = 'fixed';
    floater.style.zIndex = '2147483647';
    floater.style.width = '420px';
    floater.style.height = '140px';
    floater.style.left = Math.max(24, (window.innerWidth - 440)) + 'px';
    floater.style.top = '80px';
    floater.style.right = 'auto';

    const header = document.createElement('div');
    header.className = 'paff-floater-header';
    const title = document.createElement('div');
    title.className = 'paff-floater-title';
    title.textContent = controlName ? `${controlName}.${propertyName}` : propertyName;
    const actions = document.createElement('div');
    actions.className = 'paff-floater-actions';
    const btnMin = document.createElement('button');
    btnMin.className = 'paff-button';
    btnMin.textContent = 'Minimize';
    const btnClose = document.createElement('button');
    btnClose.className = 'paff-button';
    btnClose.textContent = 'Close';
    actions.appendChild(btnMin);
    actions.appendChild(btnClose);
    header.appendChild(title);
    header.appendChild(actions);

    const body = document.createElement('div');
    body.className = 'paff-floater-body';
    body.style.padding = '8px 10px';
    const info = document.createElement('div');
    info.textContent = 'Switch to this property in editor:';
    const btnSwitch = document.createElement('button');
    btnSwitch.className = 'paff-button';
    btnSwitch.textContent = `Switch to ${propertyName}`;
    btnSwitch.style.marginLeft = '8px';
    body.appendChild(info);
    body.appendChild(btnSwitch);

    floater.appendChild(header);
    floater.appendChild(body);
    document.documentElement.appendChild(floater);

    // ドラッグ処理
    let dragging = false, startX = 0, startY = 0, startLeft = 0, startTop = 0;
    header.addEventListener('mousedown', (ev) => {
      dragging = true;
      startX = ev.clientX; startY = ev.clientY;
      const r = floater.getBoundingClientRect();
      startLeft = r.left; startTop = r.top;
      ev.preventDefault();
    });
    window.addEventListener('mousemove', (ev) => {
      if (!dragging) return;
      const dx = ev.clientX - startX; const dy = ev.clientY - startY;
      floater.style.left = Math.min(window.innerWidth - 16, Math.max(8, startLeft + dx)) + 'px';
      floater.style.top = Math.min(window.innerHeight - 16, Math.max(8, startTop + dy)) + 'px';
      floater.style.right = 'auto';
    });
    window.addEventListener('mouseup', () => { dragging = false; });

    // 最小化/展開
    let minimized = false; let prevBounds = null;
    btnMin.addEventListener('click', () => {
      if (!minimized) {
        const r = floater.getBoundingClientRect();
        prevBounds = { left: r.left, top: r.top, width: r.width, height: r.height };
        floater.classList.add('paff-minimized');
        floater.style.height = '';
        floater.style.width = '400px';
        btnMin.textContent = 'Expand';
        minimized = true;
      } else {
        floater.classList.remove('paff-minimized');
        if (prevBounds) {
          floater.style.left = Math.round(prevBounds.left) + 'px';
          floater.style.top = Math.round(prevBounds.top) + 'px';
          floater.style.width = Math.round(prevBounds.width) + 'px';
          floater.style.height = Math.round(prevBounds.height) + 'px';
        }
        btnMin.textContent = 'Minimize';
        minimized = false;
      }
    });

    // Close
    btnClose.addEventListener('click', () => { floater.remove(); });

    // クリックで該当プロパティへ切替
    btnSwitch.addEventListener('click', async () => {
      try {
        btnSwitch.disabled = true;
        btnSwitch.textContent = 'Switching...';
        const okCtrl = await selectControlByName(controlName);
        await selectGlobalPropertyByName(propertyName);
        btnSwitch.textContent = okCtrl ? 'Switched' : 'Switched (control not confirmed)';
        setTimeout(() => { try { btnSwitch.disabled = false; btnSwitch.textContent = `Switch to ${propertyName}`; } catch {} }, 900);
      } catch {
        try { btnSwitch.disabled = false; btnSwitch.textContent = `Switch to ${propertyName}`; } catch {}
      }
    });
  } catch {}
}

function selectGlobalPropertyByName(name) {
  return new Promise(async (resolve) => {
    try {
      const combo = document.getElementById('powerapps-property-combo-box');
      if (!combo || !name) return resolve(false);
      combo.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      combo.click();
      const lb = await new Promise(res => {
        const start = performance.now();
        const tick = () => {
          const el = document.querySelector('[role="listbox"], .ms-ComboBox-optionsContainer, .ms-Dropdown-callout');
          if (el) return res(el);
          if (performance.now() - start > 1200) return res(null);
          requestAnimationFrame(tick);
        };
        tick();
      });
      if (!lb) return resolve(false);
      const opt = Array.from(lb.querySelectorAll('[role="option"], .ms-ComboBox-option, .ms-Dropdown-item'))
        .find(li => ((li.getAttribute('aria-label') || li.textContent || '').trim()) === name);
      if (opt) opt.click();
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      document.dispatchEvent(new KeyboardEvent('keyup', { key: 'Escape', bubbles: true }));
      resolve(true);
    } catch { resolve(false); }
  });
}

function selectControlByName(name) {
  return new Promise(async (resolve) => {
    try {
      if (!name) return resolve(false);
      const items = Array.from(document.querySelectorAll('[role="treeitem"]'));
      const lower = name.toLowerCase();
      let target = items.find(el => (el.getAttribute('aria-label') || '').trim().toLowerCase() === lower);
      if (!target) target = items.find(el => ((el.getAttribute('aria-label') || el.textContent || '').trim().toLowerCase()) === lower);
      if (!target) target = items.find(el => ((el.getAttribute('aria-label') || el.textContent || '').trim().toLowerCase()).includes(lower));
      if (!target) return resolve(false);
      try { target.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })); } catch {}
      try { target.click(); } catch {}

      const ok = await waitFor(() => {
        const sel = document.querySelector('[role="treeitem"][aria-selected="true"]');
        const txt = (sel && (sel.getAttribute('aria-label') || sel.textContent || '').trim()) || '';
        return txt.toLowerCase() === lower;
      }, 1200);
      resolve(!!ok);
    } catch { resolve(false); }
  });
}

function waitFor(pred, timeout = 1000) {
  return new Promise((resolve) => {
    const start = performance.now();
    const tick = () => {
      try {
        if (pred()) return resolve(true);
      } catch {}
      if (performance.now() - start > timeout) return resolve(false);
      requestAnimationFrame(tick);
    };
    tick();
  });
}

function readCurrentControlName() {
  try {
    const el = document.getElementById('control-sidebar-header-control-name');
    const t = (el?.textContent || el?.getAttribute('title') || '').trim();
    return t || '';
  } catch { return ''; }
}

// 現フレームのフォーミュラバーを自動検出して切り離し
function tryAutoDetachFormula() {
  const fb = document.getElementById('formulabar');
  if (fb && isElVisible(fb)) {
    try {
      const ev = new CustomEvent('paff-detach-request', { detail: { target: fb } });
      window.dispatchEvent(ev);
    } catch {
      try { window.__paffDetach && window.__paffDetach(fb); } catch {}
    }
    return;
  }

  // Monaco エディタを優先
  const candidates = Array.from(document.querySelectorAll('.monaco-editor, [class*="monaco"], [role="textbox"], textarea, input[type="text"]'));
  const visible = candidates
    .filter(el => {
      if (!el || el.closest('.paff-floater')) return false;
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden') return false;
      const r = el.getBoundingClientRect();
      return r.width > 360 && r.height > 40 && r.bottom > 0 && r.right > 0 && r.left < window.innerWidth && r.top < window.innerHeight;
    })
    .map(el => ({ el, r: el.getBoundingClientRect(), score: 0 }));

  if (!visible.length) {
    chrome.runtime?.sendMessage?.({ type: 'PAFF_INFO', message: 'Formula bar not found in this frame.' });
    return;
  }

  visible.forEach(item => {
    const { el, r } = item;
    const cl = el.className ? el.className.toString() : '';
    item.score += (window.innerHeight - r.top) / window.innerHeight; // 上部に近いほど高評価
    item.score += Math.min(1, r.width / window.innerWidth);
    if (cl.includes('monaco')) item.score += 2;
    const label = (el.getAttribute && (el.getAttribute('aria-label') || el.getAttribute('placeholder'))) || '';
    if (/formula|数式|式|フォーミュラ/i.test(label)) item.score += 3;
  });

  visible.sort((a, b) => b.score - a.score);
  const editorEl = visible[0]?.el;
  if (!editorEl) return;

  const container = findFormulaContainer(editorEl) || editorEl;

  try {
    const ev = new CustomEvent('paff-detach-request', { detail: { target: container } });
    window.dispatchEvent(ev);
  } catch {
    try { window.__paffDetach && window.__paffDetach(container); } catch {}
  }
}

function isElVisible(el) {
  if (!el) return false;
  const cs = getComputedStyle(el);
  if (cs.display === 'none' || cs.visibility === 'hidden') return false;
  const r = el.getBoundingClientRect();
  return r.width > 4 && r.height > 4 && r.bottom > 0 && r.right > 0 && r.left < window.innerWidth && r.top < window.innerHeight;
}

// ヒューリスティック: 祖先を辿ってエディタとコンボの共通ラッパーを探索
function findFormulaContainer(editorEl) {
  const isComboLike = (el) => {
    if (!el) return false;
    const role = el.getAttribute && el.getAttribute('role');
    const cl = el.className ? el.className.toString() : '';
    return role === 'combobox' || el.tagName === 'SELECT' ||
          (el.getAttribute && el.getAttribute('aria-haspopup') === 'listbox') ||
          /Dropdown|ms-ComboBox|ms-Dropdown/i.test(cl);
  };

  const maxDepth = 8;
  let p = editorEl.parentElement;
  for (let i = 0; i < maxDepth && p; i++, p = p.parentElement) {
    const combo = p.querySelector('[role="combobox"], [aria-haspopup="listbox"], select, .ms-Dropdown, .ms-ComboBox, [class*="Dropdown"], [class*="ComboBox"]');
    if (combo && !combo.contains(editorEl) && p.contains(editorEl)) {
      const r = p.getBoundingClientRect();
      if (r.width > 400 && r.height < 260) {
        return p;
      }
    }
  }
  const sibCombo = editorEl.parentElement?.querySelector('[role="combobox"], [aria-haspopup="listbox"], select, .ms-Dropdown, .ms-ComboBox, [class*="Dropdown"], [class*="ComboBox"]');
  if (sibCombo) return editorEl.parentElement;
  return null;
}

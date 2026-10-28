/*
 * Codex Sidebar Usage v0.2 — ephemeral local CDP renderer widget.
 * Fetches no credentials and makes no HTTP calls. Node's CDP binding delivers
 * account/rateLimits/read normalized quota snapshots from Codex App Server.
 */
(() => {
  const WIDGET_ID = 'codex-sidebar-usage-widget';
  window.__codexUsageSidebarV02?.destroy?.();
  window.__codexUsageSidebarPrototype?.destroy?.();
  const isRail = el => el?.tagName === 'NAV' && String(el.className).includes('group/sidebar-rail');
  const nav = [...document.querySelectorAll('nav')].find(isRail);
  if (!nav) { console.warn('Codex usage: rail unavailable'); return; }
  const avatarImage = [...nav.querySelectorAll('img')].find(el =>
    el.classList.contains('rounded-full') &&
    el.classList.contains('object-cover') &&
    Math.round(el.getBoundingClientRect().width) === 24);
  const button = avatarImage?.closest('button');
  if (!button) { console.warn('Codex usage: avatar unavailable'); return; }
  let anchor = button;
  while (anchor?.parentElement && anchor.parentElement !== nav) anchor = anchor.parentElement;
  if (anchor?.parentElement !== nav) { console.warn('Codex usage: avatar anchor unavailable'); return; }

  document.getElementById(WIDGET_ID)?.remove();
  const root = document.createElement('div');
  root.id = WIDGET_ID;
  root.setAttribute('aria-label', 'Codex 使用额度');
  root.style.cssText = 'box-sizing:border-box;width:36px;max-width:36px;flex:0 0 auto;align-self:center;display:flex;flex-direction:column;align-items:center;gap:8px;color:inherit;';
  root.innerHTML = `
    <style>
      #${WIDGET_ID} .quota{width:36px;display:flex;flex-direction:column;align-items:center;gap:2px;cursor:help}
      #${WIDGET_ID} .label{font-size:9px;line-height:11px;opacity:.7}
      #${WIDGET_ID} .pct{font-size:11px;line-height:13px;font-weight:600;font-variant-numeric:tabular-nums}
      #${WIDGET_ID} .track{display:block;flex:0 0 auto;position:relative;width:32px;height:3px;border-radius:9px;background:color-mix(in srgb,currentColor 18%,transparent);overflow:hidden}
      #${WIDGET_ID} .fill{display:block;position:absolute;top:0;left:0;height:100%;width:0%;border-radius:9px}
      #${WIDGET_ID} [data-quota="five"] .fill{background:#16a34a}
      #${WIDGET_ID} [data-quota="week"] .fill{background:#d97706}
      #${WIDGET_ID} .reload{width:26px;height:24px;display:grid;place-items:center;padding:0;border:0;border-radius:7px;color:inherit;background:transparent;font-size:16px;line-height:1;cursor:pointer}
      #${WIDGET_ID} .reload:hover{background:color-mix(in srgb,currentColor 9%,transparent)}
      #${WIDGET_ID} .reload:disabled{cursor:wait;opacity:.5}
    </style>
    <div class="quota" data-quota="five" title="正在读取额度"><span class="label">5h</span><span class="pct">--</span><span class="track"><span class="fill"></span></span></div>
    <div class="quota" data-quota="week" title="正在读取额度"><span class="label">7d</span><span class="pct">--</span><span class="track"><span class="fill"></span></span></div>
    <button type="button" class="reload" aria-label="刷新额度" title="点击刷新额度">↻</button>
  `;
  nav.insertBefore(root, anchor);

  const refreshButton = root.querySelector('.reload');
  const outstanding = new Map();
  let nextId = 0;
  let busy = false;
  let destroyed = false;
  let lastAttempt = 0;
  let lastSuccess = 0;
  let snapshot = null;
  let stale = false;

  const formatReset = value => {
    if (value == null || !Number.isFinite(Number(value))) return '未提供';
    const date = new Date(Number(value) * 1000);
    return Number.isNaN(date.getTime()) ? '未提供' : date.toLocaleString();
  };
  const render = () => {
    for (const [key, label, value] of [
      ['five', '5 小时', snapshot?.fiveHour],
      ['week', '每周', snapshot?.weekly],
    ]) {
      const el = root.querySelector(`[data-quota="${key}"]`);
      const used = Number(value?.usedPercent);
      const valid = value != null && Number.isFinite(used) && used >= 0 && used <= 100;
      const remaining = valid ? Math.max(0, Math.min(100, 100 - used)) : null;
      el.querySelector('.pct').textContent = remaining === null ? '--' : `${Math.round(remaining)}%`;
      el.querySelector('.fill').style.width = remaining === null ? '0%' : `${remaining}%`;
      const reset = valid ? formatReset(value.resetsAt) : '未提供';
      el.title = `${label}额度：${remaining === null ? '暂无数据' : `${Math.round(remaining)}% 剩余`}` +
        `\n重置时间：${reset}` +
        `\n最近成功更新：${lastSuccess ? new Date(lastSuccess).toLocaleTimeString() : '尚未更新'}` +
        (stale ? '\n⚠ 读取失败，显示上次缓存的数据' : '');
    }
    refreshButton.title = (busy ? '正在刷新额度' : '点击立即刷新额度') +
      (stale ? '\n上次更新失败' : '') +
      (lastSuccess ? `\n最近更新：${new Date(lastSuccess).toLocaleTimeString()}` : '');
  };

  const askNative = () => new Promise((resolve, reject) => {
    if (typeof window.__codexUsageFetchV02 !== 'function') {
      reject(new Error('本地额度读取桥接未连接'));
      return;
    }
    const id = `request-${++nextId}`;
    const timer = setTimeout(() => {
      outstanding.delete(id);
      reject(new Error('读取额度超时'));
    }, 16000);
    outstanding.set(id, { resolve, reject, timer });
    try { window.__codexUsageFetchV02(JSON.stringify({ id, action: 'read' })); }
    catch (error) {
      clearTimeout(timer);
      outstanding.delete(id);
      reject(error);
    }
  });

  const refresh = async reason => {
    if (busy || destroyed) return;
    const now = Date.now();
    if (reason === 'hover' && now - lastSuccess < 60000) return;
    if (reason === 'auto' && now - lastAttempt < 120000) return;
    if (reason === 'manual' && now - lastAttempt < 10000) return;
    if (reason === 'hover' && now - lastAttempt < 60000) return;
    lastAttempt = now;
    busy = true;
    refreshButton.disabled = true;
    refreshButton.textContent = '…';
    render();
    try {
      const data = await askNative();
      if (destroyed) return;
      if (!data || typeof data !== 'object') throw new Error('额度响应格式错误');
      snapshot = data;
      stale = false;
      lastSuccess = Date.now();
    } catch (error) {
      if (destroyed) return;
      stale = true;
      console.warn('Codex usage: read failed:', error?.message || error);
    } finally {
      if (!destroyed) {
        busy = false;
        refreshButton.disabled = false;
        refreshButton.textContent = '↻';
        render();
      }
    }
  };

  const onClick = () => void refresh('manual');
  const onHover = () => void refresh('hover');
  refreshButton.addEventListener('click', onClick);
  root.addEventListener('mouseenter', onHover);
  const timer = setInterval(() => void refresh('auto'), 120000);
  const controller = {
    receive(payload) {
      const { id, data, error } = payload || {};
      const entry = outstanding.get(id);
      if (!entry) return;
      outstanding.delete(id);
      clearTimeout(entry.timer);
      error ? entry.reject(new Error(String(error))) : entry.resolve(data);
    },
    refresh() { return refresh('manual'); },
    destroy() {
      destroyed = true;
      clearInterval(timer);
      refreshButton.removeEventListener('click', onClick);
      root.removeEventListener('mouseenter', onHover);
      for (const [, entry] of outstanding) {
        clearTimeout(entry.timer);
        entry.reject(new Error('额度组件已关闭'));
      }
      outstanding.clear();
      root.remove();
      if (window.__codexUsageSidebarV02 === controller) delete window.__codexUsageSidebarV02;
    },
  };
  window.__codexUsageSidebarV02 = controller;
  render();
  void refresh('initial');
  console.log('Codex usage sidebar v0.2 mounted; waiting for local App Server.');
})();

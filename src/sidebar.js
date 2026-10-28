/*
 * Codex / ChatGPT Sidebar Usage — placement prototype
 * Built for the supplied DOM hierarchy from ChatGPT 26.1021.31345;
 * the integrated widget is NOT yet confirmed on the user's device.
 * Run through DevTools Console or scripts/inject.mjs.
 * Does not fetch account information or modify app files.
 */
(() => {
  const WIDGET_ID = "codex-sidebar-usage-prototype";
  const previous = window.__codexUsageSidebarPrototype;
  if (previous?.destroy) previous.destroy();

  // Prefer DevTools' selected avatar when available, but also support
  // unattended injection through the CDP launcher (where $0 is unavailable).
  const selected = typeof $0 !== "undefined" ? $0 : null;
  const selectedButton = selected instanceof Element ? selected.closest("button") : null;
  const selectedNav = selectedButton?.closest("nav");
  const isRail = node => node?.tagName === "NAV" &&
    String(node.className).includes("group/sidebar-rail");
  const nav = isRail(selectedNav) ? selectedNav :
    [...document.querySelectorAll("nav")].find(isRail);
  if (!nav) {
    console.warn("Sidebar rail was not found. No changes made.");
    return;
  }
  const avatarImage = [...nav.querySelectorAll("img")].find(img =>
    img.classList.contains("rounded-full") &&
    img.classList.contains("object-cover") &&
    Math.round(img.getBoundingClientRect().width) === 24);
  const button = isRail(selectedNav) && selectedButton ? selectedButton :
    avatarImage?.closest("button");
  if (!button || !nav.contains(button)) {
    console.warn("Avatar button was not found in the sidebar rail. No changes made.");
    return;
  }

  // Find the avatar's direct child inside the 52px sidebar navigation rail.
  let anchor = button;
  while (anchor?.parentElement && anchor.parentElement !== nav) {
    anchor = anchor.parentElement;
  }
  if (!anchor || anchor.parentElement !== nav) {
    console.warn("Could not locate the avatar anchor in the sidebar rail.");
    return;
  }

  document.getElementById(WIDGET_ID)?.remove();
  const root = document.createElement("div");
  root.id = WIDGET_ID;
  root.setAttribute("aria-label", "Codex usage quotas");
  root.style.cssText = [
    "box-sizing:border-box",
    "width:36px",
    "max-width:36px",
    "flex:0 0 auto",
    "align-self:center",
    "display:flex",
    "flex-direction:column",
    "align-items:center",
    "gap:8px",
    "color:inherit",
    "margin:0",
    "padding:0"
  ].join(";");
  root.innerHTML = `
    <style>
      #${WIDGET_ID} .quota { width:36px; display:flex; flex-direction:column; align-items:center; gap:2px; cursor:default; }
      #${WIDGET_ID} .label { font-size:9px; line-height:11px; opacity:.7; }
      #${WIDGET_ID} .pct { font-size:11px; line-height:13px; font-weight:600; font-variant-numeric:tabular-nums; }
      #${WIDGET_ID} .track { width:32px; height:3px; border-radius:9px; background:color-mix(in srgb, currentColor 18%, transparent); position:relative; overflow:hidden; }
      #${WIDGET_ID} .fill { position:absolute; top:0; left:0; height:100%; width:0%; border-radius:9px; opacity:1; }
      #${WIDGET_ID} [data-quota="five"] .fill { background:#16a34a; }
      #${WIDGET_ID} [data-quota="week"] .fill { background:#d97706; }
      #${WIDGET_ID} .reload { width:26px; height:24px; display:grid; place-items:center; padding:0; border:0; border-radius:7px; color:inherit; background:transparent; font-size:16px; line-height:1; }
      #${WIDGET_ID} .reload:not(:disabled) { cursor:pointer; }
      #${WIDGET_ID} .reload:hover:not(:disabled) { background:color-mix(in srgb, currentColor 9%, transparent); }
      #${WIDGET_ID} .reload:disabled { cursor:not-allowed; opacity:.3; }
    </style>
    <div class="quota" data-quota="five" title="尚未连接额度数据">
      <span class="label">5h</span><span class="pct">--</span>
      <span class="track"><span class="fill"></span></span>
    </div>
    <div class="quota" data-quota="week" title="尚未连接额度数据">
      <span class="label">7d</span><span class="pct">--</span>
      <span class="track"><span class="fill"></span></span>
    </div>
    <button class="reload" aria-label="刷新额度" title="尚未连接额度数据" disabled>↻</button>
  `;
  nav.insertBefore(root, anchor);

  const reloadButton = root.querySelector(".reload");
  let fetcher = null;
  let busy = false;
  let lastAttempt = 0;
  let lastSuccess = 0;
  const normalizeTime = t => {
    if (t == null) return null;
    const n = Number(t);
    const date = Number.isFinite(n) ? new Date(n < 1e12 ? n * 1000 : n) : new Date(t);
    return Number.isNaN(date.getTime()) ? null : date;
  };
  const renderWindow = (key, label, data) => {
    const element = root.querySelector(`[data-quota="${key}"]`);
    const used = Number(data?.usedPercent ?? data?.used_percent);
    if (!data || !Number.isFinite(used)) {
      element.querySelector(".pct").textContent = "--";
      element.querySelector(".fill").style.width = "0%";
      element.title = `${label}：暂无真实额度数据`;
      return;
    }
    const remaining = Math.max(0, Math.min(100, 100 - used));
    element.querySelector(".pct").textContent = `${Math.round(remaining)}%`;
    element.querySelector(".fill").style.width = `${remaining}%`;
    const reset = normalizeTime(data.resetsAt ?? data.reset_at);
    element.title = `${label}剩余 ${Math.round(remaining)}%` +
      (reset ? `\n重置：${reset.toLocaleString()}` : "\n重置时间暂不可用") +
      `\n更新：${new Date().toLocaleTimeString()}`;
  };
  const update = data => {
    renderWindow("five", "5 小时额度", data?.fiveHour ?? data?.five_hour);
    renderWindow("week", "每周额度", data?.weekly ?? data?.week);
    lastSuccess = Date.now();
  };
  const refresh = async (manual = false) => {
    if (!fetcher || busy) return;
    const now = Date.now();
    if (now - lastAttempt < (manual ? 10_000 : 60_000)) return;
    lastAttempt = now;
    busy = true;
    reloadButton.textContent = "…";
    reloadButton.title = "正在更新额度";
    try {
      const data = await fetcher();
      update(data);
      reloadButton.title = `刷新额度（最近更新 ${new Date(lastSuccess).toLocaleTimeString()}）`;
    } catch (error) {
      reloadButton.title = "更新失败，保留上次额度；请检查本地额度服务";
      console.warn("Usage refresh failed:", error);
    } finally {
      busy = false;
      reloadButton.textContent = "↻";
    }
  };
  const onClick = () => refresh(true);
  const onHover = () => refresh(false);
  reloadButton.addEventListener("click", onClick);
  root.addEventListener("mouseenter", onHover);

  window.__codexUsageSidebarPrototype = {
    // Accepts {fiveHour:{usedPercent:38,resetsAt:<unix seconds>},weekly:{...}}
    update,
    setFetcher(fn) {
      if (typeof fn !== "function") throw new TypeError("Expected an async fetch function");
      fetcher = fn;
      reloadButton.disabled = false;
      reloadButton.title = "刷新额度";
      void refresh(true);
    },
    destroy() {
      reloadButton.removeEventListener("click", onClick);
      root.removeEventListener("mouseenter", onHover);
      root.remove();
      if (window.__codexUsageSidebarPrototype === this) delete window.__codexUsageSidebarPrototype;
    }
  };
  console.log("Codex usage widget mounted above account avatar. Data is NOT connected yet.");
})();

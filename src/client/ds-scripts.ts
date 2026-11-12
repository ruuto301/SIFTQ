/** DS browser pane: CDP screencast canvas, tabs and history controls. */
export const DS_SCRIPT = `(function () {
  var root = document.getElementById("ds-root");
  if (!root) return;
  var canvas = document.getElementById("ds-browser-canvas");
  var form = document.getElementById("ds-browser-form");
  var input = document.getElementById("ds-browser-url");
  var status = document.getElementById("ds-browser-status");
  var tabBar = document.getElementById("ds-browser-tabs");
  if (!canvas || !form || !input) return;
  var chat = document.getElementById("dsh-chat");
  var taskId = chat ? chat.getAttribute("data-task-id") : null;
  var storageKey = "ds-browser:" + (taskId || "none");
  var viewport = { width: 1280, height: 800 };
  var sessionId = null;
  var started = false;
  var pendingUrl = null;
  var tabs = [];
  var activeTabId = null;
  var currentUrl = "";

  function setStatus(text) { if (status) status.textContent = text || ""; }
  function isHttp(url) { return /^https?:\\/\\//i.test(String(url || "")); }
  function normalize(value) {
    var url = String(value || "").trim();
    if (url === "") return "";
    if (isHttp(url)) return url;
    if (/^[a-z][a-z0-9+.-]*:/i.test(url)) return "";
    return "https://" + url;
  }
  function stored() {
    var value = "";
    try { value = localStorage.getItem(storageKey) || ""; } catch (e) { value = ""; }
    if (!isHttp(value)) {
      try { localStorage.removeItem(storageKey); } catch (e) { /* ignore */ }
      return "";
    }
    return value;
  }
  function remember(url) {
    if (!isHttp(url)) return;
    try { localStorage.setItem(storageKey, url); } catch (e) { /* ignore */ }
  }
  function request(method, payload) {
    var bridge = window.__dsBridge;
    if (!bridge || !bridge.isReady()) return false;
    bridge.send(method, payload);
    return true;
  }

  // Pane widths and browser maximization, persisted per browser.
  var LAYOUT_KEY = "ds-layout:v1";
  var layout = { left: 260, right: 380, max: false };
  try {
    var savedLayout = JSON.parse(localStorage.getItem(LAYOUT_KEY) || "null");
    if (savedLayout && typeof savedLayout === "object") {
      layout.left = Number(savedLayout.left) || 260;
      layout.right = Number(savedLayout.right) || 380;
      layout.max = savedLayout.max === true;
    }
  } catch (e) { /* ignore */ }
  function saveLayout() {
    try { localStorage.setItem(LAYOUT_KEY, JSON.stringify(layout)); } catch (e) { /* ignore */ }
  }
  function applyLayout() {
    root.style.setProperty("--ds-left", layout.left + "px");
    root.style.setProperty("--ds-right", layout.right + "px");
    root.classList.toggle("ds--browser-max", layout.max);
    if (maxButton) maxButton.textContent = layout.max ? "戻す" : "最大化";
  }
  var maxButton = document.getElementById("ds-browser-max");
  if (maxButton) {
    maxButton.addEventListener("click", function () {
      layout.max = !layout.max;
      applyLayout();
      saveLayout();
      window.dispatchEvent(new Event("resize"));
    });
  }
  Array.prototype.forEach.call(document.querySelectorAll(".ds__resizer"), function (handle) {
    handle.addEventListener("pointerdown", function (event) {
      if (layout.max) return;
      event.preventDefault();
      var side = handle.getAttribute("data-resize");
      var startX = event.clientX;
      var start = side === "left" ? layout.left : layout.right;
      handle.setPointerCapture(event.pointerId);
      handle.classList.add("dragging");
      function move(moveEvent) {
        var delta = moveEvent.clientX - startX;
        var next = side === "left" ? start + delta : start - delta;
        var min = side === "left" ? 180 : 260;
        var max = side === "left" ? 520 : 900;
        layout[side] = Math.round(Math.min(max, Math.max(min, next)));
        applyLayout();
      }
      function up() {
        handle.classList.remove("dragging");
        handle.removeEventListener("pointermove", move);
        handle.removeEventListener("pointerup", up);
        handle.removeEventListener("pointercancel", up);
        saveLayout();
        window.dispatchEvent(new Event("resize"));
      }
      handle.addEventListener("pointermove", move);
      handle.addEventListener("pointerup", up);
      handle.addEventListener("pointercancel", up);
    });
  });
  applyLayout();

  function draw(data) {
    var image = new Image();
    image.onload = function () {
      if (canvas.width !== image.width || canvas.height !== image.height) {
        canvas.width = image.width;
        canvas.height = image.height;
      }
      canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
      setStatus("");
    };
    image.src = "data:image/jpeg;base64," + data;
  }

  function renderTabs() {
    if (!tabBar) return;
    tabBar.innerHTML = "";
    tabs.forEach(function (tab) {
      var node = document.createElement("div");
      node.className = "ds__tab2" + (tab.id === activeTabId ? " active" : "");
      var label = document.createElement("span");
      label.className = "ds__tab2-label";
      var blank = !tab.url || tab.url === "about:blank";
      label.textContent = tab.title || (blank ? "新しいタブ" : tab.url);
      label.title = tab.url || "";
      label.addEventListener("click", function () {
        if (tab.id === activeTabId) return;
        request("browser.tab.select", { sessionId: sessionId, tabId: tab.id });
      });
      var close = document.createElement("button");
      close.type = "button";
      close.className = "ds__tab2-close";
      close.textContent = "×";
      close.title = "タブを閉じる";
      close.addEventListener("click", function (event) {
        event.stopPropagation();
        request("browser.tab.close", { sessionId: sessionId, tabId: tab.id });
      });
      node.appendChild(label);
      node.appendChild(close);
      tabBar.appendChild(node);
    });
    var add = document.createElement("button");
    add.type = "button";
    add.className = "ds__tab2-new";
    add.textContent = "+";
    add.title = "新しいタブ";
    add.addEventListener("click", function () {
      request("browser.tab.new", { sessionId: sessionId, url: "about:blank" });
    });
    tabBar.appendChild(add);
  }

  function point(event) {
    var rect = canvas.getBoundingClientRect();
    return {
      x: Math.round(((event.clientX - rect.left) / rect.width) * viewport.width),
      y: Math.round(((event.clientY - rect.top) / rect.height) * viewport.height),
    };
  }

  canvas.addEventListener("click", function (event) {
    if (sessionId === null) return;
    var p = point(event);
    request("browser.input", { sessionId: sessionId, event: { type: "mouse", action: "click", x: p.x, y: p.y, button: "left", clicks: 1 } });
    canvas.focus();
  });
  canvas.addEventListener("mousemove", function (event) {
    if (sessionId === null) return;
    var p = point(event);
    request("browser.input", { sessionId: sessionId, event: { type: "mouse", action: "move", x: p.x, y: p.y } });
  });
  canvas.addEventListener("wheel", function (event) {
    if (sessionId === null) return;
    event.preventDefault();
    var p = point(event);
    request("browser.input", { sessionId: sessionId, event: { type: "mouse", action: "wheel", x: p.x, y: p.y, deltaX: event.deltaX, deltaY: event.deltaY } });
  }, { passive: false });
  canvas.addEventListener("keydown", function (event) {
    if (sessionId === null) return;
    var special = ["Enter", "Backspace", "Tab", "Escape", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Delete", "Home", "End"];
    if (special.indexOf(event.key) >= 0) {
      event.preventDefault();
      request("browser.input", { sessionId: sessionId, event: { type: "key", action: "press", key: event.key } });
      return;
    }
    if (event.key.length === 1 && !event.ctrlKey && !event.metaKey) {
      event.preventDefault();
      request("browser.input", { sessionId: sessionId, event: { type: "key", action: "insert", text: event.key } });
    }
  });

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    var url = normalize(input.value);
    if (url === "") {
      if (String(input.value || "").trim() !== "") setStatus("http(s) の URL のみ開けます");
      input.value = currentUrl;
      return;
    }
    input.value = url;
    if (sessionId === null || !started) {
      pendingUrl = url;
      return;
    }
    setStatus("読み込み中…");
    request("browser.navigate", { sessionId: sessionId, url: url });
  });

  function history(action) {
    if (sessionId === null) return;
    setStatus("読み込み中…");
    request("browser.history", { sessionId: sessionId, action: action });
  }
  var back = document.getElementById("ds-browser-back");
  var forward = document.getElementById("ds-browser-forward");
  var reload = document.getElementById("ds-browser-reload");
  if (back) back.addEventListener("click", function () { history("back"); });
  if (forward) forward.addEventListener("click", function () { history("forward"); });
  if (reload) reload.addEventListener("click", function () { history("reload"); });

  function onEvent(message) {
    if (message.kind === "evt") {
      if (message.type === "browser.frame") {
        if (message.payload.tabId !== undefined && activeTabId !== null && message.payload.tabId !== activeTabId) return;
        draw(message.payload.data);
        return;
      }
      if (message.type === "browser.state") {
        var payload = message.payload || {};
        if (Array.isArray(payload.tabs)) tabs = payload.tabs;
        if (payload.activeTabId !== undefined) activeTabId = payload.activeTabId;
        renderTabs();
        if (payload.url !== undefined) {
          currentUrl = payload.url === "about:blank" ? "" : payload.url;
          input.value = currentUrl;
          remember(payload.url);
        }
        return;
      }
      return;
    }
    if (message.kind === "res" && (message.method === "browser.start" || message.method === "browser.tab.new" || message.method === "browser.tab.close" || message.method === "browser.tab.select")) {
      sessionId = message.payload.sessionId || sessionId;
      viewport = { width: message.payload.width || viewport.width, height: message.payload.height || viewport.height };
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      started = true;
      if (Array.isArray(message.payload.tabs)) tabs = message.payload.tabs;
      activeTabId = message.payload.activeTabId || activeTabId;
      renderTabs();
      var activeUrl = message.payload.url;
      if (activeUrl !== undefined) {
        currentUrl = activeUrl === "about:blank" ? "" : activeUrl;
        input.value = currentUrl;
        remember(activeUrl);
      }
      setStatus("接続済み");
      fitToPane();
      observePane();
      var current = message.payload.url || "";
      var blank = current === "" || current === "about:blank";
      var target = pendingUrl || (blank ? stored() : "");
      if (target && message.method === "browser.start") {
        setStatus("読み込み中…");
        request("browser.navigate", { sessionId: sessionId, url: target });
      }
      pendingUrl = null;
      return;
    }
    if (message.kind === "res" && message.method === "browser.resize") {
      viewport = { width: message.payload.width, height: message.payload.height };
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      return;
    }
    if (message.kind === "res" && message.method === "browser.history") {
      setStatus("");
      if (message.payload.url !== undefined) {
        currentUrl = message.payload.url === "about:blank" ? "" : message.payload.url;
        input.value = currentUrl;
        remember(message.payload.url);
      }
      return;
    }
    if (message.kind === "err" && message.method === "browser.start") {
      setStatus("起動できません: " + (message.payload.message || "unknown"));
      return;
    }
    if (message.kind === "err" && (message.method === "browser.navigate" || message.method === "browser.history")) {
      setStatus("読み込み失敗: " + (message.payload.message || "unknown"));
      return;
    }
  }

  var resizeTimer = null;
  var observer = null;
  function paneSize() {
    var rect = canvas.getBoundingClientRect();
    return { width: Math.max(320, Math.round(rect.width)), height: Math.max(240, Math.round(rect.height)) };
  }
  function fitToPane() {
    if (sessionId === null) return;
    var size = paneSize();
    if (Math.abs(size.width - viewport.width) < 8 && Math.abs(size.height - viewport.height) < 8) return;
    viewport = size;
    canvas.width = size.width;
    canvas.height = size.height;
    request("browser.resize", { sessionId: sessionId, width: size.width, height: size.height });
  }
  function observePane() {
    if (observer !== null || typeof ResizeObserver === "undefined") return;
    observer = new ResizeObserver(function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(fitToPane, 250);
    });
    observer.observe(canvas.parentElement || canvas);
  }

  function start() {
    var bridge = window.__dsBridge;
    if (!bridge) { setTimeout(start, 300); return; }
    if (!bridge.isReady() || bridge.getSessionId() === null) { setTimeout(start, 400); return; }
    if (sessionId !== null) return;
    bridge.onEvent(onEvent);
    setStatus("起動中…");
    bridge.send("browser.start", { sessionId: bridge.getSessionId() });
  }
  start();
})();`;

/** DS browser pane: CDP screencast canvas with forwarded input. */
export const DS_SCRIPT = `(function () {
  var root = document.getElementById("ds-root");
  if (!root) return;
  var canvas = document.getElementById("ds-browser-canvas");
  var form = document.getElementById("ds-browser-form");
  var input = document.getElementById("ds-browser-url");
  var status = document.getElementById("ds-browser-status");
  if (!canvas || !form || !input) return;
  var chat = document.getElementById("dsh-chat");
  var taskId = chat ? chat.getAttribute("data-task-id") : null;
  var storageKey = "ds-browser:" + (taskId || "none");
  var viewport = { width: 1280, height: 800 };
  var sessionId = null;
  var started = false;
  var pendingUrl = null;

  function setStatus(text) { if (status) status.textContent = text || ""; }

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
  function normalize(value) {
    var url = String(value || "").trim();
    if (url === "") return "";
    if (!/^https?:\\/\\//i.test(url)) url = "https://" + url;
    return url;
  }
  function stored() {
    try { return localStorage.getItem(storageKey) || ""; } catch (e) { return ""; }
  }
  function remember(url) {
    try { localStorage.setItem(storageKey, url); } catch (e) { /* ignore */ }
  }

  function request(method, payload) {
    var bridge = window.__dsBridge;
    if (!bridge || !bridge.isReady()) return false;
    bridge.send(method, payload);
    return true;
  }

  function draw(data) {
    var image = new Image();
    image.onload = function () {
      if (canvas.width !== image.width || canvas.height !== image.height) {
        canvas.width = image.width;
        canvas.height = image.height;
      }
      var context = canvas.getContext("2d");
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      setStatus("");
    };
    image.src = "data:image/jpeg;base64," + data;
  }

  function point(event) {
    var rect = canvas.getBoundingClientRect();
    var x = ((event.clientX - rect.left) / rect.width) * viewport.width;
    var y = ((event.clientY - rect.top) / rect.height) * viewport.height;
    return { x: Math.round(x), y: Math.round(y) };
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
    if (url === "") return;
    input.value = url;
    remember(url);
    if (sessionId === null || !started) {
      pendingUrl = url;
      return;
    }
    setStatus("読み込み中…");
    request("browser.navigate", { sessionId: sessionId, url: url });
  });

  function onEvent(message) {
    if (message.kind === "evt") {
      if (message.type === "browser.frame") { draw(message.payload.data); return; }
      if (message.type === "browser.state") {
        if (message.payload.url) { input.value = message.payload.url; remember(message.payload.url); }
        return;
      }
      return;
    }
    if (message.kind === "res" && message.method === "browser.start") {
      sessionId = message.payload.sessionId;
      viewport = { width: message.payload.width || 1280, height: message.payload.height || 800 };
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      started = true;
      setStatus("接続済み");
      var target = pendingUrl || stored();
      if (target) { request("browser.navigate", { sessionId: sessionId, url: target }); }
      pendingUrl = null;
      return;
    }
    if (message.kind === "err" && message.method === "browser.start") {
      setStatus("起動できません: " + (message.payload.message || "unknown"));
      return;
    }
    if (message.kind === "err" && message.method === "browser.navigate") {
      setStatus("読み込み失敗: " + (message.payload.message || "unknown"));
      return;
    }
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

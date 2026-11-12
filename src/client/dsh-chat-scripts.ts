/** DSH chat client: transport, streaming, tool cards, usage and approvals. */
export const DSH_CHAT_SCRIPT = `(function () {
  var root = document.getElementById("dsh-chat");
  if (!root) return;
  var taskId = root.getAttribute("data-task-id");
  var wsUrl = root.getAttribute("data-ws-url") || "ws://127.0.0.1:8799";
  var workspace = root.getAttribute("data-workspace") || "/mnt/c/projects";
  var log = document.getElementById("dsh-chat-log");
  var state = document.getElementById("dsh-chat-state");
  var usage = document.getElementById("dsh-chat-usage");
  var approval = document.getElementById("dsh-chat-approval");
  var form = document.getElementById("dsh-chat-form");
  var input = document.getElementById("dsh-chat-input");
  var send = document.getElementById("dsh-chat-send");
  var modelSelect = document.getElementById("dsh-chat-model");
  var stopButton = document.getElementById("dsh-chat-stop");
  var memoInput = document.getElementById("dsh-memo-input");
  var memoStatus = document.getElementById("dsh-memo-status");
  var memoView = document.getElementById("dsh-memo-view");
  var memoEdit = document.getElementById("dsh-memo-edit");
  var memoTimer = null;
  var memoText = "";
  var bridgeHandlers = [];
  var accessButton = document.getElementById("dsh-chat-access");
  var accessMenu = document.getElementById("dsh-chat-access-menu");
  var ACCESS_LABELS = { "read-only": "読み取り専用", "workspace-write": "ワークスペース書き込み", "danger-full-access": "フルアクセス" };
  var accessMode = "workspace-write";

  var socket = null;
  var sessionId = null;
  var retry = 0;
  var current = null;
  var currentText = "";
  var pendingUserLine = null;
  var busy = false;
  var seq = 0;
  var models = [];
  var selectedModel = "";
  var currentApprovalId = null;
  var totals = { input: 0, output: 0, cacheRead: 0 };

  window.__dsBridge = {
    send: function (method, payload) { return sendRequest(method, payload); },
    onEvent: function (handler) { bridgeHandlers.push(handler); },
    getSessionId: function () { return sessionId; },
    isReady: function () { return socket !== null && socket.readyState === 1; },
  };

  function setState(text, isError) {
    if (!state) return;
    state.textContent = text;
    state.style.color = isError ? "#c62828" : "";
  }
  function setAccess(mode) {
    accessMode = mode;
    if (accessButton) accessButton.textContent = ACCESS_LABELS[mode] || mode;
  }
  function setMemo(text, forceInput) {
    memoText = text || "";
    if (memoView) memoView.innerHTML = memoText.trim() === "" ? "" : renderMarkdown(memoText);
    if (memoInput && (forceInput === true || document.activeElement !== memoInput)) memoInput.value = memoText;
  }

  function setMemoEditing(editing) {
    if (!memoInput) return;
    memoInput.hidden = !editing;
    if (memoView) memoView.hidden = editing;
    if (memoEdit) memoEdit.textContent = editing ? "表示" : "編集";
    if (editing) memoInput.focus();
  }

  function requestId() { seq += 1; return "c-" + seq; }
  function sendRequest(method, payload) {
    if (!socket || socket.readyState !== 1) return null;
    var id = requestId();
    socket.send(JSON.stringify({ v: 1, kind: "req", id: id, method: method, payload: payload || {} }));
    return id;
  }
  function stick() { return log.scrollHeight - log.scrollTop - log.clientHeight < 60; }
  function scroll() { log.scrollTop = log.scrollHeight; }

  function line(role, text) {
    var keep = stick();
    var div = document.createElement("div");
    div.className = "dsh-chat__line dsh-chat__line--" + role;
    div.textContent = text;
    log.appendChild(div);
    if (keep) scroll();
    return div;
  }

  function escapeHtml(text) {
    return String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
  function renderMarkdown(text) {
    var html = escapeHtml(text);
    html = html.replace(/\\x60\\x60\\x60([\\s\\S]*?)\\x60\\x60\\x60/g, function (_match, code) {
      return '<pre class="dsh-code"><code>' + code.replace(/^\\n/, "") + "</code></pre>";
    });
    html = html.replace(/\\x60([^\\x60\\n]+)\\x60/g, "<code>$1</code>");
    html = html.replace(/\\*\\*([^*\\n]+)\\*\\*/g, "<strong>$1</strong>");
    html = html.replace(/^#{1,3}\\s+(.*)$/gm, "<strong>$1</strong>");
    html = html.replace(/^[-*]\\s+(.*)$/gm, "• $1");
    html = html.replace(/\\n/g, "<br>");
    return html;
  }

  function ensureAssistant() {
    if (current) return current;
    var keep = stick();
    current = document.createElement("div");
    current.className = "dsh-chat__line dsh-chat__line--assistant streaming";
    log.appendChild(current);
    if (keep) scroll();
    return current;
  }

  function finishAssistant(text) {
    var target = ensureAssistant();
    target.classList.remove("streaming");
    target.innerHTML = renderMarkdown(text || currentText);
    current = null;
    currentText = "";
    scroll();
  }

  function updateUsage(payload) {
    var last = "入力 " + payload.inputTokens + " / 出力 " + payload.outputTokens +
      " / キャッシュ " + payload.cacheReadTokens +
      (typeof payload.tokPerSec === "number" ? " / " + payload.tokPerSec.toFixed(1) + " tok/s" : "");
    totals.input += payload.inputTokens || 0;
    totals.output += payload.outputTokens || 0;
    totals.cacheRead += payload.cacheReadTokens || 0;
    usage.textContent = last + "　累計: 入力 " + totals.input + " / 出力 " + totals.output + " / キャッシュ " + totals.cacheRead;
    usage.hidden = false;
  }

  function toolCard(callId, name, summary) {
    var card = document.createElement("details");
    card.className = "dsh-card";
    var head = document.createElement("summary");
    head.textContent = "tool: " + name + "（実行中）";
    card.appendChild(head);
    var body = document.createElement("pre");
    body.textContent = summary || "";
    card.appendChild(body);
    log.appendChild(card);
    scroll();
    return { card: card, head: head, body: body };
  }

  function renderApproval(p) {
    if (p.approvalId !== undefined && p.approvalId === currentApprovalId && !approval.hidden) return;
    currentApprovalId = p.approvalId === undefined ? null : p.approvalId;
    approval.innerHTML = "";
    approval.hidden = false;
    var title = document.createElement("div");
    title.className = "dsh-chat__approval-title";
    title.textContent = p.title || ("承認: " + (p.toolName || ""));
    approval.appendChild(title);
    var detail = document.createElement("div");
    detail.className = "dsh-chat__approval-detail";
    detail.textContent = p.detail || "";
    approval.appendChild(detail);
    var row = document.createElement("div");
    row.className = "dsh-chat__approval-actions";
    (p.options || []).forEach(function (option) {
      var button = document.createElement("button");
      button.type = "button";
      button.className = "button";
      button.textContent = option.label || option.id;
      button.addEventListener("click", function () {
        sendRequest("approval.respond", { approvalId: p.approvalId, optionId: option.id });
        row.querySelectorAll("button").forEach(function (candidate) { candidate.disabled = true; });
        detail.textContent = "応答済み: " + (option.label || option.id);
      });
      row.appendChild(button);
    });
    approval.appendChild(row);
    scroll();
  }

  function populateModels(list) {
    models = list || [];
    if (!modelSelect) return;
    modelSelect.innerHTML = "";
    models.forEach(function (model) {
      var option = document.createElement("option");
      option.value = model.id;
      option.textContent = model.name || ((model.provider ? model.provider + " / " : "") + model.model);
      modelSelect.appendChild(option);
    });
    if (models.length > 0) {
      var preferred = models.find(function (model) { return model["default"] === true; }) || models[0];
      selectedModel = preferred.id;
      modelSelect.value = selectedModel;
    }
  }

  function connect() {
    setState(retry === 0 ? "接続中…" : "再接続中…");
    socket = new WebSocket(wsUrl);
    socket.addEventListener("open", function () {
      retry = 0;
      setState("セッション作成中…");
      sendRequest("hello", { client: "siftq" });
    });
    socket.addEventListener("message", function (event) {
      var message;
      try { message = JSON.parse(event.data); } catch (e) { return; }
      bridgeHandlers.forEach(function (handler) {
        try { handler(message); } catch (error) { /* isolated */ }
      });
      if (message.kind === "evt") {
        if (message.type === "transport.ready") return;
        if (message.type === "session.state") {
          if (message.payload && message.payload.state === "idle") { busy = false; send.disabled = false; if (stopButton) stopButton.hidden = true; }
          return;
        }
        if (message.type === "session.access") { setAccess(message.payload.mode); return; }
        if (message.type === "memo.updated") {
          setMemo(message.payload.text);
          if (memoStatus) memoStatus.textContent = "更新済み";
          return;
        }
        if (message.type === "session.updated") {
          var updated = message.payload || {};
          var match = models.find(function (model) {
            if (model.id === updated.model) return true;
            return model.model === updated.model && (!updated.provider || model.provider === updated.provider);
          });
          if (match && modelSelect) {
            selectedModel = match.id;
            modelSelect.value = match.id;
          }
          return;
        }
        if (message.type === "turn.start") { ensureAssistant(); return; }
        if (message.type === "user.message") {
          var existing = log.querySelector('[data-message-id="' + message.payload.messageId + '"]');
          if (!existing) {
            var last = log.lastElementChild;
            if (last && last.className.indexOf("dsh-chat__line--user") >= 0 && last.textContent === message.payload.text && !last.dataset.messageId) {
              last.dataset.messageId = message.payload.messageId;
            } else {
              line("user", message.payload.text).dataset.messageId = message.payload.messageId;
            }
          }
          return;
        }
        if (message.type === "message.delta") {
          ensureAssistant();
          currentText += message.payload.text || "";
          current.textContent = currentText;
          if (stick()) scroll();
          return;
        }
        if (message.type === "message.done") {
          finishAssistant(message.payload.content);
          if (message.payload.usage) updateUsage(message.payload.usage);
          return;
        }
        if (message.type === "tool.start") {
          var card = toolCard(message.payload.callId, message.payload.name, message.payload.inputSummary);
          card.head.dataset.callId = message.payload.callId;
          return;
        }
        if (message.type === "tool.end") {
          var cards = log.querySelectorAll("details.dsh-card");
          var found = null;
          for (var i = 0; i < cards.length; i += 1) {
            if (cards[i].querySelector("summary").dataset.callId === message.payload.callId) { found = cards[i]; break; }
          }
          if (found) {
            found.querySelector("summary").textContent = "tool: " + message.payload.callId.slice(0, 8) + "（" + message.payload.status + "）";
            var pre = found.querySelector("pre");
            if (message.payload.outputSummary) pre.textContent = message.payload.outputSummary;
          }
          return;
        }
        if (message.type === "usage") { updateUsage(message.payload); return; }
        if (message.type === "approval.request") { renderApproval(message.payload); return; }
        if (message.type === "approval.resolved") {
          currentApprovalId = null;
          approval.hidden = true;
          return;
        }
        if (message.type === "turn.end") {
          var reason = message.payload && message.payload.reason;
          if (reason && reason.kind === "error" && reason.error && reason.error.message) {
            var failure = document.createElement("div");
            failure.className = "dsh-chat__line dsh-chat__error";
            failure.textContent = "エラー: " + String(reason.error.message).split(String.fromCharCode(10))[0].slice(0, 300);
            log.appendChild(failure);
            scroll();
          }
          busy = false; send.disabled = false; if (stopButton) stopButton.hidden = true; return;
        }
        return;
      }
      if (message.kind === "res" && message.method === "hello") {
        var capabilities = message.payload && message.payload.capabilities ? message.payload.capabilities : {};
        if (capabilities.defaultAccessMode) setAccess(capabilities.defaultAccessMode);
        populateModels(capabilities.models || []);
        sendRequest("session.create", { clientKey: "task:" + taskId, cwd: workspace });
        return;
      }
      if (message.kind === "res" && message.method === "session.create") {
        sessionId = message.payload.sessionId;
        setState(message.payload.resumed ? "再接続済み" : "接続済み");
        if (message.payload.model) {
          var matched = models.find(function (model) {
            return model.model === message.payload.model && (!message.payload.provider || model.provider === message.payload.provider);
          });
          if (matched) { selectedModel = matched.id; if (modelSelect) modelSelect.value = selectedModel; }
        }
        sendRequest("session.subscribe", { sessionId: sessionId, sinceSeq: 0 });
        sendRequest("memo.get", { sessionId: sessionId });
        if (input) input.focus();
        return;
      }
      if (message.kind === "res" && message.method === "session.subscribe") return;
      if (message.kind === "res" && message.method === "memo.get") {
        setMemo(message.payload.text);
        if (memoStatus) memoStatus.textContent = "";
        return;
      }
      if (message.kind === "res" && message.method === "memo.write") {
        if (memoStatus) memoStatus.textContent = "保存済み";
        return;
      }
      if (message.kind === "res" && message.method === "prompt.send") {
        if (pendingUserLine) { pendingUserLine.dataset.messageId = message.payload.turnId; pendingUserLine = null; }
        return;
      }
      if (message.kind === "err") {
        var code = message.payload && message.payload.code;
        if (code === "not_found" && currentApprovalId !== null) {
          currentApprovalId = null;
          approval.hidden = true;
          setState("承認は既に終了しています");
          return;
        }
        setState("エラー: " + (message.payload && message.payload.message ? message.payload.message : "unknown"), true);
        busy = false;
        send.disabled = false;
        if (stopButton) stopButton.hidden = true;
        return;
      }
    });
    socket.addEventListener("close", function () {
      sessionId = null;
      setState("切断（再接続します）");
      retry += 1;
      setTimeout(connect, Math.min(30000, 1000 * Math.pow(2, retry - 1)));
    });
  }

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    var text = input.value.trim();
    if (text === "" || sessionId === null || busy) return;
    pendingUserLine = line("user", text);
    input.value = "";
    busy = true;
    send.disabled = true;
    if (stopButton) stopButton.hidden = false;
    sendRequest("prompt.send", { sessionId: sessionId, clientMessageId: "m-" + Date.now(), text: text });
  });

  if (stopButton) {
    stopButton.addEventListener("click", function () {
      if (sessionId !== null) sendRequest("prompt.cancel", { sessionId: sessionId });
    });
  }
  var tabs = document.querySelectorAll("[data-ds-tab]");
  var panes = document.querySelectorAll("[data-ds-pane]");
  tabs.forEach(function (tab) {
    tab.addEventListener("click", function () {
      var name = tab.getAttribute("data-ds-tab");
      tabs.forEach(function (other) { other.classList.toggle("active", other === tab); });
      panes.forEach(function (pane) { pane.hidden = pane.getAttribute("data-ds-pane") !== name; });
      if (name === "chat" && input) input.focus();
      if (name === "memo" && sessionId !== null) sendRequest("memo.get", { sessionId: sessionId });
    });
  });

  if (memoEdit) {
    memoEdit.addEventListener("click", function () {
      setMemoEditing(memoInput ? memoInput.hidden : false);
    });
  }
  if (memoView) {
    memoView.addEventListener("dblclick", function () { setMemoEditing(true); });
  }
  if (memoInput) {
    memoInput.addEventListener("input", function () {
      if (memoStatus) memoStatus.textContent = "未保存";
      clearTimeout(memoTimer);
      memoTimer = setTimeout(function () {
        if (sessionId === null) return;
        if (memoStatus) memoStatus.textContent = "保存中…";
        sendRequest("memo.write", { sessionId: sessionId, text: memoInput.value });
      }, 800);
    });
    memoInput.addEventListener("blur", function () {
      clearTimeout(memoTimer);
      if (sessionId === null) return;
      if (memoStatus) memoStatus.textContent = "保存中…";
      sendRequest("memo.write", { sessionId: sessionId, text: memoInput.value });
    });
  }

  if (accessButton && accessMenu) {
    accessButton.addEventListener("click", function (event) {
      event.stopPropagation();
      accessMenu.hidden = !accessMenu.hidden;
      accessButton.setAttribute("aria-expanded", String(!accessMenu.hidden));
    });
    accessMenu.addEventListener("click", function (event) {
      event.stopPropagation();
      var target = event.target;
      var mode = target && target.getAttribute ? target.getAttribute("data-mode") : null;
      if (!mode) return;
      setAccess(mode);
      accessMenu.hidden = true;
      if (sessionId !== null) sendRequest("session.access", { sessionId: sessionId, mode: mode });
    });
    document.addEventListener("click", function () { accessMenu.hidden = true; });
  }
  if (modelSelect) {
    modelSelect.addEventListener("change", function () {
      selectedModel = modelSelect.value;
      if (sessionId !== null) sendRequest("session.configure", { sessionId: sessionId, model: selectedModel });
    });
  }

  connect();
})();`;

/** DSH chat client: WebSocket transport, streaming, usage and approvals. */
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

  var socket = null;
  var sessionId = null;
  var retry = 0;
  var current = null;
  var pendingUserLine = null;
  var busy = false;
  var seq = 0;

  function setState(text) { state.textContent = text; }
  function requestId() { seq += 1; return "c-" + seq; }
  function sendRequest(method, payload) {
    if (!socket || socket.readyState !== 1) return null;
    var id = requestId();
    socket.send(JSON.stringify({ v: 1, kind: "req", id: id, method: method, payload: payload || {} }));
    return id;
  }
  function line(role, text) {
    var div = document.createElement("div");
    div.className = "dsh-chat__line dsh-chat__line--" + role;
    div.textContent = text;
    log.appendChild(div);
    log.scrollTop = log.scrollHeight;
    return div;
  }
  function showUsage(u) {
    if (!u) return;
    var parts = [];
    if (u.inputTokens) parts.push("入力 " + u.inputTokens);
    if (u.outputTokens) parts.push("出力 " + u.outputTokens);
    if (u.cacheReadTokens) parts.push("キャッシュ " + u.cacheReadTokens);
    if (typeof u.tokPerSec === "number") parts.push(u.tokPerSec.toFixed(1) + " tok/s");
    usage.textContent = parts.join(" / ");
    usage.hidden = parts.length === 0;
  }
  function renderApproval(p) {
    approval.innerHTML = "";
    var title = document.createElement("div");
    title.className = "dsh-chat__approval-title";
    title.textContent = p.title || "承認が必要です";
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
        approval.hidden = true;
      });
      row.appendChild(button);
    });
    approval.appendChild(row);
    approval.hidden = false;
  }
  function connect() {
    setState(retry === 0 ? "接続中…" : "再接続中…");
    socket = new WebSocket(wsUrl);
    socket.addEventListener("open", function () {
      retry = 0;
      setState("セッション作成中…");
      sendRequest("session.create", { clientKey: "task:" + taskId, cwd: workspace });
    });
    socket.addEventListener("message", function (event) {
      var message;
      try { message = JSON.parse(event.data); } catch (e) { return; }
      if (message.kind === "evt") {
        if (message.type === "transport.ready") return;
        if (message.type === "session.state") {
          if (message.payload && message.payload.state === "idle") { busy = false; send.disabled = false; }
          return;
        }
        if (message.type === "turn.start") { current = line("assistant", ""); return; }
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
          if (!current) current = line("assistant", "");
          current.textContent += message.payload.text || "";
          log.scrollTop = log.scrollHeight;
          return;
        }
        if (message.type === "message.done") {
          if (!current) current = line("assistant", "");
          current.textContent = message.payload.content || current.textContent;
          showUsage(message.payload.usage);
          current = null;
          return;
        }
        if (message.type === "tool.start") { line("tool", "tool: " + message.payload.name); return; }
        if (message.type === "approval.request") { renderApproval(message.payload); return; }
        if (message.type === "turn.end") { busy = false; send.disabled = false; return; }
        return;
      }
      if (message.kind === "res" && message.method === "session.create") {
        sessionId = message.payload.sessionId;
        setState(message.payload.resumed ? "再接続済み" : "接続済み");
        sendRequest("session.subscribe", { sessionId: sessionId, sinceSeq: 0 });
        input.focus();
        return;
      }
      if (message.kind === "res" && message.method === "session.subscribe") {
        return;
      }
      if (message.kind === "res" && message.method === "prompt.send") {
        if (pendingUserLine) { pendingUserLine.dataset.messageId = message.payload.turnId; pendingUserLine = null; }
        return;
      }
      if (message.kind === "err") {
        setState("エラー: " + (message.payload && message.payload.message ? message.payload.message : "unknown"));
        busy = false;
        send.disabled = false;
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
    sendRequest("prompt.send", { sessionId: sessionId, clientMessageId: "m-" + Date.now(), text: text });
  });
  connect();
})();`;

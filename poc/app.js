(function () {
  "use strict";

  const STORAGE_KEY = "siftq-poc-state-v1";
  const STATUS_FILTERS = ["do", "done", "skip"];
  const SOURCE_LABELS = {
    manual: "手動",
    github: "GitHub",
    email: "メール",
    slack: "Slack",
    discord: "Discord",
  };
  // グループ導入前の localStorage をシードのグループへ寄せる。
  const SEED_PROJECTS = {
    "task-github": "Yoriwake",
    "task-video": "YouTube",
    "task-report": "Yoriwake",
    "task-invoice": "生活",
    "task-login": "Yoriwake",
    "task-matrix": "Yoriwake",
  };

  let state = load();
  let stream = null;
  let pendingFocus = null;
  let toastTimer = null;

  const $ = (selector) => document.querySelector(selector);

  function uid(prefix) {
    return prefix + "-" + Math.random().toString(36).slice(2, 9);
  }

  function esc(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, (char) => {
      const map = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
      return map[char];
    });
  }

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return window.SIFTQ_SEED();
      const parsed = JSON.parse(raw);
      if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.tasks)) {
        return window.SIFTQ_SEED();
      }
      return parsed;
    } catch (error) {
      return window.SIFTQ_SEED();
    }
  }

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
      // localStorage が使えない環境ではメモリ上だけで動かす。
    }
  }

  function ensureState() {
    if (!state.paneWidths) state.paneWidths = { left: 300, right: 400 };
    if (!STATUS_FILTERS.includes(state.statusFilter)) state.statusFilter = "do";
    if (!state.usage) {
      state.usage = { session: { used: 0, limit: 5 }, week: { used: 0, limit: 50 } };
    }
    if (!Array.isArray(state.projectOrder)) state.projectOrder = [];
    if (!state.collapsed || typeof state.collapsed !== "object") state.collapsed = {};
    for (const task of state.tasks) {
      if (!task.ui) task.ui = {};
      if (!task.ui.centerTab) task.ui.centerTab = "chat";
      if (typeof task.project !== "string" || !task.project || task.project === "その他") {
        task.project = SEED_PROJECTS[task.id] || "その他";
      }
      if (task.kind === "task") ensureProject(projectName(task));
      if (!Array.isArray(task.conversations) || task.conversations.length === 0) {
        task.conversations = [{ id: uid("conv"), title: "メイン", messages: [] }];
      }
      if (!task.ui.selectedConversationId) {
        task.ui.selectedConversationId = task.conversations[0].id;
      }
      if (typeof task.memo !== "string") task.memo = "";
      if (!Array.isArray(task.browserTabs) || task.browserTabs.length === 0) {
        task.browserTabs = [{ id: uid("tab"), url: "about:blank", title: "新しいタブ", active: true }];
      }
      for (const conversation of task.conversations) {
        for (const message of conversation.messages) {
          if (message.status === "streaming") message.status = "stopped";
        }
      }
    }
    if (!selectedTask()) state.selectedTaskId = state.tasks.length ? state.tasks[0].id : null;
    const selected = selectedTask();
    if (selected && selected.unread) selected.unread = false;
  }

  function selectedTask() {
    return state.tasks.find((task) => task.id === state.selectedTaskId) || null;
  }

  function taskById(id) {
    return state.tasks.find((task) => task.id === id) || null;
  }

  function projectName(task) {
    return task.project || "その他";
  }

  function ensureProject(name) {
    if (!name) return;
    if (state.projectOrder.includes(name)) return;
    const otherIndex = state.projectOrder.indexOf("その他");
    if (otherIndex === -1) state.projectOrder.push(name);
    else state.projectOrder.splice(otherIndex, 0, name);
  }

  function projectList() {
    const names = Array.from(new Set(state.tasks.map(projectName)));
    if (!names.includes("その他")) names.push("その他");
    const ordered = state.projectOrder.filter((name) => names.includes(name));
    const missing = names.filter((name) => !ordered.includes(name));
    missing.sort((left, right) => {
      if (left === "その他") return 1;
      if (right === "その他") return -1;
      return left.localeCompare(right, "ja");
    });
    const otherIndex = ordered.indexOf("その他");
    if (otherIndex === -1) return ordered.concat(missing);
    return ordered.slice(0, otherIndex).concat(missing, ordered.slice(otherIndex));
  }

  function projectGroupKey(name) {
    return "project:" + name;
  }

  function isCollapsed(key) {
    return Boolean(state.collapsed[key]);
  }

  function frontOrder(kind, project) {
    const list = state.tasks.filter(
      (task) => task.kind === kind && (kind === "tentative" || projectName(task) === project),
    );
    const orders = list.map((task) => task.order || 0);
    return orders.length ? Math.min.apply(null, orders) - 1 : 0;
  }

  function groupTasks(kind, project) {
    return state.tasks
      .filter((task) => task.kind === kind && (kind === "tentative" || projectName(task) === project))
      .sort((left, right) => left.order - right.order);
  }

  function applyGroupOrder(ordered) {
    ordered.forEach((task, index) => {
      task.order = index;
    });
  }

  function normalizeGroup(kind, project) {
    applyGroupOrder(groupTasks(kind, project));
  }

  function currentConversation(task) {
    let conversation = task.conversations.find((item) => item.id === task.ui.selectedConversationId);
    if (!conversation) {
      conversation = task.conversations[0];
      task.ui.selectedConversationId = conversation.id;
    }
    return conversation;
  }

  function activeBrowserTab(task) {
    return task.browserTabs.find((tab) => tab.active) || task.browserTabs[0] || null;
  }

  function findMessage(taskId, conversationId, messageId) {
    const task = taskById(taskId);
    if (!task) return null;
    const conversation = task.conversations.find((item) => item.id === conversationId);
    if (!conversation) return null;
    return conversation.messages.find((item) => item.id === messageId) || null;
  }

  function timeAgo(iso) {
    const diff = Math.max(0, Date.now() - new Date(iso).getTime());
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return "now";
    if (minutes < 60) return minutes + "m";
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return hours + "h";
    return Math.floor(hours / 24) + "d";
  }

  function clock(iso) {
    try {
      return new Date(iso).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" });
    } catch (error) {
      return "";
    }
  }

  function sourceLabel(source) {
    return SOURCE_LABELS[source] || source || "手動";
  }

  function percent(usage) {
    if (!usage || !usage.limit) return 0;
    return Math.min(100, Math.round((usage.used / usage.limit) * 100));
  }

  function empty(message) {
    return '<div class="empty">' + esc(message) + "</div>";
  }

  function makeTask(options) {
    const now = new Date().toISOString();
    const kind = options.kind;
    const conversationId = uid("conv");
    return {
      id: uid(kind === "tentative" ? "idea" : "task"),
      kind: kind,
      title: options.title,
      project: options.project || "その他",
      description: "",
      status: "do",
      working: false,
      pinned: false,
      unread: false,
      source: options.source || "manual",
      order: frontOrder(kind, options.project || "その他"),
      createdAt: now,
      updatedAt: now,
      memo: "",
      conversations: [{ id: conversationId, title: "メイン", messages: [] }],
      browserTabs: [{ id: uid("tab"), url: "about:blank", title: "新しいタブ", active: true }],
      ui: { centerTab: "chat", selectedConversationId: conversationId },
    };
  }

  function render() {
    renderLeft();
    renderCenter();
    renderRight();
    renderBottom();
    scrollChatToBottom();
    if (pendingFocus) {
      const element = document.getElementById(pendingFocus);
      if (element) element.focus();
      pendingFocus = null;
    }
  }

  function renderLeft() {
    const projectSelect = $("#task-project");
    const previousProject = projectSelect.value;
    const projects = projectList();
    projectSelect.innerHTML =
      projects.map((project) => '<option value="' + esc(project) + '">' + esc(project) + "</option>").join("") +
      '<option value="__new__">+ 新しいグループ</option>';
    projectSelect.value = projects.includes(previousProject) ? previousProject : "その他";

    const counts = {};
    for (const status of STATUS_FILTERS) {
      counts[status] = state.tasks.filter((task) => task.status === status).length;
    }
    $("#status-tabs").innerHTML = STATUS_FILTERS.map(
      (status) =>
        '<button type="button" class="status-tab ' +
        (state.statusFilter === status ? "active" : "") +
        '" data-action="status-filter" data-status="' +
        status +
        '">' +
        status +
        '<span class="count">' +
        counts[status] +
        "</span></button>",
    ).join("");

    const list = $("#task-list");
    if (state.statusFilter === "do") {
      const tentative = state.tasks
        .filter((task) => task.kind === "tentative")
        .sort((left, right) => Number(right.pinned) - Number(left.pinned) || left.order - right.order);
      const normal = state.tasks.filter((task) => task.kind === "task" && task.status === "do");
      let html = "";
      if (tentative.length) {
        const key = "tentative";
        html += groupHeader(key, "仮タスク", tentative.length, null, true);
        if (!isCollapsed(key)) html += tentative.map(taskItem).join("");
      }
      for (const project of projects) {
        const items = normal
          .filter((task) => projectName(task) === project)
          .sort((left, right) => left.order - right.order);
        if (!items.length) continue;
        const key = projectGroupKey(project);
        html += groupHeader(key, project, items.length, project, false);
        if (!isCollapsed(key)) html += items.map(taskItem).join("");
      }
      list.innerHTML = html || empty("タスクがありません");
    } else {
      const items = state.tasks
        .filter((task) => task.kind === "task" && task.status === state.statusFilter)
        .sort((left, right) => new Date(right.updatedAt) - new Date(left.updatedAt));
      list.innerHTML = items.length ? items.map(taskItem).join("") : empty(state.statusFilter + " のタスクはありません");
    }
  }

  function groupHeader(key, label, count, project, isTentative) {
    const collapsed = isCollapsed(key);
    const draggable = project !== null;
    return (
      '<div class="group-header' +
      (draggable ? " draggable" : "") +
      '"' +
      (draggable ? ' draggable="true" data-group="' + esc(project) + '"' : "") +
      ' data-group-key="' +
      esc(key) +
      '"' +
      (isTentative ? ' data-tentative="true"' : "") +
      ">" +
      '<button type="button" class="group-toggle" data-action="toggle-group" data-key="' +
      esc(key) +
      '">' +
      '<span class="group-caret">' +
      (collapsed ? "▷" : "▽") +
      "</span>" +
      '<span class="group-name">' +
      esc(label) +
      "</span>" +
      '<span class="group-count">' +
      count +
      "</span>" +
      "</button></div>"
    );
  }

  function taskItem(task) {
    const badges = [];
    if (task.kind === "tentative") badges.push('<span class="badge tentative">仮</span>');
    if (task.kind === "tentative" && task.pinned) badges.push('<span class="badge pinned">固定</span>');
    if (task.working) badges.push('<span class="badge working"><span class="dot"></span>working</span>');
    if (task.unread) badges.push('<span class="badge unread">未読</span>');
    if (task.source && task.source !== "manual") {
      badges.push('<span class="badge source">' + esc(sourceLabel(task.source)) + "</span>");
    }
    if (task.status === "done") badges.push('<span class="badge done">done</span>');
    if (task.status === "skip") badges.push('<span class="badge skip">skip</span>');

    const check =
      '<span class="check ' +
      (task.status === "done" ? "checked" : "") +
      '" aria-hidden="true">' +
      (task.status === "done" ? "✓" : "") +
      "</span>";

    const pin =
      task.kind === "tentative"
        ? '<button type="button" class="icon-button ' +
          (task.pinned ? "on" : "") +
          '" data-action="pin" data-id="' +
          task.id +
          '" title="' +
          (task.pinned ? "固定を外す" : "固定する") +
          '">pin</button>'
        : "";

    return (
      '<div class="task-item ' +
      (task.id === state.selectedTaskId ? "selected " : "") +
      (task.working ? "is-working" : "") +
      '" draggable="true" data-action="select-task" data-id="' +
      task.id +
      '">' +
      check +
      '<div class="task-main">' +
      '<div class="task-title">' +
      esc(task.title) +
      "</div>" +
      '<div class="task-meta">' +
      badges.join("") +
      '<span class="time">' +
      timeAgo(task.updatedAt) +
      "</span></div></div>" +
      '<div class="task-actions">' +
      pin +
      "</div></div>"
    );
  }

  function renderCenter() {
    const pane = $("#pane-center");
    const task = selectedTask();
    if (!task) {
      pane.innerHTML = '<div class="pane-empty">タスクを選択してください。</div>';
      return;
    }

    const tab = task.ui.centerTab;
    const conversation = currentConversation(task);
    const header =
      '<header class="task-header">' +
      '<div class="task-heading">' +
      '<div class="task-heading-line">' +
      (task.kind === "tentative" ? '<span class="badge tentative">仮</span>' : "") +
      (task.working ? '<span class="badge working"><span class="dot"></span>working</span>' : "") +
      "<h1>" +
      esc(task.title) +
      "</h1></div>" +
      '<div class="task-sub">' +
      esc(sourceLabel(task.source)) +
      " · " +
      esc(projectName(task)) +
      " · " +
      timeAgo(task.updatedAt) +
      "</div></div></header>";

    const tabs =
      '<div class="tabs">' +
      '<button type="button" class="tab ' +
      (tab === "chat" ? "active" : "") +
      '" data-action="center-tab" data-tab="chat">チャット</button>' +
      '<button type="button" class="tab ' +
      (tab === "memo" ? "active" : "") +
      '" data-action="center-tab" data-tab="memo">メモ</button>' +
      "</div>";

    const body = tab === "memo" ? memoHtml(task) : chatHtml(task, conversation);
    pane.innerHTML = header + tabs + '<div class="center-body">' + body + "</div>";
  }

  function chatHtml(task, conversation) {
    const messages =
      conversation.messages.map(messageHtml).join("") ||
      '<div class="chat-empty">まだメッセージはありません。</div>';

    const streaming = conversation.messages.some((message) => message.status === "streaming");
    const working = streaming
      ? '<div class="working-line"><span class="dot"></span>Working <span data-working-elapsed>0s</span></div>'
      : "";
    const stop = streaming
      ? '<button type="button" class="button small danger" data-action="stop-chat">停止</button>'
      : "";

    return (
      '<div class="chat-log" id="chat-log">' +
      messages +
      "</div>" +
      working +
      '<form class="chat-composer" id="chat-form">' +
      '<textarea id="chat-input" rows="3" placeholder="メッセージ（Enterで改行・Ctrl/Cmd+Enterで送信）"></textarea>' +
      '<div class="composer-bar">' +
      '<select id="model-select" aria-label="モデル"><option>siftq-fast</option><option>siftq-pro</option></select>' +
      '<span class="context-hint">' +
      esc(contextLine(task)) +
      "</span>" +
      stop +
      '<button type="submit" class="button primary">送信</button>' +
      "</div></form>"
    );
  }

  function messageHtml(message) {
    if (message.role === "tool") {
      return (
        '<div class="msg tool" data-message-id="' +
        message.id +
        '"><div class="msg-body">' +
        esc(message.content) +
        "</div></div>"
      );
    }
    const actions =
      message.role === "assistant" && message.status !== "streaming"
        ? '<div class="msg-actions">' +
          '<button type="button" class="mini" data-action="copy-message" data-message-id="' +
          message.id +
          '">コピー</button>' +
          '<button type="button" class="mini" data-action="task-from-message" data-message-id="' +
          message.id +
          '">タスクにする</button>' +
          "</div>"
        : "";
    const label = message.role === "user" ? "自分" : "siftq";
    return (
      '<div class="msg ' +
      message.role +
      '" data-message-id="' +
      message.id +
      '">' +
      '<div class="msg-label">' +
      label +
      '<span class="msg-time">' +
      clock(message.createdAt) +
      "</span></div>" +
      '<div class="msg-body">' +
      esc(message.content) +
      "</div>" +
      (message.status === "stopped" ? '<div class="msg-stopped">停止しました</div>' : "") +
      actions +
      "</div>"
    );
  }

  function memoHtml(task) {
    return (
      '<div class="memo-wrap">' +
      '<textarea id="memo-editor" class="memo-editor" data-task-id="' +
      task.id +
      '" placeholder="メモ（ユーザーとLLMが共有）">' +
      esc(task.memo) +
      "</textarea>" +
      '<p class="hint">自動保存。チャットの文脈に常に含まれます。</p>' +
      "</div>"
    );
  }

  function contextLine(task) {
    const browser = activeBrowserTab(task);
    return "文脈: メモ " + (task.memo ? "あり" : "空") + " / ブラウザ " + (browser ? browser.title : "なし");
  }

  function renderRight() {
    const pane = $("#pane-right");
    const task = selectedTask();
    if (!task) {
      pane.innerHTML = '<div class="pane-empty">タスクを選択してください。</div>';
      return;
    }
    pane.innerHTML = '<div class="right-body">' + browserHtml(task) + "</div>";
  }

  function browserHtml(task) {
    const active = activeBrowserTab(task);
    const tabs = task.browserTabs
      .map(
        (tab) =>
          '<button type="button" class="browser-tab ' +
          (tab.id === active.id ? "active" : "") +
          '" data-action="select-browser-tab" data-tab-id="' +
          tab.id +
          '">' +
          '<span class="browser-tab-title">' +
          esc(tab.title) +
          "</span>" +
          '<span class="browser-tab-close" data-action="close-browser-tab" data-tab-id="' +
          tab.id +
          '" title="閉じる">×</span>' +
          "</button>",
      )
      .join("");

    return (
      '<div class="browser">' +
      '<div class="browser-tabs">' +
      tabs +
      '<button type="button" class="browser-tab-new" data-action="new-browser-tab" title="新しいタブ">+</button>' +
      "</div>" +
      '<form class="browser-bar" id="browser-form">' +
      '<input id="browser-url" type="text" value="' +
      esc(active.url) +
      '" spellcheck="false" aria-label="URL" />' +
      '<button type="submit" class="button small">開く</button>' +
      "</form>" +
      '<div class="browser-page">' +
      mockPageHtml(active) +
      "</div></div>"
    );
  }

  function mockPageHtml(tab) {
    let host = "about:blank";
    try {
      host = new URL(tab.url).hostname;
    } catch (error) {
      host = "about:blank";
    }
    if (host === "about:blank" || host === "") {
      return '<div class="mock-page blank"><p>URL を入力して開いてください。</p></div>';
    }
    const github = host.indexOf("github.com") !== -1;
    const youtube = host.indexOf("youtube.com") !== -1;
    const kicker = github ? "ANKM0 / SIFTQ" : youtube ? "YouTube" : host;
    const note = github
      ? "GitHub のページ本文はプロトタイプでは表示しません。URL とタイトルを文脈として扱います。"
      : youtube
        ? "動画ページの本文はプロトタイプでは表示しません。URL とタイトルを文脈として扱います。"
        : "外部ページの本文はプロトタイプでは表示しません。URL とタイトルを文脈として扱います。";
    return (
      '<div class="mock-page ' +
      (github ? "github" : youtube ? "youtube" : "") +
      '">' +
      '<div class="mock-page-bar"><span>' +
      esc(host) +
      "</span><span>" +
      esc(tab.title) +
      "</span></div>" +
      '<div class="mock-page-body">' +
      '<p class="mock-kicker">' +
      esc(kicker) +
      "</p>" +
      "<h2>" +
      esc(tab.title) +
      "</h2><p>" +
      note +
      "</p>" +
      '<div class="mock-line"></div><div class="mock-line short"></div>' +
      "</div></div>"
    );
  }

  function renderBottom() {
    const session = state.usage.session;
    const week = state.usage.week;
    $("#bottombar").innerHTML =
      '<div class="usage">' +
      '<span class="usage-label">USAGE</span>' +
      '<span class="usage-item">Session <span class="bar"><i style="width:' +
      percent(session) +
      '%"></i></span> ' +
      percent(session) +
      "%</span>" +
      '<span class="usage-item">Week <span class="bar"><i style="width:' +
      percent(week) +
      '%"></i></span> ' +
      percent(week) +
      "%</span>" +
      "</div>";
  }

  function scrollChatToBottom() {
    const log = document.getElementById("chat-log");
    if (log) log.scrollTop = log.scrollHeight;
  }

  function toast(message) {
    const element = document.getElementById("toast");
    element.textContent = message;
    element.hidden = false;
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      element.hidden = true;
    }, 1800);
  }

  function selectTask(id) {
    const task = taskById(id);
    if (!task) return;
    state.selectedTaskId = id;
    if (task.unread) task.unread = false;
    save();
    render();
  }

  function toggleGroup(key) {
    if (!key) return;
    state.collapsed[key] = !state.collapsed[key];
    save();
    render();
  }

  function toggleWorking(id) {
    const task = taskById(id);
    if (!task) return;
    task.working = !task.working;
    task.updatedAt = new Date().toISOString();
    save();
    render();
  }

  function togglePin(id) {
    const task = taskById(id);
    if (!task || task.kind !== "tentative") return;
    task.pinned = !task.pinned;
    task.updatedAt = new Date().toISOString();
    save();
    render();
  }

  function moveToTask(id) {
    const task = taskById(id);
    if (!task || task.kind !== "tentative") return;
    const project = projectName(task);
    const order = frontOrder("task", project);
    task.kind = "task";
    task.status = "do";
    task.pinned = false;
    task.order = order;
    task.updatedAt = new Date().toISOString();
    ensureProject(project);
    save();
    render();
    toast("タスクに昇格しました");
  }

  function moveToTentative(id) {
    const task = taskById(id);
    if (!task || task.kind !== "task") return;
    const order = frontOrder("tentative");
    task.kind = "tentative";
    task.status = "do";
    task.working = false;
    task.pinned = false;
    task.order = order;
    task.updatedAt = new Date().toISOString();
    save();
    render();
    toast("仮タスクに戻しました");
  }

  function setCenterTab(tab) {
    const task = selectedTask();
    if (!task) return;
    task.ui.centerTab = tab;
    save();
    render();
  }

  function contextItem(action, label, id, active, data) {
    let extra = "";
    if (data) {
      for (const [key, value] of Object.entries(data)) {
        extra += " data-" + key + '="' + esc(value) + '"';
      }
    }
    return (
      '<button type="button" class="context-item ' +
      (active ? "active" : "") +
      '" data-action="' +
      action +
      '"' +
      extra +
      ' data-id="' +
      id +
      '">' +
      '<span class="context-check">' +
      (active ? "✓" : "") +
      "</span>" +
      esc(label) +
      "</button>"
    );
  }

  function showContextMenu(task, x, y) {
    const menu = document.getElementById("context-menu");
    const parts = [];
    if (task.kind === "tentative") {
      parts.push('<div class="context-label">仮タスク</div>');
      parts.push(contextItem("promote", "タスクに昇格", task.id, false, null));
      parts.push(contextItem("pin", task.pinned ? "固定を外す" : "固定する", task.id, false, null));
    } else {
      parts.push('<div class="context-label">ステータス</div>');
      for (const status of STATUS_FILTERS) {
        parts.push(contextItem("set-status", status, task.id, task.status === status, { status: status }));
      }
      parts.push('<div class="context-sep"></div>');
      parts.push(contextItem("toggle-working", task.working ? "workingを解除" : "workingにする", task.id, false, null));
      parts.push('<div class="context-sep"></div>');
      parts.push('<div class="context-label">グループに移動</div>');
      for (const project of projectList()) {
        parts.push(contextItem("move-project", project, task.id, projectName(task) === project, { project: project }));
      }
      parts.push(contextItem("move-project", "+ 新しいグループ", task.id, false, { project: "__new__" }));
      parts.push('<div class="context-sep"></div>');
      parts.push(contextItem("demote", "仮タスクに戻す", task.id, false, null));
    }
    menu.innerHTML = parts.join("");
    menu.hidden = false;
    const rect = menu.getBoundingClientRect();
    const left = Math.max(8, Math.min(x, window.innerWidth - rect.width - 8));
    const top = Math.max(8, Math.min(y, window.innerHeight - rect.height - 8));
    menu.style.left = left + "px";
    menu.style.top = top + "px";
  }

  function hideContextMenu() {
    const menu = document.getElementById("context-menu");
    if (!menu) return;
    menu.hidden = true;
    menu.innerHTML = "";
  }

  function setTaskStatus(id, status) {
    const task = taskById(id);
    if (!task || task.kind !== "task" || !STATUS_FILTERS.includes(status)) return;
    task.status = status;
    if (status === "done") task.working = false;
    task.updatedAt = new Date().toISOString();
    save();
    render();
    hideContextMenu();
    toast(status + " に変更しました");
  }

  function moveTaskToProject(id, project) {
    const task = taskById(id);
    if (!task || task.kind !== "task" || !project) return;
    const sourceProject = projectName(task);
    const order = frontOrder("task", project);
    task.project = project;
    task.order = order;
    task.updatedAt = new Date().toISOString();
    ensureProject(project);
    if (sourceProject !== project) normalizeGroup("task", sourceProject);
    save();
    render();
    hideContextMenu();
    toast(project + " に移動しました");
  }

  function pickProject() {
    const select = document.getElementById("task-project");
    if (!select) return "その他";
    if (select.value !== "__new__") return select.value || "その他";
    const name = window.prompt("新しいグループ名");
    if (!name || !name.trim()) return null;
    return name.trim();
  }

  function addTask(kind) {
    const input = document.getElementById("task-input");
    if (!input) return;
    const title = input.value.trim();
    if (!title) {
      input.focus();
      return;
    }
    const project = pickProject();
    if (project === null) {
      input.focus();
      return;
    }
    const task = makeTask({ kind: kind, title: title, project: project });
    state.tasks.push(task);
    ensureProject(project);
    state.selectedTaskId = task.id;
    state.statusFilter = "do";
    input.value = "";
    save();
    pendingFocus = "task-input";
    render();
    const select = document.getElementById("task-project");
    if (select) select.value = project;
    toast(kind === "tentative" ? "仮タスクを追加しました" : "タスクを追加しました");
  }

  function sendChat() {
    const task = selectedTask();
    const input = document.getElementById("chat-input");
    if (!task || !input) return;
    const text = input.value.trim();
    if (!text) return;
    if (stream) {
      toast("応答中です。停止してから送信してください。");
      return;
    }
    const conversation = currentConversation(task);
    conversation.messages.push({
      id: uid("msg"),
      role: "user",
      content: text,
      status: "done",
      createdAt: new Date().toISOString(),
    });
    const assistant = {
      id: uid("msg"),
      role: "assistant",
      content: "",
      status: "streaming",
      createdAt: new Date().toISOString(),
    };
    conversation.messages.push(assistant);
    task.updatedAt = new Date().toISOString();
    bumpUsage();
    save();
    pendingFocus = "chat-input";
    render();
    startStream(task.id, conversation.id, assistant.id, mockReply(text, task));
  }

  function mockReply(userText, task) {
    const browser = activeBrowserTab(task);
    const memo = task.memo ? "メモ（" + task.memo.length + "文字）" : "メモ（空）";
    const browserLine = browser ? "ブラウザ（" + browser.url + "）" : "ブラウザ（未選択）";

    if (/メモ/.test(userText)) {
      return (
        "メモを確認しました。\n\n" +
        (task.memo || "（メモはまだ空です）") +
        "\n\nこの内容をもとに、次の3点に整理できます。\n- 目的\n- 次の操作\n- 保留にしたこと"
      );
    }
    if (/ブラウザ|ページ|開いて/.test(userText)) {
      return (
        "現在のブラウザの状態を確認しました。\n\n- URL: " +
        (browser ? browser.url : "未選択") +
        "\n- タイトル: " +
        (browser ? browser.title : "未選択") +
        "\n\nこのページを前提に作業を進めます。プロトタイプではページ本文の取得はモックです。"
      );
    }
    if (/タスク/.test(userText)) {
      return (
        "タスクにできる形に整理しました。\n\n1. " +
        userText.slice(0, 40) +
        "\n2. 関連するブラウザのタブを確認する\n3. 完了条件を決める\n\n必要ならこの応答から「タスクにする」で起票できます。"
      );
    }
    return (
      "受け取りました。\n\n参照した文脈:\n- " +
      memo +
      "\n- " +
      browserLine +
      "\n\nプロトタイプのため応答は固定です。実装時はここにLLMの応答とツール実行ログが入ります。"
    );
  }

  function startStream(taskId, conversationId, messageId, fullText) {
    if (stream) stopStreaming(false);
    const started = Date.now();
    stream = { taskId: taskId, conversationId: conversationId, messageId: messageId, fullText: fullText, index: 0, started: started, timer: null };
    const timer = setInterval(() => {
      if (!stream || stream.messageId !== messageId) {
        clearInterval(timer);
        return;
      }
      const message = findMessage(taskId, conversationId, messageId);
      if (!message) {
        clearInterval(timer);
        stream = null;
        return;
      }
      stream.index = Math.min(fullText.length, stream.index + 3);
      message.content = fullText.slice(0, stream.index);
      const body = document.querySelector('[data-message-id="' + messageId + '"] .msg-body');
      if (body) body.textContent = message.content;
      const elapsed = document.querySelector("[data-working-elapsed]");
      if (elapsed) {
        elapsed.textContent = Math.max(1, Math.round((Date.now() - started) / 1000)) + "s";
      }
      const log = document.getElementById("chat-log");
      if (log) log.scrollTop = log.scrollHeight;
      if (stream.index >= fullText.length) {
        message.status = "done";
        clearInterval(timer);
        stream = null;
        save();
        render();
      }
    }, 45);
    if (stream) stream.timer = timer;
  }

  function stopStreaming(shouldRender) {
    if (!stream) return;
    clearInterval(stream.timer);
    const message = findMessage(stream.taskId, stream.conversationId, stream.messageId);
    if (message) message.status = "stopped";
    stream = null;
    save();
    if (shouldRender !== false) render();
  }

  function copyMessage(messageId) {
    const task = selectedTask();
    if (!task) return;
    const conversation = currentConversation(task);
    const message = conversation.messages.find((item) => item.id === messageId);
    if (!message) return;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(message.content).then(
        () => toast("コピーしました"),
        () => fallbackCopy(message.content),
      );
    } else {
      fallbackCopy(message.content);
    }
  }

  function fallbackCopy(text) {
    const area = document.createElement("textarea");
    area.value = text;
    document.body.appendChild(area);
    area.select();
    try {
      document.execCommand("copy");
      toast("コピーしました");
    } catch (error) {
      toast("コピーできませんでした");
    }
    area.remove();
  }

  function taskFromMessage(messageId) {
    const task = selectedTask();
    if (!task) return;
    const conversation = currentConversation(task);
    const message = conversation.messages.find((item) => item.id === messageId);
    if (!message) return;
    const firstLine = message.content.split("\n").find((line) => line.trim()) || "チャットから起票";
    const created = makeTask({
      kind: "task",
      title: firstLine.trim().slice(0, 80),
      project: projectName(task),
    });
    state.tasks.push(created);
    state.selectedTaskId = created.id;
    state.statusFilter = "do";
    save();
    render();
    toast("タスクを作成しました");
  }

  function selectBrowserTab(tabId) {
    const task = selectedTask();
    if (!task) return;
    for (const tab of task.browserTabs) tab.active = tab.id === tabId;
    save();
    render();
  }

  function closeBrowserTab(tabId) {
    const task = selectedTask();
    if (!task) return;
    const index = task.browserTabs.findIndex((tab) => tab.id === tabId);
    if (index === -1) return;
    const wasActive = task.browserTabs[index].active;
    task.browserTabs.splice(index, 1);
    if (!task.browserTabs.length) {
      task.browserTabs.push({ id: uid("tab"), url: "about:blank", title: "新しいタブ", active: true });
    } else if (wasActive) {
      const next = task.browserTabs[Math.max(0, index - 1)];
      for (const tab of task.browserTabs) tab.active = tab === next;
    }
    save();
    render();
  }

  function newBrowserTab() {
    const task = selectedTask();
    if (!task) return;
    for (const tab of task.browserTabs) tab.active = false;
    task.browserTabs.push({ id: uid("tab"), url: "about:blank", title: "新しいタブ", active: true });
    save();
    pendingFocus = "browser-url";
    render();
  }

  function navigateBrowser() {
    const task = selectedTask();
    if (!task) return;
    const input = document.getElementById("browser-url");
    if (!input) return;
    const raw = input.value.trim();
    if (!raw) return;
    const url = normalizeUrl(raw);
    const tab = activeBrowserTab(task);
    if (!tab) return;
    tab.url = url;
    tab.title = titleForUrl(url);
    task.updatedAt = new Date().toISOString();
    save();
    render();
  }

  function normalizeUrl(raw) {
    if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(raw)) return raw;
    return "https://" + raw;
  }

  function titleForUrl(url) {
    try {
      const parsed = new URL(url);
      return parsed.hostname.replace(/^www\./, "") || url;
    } catch (error) {
      return url;
    }
  }

  function bumpUsage() {
    state.usage.session.used = Math.min(state.usage.session.limit, state.usage.session.used + 0.02);
    state.usage.week.used = Math.min(state.usage.week.limit, state.usage.week.used + 0.05);
  }

  function applyWidths() {
    const panes = $("#panes");
    panes.style.setProperty("--left", state.paneWidths.left + "px");
    panes.style.setProperty("--right", state.paneWidths.right + "px");
  }

  function setupSplitters() {
    const panes = $("#panes");
    for (const splitter of document.querySelectorAll(".splitter")) {
      splitter.addEventListener("pointerdown", (event) => {
        event.preventDefault();
        const side = splitter.dataset.side;
        const startX = event.clientX;
        const startWidth = side === "left" ? state.paneWidths.left : state.paneWidths.right;
        const total = panes.clientWidth;
        document.body.classList.add("resizing");

        const move = (moveEvent) => {
          const delta = moveEvent.clientX - startX;
          const other = side === "left" ? state.paneWidths.right : state.paneWidths.left;
          const min = side === "left" ? 200 : 240;
          const max = Math.max(min, total - other - 300 - 8);
          let next = side === "left" ? startWidth + delta : startWidth - delta;
          next = Math.min(max, Math.max(min, next));
          if (side === "left") state.paneWidths.left = next;
          else state.paneWidths.right = next;
          applyWidths();
        };

        const up = () => {
          document.removeEventListener("pointermove", move);
          document.removeEventListener("pointerup", up);
          document.body.classList.remove("resizing");
          save();
        };

        document.addEventListener("pointermove", move);
        document.addEventListener("pointerup", up);
      });
    }
  }

  let dragState = null;

  function groupHeaderElement(name) {
    return (
      Array.from(document.querySelectorAll(".group-header[data-group]")).find(
        (element) => element.dataset.group === name,
      ) || null
    );
  }

  function clearDropIndicators() {
    for (const element of document.querySelectorAll(".drop-before, .drop-after, .drop-into")) {
      element.classList.remove("drop-before", "drop-after", "drop-into");
    }
  }

  function clearDragState() {
    dragState = null;
    clearDropIndicators();
    for (const element of document.querySelectorAll(".dragging")) {
      element.classList.remove("dragging");
    }
  }

  function dropTaskOnTask(draggedId, targetId, targetElement, event) {
    const dragged = taskById(draggedId);
    const target = taskById(targetId);
    if (!dragged || !target || dragged.id === target.id) return;
    if (dragged.kind !== target.kind) return;

    const targetGroup = target.kind === "tentative" ? "__tentative__" : projectName(target);
    const sourceGroup = dragged.kind === "tentative" ? "__tentative__" : projectName(dragged);
    const targetItems = groupTasks(target.kind, targetGroup).filter((task) => task.id !== dragged.id);
    const targetIndex = targetItems.findIndex((task) => task.id === target.id);
    if (targetIndex === -1) return;

    const rect = targetElement.getBoundingClientRect();
    const insertIndex = targetIndex + (event.clientY > rect.top + rect.height / 2 ? 1 : 0);
    if (dragged.kind === "task") dragged.project = projectName(target);
    targetItems.splice(insertIndex, 0, dragged);
    applyGroupOrder(targetItems);
    if (sourceGroup !== targetGroup) normalizeGroup(dragged.kind, sourceGroup);
    dragged.updatedAt = new Date().toISOString();
    save();
    render();
  }

  function dropTaskOnGroup(draggedId, header) {
    const dragged = taskById(draggedId);
    if (!dragged) return;
    const isTentative = header.dataset.tentative === "true";
    if (dragged.kind === "tentative" && !isTentative) return;
    if (dragged.kind === "task" && isTentative) return;

    if (isTentative) {
      const items = groupTasks("tentative", "").filter((task) => task.id !== dragged.id);
      items.push(dragged);
      applyGroupOrder(items);
    } else {
      const project = header.dataset.group;
      if (!project) return;
      const sourceGroup = projectName(dragged);
      const items = groupTasks("task", project).filter((task) => task.id !== dragged.id);
      dragged.project = project;
      items.push(dragged);
      applyGroupOrder(items);
      ensureProject(project);
      if (sourceGroup !== project) normalizeGroup("task", sourceGroup);
    }
    dragged.updatedAt = new Date().toISOString();
    save();
    render();
  }

  function dropGroupOnGroup(draggedName, targetName, event) {
    if (draggedName === targetName) return;
    const header = groupHeaderElement(targetName);
    if (!header) return;
    const names = projectList().filter((name) => name !== draggedName);
    const targetIndex = names.indexOf(targetName);
    if (targetIndex === -1) return;
    const rect = header.getBoundingClientRect();
    const insertIndex = targetIndex + (event.clientY > rect.top + rect.height / 2 ? 1 : 0);
    names.splice(insertIndex, 0, draggedName);
    state.projectOrder = names;
    save();
    render();
  }

  document.addEventListener("dragstart", (event) => {
    const item = event.target.closest(".task-item");
    if (item) {
      dragState = { type: "task", id: item.dataset.id };
      item.classList.add("dragging");
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", "task:" + item.dataset.id);
      return;
    }
    const header = event.target.closest('.group-header[draggable="true"]');
    if (header && header.dataset.group) {
      dragState = { type: "group", name: header.dataset.group };
      header.classList.add("dragging");
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", "group:" + header.dataset.group);
    }
  });

  document.addEventListener("dragover", (event) => {
    if (!dragState) return;
    clearDropIndicators();
    const item = event.target.closest(".task-item");
    const header = event.target.closest(".group-header");

    if (dragState.type === "task") {
      if (item && item.dataset.id !== dragState.id) {
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
        const rect = item.getBoundingClientRect();
        item.classList.add(event.clientY > rect.top + rect.height / 2 ? "drop-after" : "drop-before");
        return;
      }
      if (header) {
        const isTentative = header.dataset.tentative === "true";
        const dragged = taskById(dragState.id);
        if (!dragged) return;
        if (dragged.kind === "tentative" && isTentative) {
          event.preventDefault();
          event.dataTransfer.dropEffect = "move";
          header.classList.add("drop-into");
        } else if (dragged.kind === "task" && header.dataset.group) {
          event.preventDefault();
          event.dataTransfer.dropEffect = "move";
          header.classList.add("drop-into");
        }
      }
      return;
    }

    if (dragState.type === "group" && header && header.dataset.group) {
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
      const rect = header.getBoundingClientRect();
      header.classList.add(event.clientY > rect.top + rect.height / 2 ? "drop-after" : "drop-before");
    }
  });

  document.addEventListener("drop", (event) => {
    if (!dragState) return;
    const item = event.target.closest(".task-item");
    const header = event.target.closest(".group-header");
    if (dragState.type === "task") {
      if (item && item.dataset.id !== dragState.id) {
        event.preventDefault();
        dropTaskOnTask(dragState.id, item.dataset.id, item, event);
      } else if (header) {
        event.preventDefault();
        dropTaskOnGroup(dragState.id, header);
      }
    } else if (dragState.type === "group" && header && header.dataset.group) {
      event.preventDefault();
      dropGroupOnGroup(dragState.name, header.dataset.group, event);
    }
    clearDragState();
  });

  document.addEventListener("dragend", clearDragState);

  document.addEventListener("click", (event) => {
    if (event.target.closest(".check")) return;
    const target = event.target.closest("[data-action]");
    if (!target) return;
    const action = target.dataset.action;
    const id = target.dataset.id;

    switch (action) {
      case "select-task":
        selectTask(id);
        break;
      case "toggle-group":
        toggleGroup(target.dataset.key);
        break;
      case "pin":
        togglePin(id);
        break;
      case "promote":
        moveToTask(id);
        break;
      case "demote":
        moveToTentative(id);
        break;
      case "status-filter":
        state.statusFilter = target.dataset.status;
        save();
        render();
        break;
      case "center-tab":
        setCenterTab(target.dataset.tab);
        break;
      case "set-status":
        setTaskStatus(id, target.dataset.status);
        break;
      case "move-project": {
        let project = target.dataset.project;
        if (project === "__new__") {
          const name = window.prompt("新しいグループ名");
          if (!name || !name.trim()) {
            hideContextMenu();
            return;
          }
          project = name.trim();
        }
        moveTaskToProject(id, project);
        break;
      }
      case "toggle-working":
        toggleWorking(id);
        break;
      case "stop-chat":
        stopStreaming();
        break;
      case "copy-message":
        copyMessage(target.dataset.messageId);
        break;
      case "task-from-message":
        taskFromMessage(target.dataset.messageId);
        break;
      case "select-browser-tab":
        selectBrowserTab(target.dataset.tabId);
        break;
      case "close-browser-tab":
        closeBrowserTab(target.dataset.tabId);
        break;
      case "new-browser-tab":
        newBrowserTab();
        break;
      case "add-tentative":
        addTask("tentative");
        break;
      default:
        break;
    }
    hideContextMenu();
  });

  document.addEventListener("contextmenu", (event) => {
    const item = event.target.closest(".task-item");
    if (!item) return;
    const task = taskById(item.dataset.id);
    if (!task) return;
    event.preventDefault();
    if (state.selectedTaskId !== task.id) {
      state.selectedTaskId = task.id;
      if (task.unread) task.unread = false;
      save();
      render();
    }
    showContextMenu(task, event.clientX, event.clientY);
  });

  document.addEventListener("pointerdown", (event) => {
    const menu = document.getElementById("context-menu");
    if (!menu || menu.hidden) return;
    if (!menu.contains(event.target)) hideContextMenu();
  });

  window.addEventListener("resize", hideContextMenu);
  document.addEventListener("scroll", hideContextMenu, true);

  document.addEventListener("submit", (event) => {
    const form = event.target;
    if (form.id === "task-form") {
      event.preventDefault();
      addTask("task");
    } else if (form.id === "chat-form") {
      event.preventDefault();
      sendChat();
    } else if (form.id === "browser-form") {
      event.preventDefault();
      navigateBrowser();
    }
  });

  document.addEventListener("input", (event) => {
    if (event.target.id !== "memo-editor") return;
    const task = selectedTask();
    if (!task) return;
    task.memo = event.target.value;
    task.updatedAt = new Date().toISOString();
    save();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      hideContextMenu();
      return;
    }
    if (event.target.id === "chat-input" && (event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault();
      const form = document.getElementById("chat-form");
      if (form) form.requestSubmit();
    }
  });

  ensureState();
  save();
  applyWidths();
  setupSplitters();
  render();
})();

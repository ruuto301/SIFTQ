(function () {
  "use strict";

  const STATUS_FILTERS = ["do", "done", "skip"];
  const SOURCE_LABELS = {
    manual: "手動",
    github: "GitHub",
    email: "メール",
    slack: "Slack",
    discord: "Discord",
  };

  let state = null;
  let dshStatuses = new Map();
  let sshHosts = [];
  let sandboxError = null;
  let pendingFocus = null;
  let toastTimer = null;
  let saveTimer = null;
  let settingsDraft = null;
  let currentPermission = null;
  const workingConversations = new Set();
  const workingStartedAt = new Map();
  const preparedConversations = new Set();

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

  async function loadState() {
    const response = await fetch("/api/state");
    if (!response.ok) throw new Error("状態の読み込みに失敗しました");
    const payload = await response.json();
    state = payload.state;
    dshStatuses = new Map(
      (Array.isArray(payload.dsh) ? payload.dsh : []).map((entry) => [entry.target, entry.status]),
    );
    ensureState();
    updateDshStatus();
  }

  function save() {
    if (saveTimer !== null) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      saveTimer = null;
      void persistState();
    }, 120);
  }

  async function persistState(applyServerState = false) {
    if (state === null) return false;
    try {
      const response = await fetch("/api/state", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(state),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error ?? "保存に失敗しました");
      }
      const payload = await response.json().catch(() => null);
      if (payload && Array.isArray(payload.dsh)) {
        dshStatuses = new Map(payload.dsh.map((entry) => [entry.target, entry.status]));
      }
      if (applyServerState && payload && payload.state) {
        state = payload.state;
        ensureState();
      }
      showSettingsError("");
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      toast(message);
      showSettingsError(message);
      return false;
    }
  }

  function ensureState() {
    if (state === null || !Array.isArray(state.tasks)) {
      state = {
        version: 1,
        statusFilter: "do",
        selectedTaskId: null,
        paneWidths: { left: 300, right: 400 },
        collapsed: {},
        tasks: [],
        groups: [],
        projectOrder: [],
      };
    }
    if (!state.paneWidths) state.paneWidths = { left: 300, right: 400 };
    if (!STATUS_FILTERS.includes(state.statusFilter)) state.statusFilter = "do";
    if (!Array.isArray(state.projectOrder)) state.projectOrder = [];
    if (!Array.isArray(state.groups)) state.groups = [];
    if (!state.collapsed || typeof state.collapsed !== "object") state.collapsed = {};
    ensureProject("その他");
    for (const name of state.projectOrder) ensureProject(name);
    for (const task of state.tasks) {
      if (!task.ui) task.ui = {};
      if (!task.ui.centerTab) task.ui.centerTab = "chat";
      if (typeof task.project !== "string" || !task.project) task.project = "その他";
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
        if (typeof conversation.dshSessionId !== "string") conversation.dshSessionId = null;
        if (conversation.permissionMode !== "ask" && conversation.permissionMode !== "allow_all") {
          conversation.permissionMode = "ask";
        }
        if (!Array.isArray(conversation.configOptions)) conversation.configOptions = [];
        if (!Array.isArray(conversation.messages)) conversation.messages = [];
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
    if (!Array.isArray(state.groups)) state.groups = [];
    if (!Array.isArray(state.projectOrder)) state.projectOrder = [];
    if (!state.groups.some((group) => group.name === name)) {
      const otherGroupIndex = state.groups.findIndex((group) => group.name === "その他");
      const group = { name: name, target: "" };
      if (otherGroupIndex === -1) state.groups.push(group);
      else state.groups.splice(otherGroupIndex, 0, group);
    }
    if (!state.projectOrder.includes(name)) {
      const otherIndex = state.projectOrder.indexOf("その他");
      if (otherIndex === -1) state.projectOrder.push(name);
      else state.projectOrder.splice(otherIndex, 0, name);
    }
  }

  function projectList() {
    if (state === null) return [];
    const names = new Set(state.groups.map((group) => group.name));
    for (const task of state.tasks) names.add(projectName(task));
    names.add("その他");
    const ordered = state.projectOrder.filter((name) => names.has(name));
    const missing = Array.from(names).filter((name) => !ordered.includes(name));
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

  function configSelectsHtml(conversation) {
    if (!Array.isArray(conversation.configOptions) || conversation.configOptions.length === 0) {
      const target = conversation.dshTarget || selectedTarget();
      const status = dshStatusFor(target);
      if (status.state === "starting") {
        return '<span class="config-empty">モデル: 接続中…</span>';
      }
      const detail =
        conversation.prepareError ||
        (status.state === "error" && typeof status.error === "string" ? status.error : "");
      const firstLine = String(detail).split("\n")[0].trim();
      const suffix = firstLine === "" ? "" : "（" + firstLine.slice(0, 120) + "）";
      return '<span class="config-empty">モデル: 未接続' + esc(suffix) + "</span>";
    }
    return conversation.configOptions
      .map(
        (option) =>
          '<select class="config-select" data-action="config" data-conversation-id="' +
          conversation.id +
          '" data-config-id="' +
          esc(option.id) +
          '" aria-label="' +
          esc(option.name) +
          '">' +
          option.values
            .map(
              (value) =>
                '<option value="' +
                esc(value.value) +
                '"' +
                (value.value === option.current ? " selected" : "") +
                ">" +
                esc(value.name) +
                "</option>",
            )
            .join("") +
          "</select>",
      )
      .join("");
  }

  function chatHtml(task, conversation) {
    const messages =
      conversation.messages.map(messageHtml).join("") ||
      '<div class="chat-empty">まだメッセージはありません。</div>';

    const streaming =
      workingConversations.has(conversation.id) ||
      conversation.messages.some((message) => message.status === "streaming");
    const working = streaming
      ? '<div class="working-line"><span class="dot"></span>Working <span data-working-elapsed>0s</span></div>'
      : "";
    const stop = streaming
      ? '<button type="button" class="button small danger" data-action="stop-chat" data-conversation-id="' +
        conversation.id +
        '">停止</button>'
      : "";
    const permission =
      '<select class="permission-select" data-action="permission" data-conversation-id="' +
      conversation.id +
      '" aria-label="権限">' +
      '<option value="ask"' +
      (conversation.permissionMode !== "allow_all" ? " selected" : "") +
      ">確認する</option>" +
      '<option value="allow_all"' +
      (conversation.permissionMode === "allow_all" ? " selected" : "") +
      ">すべて許可</option>" +
      "</select>";

    return (
      '<div class="chat-log" id="chat-log" data-conversation-id="' +
      conversation.id +
      '">' +
      messages +
      "</div>" +
      working +
      '<form class="chat-composer" id="chat-form" data-conversation-id="' +
      conversation.id +
      '">' +
      '<textarea id="chat-input" rows="3" placeholder="メッセージ（Enterで改行・Ctrl/Cmd+Enterで送信）"></textarea>' +
      '<div class="composer-bar">' +
      configSelectsHtml(conversation) +
      permission +
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
    updateDshStatus();
    prepareSelectedConversation();
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
    if (tab === "chat") prepareSelectedConversation();
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
    prepareSelectedConversation();
    toast(kind === "tentative" ? "仮タスクを追加しました" : "タスクを追加しました");
  }

  async function prepareConversation(conversationId) {
    try {
      const response = await fetch("/api/conversations/" + encodeURIComponent(conversationId) + "/prepare", {
        method: "POST",
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        const message = payload.error ?? "DSH に接続できません";
        toast(message);
        const found = findConversationById(conversationId);
        if (found) {
          found.conversation.prepareError = message;
          renderCenter();
        }
        return;
      }
      const payload = await response.json();
      if (!Array.isArray(payload.configOptions)) return;
      const task = selectedTask();
      if (!task) return;
      const conversation = task.conversations.find((item) => item.id === conversationId);
      if (!conversation) return;
      conversation.configOptions = payload.configOptions;
      conversation.dshTarget = selectedTarget();
      delete conversation.prepareError;
      preparedConversations.add(conversationId + ":" + selectedTarget());
      renderCenter();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      toast(message);
      const found = findConversationById(conversationId);
      if (found) {
        found.conversation.prepareError = message;
        renderCenter();
      }
    }
  }

  function sendChat() {
    const task = selectedTask();
    const input = document.getElementById("chat-input");
    if (!task || !input) return;
    const text = input.value.trim();
    if (!text) return;
    const conversation = currentConversation(task);
    if (workingConversations.has(conversation.id)) {
      toast("応答中です。停止してから送信してください。");
      return;
    }
    workingConversations.add(conversation.id);
    input.value = "";
    pendingFocus = "chat-input";
    renderCenter();
    void fetch("/api/conversations/" + encodeURIComponent(conversation.id) + "/prompt", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: text }),
    })
      .then(async (response) => {
        if (response.ok) return;
        const payload = await response.json().catch(() => ({}));
        workingConversations.delete(conversation.id);
        toast(payload.error ?? "送信に失敗しました");
        renderCenter();
      })
      .catch((error) => {
        workingConversations.delete(conversation.id);
        toast(error instanceof Error ? error.message : String(error));
        renderCenter();
      });
  }

  async function stopChat(conversationId) {
    workingConversations.delete(conversationId);
    renderCenter();
    await fetch("/api/conversations/" + encodeURIComponent(conversationId) + "/cancel", {
      method: "POST",
    }).catch(() => undefined);
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
    prepareSelectedConversation();
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

  function selectedTarget() {
    const task = selectedTask();
    if (!task) return "";
    const group = state.groups.find((item) => item.name === task.project);
    return group ? group.target.trim() : "";
  }

  function dshStatusFor(target) {
    return dshStatuses.get(target) ?? { state: "stopped", profile: "acp", target: target };
  }

  function targetOptionsHtml(current) {
    const localStatus = dshStatusFor("");
    const localLabel = localStatus.state === "error" ? "ローカル（dsh 未導入）" : "ローカル";
    const options = [{ value: "", label: localLabel }];
    for (const host of sshHosts) options.push({ value: host, label: host });
    if (current !== "" && !options.some((option) => option.value === current)) {
      options.push({ value: current, label: current });
    }
    options.push({ value: "__custom__", label: "カスタム SSH..." });
    return options
      .map(
        (option) =>
          '<option value="' +
          esc(option.value) +
          '"' +
          (option.value === current ? " selected" : "") +
          ">" +
          esc(option.label) +
          "</option>",
      )
      .join("");
  }

  function dshStatusLabel(status) {
    const labels = {
      starting: "起動中",
      ready: "接続済み",
      error: "エラー",
      mock: "モック",
      stopped: "未接続",
    };
    return labels[status.state] ?? status.state;
  }

  function updateDshStatus() {
    const chip = $("#dsh-status");
    if (!chip) return;
    const status = dshStatusFor(selectedTarget());
    chip.textContent = "DSH: " + dshStatusLabel(status);
    chip.className = "dsh-status " + status.state;
  }

  function showSettingsError(message) {
    const element = $("#settings-error");
    if (!element) return;
    element.textContent = message;
  }

  function openSettings() {
    const byName = new Map(state.groups.map((group) => [group.name, group]));
    const ordered = state.projectOrder
      .map((name) => byName.get(name))
      .filter((group) => group !== undefined)
      .map((group) => ({ ...group }));
    for (const group of state.groups) {
      if (!ordered.some((item) => item.name === group.name)) ordered.push({ ...group });
    }
    settingsDraft = ordered;
    const modal = $("#settings-modal");
    if (modal) modal.hidden = false;
    renderSettings();
    void loadSshHosts();
  }

  async function loadSshHosts() {
    const hosts = new Set();
    let error = null;
    try {
      const response = await fetch("/api/sandboxes");
      if (response.ok) {
        const data = await response.json();
        if (data && Array.isArray(data.hosts)) {
          for (const host of data.hosts) {
            if (typeof host === "string" && host !== "") hosts.add(host);
          }
        }
        if (data && typeof data.error === "string" && data.error !== "") error = data.error;
      }
    } catch {
      // Sandbox一覧が読めない場合はSSH設定へフォールバックする。
    }
    try {
      const response = await fetch("/api/ssh-hosts");
      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data)) {
          for (const host of data) {
            if (typeof host === "string" && host !== "") hosts.add(host);
          }
        }
      }
    } catch {
      // SSH設定が読めない場合はカスタム入力だけを使う。
    }
    sshHosts = Array.from(hosts).sort((left, right) => left.localeCompare(right));
    sandboxError = error;
    const modal = $("#settings-modal");
    if (modal && !modal.hidden) renderSettings();
  }

  function closeSettings() {
    const modal = $("#settings-modal");
    if (modal) modal.hidden = true;
    settingsDraft = null;
  }

  function renderSettings() {
    const body = $("#settings-body");
    if (!body) return;
    const groups = settingsDraft ?? state.groups;
    const rows = groups
      .map((group, index) => {
        const fixed = group.name === "その他";
        const status = dshStatusFor(group.target.trim());
        return (
          "<tr>" +
          '<td><input class="settings-group-name" data-index="' +
          index +
          '" value="' +
          esc(group.name) +
          '"' +
          (fixed ? " readonly" : "") +
          "></td>" +
          '<td><select class="settings-group-target" data-index="' +
          index +
          '">' +
          targetOptionsHtml(group.target.trim()) +
          "</select></td>" +
          '<td class="settings-dsh-state" title="' +
          esc(status.error ?? "") +
          '">' +
          esc(dshStatusLabel(status)) +
          (group.target.trim() !== "" && status.state !== "ready" && status.state !== "mock"
            ? ' <button type="button" class="mini" data-action="retry-dsh" data-target="' +
              esc(group.target.trim()) +
              '">接続</button>'
            : "") +
          "</td>" +
          '<td><button type="button" class="button small ghost" data-action="delete-group-row" data-index="' +
          index +
          '"' +
          (fixed ? " disabled" : "") +
          ">削除</button></td>" +
          "</tr>"
        );
      })
      .join("");
    const defaultStatus = dshStatusFor("");
    const dshLine =
      "既定: " +
      dshStatusLabel(defaultStatus) +
      " / プロファイル: " +
      defaultStatus.profile +
      (defaultStatus.error ? "\n" + defaultStatus.error : "");
    body.innerHTML =
      '<section class="settings-section">' +
      "<h3>グループ</h3>" +
      '<table class="settings-groups"><thead><tr><th>名前</th><th>接続先</th><th>DSH</th><th></th></tr></thead><tbody>' +
      rows +
      "</tbody></table>" +
      '<div class="settings-actions" style="padding-top:8px;border-top:none;justify-content:flex-start">' +
      '<button type="button" class="button small" data-action="add-group-row">グループを追加</button>' +
      "</div>" +
      '<p class="hint">接続先はローカルまたはSSHホスト名です。ローカルにはホストの dsh、SSH 先には sandbox 内の dsh が必要です。Docker Sandboxes の sandbox と ~/.ssh/config の Host から選べます。カスタムでホスト名を入力できます。</p>' +
      (sandboxError ? '<p class="hint">sbx: ' + esc(sandboxError) + "</p>" : "") +
      '<p class="hint">データは poc/data に保存されます。ブラウザをリロードしても残ります。</p>' +
      "</section>" +
      '<section class="settings-section">' +
      "<h3>DSH</h3>" +
      '<p class="settings-dsh">' +
      esc(dshLine) +
      "</p>" +
      '<button type="button" class="button small" data-action="retry-dsh">再接続</button>' +
      "</section>" +
      '<p class="settings-error" id="settings-error"></p>' +
      '<div class="settings-actions">' +
      '<button type="button" class="button small ghost" data-action="close-settings">キャンセル</button>' +
      '<button type="button" class="button small primary" data-action="save-settings">保存</button>' +
      "</div>";
  }

  function addGroupRow() {
    if (settingsDraft === null) return;
    settingsDraft.push({ name: "", target: "" });
    renderSettings();
  }

  function deleteGroupRow(index) {
    if (settingsDraft === null || !Number.isInteger(index)) return;
    const group = settingsDraft[index];
    if (!group || group.name === "その他") return;
    settingsDraft.splice(index, 1);
    renderSettings();
  }

  async function saveSettings() {
    if (settingsDraft === null) return;
    const nameInputs = Array.from(document.querySelectorAll(".settings-group-name"));
    const targetInputs = Array.from(document.querySelectorAll(".settings-group-target"));
    const names = new Set();
    const nextGroups = [];
    const renamed = new Map();
    for (const input of nameInputs) {
      const index = Number(input.dataset.index);
      const name = input.value.trim();
      const targetInput = targetInputs.find((item) => Number(item.dataset.index) === index);
      let target = targetInput ? targetInput.value.trim() : "";
      if (target === "__custom__") {
        const custom = window.prompt("接続先 (例: yoriwake.sbx)");
        target = (custom?.trim() ?? "").replace(/^ssh:/, "");
      }
      if (name === "") {
        showSettingsError("グループ名を入力してください");
        return;
      }
      if (names.has(name)) {
        showSettingsError("グループ名が重複しています: " + name);
        return;
      }
      names.add(name);
      const old = settingsDraft[index];
      if (old && old.name !== name) renamed.set(old.name, name);
      nextGroups.push({ name: name, target: target });
    }
    if (!names.has("その他")) {
      showSettingsError("その他グループは削除できません");
      return;
    }
    const oldNames = new Set(state.groups.map((group) => group.name));
    const deleted = Array.from(oldNames).filter((name) => !names.has(name));
    const tasksToMove = state.tasks.filter((task) => deleted.includes(task.project));
    if (tasksToMove.length > 0) {
      const ok = window.confirm("削除するグループのタスクを「その他」へ移動します。よろしいですか？");
      if (!ok) return;
    }
    for (const task of state.tasks) {
      if (renamed.has(task.project)) task.project = renamed.get(task.project);
      if (deleted.includes(task.project)) task.project = "その他";
    }
    state.groups = nextGroups;
    state.projectOrder = nextGroups.map((group) => group.name);
    for (const key of Object.keys(state.collapsed)) {
      if (!key.startsWith("project:")) continue;
      const oldName = key.slice("project:".length);
      const nextName = renamed.get(oldName);
      if (nextName !== undefined) {
        state.collapsed["project:" + nextName] = state.collapsed[key];
        delete state.collapsed[key];
      }
    }
    const saved = await persistState(true);
    if (!saved) return;
    closeSettings();
    render();
    preparedConversations.clear();
    prepareSelectedConversation();
    toast("設定を保存しました");
  }

  async function retryDsh(target) {
    try {
      const response = await fetch("/api/dsh/retry", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(target ? { target: target } : {}),
      });
      if (!response.ok) throw new Error("再接続に失敗しました");
      const entries = await response.json();
      if (Array.isArray(entries)) {
        dshStatuses = new Map(entries.map((entry) => [entry.target, entry.status]));
      }
      updateDshStatus();
      renderSettings();
    } catch (error) {
      showSettingsError(error instanceof Error ? error.message : String(error));
    }
  }

  function showPermission(event) {
    currentPermission = event;
    const body = $("#permission-body");
    if (!body) return;
    body.innerHTML =
      '<p class="permission-summary">' +
      esc(event.title) +
      "</p>" +
      '<div class="permission-options">' +
      event.options
        .map(
          (option) =>
            '<button type="button" class="button small" data-action="permission-choice" data-option-id="' +
            esc(option.id) +
            '">' +
            esc(option.name) +
            "</button>",
        )
        .join("") +
      "</div>" +
      '<div class="settings-actions"><button type="button" class="button small ghost" data-action="permission-cancel">拒否</button></div>';
    const modal = $("#permission-modal");
    if (modal) modal.hidden = false;
  }

  async function respondPermission(optionId) {
    if (currentPermission === null) return;
    const requestId = currentPermission.requestId;
    const modal = $("#permission-modal");
    if (modal) modal.hidden = true;
    currentPermission = null;
    try {
      await fetch("/api/permissions/" + encodeURIComponent(requestId), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(optionId === null ? { cancelled: true } : { optionId: optionId }),
      });
    } catch (error) {
      toast(error instanceof Error ? error.message : String(error));
    }
  }

  function findConversationById(conversationId) {
    for (const task of state.tasks) {
      const conversation = task.conversations.find((item) => item.id === conversationId);
      if (conversation !== undefined) return { task, conversation };
    }
    return null;
  }

  function applyEvent(event) {
    if (!event || typeof event.type !== "string") return;
    if (event.type === "dsh") {
      dshStatuses.set(event.target, event.status);
      updateDshStatus();
      const modal = $("#settings-modal");
      if (modal && !modal.hidden) renderSettings();
      if (
        (event.status.state === "ready" || event.status.state === "mock") &&
        event.target === selectedTarget()
      ) {
        prepareSelectedConversation();
      }
      return;
    }
    if (event.type === "permission") {
      showPermission(event);
      return;
    }
    if (event.type === "error") {
      if (event.conversationId) {
        workingConversations.delete(event.conversationId);
        workingStartedAt.delete(event.conversationId);
      }
      toast(event.message);
      renderCenter();
      return;
    }
    const found = findConversationById(event.conversationId);
    if (found === null) return;
    const { task, conversation } = found;
    if (event.type === "message") {
      const index = conversation.messages.findIndex((message) => message.id === event.message.id);
      if (index === -1) conversation.messages.push(event.message);
      else conversation.messages[index] = event.message;
      task.updatedAt = new Date().toISOString();
    } else if (event.type === "chunk") {
      let message = conversation.messages.find((item) => item.id === event.messageId);
      if (!message) {
        message = {
          id: event.messageId,
          role: "assistant",
          content: event.content,
          status: event.status,
          createdAt: new Date().toISOString(),
        };
        conversation.messages.push(message);
      } else {
        message.content = event.content;
        message.status = event.status;
      }
      const body = document.querySelector('[data-message-id="' + event.messageId + '"] .msg-body');
      if (body) {
        body.textContent = event.content;
        scrollChatToBottom();
        return;
      }
    } else if (event.type === "status") {
      if (event.working) {
        workingConversations.add(event.conversationId);
        workingStartedAt.set(event.conversationId, Date.now());
      } else {
        workingConversations.delete(event.conversationId);
        workingStartedAt.delete(event.conversationId);
      }
    } else if (event.type === "config") {
      conversation.configOptions = event.configOptions;
    }
    if (state.selectedTaskId === task.id) {
      renderCenter();
      scrollChatToBottom();
    }
    if (event.type === "status" || event.type === "message") renderLeft();
  }

  function connectEvents() {
    const source = new EventSource("/api/events");
    source.onmessage = (event) => {
      try {
        applyEvent(JSON.parse(event.data));
      } catch {
        // ignore malformed events
      }
    };
  }

  function prepareSelectedConversation() {
    const task = selectedTask();
    if (!task || task.ui.centerTab !== "chat") return;
    const conversation = currentConversation(task);
    const target = selectedTarget();
    const currentTarget = conversation.dshTarget ?? "";
    if (conversation.configOptions.length > 0 && currentTarget === target) return;
    if (preparedConversations.has(conversation.id + ":" + target)) return;
    void prepareConversation(conversation.id);
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
    const byName = new Map(state.groups.map((group) => [group.name, group]));
    state.groups = names.map((name) => byName.get(name)).filter((group) => group !== undefined);
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
        void stopChat(target.dataset.conversationId);
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
      case "open-settings":
        openSettings();
        break;
      case "close-settings":
        closeSettings();
        break;
      case "add-group-row":
        addGroupRow();
        break;
      case "delete-group-row":
        deleteGroupRow(Number(target.dataset.index));
        break;
      case "save-settings":
        void saveSettings();
        break;
      case "retry-dsh":
        void retryDsh(target.dataset.target ?? undefined);
        break;
      case "permission-choice":
        void respondPermission(target.dataset.optionId);
        break;
      case "permission-cancel":
        void respondPermission(null);
        break;
      default:
        break;
    }
    hideContextMenu();
  });

  document.addEventListener("change", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    if (target.classList.contains("config-select")) {
      const conversationId = target.dataset.conversationId;
      const configId = target.dataset.configId;
      if (!conversationId || !configId) return;
      void fetch("/api/conversations/" + encodeURIComponent(conversationId) + "/config", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ configId: configId, value: target.value }),
      })
        .then(async (response) => {
          if (response.ok) {
            const payload = await response.json();
            const found = findConversationById(conversationId);
            if (found && Array.isArray(payload.configOptions)) {
              found.conversation.configOptions = payload.configOptions;
              renderCenter();
            }
            return;
          }
          const payload = await response.json().catch(() => ({}));
          toast(payload.error ?? "モデル変更に失敗しました");
        })
        .catch((error) => toast(error instanceof Error ? error.message : String(error)));
      return;
    }
    if (target.classList.contains("permission-select")) {
      const conversationId = target.dataset.conversationId;
      if (!conversationId) return;
      const found = findConversationById(conversationId);
      if (found) found.conversation.permissionMode = target.value;
      void fetch("/api/conversations/" + encodeURIComponent(conversationId), {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ permissionMode: target.value }),
      }).catch((error) => toast(error instanceof Error ? error.message : String(error)));
      return;
    }
    if (target.classList.contains("settings-group-target")) {
      const index = Number(target.dataset.index);
      if (target.value === "__custom__") {
        const value = window.prompt("接続先 (例: yoriwake.sbx)");
        const targetValue = (value?.trim() ?? "").replace(/^ssh:/, "");
        if (settingsDraft !== null && settingsDraft[index] !== undefined) {
          settingsDraft[index].target = targetValue;
          renderSettings();
        }
        return;
      }
      if (settingsDraft !== null && settingsDraft[index] !== undefined) {
        settingsDraft[index].target = target.value;
      }
      return;
    }
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
      if (currentPermission !== null) {
        void respondPermission(null);
        return;
      }
      const settingsModal = $("#settings-modal");
      if (settingsModal && !settingsModal.hidden) {
        closeSettings();
        return;
      }
      hideContextMenu();
      return;
    }
    if (event.target.id === "chat-input" && (event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault();
      const form = document.getElementById("chat-form");
      if (form) form.requestSubmit();
    }
  });

  function updateWorkingElapsed() {
    const log = document.getElementById("chat-log");
    const element = document.querySelector("[data-working-elapsed]");
    if (!log || !element) return;
    const started = workingStartedAt.get(log.dataset.conversationId);
    if (started !== undefined) {
      element.textContent = Math.max(1, Math.round((Date.now() - started) / 1000)) + "s";
    }
  }

  async function bootstrap() {
    try {
      await loadState();
      applyWidths();
      setupSplitters();
      render();
      connectEvents();
      prepareSelectedConversation();
      setInterval(updateWorkingElapsed, 1000);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      document.body.innerHTML = '<div class="pane-empty">' + esc(message) + "</div>";
    }
  }

  void bootstrap();
})();

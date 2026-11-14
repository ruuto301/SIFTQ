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

  // DS left pane: project groups with collapsible headers persisted in localStorage.
  var dsRoot = document.getElementById("ds-root");
  var projectOptions = [];
  if (dsRoot) {
    try { projectOptions = JSON.parse(dsRoot.getAttribute("data-ds-projects") || "[]"); } catch (e) { projectOptions = []; }
  }
  var GROUP_KEY = "ds-group-collapsed:v1";
  var collapsedGroups = {};
  try { collapsedGroups = JSON.parse(localStorage.getItem(GROUP_KEY) || "{}") || {}; } catch (e) { collapsedGroups = {}; }
  function saveCollapsedGroups() {
    try { localStorage.setItem(GROUP_KEY, JSON.stringify(collapsedGroups)); } catch (e) { /* ignore */ }
  }
  Array.prototype.forEach.call(document.querySelectorAll(".ds__group"), function (group) {
    var id = group.getAttribute("data-ds-group-id") || "__none__";
    if (collapsedGroups[id] !== true) return;
    group.setAttribute("data-collapsed", "true");
    var toggle = group.querySelector("[data-ds-group-toggle]");
    if (toggle) toggle.setAttribute("aria-expanded", "false");
  });
  Array.prototype.forEach.call(document.querySelectorAll("[data-ds-group-toggle]"), function (toggle) {
    toggle.addEventListener("click", function () {
      var group = toggle.closest(".ds__group");
      if (!group) return;
      var id = group.getAttribute("data-ds-group-id") || "__none__";
      var next = group.getAttribute("data-collapsed") !== "true";
      group.setAttribute("data-collapsed", next ? "true" : "false");
      toggle.setAttribute("aria-expanded", next ? "false" : "true");
      collapsedGroups[id] = next;
      saveCollapsedGroups();
    });
  });

  // DS left pane composer: create a task and insert it into its project group.
  var newForm = document.getElementById("ds-new-task");
  var newInput = document.getElementById("ds-new-title");
  var newAdd = document.getElementById("ds-new-add");
  var newProject = document.getElementById("ds-new-project");
  var newError = document.getElementById("ds-new-error");
  if (newForm && newInput && newAdd && newProject) {
    var NEW_HIGHLIGHT_MS = 1400;
    var submitting = false;
    var composing = false;

    function trimTitle(value) {
      return String(value || "").replace(/^\\s+|\\s+$/g, "");
    }
    function showNewError(message) {
      if (!newError) return;
      newError.textContent = message || "";
      newError.hidden = (message || "") === "";
    }
    function syncNewSubmit() {
      newAdd.disabled = submitting || trimTitle(newInput.value) === "";
    }
    function activeStatus() {
      var active = document.querySelector(".ds__status-tabs .is-active");
      return active === null ? "do" : trimTitle(active.textContent) || "do";
    }
    function groupSection(projectId) {
      var sections = document.querySelectorAll(".ds__group");
      for (var index = 0; index < sections.length; index += 1) {
        if ((sections[index].getAttribute("data-ds-group-id") || "") === projectId) return sections[index];
      }
      return null;
    }
    function buildTaskRow(task) {
      var project = task.project === null || task.project === undefined ? "" : String(task.project);
      var item = document.createElement("li");
      item.className = "ds__task-item";
      item.setAttribute("data-task-id", String(task.id));
      item.setAttribute("data-task-version", String(task.version));
      item.setAttribute("data-task-status", String(task.status));
      item.setAttribute("data-task-working", task.working === true ? "true" : "false");
      item.setAttribute("data-task-project", project);
      var link = document.createElement("a");
      link.className = "ds__task";
      link.setAttribute("href", "/ds?task=" + encodeURIComponent(String(task.id)));
      var head = document.createElement("span");
      head.className = "ds__task-head";
      var title = document.createElement("span");
      title.className = "ds__task-title";
      title.textContent = String(task.title);
      head.appendChild(title);
      link.appendChild(head);
      var meta = document.createElement("span");
      meta.className = "ds__task-meta";
      if (task.working === true) {
        var badge = document.createElement("span");
        badge.className = "working-badge";
        badge.textContent = "working";
        meta.appendChild(badge);
      }
      link.appendChild(meta);
      item.appendChild(link);
      return item;
    }
    function insertTask(task) {
      var project = task.project === null || task.project === undefined ? "" : String(task.project);
      var section = groupSection(project);
      if (section === null) return false;
      var list = section.querySelector(".ds__tasks");
      if (list === null) return false;
      var collapsed = section.getAttribute("data-collapsed") === "true";
      var row = buildTaskRow(task);
      list.insertBefore(row, list.firstElementChild);
      var count = section.querySelector(".ds__group-count");
      if (count !== null) count.textContent = String(list.querySelectorAll(".ds__task-item").length);
      var link = row.firstElementChild;
      if (link !== null) link.classList.add("is-new");
      if (!collapsed) row.scrollIntoView({ block: "nearest" });
      setTimeout(function () {
        if (link !== null) link.classList.remove("is-new");
      }, NEW_HIGHLIGHT_MS);
      return true;
    }
    function settleNewTask() {
      submitting = false;
      newAdd.textContent = "追加";
      newInput.disabled = false;
      newProject.disabled = false;
      syncNewSubmit();
      newInput.focus();
    }
    function submitNewTask() {
      var title = trimTitle(newInput.value);
      if (submitting || title === "") return;
      if (Array.from(title).length > 256) {
        showNewError("タスク名は 256 文字以内にしてください。");
        return;
      }
      showNewError("");
      submitting = true;
      newAdd.textContent = "追加中…";
      newInput.disabled = true;
      newProject.disabled = true;
      syncNewSubmit();
      fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title,
          description: "",
          status: activeStatus(),
          project: newProject.value === "" ? null : newProject.value,
          position: "first",
        }),
      })
        .then(function (response) {
          if (!response.ok) throw new Error("HTTP " + response.status);
          return response.json();
        })
        .then(function (task) {
          insertTask(task);
          newInput.value = "";
        })
        .catch(function () {
          showNewError("保存に失敗しました。もう一度お試しください。");
        })
        .then(settleNewTask);
    }

    newForm.addEventListener("submit", function (event) {
      event.preventDefault();
      submitNewTask();
    });
    newInput.addEventListener("input", function () {
      showNewError("");
      syncNewSubmit();
    });
    newInput.addEventListener("compositionstart", function () {
      composing = true;
    });
    newInput.addEventListener("compositionend", function () {
      composing = false;
    });
    newInput.addEventListener("keydown", function (event) {
      if (event.key !== "Enter") {
        if (event.key === "Escape") {
          newInput.value = "";
          showNewError("");
          syncNewSubmit();
        }
        return;
      }
      if (composing || event.isComposing) {
        event.preventDefault();
        return;
      }
      if (event.ctrlKey || event.metaKey) {
        event.preventDefault();
        if (typeof newForm.requestSubmit === "function") newForm.requestSubmit();
        else newForm.dispatchEvent(new Event("submit", { cancelable: true, bubbles: true }));
      }
    });
    syncNewSubmit();
  }

  // DS left pane DnD: task rows move between project groups, group heads reorder projects.
  var groupsBox = document.querySelector(".ds__groups");
  if (groupsBox) initGroupsDnd(groupsBox);

  function initGroupsDnd(box) {
    var pane = box.closest ? box.closest(".ds__pane--tasks") : null;
    var surface = pane === null ? box : pane;
    var status = document.getElementById("ds-groups-status");
    var drag = null;

    function setStatus(text, isError) {
      if (!status) return;
      status.textContent = text || "";
      status.hidden = (text || "") === "";
      status.classList.toggle("ds__groups-status--error", isError === true);
    }
    function groupOf(element) {
      return element && element.closest ? element.closest(".ds__group") : null;
    }
    function projectOf(group) {
      return group === null ? null : (group.getAttribute("data-ds-group-id") || "");
    }
    function taskListOf(group) {
      return group === null ? null : group.querySelector(".ds__tasks");
    }
    function sections() {
      return Array.prototype.slice.call(box.querySelectorAll(".ds__group"));
    }
    function clearMarks() {
      Array.prototype.forEach.call(box.querySelectorAll(".ds__group"), function (group) {
        group.classList.remove("ds__group--drop", "ds__group--drop-before", "ds__group--drop-after");
      });
      Array.prototype.forEach.call(box.querySelectorAll(".ds__task-item"), function (row) {
        row.classList.remove("ds__task-item--drop-before", "ds__task-item--drop-after");
      });
    }
    function clearDrag() {
      if (drag !== null && drag.element) drag.element.classList.remove("dragging");
      clearMarks();
      drag = null;
    }
    function rowSnapshot() {
      return Array.prototype.map.call(box.querySelectorAll(".ds__group"), function (group) {
        return { list: taskListOf(group), rows: Array.prototype.slice.call(group.querySelectorAll(".ds__task-item")) };
      });
    }
    function restoreRows(snapshot) {
      snapshot.forEach(function (entry) {
        if (entry.list === null) return;
        entry.rows.forEach(function (row) { entry.list.appendChild(row); });
      });
      refreshCounts();
    }
    function orderChanged(snapshot) {
      return snapshot.some(function (entry) {
        if (entry.list === null) return false;
        var current = Array.prototype.slice.call(entry.list.querySelectorAll(".ds__task-item"));
        return current.length !== entry.rows.length || current.some(function (row, index) { return row !== entry.rows[index]; });
      });
    }
    function reorderPayload(group) {
      var tasks = [];
      Array.prototype.forEach.call(group.querySelectorAll(".ds__task-item"), function (row, index) {
        tasks.push({ id: row.getAttribute("data-task-id"), order: index + 1 });
      });
      return tasks;
    }
    function refreshCounts() {
      Array.prototype.forEach.call(box.querySelectorAll(".ds__group"), function (group) {
        var count = group.querySelector(".ds__group-count");
        var list = taskListOf(group);
        if (count && list) count.textContent = String(list.children.length);
      });
    }
    function restoreProjects(previous) {
      previous.forEach(function (group) { box.appendChild(group); });
    }
    function changeProject(state, group) {
      var id = state.element.getAttribute("data-task-id");
      var version = Number(state.element.getAttribute("data-task-version"));
      return fetch("/api/tasks/bulk/project", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project: projectOf(group) === "" ? null : projectOf(group), tasks: [{ id: id, version: version }] }),
      }).then(function (response) {
        if (!response.ok) return false;
        return response.json().then(function (tasks) {
          var updated = Array.isArray(tasks) ? tasks.find(function (task) { return task.id === id; }) : undefined;
          if (updated && typeof updated.version === "number") state.element.setAttribute("data-task-version", String(updated.version));
          state.element.setAttribute("data-task-project", projectOf(group) || "");
          return true;
        });
      });
    }
    function saveTaskOrder(state, group, movedProject) {
      var payload = reorderPayload(group);
      var start = movedProject ? changeProject(state, group) : Promise.resolve(true);
      start
        .then(function (changed) {
          if (!changed) {
            restoreRows(state.snapshot);
            setStatus("タスクを移動できませんでした", true);
            return null;
          }
          return fetch("/api/tasks/reorder", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ tasks: payload }),
          });
        })
        .then(function (response) {
          if (response === null) return;
          if (!response.ok) {
            restoreRows(state.snapshot);
            setStatus("タスクを並び替えできませんでした (" + response.status + ")", true);
            return;
          }
          refreshCounts();
          setStatus("", false);
        })
        .catch(function () {
          restoreRows(state.snapshot);
          setStatus("タスクを並び替えできませんでした", true);
        });
    }
    function saveProjectOrder(previous) {
      var projects = [];
      sections().forEach(function (group, index) {
        var id = projectOf(group);
        if (id !== null && id !== "") projects.push({ id: id, order: index + 1 });
      });
      fetch("/api/projects/reorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projects: projects }),
      })
        .then(function (response) {
          if (!response.ok) {
            restoreProjects(previous);
            setStatus("プロジェクトを並び替えできませんでした (" + response.status + ")", true);
            return;
          }
          setStatus("", false);
        })
        .catch(function () {
          restoreProjects(previous);
          setStatus("プロジェクトを並び替えできませんでした", true);
        });
    }

    Array.prototype.forEach.call(box.querySelectorAll(".ds__task-item"), function (row) {
      row.setAttribute("draggable", "true");
      var link = row.querySelector(".ds__task");
      if (link) link.setAttribute("draggable", "false");
    });
    Array.prototype.forEach.call(box.querySelectorAll(".ds__group"), function (group) {
      var toggle = group.querySelector("[data-ds-group-toggle]");
      if (toggle && projectOf(group) !== "") toggle.setAttribute("draggable", "true");
    });

    surface.addEventListener("dragstart", function (event) {
      var target = event.target;
      if (!event.dataTransfer) return;
      var row = target && target.closest ? target.closest(".ds__task-item") : null;
      if (row !== null && box.contains(row)) {
        drag = { kind: "task", element: row, id: row.getAttribute("data-task-id") || "", originGroup: groupOf(row), snapshot: rowSnapshot() };
        row.classList.add("dragging");
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", drag.id);
        return;
      }
      var head = target && target.closest ? target.closest(".ds__group-head") : null;
      var group = groupOf(head);
      if (group !== null && projectOf(group) !== "") {
        drag = { kind: "project", element: group, id: projectOf(group) || "", previous: sections() };
        group.classList.add("dragging");
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", drag.id);
        return;
      }
      drag = null;
    });

    surface.addEventListener("dragover", function (event) {
      if (drag === null) return;
      var group = groupOf(event.target);
      if (group === null) {
        // Accept the drag over the pane background so the cursor never shows 🚫.
        event.preventDefault();
        if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
        clearMarks();
        return;
      }
      if (drag.kind === "task") {
        event.preventDefault();
        if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
        clearMarks();
        group.classList.add("ds__group--drop");
        var list = taskListOf(group);
        if (list === null) return;
        var overRow = event.target && event.target.closest ? event.target.closest(".ds__task-item") : null;
        if (overRow !== null && overRow !== drag.element && overRow.parentNode === list) {
          var rect = overRow.getBoundingClientRect();
          var before = event.clientY < rect.top + rect.height / 2;
          overRow.classList.add(before ? "ds__task-item--drop-before" : "ds__task-item--drop-after");
          if (before) list.insertBefore(drag.element, overRow);
          else list.insertBefore(drag.element, overRow.nextSibling);
          return;
        }
        if (projectOf(group) !== projectOf(drag.originGroup) && drag.element.parentNode !== list) list.appendChild(drag.element);
        return;
      }
      if (group === drag.element || projectOf(group) === "") return;
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
      clearMarks();
      var rect = group.getBoundingClientRect();
      var before = event.clientY < rect.top + rect.height / 2;
      group.classList.add(before ? "ds__group--drop-before" : "ds__group--drop-after");
      if (before) box.insertBefore(drag.element, group);
      else box.insertBefore(drag.element, group.nextSibling);
    });

    surface.addEventListener("drop", function (event) {
      if (drag === null) return;
      var state = drag;
      var group = groupOf(event.target);
      if (group === null) {
        clearDrag();
        return;
      }
      if (state.kind === "task") {
        event.preventDefault();
        var movedProject = projectOf(group) !== projectOf(state.originGroup);
        if (movedProject || orderChanged(state.snapshot)) saveTaskOrder(state, group, movedProject);
        clearDrag();
        return;
      }
      if (group === state.element || projectOf(group) === "") {
        clearDrag();
        return;
      }
      event.preventDefault();
      saveProjectOrder(state.previous);
      clearDrag();
    });

    surface.addEventListener("dragend", clearDrag);
    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape") clearDrag();
    });
  }

  // Task list context menu: status, working, project, open and delete.
  var taskList = document.querySelector(".ds__groups");
  if (taskList) initTaskMenu(taskList);

  function initTaskMenu(list) {
    var menu = null;
    var menuRow = null;
    function closeMenu() {
      if (menu) menu.remove();
      menu = null;
      menuRow = null;
    }
    function currentFilter() {
      var active = document.querySelector(".ds__status-tabs .is-active");
      return active ? active.textContent.trim() : "do";
    }
    function addItem(box, label, action, isDelete) {
      var item = document.createElement("button");
      item.type = "button";
      item.className = isDelete === true ? "matrix-menu-item matrix-menu-item--delete" : "matrix-menu-item";
      item.setAttribute("data-ds-task-action", action);
      item.textContent = label;
      box.appendChild(item);
    }
    function reloadFilter() {
      location.assign("/ds?status=" + encodeURIComponent(currentFilter()));
    }
    function applyTask(row, task) {
      row.setAttribute("data-task-version", String(task.version));
      row.setAttribute("data-task-status", task.status);
      row.setAttribute("data-task-working", task.working === true ? "true" : "false");
      var workingBadge = row.querySelector(".working-badge");
      if (task.working === true && workingBadge === null) {
        var meta = row.querySelector(".ds__task-meta");
        var created = document.createElement("span");
        created.className = "working-badge";
        created.textContent = "working";
        if (meta) meta.appendChild(created);
      } else if (task.working !== true && workingBadge !== null) {
        workingBadge.remove();
      }
      var nextProject = task.project === null || task.project === undefined ? "" : task.project;
      if (nextProject !== (row.getAttribute("data-task-project") || "")) {
        location.reload();
        return;
      }
      if (task.status !== currentFilter()) {
        var wasSelected = row.querySelector(".ds__task.active") !== null;
        row.remove();
        if (wasSelected) reloadFilter();
      }
    }
    function patchTask(row, body) {
      var id = row.getAttribute("data-task-id");
      var version = Number(row.getAttribute("data-task-version"));
      closeMenu();
      fetch("/api/tasks/" + encodeURIComponent(id), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(Object.assign({}, body, { version: version })),
      })
        .then(function (response) {
          if (!response.ok) {
            location.reload();
            return null;
          }
          return response.json();
        })
        .then(function (task) {
          if (task) applyTask(row, task);
        })
        .catch(function () {
          location.reload();
        });
    }
    function removeTask(row) {
      var id = row.getAttribute("data-task-id");
      var version = Number(row.getAttribute("data-task-version"));
      var wasSelected = row.querySelector(".ds__task.active") !== null;
      fetch("/api/tasks/" + encodeURIComponent(id), {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ version: version }),
      })
        .then(function (response) {
          if (!response.ok) {
            location.reload();
            return;
          }
          row.remove();
          if (wasSelected) reloadFilter();
        })
        .catch(function () {
          location.reload();
        });
    }
    function deleteTask(row) {
      closeMenu();
      // The confirmation is a centered dialog, not the browser's window.confirm.
      if (typeof window.__siftqConfirm !== "function") return;
      window.__siftqConfirm("このタスクを削除しますか？", function () {
        removeTask(row);
      });
    }
    function openProjectMenu(row, sourceBox) {
      var current = row.getAttribute("data-task-project") || "";
      var submenu = document.createElement("div");
      submenu.className = "matrix-menu";
      [{ id: "", name: "未分類" }].concat(projectOptions).forEach(function (option) {
        var item = document.createElement("button");
        item.type = "button";
        item.className = "matrix-menu-item";
        item.setAttribute("data-ds-project", option.id);
        item.textContent = (option.id === current ? "✓ " : "　") + option.name;
        submenu.appendChild(item);
      });
      submenu.addEventListener("click", function (event) {
        var item = event.target.closest ? event.target.closest("[data-ds-project]") : null;
        if (item === null) return;
        var target = menuRow;
        if (target === null) return;
        var value = item.getAttribute("data-ds-project");
        patchTask(target, { project: value === "" ? null : value });
      });
      document.body.appendChild(submenu);
      var rect = sourceBox.getBoundingClientRect();
      var subRect = submenu.getBoundingClientRect();
      submenu.style.left = Math.max(8, Math.min(rect.right + 4, window.innerWidth - subRect.width - 8)) + "px";
      submenu.style.top = Math.max(8, Math.min(rect.top, window.innerHeight - subRect.height - 8)) + "px";
      menu = submenu;
    }
    function addDivider(box) {
      var divider = document.createElement("div");
      divider.className = "ds-menu__divider";
      box.appendChild(divider);
    }
    function projectName(value) {
      if (value === "" || value === null || value === undefined) return "未分類";
      for (var index = 0; index < projectOptions.length; index += 1) {
        if (projectOptions[index].id === value) return projectOptions[index].name;
      }
      return value;
    }
    function addValueRow(box, label, value, action, caret) {
      var item = document.createElement("button");
      item.type = "button";
      item.className = "matrix-menu-item ds-menu__row";
      item.setAttribute("data-ds-task-action", action);
      var text = document.createElement("span");
      text.textContent = label;
      item.appendChild(text);
      var meta = document.createElement("span");
      meta.className = "ds-menu__value";
      meta.textContent = value;
      item.appendChild(meta);
      if (caret === true) {
        var arrow = document.createElement("span");
        arrow.className = "ds-menu__caret";
        arrow.textContent = "▸";
        item.appendChild(arrow);
      }
      box.appendChild(item);
    }
    function setCopyStatus(ok) {
      var status = document.getElementById("ds-groups-status");
      if (status === null) return;
      var message = ok === true ? "copied" : "copy failed";
      status.textContent = message;
      status.hidden = false;
      status.classList.toggle("ds__groups-status--error", ok !== true);
      window.setTimeout(function () {
        if (status.textContent !== message) return;
        status.textContent = "";
        status.hidden = true;
        status.classList.remove("ds__groups-status--error");
      }, 2000);
    }
    function copyTitle(row) {
      var node = row.querySelector(".ds__task-title");
      var text = node === null ? "" : node.textContent.trim();
      if (text === "") return;
      function fallback() {
        var area = document.createElement("textarea");
        area.value = text;
        area.setAttribute("readonly", "");
        area.style.position = "fixed";
        area.style.opacity = "0";
        document.body.appendChild(area);
        area.select();
        var copied = false;
        try {
          copied = document.execCommand("copy");
        } catch (error) {
          copied = false;
        }
        area.remove();
        setCopyStatus(copied);
      }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(function () {
          setCopyStatus(true);
        }, fallback);
      } else {
        fallback();
      }
    }
    function openMenu(row, x, y) {
      closeMenu();
      menuRow = row;
      var status = row.getAttribute("data-task-status") || "do";
      var working = row.getAttribute("data-task-working") === "true";
      var project = row.getAttribute("data-task-project") || "";
      var titleNode = row.querySelector(".ds__task-title");
      var box = document.createElement("div");
      box.className = "matrix-menu";
      box.setAttribute("role", "menu");

      var head = document.createElement("div");
      head.className = "ds-menu__head";
      var title = document.createElement("span");
      title.className = "ds-menu__title";
      title.textContent = titleNode === null ? "" : titleNode.textContent.trim();
      title.title = title.textContent;
      var meta = document.createElement("span");
      meta.className = "ds-menu__meta";
      meta.textContent = status + " ・ " + projectName(project);
      head.appendChild(title);
      head.appendChild(meta);
      box.appendChild(head);
      addDivider(box);

      var label = document.createElement("div");
      label.className = "ds-menu__label";
      label.textContent = "status";
      box.appendChild(label);
      var segment = document.createElement("div");
      segment.className = "ds-menu__segment";
      ["do", "done", "skip"].forEach(function (value) {
        var chip = document.createElement("button");
        chip.type = "button";
        chip.className = "ds-menu__chip" + (value === status ? " is-active" : "");
        chip.setAttribute("data-ds-task-action", "status:" + value);
        chip.textContent = value;
        segment.appendChild(chip);
      });
      box.appendChild(segment);
      addDivider(box);

      addValueRow(box, "project", projectName(project), "project", true);
      addItem(box, "copy title", "copy-title", false);
      addDivider(box);
      addValueRow(box, "working", working ? "on" : "off", "working", false);
      addItem(box, "delete", "delete", true);

      box.addEventListener("click", function (event) {
        var item = event.target.closest ? event.target.closest("[data-ds-task-action]") : null;
        if (item === null) return;
        var action = item.getAttribute("data-ds-task-action");
        var target = menuRow;
        if (target === null) return;
        if (action === "copy-title") {
          copyTitle(target);
          closeMenu();
          return;
        }
        if (action === "delete") {
          deleteTask(target);
          return;
        }
        if (action === "project") {
          openProjectMenu(target, box);
          return;
        }
        if (action === "working") {
          patchTask(target, { working: target.getAttribute("data-task-working") !== "true" });
          return;
        }
        if (action.indexOf("status:") === 0) patchTask(target, { status: action.slice("status:".length) });
      });
      document.body.appendChild(box);
      var rect = box.getBoundingClientRect();
      box.style.left = Math.max(8, Math.min(x, window.innerWidth - rect.width - 8)) + "px";
      box.style.top = Math.max(8, Math.min(y, window.innerHeight - rect.height - 8)) + "px";
      menu = box;
    }
    document.addEventListener("contextmenu", function (event) {
      var row = event.target.closest ? event.target.closest(".ds__task-item") : null;
      if (row === null || !list.contains(row)) return;
      event.preventDefault();
      openMenu(row, event.clientX, event.clientY);
    });
    document.addEventListener("click", function (event) {
      if (menu !== null && !menu.contains(event.target)) closeMenu();
    }, true);
    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape") closeMenu();
    });
  }

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

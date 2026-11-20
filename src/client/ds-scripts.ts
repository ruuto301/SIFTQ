import { DESCRIPTION_TABS_SCRIPT } from "./description-tabs-scripts";
import {
  DS_LAYOUT_DEFAULT_LEFT,
  DS_LAYOUT_STORAGE_KEY,
  clampDsLayoutLeft,
  dsLayoutLimits,
  dsLayoutWidthForContainer,
  parseDsLayout,
  serializeDsLayout,
} from "./ds-layout";

/**
 * Browser source for the pure layout math. `Function.prototype.toString` keeps a
 * single implementation shared with the unit tests; the functions are DOM-free.
 */
const DS_LAYOUT_RUNTIME = [
  String(dsLayoutLimits),
  String(clampDsLayoutLeft),
  String(dsLayoutWidthForContainer),
  String(parseDsLayout),
  String(serializeDsLayout),
].join("\n");

/** DS task screen: pane resizer, project groups, composer, context menu and task editing. */
export const DS_SCRIPT = `(function () {
  var root = document.getElementById("ds-root");
  if (!root) return;

  // Left pane width: the free range follows the container width, and the px value
  // plus its ratio is persisted so a smaller window re-clamps instead of collapsing.
  var LAYOUT_KEY = "${DS_LAYOUT_STORAGE_KEY}";
  var DEFAULT_LEFT = ${DS_LAYOUT_DEFAULT_LEFT};
  ${DS_LAYOUT_RUNTIME}
  var layout = parseDsLayout(localStorage.getItem(LAYOUT_KEY)) || { left: DEFAULT_LEFT, ratio: 0 };
  function containerWidth() {
    var rect = root.getBoundingClientRect();
    return rect.width || root.clientWidth || 0;
  }
  function saveLayout() {
    try { localStorage.setItem(LAYOUT_KEY, serializeDsLayout(layout.left, layout.ratio)); } catch (e) { /* ignore */ }
  }
  function resizerHandles() {
    return Array.prototype.slice.call(root.querySelectorAll(".ds__resizer"));
  }
  function paintResizer() {
    var limits = dsLayoutLimits(containerWidth());
    root.style.setProperty("--ds-left", layout.left + "px");
    resizerHandles().forEach(function (handle) {
      handle.setAttribute("aria-valuenow", String(layout.left));
      handle.setAttribute("aria-valuemin", String(limits.min));
      handle.setAttribute("aria-valuemax", String(limits.max));
      var tag = handle.querySelector("[data-ds-width-tag]");
      if (tag) tag.textContent = layout.left + "px";
    });
  }
  function setPaneWidth(value, persist) {
    var width = containerWidth();
    layout.left = clampDsLayoutLeft(value, width);
    layout.ratio = width > 0 ? layout.left / width : layout.ratio;
    paintResizer();
    if (persist) saveLayout();
  }
  // A window resize re-derives the width from the stored ratio, then clamps.
  function reflowLayout() {
    var width = containerWidth();
    layout.left = dsLayoutWidthForContainer({ left: layout.left, ratio: layout.ratio }, width);
    paintResizer();
  }
  resizerHandles().forEach(function (handle) {
    handle.addEventListener("pointerdown", function (event) {
      event.preventDefault();
      var startX = event.clientX;
      var start = layout.left;
      handle.setPointerCapture(event.pointerId);
      handle.classList.add("dragging");
      function move(moveEvent) {
        setPaneWidth(start + (moveEvent.clientX - startX), false);
      }
      function up() {
        handle.classList.remove("dragging");
        handle.removeEventListener("pointermove", move);
        handle.removeEventListener("pointerup", up);
        handle.removeEventListener("pointercancel", up);
        saveLayout();
      }
      handle.addEventListener("pointermove", move);
      handle.addEventListener("pointerup", up);
      handle.addEventListener("pointercancel", up);
    });
    handle.addEventListener("dblclick", function () {
      setPaneWidth(DEFAULT_LEFT, true);
    });
    handle.addEventListener("keydown", function (event) {
      var delta = event.shiftKey ? 24 : 8;
      if (event.key === "ArrowLeft") { setPaneWidth(layout.left - delta, true); event.preventDefault(); return; }
      if (event.key === "ArrowRight") { setPaneWidth(layout.left + delta, true); event.preventDefault(); return; }
      if (event.key === "Home") { setPaneWidth(dsLayoutLimits(containerWidth()).min, true); event.preventDefault(); return; }
      if (event.key === "End") { setPaneWidth(dsLayoutLimits(containerWidth()).max, true); event.preventDefault(); return; }
    });
  });
  reflowLayout();
  window.addEventListener("resize", reflowLayout);

  // Narrow screens fall back to one pane: the list, or the detail of an opened task.
  var backButton = document.querySelector("[data-ds-back]");
  if (backButton) {
    backButton.addEventListener("click", function () {
      root.setAttribute("data-ds-view", "list");
      if (window.history && window.history.replaceState) {
        var params = new URLSearchParams(window.location.search);
        params.delete("task");
        var query = params.toString();
        window.history.replaceState(null, "", window.location.pathname + (query === "" ? "" : "?" + query));
      }
    });
  }
  if (typeof window.matchMedia === "function" && window.matchMedia("(max-width: 900px)").matches) {
    var requestedTask = new URLSearchParams(window.location.search).get("task");
    root.setAttribute("data-ds-view", requestedTask === null ? "list" : "detail");
  }

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

  // Task list context menu: status, working, project, copy title / id and delete.
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
    // OS の右クリックメニューと同じ位置決め: 左上をカーソル位置に置き、
    // 右/下に入らないときは左/上へ反転してから画面内（8px）に収める。
    var MENU_OFFSET = 1;
    var MENU_PADDING = 8;
    function clampMenu(box, left, top) {
      var rect = box.getBoundingClientRect();
      var maxLeft = window.innerWidth - rect.width - MENU_PADDING;
      var maxTop = window.innerHeight - rect.height - MENU_PADDING;
      return {
        left: Math.max(MENU_PADDING, Math.min(left, maxLeft)),
        top: Math.max(MENU_PADDING, Math.min(top, maxTop)),
      };
    }
    // 画面より高いメニューでも最後の項目に届くように、使える高さでスクロールさせる。
    function fitMenuHeight(box, top) {
      var available = window.innerHeight - top - MENU_PADDING;
      box.style.overflowY = "auto";
      box.style.maxHeight = box.scrollHeight > available ? available + "px" : "";
    }
    function placeMenuAtPointer(box, x, y) {
      var rect = box.getBoundingClientRect();
      var left = x + MENU_OFFSET;
      var top = y + MENU_OFFSET;
      if (left + rect.width > window.innerWidth - MENU_PADDING) left = x - rect.width - MENU_OFFSET;
      if (top + rect.height > window.innerHeight - MENU_PADDING) top = y - rect.height - MENU_OFFSET;
      var position = clampMenu(box, left, top);
      box.style.left = Math.round(position.left) + "px";
      box.style.top = Math.round(position.top) + "px";
      fitMenuHeight(box, position.top);
    }
    function placeSubmenu(box, sourceRect) {
      var rect = box.getBoundingClientRect();
      var left = sourceRect.right + MENU_OFFSET;
      if (left + rect.width > window.innerWidth - MENU_PADDING) {
        left = sourceRect.left - rect.width - MENU_OFFSET;
      }
      var position = clampMenu(box, left, sourceRect.top);
      box.style.left = Math.round(position.left) + "px";
      box.style.top = Math.round(position.top) + "px";
      fitMenuHeight(box, position.top);
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
      placeSubmenu(submenu, sourceBox.getBoundingClientRect());
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
    function setCopyStatus(ok, messages) {
      var status = document.getElementById("ds-groups-status");
      if (status === null) return;
      var message = ok === true ? messages.ok : messages.ng;
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
    // 非同期 clipboard API が無い / 失敗したときは隠し textarea + execCommand へ落とす。
    function writeClipboard(text, messages) {
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
        setCopyStatus(copied, messages);
      }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(function () {
          setCopyStatus(true, messages);
        }, fallback);
      } else {
        fallback();
      }
    }
    function copyTitle(row) {
      var node = row.querySelector(".ds__task-title");
      var text = node === null ? "" : node.textContent.trim();
      if (text === "") return;
      writeClipboard(text, { ok: "copied", ng: "copy failed" });
    }
    function copyTaskId(row) {
      var id = row.getAttribute("data-task-id") || "";
      if (id === "") return;
      writeClipboard(id, { ok: "copied id", ng: "copy failed" });
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
      addItem(box, "copy id", "copy-id", false);
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
        if (action === "copy-id") {
          copyTaskId(target);
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
      placeMenuAtPointer(box, x, y);
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

})();

  // Task pane: the title saves on Ctrl/Cmd + Enter, the description autosaves 600ms
  // after the last input. One request runs at a time and the latest text wins.
  (function () {
    var pane = document.getElementById("ds-task");
    if (!pane) return;
    var titleInput = document.getElementById("ds-task-title");
    var descriptionInput = document.getElementById("ds-task-description");
    var status = document.getElementById("ds-task-status");
    var error = document.getElementById("ds-task-error");
    if (!titleInput || !descriptionInput) return;
    var baselineTitle = titleInput.value;
    var baselineDescription = descriptionInput.value;
    var autosaveTimer = null;
    var saving = false;
    var queuedTitle = false;
    var queuedDescription = false;
    // A late response must not overwrite an Escape revert.
    var saveGeneration = 0;

    function setStatus(text, kind) {
      if (!status) return;
      status.textContent = text;
      status.className = kind === undefined ? "ds-task__status" : "ds-task__status ds-task__status--" + kind;
    }
    function setError(text) {
      if (!error) return;
      error.textContent = text;
      error.hidden = text === "";
    }
    function titleDirty() {
      return titleInput.value.trim() !== baselineTitle;
    }
    function descriptionDirty() {
      return descriptionInput.value !== baselineDescription;
    }
    function dirty() {
      return titleDirty() || descriptionDirty();
    }
    function refresh() {
      var changed = dirty();
      if (changed) setStatus("未保存の変更", "dirty");
      return changed;
    }
    function cancelAutosave() {
      if (autosaveTimer === null) return;
      clearTimeout(autosaveTimer);
      autosaveTimer = null;
    }
    function clearQueued() {
      queuedTitle = false;
      queuedDescription = false;
    }
    function scheduleAutosave() {
      cancelAutosave();
      autosaveTimer = setTimeout(function () {
        autosaveTimer = null;
        if (!descriptionDirty()) return;
        if (saving) { queuedDescription = true; return; }
        save(false, true);
      }, 600);
    }
    function saveTitle() {
      if (saving) { queuedTitle = true; return; }
      save(true, descriptionDirty());
    }
    function revert() {
      cancelAutosave();
      clearQueued();
      saveGeneration += 1;
      titleInput.value = baselineTitle;
      descriptionInput.value = baselineDescription;
      refresh();
      setStatus("", undefined);
      setError("");
    }
    function updateRow(task) {
      var row = document.querySelector('.ds__task-item[data-task-id="' + task.id + '"]');
      if (!row) return;
      row.setAttribute("data-task-version", String(task.version));
      var title = row.querySelector(".ds__task-title");
      if (title) title.textContent = task.title;
    }
    /**
     * Patches the changed fields only: the description autosave never rewrites the
     * title, and Ctrl/Cmd + Enter saves both pending fields.
     */
    function save(sendsTitle, sendsDescription) {
      var title = titleInput.value.trim();
      var patch = { version: Number(pane.getAttribute("data-task-version")) };
      if (!sendsTitle && !sendsDescription) return;
      if (sendsTitle && title === "") { setError("title を入力してください。"); return; }
      if (sendsTitle) patch.title = title;
      if (sendsDescription) patch.description = descriptionInput.value;
      var sentTitle = title;
      var sentDescription = descriptionInput.value;
      var generation = saveGeneration;
      var canQueue = true;
      setError("");
      saving = true;
      setStatus("保存中…", "saving");
      fetch("/api/tasks/" + encodeURIComponent(pane.getAttribute("data-task-id") || ""), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      })
        .then(function (response) {
          if (response.status === 409) {
            canQueue = false;
            if (generation === saveGeneration) {
              setStatus("保存できませんでした", "error");
              setError("他の更新と衝突しました。内容を確認してから再読み込みしてください。");
            }
            return null;
          }
          if (!response.ok) {
            canQueue = false;
            if (generation === saveGeneration) setStatus("保存できませんでした", "error");
            return null;
          }
          return response.json();
        })
        .then(function (task) {
          if (task === null || task === undefined) return;
          pane.setAttribute("data-task-version", String(task.version));
          if (generation !== saveGeneration) return;
          if (sendsTitle) {
            baselineTitle = task.title;
            if (titleInput.value.trim() === sentTitle) titleInput.value = task.title;
          }
          if (sendsDescription) {
            baselineDescription = task.description;
            // Keep text typed while the request was running; the queued save sends it next.
            if (descriptionInput.value === sentDescription) descriptionInput.value = task.description;
          }
          updateRow(task);
          setStatus(dirty() ? "未保存の変更" : "保存しました", dirty() ? "dirty" : "saved");
        })
        .catch(function () {
          canQueue = false;
          if (generation === saveGeneration) setStatus("保存できませんでした", "error");
        })
        .then(function () {
          saving = false;
          var nextTitle = queuedTitle;
          var nextDescription = queuedDescription;
          clearQueued();
          if (!canQueue || !nextTitle && !nextDescription) return;
          save(nextTitle && titleDirty(), nextDescription && descriptionDirty());
        });
    }

    titleInput.addEventListener("input", function () {
      if (refresh()) return;
      setStatus("", undefined);
    });
    // The shared editor script writes the hidden textarea before this event bubbles,
    // so the autosave reads the synced value.
    pane.addEventListener("input", function (event) {
      var target = event.target;
      var editor = target && target.closest ? target.closest("[data-description-editor]") : null;
      if (!editor) return;
      if (!refresh()) setStatus("", undefined);
      scheduleAutosave();
    });
    pane.addEventListener("keydown", function (event) {
      if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
        event.preventDefault();
        cancelAutosave();
        saveTitle();
        return;
      }
      if (event.key === "Escape") { event.preventDefault(); revert(); }
    });
    refresh();
  })();

  // Description 編集 / プレビュー tabs: the same script the task form uses.
  (function () {
    ${DESCRIPTION_TABS_SCRIPT}
  })();
`;

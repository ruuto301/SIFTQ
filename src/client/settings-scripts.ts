/** Settings: project CRUD against /api/projects. Each action reloads the page. */
export const SETTINGS_SCRIPT = `(function () {
  var root = document.querySelector("[data-settings-page]");
  if (!root) return;
  var list = root.querySelector("[data-settings-list]");
  var addForm = root.querySelector("[data-settings-add]");
  var error = root.querySelector("[data-settings-error]");
  if (!list) return;

  function showError(message) {
    if (!error) return;
    error.textContent = message || "";
    error.hidden = (message || "") === "";
  }
  function request(method, path, body) {
    return fetch(path, {
      method: method,
      headers: { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    }).then(function (response) {
      if (!response.ok) throw new Error("HTTP " + response.status);
      return response.status === 204 ? null : response.json();
    });
  }
  function reload() { location.reload(); }
  function rows() {
    return Array.prototype.slice.call(list.querySelectorAll("[data-settings-row]"));
  }
  function ids() {
    return rows().map(function (row) { return row.getAttribute("data-project-id"); });
  }
  function nameOf(row) { return row.getAttribute("data-project-name") || ""; }
  function countOf(row) { return Number(row.getAttribute("data-count") || "0"); }

  /** Builds an ASCII id from the name, falling back to a random id. */
  function idFor(name, taken) {
    var slug = String(name).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48);
    if (slug !== "" && taken.indexOf(slug) === -1) return slug;
    var suffix = "";
    var alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
    for (var index = 0; index < 8; index += 1) alphabet = alphabet;
    suffix = Math.random().toString(36).slice(2, 10);
    return "p-" + suffix;
  }

  function fail(message) {
    return function () { showError(message); };
  }

  function saveOrder() {
    var payload = rows().map(function (row, index) {
      return { id: row.getAttribute("data-project-id"), order: index + 1 };
    });
    request("POST", "/api/projects/reorder", { projects: payload }).then(reload, fail("並べ替えに失敗しました。"));
  }

  // The rename button must not steal focus from the input it opens.
  list.addEventListener("mousedown", function (event) {
    var target = event.target;
    if (target && target.closest && target.closest("[data-project-rename]")) event.preventDefault();
  });

  list.addEventListener("click", function (event) {
    var target = event.target;
    var row = target && target.closest ? target.closest("[data-settings-row]") : null;
    if (row === null) return;
    var id = row.getAttribute("data-project-id");

    if (target.closest("[data-project-delete]")) {
      var count = countOf(row);
      var message = count > 0
        ? "「" + nameOf(row) + "」を削除しますか？（" + count + " 件のタスクは未分類になります）"
        : "「" + nameOf(row) + "」を削除しますか？";
      window.__siftqConfirm(message, function () {
        request("DELETE", "/api/projects/" + encodeURIComponent(id)).then(reload, fail("削除に失敗しました。"));
      });
      return;
    }

    if (target.closest("[data-project-rename]")) {
      // Keep focus on the new input instead of letting the click focus the button.
      event.preventDefault();
      startRename(row, id);
      return;
    }

    if (target.closest("[data-project-up]") || target.closest("[data-project-down]")) {
      var up = target.closest("[data-project-up]") !== null;
      var siblings = rows();
      var index = siblings.indexOf(row);
      var next = up ? index - 1 : index + 1;
      if (next < 0 || next >= siblings.length) return;
      var parent = row.parentNode;
      if (parent === null) return;
      if (up) parent.insertBefore(row, siblings[next]);
      else parent.insertBefore(siblings[next], row);
      saveOrder();
    }
  });

  function startRename(row, id) {
    var label = row.querySelector("[data-project-name-label]");
    if (label === null) return;
    var current = nameOf(row);
    var input = document.createElement("input");
    input.type = "text";
    input.className = "settings-row__input";
    input.maxLength = 32;
    input.setAttribute("aria-label", "プロジェクト名");
    input.value = current;
    label.parentNode.replaceChild(input, label);
    input.focus();
    input.select();

    var settled = false;
    function settle(save) {
      if (settled) return;
      settled = true;
      var next = input.value.trim();
      if (!save || next === "" || next === current) {
        // Nothing to save: restore the label in place instead of reloading.
        if (input.parentNode) input.parentNode.replaceChild(label, input);
        return;
      }
      request("PATCH", "/api/projects/" + encodeURIComponent(id), { name: next }).then(reload, fail("名前の変更に失敗しました。"));
    }

    input.addEventListener("keydown", function (event) {
      if (event.key === "Enter") { event.preventDefault(); settle(true); }
      if (event.key === "Escape") { event.preventDefault(); settle(false); }
    });
    // The click that opened the editor can still move focus; attach blur after it settles.
    setTimeout(function () {
      input.addEventListener("blur", function () { settle(true); });
    }, 0);
  }

  if (addForm) {
    addForm.addEventListener("submit", function (event) {
      event.preventDefault();
      var input = addForm.querySelector("input[name=name]");
      var name = input ? input.value.trim() : "";
      if (name === "") return;
      showError("");
      request("POST", "/api/projects", { id: idFor(name, ids()), name: name }).then(reload, fail("追加に失敗しました。"));
    });
  }
})();`;

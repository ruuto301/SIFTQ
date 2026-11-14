export const MK_SCRIPT = `
function mkApi(path, init) {
  var options = Object.assign({ headers: { "content-type": "application/json" } }, init || {});
  return fetch(path, options).then(function (response) {
    if (!response.ok) throw new Error("MK request failed: " + response.status);
    return response.status === 204 ? null : response.json();
  });
}
function mkPage() { return document.querySelector("[data-mk-page]"); }
function mkCardId(card) { return card.getAttribute("data-mk-id"); }
function mkCards() { return Array.prototype.slice.call(document.querySelectorAll("[data-mk-page] .mk-card[data-mk-id]")); }
function mkSelectedCards() {
  return mkCards().filter(function (card) {
    var checkbox = card.querySelector("[data-mk-select]");
    return checkbox && checkbox.checked;
  });
}
function mkSelectedIds() {
  return mkSelectedCards().map(mkCardId).filter(function (id) { return !!id; });
}
function mkConfirm(message, run) {
  if (typeof window.__siftqConfirm === "function") { window.__siftqConfirm(message, run); return; }
  if (window.confirm(message)) run();
}
function mkReload() { window.location.reload(); }
function mkRun(path, init) { mkApi(path, init).then(mkReload).catch(function () {}); }
function mkComposerColor(composer) { return composer.getAttribute("data-mk-color") || "default"; }
function setMkComposerOpen(composer, open) {
  composer.classList.toggle("mk-composer--open", open);
  composer.setAttribute("data-mk-composer-open", open ? "true" : "false");
  var trigger = composer.querySelector("[data-mk-composer-trigger]");
  if (trigger) trigger.setAttribute("aria-expanded", open ? "true" : "false");
  var editor = composer.querySelector("[data-mk-composer-editor]");
  if (editor) editor.hidden = !open;
  if (!open) return;
  var title = composer.querySelector("[data-mk-composer-title]");
  if (title) title.focus();
}
function selectMkComposerColor(composer, color) {
  composer.setAttribute("data-mk-color", color);
  composer.querySelectorAll("[data-mk-composer-color]").forEach(function (button) {
    var active = button.getAttribute("data-mk-composer-color") === color;
    button.setAttribute("aria-pressed", active ? "true" : "false");
  });
}
function resetMkComposer(composer) {
  var title = composer.querySelector("[data-mk-composer-title]");
  var body = composer.querySelector("[data-mk-composer-body]");
  if (title) title.value = "";
  if (body) body.value = "";
  selectMkComposerColor(composer, "default");
}
function saveMkComposer(composer) {
  var title = composer.querySelector("[data-mk-composer-title]");
  var body = composer.querySelector("[data-mk-composer-body]");
  var value = title ? title.value.trim() : "";
  if (!value) return;
  mkRun("/api/mk/notes", {
    method: "POST",
    body: JSON.stringify({ title: value, body: body ? body.value : "", color: mkComposerColor(composer) }),
  });
}
function mkSetPinned(card) {
  var id = mkCardId(card);
  if (!id) return;
  mkRun("/api/mk/notes/" + encodeURIComponent(id), {
    method: "PATCH",
    body: JSON.stringify({ pinned: card.getAttribute("data-mk-pinned") !== "true" }),
  });
}
function mkDeleteCard(card) {
  var id = mkCardId(card);
  if (!id) return;
  mkConfirm("このメモを削除しますか？", function () {
    mkRun("/api/mk/notes/" + encodeURIComponent(id), { method: "DELETE" });
  });
}
function syncMkSelection() {
  var page = mkPage();
  if (!page) return;
  var cards = mkCards();
  var selected = mkSelectedCards();
  var bulkBar = page.querySelector("[data-mk-bulk-bar]");
  if (bulkBar) bulkBar.hidden = selected.length === 0;
  var count = page.querySelector("[data-mk-selection-count]");
  if (count) count.textContent = selected.length + "件選択";
  var selectAll = page.querySelector("[data-mk-select-all]");
  if (selectAll) {
    selectAll.checked = cards.length > 0 && selected.length === cards.length;
    selectAll.indeterminate = selected.length > 0 && selected.length < cards.length;
  }
  cards.forEach(function (card) {
    var checkbox = card.querySelector("[data-mk-select]");
    if (checkbox) card.classList.toggle("is-selected", checkbox.checked);
  });
}
function setMkSelecting(page, active) {
  page.setAttribute("data-mk-selecting", active ? "true" : "false");
  var toggle = page.querySelector("[data-mk-selection-toggle]");
  if (toggle) {
    toggle.setAttribute("aria-pressed", active ? "true" : "false");
    toggle.classList.toggle("is-active", active);
  }
  if (!active) {
    mkCards().forEach(function (card) {
      var checkbox = card.querySelector("[data-mk-select]");
      if (checkbox) checkbox.checked = false;
    });
  }
  syncMkSelection();
}
function mkBulk(body) {
  if (body.ids.length === 0) return;
  mkRun("/api/mk/notes/bulk", { method: "POST", body: JSON.stringify(body) });
}
function mkBulkColor(color) { mkBulk({ ids: mkSelectedIds(), action: "color", color: color }); }
function mkBulkPin() { mkBulk({ ids: mkSelectedIds(), action: "pin", pinned: true }); }
function mkBulkDelete() {
  var ids = mkSelectedIds();
  if (ids.length === 0) return;
  mkConfirm("選択した" + ids.length + "件のメモを削除しますか？", function () {
    mkRun("/api/mk/notes/bulk", { method: "POST", body: JSON.stringify({ ids: ids, action: "delete" }) });
  });
}
function mkSearchUrl(form) {
  var params = new URLSearchParams();
  form.querySelectorAll('input[type="hidden"]').forEach(function (hidden) {
    if (hidden.name) params.set(hidden.name, hidden.value);
  });
  var input = form.querySelector("[data-mk-search-input]");
  if (input && input.value.trim() !== "") params.set("q", input.value.trim());
  var search = params.toString();
  return search === "" ? "/mk" : "/mk?" + search;
}
function initializeMkComposer(page) {
  var composer = page.querySelector("[data-mk-composer]");
  if (!composer || composer.getAttribute("data-mk-ready") === "true") return;
  composer.setAttribute("data-mk-ready", "true");
  var trigger = composer.querySelector("[data-mk-composer-trigger]");
  if (trigger) trigger.addEventListener("click", function () { setMkComposerOpen(composer, true); });
  var cancel = composer.querySelector("[data-mk-composer-cancel]");
  if (cancel) cancel.addEventListener("click", function () { resetMkComposer(composer); setMkComposerOpen(composer, false); });
  var save = composer.querySelector("[data-mk-composer-save]");
  if (save) save.addEventListener("click", function () { saveMkComposer(composer); });
  composer.querySelectorAll("[data-mk-composer-color]").forEach(function (button) {
    button.addEventListener("click", function () {
      selectMkComposerColor(composer, button.getAttribute("data-mk-composer-color") || "default");
    });
  });
  composer.addEventListener("keydown", function (event) {
    if (!event.ctrlKey || event.key !== "Enter") return;
    event.preventDefault();
    saveMkComposer(composer);
  });
}
function initializeMkActions(page) {
  page.addEventListener("click", function (event) {
    var target = event.target;
    if (!target || !target.closest) return;
    var card = target.closest("[data-mk-id]");
    if (card && target.closest("[data-mk-pin]")) { event.preventDefault(); mkSetPinned(card); return; }
    if (card && target.closest("[data-mk-delete]")) { event.preventDefault(); mkDeleteCard(card); return; }
    var colorButton = target.closest("[data-mk-bulk-color]");
    if (colorButton) { event.preventDefault(); mkBulkColor(colorButton.getAttribute("data-mk-bulk-color") || "default"); return; }
    if (target.closest("[data-mk-bulk-pin]")) { event.preventDefault(); mkBulkPin(); return; }
    if (target.closest("[data-mk-bulk-delete]")) { event.preventDefault(); mkBulkDelete(); }
  });
  page.addEventListener("change", function (event) {
    var target = event.target;
    if (target && target.matches && target.matches("[data-mk-select]")) syncMkSelection();
  });
}
function initializeMkToolbar(page) {
  var toggle = page.querySelector("[data-mk-selection-toggle]");
  if (toggle) {
    toggle.addEventListener("click", function () {
      setMkSelecting(page, page.getAttribute("data-mk-selecting") !== "true");
    });
  }
  var selectAll = page.querySelector("[data-mk-select-all]");
  if (selectAll) {
    selectAll.addEventListener("change", function () {
      mkCards().forEach(function (card) {
        var checkbox = card.querySelector("[data-mk-select]");
        if (checkbox) checkbox.checked = selectAll.checked;
      });
      syncMkSelection();
    });
  }
  var clear = page.querySelector("[data-mk-bulk-clear]");
  if (clear) clear.addEventListener("click", function () { setMkSelecting(page, false); });
  var form = page.querySelector("[data-mk-search]");
  if (form) form.addEventListener("submit", function (event) { event.preventDefault(); window.location.assign(mkSearchUrl(form)); });
}
function initializeMk() {
  var page = mkPage();
  if (!page || page.getAttribute("data-mk-initialized") === "true") return;
  page.setAttribute("data-mk-initialized", "true");
  initializeMkComposer(page);
  initializeMkActions(page);
  initializeMkToolbar(page);
  syncMkSelection();
}
document.addEventListener("DOMContentLoaded", initializeMk);
document.addEventListener("htmx:load", initializeMk);
`;

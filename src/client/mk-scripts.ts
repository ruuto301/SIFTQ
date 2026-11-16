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
function mkConfirm(message, run) {
  if (typeof window.__siftqConfirm === "function") { window.__siftqConfirm(message, run); return; }
  if (window.confirm(message)) run();
}
function mkReload() { window.location.reload(); }
function mkRun(path, init) { mkApi(path, init).then(mkReload).catch(function () {}); }
function mkComposerColor(composer) { return composer.getAttribute("data-mk-color") || "default"; }
function mkGrowComposer(composer) {
  mkAutoGrow(composer.querySelector("[data-mk-composer-body]"), MK_COMPOSER_MAX_ROWS);
}
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
  composer.__mkImages = [];
  mkRenderComposerImages(composer);
  mkShowComposerError(composer, "");
}
function mkComposerImages(composer) {
  if (!composer.__mkImages) composer.__mkImages = [];
  return composer.__mkImages;
}
function mkImageUrl(imageId) { return "/api/images/" + encodeURIComponent(imageId); }
function mkShowComposerError(composer, message) {
  var error = composer.querySelector("[data-mk-composer-error]");
  if (!error) { if (message) window.alert(message); return; }
  error.textContent = message || "";
  error.hidden = (message || "") === "";
}
function mkRenderComposerImages(composer) {
  var wrap = composer.querySelector("[data-mk-composer-images]");
  var list = composer.querySelector("[data-mk-composer-image-list]");
  if (!wrap || !list) return;
  var images = mkComposerImages(composer);
  list.textContent = "";
  images.forEach(function (image) {
    var item = document.createElement("li");
    item.className = "mk-composer__image";
    item.setAttribute("data-mk-composer-image", image.id);
    var thumb = document.createElement("img");
    thumb.className = "mk-composer__image-thumb";
    thumb.src = image.url;
    thumb.alt = "";
    thumb.loading = "lazy";
    var remove = document.createElement("button");
    remove.type = "button";
    remove.className = "mk-composer__image-remove";
    remove.setAttribute("data-mk-composer-image-remove", image.id);
    remove.setAttribute("aria-label", "画像を削除");
    remove.textContent = "×";
    item.appendChild(thumb);
    item.appendChild(remove);
    list.appendChild(item);
  });
  wrap.hidden = images.length === 0;
}
function mkImageType(file) {
  var type = file && file.type ? String(file.type).toLowerCase() : "";
  if (type === "image/png" || type === "image/webp" || type === "image/jpeg") return type;
  var name = file && file.name ? String(file.name).toLowerCase() : "";
  var extension = name.slice(name.lastIndexOf("."));
  if (extension === ".png") return "image/png";
  if (extension === ".webp") return "image/webp";
  if (extension === ".jpg" || extension === ".jpeg") return "image/jpeg";
  return "";
}
function mkIsImageFile(file) { return mkImageType(file) !== ""; }
function mkDroppedFiles(source) {
  if (!source) return [];
  var files = [];
  var items = source.items ? Array.prototype.slice.call(source.items) : [];
  items.forEach(function (item) {
    if (!item || item.kind !== "file" || typeof item.getAsFile !== "function") return;
    var file = item.getAsFile();
    if (file) files.push(file);
  });
  var direct = source.files ? Array.prototype.slice.call(source.files) : [];
  direct.forEach(function (file) { if (file && files.indexOf(file) === -1) files.push(file); });
  return files;
}
function mkHasFileDrag(source) {
  if (!source) return false;
  if (source.types && Array.prototype.indexOf.call(source.types, "Files") !== -1) return true;
  return mkDroppedFiles(source).length > 0;
}
function mkImageFiles(source) { return mkDroppedFiles(source).filter(mkIsImageFile); }
function mkEncodeImage(canvas, qualities) {
  var quality = qualities[0];
  return new Promise(function (resolve, reject) {
    canvas.toBlob(function (blob) {
      if (!blob) { reject(new Error("画像を変換できませんでした。")); return; }
      if (blob.size <= 1048576 || qualities.length <= 1) { resolve(blob); return; }
      mkEncodeImage(canvas, qualities.slice(1)).then(resolve, reject);
    }, "image/webp", quality);
  });
}
function mkPrepareImage(file) {
  return new Promise(function (resolve, reject) {
    if (!mkIsImageFile(file)) { reject(new Error("対応していない画像形式です。")); return; }
    var url = URL.createObjectURL(file);
    var image = new Image();
    image.onload = function () {
      var longest = Math.max(image.naturalWidth, image.naturalHeight) || 1;
      var scale = Math.min(1, 1600 / longest);
      var width = Math.max(1, Math.round(image.naturalWidth * scale));
      var height = Math.max(1, Math.round(image.naturalHeight * scale));
      var canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      var context = canvas.getContext("2d");
      context.drawImage(image, 0, 0, width, height);
      URL.revokeObjectURL(url);
      mkEncodeImage(canvas, [0.8, 0.6, 0.4, 0.25]).then(resolve, reject);
    };
    image.onerror = function () { URL.revokeObjectURL(url); reject(new Error("画像を読み込めませんでした。")); };
    image.src = url;
  });
}
function mkUploadErrorMessage(body) {
  var code = body && body.code ? body.code : "";
  if (code === "IMAGE_TOO_LARGE") return "画像が大きすぎます。";
  if (code === "UNSUPPORTED_IMAGE") return "対応していない画像形式です。";
  return "画像をアップロードできませんでした。";
}
function mkUploadComposerImage(composer, file) {
  if (mkComposerImages(composer).length >= 10) { mkShowComposerError(composer, "画像は10枚までです。"); return; }
  mkShowComposerError(composer, "");
  mkPrepareImage(file).then(function (blob) {
    var form = new FormData();
    form.append("file", blob, "mk-image.webp");
    return fetch("/api/images", { method: "POST", body: form });
  }).then(function (response) {
    if (response.ok) return response.json();
    return response.json().catch(function () { return {}; }).then(function (body) {
      throw new Error(mkUploadErrorMessage(body));
    });
  }).then(function (image) {
    mkComposerImages(composer).push({ id: image.id, url: image.url || mkImageUrl(image.id) });
    mkRenderComposerImages(composer);
  }).catch(function (error) {
    mkShowComposerError(composer, error && error.message ? error.message : "画像をアップロードできませんでした。");
  });
}
function mkLinkComposerImages(composer, noteId) {
  var images = mkComposerImages(composer);
  return images.reduce(function (chain, image) {
    return chain.then(function () {
      return fetch("/api/mk/notes/" + encodeURIComponent(noteId) + "/images", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ imageId: image.id }),
      }).then(function (response) {
        if (!response.ok) throw new Error("image link failed: " + response.status);
      });
    });
  }, Promise.resolve());
}
function mkRequestPreview(noteId) {
  return mkApi("/api/mk/notes/" + encodeURIComponent(noteId) + "/preview", { method: "POST" });
}
function saveMkComposer(composer) {
  var title = composer.querySelector("[data-mk-composer-title]");
  var body = composer.querySelector("[data-mk-composer-body]");
  var value = title ? title.value.trim() : "";
  if (!value) return;
  mkApi("/api/mk/notes", {
    method: "POST",
    body: JSON.stringify({ title: value, body: body ? body.value : "", color: mkComposerColor(composer) }),
  }).then(function (note) {
    return mkLinkComposerImages(composer, note.id).then(function () {
      // 本文に URL があればプレビューを先に取得する。失敗しても作成は成功として扱う。
      return mkRequestPreview(note.id).catch(function () { return null; });
    });
  }).then(function () {
    // 作成したメモが必ず見えるよう、絞り込み・検索・色の条件を外した一覧へ戻る。
    window.location.assign("/mk");
  }).catch(function () {
    mkShowComposerError(composer, "保存に失敗しました。");
  });
}
function mkRemoveComposerImage(composer, imageId) {
  composer.__mkImages = mkComposerImages(composer).filter(function (image) { return image.id !== imageId; });
  mkRenderComposerImages(composer);
}
function mkRemoveCardImage(linkId) {
  if (!linkId) return;
  mkConfirm("この画像を削除しますか？", function () {
    mkRun("/api/mk/images/" + encodeURIComponent(linkId), { method: "DELETE" });
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
function mkBulk(body) {
  if (body.ids.length === 0) return;
  mkRun("/api/mk/notes/bulk", { method: "POST", body: JSON.stringify(body) });
}
var mkSnackbarTimer = null;
function mkSnackbar() { return document.querySelector("[data-mk-snackbar]"); }
function mkHideSnackbar() {
  var bar = mkSnackbar();
  if (bar) bar.hidden = true;
  if (mkSnackbarTimer) { clearTimeout(mkSnackbarTimer); mkSnackbarTimer = null; }
}
function mkShowSnackbar(message, undo) {
  var bar = mkSnackbar();
  mkHideSnackbar();
  if (!bar) { mkReload(); return; }
  var text = bar.querySelector("[data-mk-snackbar-message]");
  if (text) text.textContent = message;
  bar.hidden = false;
  var button = bar.querySelector("[data-mk-snackbar-undo]");
  if (button) {
    button.onclick = function () {
      mkHideSnackbar();
      undo().then(mkReload).catch(function () {});
    };
  }
  mkSnackbarTimer = setTimeout(mkReload, 5000);
}
function mkBulkAction(body, undoBody, message) {
  mkApi("/api/mk/notes/bulk", { method: "POST", body: JSON.stringify(body) }).then(function () {
    mkShowSnackbar(message, function () {
      return mkApi("/api/mk/notes/bulk", { method: "POST", body: JSON.stringify(undoBody) });
    });
  }).catch(function () {});
}
function mkBulkArchive() {
  var ids = mkSelectedIds();
  if (ids.length === 0) return;
  mkBulkAction({ ids: ids, action: "archive" }, { ids: ids, action: "unarchive" }, ids.length + "件をアーカイブしました。");
}
function mkBulkTrash() {
  var ids = mkSelectedIds();
  if (ids.length === 0) return;
  mkBulkAction({ ids: ids, action: "trash" }, { ids: ids, action: "restore" }, ids.length + "件をゴミ箱へ移動しました。");
}
function mkBulkRestore() {
  var ids = mkSelectedIds();
  if (ids.length === 0) return;
  mkBulkAction({ ids: ids, action: "restore" }, { ids: ids, action: "trash" }, ids.length + "件を復元しました。");
}
function mkBulkPurge() {
  var ids = mkSelectedIds();
  if (ids.length === 0) return;
  mkConfirm("選択した" + ids.length + "件のメモを完全に削除しますか？", function () {
    mkApi("/api/mk/notes/bulk", { method: "POST", body: JSON.stringify({ ids: ids, action: "purge" }) }).then(mkReload).catch(function () {});
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
function initializeMkComposerImageInput(composer) {
  var add = composer.querySelector("[data-mk-composer-image-add]");
  var input = composer.querySelector("[data-mk-composer-file]");
  if (add && input) {
    add.addEventListener("click", function () { input.click(); });
    input.addEventListener("change", function () {
      var files = input.files ? Array.prototype.slice.call(input.files) : [];
      files.forEach(function (file) { mkUploadComposerImage(composer, file); });
      input.value = "";
    });
  }
  var editor = composer.querySelector("[data-mk-composer-editor]");
  if (editor) {
    editor.addEventListener("dragover", function (event) {
      if (!mkHasFileDrag(event.dataTransfer)) return;
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
    });
    editor.addEventListener("drop", function (event) {
      var files = mkDroppedFiles(event.dataTransfer);
      if (files.length === 0) return;
      event.preventDefault();
      var imageFiles = files.filter(mkIsImageFile);
      if (imageFiles.length === 0) { mkShowComposerError(composer, "対応していない画像形式です。"); return; }
      imageFiles.forEach(function (file) { mkUploadComposerImage(composer, file); });
    });
  }
  composer.addEventListener("click", function (event) {
    var target = event.target;
    if (!target || !target.closest) return;
    var remove = target.closest("[data-mk-composer-image-remove]");
    if (!remove) return;
    event.preventDefault();
    mkRemoveComposerImage(composer, remove.getAttribute("data-mk-composer-image-remove") || "");
  });
}
function initializeMkComposer(page) {
  var composer = page.querySelector("[data-mk-composer]");
  if (!composer || composer.getAttribute("data-mk-ready") === "true") return;
  composer.setAttribute("data-mk-ready", "true");
  var trigger = composer.querySelector("[data-mk-composer-trigger]");
  if (trigger) trigger.addEventListener("click", function () { setMkComposerOpen(composer, true); mkGrowComposer(composer); });
  var composerBody = composer.querySelector("[data-mk-composer-body]");
  if (composerBody) composerBody.addEventListener("input", function () { mkGrowComposer(composer); });
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
  initializeMkComposerImageInput(composer);
}
function initializeMkSideNew(page) {
  var button = page.querySelector("[data-mk-side-new]");
  if (!button) return;
  button.addEventListener("click", function () {
    var composer = page.querySelector("[data-mk-composer]");
    if (composer) setMkComposerOpen(composer, true);
  });
}
function initializeMkActions(page) {
  page.addEventListener("click", function (event) {
    var target = event.target;
    if (!target || !target.closest) return;
    var imageRemove = target.closest("[data-mk-image-remove]");
    if (imageRemove) {
      event.preventDefault();
      mkRemoveCardImage(imageRemove.getAttribute("data-mk-image-remove") || "");
      return;
    }
    var card = target.closest("[data-mk-id]");
    if (card && target.closest("[data-mk-pin]")) { event.preventDefault(); mkSetPinned(card); return; }
    if (card && target.closest("[data-mk-delete]")) { event.preventDefault(); mkDeleteCard(card); return; }
  });
}
function initializeMkPaste(page) {
  document.addEventListener("paste", function (event) {
    var composer = page.querySelector("[data-mk-composer]");
    if (!composer || composer.getAttribute("data-mk-composer-open") !== "true") return;
    var imageFiles = mkImageFiles(event.clipboardData);
    if (imageFiles.length === 0) return;
    event.preventDefault();
    imageFiles.forEach(function (file) { mkUploadComposerImage(composer, file); });
  });
}
var MK_SORT_KEY = "mk-sort:v1";
var MK_SAVED_KEY = "mk-saved-searches:v1";
var MK_SAVED_MAX = 20;
function mkStore(key, value) {
  try { window.localStorage.setItem(key, value); } catch (error) { return; }
}
function mkRead(key) {
  try { return window.localStorage.getItem(key); } catch (error) { return null; }
}
function mkUrlWith(params) {
  var search = params.toString();
  return search === "" ? "/mk" : "/mk?" + search;
}
function mkNavigateWith(name, value) {
  var params = new URLSearchParams(window.location.search);
  if (value === "") params.delete(name); else params.set(name, value);
  window.location.assign(mkUrlWith(params));
}
function mkCurrentSort(page) {
  var field = page.querySelector("[data-mk-sort-field]");
  var direction = page.querySelector("[data-mk-sort-direction]");
  if (field && direction) return field.value + ":" + direction.value;
  return page.getAttribute("data-mk-sort") || "updated:desc";
}
function initializeMkSort(page) {
  var field = page.querySelector("[data-mk-sort-field]");
  var direction = page.querySelector("[data-mk-sort-direction]");
  if (!field || !direction) return;
  var params = new URLSearchParams(window.location.search);
  var stored = mkRead(MK_SORT_KEY);
  if (!params.has("sort") && stored && stored !== mkCurrentSort(page)) {
    mkNavigateWith("sort", stored);
    return;
  }
  mkStore(MK_SORT_KEY, mkCurrentSort(page));
  var change = function () {
    var value = mkCurrentSort(page);
    mkStore(MK_SORT_KEY, value);
    mkNavigateWith("sort", value);
  };
  field.addEventListener("change", change);
  direction.addEventListener("change", change);
}
function mkLocalBound(value, endOfDay) {
  if (!value) return "";
  var date = new Date(value + (endOfDay ? "T23:59:59.999" : "T00:00:00.000"));
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}
function initializeMkDates(page) {
  var form = page.querySelector("[data-mk-date-form]");
  if (!form) return;
  form.addEventListener("submit", function () {
    var from = form.querySelector("[data-mk-date-from]");
    var fromValue = form.querySelector("[data-mk-date-from-value]");
    var to = form.querySelector("[data-mk-date-to]");
    var toValue = form.querySelector("[data-mk-date-to-value]");
    if (from && fromValue) fromValue.value = mkLocalBound(from.value, false);
    if (to && toValue) toValue.value = mkLocalBound(to.value, true);
  });
}
function mkSavedParse() {
  var raw = null;
  try { raw = JSON.parse(mkRead(MK_SAVED_KEY) || "[]"); } catch (error) { return []; }
  if (!Array.isArray(raw)) return [];
  return raw.filter(function (item) {
    return item && typeof item.id === "string" && typeof item.name === "string" && typeof item.search === "string";
  }).slice(0, MK_SAVED_MAX);
}
function mkSavedWrite(list) { mkStore(MK_SAVED_KEY, JSON.stringify(list.slice(0, MK_SAVED_MAX))); }
function mkSavedItem(item) {
  var row = document.createElement("li");
  row.className = "mk-saved__row";
  row.setAttribute("data-mk-saved-row", item.id);
  var link = document.createElement("a");
  link.className = "mk-saved__name";
  link.href = "/mk" + item.search;
  link.textContent = item.name;
  link.setAttribute("data-mk-saved-load", item.id);
  var rename = document.createElement("button");
  rename.type = "button";
  rename.className = "mk-saved__action";
  rename.textContent = "改名";
  rename.setAttribute("data-mk-saved-rename", item.id);
  var remove = document.createElement("button");
  remove.type = "button";
  remove.className = "mk-saved__action";
  remove.textContent = "×";
  remove.setAttribute("data-mk-saved-delete", item.id);
  remove.setAttribute("aria-label", item.name + " を削除");
  row.appendChild(link);
  row.appendChild(rename);
  row.appendChild(remove);
  return row;
}
function mkSavedRender() {
  var list = document.querySelector("[data-mk-saved-list]");
  var empty = document.querySelector("[data-mk-saved-empty]");
  if (!list) return;
  var saved = mkSavedParse();
  list.textContent = "";
  saved.forEach(function (item) { list.appendChild(mkSavedItem(item)); });
  if (empty) empty.hidden = saved.length > 0;
}
function mkSavedSave(name) {
  var saved = mkSavedParse();
  if (saved.length >= MK_SAVED_MAX) return false;
  saved.push({ id: String(Date.now()) + "-" + String(saved.length), name: name, search: window.location.search || "" });
  mkSavedWrite(saved);
  mkSavedRender();
  return true;
}
function mkSavedCurrent(list, id) {
  var found = null;
  list.forEach(function (item) { if (item.id === id) found = item; });
  return found;
}
function mkSavedRename(id) {
  var saved = mkSavedParse();
  var current = mkSavedCurrent(saved, id);
  if (!current) return;
  var name = window.prompt("検索名", current.name);
  if (!name || !name.trim()) return;
  current.name = name.trim();
  mkSavedWrite(saved);
  mkSavedRender();
}
function mkSavedDelete(id) {
  mkSavedWrite(mkSavedParse().filter(function (item) { return item.id !== id; }));
  mkSavedRender();
}
function initializeMkSaved(page) {
  var form = page.querySelector("[data-mk-saved-create]");
  var input = page.querySelector("[data-mk-saved-name]");
  if (form) {
    form.addEventListener("submit", function (event) {
      event.preventDefault();
      var name = input ? input.value.trim() : "";
      if (!name) return;
      if (!mkSavedSave(name)) { window.alert("保存した検索は" + MK_SAVED_MAX + "件までです。"); return; }
      if (input) input.value = "";
    });
  }
  page.addEventListener("click", function (event) {
    var target = event.target;
    if (!target || !target.closest) return;
    var rename = target.closest("[data-mk-saved-rename]");
    if (rename) { event.preventDefault(); mkSavedRename(rename.getAttribute("data-mk-saved-rename") || ""); return; }
    var remove = target.closest("[data-mk-saved-delete]");
    if (remove) { event.preventDefault(); mkSavedDelete(remove.getAttribute("data-mk-saved-delete") || ""); }
  });
  mkSavedRender();
}
function initializeMkPreview(page) {
  page.addEventListener("click", function (event) {
    var target = event.target;
    if (!target || !target.closest) return;
    if (!target.closest("[data-mk-preview-fetch]")) return;
    var card = target.closest("[data-mk-id]");
    var id = card ? mkCardId(card) : "";
    if (!id) return;
    event.preventDefault();
    mkRun("/api/mk/notes/" + encodeURIComponent(id) + "/preview", { method: "POST" });
  });
}
var MK_COMPOSER_MAX_ROWS = 12;
function mkAutoGrow(field, maxRows) {
  if (!field) return;
  var style = window.getComputedStyle(field);
  var line = parseFloat(style.lineHeight);
  if (!line || Number.isNaN(line)) line = parseFloat(style.fontSize) * 1.5 || 20;
  var cap = maxRows > 0 ? Math.round(line * maxRows) : 0;
  field.style.height = "auto";
  var next = field.scrollHeight;
  if (cap > 0 && next > cap) next = cap;
  field.style.height = next + "px";
  field.style.overflowY = cap > 0 && field.scrollHeight > cap ? "auto" : "hidden";
}
function mkGrowDetail(root) {
  var body = mkDetailField(root, "body");
  mkAutoGrow(body, 0);
  var scroll = mkDetailField(root, "scroll");
  if (scroll) scroll.scrollTop = scroll.scrollTop;
}
function mkDetail() { return document.querySelector("[data-mk-detail]"); }
function mkDetailField(root, name) { return root.querySelector("[data-mk-detail-" + name + "]"); }
function mkDetailCard(root) {
  var id = root.getAttribute("data-mk-note-id") || "";
  return id === "" ? null : document.querySelector('.mk-card[data-mk-id="' + id + '"]');
}
function mkDetailError(root, message) {
  var error = mkDetailField(root, "error");
  if (!error) return;
  error.textContent = message;
  error.hidden = message === "";
}
function mkDetailSetColor(root, color) {
  var dialog = mkDetailField(root, "dialog");
  if (dialog) dialog.setAttribute("data-mk-color", color);
  root.querySelectorAll("[data-mk-detail-color]").forEach(function (button) {
    button.setAttribute("aria-pressed", button.getAttribute("data-mk-detail-color") === color ? "true" : "false");
  });
}
function mkDetailRenderImages(root, card) {
  var box = mkDetailField(root, "images");
  if (!box) return;
  box.textContent = "";
  if (card === null) return;
  var raw = card.getAttribute("data-mk-images") || "[]";
  var images = [];
  try { images = JSON.parse(raw); } catch (error) { images = []; }
  images.forEach(function (image) {
    var wrap = document.createElement("span");
    wrap.className = "mk-detail__thumb";
    var img = document.createElement("img");
    img.src = image.src;
    img.alt = "";
    var remove = document.createElement("button");
    remove.type = "button";
    remove.textContent = "×";
    remove.setAttribute("aria-label", "画像を削除");
    remove.addEventListener("click", function () { mkRemoveCardImage(image.link); });
    wrap.appendChild(img);
    wrap.appendChild(remove);
    box.appendChild(wrap);
  });
}
function mkDetailApply(root, note) {
  var card = mkDetailCard(root);
  if (card !== null) {
    card.setAttribute("data-mk-title", note.title);
    card.setAttribute("data-mk-body", note.body);
    card.setAttribute("data-mk-color", note.color);
    card.setAttribute("data-mk-pinned", note.pinned ? "true" : "false");
    card.className = "mk-card mk-card--" + note.color;
    var title = card.querySelector(".mk-card__title");
    if (title) title.textContent = note.title;
    var body = card.querySelector(".mk-card__body");
    if (body) body.textContent = note.body;
  }
  mkDetailSetColor(root, note.color);
  var pin = mkDetailField(root, "pin");
  if (pin) pin.setAttribute("aria-pressed", note.pinned ? "true" : "false");
}
function mkDetailPatch(root, body) {
  var id = root.getAttribute("data-mk-note-id");
  if (!id) return null;
  return mkApi("/api/mk/notes/" + encodeURIComponent(id), { method: "PATCH", body: JSON.stringify(body) });
}
function mkDetailSave(root) {
  var title = mkDetailField(root, "title");
  var body = mkDetailField(root, "body");
  if (!title || !body) return;
  mkDetailPatch(root, { title: title.value.trim(), body: body.value })
    .then(function (note) { mkDetailError(root, ""); mkDetailApply(root, note); })
    .catch(function () { mkDetailError(root, "保存に失敗しました。"); });
}
function mkDetailOpen(card) {
  var root = mkDetail();
  if (!root) return;
  root.setAttribute("data-mk-note-id", mkCardId(card) || "");
  var title = mkDetailField(root, "title");
  var body = mkDetailField(root, "body");
  if (title) title.value = card.getAttribute("data-mk-title") || "";
  if (body) body.value = card.getAttribute("data-mk-body") || "";
  mkDetailSetColor(root, card.getAttribute("data-mk-color") || "default");
  var pin = mkDetailField(root, "pin");
  if (pin) pin.setAttribute("aria-pressed", card.getAttribute("data-mk-pinned") === "true" ? "true" : "false");
  mkDetailRenderImages(root, card);
  mkGrowDetail(root);
  mkDetailError(root, "");
  root.hidden = false;
  mkGrowDetail(root);
  if (title) title.focus();
}
function mkDetailClose() {
  var root = mkDetail();
  if (!root) return;
  root.hidden = true;
  root.removeAttribute("data-mk-note-id");
}
function mkDetailSingle(body) {
  var root = mkDetail();
  var id = root ? root.getAttribute("data-mk-note-id") : "";
  if (!id) return;
  mkBulk(Object.assign({ ids: [id] }, body));
}
function initializeMkDetail(page) {
  var root = mkDetail();
  if (!root) return;
  var timer = null;
  ["title", "body"].forEach(function (name) {
    var field = mkDetailField(root, name);
    if (!field) return;
    field.addEventListener("input", function () {
      clearTimeout(timer);
      if (name === "body") mkGrowDetail(root);
      timer = setTimeout(function () { mkDetailSave(root); }, 400);
    });
    field.addEventListener("keydown", function (event) {
      if (event.key === "Escape") { event.preventDefault(); mkDetailClose(); }
    });
  });
  var pin = mkDetailField(root, "pin");
  if (pin) {
    pin.addEventListener("click", function () {
      var next = pin.getAttribute("aria-pressed") !== "true";
      mkDetailPatch(root, { pinned: next }).then(function (note) { mkDetailApply(root, note); }).catch(function () { mkDetailError(root, "保存に失敗しました。"); });
    });
  }
  root.querySelectorAll("[data-mk-detail-color]").forEach(function (button) {
    button.addEventListener("click", function () {
      var color = button.getAttribute("data-mk-detail-color") || "default";
      mkDetailPatch(root, { color: color }).then(function (note) { mkDetailApply(root, note); }).catch(function () { mkDetailError(root, "保存に失敗しました。"); });
    });
  });
  var palette = mkDetailField(root, "palette");
  if (palette) {
    palette.addEventListener("click", function () {
      var swatches = mkDetailField(root, "swatches");
      if (swatches) swatches.hidden = !swatches.hidden;
    });
  }
  var close = mkDetailField(root, "close");
  if (close) close.addEventListener("click", mkDetailClose);
  var backdrop = root.querySelector("[data-mk-detail-backdrop]");
  if (backdrop) backdrop.addEventListener("click", mkDetailClose);
  var archive = mkDetailField(root, "archive");
  if (archive) archive.addEventListener("click", function () { mkDetailSingle({ action: "archive" }); });
  var trash = mkDetailField(root, "trash");
  if (trash) trash.addEventListener("click", function () { mkDetailSingle({ action: "trash" }); });
  var remove = mkDetailField(root, "delete");
  if (remove) {
    remove.addEventListener("click", function () {
      mkConfirm("このメモを削除しますか？", function () { mkDetailSingle({ action: "delete" }); });
    });
  }
  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && root.hidden === false) mkDetailClose();
  });
}
function initializeMkSideOpen(page) {
  page.addEventListener("click", function (event) {
    var target = event.target;
    if (!target || !target.closest) return;
    if (target.closest("button, a, input, select, summary, label")) return;
    var card = target.closest("[data-mk-open]");
    if (card) mkDetailOpen(card);
  });
}
function initializeMk() {
  var page = mkPage();
  if (!page || page.getAttribute("data-mk-initialized") === "true") return;
  page.setAttribute("data-mk-initialized", "true");
  initializeMkComposer(page);
  initializeMkSideNew(page);
  initializeMkActions(page);
  initializeMkPaste(page);
  initializeMkDetail(page);
  initializeMkSideOpen(page);
  initializeMkSort(page);
  initializeMkDates(page);
  initializeMkSaved(page);
  initializeMkPreview(page);
}
document.addEventListener("DOMContentLoaded", initializeMk);
document.addEventListener("htmx:load", initializeMk);
`;

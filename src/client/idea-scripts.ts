export const IDEA_SCRIPT = `
function ideaApi(path, init) {
  var options = Object.assign({ headers: { "content-type": "application/json" } }, init || {});
  return fetch(path, options).then(function (response) {
    if (!response.ok) throw new Error("Ideas request failed: " + response.status);
    return response.status === 204 ? null : response.json();
  });
}
function ideaPage() { return document.querySelector("[data-idea-page]"); }
function ideaCardId(card) { return card.getAttribute("data-idea-id"); }
function ideaCards() { return Array.prototype.slice.call(document.querySelectorAll("[data-idea-page] .idea-card[data-idea-id]")); }
function ideaConfirm(message, run) {
  if (typeof window.__siftqConfirm === "function") { window.__siftqConfirm(message, run); return; }
  if (window.confirm(message)) run();
}
function ideaReload() { window.location.reload(); }
function ideaRun(path, init) { ideaApi(path, init).then(ideaReload).catch(function () {}); }
function ideaComposerColor(composer) { return composer.getAttribute("data-idea-color") || "default"; }
function ideaGrowComposer(composer) {
  ideaAutoGrow(composer.querySelector("[data-idea-composer-body]"), IDEA_COMPOSER_MAX_ROWS);
}
function setIdeaComposerOpen(composer, open) {
  composer.classList.toggle("idea-composer--open", open);
  composer.setAttribute("data-idea-composer-open", open ? "true" : "false");
  var trigger = composer.querySelector("[data-idea-composer-trigger]");
  if (trigger) trigger.setAttribute("aria-expanded", open ? "true" : "false");
  var editor = composer.querySelector("[data-idea-composer-editor]");
  if (editor) editor.hidden = !open;
  if (!open) return;
  var title = composer.querySelector("[data-idea-composer-title]");
  if (title) title.focus();
}
function selectIdeaComposerColor(composer, color) {
  composer.setAttribute("data-idea-color", color);
  composer.querySelectorAll("[data-idea-composer-color]").forEach(function (button) {
    var active = button.getAttribute("data-idea-composer-color") === color;
    button.setAttribute("aria-pressed", active ? "true" : "false");
  });
}
function resetIdeaComposer(composer) {
  var title = composer.querySelector("[data-idea-composer-title]");
  var body = composer.querySelector("[data-idea-composer-body]");
  if (title) title.value = "";
  if (body) body.value = "";
  selectIdeaComposerColor(composer, "default");
  composer.__mkImages = [];
  ideaRenderComposerImages(composer);
  ideaShowComposerError(composer, "");
}
function ideaComposerImages(composer) {
  if (!composer.__mkImages) composer.__mkImages = [];
  return composer.__mkImages;
}
function ideaImageUrl(imageId) { return "/api/images/" + encodeURIComponent(imageId); }
function ideaShowComposerError(composer, message) {
  var error = composer.querySelector("[data-idea-composer-error]");
  if (!error) { if (message) window.alert(message); return; }
  error.textContent = message || "";
  error.hidden = (message || "") === "";
}
function ideaRenderComposerImages(composer) {
  var wrap = composer.querySelector("[data-idea-composer-images]");
  var list = composer.querySelector("[data-idea-composer-image-list]");
  if (!wrap || !list) return;
  var images = ideaComposerImages(composer);
  list.textContent = "";
  images.forEach(function (image) {
    var item = document.createElement("li");
    item.className = "idea-composer__image";
    item.setAttribute("data-idea-composer-image", image.id);
    var thumb = document.createElement("img");
    thumb.className = "idea-composer__image-thumb";
    thumb.src = image.url;
    thumb.alt = "";
    thumb.loading = "lazy";
    var remove = document.createElement("button");
    remove.type = "button";
    remove.className = "idea-composer__image-remove";
    remove.setAttribute("data-idea-composer-image-remove", image.id);
    remove.setAttribute("aria-label", "画像を削除");
    remove.textContent = "×";
    item.appendChild(thumb);
    item.appendChild(remove);
    list.appendChild(item);
  });
  wrap.hidden = images.length === 0;
}
function ideaImageType(file) {
  var type = file && file.type ? String(file.type).toLowerCase() : "";
  if (type === "image/png" || type === "image/webp" || type === "image/jpeg") return type;
  var name = file && file.name ? String(file.name).toLowerCase() : "";
  var extension = name.slice(name.lastIndexOf("."));
  if (extension === ".png") return "image/png";
  if (extension === ".webp") return "image/webp";
  if (extension === ".jpg" || extension === ".jpeg") return "image/jpeg";
  return "";
}
function ideaIsImageFile(file) { return ideaImageType(file) !== ""; }
function ideaDroppedFiles(source) {
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
function ideaHasFileDrag(source) {
  if (!source) return false;
  if (source.types && Array.prototype.indexOf.call(source.types, "Files") !== -1) return true;
  return ideaDroppedFiles(source).length > 0;
}
function ideaImageFiles(source) { return ideaDroppedFiles(source).filter(ideaIsImageFile); }
function ideaEncodeImage(canvas, qualities) {
  var quality = qualities[0];
  return new Promise(function (resolve, reject) {
    canvas.toBlob(function (blob) {
      if (!blob) { reject(new Error("画像を変換できませんでした。")); return; }
      if (blob.size <= 1048576 || qualities.length <= 1) { resolve(blob); return; }
      ideaEncodeImage(canvas, qualities.slice(1)).then(resolve, reject);
    }, "image/webp", quality);
  });
}
function ideaPrepareImage(file) {
  return new Promise(function (resolve, reject) {
    if (!ideaIsImageFile(file)) { reject(new Error("対応していない画像形式です。")); return; }
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
      ideaEncodeImage(canvas, [0.8, 0.6, 0.4, 0.25]).then(resolve, reject);
    };
    image.onerror = function () { URL.revokeObjectURL(url); reject(new Error("画像を読み込めませんでした。")); };
    image.src = url;
  });
}
function ideaUploadErrorMessage(body) {
  var code = body && body.code ? body.code : "";
  if (code === "IMAGE_TOO_LARGE") return "画像が大きすぎます。";
  if (code === "UNSUPPORTED_IMAGE") return "対応していない画像形式です。";
  return "画像をアップロードできませんでした。";
}
function ideaUploadComposerImage(composer, file) {
  if (ideaComposerImages(composer).length >= 10) { ideaShowComposerError(composer, "画像は10枚までです。"); return; }
  ideaShowComposerError(composer, "");
  ideaPrepareImage(file).then(function (blob) {
    var form = new FormData();
    form.append("file", blob, "idea-image.webp");
    return fetch("/api/images", { method: "POST", body: form });
  }).then(function (response) {
    if (response.ok) return response.json();
    return response.json().catch(function () { return {}; }).then(function (body) {
      throw new Error(ideaUploadErrorMessage(body));
    });
  }).then(function (image) {
    ideaComposerImages(composer).push({ id: image.id, url: image.url || ideaImageUrl(image.id) });
    ideaRenderComposerImages(composer);
  }).catch(function (error) {
    ideaShowComposerError(composer, error && error.message ? error.message : "画像をアップロードできませんでした。");
  });
}
function ideaLinkComposerImages(composer, noteId) {
  var images = ideaComposerImages(composer);
  return images.reduce(function (chain, image) {
    return chain.then(function () {
      return fetch("/api/ideas/notes/" + encodeURIComponent(noteId) + "/images", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ imageId: image.id }),
      }).then(function (response) {
        if (!response.ok) throw new Error("image link failed: " + response.status);
      });
    });
  }, Promise.resolve());
}
function ideaRequestPreview(noteId) {
  return ideaApi("/api/ideas/notes/" + encodeURIComponent(noteId) + "/preview", { method: "POST" });
}
function saveIdeaComposer(composer) {
  var title = composer.querySelector("[data-idea-composer-title]");
  var body = composer.querySelector("[data-idea-composer-body]");
  var value = title ? title.value.trim() : "";
  if (!value) return;
  ideaApi("/api/ideas/notes", {
    method: "POST",
    body: JSON.stringify({ title: value, body: body ? body.value : "", color: ideaComposerColor(composer) }),
  }).then(function (note) {
    return ideaLinkComposerImages(composer, note.id).then(function () {
      // 本文に URL があればプレビューを先に取得する。失敗しても作成は成功として扱う。
      return ideaRequestPreview(note.id).catch(function () { return null; });
    });
  }).then(function () {
    // 作成したメモが必ず見えるよう、絞り込み・検索・色の条件を外した一覧へ戻る。
    window.location.assign("/ideas");
  }).catch(function () {
    ideaShowComposerError(composer, "保存に失敗しました。");
  });
}
function ideaRemoveComposerImage(composer, imageId) {
  composer.__mkImages = ideaComposerImages(composer).filter(function (image) { return image.id !== imageId; });
  ideaRenderComposerImages(composer);
}
function ideaRemoveCardImage(linkId) {
  if (!linkId) return;
  ideaConfirm("この画像を削除しますか？", function () {
    ideaRun("/api/ideas/images/" + encodeURIComponent(linkId), { method: "DELETE" });
  });
}
function ideaSetPinned(card) {
  var id = ideaCardId(card);
  if (!id) return;
  ideaRun("/api/ideas/notes/" + encodeURIComponent(id), {
    method: "PATCH",
    body: JSON.stringify({ pinned: card.getAttribute("data-idea-pinned") !== "true" }),
  });
}
function ideaDeleteCard(card) {
  var id = ideaCardId(card);
  if (!id) return;
  ideaConfirm("このメモを削除しますか？", function () {
    ideaRun("/api/ideas/notes/" + encodeURIComponent(id), { method: "DELETE" });
  });
}
function ideaBulk(body) {
  if (body.ids.length === 0) return;
  ideaRun("/api/ideas/notes/bulk", { method: "POST", body: JSON.stringify(body) });
}
var ideaSnackbarTimer = null;
function ideaSnackbar() { return document.querySelector("[data-idea-snackbar]"); }
function ideaHideSnackbar() {
  var bar = ideaSnackbar();
  if (bar) bar.hidden = true;
  if (ideaSnackbarTimer) { clearTimeout(ideaSnackbarTimer); ideaSnackbarTimer = null; }
}
function ideaShowSnackbar(message, undo) {
  var bar = ideaSnackbar();
  ideaHideSnackbar();
  if (!bar) { ideaReload(); return; }
  var text = bar.querySelector("[data-idea-snackbar-message]");
  if (text) text.textContent = message;
  bar.hidden = false;
  var button = bar.querySelector("[data-idea-snackbar-undo]");
  if (button) {
    button.onclick = function () {
      ideaHideSnackbar();
      undo().then(ideaReload).catch(function () {});
    };
  }
  ideaSnackbarTimer = setTimeout(ideaReload, 5000);
}
function ideaBulkAction(body, undoBody, message) {
  ideaApi("/api/ideas/notes/bulk", { method: "POST", body: JSON.stringify(body) }).then(function () {
    ideaShowSnackbar(message, function () {
      return ideaApi("/api/ideas/notes/bulk", { method: "POST", body: JSON.stringify(undoBody) });
    });
  }).catch(function () {});
}
function ideaBulkArchive() {
  var ids = ideaSelectedIds();
  if (ids.length === 0) return;
  ideaBulkAction({ ids: ids, action: "archive" }, { ids: ids, action: "unarchive" }, ids.length + "件をアーカイブしました。");
}
function ideaBulkTrash() {
  var ids = ideaSelectedIds();
  if (ids.length === 0) return;
  ideaBulkAction({ ids: ids, action: "trash" }, { ids: ids, action: "restore" }, ids.length + "件をゴミ箱へ移動しました。");
}
function ideaBulkRestore() {
  var ids = ideaSelectedIds();
  if (ids.length === 0) return;
  ideaBulkAction({ ids: ids, action: "restore" }, { ids: ids, action: "trash" }, ids.length + "件を復元しました。");
}
function ideaBulkPurge() {
  var ids = ideaSelectedIds();
  if (ids.length === 0) return;
  ideaConfirm("選択した" + ids.length + "件のメモを完全に削除しますか？", function () {
    ideaApi("/api/ideas/notes/bulk", { method: "POST", body: JSON.stringify({ ids: ids, action: "purge" }) }).then(ideaReload).catch(function () {});
  });
}
function ideaSearchUrl(form) {
  var params = new URLSearchParams();
  form.querySelectorAll('input[type="hidden"]').forEach(function (hidden) {
    if (hidden.name) params.set(hidden.name, hidden.value);
  });
  var input = form.querySelector("[data-idea-search-input]");
  if (input && input.value.trim() !== "") params.set("q", input.value.trim());
  var search = params.toString();
  return search === "" ? "/ideas" : "/ideas?" + search;
}
function initializeIdeaComposerImageInput(composer) {
  var add = composer.querySelector("[data-idea-composer-image-add]");
  var input = composer.querySelector("[data-idea-composer-file]");
  if (add && input) {
    add.addEventListener("click", function () { input.click(); });
    input.addEventListener("change", function () {
      var files = input.files ? Array.prototype.slice.call(input.files) : [];
      files.forEach(function (file) { ideaUploadComposerImage(composer, file); });
      input.value = "";
    });
  }
  var editor = composer.querySelector("[data-idea-composer-editor]");
  if (editor) {
    editor.addEventListener("dragover", function (event) {
      if (!ideaHasFileDrag(event.dataTransfer)) return;
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
    });
    editor.addEventListener("drop", function (event) {
      var files = ideaDroppedFiles(event.dataTransfer);
      if (files.length === 0) return;
      event.preventDefault();
      var imageFiles = files.filter(ideaIsImageFile);
      if (imageFiles.length === 0) { ideaShowComposerError(composer, "対応していない画像形式です。"); return; }
      imageFiles.forEach(function (file) { ideaUploadComposerImage(composer, file); });
    });
  }
  composer.addEventListener("click", function (event) {
    var target = event.target;
    if (!target || !target.closest) return;
    var remove = target.closest("[data-idea-composer-image-remove]");
    if (!remove) return;
    event.preventDefault();
    ideaRemoveComposerImage(composer, remove.getAttribute("data-idea-composer-image-remove") || "");
  });
}
function initializeIdeaComposer(page) {
  var composer = page.querySelector("[data-idea-composer]");
  if (!composer || composer.getAttribute("data-idea-ready") === "true") return;
  composer.setAttribute("data-idea-ready", "true");
  var trigger = composer.querySelector("[data-idea-composer-trigger]");
  if (trigger) trigger.addEventListener("click", function () { setIdeaComposerOpen(composer, true); ideaGrowComposer(composer); });
  var composerBody = composer.querySelector("[data-idea-composer-body]");
  if (composerBody) composerBody.addEventListener("input", function () { ideaGrowComposer(composer); });
  var cancel = composer.querySelector("[data-idea-composer-cancel]");
  if (cancel) cancel.addEventListener("click", function () { resetIdeaComposer(composer); setIdeaComposerOpen(composer, false); });
  var save = composer.querySelector("[data-idea-composer-save]");
  if (save) save.addEventListener("click", function () { saveIdeaComposer(composer); });
  composer.querySelectorAll("[data-idea-composer-color]").forEach(function (button) {
    button.addEventListener("click", function () {
      selectIdeaComposerColor(composer, button.getAttribute("data-idea-composer-color") || "default");
    });
  });
  composer.addEventListener("keydown", function (event) {
    if (!event.ctrlKey || event.key !== "Enter") return;
    event.preventDefault();
    saveIdeaComposer(composer);
  });
  initializeIdeaComposerImageInput(composer);
}
function initializeIdeaSideNew(page) {
  var button = page.querySelector("[data-idea-side-new]");
  if (!button) return;
  button.addEventListener("click", function () {
    var composer = page.querySelector("[data-idea-composer]");
    if (composer) setIdeaComposerOpen(composer, true);
  });
}
function initializeIdeaActions(page) {
  page.addEventListener("click", function (event) {
    var target = event.target;
    if (!target || !target.closest) return;
    var imageRemove = target.closest("[data-idea-image-remove]");
    if (imageRemove) {
      event.preventDefault();
      ideaRemoveCardImage(imageRemove.getAttribute("data-idea-image-remove") || "");
      return;
    }
    var card = target.closest("[data-idea-id]");
    if (card && target.closest("[data-idea-pin]")) { event.preventDefault(); ideaSetPinned(card); return; }
    if (card && target.closest("[data-idea-delete]")) { event.preventDefault(); ideaDeleteCard(card); return; }
  });
}
function initializeIdeaPaste(page) {
  document.addEventListener("paste", function (event) {
    var composer = page.querySelector("[data-idea-composer]");
    if (!composer || composer.getAttribute("data-idea-composer-open") !== "true") return;
    var imageFiles = ideaImageFiles(event.clipboardData);
    if (imageFiles.length === 0) return;
    event.preventDefault();
    imageFiles.forEach(function (file) { ideaUploadComposerImage(composer, file); });
  });
}
var IDEA_SORT_KEY = "idea-sort:v1";
var IDEA_SAVED_KEY = "idea-saved-searches:v1";
var IDEA_SAVED_MAX = 20;
function ideaStore(key, value) {
  try { window.localStorage.setItem(key, value); } catch (error) { return; }
}
function ideaRead(key) {
  try { return window.localStorage.getItem(key); } catch (error) { return null; }
}
function ideaUrlWith(params) {
  var search = params.toString();
  return search === "" ? "/ideas" : "/ideas?" + search;
}
function ideaNavigateWith(name, value) {
  var params = new URLSearchParams(window.location.search);
  if (value === "") params.delete(name); else params.set(name, value);
  window.location.assign(ideaUrlWith(params));
}
function ideaCurrentSort(page) {
  var field = page.querySelector("[data-idea-sort-field]");
  var direction = page.querySelector("[data-idea-sort-direction]");
  if (field && direction) return field.value + ":" + direction.value;
  return page.getAttribute("data-idea-sort") || "updated:desc";
}
function initializeIdeaSort(page) {
  var field = page.querySelector("[data-idea-sort-field]");
  var direction = page.querySelector("[data-idea-sort-direction]");
  if (!field || !direction) return;
  var params = new URLSearchParams(window.location.search);
  var stored = ideaRead(IDEA_SORT_KEY);
  if (!params.has("sort") && stored && stored !== ideaCurrentSort(page)) {
    ideaNavigateWith("sort", stored);
    return;
  }
  ideaStore(IDEA_SORT_KEY, ideaCurrentSort(page));
  var change = function () {
    var value = ideaCurrentSort(page);
    ideaStore(IDEA_SORT_KEY, value);
    ideaNavigateWith("sort", value);
  };
  field.addEventListener("change", change);
  direction.addEventListener("change", change);
}
function ideaLocalBound(value, endOfDay) {
  if (!value) return "";
  var date = new Date(value + (endOfDay ? "T23:59:59.999" : "T00:00:00.000"));
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}
function initializeIdeaDates(page) {
  var form = page.querySelector("[data-idea-date-form]");
  if (!form) return;
  form.addEventListener("submit", function () {
    var from = form.querySelector("[data-idea-date-from]");
    var fromValue = form.querySelector("[data-idea-date-from-value]");
    var to = form.querySelector("[data-idea-date-to]");
    var toValue = form.querySelector("[data-idea-date-to-value]");
    if (from && fromValue) fromValue.value = ideaLocalBound(from.value, false);
    if (to && toValue) toValue.value = ideaLocalBound(to.value, true);
  });
}
function ideaSavedParse() {
  var raw = null;
  try { raw = JSON.parse(ideaRead(IDEA_SAVED_KEY) || "[]"); } catch (error) { return []; }
  if (!Array.isArray(raw)) return [];
  return raw.filter(function (item) {
    return item && typeof item.id === "string" && typeof item.name === "string" && typeof item.search === "string";
  }).slice(0, IDEA_SAVED_MAX);
}
function ideaSavedWrite(list) { ideaStore(IDEA_SAVED_KEY, JSON.stringify(list.slice(0, IDEA_SAVED_MAX))); }
function ideaSavedItem(item) {
  var row = document.createElement("li");
  row.className = "idea-saved__row";
  row.setAttribute("data-idea-saved-row", item.id);
  var link = document.createElement("a");
  link.className = "idea-saved__name";
  link.href = "/ideas" + item.search;
  link.textContent = item.name;
  link.setAttribute("data-idea-saved-load", item.id);
  var rename = document.createElement("button");
  rename.type = "button";
  rename.className = "idea-saved__action";
  rename.textContent = "改名";
  rename.setAttribute("data-idea-saved-rename", item.id);
  var remove = document.createElement("button");
  remove.type = "button";
  remove.className = "idea-saved__action";
  remove.textContent = "×";
  remove.setAttribute("data-idea-saved-delete", item.id);
  remove.setAttribute("aria-label", item.name + " を削除");
  row.appendChild(link);
  row.appendChild(rename);
  row.appendChild(remove);
  return row;
}
function ideaSavedRender() {
  var list = document.querySelector("[data-idea-saved-list]");
  var empty = document.querySelector("[data-idea-saved-empty]");
  if (!list) return;
  var saved = ideaSavedParse();
  list.textContent = "";
  saved.forEach(function (item) { list.appendChild(ideaSavedItem(item)); });
  if (empty) empty.hidden = saved.length > 0;
}
function ideaSavedSave(name) {
  var saved = ideaSavedParse();
  if (saved.length >= IDEA_SAVED_MAX) return false;
  saved.push({ id: String(Date.now()) + "-" + String(saved.length), name: name, search: window.location.search || "" });
  ideaSavedWrite(saved);
  ideaSavedRender();
  return true;
}
function ideaSavedCurrent(list, id) {
  var found = null;
  list.forEach(function (item) { if (item.id === id) found = item; });
  return found;
}
function ideaSavedRename(id) {
  var saved = ideaSavedParse();
  var current = ideaSavedCurrent(saved, id);
  if (!current) return;
  var name = window.prompt("検索名", current.name);
  if (!name || !name.trim()) return;
  current.name = name.trim();
  ideaSavedWrite(saved);
  ideaSavedRender();
}
function ideaSavedDelete(id) {
  ideaSavedWrite(ideaSavedParse().filter(function (item) { return item.id !== id; }));
  ideaSavedRender();
}
function initializeIdeaSaved(page) {
  var form = page.querySelector("[data-idea-saved-create]");
  var input = page.querySelector("[data-idea-saved-name]");
  if (form) {
    form.addEventListener("submit", function (event) {
      event.preventDefault();
      var name = input ? input.value.trim() : "";
      if (!name) return;
      if (!ideaSavedSave(name)) { window.alert("保存した検索は" + IDEA_SAVED_MAX + "件までです。"); return; }
      if (input) input.value = "";
    });
  }
  page.addEventListener("click", function (event) {
    var target = event.target;
    if (!target || !target.closest) return;
    var rename = target.closest("[data-idea-saved-rename]");
    if (rename) { event.preventDefault(); ideaSavedRename(rename.getAttribute("data-idea-saved-rename") || ""); return; }
    var remove = target.closest("[data-idea-saved-delete]");
    if (remove) { event.preventDefault(); ideaSavedDelete(remove.getAttribute("data-idea-saved-delete") || ""); }
  });
  ideaSavedRender();
}
function initializeIdeaPreview(page) {
  page.addEventListener("click", function (event) {
    var target = event.target;
    if (!target || !target.closest) return;
    if (!target.closest("[data-idea-preview-fetch]")) return;
    var card = target.closest("[data-idea-id]");
    var id = card ? ideaCardId(card) : "";
    if (!id) return;
    event.preventDefault();
    ideaRun("/api/ideas/notes/" + encodeURIComponent(id) + "/preview", { method: "POST" });
  });
}
var IDEA_COMPOSER_MAX_ROWS = 12;
function ideaAutoGrow(field, maxRows) {
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
function ideaGrowDetail(root) {
  var body = ideaDetailField(root, "body");
  ideaAutoGrow(body, 0);
  var scroll = ideaDetailField(root, "scroll");
  if (scroll) scroll.scrollTop = scroll.scrollTop;
}
function ideaDetail() { return document.querySelector("[data-idea-detail]"); }
function ideaDetailField(root, name) { return root.querySelector("[data-idea-detail-" + name + "]"); }
function ideaDetailCard(root) {
  var id = root.getAttribute("data-idea-note-id") || "";
  return id === "" ? null : document.querySelector('.idea-card[data-idea-id="' + id + '"]');
}
function ideaDetailError(root, message) {
  var error = ideaDetailField(root, "error");
  if (!error) return;
  error.textContent = message;
  error.hidden = message === "";
}
function ideaDetailSetColor(root, color) {
  var dialog = ideaDetailField(root, "dialog");
  if (dialog) dialog.setAttribute("data-idea-color", color);
  root.querySelectorAll("[data-idea-detail-color]").forEach(function (button) {
    button.setAttribute("aria-pressed", button.getAttribute("data-idea-detail-color") === color ? "true" : "false");
  });
}
function ideaDetailRenderImages(root, card) {
  var box = ideaDetailField(root, "images");
  if (!box) return;
  box.textContent = "";
  if (card === null) return;
  var raw = card.getAttribute("data-idea-images") || "[]";
  var images = [];
  try { images = JSON.parse(raw); } catch (error) { images = []; }
  images.forEach(function (image) {
    var wrap = document.createElement("span");
    wrap.className = "idea-detail__thumb";
    var img = document.createElement("img");
    img.src = image.src;
    img.alt = "";
    var remove = document.createElement("button");
    remove.type = "button";
    remove.textContent = "×";
    remove.setAttribute("aria-label", "画像を削除");
    remove.addEventListener("click", function () { ideaRemoveCardImage(image.link); });
    wrap.appendChild(img);
    wrap.appendChild(remove);
    box.appendChild(wrap);
  });
}
function ideaDetailApply(root, note) {
  var card = ideaDetailCard(root);
  if (card !== null) {
    card.setAttribute("data-idea-title", note.title);
    card.setAttribute("data-idea-body", note.body);
    card.setAttribute("data-idea-color", note.color);
    card.setAttribute("data-idea-pinned", note.pinned ? "true" : "false");
    card.className = "idea-card idea-card--" + note.color;
    var title = card.querySelector(".idea-card__title");
    if (title) title.textContent = note.title;
    var body = card.querySelector(".idea-card__body");
    if (body) body.textContent = note.body;
  }
  ideaDetailSetColor(root, note.color);
  var pin = ideaDetailField(root, "pin");
  if (pin) pin.setAttribute("aria-pressed", note.pinned ? "true" : "false");
}
function ideaDetailPatch(root, body) {
  var id = root.getAttribute("data-idea-note-id");
  if (!id) return null;
  return ideaApi("/api/ideas/notes/" + encodeURIComponent(id), { method: "PATCH", body: JSON.stringify(body) });
}
function ideaDetailSave(root) {
  var title = ideaDetailField(root, "title");
  var body = ideaDetailField(root, "body");
  if (!title || !body) return;
  ideaDetailPatch(root, { title: title.value.trim(), body: body.value })
    .then(function (note) { ideaDetailError(root, ""); ideaDetailApply(root, note); })
    .catch(function () { ideaDetailError(root, "保存に失敗しました。"); });
}
function ideaDetailOpen(card) {
  var root = ideaDetail();
  if (!root) return;
  root.setAttribute("data-idea-note-id", ideaCardId(card) || "");
  var title = ideaDetailField(root, "title");
  var body = ideaDetailField(root, "body");
  if (title) title.value = card.getAttribute("data-idea-title") || "";
  if (body) body.value = card.getAttribute("data-idea-body") || "";
  ideaDetailSetColor(root, card.getAttribute("data-idea-color") || "default");
  var pin = ideaDetailField(root, "pin");
  if (pin) pin.setAttribute("aria-pressed", card.getAttribute("data-idea-pinned") === "true" ? "true" : "false");
  ideaDetailRenderImages(root, card);
  ideaGrowDetail(root);
  ideaDetailError(root, "");
  root.hidden = false;
  ideaGrowDetail(root);
  if (title) title.focus();
}
function ideaDetailClose() {
  var root = ideaDetail();
  if (!root) return;
  root.hidden = true;
  root.removeAttribute("data-idea-note-id");
}
function ideaDetailSingle(body) {
  var root = ideaDetail();
  var id = root ? root.getAttribute("data-idea-note-id") : "";
  if (!id) return;
  ideaBulk(Object.assign({ ids: [id] }, body));
}
function initializeIdeaDetail(page) {
  var root = ideaDetail();
  if (!root) return;
  var timer = null;
  ["title", "body"].forEach(function (name) {
    var field = ideaDetailField(root, name);
    if (!field) return;
    field.addEventListener("input", function () {
      clearTimeout(timer);
      if (name === "body") ideaGrowDetail(root);
      timer = setTimeout(function () { ideaDetailSave(root); }, 400);
    });
    field.addEventListener("keydown", function (event) {
      if (event.key === "Escape") { event.preventDefault(); ideaDetailClose(); }
    });
  });
  var pin = ideaDetailField(root, "pin");
  if (pin) {
    pin.addEventListener("click", function () {
      var next = pin.getAttribute("aria-pressed") !== "true";
      ideaDetailPatch(root, { pinned: next }).then(function (note) { ideaDetailApply(root, note); }).catch(function () { ideaDetailError(root, "保存に失敗しました。"); });
    });
  }
  root.querySelectorAll("[data-idea-detail-color]").forEach(function (button) {
    button.addEventListener("click", function () {
      var color = button.getAttribute("data-idea-detail-color") || "default";
      ideaDetailPatch(root, { color: color }).then(function (note) { ideaDetailApply(root, note); }).catch(function () { ideaDetailError(root, "保存に失敗しました。"); });
    });
  });
  var palette = ideaDetailField(root, "palette");
  if (palette) {
    palette.addEventListener("click", function () {
      var swatches = ideaDetailField(root, "swatches");
      if (swatches) swatches.hidden = !swatches.hidden;
    });
  }
  var close = ideaDetailField(root, "close");
  if (close) close.addEventListener("click", ideaDetailClose);
  var backdrop = root.querySelector("[data-idea-detail-backdrop]");
  if (backdrop) backdrop.addEventListener("click", ideaDetailClose);
  var archive = ideaDetailField(root, "archive");
  if (archive) archive.addEventListener("click", function () { ideaDetailSingle({ action: "archive" }); });
  var trash = ideaDetailField(root, "trash");
  if (trash) trash.addEventListener("click", function () { ideaDetailSingle({ action: "trash" }); });
  var remove = ideaDetailField(root, "delete");
  if (remove) {
    remove.addEventListener("click", function () {
      ideaConfirm("このメモを削除しますか？", function () { ideaDetailSingle({ action: "delete" }); });
    });
  }
  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && root.hidden === false) ideaDetailClose();
  });
}
function initializeIdeaSideOpen(page) {
  page.addEventListener("click", function (event) {
    var target = event.target;
    if (!target || !target.closest) return;
    if (target.closest("button, a, input, select, summary, label")) return;
    var card = target.closest("[data-idea-open]");
    if (card) ideaDetailOpen(card);
  });
}
function initializeIdea() {
  var page = ideaPage();
  if (!page || page.getAttribute("data-idea-initialized") === "true") return;
  page.setAttribute("data-idea-initialized", "true");
  initializeIdeaComposer(page);
  initializeIdeaSideNew(page);
  initializeIdeaActions(page);
  initializeIdeaPaste(page);
  initializeIdeaDetail(page);
  initializeIdeaSideOpen(page);
  initializeIdeaSort(page);
  initializeIdeaDates(page);
  initializeIdeaSaved(page);
  initializeIdeaPreview(page);
}
document.addEventListener("DOMContentLoaded", initializeIdea);
document.addEventListener("htmx:load", initializeIdea);
`;

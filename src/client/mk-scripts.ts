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
function saveMkComposer(composer) {
  var title = composer.querySelector("[data-mk-composer-title]");
  var body = composer.querySelector("[data-mk-composer-body]");
  var value = title ? title.value.trim() : "";
  if (!value) return;
  mkApi("/api/mk/notes", {
    method: "POST",
    body: JSON.stringify({ title: value, body: body ? body.value : "", color: mkComposerColor(composer) }),
  }).then(function (note) {
    return mkLinkComposerImages(composer, note.id);
  }).then(mkReload).catch(function () {
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
  initializeMkComposerImageInput(composer);
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
function initializeMk() {
  var page = mkPage();
  if (!page || page.getAttribute("data-mk-initialized") === "true") return;
  page.setAttribute("data-mk-initialized", "true");
  initializeMkComposer(page);
  initializeMkActions(page);
  initializeMkToolbar(page);
  initializeMkPaste(page);
  syncMkSelection();
}
document.addEventListener("DOMContentLoaded", initializeMk);
document.addEventListener("htmx:load", initializeMk);
`;

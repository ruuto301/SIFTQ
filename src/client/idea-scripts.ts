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
  var field = composer.querySelector("[data-idea-composer-body]");
  if (!field) return;
  // Auto-grow momentarily collapses the field: keep the page and field scroll anchored.
  var savedFieldTop = field.scrollTop;
  var savedWindowY = window.scrollY;
  ideaAutoGrow(field, IDEA_COMPOSER_MAX_ROWS);
  if (field.scrollTop !== savedFieldTop) field.scrollTop = savedFieldTop;
  if (window.scrollY !== savedWindowY) window.scrollTo(0, savedWindowY);
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
  ideaComposerImages(composer).forEach(function (item) { if (item.url) URL.revokeObjectURL(item.url); });
  composer.__mkAttachments = [];
  composer.__mkInline = [];
  composer.__mkNoteId = "";
  ideaRenderComposerImages(composer);
  var retry = composer.querySelector("[data-idea-composer-retry]");
  if (retry) retry.hidden = true;
  ideaShowComposerError(composer, "");
}
function ideaComposerImages(composer) {
  if (!composer.__mkAttachments) composer.__mkAttachments = [];
  return composer.__mkAttachments;
}
function ideaShowComposerError(composer, message) {
  var error = composer.querySelector("[data-idea-composer-error]");
  if (!error) { if (message) window.alert(message); return; }
  error.textContent = message || "";
  error.hidden = (message || "") === "";
}
function ideaComposerImageNode(item) {
  var node = document.createElement("li");
  node.className = "idea-composer__image";
  node.setAttribute("data-idea-composer-image", item.key);
  node.setAttribute("data-idea-attachment-name", item.name);
  if (item.url) {
    var thumb = document.createElement("img");
    thumb.className = "idea-composer__image-thumb";
    thumb.src = item.url;
    thumb.alt = "";
    node.appendChild(thumb);
  } else {
    var icon = document.createElement("span");
    icon.className = "idea-composer__image-icon";
    icon.textContent = "📄";
    icon.setAttribute("aria-hidden", "true");
    node.appendChild(icon);
  }
  var name = document.createElement("span");
  name.className = "idea-composer__image-name";
  name.textContent = item.name;
  node.appendChild(name);
  var size = document.createElement("span");
  size.className = "idea-composer__image-size";
  size.textContent = ideaFormatBytes(item.file.size);
  node.appendChild(size);
  if (item.error) {
    var failed = document.createElement("span");
    failed.className = "idea-composer__image-error";
    failed.textContent = item.error;
    node.appendChild(failed);
  }
  var remove = document.createElement("button");
  remove.type = "button";
  remove.className = "idea-composer__image-remove";
  remove.setAttribute("data-idea-composer-image-remove", item.key);
  remove.setAttribute("aria-label", "添付を外す");
  remove.textContent = "×";
  node.appendChild(remove);
  return node;
}
function ideaRenderComposerImages(composer) {
  var wrap = composer.querySelector("[data-idea-composer-images]");
  var list = composer.querySelector("[data-idea-composer-image-list]");
  if (!wrap || !list) return;
  var images = ideaComposerImages(composer);
  list.textContent = "";
  images.forEach(function (item) { list.appendChild(ideaComposerImageNode(item)); });
  wrap.hidden = images.length === 0;
}
var IDEA_ATTACHMENT_TYPES = ["image/png", "image/webp", "image/jpeg", "image/gif", "application/pdf", "text/plain", "text/markdown", "text/csv", "application/json", "application/zip", "text/html", "image/svg+xml"];
var IDEA_ATTACHMENT_EXTENSIONS = { ".png": "image/png", ".webp": "image/webp", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".gif": "image/gif", ".pdf": "application/pdf", ".txt": "text/plain", ".md": "text/markdown", ".csv": "text/csv", ".json": "application/json", ".zip": "application/zip", ".html": "text/html", ".htm": "text/html", ".svg": "image/svg+xml" };
var IDEA_ATTACHMENT_IMAGE_MAX = 5242880;
var IDEA_ATTACHMENT_FILE_MAX = 26214400;
var IDEA_ATTACHMENT_MAX_COUNT = 10;
function ideaImageType(file) {
  var type = file && file.type ? String(file.type).toLowerCase() : "";
  if (IDEA_ATTACHMENT_TYPES.indexOf(type) !== -1) return type;
  var name = file && file.name ? String(file.name).toLowerCase() : "";
  var dot = name.lastIndexOf(".");
  return dot < 0 ? "" : (IDEA_ATTACHMENT_EXTENSIONS[name.slice(dot)] || "");
}
/** canvas で縮小できるラスタ画像だけを圧縮対象にする。GIF と SVG はそのまま送る。 */
function ideaIsImageFile(file) {
  var type = ideaImageType(file);
  return type === "image/png" || type === "image/webp" || type === "image/jpeg";
}
function ideaAttachmentKindOf(file) { return ideaImageType(file).indexOf("image/") === 0 ? "image" : "file"; }
function ideaAttachmentLimit(file) { return ideaAttachmentKindOf(file) === "image" ? IDEA_ATTACHMENT_IMAGE_MAX : IDEA_ATTACHMENT_FILE_MAX; }
function ideaFormatBytes(bytes) {
  if (bytes >= 1048576) return (bytes / 1048576).toFixed(1) + " MB";
  if (bytes >= 1024) return Math.round(bytes / 1024) + " KB";
  return bytes + " B";
}
function ideaTooLargeMessage(file) {
  var kind = ideaAttachmentKindOf(file);
  return (kind === "image" ? "画像は 5MB" : "ファイルは 25MB") + "までです（" + ideaFormatBytes(file.size) + "）。";
}
/** items と files は同じ画像でも別オブジェクトになることがある。指紋で 1 件に統合する。 */
function ideaFileFingerprint(file) {
  if (!file) return "";
  return [file.name || "", file.size || 0, file.type || "", file.lastModified || 0].join(":");
}
function ideaDroppedFiles(source) {
  if (!source) return [];
  var files = [];
  var seen = [];
  var add = function (file) {
    if (!file) return;
    var key = ideaFileFingerprint(file);
    if (seen.indexOf(key) !== -1) return;
    seen.push(key);
    files.push(file);
  };
  var items = source.items ? Array.prototype.slice.call(source.items) : [];
  items.forEach(function (item) {
    if (!item || item.kind !== "file" || typeof item.getAsFile !== "function") return;
    add(item.getAsFile());
  });
  var direct = source.files ? Array.prototype.slice.call(source.files) : [];
  direct.forEach(add);
  return files;
}
function ideaHasFileDrag(source) {
  if (!source) return false;
  if (source.types && Array.prototype.indexOf.call(source.types, "Files") !== -1) return true;
  return ideaDroppedFiles(source).length > 0;
}
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
  if (code === "ATTACHMENT_TOO_LARGE") return "ファイルが大きすぎます。";
  if (code === "UNSUPPORTED_ATTACHMENT") return "この形式は添付できません。";
  if (code === "ATTACHMENT_LIMIT_EXCEEDED") return "添付は10件までです。";
  if (code === "ATTACHMENT_TOTAL_EXCEEDED") return "添付の合計は50MBまでです。";
  if (code === "ATTACHMENTS_UNAVAILABLE") return "添付ストレージが未設定です。";
  if (code === "NOT_FOUND") return "メモが見つかりません。";
  return "添付できませんでした。";
}
/** 画像は WebP へ縮小し、それ以外はそのまま送る。 */
function ideaPrepareAttachment(file) {
  return new Promise(function (resolve, reject) {
    var type = ideaImageType(file);
    if (type === "") { reject(new Error("この形式は添付できません（" + (file.type || "不明") + "）。")); return; }
    if (file.size > ideaAttachmentLimit(file)) { reject(new Error(ideaTooLargeMessage(file))); return; }
    if (!ideaIsImageFile(file)) { resolve({ blob: file, name: file.name || "attachment", type: type }); return; }
    ideaPrepareImage(file).then(function (blob) {
      if (blob.size > IDEA_ATTACHMENT_IMAGE_MAX) { reject(new Error("画像を縮小できませんでした。")); return; }
      var dot = (file.name || "").lastIndexOf(".");
      var base = dot > 0 ? file.name.slice(0, dot) : (file.name || "image");
      resolve({ blob: blob, name: base + ".webp", type: "image/webp" });
    }, reject);
  });
}
/** XHR はアップロード進捗を出せるので、fetch ではなくこちらを使う。 */
function ideaUploadAttachment(noteId, item, onProgress) {
  return new Promise(function (resolve, reject) {
    var form = new FormData();
    form.append("file", item.blob, item.name);
    var request = new XMLHttpRequest();
    request.open("POST", "/api/ideas/notes/" + encodeURIComponent(noteId) + "/attachments");
    request.upload.onprogress = function (event) {
      if (onProgress && event.lengthComputable && event.total > 0) onProgress(event.loaded / event.total);
    };
    request.onload = function () {
      var body = null;
      try { body = JSON.parse(request.responseText); } catch (error) { body = null; }
      if (request.status >= 200 && request.status < 300 && body) { resolve(body); return; }
      reject(new Error(ideaUploadErrorMessage(body)));
    };
    request.onerror = function () { reject(new Error("通信に失敗しました。")); };
    request.send(form);
  });
}
function ideaRequestPreview(noteId) {
  return ideaApi("/api/ideas/notes/" + encodeURIComponent(noteId) + "/preview", { method: "POST" });
}
function ideaUploadComposerAttachments(composer) {
  var noteId = composer.__mkNoteId;
  if (!noteId) return Promise.reject(new Error("保存に失敗しました。"));
  return ideaComposerImages(composer).reduce(function (chain, item) {
    return chain.then(function () {
      if (item.done) return null;
      return ideaPrepareAttachment(item.file).then(function (prepared) {
        return ideaUploadAttachment(noteId, prepared, function (ratio) { item.progress = ratio; });
      }).then(function (attachment) {
        item.done = true;
        item.error = "";
        item.attachment = attachment;
        if (item.url) { URL.revokeObjectURL(item.url); item.url = ""; }
        ideaRenderComposerImages(composer);
        return null;
      }).catch(function (error) {
        item.error = error && error.message ? error.message : "添付できませんでした。";
        ideaRenderComposerImages(composer);
        throw error;
      });
    });
  }, Promise.resolve());
}
function saveIdeaComposer(composer) {
  var title = composer.querySelector("[data-idea-composer-title]");
  var body = composer.querySelector("[data-idea-composer-body]");
  var value = title ? title.value.trim() : "";
  if (!value) return;
  var retry = composer.querySelector("[data-idea-composer-retry]");
  if (retry) retry.hidden = true;
  ideaShowComposerError(composer, "");
  ideaApi("/api/ideas/notes", {
    method: "POST",
    body: JSON.stringify({ title: value, body: body ? body.value : "", color: ideaComposerColor(composer) }),
  }).then(function (note) {
    composer.__mkNoteId = note.id;
    return ideaUploadComposerInline(composer, note.id).then(function () {
      return ideaUploadComposerAttachments(composer);
    }).then(function () {
      // 本文に URL があればプレビューを先に取得する。失敗しても作成は成功として扱う。
      return ideaRequestPreview(note.id).catch(function () { return null; });
    });
  }).then(function () {
    // 作成したメモが必ず見えるよう、絞り込み・検索・色の条件を外した一覧へ戻る。
    window.location.assign("/ideas");
  }).catch(function (error) {
    ideaShowComposerError(composer, error && error.message ? error.message : "保存に失敗しました。");
    if (retry && composer.__mkNoteId) retry.hidden = false;
  });
}
/** コンポーザでは保存前にためておき、メモ作成後にまとめて R2 へ送る。 */
function ideaQueueComposerFiles(composer, files) {
  var items = ideaComposerImages(composer);
  var error = "";
  Array.prototype.slice.call(files || []).forEach(function (file) {
    var type = ideaImageType(file);
    if (type === "") { error = "この形式は添付できません（" + (file.type || "不明") + "）。"; return; }
    if (file.size > ideaAttachmentLimit(file)) { error = ideaTooLargeMessage(file); return; }
    if (items.length >= IDEA_ATTACHMENT_MAX_COUNT) { error = "添付は10件までです。"; return; }
    var preview = (file.type || "").indexOf("image/") === 0 && typeof URL !== "undefined" && URL.createObjectURL ? URL.createObjectURL(file) : "";
    items.push({ key: String(Date.now()) + "-" + String(items.length), file: file, name: file.name || "attachment", url: preview, done: false, error: "", progress: 0 });
  });
  ideaRenderComposerImages(composer);
  ideaShowComposerError(composer, error);
}
function ideaComposerInline(composer) {
  if (!composer.__mkInline) composer.__mkInline = [];
  return composer.__mkInline;
}
/** 貼り付けた画像は本文のカーソル位置へ仮トークンで入れ、メモ作成後に実 URL へ置き換える。 */
function ideaQueueComposerInlineFiles(composer, field, files) {
  var items = ideaComposerInline(composer);
  Array.prototype.slice.call(files || []).forEach(function (file) {
    if (ideaAttachmentKindOf(file) !== "image") { ideaShowComposerError(composer, "画像以外は添付欄へ追加されます。"); return; }
    if (file.size > ideaAttachmentLimit(file)) { ideaShowComposerError(composer, ideaTooLargeMessage(file)); return; }
    var token = ideaPendingToken();
    items.push({ token: token, file: file, name: file.name || "image" });
    ideaInsertText(field, token);
    ideaGrowComposer(composer);
  });
}
/** メモ作成後、本文の仮トークンを実 URL へ置き換えて保存し直す。 */
function ideaUploadComposerInline(composer, noteId) {
  var field = composer.querySelector("[data-idea-composer-body]");
  var items = ideaComposerInline(composer);
  if (items.length === 0) return Promise.resolve();
  return items.reduce(function (chain, item) {
    return chain.then(function () {
      if (item.done) return null;
      return ideaPrepareAttachment(item.file).then(function (prepared) {
        return ideaUploadAttachment(noteId, prepared, null);
      }).then(function (attachment) {
        if (field) ideaInsertReplace(field, item.token, "![](" + attachment.url + ")");
        item.done = true;
      }).catch(function (error) {
        if (field) ideaInsertReplace(field, item.token, ideaInsertErrorMessage(error));
        ideaShowComposerError(composer, "画像を挿入できませんでした。");
        item.done = true;
      });
    });
  }, Promise.resolve()).then(function () {
    if (!field) return null;
    ideaGrowComposer(composer);
    // 作成時の本文は仮トークンのままなので、置換後の本文で上書きする。
    return ideaApi("/api/ideas/notes/" + encodeURIComponent(noteId), {
      method: "PATCH",
      body: JSON.stringify({ body: field.value }),
    });
  });
}
function ideaRemoveComposerImage(composer, key) {
  composer.__mkAttachments = ideaComposerImages(composer).filter(function (item) {
    if (item.key === key && item.url) URL.revokeObjectURL(item.url);
    return item.key !== key;
  });
  ideaRenderComposerImages(composer);
}
function ideaRemoveCardImage(linkId) {
  if (!linkId) return;
  ideaConfirm("この画像を削除しますか？", function () {
    ideaRun("/api/ideas/images/" + encodeURIComponent(linkId), { method: "DELETE" });
  });
}
function ideaAttachmentItems(scope) {
  if (!scope) return null;
  return scope.querySelector("[data-idea-attachment-items], [data-idea-detail-attachment-items]");
}
function ideaAttachmentStatus(scope, message, bad) {
  var status = scope ? scope.querySelector("[data-idea-attachment-status]") : null;
  if (!status) return null;
  status.textContent = message || "";
  status.hidden = (message || "") === "";
  status.setAttribute("data-idea-attachment-status-bad", bad ? "true" : "false");
  return status;
}
function ideaAttachmentShowProgress(scope, ratio) {
  var bar = scope ? scope.querySelector("[data-idea-attachment-progress]") : null;
  if (!bar) return;
  var fill = bar.querySelector("i");
  var value = Math.max(0, Math.min(1, ratio));
  bar.hidden = value <= 0 || value >= 1;
  if (fill) fill.style.width = Math.round(value * 100) + "%";
}
function ideaAttachmentCountRefresh(scope) {
  var items = ideaAttachmentItems(scope);
  var count = scope ? scope.querySelector("[data-idea-attachment-count]") : null;
  if (!items || !count) return;
  var total = items.querySelectorAll("[data-idea-attachment-id]").length;
  count.textContent = "📎 " + total;
  count.hidden = total === 0;
}
function ideaAttachmentCard(scope) {
  if (!scope) return null;
  if (scope.hasAttribute("data-idea-detail")) return ideaDetailCard(scope);
  return scope.closest("[data-idea-id]");
}
function ideaAttachmentStored(card) {
  if (!card) return [];
  try { return JSON.parse(card.getAttribute("data-idea-attachments") || "[]"); } catch (error) { return []; }
}
function ideaAttachmentStore(card, list) {
  if (card) card.setAttribute("data-idea-attachments", JSON.stringify(list));
}
function ideaAttachmentChip(attachment) {
  var chip = document.createElement("span");
  chip.className = "idea-attachment idea-attachment--" + attachment.kind;
  chip.setAttribute("data-idea-attachment-id", attachment.id);
  chip.setAttribute("data-idea-attachment-kind", attachment.kind);
  chip.setAttribute("data-idea-attachment-preview", attachment.preview || "inline");
  chip.setAttribute("data-idea-attachment-type", attachment.content_type);
  if (attachment.kind === "image") {
    var thumb = document.createElement("img");
    thumb.className = "idea-attachment__thumb";
    thumb.src = attachment.url;
    thumb.alt = "";
    thumb.loading = "lazy";
    chip.appendChild(thumb);
  } else {
    var icon = document.createElement("span");
    icon.className = "idea-attachment__icon";
    icon.textContent = "📄";
    icon.setAttribute("aria-hidden", "true");
    chip.appendChild(icon);
  }
  var name = document.createElement("span");
  name.className = "idea-attachment__name";
  name.textContent = attachment.name;
  chip.appendChild(name);
  var size = document.createElement("span");
  size.className = "idea-attachment__size";
  size.textContent = ideaFormatBytes(attachment.bytes);
  chip.appendChild(size);
  var remove = document.createElement("button");
  remove.type = "button";
  remove.className = "idea-attachment__remove";
  remove.setAttribute("data-idea-attachment-remove", attachment.id);
  remove.setAttribute("aria-label", attachment.name + " を削除");
  remove.textContent = "×";
  chip.appendChild(remove);
  return chip;
}
/** カードへはそのまま、詳細へは元カードの JSON と一覧にも反映する。 */
function ideaAttachmentAppend(scope, attachment) {
  var items = ideaAttachmentItems(scope);
  if (!items) return;
  var detail = scope.hasAttribute("data-idea-detail");
  items.appendChild(detail ? ideaDetailAttachmentNode(attachment) : ideaAttachmentChip(attachment));
  ideaAttachmentCountRefresh(scope);
  var card = ideaAttachmentCard(scope);
  if (!card) return;
  ideaAttachmentStore(card, ideaAttachmentStored(card).concat([attachment]));
  if (card === scope) return;
  var cardItems = ideaAttachmentItems(card);
  if (cardItems) cardItems.appendChild(ideaAttachmentChip(attachment));
  ideaAttachmentCountRefresh(card);
}
function ideaAttachmentRemove(scope, id) {
  if (!id) return;
  ideaApi("/api/ideas/attachments/" + encodeURIComponent(id), { method: "DELETE" }).then(function () {
    var card = ideaAttachmentCard(scope);
    [scope, card].forEach(function (target) {
      if (!target || !ideaAttachmentItems(target)) return;
      var chip = target.querySelector('[data-idea-attachment-id="' + id + '"]');
      if (chip) chip.remove();
      if (target.hasAttribute("data-idea-attachments")) {
        ideaAttachmentStore(target, ideaAttachmentStored(target).filter(function (item) { return item.id !== id; }));
      }
      ideaAttachmentCountRefresh(target);
    });
  }).catch(function () {
    ideaAttachmentStatus(scope, "削除できませんでした。", true);
  });
}
function ideaAttachmentRetry(scope, noteId, file, error) {
  var status = ideaAttachmentStatus(scope, "", true);
  if (!status) return;
  status.textContent = (error && error.message ? error.message : "添付できませんでした。") + " ";
  var retry = document.createElement("button");
  retry.type = "button";
  retry.className = "idea-attachment__retry";
  retry.setAttribute("data-idea-attachment-retry", "");
  retry.textContent = "再試行";
  retry.addEventListener("click", function () { ideaAttachOne(scope, noteId, file); });
  status.appendChild(retry);
  status.hidden = false;
}
function ideaAttachOne(scope, noteId, file) {
  ideaAttachmentStatus(scope, "アップロード中: " + file.name, false);
  ideaAttachmentShowProgress(scope, 0.05);
  return ideaPrepareAttachment(file).then(function (prepared) {
    return ideaUploadAttachment(noteId, prepared, function (ratio) { ideaAttachmentShowProgress(scope, ratio); });
  }).then(function (attachment) {
    ideaAttachmentShowProgress(scope, 0);
    ideaAttachmentStatus(scope, attachment.kind === "image" ? "画像を添付しました。" : "添付しました。", false);
    ideaAttachmentAppend(scope, attachment);
    return null;
  }).catch(function (error) {
    ideaAttachmentShowProgress(scope, 0);
    ideaAttachmentRetry(scope, noteId, file, error);
  });
}
function ideaAttachFiles(scope, noteId, files) {
  if (!scope || !noteId) return;
  var list = Array.prototype.slice.call(files || []);
  if (list.length === 0) { ideaAttachmentStatus(scope, "ファイルを検出できませんでした。", true); return; }
  var accepted = list.filter(function (file) {
    if (ideaImageType(file) === "") {
      ideaAttachmentStatus(scope, "この形式は添付できません（" + (file.type || "不明") + "）。", true);
      return false;
    }
    if (file.size > ideaAttachmentLimit(file)) {
      ideaAttachmentStatus(scope, ideaTooLargeMessage(file), true);
      return false;
    }
    return true;
  });
  if (accepted.length === 0) return;
  accepted.reduce(function (chain, file) {
    return chain.then(function () { return ideaAttachOne(scope, noteId, file); });
  }, Promise.resolve());
}
function ideaAttachmentNoteId(zone) {
  if (!zone) return "";
  if (zone.hasAttribute("data-idea-detail")) return zone.getAttribute("data-idea-note-id") || "";
  return ideaCardId(zone) || "";
}
function ideaAttachmentDropActive(zone, active) {
  if (!zone) return;
  zone.classList.toggle("idea-card--dragover", active);
  var hint = zone.querySelector("[data-idea-attachment-drop], [data-idea-detail-drop]");
  if (hint) hint.hidden = !active;
}
function ideaBindAttachmentDropZone(zone) {
  if (!zone || zone.getAttribute("data-idea-drop-ready") === "true") return;
  zone.setAttribute("data-idea-drop-ready", "true");
  var show = function (event) {
    if (!ideaHasFileDrag(event.dataTransfer)) return;
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
    ideaAttachmentDropActive(zone, true);
  };
  zone.addEventListener("dragenter", show);
  zone.addEventListener("dragover", show);
  ["dragleave", "dragend"].forEach(function (type) {
    zone.addEventListener(type, function () { ideaAttachmentDropActive(zone, false); });
  });
  zone.addEventListener("drop", function (event) {
    var files = ideaDroppedFiles(event.dataTransfer);
    event.preventDefault();
    ideaAttachmentDropActive(zone, false);
    if (files.length > 0) ideaAttachFiles(zone, ideaAttachmentNoteId(zone), files);
  });
}
function initializeIdeaAttachmentDrops(page) {
  ideaCards().forEach(ideaBindAttachmentDropZone);
  var root = ideaDetail();
  if (root) ideaBindAttachmentDropZone(root);
}
function ideaAttachmentPreviewable(attachment) {
  return attachment && (attachment.content_type === "text/html" || attachment.content_type === "image/svg+xml");
}
/** 添付 SVG を DOM へ入れる場合の無害化。script / foreignObject / on* / 外部参照を除去する。 */
function ideaSanitizeSvg(source) {
  var doc = null;
  try { doc = new DOMParser().parseFromString(source, "image/svg+xml"); } catch (error) { return ""; }
  if (!doc || !doc.documentElement) return "";
  Array.prototype.slice.call(doc.querySelectorAll("script, foreignObject")).forEach(function (node) { node.remove(); });
  Array.prototype.slice.call(doc.querySelectorAll("*")).forEach(function (element) {
    Array.prototype.slice.call(element.attributes).forEach(function (attribute) {
      var name = attribute.name.toLowerCase();
      if (name.indexOf("on") === 0) element.removeAttribute(attribute.name);
      if ((name === "href" || name === "xlink:href") && !/^#|^data:/.test(attribute.value)) element.removeAttribute(attribute.name);
    });
  });
  try { return new XMLSerializer().serializeToString(doc.documentElement); } catch (error) { return ""; }
}
function ideaAttachmentSourceNode(attachment) {
  var pre = document.createElement("pre");
  pre.className = "idea-attachment__source";
  pre.setAttribute("data-idea-attachment-source", attachment.id);
  pre.textContent = "読み込み中…";
  fetch(attachment.url).then(function (response) {
    if (!response.ok) throw new Error("source failed");
    return response.text();
  }).then(function (text) {
    pre.textContent = attachment.content_type === "image/svg+xml" ? ideaSanitizeSvg(text) : text;
  }).catch(function () { pre.textContent = "読み込めませんでした。"; });
  return pre;
}
/** HTML は sandbox iframe、SVG は img 経由。生の内容を innerHTML へ入れることはない。 */
function ideaAttachmentView(attachment) {
  var view = document.createElement("div");
  view.className = "idea-attachment__view";
  view.setAttribute("data-idea-attachment-view", attachment.id);
  if (attachment.preview === "download") {
    var link = document.createElement("a");
    link.className = "idea-attachment__download";
    link.href = attachment.url + "?download=1";
    link.setAttribute("download", attachment.name);
    link.setAttribute("data-idea-attachment-download", attachment.id);
    link.textContent = "ダウンロード";
    view.appendChild(link);
    return view;
  }
  if (attachment.preview === "source") {
    view.appendChild(ideaAttachmentSourceNode(attachment));
    return view;
  }
  if (attachment.content_type === "text/html") {
    var frame = document.createElement("iframe");
    frame.className = "idea-attachment__frame";
    frame.setAttribute("sandbox", "");
    frame.setAttribute("src", attachment.url);
    frame.setAttribute("title", attachment.name);
    frame.setAttribute("data-idea-attachment-frame", attachment.id);
    view.appendChild(frame);
    return view;
  }
  var image = document.createElement("img");
  image.className = "idea-attachment__preview-image";
  image.src = attachment.url;
  image.alt = attachment.name;
  image.setAttribute("data-idea-attachment-preview-image", attachment.id);
  view.appendChild(image);
  return view;
}
function ideaAttachmentSetPreview(wrap, attachment) {
  var view = wrap.querySelector("[data-idea-attachment-view]");
  if (view) wrap.replaceChild(ideaAttachmentView(attachment), view);
  Array.prototype.slice.call(wrap.querySelectorAll("[data-idea-attachment-mode]")).forEach(function (button) {
    var active = button.getAttribute("data-idea-attachment-mode") === attachment.preview;
    button.setAttribute("aria-pressed", active ? "true" : "false");
    button.className = "idea-attachment__tab" + (active ? " is-active" : "");
  });
  var chip = wrap.querySelector("[data-idea-attachment-id]");
  if (chip) chip.setAttribute("data-idea-attachment-preview", attachment.preview);
}
function ideaAttachmentTabs(attachment, wrap) {
  var tabs = document.createElement("div");
  tabs.className = "idea-attachment__tabs";
  [["inline", "プレビュー"], ["source", "ソース"], ["download", "ダウンロードのみ"]].forEach(function (mode) {
    var button = document.createElement("button");
    button.type = "button";
    button.className = "idea-attachment__tab" + (attachment.preview === mode[0] ? " is-active" : "");
    button.setAttribute("data-idea-attachment-mode", mode[0]);
    button.setAttribute("aria-pressed", attachment.preview === mode[0] ? "true" : "false");
    button.textContent = mode[1];
    tabs.appendChild(button);
  });
  tabs.addEventListener("click", function (event) {
    var target = event.target;
    var button = target && target.closest ? target.closest("[data-idea-attachment-mode]") : null;
    if (!button) return;
    var preview = button.getAttribute("data-idea-attachment-mode") || "inline";
    ideaApi("/api/ideas/attachments/" + encodeURIComponent(attachment.id), {
      method: "PATCH",
      body: JSON.stringify({ preview: preview }),
    }).then(function (updated) {
      attachment.preview = updated && updated.preview ? updated.preview : preview;
      ideaAttachmentSetPreview(wrap, attachment);
      var card = ideaDetailCard(ideaDetail());
      if (card) {
        ideaAttachmentStore(card, ideaAttachmentStored(card).map(function (item) {
          return item.id === attachment.id ? attachment : item;
        }));
      }
    }).catch(function () {});
  });
  return tabs;
}
function ideaDetailAttachmentNode(attachment) {
  var wrap = document.createElement("div");
  wrap.className = "idea-detail__attachment";
  wrap.setAttribute("data-idea-detail-attachment", attachment.id);
  wrap.appendChild(ideaAttachmentChip(attachment));
  if (ideaAttachmentPreviewable(attachment)) {
    wrap.appendChild(ideaAttachmentTabs(attachment, wrap));
    wrap.appendChild(ideaAttachmentView(attachment));
  }
  return wrap;
}
function ideaDetailRenderAttachments(root, card) {
  var box = root.querySelector("[data-idea-detail-attachment-items]");
  if (!box) return;
  box.textContent = "";
  if (card === null) return;
  ideaAttachmentStored(card).forEach(function (attachment) {
    box.appendChild(ideaDetailAttachmentNode(attachment));
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
function ideaBulk(body) {
  if (body.ids.length === 0) return;
  ideaRun("/api/ideas/notes/bulk", { method: "POST", body: JSON.stringify(body) });
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
      ideaQueueComposerFiles(composer, files);
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
      ideaQueueComposerFiles(composer, files);
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
  var retry = composer.querySelector("[data-idea-composer-retry]");
  if (retry) {
    retry.addEventListener("click", function () {
      retry.hidden = true;
      ideaShowComposerError(composer, "");
      ideaUploadComposerInline(composer, composer.__mkNoteId).then(function () {
        return ideaUploadComposerAttachments(composer);
      }).then(function () {
        window.location.assign("/ideas");
      }).catch(function (error) {
        ideaShowComposerError(composer, error && error.message ? error.message : "添付できませんでした。");
        retry.hidden = false;
      });
    });
  }
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
    var attachmentRemove = target.closest("[data-idea-attachment-remove]");
    if (attachmentRemove) {
      event.preventDefault();
      var scope = attachmentRemove.closest("[data-idea-detail]") || attachmentRemove.closest("[data-idea-id]");
      ideaAttachmentRemove(scope, attachmentRemove.getAttribute("data-idea-attachment-remove") || "");
      return;
    }
    var imageRemove = target.closest("[data-idea-image-remove]");
    if (imageRemove) {
      event.preventDefault();
      ideaRemoveCardImage(imageRemove.getAttribute("data-idea-image-remove") || "");
      return;
    }
    var card = target.closest("[data-idea-id]");
    if (card && target.closest("[data-idea-pin]")) { event.preventDefault(); ideaSetPinned(card); return; }
  });
}
var IDEA_PENDING_PREFIX = "pending-";
var ideaPasteSequence = 0;
/** アップロード完了まで本文に置く仮トークン。 */
function ideaPendingToken() {
  ideaPasteSequence += 1;
  return "![](" + IDEA_PENDING_PREFIX + String(Date.now()) + "-" + String(ideaPasteSequence) + ")";
}
function ideaInsertErrorMessage(error) {
  return "（画像を挿入できませんでした: " + (error && error.message ? error.message : "不明") + "）";
}
/** execCommand は Ctrl+Z で戻せる挿入になる。使えない環境では setRangeText へ落とす。 */
/** WYSIWYG 本文の値（画像はトークン文字列）を共通スクリプトから取る。 */
function ideaEditorText(editor) {
  if (typeof descriptionEditorValue === "function") return descriptionEditorValue(editor);
  return editor.innerText.replace(/\\n$/, "");
}
/** 改行を保ったテキストノードを作る（Markdown の整形はしない）。 */
function ideaBodyTextNode(text) {
  var fragment = document.createDocumentFragment();
  var lines = String(text).split("\\n");
  lines.forEach(function (line, index) {
    if (index > 0) fragment.appendChild(document.createElement("br"));
    if (line !== "") fragment.appendChild(document.createTextNode(line));
  });
  return fragment;
}
/** 画像トークンの直前にある Markdown の前置き（感嘆符・角括弧・丸括弧）を落とす。 */
function ideaBodyStripImagePrefix(text) {
  var trimmed = text.replace(/\\s+$/, "");
  if (trimmed.charAt(trimmed.length - 1) !== "(") return text;
  var open = trimmed.lastIndexOf("![");
  if (open < 0) return text;
  if (trimmed.charAt(open + 2) !== "]") return text;
  return text.slice(0, open) + text.slice(trimmed.length);
}
var IDEA_BODY_IMAGE_SRC = /\\/api\\/(?:images|attachments)\\/[0-9A-Za-z_-]+/g;
/**
 * 本文を本文エディタへ描画する。テキストは素のまま、画像トークンだけ <img> にする
 * （Markdown の見出し・強調・リンク化はしない）。
 */
function ideaEditorRender(editor, text) {
  if (!editor) return Promise.resolve();
  var value = text === undefined || text === null ? "" : String(text);
  var fragment = document.createDocumentFragment();
  var pattern = new RegExp(IDEA_BODY_IMAGE_SRC.source, "g");
  var last = 0;
  var match = pattern.exec(value);
  while (match !== null) {
    fragment.appendChild(ideaBodyTextNode(ideaBodyStripImagePrefix(value.slice(last, match.index))));
    var src = match[0];
    var image = document.createElement("img");
    image.setAttribute("src", src);
    image.setAttribute("alt", "");
    image.setAttribute("data-token", "![](" + src + ")");
    fragment.appendChild(image);
    last = match.index + src.length;
    if (value.charAt(last) === ")") last += 1;
    match = pattern.exec(value);
  }
  fragment.appendChild(ideaBodyTextNode(value.slice(last)));
  editor.innerHTML = "";
  editor.appendChild(fragment);
  if (typeof syncDescriptionEditor === "function") syncDescriptionEditor(editor);
  return Promise.resolve();
}
function ideaInsertText(field, text) {
  if (field && field.isContentEditable) {
    var before = field.textContent || "";
    field.focus();
    var selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || !field.contains(selection.anchorNode)) {
      var range = document.createRange();
      range.selectNodeContents(field);
      range.collapse(false);
      if (selection) { selection.removeAllRanges(); selection.addRange(range); }
    }
    var typed = false;
    try { typed = document.execCommand("insertText", false, text); } catch (error) { typed = false; }
    // execCommand は選択が無いと true を返しつつ何も入れないことがあるため、結果で判定する。
    if (!typed || (field.textContent || "") === before) {
      var current = window.getSelection();
      var live = current && current.rangeCount > 0 ? current.getRangeAt(0) : null;
      if (live && field.contains(live.startContainer)) {
        live.deleteContents();
        live.insertNode(document.createTextNode(text));
      } else {
        field.appendChild(document.createTextNode(text));
      }
    }
    if (typeof syncDescriptionEditor === "function") syncDescriptionEditor(field);
    return;
  }
  if (!field) return;
  var before = field.value;
  var start = typeof field.selectionStart === "number" ? field.selectionStart : before.length;
  var end = typeof field.selectionEnd === "number" ? field.selectionEnd : start;
  field.focus();
  if (field.selectionStart !== start || field.selectionEnd !== end) field.setSelectionRange(start, end);
  var inserted = false;
  try { inserted = document.execCommand("insertText", false, text); } catch (error) { inserted = false; }
  if (!inserted || field.value === before) field.setRangeText(text, start, end, "end");
}
/** 仮トークンを実 URL へ置き換える。置換は undo の対象外でよく、キャレットは画像トークンの直後へ置く。 */
function ideaInsertReplace(field, token, replacement) {
  if (!field) return false;
  if (field.isContentEditable) {
    var text = ideaEditorText(field);
    if (text.indexOf(token) < 0) return false;
    var next = text.split(token).join(replacement);
    return ideaEditorRender(field, next).then(function () {
      if (typeof syncDescriptionEditor === "function") syncDescriptionEditor(field);
      return true;
    });
  }
  var index = field.value.indexOf(token);
  if (index < 0) return false;
  var caret = typeof field.selectionStart === "number" ? field.selectionStart : index;
  field.setRangeText(replacement, index, index + token.length, "preserve");
  var next = caret;
  if (caret >= index + token.length) next = caret + replacement.length - token.length;
  else if (caret > index) next = index + replacement.length;
  field.setSelectionRange(next, next);
  return true;
}
/** 貼り付け先が本文 textarea のときだけ、その本文欄と所属（composer / detail）を返す。 */
function ideaPasteField(event) {
  var target = event.target;
  if (!target || !target.closest) return null;
  if (target.closest("[data-idea-body-editor]")) {
    var editorRoot = target.closest("[data-idea-body-editor]");
    var composerRoot = editorRoot.closest("[data-idea-composer]");
    if (composerRoot) return { field: editorRoot, composer: composerRoot, detail: null };
    var detailRoot = editorRoot.closest("[data-idea-detail]");
    if (!detailRoot || detailRoot.hidden !== false) return null;
    return { field: editorRoot, composer: null, detail: detailRoot };
  }
  if (target.closest("[data-idea-composer-body]")) {
    var composer = target.closest("[data-idea-composer]");
    return composer ? { field: target, composer: composer, detail: null } : null;
  }
  if (target.closest("[data-idea-detail-body]")) {
    var root = target.closest("[data-idea-detail]");
    if (!root || root.hidden !== false) return null;
    return { field: target, composer: null, detail: root };
  }
  return null;
}
function ideaPasteIsImage(file) { return ideaAttachmentKindOf(file) === "image"; }
/** 詳細ダイアログは note があるので即アップロードし、完了後に仮トークンを実 URL へ置き換える。 */
function ideaPasteDetailImages(root, field, images) {
  var noteId = ideaAttachmentNoteId(root);
  images.forEach(function (file) {
    var token = ideaPendingToken();
    ideaInsertText(field, token);
    ideaGrowDetail(root);
    ideaPrepareAttachment(file).then(function (prepared) {
      return ideaUploadAttachment(noteId, prepared, null);
    }).then(function (attachment) {
      return Promise.resolve(ideaInsertReplace(field, token, "![](" + attachment.url + ")")).then(function () {
        ideaGrowDetail(root);
        ideaDetailSave(root);
      });
    }).catch(function (error) {
      // 失敗した仮トークンだけをエラー文言へ置き換え、本文の他の部分はそのまま残す。
      ideaInsertReplace(field, token, ideaInsertErrorMessage(error));
      ideaGrowDetail(root);
      ideaDetailSave(root);
      ideaDetailError(root, "画像を挿入できませんでした。");
    });
  });
}
/** 本文へ画像を挿入できたら true。 */
function ideaPasteIntoBody(target, images) {
  if (target.composer) { ideaQueueComposerInlineFiles(target.composer, target.field, images); return true; }
  if (!target.detail || ideaAttachmentNoteId(target.detail) === "") return false;
  ideaPasteDetailImages(target.detail, target.field, images);
  return true;
}
/** 画像以外のファイルと、本文以外への貼り付けは従来どおり添付欄へ入れる。 */
function ideaPasteAttachments(page, files) {
  if (files.length === 0) return false;
  var composer = page.querySelector("[data-idea-composer]");
  if (composer && composer.getAttribute("data-idea-composer-open") === "true") {
    ideaQueueComposerFiles(composer, files);
    return true;
  }
  var root = ideaDetail();
  if (root && root.hidden === false) {
    ideaAttachFiles(root, ideaAttachmentNoteId(root), files);
    return true;
  }
  var active = document.activeElement;
  var card = active && active.closest ? active.closest("[data-idea-id]") : null;
  if (!card) return false;
  ideaAttachFiles(card, ideaCardId(card) || "", files);
  return true;
}
function initializeIdeaPaste(page) {
  document.addEventListener("paste", function (event) {
    var files = ideaDroppedFiles(event.clipboardData);
    if (files.length === 0) return;
    var images = files.filter(ideaPasteIsImage);
    var others = files.filter(function (file) { return !ideaPasteIsImage(file); });
    var target = ideaPasteField(event);
    // 画像の貼り付けは本文のカーソル位置へ入れる。画像以外は添付欄へ回す。
    if (target && images.length > 0 && ideaPasteIntoBody(target, images)) {
      event.preventDefault();
      ideaPasteAttachments(page, others);
      return;
    }
    if (!ideaPasteAttachments(page, files)) return;
    event.preventDefault();
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
  if (!body) return;
  var scroll = ideaDetailField(root, "scroll");
  // Auto-grow momentarily collapses the textarea: keep the dialog scroll anchored.
  var savedScrollTop = scroll ? scroll.scrollTop : 0;
  ideaAutoGrow(body, 0);
  if (scroll && scroll.scrollTop !== savedScrollTop) scroll.scrollTop = savedScrollTop;
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
// サーバ側 splitDescription と同じ区切りで、自動保存後のカード本文も描き直す。
var IDEA_BODY_PATTERN = /!\\[\\]\\(\\s*(\\/api\\/(?:images|attachments)\\/[0-9A-Za-z_-]+)\\s*\\)|\\/api\\/(?:images|attachments)\\/[0-9A-Za-z_-]+|https?:\\/\\/[^\\s<>]+/g;
var IDEA_BODY_TRAILING = ".,!?;:";
function ideaBodyImagePath(value) {
  return value.indexOf("/api/images/") === 0 || value.indexOf("/api/attachments/") === 0;
}
function ideaBodyBoundary(character) {
  return character === undefined || character === "" || /[\\s<>]/.test(character);
}
function ideaBodyDisplayUrl(url) {
  try { return decodeURI(url); } catch (error) { return url; }
}
function ideaBodySegments(body) {
  var text = body || "";
  var segments = [];
  var cursor = 0;
  var match;
  IDEA_BODY_PATTERN.lastIndex = 0;
  while ((match = IDEA_BODY_PATTERN.exec(text)) !== null) {
    var matched = match[0];
    var start = match.index;
    if (start > cursor) segments.push({ text: text.slice(cursor, start) });
    var image = match[1] || (ideaBodyImagePath(matched) ? matched : "");
    if (image !== "") {
      segments.push({ text: image, src: image });
      cursor = start + matched.length;
      continue;
    }
    var end = start + matched.length;
    while (!ideaBodyBoundary(text.charAt(end))) end += 1;
    var rawUrl = text.slice(start, end);
    var url = rawUrl;
    while (url.length > 0 && IDEA_BODY_TRAILING.indexOf(url.charAt(url.length - 1)) !== -1) url = url.slice(0, -1);
    if (url === "") {
      segments.push({ text: rawUrl });
    } else {
      segments.push({ text: ideaBodyDisplayUrl(url), href: url });
      if (url.length < rawUrl.length) segments.push({ text: rawUrl.slice(url.length) });
    }
    cursor = start + rawUrl.length;
  }
  if (cursor < text.length) segments.push({ text: text.slice(cursor) });
  return segments;
}
function ideaCardBodyNode(body) {
  var node = document.createElement("p");
  node.className = "idea-card__body";
  ideaBodySegments(body).forEach(function (segment) {
    if (segment.src) {
      var image = document.createElement("img");
      image.className = "idea-card__image";
      image.src = segment.src;
      image.alt = "";
      image.loading = "lazy";
      image.decoding = "async";
      node.appendChild(image);
      return;
    }
    if (segment.href) {
      var link = document.createElement("a");
      link.className = "idea-card__link";
      link.href = segment.href;
      link.target = "_blank";
      link.rel = "noopener noreferrer nofollow";
      link.textContent = segment.text;
      node.appendChild(link);
      return;
    }
    node.appendChild(document.createTextNode(segment.text));
  });
  return node;
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
    if (body) card.replaceChild(ideaCardBodyNode(note.body), body);
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
function ideaPreviewUrl(text) {
  var match = /https?:\\/\\/[^\\s<>"')]+/.exec(text || "");
  return match ? match[0] : null;
}
function ideaCardPreviewNode(note) {
  if (!note || (!note.preview_title && !note.preview_image && !note.preview_description)) return null;
  var wrap = document.createElement("div");
  wrap.className = "idea-card__preview";
  wrap.setAttribute("data-idea-preview", "");
  if (note.preview_image) {
    var image = document.createElement("img");
    image.className = "idea-card__preview-image";
    image.src = note.preview_image;
    image.alt = "";
    wrap.appendChild(image);
  }
  var text = document.createElement("div");
  text.className = "idea-card__preview-text";
  if (note.preview_title) {
    var title = document.createElement("p");
    title.className = "idea-card__preview-title";
    title.textContent = note.preview_title;
    text.appendChild(title);
  }
  if (note.preview_description) {
    var description = document.createElement("p");
    description.className = "idea-card__preview-description";
    description.textContent = note.preview_description;
    text.appendChild(description);
  }
  wrap.appendChild(text);
  return wrap;
}
// 詳細を開いたときにプレビューが無ければ、本文の URL から自動で取得する。
function ideaDetailFetchPreview(card) {
  if (!card || card.querySelector("[data-idea-preview]")) return;
  var id = ideaCardId(card);
  if (!id) return;
  if (ideaPreviewUrl(card.getAttribute("data-idea-body") || "") === null) return;
  ideaApi("/api/ideas/notes/" + encodeURIComponent(id) + "/preview", { method: "POST" }).then(function (note) {
    var next = ideaCardPreviewNode(note);
    if (next === null) return;
    var previous = card.querySelector(".idea-card__preview, .idea-card__plain-link");
    if (previous) card.replaceChild(next, previous);
    else card.appendChild(next);
  }).catch(function () {});
}
function ideaDetailOpen(card) {
  var root = ideaDetail();
  if (!root) return;
  root.setAttribute("data-idea-note-id", ideaCardId(card) || "");
  var title = ideaDetailField(root, "title");
  var body = ideaDetailField(root, "body");
  if (title) title.value = card.getAttribute("data-idea-title") || "";
  if (body) body.value = card.getAttribute("data-idea-body") || "";
  var detailEditor = root.querySelector("[data-idea-body-editor]");
  if (detailEditor) ideaEditorRender(detailEditor, card.getAttribute("data-idea-body") || "");
  ideaDetailSetColor(root, card.getAttribute("data-idea-color") || "default");
  var pin = ideaDetailField(root, "pin");
  if (pin) pin.setAttribute("aria-pressed", card.getAttribute("data-idea-pinned") === "true" ? "true" : "false");
  ideaDetailRenderImages(root, card);
  ideaDetailRenderAttachments(root, card);
  ideaGrowDetail(root);
  ideaDetailError(root, "");
  root.hidden = false;
  ideaGrowDetail(root);
  ideaDetailFetchPreview(card);
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
    var field = name === "body" ? root.querySelector("[data-idea-body-editor]") : ideaDetailField(root, name);
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
  initializeIdeaAttachmentDrops(page);
  initializeIdeaSort(page);
  initializeIdeaDates(page);
  initializeIdeaSaved(page);
}
document.addEventListener("DOMContentLoaded", initializeIdea);
document.addEventListener("htmx:load", initializeIdea);
`;

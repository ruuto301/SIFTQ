/** DS settings client: renders the profile's settings namespaces over the transport. */
export const DS_SETTINGS_SCRIPT = `(function () {
  var bridge = window.__dsBridge;
  if (!bridge) return;
  var pane = document.getElementById("ds-settings");
  if (!pane) return;

  var nsBox = document.getElementById("ds-settings-ns");
  var title = document.getElementById("ds-settings-title");
  var status = document.getElementById("ds-settings-status");
  var saveButton = document.getElementById("ds-settings-save");
  var formBox = document.getElementById("ds-settings-form");
  var jsonBox = document.getElementById("ds-settings-json");
  var writable = false;
  var forms = [];
  var current = null;
  var providerId = null;
  var providerDraft = {};

  function setStatus(text, tone) {
    if (!status) return;
    status.textContent = text || "";
    status.style.color = tone === "error" ? "#c62828" : tone === "ok" ? "#2e7d32" : "#666";
  }
  function clear(node) { while (node && node.firstChild) node.removeChild(node.firstChild); }
  function field(label, value, onInput) {
    var wrap = document.createElement("label");
    wrap.className = "ds-settings__field";
    var span = document.createElement("span");
    span.textContent = label;
    var input = document.createElement("input");
    input.type = "text";
    input.value = value === undefined || value === null ? "" : String(value);
    input.addEventListener("input", function () { onInput(input.value); });
    wrap.appendChild(span);
    wrap.appendChild(input);
    return wrap;
  }

  function renderNamespaceList() {
    clear(nsBox);
    forms.forEach(function (form) {
      var button = document.createElement("button");
      button.type = "button";
      button.className = "ds-settings__ns-item" + (current && current.ns === form.ns ? " active" : "");
      button.textContent = form.ns;
      button.addEventListener("click", function () {
        current = form;
        providerId = null;
        providerDraft = {};
        render();
      });
      nsBox.appendChild(button);
    });
  }

  function providerNames() {
    var value = current && current.value ? current.value : {};
    var providers = value.providers && typeof value.providers === "object" ? value.providers : {};
    return Object.keys(providers);
  }

  function baseProvider() {
    var value = current && current.value ? current.value : {};
    var providers = value.providers && typeof value.providers === "object" ? value.providers : {};
    if (providerId && providers[providerId]) return providers[providerId];
    return {};
  }

  function renderProviderEditor() {
    var names = providerNames();
    if (providerId === null && names.length > 0) providerId = names[0];
    var draft = providerDraft;
    if (Object.keys(draft).length === 0 && providerId !== null) {
      draft = JSON.parse(JSON.stringify(baseProvider()));
      providerDraft = draft;
    }

    var bar = document.createElement("div");
    bar.className = "ds-settings__bar";
    var select = document.createElement("select");
    names.forEach(function (name) {
      var option = document.createElement("option");
      option.value = name;
      option.textContent = name;
      if (name === providerId) option.selected = true;
      select.appendChild(option);
    });
    select.addEventListener("change", function () {
      providerId = select.value;
      providerDraft = JSON.parse(JSON.stringify(baseProvider()));
      render();
    });
    bar.appendChild(select);

    var addButton = document.createElement("button");
    addButton.type = "button";
    addButton.className = "button";
    addButton.textContent = "プロバイダ追加";
    addButton.addEventListener("click", function () {
      var name = window.prompt("プロバイダ ID（例: commandcode）");
      if (!name) return;
      providerId = name.trim();
      providerDraft = {};
      render();
    });
    bar.appendChild(addButton);

    var removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.className = "button";
    removeButton.textContent = "削除";
    removeButton.addEventListener("click", function () {
      if (providerId === null) return;
      bridge.send("settings.mutate", {
        ns: current.ns,
        revision: current.revision,
        ops: [{ op: "unset", path: ["providers", providerId] }],
      });
      setStatus("削除を送信しました（再起動で反映）", "ok");
    });
    bar.appendChild(removeButton);
    formBox.appendChild(bar);

    var grid = document.createElement("div");
    grid.className = "ds-settings__grid";
    grid.appendChild(field("displayName", draft.displayName, function (v) { draft.displayName = v; }));
    grid.appendChild(field("baseURL", draft.baseURL, function (v) { draft.baseURL = v; }));
    grid.appendChild(field("api", draft.api, function (v) { draft.api = v; }));
    grid.appendChild(field("apiKeyEnv", draft.apiKeyEnv, function (v) { draft.apiKeyEnv = v; }));
    formBox.appendChild(grid);

    var imageRow = document.createElement("label");
    imageRow.className = "ds-settings__check";
    var imageInput = document.createElement("input");
    imageInput.type = "checkbox";
    var declared = Array.isArray(draft.defaultInput) ? draft.defaultInput : ["text"];
    imageInput.checked = declared.indexOf("image") >= 0;
    imageInput.addEventListener("change", function () {
      draft.defaultInput = imageInput.checked ? ["text", "image"] : ["text"];
    });
    var imageLabel = document.createElement("span");
    imageLabel.textContent = "画像入力を受け付ける（defaultInput に image を追加）";
    imageRow.appendChild(imageInput);
    imageRow.appendChild(imageLabel);
    formBox.appendChild(imageRow);

    var keyBar = document.createElement("div");
    keyBar.className = "ds-settings__key";
    var keyLabel = document.createElement("span");
    keyLabel.className = "ds-settings__key-label";
    var ref = draft.apiKeyEnv || "API_KEY";
    keyLabel.textContent = "API キー（" + ref + "）";
    keyBar.appendChild(keyLabel);
    var keyInput = document.createElement("input");
    keyInput.type = "password";
    keyInput.placeholder = "値を入力して保存";
    keyBar.appendChild(keyInput);
    var keySave = document.createElement("button");
    keySave.type = "button";
    keySave.className = "button";
    keySave.textContent = "キー保存";
    keySave.addEventListener("click", function () {
      if (keyInput.value === "") return;
      bridge.send("credentials.set", { ref: ref, value: keyInput.value });
      keyInput.value = "";
    });
    keyBar.appendChild(keySave);
    var keyClear = document.createElement("button");
    keyClear.type = "button";
    keyClear.className = "button";
    keyClear.textContent = "キー削除";
    keyClear.addEventListener("click", function () { bridge.send("credentials.unset", { ref: ref }); });
    keyBar.appendChild(keyClear);
    var keyState = document.createElement("span");
    keyState.className = "ds-settings__key-state";
    keyState.id = "ds-settings-key-state";
    keyState.textContent = "状態を確認中…";
    keyBar.appendChild(keyState);
    formBox.appendChild(keyBar);
    bridge.send("credentials.describe", { ref: ref });

    var models = Array.isArray(draft.models) ? draft.models : [];
    var table = document.createElement("div");
    table.className = "ds-settings__models";
    var head = document.createElement("div");
    head.className = "ds-settings__models-head";
    head.textContent = "モデル（" + models.length + " 件）";
    table.appendChild(head);
    models.forEach(function (model, index) {
      var row = document.createElement("div");
      row.className = "ds-settings__model-row";
      row.appendChild(field("id", model.id, function (v) { models[index].id = v; }));
      row.appendChild(field("name", model.name, function (v) { models[index].name = v; }));
      row.appendChild(field("contextWindow", model.contextWindow, function (v) { models[index].contextWindow = Number(v) || 0; }));
      var remove = document.createElement("button");
      remove.type = "button";
      remove.className = "button";
      remove.textContent = "削除";
      remove.addEventListener("click", function () {
        models.splice(index, 1);
        draft.models = models;
        render();
      });
      row.appendChild(remove);
      table.appendChild(row);
    });
    var addModel = document.createElement("button");
    addModel.type = "button";
    addModel.className = "button";
    addModel.textContent = "モデル追加";
    addModel.addEventListener("click", function () {
      models.push({ id: "", name: "", contextWindow: 128000 });
      draft.models = models;
      render();
    });
    table.appendChild(addModel);
    formBox.appendChild(table);
  }

  function renderJsonEditor() {
    var note = document.createElement("div");
    note.className = "ds-settings__note";
    note.textContent = current.ns === "llm-pi-ai"
      ? ""
      : "この名前空間は JSON で編集します（トップレベルの変更のみ保存されます）。";
    if (note.textContent !== "") formBox.appendChild(note);
    var value = current.user !== null && current.user !== undefined ? current.user : current.value;
    jsonBox.hidden = false;
    jsonBox.value = JSON.stringify(value, null, 2);
  }

  function render() {
    renderNamespaceList();
    clear(formBox);
    if (jsonBox) { jsonBox.hidden = true; jsonBox.value = ""; }
    if (!current) return;
    title.textContent = current.ns + "（revision " + current.revision + "）";
    if (current.ns === "llm-pi-ai") {
      renderProviderEditor();
    } else {
      renderJsonEditor();
    }
    if (saveButton) saveButton.disabled = !writable;
  }

  function onEvent(message) {
    if (message.kind === "evt") return;
    if (message.kind === "err") {
      if (message.method === "settings.mutate") {
        setStatus(message.payload.code === "conflict" ? "競合しました。再読み込みしてください" : "保存に失敗: " + message.payload.message, "error");
      } else if (message.method === "credentials.set" || message.method === "credentials.unset") {
        setStatus("キー操作に失敗: " + message.payload.message, "error");
      }
      return;
    }
    if (message.method === "settings.describe") {
      writable = message.payload.writable === true;
      forms = message.payload.forms || [];
      if (current === null) {
        current = forms.find(function (f) { return f.ns === "llm-pi-ai"; }) || forms[0] || null;
      } else {
        var refreshed = forms.find(function (f) { return f.ns === current.ns; });
        if (refreshed) current = refreshed;
      }
      render();
      if (!writable) setStatus("このプロファイルは設定を書き換えできません");
      return;
    }
    if (message.method === "settings.mutate") {
      setStatus("保存しました（反映には transport の再起動が必要です）", "ok");
      bridge.send("settings.describe", {});
      return;
    }
    if (message.method === "credentials.describe") {
      var state = document.getElementById("ds-settings-key-state");
      if (state) state.textContent = message.payload.configured ? "設定済み（" + (message.payload.kind || "stored") + "）" : "未設定";
      return;
    }
    if (message.method === "credentials.set") {
      setStatus("API キーを保存しました", "ok");
      return;
    }
    if (message.method === "credentials.unset") {
      setStatus("API キーを削除しました", "ok");
      return;
    }
  }

  if (saveButton) {
    saveButton.addEventListener("click", function () {
      if (!current) return;
      if (current.ns === "llm-pi-ai") {
        if (providerId === null) return;
        var value = JSON.parse(JSON.stringify(providerDraft));
        if (!Array.isArray(value.defaultInput)) value.defaultInput = ["text"];
        bridge.send("settings.mutate", {
          ns: current.ns,
          revision: current.revision,
          ops: [{ op: "set", path: ["providers", providerId], value: value }],
        });
        setStatus("保存中…");
        return;
      }
      var parsed;
      try {
        parsed = JSON.parse(jsonBox.value);
      } catch (error) {
        setStatus("JSON を解析できません: " + error.message, "error");
        return;
      }
      var before = current.user !== null && current.user !== undefined ? current.user : current.value;
      var ops = [];
      Object.keys(parsed).forEach(function (key) {
        if (JSON.stringify(parsed[key]) !== JSON.stringify(before ? before[key] : undefined)) {
          ops.push({ op: "set", path: [key], value: parsed[key] });
        }
      });
      if (before) {
        Object.keys(before).forEach(function (key) {
          if (!(key in parsed)) ops.push({ op: "unset", path: [key] });
        });
      }
      if (ops.length === 0) {
        setStatus("変更はありません");
        return;
      }
      bridge.send("settings.mutate", { ns: current.ns, revision: current.revision, ops: ops });
      setStatus("保存中…");
    });
  }

  var loading = false;
  function load() {
    if (loading) return;
    if (!bridge.isReady()) { setTimeout(load, 400); return; }
    loading = true;
    bridge.send("settings.describe", {});
    setTimeout(function () { loading = false; }, 1500);
  }
  bridge.onEvent(onEvent);
  var settingsTab = document.querySelector('[data-ds-tab="settings"]');
  if (settingsTab) settingsTab.addEventListener("click", load);
  load();
})();`;

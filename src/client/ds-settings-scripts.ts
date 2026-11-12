/** DS settings client: profile settings with a model-provider editor. */
export const DS_SETTINGS_SCRIPT = `(function () {
  var bridge = window.__dsBridge;
  if (!bridge) return;
  var pane = document.getElementById("ds-settings");
  if (!pane) return;

  var navBox = document.getElementById("ds-settings-ns");
  var title = document.getElementById("ds-settings-title");
  var status = document.getElementById("ds-settings-status");
  var saveButton = document.getElementById("ds-settings-save");
  var formBox = document.getElementById("ds-settings-form");
  var jsonBox = document.getElementById("ds-settings-json");

  var SECTIONS = [
    { id: "models", label: "モデル", namespaces: ["llm-pi-ai", "agent-default-model"] },
    { id: "agents", label: "エージェント", namespaces: ["agent-loop", "subagent"] },
    { id: "permission", label: "権限", namespaces: ["permission", "bash-sandbox"] },
    { id: "search", label: "検索", namespaces: ["web-search-deepseek", "web-deepseek-api"] },
    { id: "other", label: "その他", namespaces: [] },
  ];
  var PROTOCOLS = [
    { value: "openai-completions", label: "OpenAI Chat Completions" },
    { value: "openai-responses", label: "OpenAI Responses" },
    { value: "anthropic-messages", label: "Anthropic Messages" },
  ];

  var writable = false;
  var forms = [];
  var sectionId = "models";
  var editing = null;
  var draft = {};
  var draftKey = "";
  var defaultDraft = null;
  var keyStates = {};

  function setStatus(text, tone) {
    if (!status) return;
    status.textContent = text || "";
    status.style.color = tone === "error" ? "#c62828" : tone === "ok" ? "#2e7d32" : "#666";
  }
  function clear(node) { while (node && node.firstChild) node.removeChild(node.firstChild); }
  function formOf(ns) { return forms.find(function (f) { return f.ns === ns; }); }
  function providersOf() {
    var form = formOf("llm-pi-ai");
    var value = form && form.value ? form.value : {};
    return value.providers && typeof value.providers === "object" ? value.providers : {};
  }
  function input(labelText, value, onInput, hint) {
    var wrap = document.createElement("label");
    wrap.className = "ds-settings__field";
    var span = document.createElement("span");
    span.textContent = labelText;
    var field = document.createElement("input");
    field.type = "text";
    field.value = value === undefined || value === null ? "" : String(value);
    if (hint) field.placeholder = hint;
    field.addEventListener("input", function () { onInput(field.value); });
    wrap.appendChild(span);
    wrap.appendChild(field);
    if (hint) {
      var note = document.createElement("small");
      note.className = "ds-settings__hint";
      note.textContent = hint;
      wrap.appendChild(note);
    }
    return wrap;
  }
  function select(labelText, value, options, onChange) {
    var wrap = document.createElement("label");
    wrap.className = "ds-settings__field";
    var span = document.createElement("span");
    span.textContent = labelText;
    var box = document.createElement("select");
    options.forEach(function (option) {
      var item = document.createElement("option");
      item.value = option.value;
      item.textContent = option.label;
      if (option.value === value) item.selected = true;
      box.appendChild(item);
    });
    box.addEventListener("change", function () { onChange(box.value); });
    wrap.appendChild(span);
    wrap.appendChild(box);
    return wrap;
  }
  function button(text, onClick) {
    var node = document.createElement("button");
    node.type = "button";
    node.className = "button";
    node.textContent = text;
    node.addEventListener("click", onClick);
    return node;
  }

  function renderNav() {
    clear(navBox);
    var heading = document.createElement("div");
    heading.className = "ds-settings__ns-title";
    heading.textContent = "設定";
    navBox.appendChild(heading);
    SECTIONS.forEach(function (section) {
      var node = document.createElement("button");
      node.type = "button";
      node.className = "ds-settings__ns-item" + (section.id === sectionId ? " active" : "");
      node.textContent = section.label;
      node.addEventListener("click", function () {
        sectionId = section.id;
        editing = null;
        render();
      });
      navBox.appendChild(node);
    });
    var extra = forms.filter(function (form) {
      return !SECTIONS.some(function (section) { return section.namespaces.indexOf(form.ns) >= 0; });
    });
    extra.forEach(function (form) {
      var node = document.createElement("button");
      node.type = "button";
      node.className = "ds-settings__ns-item" + (sectionId === form.ns ? " active" : "");
      node.textContent = form.ns;
      node.addEventListener("click", function () { sectionId = form.ns; editing = null; render(); });
      navBox.appendChild(node);
    });
  }

  function seedKeyState(ref) {
    if (ref && keyStates[ref] === undefined) {
      keyStates[ref] = null;
      bridge.send("credentials.describe", { ref: ref });
    }
  }

  function renderProviderCards(list) {
    var cards = document.createElement("div");
    cards.className = "ds-settings__cards";
    list.forEach(function (name) {
      var provider = providersOf()[name] || {};
      var ref = provider.apiKeyEnv;
      var state = ref ? keyStates[ref] : undefined;
      var card = document.createElement("div");
      card.className = "ds-settings__card" + (editing === name ? " active" : "");
      var dot = document.createElement("span");
      dot.className = "ds-settings__dot" + (state === false ? " bad" : state === true ? " good" : "");
      card.appendChild(dot);
      var label = document.createElement("span");
      label.className = "ds-settings__card-name";
      label.textContent = provider.displayName ? provider.displayName : name;
      card.appendChild(label);
      var suffix = document.createElement("span");
      suffix.className = "ds-settings__card-sub";
      suffix.textContent = name + (provider.api ? " · " + provider.api : "");
      card.appendChild(suffix);
      var actions = document.createElement("span");
      actions.className = "ds-settings__card-actions";
      actions.appendChild(button(editing === name ? "編集中" : "編集", function () {
        editing = name;
        draft = JSON.parse(JSON.stringify(provider));
        draftKey = name;
        render();
      }));
      actions.appendChild(button("削除", function () {
        bridge.send("settings.mutate", {
          ns: "llm-pi-ai",
          revision: formOf("llm-pi-ai").revision,
          ops: [{ op: "unset", path: ["providers", name] }],
        });
        setStatus("削除を送信しました（再起動で反映）", "ok");
        editing = null;
      }));
      card.appendChild(actions);
      cards.appendChild(card);
      seedKeyState(ref);
    });
    var add = button("＋ プロバイダを追加", function () {
      editing = "";
      draft = { displayName: "", baseURL: "", api: "openai-completions", apiKeyEnv: "", models: [] };
      draftKey = "";
      render();
    });
    add.className = "button ds-settings__add";
    cards.appendChild(add);
    return cards;
  }

  function renderProviderForm() {
    var block = document.createElement("div");
    block.className = "ds-settings__block";
    var heading = document.createElement("div");
    heading.className = "ds-settings__block-title";
    heading.textContent = "サードパーティのモデルプロバイダー";
    block.appendChild(heading);
    var note = document.createElement("p");
    note.className = "ds-settings__note";
    note.textContent = "ベースURL、プロトコル、モデルを指定して、リレー、セルフホストサーバー、その他のOpenAI/Anthropic互換エンドポイントに接続します。";
    block.appendChild(note);

    var grid = document.createElement("div");
    grid.className = "ds-settings__grid";
    var idField = input("プロバイダー ID", draftKey, function (v) { draftKey = v.trim(); }, "acme-gateway");
    grid.appendChild(idField);
    grid.appendChild(input("表示名", draft.displayName, function (v) { draft.displayName = v; }, "表示名"));
    grid.appendChild(input("ベースURL", draft.baseURL, function (v) { draft.baseURL = v; }, "https://gateway.example/v1"));
    grid.appendChild(select("APIプロトコル", draft.api, PROTOCOLS, function (v) { draft.api = v; }));
    block.appendChild(grid);

    var keyBar = document.createElement("div");
    keyBar.className = "ds-settings__key";
    var ref = draft.apiKeyEnv;
    var keyLabel = document.createElement("span");
    keyLabel.className = "ds-settings__key-label";
    keyLabel.textContent = "APIキー" + (ref ? "（" + ref + "）" : "");
    keyBar.appendChild(keyLabel);
    var keyInput = document.createElement("input");
    keyInput.type = "password";
    keyInput.placeholder = "APIキーを入力";
    keyBar.appendChild(keyInput);
    keyBar.appendChild(button("保存", function () {
      if (keyInput.value === "" || !ref) return;
      bridge.send("credentials.set", { ref: ref, value: keyInput.value });
      keyInput.value = "";
      keyStates[ref] = true;
    }));
    keyBar.appendChild(button("削除", function () {
      if (!ref) return;
      bridge.send("credentials.unset", { ref: ref });
      keyStates[ref] = false;
    }));
    var stateLabel = document.createElement("span");
    stateLabel.className = "ds-settings__key-state";
    var refState = ref ? keyStates[ref] : undefined;
    stateLabel.textContent = refState === true ? "設定済み" : refState === false ? "未設定" : "";
    keyBar.appendChild(stateLabel);
    block.appendChild(keyBar);

    var refField = input("認証情報名（apiKeyEnv）", draft.apiKeyEnv, function (v) {
      draft.apiKeyEnv = v.trim();
      seedKeyState(draft.apiKeyEnv);
    }, "COMMANDCODE_API_KEY");
    block.appendChild(refField);

    var models = Array.isArray(draft.models) ? draft.models : [];
    var modelsBlock = document.createElement("div");
    modelsBlock.className = "ds-settings__models";
    var head = document.createElement("div");
    head.className = "ds-settings__models-head";
    head.textContent = "モデル（" + models.length + " 件）";
    var fetchLink = button("利用可能なモデルを取得", function () {
      if (!draftKey) {
        setStatus("先にプロバイダー ID を入力してください", "error");
        return;
      }
      setStatus("モデル一覧を取得中…");
      bridge.send("settings.fetchModels", { provider: draftKey });
    });
    fetchLink.className = "button ds-settings__link";
    head.appendChild(fetchLink);
    modelsBlock.appendChild(head);
    if (models.length === 0) {
      var empty = document.createElement("p");
      empty.className = "ds-settings__note";
      empty.textContent = "セレクターにモデルが表示されません。一覧にないIDも直接送信できます。";
      modelsBlock.appendChild(empty);
    }
    models.forEach(function (model, index) {
      var row = document.createElement("div");
      row.className = "ds-settings__model-row";
      row.appendChild(input("ID", model.id, function (v) { models[index].id = v; }));
      row.appendChild(input("表示名", model.name, function (v) { models[index].name = v; }));
      row.appendChild(input("コンテキスト長", model.contextWindow, function (v) { models[index].contextWindow = Number(v) || 0; }));
      row.appendChild(button("削除", function () {
        models.splice(index, 1);
        draft.models = models;
        render();
      }));
      modelsBlock.appendChild(row);
    });
    var addModel = button("＋ モデルを追加", function () {
      models.push({ id: "", name: "", contextWindow: 128000 });
      draft.models = models;
      render();
    });
    addModel.className = "button ds-settings__add";
    modelsBlock.appendChild(addModel);
    block.appendChild(modelsBlock);
    return block;
  }

  function renderDefaultModel() {
    var form = formOf("agent-default-model");
    if (!form) return null;
    var value = form.user !== null && form.user !== undefined ? form.user : form.value;
    if (defaultDraft === null) defaultDraft = JSON.parse(JSON.stringify(value || {}));
    var block = document.createElement("div");
    block.className = "ds-settings__block";
    var heading = document.createElement("div");
    heading.className = "ds-settings__block-title";
    heading.textContent = "既定モデル";
    block.appendChild(heading);
    var grid = document.createElement("div");
    grid.className = "ds-settings__grid";
    grid.appendChild(input("プロバイダ", defaultDraft.provider, function (v) { defaultDraft.provider = v; }));
    grid.appendChild(input("モデル", defaultDraft.model, function (v) { defaultDraft.model = v; }));
    block.appendChild(grid);
    block.appendChild(button("既定モデルを保存", function () {
      bridge.send("settings.mutate", {
        ns: "agent-default-model",
        revision: formOf("agent-default-model").revision,
        ops: [
          { op: "set", path: ["provider"], value: defaultDraft.provider },
          { op: "set", path: ["model"], value: defaultDraft.model },
        ],
      });
      setStatus("保存しました（再起動で反映）", "ok");
    }));
    return block;
  }

  function renderModelsSection() {
    var list = Object.keys(providersOf());
    formBox.appendChild(renderProviderCards(list));
    if (editing !== null) formBox.appendChild(renderProviderForm());
    var fallback = renderDefaultModel();
    if (fallback) formBox.appendChild(fallback);
    jsonBox.hidden = true;
  }

  function renderJsonSection(ns) {
    var form = formOf(ns);
    if (!form) return;
    jsonBox.hidden = false;
    var value = form.user !== null && form.user !== undefined ? form.user : form.value;
    jsonBox.value = JSON.stringify(value, null, 2);
    var note = document.createElement("p");
    note.className = "ds-settings__note";
    note.textContent = "この名前空間は JSON で編集します（トップレベルの変更のみ保存）。";
    formBox.appendChild(note);
  }

  function render() {
    renderNav();
    clear(formBox);
    if (saveButton) saveButton.disabled = !writable;
    if (sectionId === "models") {
      title.textContent = "モデル";
      renderModelsSection();
      return;
    }
    if (sectionId === "agents" || sectionId === "permission" || sectionId === "search") {
      var section = SECTIONS.find(function (item) { return item.id === sectionId; });
      title.textContent = section.label;
      jsonBox.hidden = true;
      section.namespaces.forEach(function (ns) {
        if (!formOf(ns)) return;
        var heading = document.createElement("div");
        heading.className = "ds-settings__block-title";
        heading.textContent = ns;
        formBox.appendChild(heading);
        renderJsonSection(ns);
      });
      return;
    }
    title.textContent = sectionId;
    renderJsonSection(sectionId);
  }

  function onEvent(message) {
    if (message.kind === "evt") return;
    if (message.kind === "err") {
      if (message.method === "settings.mutate") {
        setStatus(message.payload.code === "conflict" ? "競合しました。再読み込みしてください" : "保存に失敗: " + message.payload.message, "error");
      } else if (message.method === "settings.fetchModels") {
        setStatus("取得に失敗: " + message.payload.message, "error");
      } else if (message.method === "credentials.set" || message.method === "credentials.unset") {
        setStatus("キー操作に失敗: " + message.payload.message, "error");
      }
      return;
    }
    if (message.method === "settings.describe") {
      writable = message.payload.writable === true;
      forms = message.payload.forms || [];
      render();
      if (!writable) setStatus("このプロファイルは設定を書き換えできません");
      return;
    }
    if (message.method === "settings.mutate") {
      setStatus("保存しました（反映には transport の再起動が必要です）", "ok");
      editing = null;
      defaultDraft = null;
      bridge.send("settings.describe", {});
      return;
    }
    if (message.method === "settings.fetchModels") {
      var fetched = message.payload.models || [];
      var byId = {};
      (draft.models || []).forEach(function (model) { byId[model.id] = model; });
      fetched.forEach(function (id) {
        if (!byId[id]) draft.models.push({ id: id, name: id, contextWindow: 128000 });
      });
      setStatus(fetched.length + " 件を取得しました（未保存）", "ok");
      render();
      return;
    }
    if (message.method === "credentials.describe") {
      keyStates[message.payload.ref] = message.payload.configured === true;
      render();
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
      if (sectionId === "models") {
        if (editing === null) {
          setStatus("プロバイダを選択してください");
          return;
        }
        if (!draftKey) {
          setStatus("プロバイダー ID を入力してください", "error");
          return;
        }
        var ops = [{ op: "set", path: ["providers", draftKey], value: JSON.parse(JSON.stringify(draft)) }];
        if (draftKey !== editing && editing !== "") ops.push({ op: "unset", path: ["providers", editing] });
        bridge.send("settings.mutate", { ns: "llm-pi-ai", revision: formOf("llm-pi-ai").revision, ops: ops });
        setStatus("保存中…");
        return;
      }
      var ns = sectionId;
      if (sectionId === "agents" || sectionId === "permission" || sectionId === "search") {
        var section = SECTIONS.find(function (item) { return item.id === sectionId; });
        ns = section.namespaces.find(function (name) { return formOf(name); });
      }
      var form = formOf(ns);
      if (!form) return;
      var parsed;
      try {
        parsed = JSON.parse(jsonBox.value);
      } catch (error) {
        setStatus("JSON を解析できません: " + error.message, "error");
        return;
      }
      var before = form.user !== null && form.user !== undefined ? form.user : form.value;
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
      bridge.send("settings.mutate", { ns: ns, revision: form.revision, ops: ops });
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

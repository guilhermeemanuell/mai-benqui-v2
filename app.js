/* Guig´s Bank — controle financeiro pessoal (PWA sem build).
   Tudo roda neste arquivo: dados locais, tela e sincronização com um repositório privado do GitHub. */
(function () {
  "use strict";

  // ======================================================================
  // Constantes e utilitários
  // ======================================================================
  var KEYS = { doc: "guigsbank.doc.v2", legacy: "finapp.transactions.v1", cfg: "guigsbank.sync.v1", avatar: "guigsbank.avatar.v1" };
  var DATA_FILE = "guigs-bank.json";
  var AVATAR_FILE = "avatar.png";
  var API = "https://api.github.com";
  var CATEGORIES = {
    income: ["Salário", "Freelance", "Investimentos", "Presente", "Outros"],
    expense: ["Alimentação", "Transporte", "Moradia", "Lazer", "Saúde", "Compras", "Outros"]
  };
  var COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)", "var(--chart-6)", "var(--chart-7)"];

  var $ = function (id) { return document.getElementById(id); };
  var brl = function (n) { return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }); };
  var esc = function (s) {
    return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; });
  };
  var uid = function () {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return "id-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);
  };
  var nowIso = function () { return new Date().toISOString(); };

  var ICONS = {
    up: '<path d="M7 7h10v10"/><path d="M7 17 17 7"/>',
    down: '<path d="m7 7 10 10"/><path d="M17 7v10H7"/>',
    wallet: '<path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1"/><path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4"/>',
    trash: '<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/>',
    plus: '<path d="M5 12h14"/><path d="M12 5v14"/>',
    sliders: '<line x1="21" x2="14" y1="4" y2="4"/><line x1="10" x2="3" y1="4" y2="4"/><line x1="21" x2="12" y1="12" y2="12"/><line x1="8" x2="3" y1="12" y2="12"/><line x1="21" x2="16" y1="20" y2="20"/><line x1="12" x2="3" y1="20" y2="20"/><line x1="14" x2="14" y1="2" y2="6"/><line x1="8" x2="8" y1="10" y2="14"/><line x1="16" x2="16" y1="18" y2="22"/>',
    cloud: '<path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/>',
    cloudOff: '<path d="m2 2 20 20"/><path d="M5.782 5.782A7 7 0 0 0 9 19h8.5a4.5 4.5 0 0 0 1.307-.193"/><path d="M21.532 16.5A4.5 4.5 0 0 0 17.5 10h-1.79A7.008 7.008 0 0 0 10 5.07"/>',
    refresh: '<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>',
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/>',
    upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/>',
    warn: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>'
  };
  function svg(name, cls) {
    return '<svg class="i ' + (cls || "") + '" viewBox="0 0 24 24" aria-hidden="true">' + ICONS[name] + "</svg>";
  }

  function toast(message, bad) {
    var el = document.createElement("div");
    el.className = "toast " + (bad ? "bad" : "ok");
    el.setAttribute("role", bad ? "alert" : "status");
    el.textContent = message;
    $("toasts").appendChild(el);
    setTimeout(function () { el.remove(); }, 3500);
  }

  // ======================================================================
  // Documento de dados e mesclagem entre aparelhos
  // ======================================================================
  function emptyDoc() { return { version: 1, transactions: [], categories: [], deleted: {} }; }
  function byId(a, b) { return a.id < b.id ? -1 : a.id > b.id ? 1 : 0; }
  function txStamp(t) { return t.updatedAt || t.date || ""; }
  function catStamp(c) { return c.updatedAt || ""; }

  function normalize(doc) {
    var deleted = {};
    Object.keys(doc.deleted).sort().forEach(function (id) { deleted[id] = doc.deleted[id]; });
    return { version: 1, transactions: doc.transactions.slice().sort(byId), categories: doc.categories.slice().sort(byId), deleted: deleted };
  }
  function serialize(doc) { return JSON.stringify(normalize(doc)); }

  function mergeList(a, b, deleted, stamp) {
    var map = {};
    a.concat(b).forEach(function (item) {
      var cur = map[item.id];
      if (!cur || stamp(item) > stamp(cur)) map[item.id] = item;
    });
    return Object.keys(map).map(function (k) { return map[k]; }).filter(function (item) {
      var removedAt = deleted[item.id];
      return !removedAt || stamp(item) > removedAt;
    });
  }

  /* Junta dois documentos: vale o item alterado por último; exclusões prevalecem sobre edições mais antigas. */
  function mergeDocs(a, b) {
    var deleted = {};
    Object.keys(a.deleted).forEach(function (id) { deleted[id] = a.deleted[id]; });
    Object.keys(b.deleted).forEach(function (id) { if (!deleted[id] || b.deleted[id] > deleted[id]) deleted[id] = b.deleted[id]; });
    var transactions = mergeList(a.transactions, b.transactions, deleted, txStamp);
    var categories = mergeList(a.categories, b.categories, deleted, catStamp);

    // Categoria igual (mesmo tipo e nome) criada em dois aparelhos: mantém só uma.
    var seen = {};
    var dropped = {};
    categories.slice().sort(byId).forEach(function (c) {
      var key = c.type + ":" + c.name.trim().toLocaleLowerCase("pt-BR");
      if (seen[key]) dropped[c.id] = true; else seen[key] = true;
    });
    if (Object.keys(dropped).length) {
      var now = nowIso();
      Object.keys(dropped).forEach(function (id) { deleted[id] = deleted[id] || now; });
      categories = categories.filter(function (c) { return !dropped[c.id]; });
    }
    return normalize({ transactions: transactions, categories: categories, deleted: deleted });
  }

  function parseDoc(value) {
    if (!value || typeof value !== "object" || value.version !== 1 || !Array.isArray(value.transactions) || !Array.isArray(value.categories)) {
      throw new Error("Arquivo de dados inválido");
    }
    var transactions = value.transactions.filter(function (t) {
      return t && typeof t.id === "string" && (t.type === "income" || t.type === "expense") && typeof t.amount === "number" &&
        isFinite(t.amount) && typeof t.category === "string" && typeof t.description === "string" && typeof t.date === "string";
    });
    var categories = value.categories.filter(function (c) {
      return c && typeof c.id === "string" && (c.type === "income" || c.type === "expense") && typeof c.name === "string";
    });
    var deleted = {};
    if (value.deleted && typeof value.deleted === "object") {
      Object.keys(value.deleted).forEach(function (id) { if (typeof value.deleted[id] === "string") deleted[id] = value.deleted[id]; });
    }
    return normalize({ transactions: transactions, categories: categories, deleted: deleted });
  }

  /* Lista antiga (versão do Lovable): só transações. */
  function docFromLegacy(list) {
    if (!Array.isArray(list)) throw new Error("Arquivo de dados inválido");
    return parseDoc({
      version: 1,
      transactions: list.map(function (t) { return Object.assign({}, t, { updatedAt: (t && (t.updatedAt || t.date)) || undefined }); }),
      categories: [], deleted: {}
    });
  }

  // ======================================================================
  // Categorias
  // ======================================================================
  function categoryOptions(type, custom) {
    return CATEGORIES[type].concat(custom.filter(function (c) { return c.type === type; }).map(function (c) { return c.name; }));
  }
  function validateCategoryName(type, input, custom) {
    var name = String(input).trim().replace(/\s+/g, " ");
    if (!name) throw new Error("Informe o nome da categoria");
    if (name.length > 40) throw new Error("Use até 40 caracteres");
    var low = name.toLocaleLowerCase("pt-BR");
    if (categoryOptions(type, custom).some(function (e) { return e.toLocaleLowerCase("pt-BR") === low; })) throw new Error("Esta categoria já existe");
    return name;
  }

  // ======================================================================
  // Estado
  // ======================================================================
  var state = { doc: emptyDoc(), config: null, status: "off", lastSync: null, error: null, avatar: null };
  var formType = "expense";
  var formCategory = CATEGORIES.expense[0];
  var timer = null;

  function lsGet(key) { try { return localStorage.getItem(key); } catch (e) { return null; } }
  function lsSet(key, value) { try { localStorage.setItem(key, value); return true; } catch (e) { return false; } }
  function lsDel(key) { try { localStorage.removeItem(key); } catch (e) { /* ignora */ } }
  function lsJson(key) { try { var raw = lsGet(key); return raw ? JSON.parse(raw) : null; } catch (e) { return null; } }

  function loadDoc() {
    try {
      var cur = lsJson(KEYS.doc);
      if (cur) return parseDoc(cur);
      var legacy = lsJson(KEYS.legacy);
      if (legacy) return docFromLegacy(legacy);
    } catch (e) { /* dados locais ilegíveis: começa vazio */ }
    return emptyDoc();
  }
  function persistDoc() { lsSet(KEYS.doc, JSON.stringify(state.doc)); }

  function setState(patch) {
    Object.keys(patch).forEach(function (k) { state[k] = patch[k]; });
    render();
  }
  function changeDoc(doc) {
    setState({ doc: doc });
    persistDoc();
    scheduleSync(1500);
  }

  // ---------- ações sobre os dados ----------
  function addTransaction(tx) {
    tx.updatedAt = nowIso();
    changeDoc(Object.assign({}, state.doc, { transactions: [tx].concat(state.doc.transactions) }));
  }
  function deleteTransaction(id) {
    var deleted = Object.assign({}, state.doc.deleted); deleted[id] = nowIso();
    changeDoc(Object.assign({}, state.doc, { transactions: state.doc.transactions.filter(function (t) { return t.id !== id; }), deleted: deleted }));
  }
  function addCategory(type, name) {
    var valid = validateCategoryName(type, name, state.doc.categories);
    var category = { id: uid(), type: type, name: valid, updatedAt: nowIso() };
    changeDoc(Object.assign({}, state.doc, { categories: state.doc.categories.concat([category]) }));
    return category;
  }
  function deleteCategory(id) {
    var deleted = Object.assign({}, state.doc.deleted); deleted[id] = nowIso();
    changeDoc(Object.assign({}, state.doc, { categories: state.doc.categories.filter(function (c) { return c.id !== id; }), deleted: deleted }));
  }
  function importData(text) {
    var parsed = JSON.parse(text);
    var incoming = Array.isArray(parsed) ? docFromLegacy(parsed) : parseDoc(parsed);
    var before = state.doc.transactions.length;
    changeDoc(mergeDocs(state.doc, incoming));
    return state.doc.transactions.length - before;
  }

  // ======================================================================
  // GitHub (repositório privado de dados)
  // ======================================================================
  function SyncError(message, code) { this.message = message; this.code = code; }
  SyncError.prototype = Object.create(Error.prototype);

  function parseRepo(input) {
    var cleaned = String(input).trim().replace(/^https?:\/\/github\.com\//i, "").replace(/\.git$/i, "").replace(/\/+$/, "");
    return /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(cleaned) ? cleaned : null;
  }
  function toBase64(text) {
    var bytes = new TextEncoder().encode(text), bin = "";
    for (var i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(bin);
  }
  function fromBase64(value) {
    var bin = atob(value.replace(/\s/g, ""));
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }

  function ghRequest(cfg, path, init) {
    init = init || {};
    var headers = { Accept: "application/vnd.github+json", Authorization: "Bearer " + cfg.token, "X-GitHub-Api-Version": "2022-11-28" };
    if (init.body) headers["Content-Type"] = "application/json";
    return fetch(API + path, { method: init.method || "GET", body: init.body, cache: "no-store", headers: headers })
      .catch(function () { throw new SyncError("Sem conexão com o GitHub", "network"); });
  }
  function failure(res) {
    if (res.status === 401) return new SyncError("Chave de acesso inválida ou expirada", "auth");
    if (res.status === 403) return new SyncError("A chave não tem permissão neste repositório (ou limite de uso atingido)", "auth");
    if (res.status === 404) return new SyncError("Repositório não encontrado — confira o nome e as permissões da chave", "notfound");
    if (res.status === 409 || res.status === 422) return new SyncError("Os dados mudaram em outro aparelho", "conflict");
    return new SyncError("Erro do GitHub (" + res.status + ")", "other");
  }

  function checkRepo(cfg) {
    return ghRequest(cfg, "/repos/" + cfg.repo).then(function (res) {
      if (!res.ok) throw failure(res);
      return res.json().then(function (b) { return { isPrivate: b.private === true, canPush: !!(b.permissions && b.permissions.push === true) }; });
    });
  }
  function readRemote(cfg) {
    return ghRequest(cfg, "/repos/" + cfg.repo + "/contents/" + DATA_FILE).then(function (res) {
      if (res.status === 404) {
        return ghRequest(cfg, "/repos/" + cfg.repo).then(function (repo) { if (!repo.ok) throw failure(repo); return null; });
      }
      if (!res.ok) throw failure(res);
      return res.json().then(function (b) {
        if (!b.content || b.encoding !== "base64") throw new SyncError("Não foi possível ler o arquivo de dados", "other");
        try { return { doc: parseDoc(JSON.parse(fromBase64(b.content))), sha: b.sha }; }
        catch (e) { throw new SyncError("O arquivo de dados no repositório está inválido; nada foi alterado", "other"); }
      });
    });
  }
  function writeRemote(cfg, doc, sha) {
    var body = { message: "Sincronização do Guig´s Bank", content: toBase64(JSON.stringify(doc, null, 1)) };
    if (sha) body.sha = sha;
    return ghRequest(cfg, "/repos/" + cfg.repo + "/contents/" + DATA_FILE, { method: "PUT", body: JSON.stringify(body) })
      .then(function (res) { if (!res.ok) throw failure(res); });
  }
  function readAvatar(cfg) {
    return ghRequest(cfg, "/repos/" + cfg.repo + "/contents/" + AVATAR_FILE).then(function (res) {
      if (res.status === 404) return null;
      if (!res.ok) throw failure(res);
      return res.json().then(function (b) {
        return b.content && b.encoding === "base64" ? "data:image/png;base64," + b.content.replace(/\s/g, "") : null;
      });
    });
  }
  function writeAvatar(cfg, dataUrl) {
    var content = dataUrl.replace(/^data:image\/png;base64,/, "");
    return ghRequest(cfg, "/repos/" + cfg.repo + "/contents/" + AVATAR_FILE).then(function (cur) {
      if (cur.ok) return cur.json().then(function (b) { return b.sha; });
      if (cur.status !== 404) throw failure(cur);
      return undefined;
    }).then(function (sha) {
      var body = { message: "Foto do Guig´s Bank", content: content };
      if (sha) body.sha = sha;
      return ghRequest(cfg, "/repos/" + cfg.repo + "/contents/" + AVATAR_FILE, { method: "PUT", body: JSON.stringify(body) });
    }).then(function (res) { if (!res.ok) throw failure(res); });
  }

  // ======================================================================
  // Sincronização
  // ======================================================================
  var syncing = false, again = false;

  function scheduleSync(delay) {
    if (!state.config) return;
    clearTimeout(timer);
    timer = setTimeout(function () { syncNow(); }, delay);
  }

  function syncNow() {
    var cfg = state.config;
    if (!cfg) return Promise.resolve();
    if (!navigator.onLine) { setState({ status: "offline" }); return Promise.resolve(); }
    if (syncing) { again = true; return Promise.resolve(); }
    syncing = true;
    setState({ status: "syncing", error: null });

    function attempt(n) {
      if (n >= 4) throw new SyncError("Não foi possível gravar agora; tente de novo em instantes", "conflict");
      return readRemote(cfg).then(function (remote) {
        var merged = mergeDocs(state.doc, remote ? remote.doc : emptyDoc());
        var needsWrite = !remote || serialize(merged) !== serialize(remote.doc);
        var step = needsWrite
          ? writeRemote(cfg, merged, remote && remote.sha).then(function () { return true; }, function (e) {
              if (e instanceof SyncError && e.code === "conflict") return false; // outro aparelho gravou no meio
              throw e;
            })
          : Promise.resolve(true);
        return step.then(function (ok) {
          if (!ok) return attempt(n + 1);
          // Pode ter havido edições locais durante a gravação: junta de novo em vez de sobrescrever.
          var latest = mergeDocs(state.doc, merged);
          setState({ doc: latest, status: "ok", lastSync: nowIso(), error: null });
          persistDoc();
          if (serialize(latest) !== serialize(merged)) again = true;
        });
      });
    }

    return Promise.resolve().then(function () { return attempt(0); }).catch(function (e) {
      var network = e instanceof SyncError && e.code === "network";
      setState({ status: network ? "offline" : "error", error: e && e.message ? e.message : "Falha na sincronização" });
    }).then(function () {
      syncing = false;
      if (again) { again = false; scheduleSync(500); }
    });
  }

  function cacheAvatar(avatar) {
    setState({ avatar: avatar });
    if (avatar) lsSet(KEYS.avatar, avatar); else lsDel(KEYS.avatar);
  }
  function refreshAvatar() {
    var cfg = state.config;
    if (!cfg || !navigator.onLine) return Promise.resolve();
    return readAvatar(cfg).then(function (a) { if (a) cacheAvatar(a); }, function () { /* a foto é opcional */ });
  }

  function connect(repoInput, tokenInput) {
    var repo = parseRepo(repoInput), token = String(tokenInput).trim();
    if (!repo) return Promise.reject(new Error("Informe o repositório no formato usuario/repositorio"));
    if (!token) return Promise.reject(new Error("Informe a chave de acesso"));
    var cfg = { repo: repo, token: token };
    return checkRepo(cfg).then(function (info) {
      if (!info.canPush) throw new Error("A chave não tem permissão de escrita (Contents: Read and write) neste repositório");
      if (!lsSet(KEYS.cfg, JSON.stringify(cfg))) throw new Error("Não foi possível guardar a chave neste aparelho");
      setState({ config: cfg, status: "idle", error: null });
      return syncNow().then(function () { refreshAvatar(); return { isPrivate: info.isPrivate }; });
    });
  }
  function disconnect() {
    clearTimeout(timer);
    lsDel(KEYS.cfg);
    cacheAvatar(null);
    setState({ config: null, status: "off", error: null, lastSync: null });
  }

  function statusLabel() {
    switch (state.status) {
      case "off": return "Dados salvos só neste aparelho";
      case "syncing": return "Sincronizando…";
      case "offline": return "Sem conexão — sincroniza quando voltar";
      case "error": return "Erro na sincronização";
      default:
        return state.lastSync
          ? "Sincronizado às " + new Date(state.lastSync).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
          : "Sincronização ativa";
    }
  }

  // ======================================================================
  // Desenho da tela
  // ======================================================================
  function renderBalance(income, expense) {
    $("balance").innerHTML =
      '<div class="lbl">' + svg("wallet") + "Saldo atual</div>" +
      '<div class="total tnum wrap-any">' + brl(income - expense) + "</div>" +
      '<div class="stats">' +
        '<div class="stat"><div class="lbl" style="display:flex;align-items:center;gap:.5rem;color:var(--balance-muted)"><span class="inc" style="display:grid;place-items:center">' + svg("up") + "</span>Receitas</div>" +
          '<div class="val tnum wrap-any">' + brl(income) + "</div></div>" +
        '<div class="stat"><div class="lbl" style="display:flex;align-items:center;gap:.5rem;color:var(--balance-muted)"><span class="exp" style="display:grid;place-items:center">' + svg("down") + "</span>Despesas</div>" +
          '<div class="val tnum wrap-any">' + brl(expense) + "</div></div>" +
      "</div>";
  }

  function renderList(sorted) {
    if (!sorted.length) { $("transactions").innerHTML = '<div class="empty">Nenhuma transação registrada.</div>'; return; }
    var html = '<section><div class="list-head"><h2>Transações recentes</h2><span>' + sorted.length + ' no total</span></div><ul class="tx-list">';
    sorted.forEach(function (tx) {
      var inc = tx.type === "income";
      var date = new Date(tx.date).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
      html += '<li class="tx">' +
        '<div class="ico ' + (inc ? "in" : "out") + '">' + svg(inc ? "up" : "down") + "</div>" +
        '<div class="info"><div class="d">' + esc(tx.description) + '</div><div class="m">' + esc(tx.category) + " · " + date + "</div></div>" +
        '<div class="amt tnum wrap-any">' + (inc ? "+" : "−") + " " + brl(tx.amount) + "</div>" +
        '<button type="button" class="btn ghost icon i44 muted-btn del" data-del="' + esc(tx.id) + '" aria-label="Excluir ' + esc(tx.description) + '" title="Excluir transação">' + svg("trash") + "</button>" +
        "</li>";
    });
    $("transactions").innerHTML = html + "</ul></section>";
  }

  function renderChart(txs) {
    var map = {}, order = [];
    txs.forEach(function (t) {
      if (t.type !== "expense") return;
      if (!(t.category in map)) { map[t.category] = 0; order.push(t.category); }
      map[t.category] += t.amount;
    });
    var data = order.map(function (n) { return { name: n, value: map[n] }; }).sort(function (a, b) { return b.value - a.value; });
    var total = data.reduce(function (s, d) { return s + d.value; }, 0);
    var html = "<h2>Despesas por categoria</h2>";
    if (!data.length) {
      $("chart").innerHTML = html + '<div class="empty-c">Sem despesas registradas</div>';
      return;
    }
    var R = 70, C = 2 * Math.PI * R, gap = data.length > 1 ? (2 / 360) * C : 0, acc = 0;
    var rings = data.map(function (d, i) {
      var len = (d.value / total) * C;
      var circle = '<circle r="' + R + '" cx="0" cy="0" fill="none" stroke-width="30" style="stroke:' + COLORS[i % COLORS.length] + '" ' +
        'stroke-dasharray="' + Math.max(len - gap, 0.01).toFixed(3) + " " + C.toFixed(3) + '" stroke-dashoffset="' + (-acc).toFixed(3) + '" transform="rotate(-90)">' +
        "<title>" + esc(d.name) + ": " + brl(d.value) + "</title></circle>";
      acc += len;
      return circle;
    }).join("");
    html += '<div class="donut"><svg viewBox="-100 -96 200 192" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Despesas por categoria">' + rings + "</svg>" +
      '<div class="center"><div><div class="t">Total</div><div class="v">' + brl(total) + "</div></div></div></div>";
    html += '<ul class="legend">' + data.map(function (d, i) {
      return '<li><div class="n"><span class="dot" style="background:' + COLORS[i % COLORS.length] + '"></span><span>' + esc(d.name) + '</span></div><span class="v tnum">' + brl(d.value) + "</span></li>";
    }).join("") + "</ul>";
    $("chart").innerHTML = html;
  }

  function selectedCategory() {
    var opts = categoryOptions(formType, state.doc.categories);
    return opts.indexOf(formCategory) >= 0 ? formCategory : (opts[0] || "Outros");
  }
  function renderCategorySelect() {
    var sel = $("category"), current = selectedCategory();
    sel.innerHTML = categoryOptions(formType, state.doc.categories).map(function (c) {
      return '<option value="' + esc(c) + '"' + (c === current ? " selected" : "") + ">" + esc(c) + "</option>";
    }).join("");
    sel.value = current;
    formCategory = current;
  }

  function renderCatDialog() {
    $("catTitle").textContent = "Categorias de " + (formType === "income" ? "receita" : "despesa");
    var html = state.doc.categories.filter(function (c) { return c.type === formType; }).map(function (c) {
      return '<li><span>' + esc(c.name) + '</span><button type="button" class="btn ghost i44 muted-btn del" data-delcat="' + esc(c.id) + '" aria-label="Excluir categoria ' + esc(c.name) + '" title="Excluir categoria">' + svg("trash") + "</button></li>";
    }).join("");
    html += CATEGORIES[formType].map(function (c) { return '<li class="std"><span>' + esc(c) + '</span><span class="tag">Padrão</span></li>'; }).join("");
    $("catList").innerHTML = html;
  }

  function renderSync() {
    var on = !!state.config;
    var healthy = on && state.status !== "offline" && state.status !== "error";
    $("syncBtn").innerHTML = svg(state.status === "syncing" ? "refresh" : healthy ? "cloud" : "cloudOff", state.status === "syncing" ? "spin" : "") + "<span>" + esc(statusLabel()) + "</span>";
    $("syncOn").classList.toggle("hidden", !on);
    $("syncOff").classList.toggle("hidden", on);
    if (on) {
      $("syncRepo").textContent = state.config.repo;
      $("syncStatusLine").textContent = statusLabel();
      $("syncErr").textContent = state.error || "";
      $("syncErr").classList.toggle("hidden", !state.error);
      $("syncNowBtn").innerHTML = svg("refresh", state.status === "syncing" ? "spin" : "") + " Sincronizar agora";
      $("syncNowBtn").disabled = state.status === "syncing";
      $("avatarPreview").src = state.avatar || "icons/icon-192.png";
    }
  }

  function render() {
    var income = 0, expense = 0;
    state.doc.transactions.forEach(function (t) { if (t.type === "income") income += t.amount; else expense += t.amount; });
    var sorted = state.doc.transactions.slice().sort(function (a, b) { return +new Date(b.date) - +new Date(a.date); });
    renderBalance(income, expense);
    renderList(sorted);
    renderChart(state.doc.transactions);
    renderCategorySelect();
    if ($("catDialog").open) renderCatDialog();
    renderSync();
    $("avatarImg").src = state.avatar || "icons/icon-192.png";
  }

  // ======================================================================
  // Eventos
  // ======================================================================
  function setType(type) {
    formType = type;
    formCategory = CATEGORIES[type][0];
    document.querySelectorAll(".toggle .btn").forEach(function (b) {
      var on = b.getAttribute("data-type") === type;
      b.classList.toggle("on", on);
      b.setAttribute("aria-pressed", String(on));
    });
    renderCategorySelect();
  }

  function openDialog(dlg) { if (!dlg.open) dlg.showModal(); }
  function wireDialog(dlg) {
    dlg.addEventListener("click", function (e) { if (e.target === dlg) dlg.close(); }); // clique no fundo fecha
  }

  function resizeAvatar(file) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file), img = new Image();
      img.onload = function () {
        var side = Math.min(img.width, img.height), canvas = document.createElement("canvas");
        canvas.width = canvas.height = 192;
        canvas.getContext("2d").drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, 192, 192);
        URL.revokeObjectURL(url);
        resolve(canvas.toDataURL("image/png"));
      };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error("Não foi possível usar essa imagem")); };
      img.src = url;
    });
  }

  function init() {
    // textos e ícones fixos
    document.querySelector('[data-type="expense"]').innerHTML = svg("down") + "Despesa";
    document.querySelector('[data-type="income"]').innerHTML = svg("up") + "Receita";
    $("catManage").innerHTML = svg("sliders");
    $("catAdd").innerHTML = svg("plus");
    $("addBtn").innerHTML = svg("plus") + " Adicionar";
    $("exportBtn").innerHTML = svg("download") + " Baixar";
    $("importBtn").innerHTML = svg("upload") + " Importar";
    $("connectBtn").innerHTML = svg("cloud") + " Conectar e sincronizar";
    $("today").textContent = new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });
    ["catDialog", "confirmDialog", "syncDialog"].forEach(function (id) { wireDialog($(id)); });

    // transações
    document.querySelectorAll(".toggle .btn").forEach(function (b) {
      b.addEventListener("click", function () { setType(b.getAttribute("data-type")); });
    });
    $("category").addEventListener("change", function (e) { formCategory = e.target.value; });
    $("form").addEventListener("submit", function (e) {
      e.preventDefault();
      var value = parseFloat($("amount").value.replace(",", "."));
      if (!value || value <= 0) { toast("Informe um valor válido", true); return; }
      var cat = selectedCategory();
      addTransaction({ id: uid(), type: formType, amount: value, category: cat, description: $("desc").value.trim() || cat, date: nowIso() });
      $("amount").value = ""; $("desc").value = "";
      toast("Transação adicionada");
    });
    $("transactions").addEventListener("click", function (e) {
      var btn = e.target.closest("[data-del]");
      if (btn) deleteTransaction(btn.getAttribute("data-del"));
    });

    // categorias
    var pendingDelete = null;
    function addCat() {
      var err = $("catErr");
      err.classList.add("hidden");
      try {
        var c = addCategory(formType, $("catName").value);
        $("catName").value = "";
        formCategory = c.name;
        renderCategorySelect();
        renderCatDialog();
        toast("Categoria cadastrada");
      } catch (ex) {
        err.textContent = ex.message || "Não foi possível cadastrar a categoria";
        err.classList.remove("hidden");
      }
    }
    $("catManage").addEventListener("click", function () { $("catErr").classList.add("hidden"); renderCatDialog(); openDialog($("catDialog")); });
    $("catAdd").addEventListener("click", addCat);
    $("catName").addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); addCat(); } });
    $("catName").addEventListener("input", function () { $("catErr").classList.add("hidden"); });
    $("catList").addEventListener("click", function (e) {
      var btn = e.target.closest("[data-delcat]");
      if (!btn) return;
      var id = btn.getAttribute("data-delcat");
      pendingDelete = state.doc.categories.filter(function (c) { return c.id === id; })[0] || null;
      if (!pendingDelete) return;
      $("confirmText").textContent = "A categoria “" + pendingDelete.name + "” será removida. As transações já registradas serão mantidas.";
      $("confirmOk").innerHTML = svg("trash") + " Excluir categoria";
      $("confirmDialog").showModal();
    });
    $("confirmCancel").addEventListener("click", function () { $("confirmDialog").close(); pendingDelete = null; });
    $("confirmOk").addEventListener("click", function () {
      if (pendingDelete) { deleteCategory(pendingDelete.id); toast("Categoria excluída"); }
      pendingDelete = null;
      $("confirmDialog").close();
      renderCatDialog();
    });

    // sincronização
    $("syncBtn").addEventListener("click", function () { $("syncFormErr").classList.add("hidden"); renderSync(); openDialog($("syncDialog")); });
    $("syncClose").addEventListener("click", function () { $("syncDialog").close(); });
    $("syncNowBtn").addEventListener("click", function () { syncNow(); refreshAvatar(); });
    $("disconnectBtn").addEventListener("click", function () { disconnect(); toast("Chave removida deste aparelho"); });
    $("syncOff").addEventListener("submit", function (e) {
      e.preventDefault();
      var btn = $("connectBtn"), err = $("syncFormErr");
      btn.disabled = true; err.classList.add("hidden");
      connect($("syncRepoIn").value, $("syncTokenIn").value).then(function (r) {
        $("syncTokenIn").value = "";
        var pub = $("syncPublic");
        pub.classList.toggle("hidden", r.isPrivate);
        pub.textContent = r.isPrivate ? "" : "Este repositório é público: qualquer pessoa pode ler seus dados. Torne-o privado nas configurações do GitHub.";
        toast("Sincronização ativada");
      }).catch(function (ex) {
        err.textContent = ex && ex.message ? ex.message : "Não foi possível conectar";
        err.classList.remove("hidden");
      }).then(function () { btn.disabled = false; });
    });
    $("avatarBtn").addEventListener("click", function () { $("avatarFile").click(); });
    $("avatarFile").addEventListener("change", function (e) {
      var file = e.target.files && e.target.files[0];
      e.target.value = "";
      if (!file || !state.config) return;
      $("avatarBtn").disabled = true;
      resizeAvatar(file).then(function (dataUrl) {
        return writeAvatar(state.config, dataUrl).then(function () { cacheAvatar(dataUrl); toast("Foto salva no repositório privado"); });
      }).catch(function (ex) { toast(ex && ex.message ? ex.message : "Não foi possível usar essa imagem", true); })
        .then(function () { $("avatarBtn").disabled = false; });
    });

    // backup
    $("exportBtn").addEventListener("click", function () {
      var blob = new Blob([JSON.stringify(state.doc, null, 2)], { type: "application/json" });
      var url = URL.createObjectURL(blob), a = document.createElement("a");
      a.href = url; a.download = "guigs-bank-backup-" + nowIso().slice(0, 10) + ".json";
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    });
    $("importBtn").addEventListener("click", function () { $("importFile").click(); });
    $("importFile").addEventListener("change", function (e) {
      var file = e.target.files && e.target.files[0];
      e.target.value = "";
      if (!file) return;
      file.text().then(function (text) {
        var added = importData(text);
        toast(added > 0 ? added + " transação(ões) importada(s)" : "Nada novo para importar");
      }).catch(function () { toast("Arquivo inválido", true); });
    });

    // dados e gatilhos automáticos
    var cfg = lsJson(KEYS.cfg);
    var config = cfg && typeof cfg.repo === "string" && typeof cfg.token === "string" ? { repo: cfg.repo, token: cfg.token } : null;
    var avatar = config ? lsGet(KEYS.avatar) : null;
    state.doc = loadDoc();
    state.config = config;
    state.avatar = avatar;
    state.status = config ? "idle" : "off";
    persistDoc();
    setType("expense");
    render();
    if (config) { syncNow(); if (!avatar) refreshAvatar(); }

    window.addEventListener("online", function () { syncNow(); });
    window.addEventListener("offline", function () { if (state.config) setState({ status: "offline" }); });
    document.addEventListener("visibilitychange", function () { if (document.visibilityState === "visible") syncNow(); });
    setInterval(function () { if (document.visibilityState === "visible") syncNow(); }, 60000);

    if ("serviceWorker" in navigator && location.protocol !== "file:") {
      navigator.serviceWorker.register("sw.js").catch(function () { /* sem modo offline neste ambiente */ });
    }
  }

  // exposto só para testes automatizados
  window.__guigs = { mergeDocs: mergeDocs, parseDoc: parseDoc, serialize: serialize, getState: function () { return state; } };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();

/* Guig´s Bank — controle financeiro pessoal (PWA sem build).
   Tudo roda neste arquivo: dados locais, tela e sincronização com um repositório privado do GitHub. */
(function () {
  "use strict";

  // ======================================================================
  // Constantes e utilitários
  // ======================================================================
  var KEYS = { doc: "guigsbank.doc.v2", legacy: "finapp.transactions.v1", cfg: "guigsbank.sync.v1" };
  var DATA_FILE = "guigs-bank.json";
  var API = "https://api.github.com";
  var CATEGORIES = {
    income: ["Salário", "Freelance", "Investimentos", "Presente", "Outros"],
    expense: ["Alimentação", "Transporte", "Moradia", "Lazer", "Saúde", "Compras", "Outros"]
  };
  // Paleta viva usada pelas categorias padrão (a mesma do gráfico original).
  var DEFAULT_COLORS = ["#FFBE0B", "#FB5607", "#FF006E", "#8338EC", "#3A86FF", "#2EC4B6", "#C65B9A"];
  var SEED_STAMP = "2000-01-01T00:00:00.000Z"; // categorias padrão nunca "vencem" uma exclusão feita depois

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
    eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    eyeOff: '<path d="M9.9 4.2A10 10 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-2.2 3.2"/><path d="M6.6 6.6A17 17 0 0 0 2 12s3.5 7 10 7a9.7 9.7 0 0 0 5.4-1.6"/><path d="M14.1 14.1a3 3 0 1 1-4.2-4.2"/><line x1="2" x2="22" y1="2" y2="22"/>',
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/>',
    upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/>',
    left: '<path d="m15 18-6-6 6-6"/>',
    right: '<path d="m9 18 6-6-6-6"/>',
    pencil: '<path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/><path d="m15 5 4 4"/>',
    warn: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>'
  };
  function svg(name, cls) {
    return '<svg class="i ' + (cls || "") + '" viewBox="0 0 24 24" aria-hidden="true">' + ICONS[name] + "</svg>";
  }

  function toast(message, bad, action) {
    var el = document.createElement("div");
    el.className = "toast " + (bad ? "bad" : "ok");
    el.setAttribute("role", bad ? "alert" : "status");
    var span = document.createElement("span");
    span.textContent = message;
    el.appendChild(span);
    if (action) {
      el.classList.add("with-action");
      var btn = document.createElement("button");
      btn.type = "button"; btn.className = "toast-act"; btn.textContent = action.label;
      btn.addEventListener("click", function () { el.remove(); action.run(); });
      el.appendChild(btn);
    }
    $("toasts").appendChild(el);
    setTimeout(function () { el.remove(); }, action ? 7000 : 3500);
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
    return { version: 1, transactions: doc.transactions.slice().sort(byId), categories: doc.categories.slice().sort(byId), deleted: deleted, seeded: doc.seeded === true ? true : undefined };
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
    return normalize({ transactions: transactions, categories: categories, deleted: deleted, seeded: a.seeded === true || b.seeded === true });
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
    return normalize({ transactions: transactions, categories: categories, deleted: deleted, seeded: value.seeded === true });
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
  function catOrder(c) { return typeof c.order === "number" ? c.order : (Date.parse(c.updatedAt) || 0); }
  function sortedCats(type, custom) {
    return custom.filter(function (c) { return c.type === type; }).sort(function (a, b) { return catOrder(a) - catOrder(b) || byId(a, b); });
  }
  function categoryOptions(type, custom) {
    var names = sortedCats(type, custom).map(function (c) { return c.name; });
    return names.length ? names : ["Outros"];
  }
  function validateCategoryName(type, input, custom) {
    var name = String(input).trim().replace(/\s+/g, " ");
    if (!name) throw new Error("Informe o nome da categoria");
    if (name.length > 40) throw new Error("Use até 40 caracteres");
    var low = name.toLocaleLowerCase("pt-BR");
    if (sortedCats(type, custom).some(function (e) { return e.name.toLocaleLowerCase("pt-BR") === low; })) throw new Error("Esta categoria já existe");
    return name;
  }

  /* Cores: vivas (saturação alta), sempre longe das já usadas no mesmo tipo. */
  function hslToHex(h, sat, lig) {
    sat /= 100; lig /= 100;
    var a = sat * Math.min(lig, 1 - lig);
    function f(n) {
      var k = (n + h / 30) % 12;
      var c = lig - a * Math.max(-1, Math.min(k - 3, Math.min(9 - k, 1)));
      var hex = Math.round(c * 255).toString(16);
      return hex.length < 2 ? "0" + hex : hex;
    }
    return "#" + f(0) + f(8) + f(4);
  }
  function hexToHue(hex) {
    var r = parseInt(hex.slice(1, 3), 16) / 255, g = parseInt(hex.slice(3, 5), 16) / 255, b = parseInt(hex.slice(5, 7), 16) / 255;
    var max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min, h = 0;
    if (d === 0) return 0;
    if (max === r) h = ((g - b) / d) % 6; else if (max === g) h = (b - r) / d + 2; else h = (r - g) / d + 4;
    return (h * 60 + 360) % 360;
  }
  function randomColor(usedColors) {
    var hues = usedColors.filter(function (c) { return /^#[0-9a-f]{6}$/i.test(c); }).map(hexToHue);
    var best = null, bestDist = -1;
    for (var i = 0; i < 40; i++) {
      var h = Math.random() * 360, dist = 360;
      hues.forEach(function (u) { var d = Math.abs(h - u); dist = Math.min(dist, Math.min(d, 360 - d)); });
      if (dist > bestDist) { bestDist = dist; best = h; }
    }
    return hslToHex(best, 88 + Math.random() * 12, 52 + Math.random() * 8);
  }
  function hashColor(name) {
    var h = 0;
    for (var i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
    return hslToHex(h % 360, 92, 55);
  }
  function colorOf(type, name) {
    var c = state.doc.categories.filter(function (x) { return x.type === type && x.name === name; })[0];
    return (c && c.color) || hashColor(name);
  }

  /* As categorias padrão viram categorias comuns (com opção de apagar). Ids fixos: todos os aparelhos geram as mesmas. */
  function ensureDefaults(doc) {
    if (doc.seeded) return doc;
    var categories = doc.categories.slice();
    ["expense", "income"].forEach(function (type) {
      CATEGORIES[type].forEach(function (name, i) {
        var id = "default:" + type + ":" + name;
        if (doc.deleted[id]) return;
        var low = name.toLocaleLowerCase("pt-BR");
        var exists = categories.some(function (c) { return c.id === id || (c.type === type && c.name.trim().toLocaleLowerCase("pt-BR") === low); });
        if (!exists) categories.push({ id: id, type: type, name: name, color: DEFAULT_COLORS[i % DEFAULT_COLORS.length], order: i, updatedAt: SEED_STAMP });
      });
    });
    return Object.assign({}, doc, { categories: categories, seeded: true });
  }

  // ======================================================================
  // Meses (a lista e o gráfico mostram um mês por vez)
  // ======================================================================
  function monthKey(d) { return d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2); }
  function shiftMonth(key, dir) { var p = key.split("-"); return monthKey(new Date(+p[0], +p[1] - 1 + dir, 1)); }
  function monthLabel(key) {
    var p = key.split("-");
    var text = new Date(+p[0], +p[1] - 1, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
    return text.charAt(0).toUpperCase() + text.slice(1);
  }
  /* Só dá para navegar entre o mês atual e os meses que têm transações. */
  function monthBounds(txs) {
    var cur = monthKey(new Date()), min = cur, max = cur;
    txs.forEach(function (t) { var k = monthKey(new Date(t.date)); if (k < min) min = k; if (k > max) max = k; });
    return { min: min, max: max, cur: cur };
  }
  function clampMonth(key, b) { return key < b.min ? b.min : key > b.max ? b.max : key; }
  function monthNav(scope, key, b, plain) {
    return '<div class="mnav' + (plain ? " plain" : "") + '">' +
      '<button type="button" class="btn ghost icon" data-nav="' + scope + '" data-dir="-1" aria-label="Mês anterior"' + (key <= b.min ? " disabled" : "") + ">" + svg("left") + "</button>" +
      '<div class="mlabel">' + monthLabel(key) + (key !== b.cur ? ' <button type="button" class="btn ghost sm now" data-now="' + scope + '">Mês atual</button>' : "") + "</div>" +
      '<button type="button" class="btn ghost icon" data-nav="' + scope + '" data-dir="1" aria-label="Próximo mês"' + (key >= b.max ? " disabled" : "") + ">" + svg("right") + "</button></div>";
  }

  // ======================================================================
  // Estado
  // ======================================================================
  var state = { doc: emptyDoc(), config: null, status: "off", lastSync: null, error: null, tokenExp: null };
  var formType = "expense";
  var viewMonth = monthKey(new Date()); // mês exibido: cartão de saldo, lista e gráfico andam sempre juntos
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
  function updateTransaction(id, fields) {
    var stamp = nowIso();
    changeDoc(Object.assign({}, state.doc, { transactions: state.doc.transactions.map(function (t) {
      return t.id === id ? Object.assign({}, t, fields, { updatedAt: stamp }) : t;
    }) }));
  }
  function deleteTransaction(id) {
    var removed = state.doc.transactions.filter(function (t) { return t.id === id; })[0];
    var deleted = Object.assign({}, state.doc.deleted); deleted[id] = nowIso();
    changeDoc(Object.assign({}, state.doc, { transactions: state.doc.transactions.filter(function (t) { return t.id !== id; }), deleted: deleted }));
    if (!removed) return;
    // Desfazer: a transação volta com carimbo mais novo que a exclusão, então vence a exclusão na mesclagem entre aparelhos.
    toast("Transação excluída", false, { label: "Desfazer", run: function () {
      if (state.doc.transactions.some(function (t) { return t.id === id; })) return;
      var back = Object.assign({}, removed, { updatedAt: nowIso() });
      changeDoc(Object.assign({}, state.doc, { transactions: [back].concat(state.doc.transactions) }));
      viewMonth = monthKey(new Date(back.date));
      render();
      toast("Transação restaurada");
    } });
  }
  function addCategory(type, name) {
    var valid = validateCategoryName(type, name, state.doc.categories);
    var used = state.doc.categories.filter(function (c) { return c.type === type; }).map(function (c) { return c.color || hashColor(c.name); });
    var category = { id: uid(), type: type, name: valid, color: randomColor(used), order: Date.now(), updatedAt: nowIso() };
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

  // O GitHub informa a validade de tokens fine-grained no cabeçalho "github-authentication-token-expiration".
  function noteTokenExpiry(res) {
    try {
      var raw = res.headers && res.headers.get("github-authentication-token-expiration");
      var m = raw && /^(\d{4}-\d\d-\d\d) (\d\d:\d\d:\d\d) ?(UTC|[+-]\d{4})$/.exec(raw.trim());
      if (!m) return;
      var zone = m[3] === "UTC" ? "Z" : m[3].slice(0, 3) + ":" + m[3].slice(3);
      var t = Date.parse(m[1] + "T" + m[2] + zone);
      if (isFinite(t)) state.tokenExp = t;
    } catch (e) { /* cabeçalho não disponível: sem aviso antecipado */ }
  }
  function ghRequest(cfg, path, init) {
    init = init || {};
    var headers = { Accept: "application/vnd.github+json", Authorization: "Bearer " + cfg.token, "X-GitHub-Api-Version": "2022-11-28" };
    if (init.body) headers["Content-Type"] = "application/json";
    return fetch(API + path, { method: init.method || "GET", body: init.body, cache: "no-store", headers: headers })
      .catch(function () { throw new SyncError("Sem conexão com o GitHub", "network"); })
      .then(function (res) { noteTokenExpiry(res); return res; });
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

  function connect(repoInput, tokenInput) {
    var repo = parseRepo(repoInput), token = String(tokenInput).trim();
    if (!repo) return Promise.reject(new Error("Informe o repositório no formato usuario/repositorio"));
    if (!token) return Promise.reject(new Error("Informe a chave de acesso"));
    var cfg = { repo: repo, token: token };
    return checkRepo(cfg).then(function (info) {
      if (!info.canPush) throw new Error("A chave não tem permissão de escrita (Contents: Read and write) neste repositório");
      if (!lsSet(KEYS.cfg, JSON.stringify(cfg))) throw new Error("Não foi possível guardar a chave neste aparelho");
      setState({ config: cfg, status: "idle", error: null });
      return syncNow().then(function () { return { isPrivate: info.isPrivate }; });
    });
  }
  function disconnect() {
    clearTimeout(timer);
    lsDel(KEYS.cfg);
    setState({ config: null, status: "off", error: null, lastSync: null, tokenExp: null });
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
  // O saldo sempre começa oculto ao abrir o app (não é salvo); o estado vale até recarregar.
  var balanceHidden = true;
  var transactionsExpanded = false;
  function renderBalance(income, expense, month) {
    var net = income - expense;
    var phrase = net < 0 ? "Gaste menos, por favor." : "Se não comprar nada, o desconto é maior.";
    $("tagline").textContent = phrase;
    var mascot = net > 0
      ? '<img class="balance-mascot positive" src="./images/saldo-positivo.webp" alt="" aria-hidden="true">'
      : net < 0
        ? '<img class="balance-mascot negative" src="./images/saldo-negativo.webp" alt="" aria-hidden="true">'
        : "";
    $("balance").innerHTML = mascot +
      '<div class="lbl">' + svg("wallet") + "Saldo de " + esc(monthLabel(month)) + "</div>" +
      '<div class="sub">' + phrase + "</div>" +
      '<div class="total-row"><div class="total tnum wrap-any">' + (balanceHidden ? "R$ ••••••" : brl(net)) + "</div>" +
        '<button type="button" class="eye" id="eyeBtn" aria-pressed="' + (!balanceHidden) + '" aria-label="' + (balanceHidden ? "Mostrar saldo" : "Ocultar saldo") + '" title="' + (balanceHidden ? "Mostrar saldo" : "Ocultar saldo") + '">' + svg(balanceHidden ? "eye" : "eyeOff") + "</button></div>" +
      '<div class="stats"><div class="stats-content">' +
        '<div class="stat"><div class="lbl" style="display:flex;align-items:center;gap:.5rem;color:var(--balance-muted)"><span class="inc" style="display:grid;place-items:center">' + svg("up") + "</span>Receitas</div>" +
          '<div class="val tnum wrap-any">' + (balanceHidden ? "R$ ••••••" : brl(income)) + "</div></div>" +
        '<div class="stat"><div class="lbl" style="display:flex;align-items:center;gap:.5rem;color:var(--balance-muted)"><span class="exp" style="display:grid;place-items:center">' + svg("down") + "</span>Despesas</div>" +
          '<div class="val tnum wrap-any">' + (balanceHidden ? "R$ ••••••" : brl(expense)) + "</div></div>" +
      "</div></div>";
  }

  function renderList(all, bounds) {
    var sorted = all.filter(function (t) { return monthKey(new Date(t.date)) === viewMonth; })
      .sort(function (x, y) { return +new Date(y.date) - +new Date(x.date); });
    var html = '<section><div class="list-head"><h2>Transações recentes</h2><span>' + sorted.length + " no mês</span></div>" + monthNav("list", viewMonth, bounds);
    if (!sorted.length) { $("transactions").innerHTML = html + '<div class="empty in">Nenhuma transação em ' + monthLabel(viewMonth).toLocaleLowerCase("pt-BR") + ".</div></section>"; return; }
    html += '<button type="button" class="tx-expand" data-expand-transactions aria-expanded="' + transactionsExpanded + '">' +
      (transactionsExpanded ? "Recolher transações" : "Mostrar todas as transações (" + sorted.length + ")") + '</button>';
    if (!transactionsExpanded) { $("transactions").innerHTML = html + "</section>"; return; }
    html += '<ul class="tx-list">';
    sorted.forEach(function (tx) {
      var inc = tx.type === "income";
      var date = new Date(tx.date).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
      html += '<li class="tx">' +
        '<div class="ico ' + (inc ? "in" : "out") + '">' + svg(inc ? "up" : "down") + "</div>" +
        '<div class="info"><div class="d">' + esc(tx.description) + '</div><div class="m">' + esc(tx.category) + " · " + date + "</div></div>" +
        '<div class="amt tnum wrap-any">' + (inc ? "+" : "−") + " " + brl(tx.amount) + "</div>" +
        '<div class="acts">' +
          '<button type="button" class="btn ghost icon i44 muted-btn" data-edit="' + esc(tx.id) + '" aria-label="Editar ' + esc(tx.description) + '" title="Editar transação">' + svg("pencil") + "</button>" +
          '<button type="button" class="btn ghost icon i44 muted-btn del" data-del="' + esc(tx.id) + '" aria-label="Excluir ' + esc(tx.description) + '" title="Excluir transação">' + svg("trash") + "</button>" +
        "</div></li>";
    });
    $("transactions").innerHTML = html + "</ul></section>";
  }

  function renderChart(txs, bounds) {
    var map = {}, order = [];
    txs.forEach(function (t) {
      if (t.type !== "expense" || monthKey(new Date(t.date)) !== viewMonth) return;
      if (!(t.category in map)) { map[t.category] = 0; order.push(t.category); }
      map[t.category] += t.amount;
    });
    var data = order.map(function (n) { return { name: n, value: map[n], color: colorOf("expense", n) }; }).sort(function (a, b) { return b.value - a.value; });
    var total = data.reduce(function (s, d) { return s + d.value; }, 0);
    var html = "<h2>Despesas por categoria</h2>" + monthNav("chart", viewMonth, bounds, true);
    if (!data.length) {
      $("chart").innerHTML = html + '<div class="empty-c">Sem despesas em ' + monthLabel(viewMonth).toLocaleLowerCase("pt-BR") + "</div>";
      return;
    }
    var R = 70, C = 2 * Math.PI * R, gap = data.length > 1 ? (2 / 360) * C : 0, acc = 0;
    var rings = data.map(function (d) {
      var len = (d.value / total) * C;
      var circle = '<circle r="' + R + '" cx="0" cy="0" fill="none" stroke-width="30" style="stroke:' + d.color + '" ' +
        'stroke-dasharray="' + Math.max(len - gap, 0.01).toFixed(3) + " " + C.toFixed(3) + '" stroke-dashoffset="' + (-acc).toFixed(3) + '" transform="rotate(-90)">' +
        "<title>" + esc(d.name) + ": " + brl(d.value) + "</title></circle>";
      acc += len;
      return circle;
    }).join("");
    html += '<div class="donut"><svg viewBox="-100 -96 200 192" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Despesas por categoria">' + rings + "</svg>" +
      '<div class="center"><div><div class="t">Total</div><div class="v">' + brl(total) + "</div></div></div></div>";
    html += '<ul class="legend">' + data.map(function (d) {
      return '<li><div class="n"><span class="dot" style="background:' + d.color + '"></span><span>' + esc(d.name) + '</span></div><span class="v tnum">' + brl(d.value) + "</span></li>";
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
    var list = sortedCats(formType, state.doc.categories);
    $("catList").innerHTML = list.length ? list.map(function (c) {
      return '<li><span style="display:flex;align-items:center;gap:.5rem;min-width:0"><span class="dot2" style="background:' + (c.color || hashColor(c.name)) + '"></span><span style="min-width:0;overflow-wrap:break-word">' + esc(c.name) + "</span></span>" +
        '<button type="button" class="btn ghost i44 muted-btn del" data-delcat="' + esc(c.id) + '" aria-label="Excluir categoria ' + esc(c.name) + '" title="Excluir categoria">' + svg("trash") + "</button></li>";
    }).join("") : '<li class="std"><span class="muted">Nenhuma categoria. Cadastre uma acima.</span></li>';
  }

  function renderSyncAlert() {
    var el = $("syncAlert"), msg = "";
    if (state.config && state.status === "error") {
      msg = (state.error || "Falha na sincronização") + ". Seus dados continuam salvos neste aparelho. Toque para resolver.";
    } else if (state.config && state.tokenExp) {
      var days = Math.ceil((state.tokenExp - Date.now()) / 86400000);
      if (days <= 0) msg = "A chave de acesso expirou. Toque para colocar uma nova.";
      else if (days <= 7) msg = "A chave de acesso expira em " + days + (days === 1 ? " dia" : " dias") + ". Gere uma nova e atualize em Sincronização. Toque para abrir.";
    }
    el.textContent = msg;
    el.classList.toggle("hidden", !msg);
  }
  function renderSync() {
    renderSyncAlert();
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
    }
  }

  function render() {
    var bounds = monthBounds(state.doc.transactions);
    viewMonth = clampMonth(viewMonth, bounds);
    // Saldo, receitas e despesas do cartão seguem o mês exibido (o mesmo da lista e do gráfico).
    var income = 0, expense = 0;
    state.doc.transactions.forEach(function (t) {
      if (monthKey(new Date(t.date)) !== viewMonth) return;
      if (t.type === "income") income += t.amount; else expense += t.amount;
    });
    renderBalance(income, expense, viewMonth);
    renderList(state.doc.transactions, bounds);
    renderChart(state.doc.transactions, bounds);
    renderCategorySelect();
    if ($("catDialog").open) renderCatDialog();
    renderSync();
  }

  // ======================================================================
  // Eventos
  // ======================================================================
  // No celular o formulário começa recolhido: só aparecem "Despesa" e "Receita"; ao tocar em um, os campos descem.
  var formOpen = false;
  function isMobile() { return window.matchMedia("(max-width: 767px)").matches; }
  function paintToggle() {
    var visible = !isMobile() || formOpen;
    document.querySelectorAll("#form .toggle .btn").forEach(function (b) {
      var on = visible && b.getAttribute("data-type") === formType;
      b.classList.toggle("on", on);
      b.setAttribute("aria-pressed", String(on));
      b.setAttribute("aria-expanded", String(visible));
    });
  }
  function setFormOpen(open) {
    formOpen = open;
    $("form").classList.toggle("open", open);
    paintToggle();
  }
  function collapseFormOnMobile() { if (isMobile() && formOpen) setFormOpen(false); }
  function setType(type) {
    formType = type;
    formCategory = categoryOptions(type, state.doc.categories)[0];
    paintToggle();
    renderCategorySelect();
  }

  function localDay(d) { return d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2); }
  function todayInput() { return localDay(new Date()); }
  /* Hoje: usa o instante atual. Outro dia: meio-dia local desse dia (evita virar o dia por fuso). */
  function dateFromInput(value) {
    if (!value) return nowIso();
    if (value === todayInput()) return nowIso();
    var p = value.split("-");
    var d = new Date(+p[0], +p[1] - 1, +p[2], 12, 0, 0);
    return isNaN(d.getTime()) || localDay(d) !== value ? null : d.toISOString();
  }

  // ---------- edição de transação ----------
  var editingId = null, editType = "expense";
  function fillEditCategories(selected) {
    var opts = categoryOptions(editType, state.doc.categories);
    if (selected && opts.indexOf(selected) < 0) opts = opts.concat([selected]); // categoria já excluída: mantém a atual
    $("eCategory").innerHTML = opts.map(function (c) { return '<option value="' + esc(c) + '">' + esc(c) + "</option>"; }).join("");
    $("eCategory").value = selected && opts.indexOf(selected) >= 0 ? selected : opts[0];
  }
  function setEditType(type, selectedCategory) {
    editType = type;
    document.querySelectorAll("#editForm .toggle .btn").forEach(function (b) {
      var on = b.getAttribute("data-etype") === type;
      b.classList.toggle("on", on);
      b.setAttribute("aria-pressed", String(on));
    });
    fillEditCategories(selectedCategory || null);
  }
  function openEdit(id) {
    var tx = state.doc.transactions.filter(function (t) { return t.id === id; })[0];
    if (!tx) return;
    editingId = id;
    $("eAmount").value = tx.amount.toFixed(2).replace(".", ",");
    $("eDate").value = localDay(new Date(tx.date));
    $("eDesc").value = tx.description;
    $("eErr").classList.add("hidden");
    setEditType(tx.type, tx.category);
    $("editDialog").showModal();
  }
  function saveEdit() {
    var tx = state.doc.transactions.filter(function (t) { return t.id === editingId; })[0];
    var err = $("eErr");
    function fail(message) { err.textContent = message; err.classList.remove("hidden"); }
    if (!tx) { $("editDialog").close(); return; }
    var value = parseFloat($("eAmount").value.replace(",", "."));
    if (!value || value <= 0) return fail("Informe um valor válido");
    var dayValue = $("eDate").value;
    // Mesma data: preserva o horário original. Outra data: usa o critério do formulário de lançamento.
    var when = !dayValue || dayValue === localDay(new Date(tx.date)) ? tx.date : dateFromInput(dayValue);
    if (!when) return fail("Informe uma data válida");
    var cat = $("eCategory").value;
    var movedTo = monthKey(new Date(when));
    if (movedTo !== monthKey(new Date(tx.date))) viewMonth = movedTo; // acompanha a transação para o novo mês
    updateTransaction(editingId, { type: editType, amount: value, category: cat, description: $("eDesc").value.trim() || cat, date: when });
    $("editDialog").close();
    editingId = null;
    toast("Transação atualizada");
  }

  function openDialog(dlg) { if (!dlg.open) dlg.showModal(); }
  function wireDialog(dlg) {
    dlg.addEventListener("click", function (e) { if (e.target === dlg) dlg.close(); }); // clique no fundo fecha
  }

  /* Cartão roxo: arrastar para a esquerda mostra o mês seguinte; para a direita, o anterior. */
  function initSwipe() {
    var el = $("balance"), startX = 0, startY = 0, dx = 0, id = null, dragging = false, busy = false;
    function canGo(dir) {
      var b = monthBounds(state.doc.transactions), next = shiftMonth(viewMonth, dir);
      return next >= b.min && next <= b.max;
    }
    function snapBack() {
      el.style.transition = "transform .2s ease, opacity .2s ease";
      el.style.transform = ""; el.style.opacity = "";
    }
    function go(dir) {
      if (!canGo(dir)) return false;
      busy = true;
      el.style.transition = "transform .16s ease-in, opacity .16s ease-in";
      el.style.transform = "translateX(" + (-dir * 40) + "%)"; el.style.opacity = "0";
      setTimeout(function () {
        viewMonth = shiftMonth(viewMonth, dir);
        collapseFormOnMobile();
        render();
        el.style.transition = "none";
        el.style.transform = "translateX(" + (dir * 40) + "%)";
        void el.offsetWidth;
        el.style.transition = "transform .2s ease-out, opacity .2s ease-out";
        el.style.transform = ""; el.style.opacity = "";
        setTimeout(function () { busy = false; el.style.transition = ""; }, 230);
      }, 160);
      return true;
    }
    el.addEventListener("pointerdown", function (e) {
      if (busy || e.pointerType !== "touch") return;
      id = e.pointerId; startX = e.clientX; startY = e.clientY; dx = 0; dragging = false;
    });
    el.addEventListener("pointermove", function (e) {
      if (e.pointerId !== id) return;
      dx = e.clientX - startX;
      var dy = e.clientY - startY;
      if (!dragging) {
        if (Math.abs(dx) < 8 || Math.abs(dx) < Math.abs(dy)) return;
        dragging = true;
        try { el.setPointerCapture(id); } catch (err) { /* ignora */ }
      }
      el.style.transition = "none";
      el.style.transform = "translateX(" + (dx * (canGo(dx < 0 ? 1 : -1) ? 0.6 : 0.2)) + "px)"; // sem mês nessa direção: resiste
    });
    function end(e) {
      if (e.pointerId !== id) return;
      id = null;
      if (!dragging) return;
      dragging = false;
      if (e.type === "pointerup" && Math.abs(dx) >= 60 && go(dx < 0 ? 1 : -1)) return;
      snapBack();
    }
    el.addEventListener("pointerup", end);
    el.addEventListener("pointercancel", end);
  }

  function init() {
    // textos e ícones fixos
    document.querySelector('[data-type="expense"]').innerHTML = svg("down") + "Despesa";
    document.querySelector('[data-type="income"]').innerHTML = svg("up") + "Receita";
    document.querySelector('[data-etype="expense"]').innerHTML = svg("down") + "Despesa";
    document.querySelector('[data-etype="income"]').innerHTML = svg("up") + "Receita";
    $("catManage").innerHTML = svg("sliders");
    $("catAdd").innerHTML = svg("plus");
    $("addBtn").innerHTML = svg("plus") + " Adicionar";
    $("exportBtn").innerHTML = svg("download") + " Baixar";
    $("importBtn").innerHTML = svg("upload") + " Importar";
    $("connectBtn").innerHTML = svg("cloud") + " Conectar e sincronizar";
    $("today").textContent = new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });
    ["catDialog", "confirmDialog", "syncDialog", "editDialog"].forEach(function (id) { wireDialog($(id)); });

    // transações
    document.querySelectorAll("#form .toggle .btn").forEach(function (b) {
      b.addEventListener("click", function () {
        var type = b.getAttribute("data-type");
        if (isMobile()) {
          if (formOpen && formType === type) { setFormOpen(false); return; } // tocar de novo no tipo ativo recolhe
          setFormOpen(true);
        }
        setType(type);
      });
    });
    var mq = window.matchMedia("(max-width: 767px)");
    var onMq = function () { paintToggle(); };
    if (mq.addEventListener) mq.addEventListener("change", onMq); else if (mq.addListener) mq.addListener(onMq);
    $("category").addEventListener("change", function (e) { formCategory = e.target.value; });
    $("form").addEventListener("submit", function (e) {
      e.preventDefault();
      var value = parseFloat($("amount").value.replace(",", "."));
      if (!value || value <= 0) { toast("Informe um valor válido", true); return; }
      var when = dateFromInput($("date").value);
      if (!when) { toast("Informe uma data válida", true); return; }
      var cat = selectedCategory();
      addTransaction({ id: uid(), type: formType, amount: value, category: cat, description: $("desc").value.trim() || cat, date: when });
      var shown = monthKey(new Date(when));
      viewMonth = shown; // mostra o mês da transação recém-criada
      $("amount").value = ""; $("desc").value = ""; $("date").value = todayInput();
      render();
      if (isMobile()) setFormOpen(false); // volta ao formato compacto
      toast("Transação adicionada");
    });
    $("transactions").addEventListener("click", function (e) {
      var expand = e.target.closest("[data-expand-transactions]");
      if (expand) {
        transactionsExpanded = !transactionsExpanded;
        renderList(state.doc.transactions, monthBounds(state.doc.transactions));
        return;
      }
      var edit = e.target.closest("[data-edit]");
      if (edit) { openEdit(edit.getAttribute("data-edit")); return; }
      var btn = e.target.closest("[data-del]");
      if (btn) deleteTransaction(btn.getAttribute("data-del"));
    });
    document.querySelectorAll("#editForm .toggle .btn").forEach(function (b) {
      b.addEventListener("click", function () { setEditType(b.getAttribute("data-etype")); });
    });
    $("editForm").addEventListener("submit", function (e) { e.preventDefault(); saveEdit(); });
    $("eCancel").addEventListener("click", function () { $("editDialog").close(); editingId = null; });
    function onMonthClick(e) {
      var nav = e.target.closest("[data-nav]"), now = e.target.closest("[data-now]");
      if (!nav && !now) return;
      // Qualquer um dos dois controles (lista ou gráfico) muda o mês de tudo.
      viewMonth = nav ? shiftMonth(viewMonth, +nav.getAttribute("data-dir")) : monthKey(new Date());
      transactionsExpanded = false;
      collapseFormOnMobile(); // trocar de mês devolve o formulário ao modo compacto
      render();
    }
    $("transactions").addEventListener("click", onMonthClick);
    $("chart").addEventListener("click", onMonthClick);

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
    $("balance").addEventListener("click", function (e) {
      if (!e.target.closest("#eyeBtn")) return;
      balanceHidden = !balanceHidden;
      render();
    });
    $("syncAlert").addEventListener("click", function () { $("syncBtn").click(); });
    $("syncBtn").addEventListener("click", function () { $("syncFormErr").classList.add("hidden"); renderSync(); openDialog($("syncDialog")); });
    $("syncClose").addEventListener("click", function () { $("syncDialog").close(); });
    $("syncNowBtn").addEventListener("click", function () { syncNow(); });
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
    lsDel("guigsbank.avatar.v1"); // foto privada da versão anterior: não é mais usada
    state.doc = ensureDefaults(loadDoc());
    state.config = config;
    state.status = config ? "idle" : "off";
    persistDoc();
    $("date").value = todayInput();
    setType("expense");
    render();
    initSwipe();
    if (config) syncNow();

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

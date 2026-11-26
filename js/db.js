/* Acesso à base de dados. Usa o Firebase Realtime Database quando config.js está preenchido;
   caso contrário, um modo de demonstração guardado no localStorage deste navegador. */
(function () {
  const cfg = window.FIREBASE_CONFIG || {};
  const modoDemo = !cfg.apiKey || !cfg.databaseURL;

  function negado() { const e = new Error("PERMISSION_DENIED"); e.code = "PERMISSION_DENIED"; return e; }

  if (!modoDemo) {
    firebase.initializeApp(cfg);
    const db = firebase.database();
    window.DB = {
      demo: false,
      agora: () => firebase.database.ServerValue.TIMESTAMP,
      get: async (p) => (await db.ref(p).get()).val(),
      set: (p, v) => db.ref(p).set(v),
      update: (p, v) => db.ref(p).update(v),
      remove: (p) => db.ref(p).remove(),
      on: (p, cb, erro) => {
        const r = db.ref(p);
        const h = (s) => cb(s.val());
        r.on("value", h, erro);
        return () => r.off("value", h);
      },
      auth: {
        entrar: (email, senha) => firebase.auth().signInWithEmailAndPassword(email, senha),
        sair: () => firebase.auth().signOut(),
        aoMudar: (cb) => firebase.auth().onAuthStateChanged(cb),
      },
    };
    return;
  }

  /* ---------- Modo de demonstração ---------- */
  const CHAVE = "dpcm-votacao-demo";
  let arvore;
  try { arvore = JSON.parse(localStorage.getItem(CHAVE) || "null"); } catch (e) { arvore = null; }
  const ouvintes = [];

  function partes(p) { return String(p).split("/").filter(Boolean); }
  function ler(p) {
    let n = arvore;
    for (const k of partes(p)) { if (n == null || typeof n !== "object") return null; n = n[k]; }
    return n === undefined ? null : JSON.parse(JSON.stringify(n));
  }
  function escrever(p, v) {
    const ks = partes(p);
    if (!ks.length) { arvore = v || {}; return; }
    if (!arvore || typeof arvore !== "object") arvore = {};
    let n = arvore;
    for (let i = 0; i < ks.length - 1; i++) {
      if (n[ks[i]] == null || typeof n[ks[i]] !== "object") n[ks[i]] = {};
      n = n[ks[i]];
    }
    if (v === null || v === undefined) delete n[ks[ks.length - 1]];
    else n[ks[ks.length - 1]] = JSON.parse(JSON.stringify(v));
  }
  function gravar() {
    try { localStorage.setItem(CHAVE, JSON.stringify(arvore)); } catch (e) {}
    ouvintes.forEach((o) => o.cb(ler(o.p)));
  }
  window.addEventListener("storage", (e) => {
    if (e.key !== CHAVE) return;
    try { arvore = JSON.parse(e.newValue || "null"); } catch (x) {}
    ouvintes.forEach((o) => o.cb(ler(o.p)));
  });

  /* As mesmas verificações das regras do Firebase, para o teste ser fiel. */
  function validarVoto(p, v) {
    const m = String(p).match(/^votos([12])\/([A-Z0-9]+)$/);
    if (!m) return;
    const fase = m[1], cod = m[2];
    if (ler(p) !== null) throw negado();
    const c = ler("codigos/" + cod);
    const conf = ler("config") || {};
    if (!c) throw negado();
    if (conf.fase !== "fase" + fase) throw negado();
    if (!v || v.setor !== c.setor || typeof v.candidato !== "string" || v.candidato === c.pid) throw negado();
    if (fase === "1") {
      if (c.chefe && !conf.chefesFase1) throw negado();
      if (!ler("candidatos/" + v.setor + "/" + v.candidato)) throw negado();
    } else {
      if (!c.chefe) throw negado();
      if (ler("finalistas/" + v.setor + "/" + v.candidato) === null) throw negado();
    }
  }

  window.DB = {
    demo: true,
    agora: () => Date.now(),
    get: async (p) => ler(p),
    set: async (p, v) => { validarVoto(p, v); escrever(p, v); gravar(); },
    update: async (p, obj) => { for (const k in obj) escrever((p ? p + "/" : "") + k, obj[k]); gravar(); },
    remove: async (p) => { escrever(p, null); gravar(); },
    on: (p, cb) => { const o = { p, cb }; ouvintes.push(o); setTimeout(() => cb(ler(p)), 0); return () => ouvintes.splice(ouvintes.indexOf(o), 1); },
    auth: (function () {
      let u = sessionStorage.getItem("dpcm-demo-admin") ? { email: "demonstracao" } : null;
      const cbs = [];
      return {
        entrar: async () => { u = { email: "demonstracao" }; sessionStorage.setItem("dpcm-demo-admin", "1"); cbs.forEach((c) => c(u)); },
        sair: async () => { u = null; sessionStorage.removeItem("dpcm-demo-admin"); cbs.forEach((c) => c(u)); },
        aoMudar: (c) => { cbs.push(c); setTimeout(() => c(u), 0); },
      };
    })(),
    /* Prepara dados de teste na primeira visita. */
    semear: function () {
      if (arvore) return;
      arvore = {};
      escrever("config", { fase: "fase1", chefesFase1: false });
      escrever("candidatos", VOT.mapaCandidatos());
      escrever("codigos", VOT.gerarCodigos({}, VOT.rngSemente(2026)));
      gravar();
    },
    reiniciarDemo: function () { arvore = null; localStorage.removeItem(CHAVE); this.semear(); },
  };
})();

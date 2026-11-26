/* Acesso à base de dados e às contas. Usa o Firebase quando config.js está preenchido;
   caso contrário, um modo de demonstração guardado no localStorage deste navegador. */
(function () {
  const cfg = window.FIREBASE_CONFIG || {};
  const modoDemo = !cfg.apiKey || !cfg.databaseURL;
  const DOMINIO = /^[^@\s]+@ins\.gov\.mz$/i;

  function erro(code) { const e = new Error(code); e.code = code; return e; }

  if (!modoDemo) {
    firebase.initializeApp(cfg);
    const db = firebase.database();
    const auth = firebase.auth();
    const ligacao = () => ({ url: location.href.split("#")[0], handleCodeInApp: false });
    window.DB = {
      demo: false,
      DOMINIO,
      agora: () => firebase.database.ServerValue.TIMESTAMP,
      get: async (p) => (await db.ref(p).get()).val(),
      set: (p, v) => db.ref(p).set(v),
      update: (p, v) => db.ref(p || "/").update(v),
      remove: (p) => db.ref(p).remove(),
      on: (p, cb, falha) => {
        const r = db.ref(p);
        const h = (s) => cb(s.val());
        r.on("value", h, falha);
        return () => r.off("value", h);
      },
      auth: {
        utilizador: () => auth.currentUser,
        criarConta: async (email, senha) => {
          const c = await auth.createUserWithEmailAndPassword(email, senha);
          return c.user;
        },
        reenviar: async () => {
          const u = auth.currentUser;
          try { await u.sendEmailVerification(ligacao()); } catch (e) { await u.sendEmailVerification(); }
        },
        /* Depois de clicar na ligação do e-mail, o token tem de ser renovado para as regras o reconhecerem. */
        actualizar: async () => { const u = auth.currentUser; if (!u) return null; await u.reload(); await u.getIdToken(true); return auth.currentUser; },
        entrar: (email, senha) => auth.signInWithEmailAndPassword(email, senha),
        recuperar: (email) => auth.sendPasswordResetEmail(email),
        sair: () => auth.signOut(),
        aoMudar: (cb) => auth.onAuthStateChanged(cb),
      },
    };
    return;
  }

  /* ---------- Modo de demonstração ---------- */
  const CHAVE = "dpcm-votacao-demo-v2";
  let arvore;
  try { arvore = JSON.parse(localStorage.getItem(CHAVE) || "null"); } catch (e) { arvore = null; }
  const ouvintes = [];
  const partes = (p) => String(p).split("/").filter(Boolean);
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
    for (let i = 0; i < ks.length - 1; i++) { if (n[ks[i]] == null || typeof n[ks[i]] !== "object") n[ks[i]] = {}; n = n[ks[i]]; }
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

  let atual = null;
  try { atual = JSON.parse(localStorage.getItem("dpcm-demo-sessao") || "null"); } catch (e) {}
  const cbsAuth = [];
  function mudar(u) {
    atual = u;
    if (u) localStorage.setItem("dpcm-demo-sessao", JSON.stringify(u)); else localStorage.removeItem("dpcm-demo-sessao");
    cbsAuth.forEach((c) => c(u));
  }
  const chaveEmail = (e) => String(e).toLowerCase().replace(/[.#$\[\]\/]/g, "_");

  /* As mesmas verificações das regras do Firebase, para o teste ser fiel. */
  function validar(caminho, v) {
    const m = String(caminho).match(/^votos([12])\/(.+)$/);
    if (!m) return;
    const fase = m[1], uid = m[2];
    if (!atual || atual.uid !== uid) throw erro("PERMISSION_DENIED");
    if (ler(caminho) !== null) throw erro("PERMISSION_DENIED");
    const r = ler("registos/" + uid), conf = ler("config") || {};
    const faseAtual = conf.fase === "fase2" || conf.fase === "encerrada" ? conf.fase : "fase1";
    if (!r || faseAtual !== "fase" + fase) throw erro("PERMISSION_DENIED");
    if (!v || v.setor !== r.setor || typeof v.candidato !== "string" || v.candidato === r.pid) throw erro("PERMISSION_DENIED");
    if (fase === "1") {
      const c = ler("pessoas/" + v.candidato);
      if (!c || c.setor !== v.setor || c.chefe) throw erro("PERMISSION_DENIED");
    } else {
      if (!r.chefe || ler("finalistas/" + v.setor + "/" + v.candidato) === null) throw erro("PERMISSION_DENIED");
    }
  }
  /* Voto sem conta: votos/<pid>, votaram/<pid> e emails/<chave> têm de ser gravados juntos. */
  function validarVotoSemConta(obj) {
    const k = Object.keys(obj).find((x) => /^votos\/[a-z0-9]+$/.test(x));
    if (!k || obj[k] === null) return;
    const pid = k.split("/")[1], v = obj[k], conf = ler("config") || {};
    const nega = () => { throw erro("PERMISSION_DENIED"); };
    if (ler(k) || conf.fase === "encerrada") nega();
    const p = ler("pessoas/" + pid);
    if (!p || !v || v.setor !== p.setor || typeof v.email !== "string" || !/^[a-z0-9._%+-]+@ins\.gov\.mz$/.test(v.email.toLowerCase())) nega();
    if (typeof v.candidato !== "string" || v.candidato === pid) nega();
    const c = ler("pessoas/" + v.candidato);
    if (!c || c.setor !== v.setor || c.chefe) nega();
    const ch = v.email.toLowerCase().replace(/\./g, ",");
    if (obj["votaram/" + pid] !== true || ler("emails/" + ch) || obj["emails/" + ch] !== pid) nega();
  }

  window.DB = {
    demo: true,
    DOMINIO,
    agora: () => Date.now(),
    get: async (p) => ler(p),
    set: async (p, v) => { validar(p, v); escrever(p, v); gravar(); },
    update: async (p, obj) => {
      if (!p) validarVotoSemConta(obj);
      for (const k in obj) escrever((p ? p + "/" : "") + k, obj[k]);
      gravar();
    },
    remove: async (p) => { escrever(p, null); gravar(); },
    on: (p, cb) => { const o = { p, cb }; ouvintes.push(o); setTimeout(() => cb(ler(p)), 0); return () => { const i = ouvintes.indexOf(o); if (i >= 0) ouvintes.splice(i, 1); }; },
    auth: {
      utilizador: () => atual,
      criarConta: async (email, senha) => {
        const k = chaveEmail(email);
        if (ler("_contas/" + k)) throw erro("auth/email-already-in-use");
        const u = { uid: "demo" + Math.random().toString(36).slice(2, 10), email: email.toLowerCase(), emailVerified: true };
        escrever("_contas/" + k, Object.assign({ senha }, u)); gravar();
        mudar(u);
        return u;
      },
      reenviar: async () => {},
      actualizar: async () => atual,
      entrar: async (email, senha) => {
        const c = ler("_contas/" + chaveEmail(email));
        if (!c || c.senha !== senha) throw erro("auth/invalid-credential");
        mudar({ uid: c.uid, email: c.email, emailVerified: true });
      },
      recuperar: async () => {},
      sair: async () => mudar(null),
      aoMudar: (c) => { cbsAuth.push(c); setTimeout(() => c(atual), 0); },
    },
    semear: function () {
      if (arvore) return;
      arvore = {};
      escrever("config", { fase: "fase1" });
      escrever("pessoas", VOT.mapaPessoas());
      gravar();
    },
    reiniciarDemo: function () { arvore = null; localStorage.removeItem(CHAVE); mudar(null); this.semear(); },
  };
})();

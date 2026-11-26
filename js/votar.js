(function () {
  const $ = (s) => document.querySelector(s);
  const { SETOR, PESSOA, icone, faixa, esc, aviso, dataHora, NOME_FASE } = VOT;
  const PENDENTE = "dpcm-registo-pendente";
  let config = null;
  let utilizador = null; // conta Firebase
  let registo = null;    // {pid, setor, chefe, email}
  let finalistas = {};
  let ocupados = {};
  let modo = "entrar";   // entrar | criar | recuperar

  document.title = TITULO_VOTACAO + " · DPCM";
  $("#tituloTopo").textContent = TITULO_VOTACAO;
  $("#sobre").textContent = TITULO_VOTACAO;
  $("#malhaTopo").innerHTML = faixa(60, 28, 0);
  $("#malhaBase").innerHTML = faixa(80, 22, 5).replace('class="malha"', 'class="malha malha-base"');
  $("#passos").innerHTML =
    "<li><b>Registo</b>Seleccione o departamento ou unidade e o seu nome, e crie a conta com o e-mail institucional.</li>" +
    "<li><b>Votação</b>Escolha um colega do mesmo departamento ou unidade. Os chefes também votam, mas não podem ser votados.</li>" +
    "<li><b>Anonimato</b>Os resultados são apresentados apenas em totais. Cada pessoa vota uma única vez.</li>";

  if (DB.demo) {
    DB.semear();
    $("#faixaDemo").innerHTML = '<div class="faixa-demo"><div><b>Modo de demonstração.</b> A base de dados ainda não está configurada. As contas e os votos ficam guardados apenas neste navegador. </div></div>';
  }

  DB.on("config", (c) => {
    config = c || {};
    const f = config.fase === "encerrada" ? "encerrada" : "fase1";
    const e = $("#estado");
    e.textContent = NOME_FASE[f];
    e.className = "estado " + f;
    desenhar();
  });
  DB.on("finalistas", (f) => { finalistas = f || {}; if (registo && config && config.fase === "fase2") desenhar(); });
  DB.on("ocupados", (o) => { ocupados = o || {}; if (!utilizador && modo === "criar") actualizarNomes("regSetor", "regNome"); }, () => {});

  DB.auth.aoMudar(async (u) => {
    utilizador = u;
    registo = null;
    if (u) { try { registo = await DB.get("registos/" + u.uid); } catch (e) { registo = null; } }
    desenhar();
  });

  /* ---------- Listas de sector e de nome ---------- */
  function opcoesSetor() {
    return '<option value="">Seleccione o departamento ou unidade</option>' + VOT.ativos().map((s) => '<option value="' + s.id + '">' + esc(s.nome) + "</option>").join("");
  }
  function actualizarNomes(idSetor, idNome) {
    const sel = document.getElementById(idSetor), nome = document.getElementById(idNome);
    if (!sel || !nome) return;
    const atual = nome.value;
    const s = SETOR[sel.value];
    if (!s) { nome.innerHTML = '<option value="">Seleccione primeiro o departamento ou unidade</option>'; nome.disabled = true; return; }
    nome.disabled = false;
    nome.innerHTML = '<option value="">Seleccione o seu nome</option>' + s.pessoas.slice().sort((a, b) => a.nome.localeCompare(b.nome, "pt")).map((p) => {
      const oc = !!ocupados[p.id];
      return '<option value="' + p.id + '"' + (oc ? " disabled" : "") + (p.id === atual && !oc ? " selected" : "") + ">" + esc(p.nome) + (oc ? " (já registado)" : "") + "</option>";
    }).join("");
  }

  /* ---------- Conta ---------- */
  function msgErro(e) {
    const c = (e && e.code) || "";
    if (c.includes("email-already-in-use")) return "Já existe uma conta com este e-mail. Utilize a opção «Iniciar sessão».";
    if (c.includes("weak-password")) return "A palavra-passe deve ter, no mínimo, 6 caracteres.";
    if (c.includes("invalid-email")) return "O endereço de e-mail indicado não é válido.";
    if (c.includes("too-many-requests")) return "Foram feitas demasiadas tentativas. Aguarde alguns minutos e tente novamente.";
    if (c.includes("network")) return "Sem ligação à internet. Verifique a ligação e tente novamente.";
    if (c.includes("invalid-credential") || c.includes("wrong-password") || c.includes("user-not-found")) return "E-mail ou palavra-passe incorrectos.";
    return "Não foi possível concluir a operação. Tente novamente.";
  }

  function desenharConta() {
    const box = $("#cartaoConta");
    const abas = '<div class="abas-conta"><button data-m="entrar" class="' + (modo === "entrar" ? "ativa" : "") + '">Iniciar sessão</button><button data-m="criar" class="' + (modo === "criar" ? "ativa" : "") + '">Registo</button></div>';
    const campoEmail = '<label class="campo" for="email">E-mail institucional</label><input class="texto" id="email" type="email" autocomplete="username" placeholder="nome.apelido@ins.gov.mz">';
    let corpo;
    if (modo === "recuperar") {
      corpo = '<h2>Recuperação da palavra-passe</h2><p class="ajuda">Indique o seu e-mail institucional. Receberá uma ligação para definir uma nova palavra-passe.</p>' +
        '<form id="formConta">' + campoEmail + '<div class="erro" id="erroConta"></div><button class="btn btn-pri btn-larg" type="submit">Enviar ligação</button></form><p><button class="link" data-m="entrar">Voltar a «Iniciar sessão»</button></p>';
    } else if (modo === "criar") {
      corpo = abas + '<p class="ajuda">Seleccione o seu departamento ou unidade e o seu nome. Estes dados ficam associados à conta e não podem ser alterados depois do registo.</p>' +
        '<form id="formConta" autocomplete="on">' +
        '<label class="campo" for="regSetor">Departamento ou unidade</label><select class="texto" id="regSetor">' + opcoesSetor() + "</select>" +
        '<label class="campo" for="regNome" style="margin-top:12px">Nome</label><select class="texto" id="regNome" disabled><option value="">Seleccione primeiro o departamento ou unidade</option></select>' +
        '<div style="height:12px"></div>' + campoEmail +
        '<label class="campo" for="senha" style="margin-top:12px">Palavra-passe</label><input class="texto" id="senha" type="password" autocomplete="new-password">' +
        '<label class="campo" for="senha2" style="margin-top:12px">Confirmação da palavra-passe</label><input class="texto" id="senha2" type="password" autocomplete="new-password">' +
        '<div class="erro" id="erroConta" role="alert"></div><button class="btn btn-pri btn-larg" type="submit">Registar</button></form>';
    } else {
      corpo = abas + '<p class="ajuda">Introduza o e-mail institucional e a palavra-passe definidos no registo.</p>' +
        '<form id="formConta" autocomplete="on">' + campoEmail +
        '<label class="campo" for="senha" style="margin-top:12px">Palavra-passe</label><input class="texto" id="senha" type="password" autocomplete="current-password">' +
        '<div class="erro" id="erroConta" role="alert"></div><button class="btn btn-pri btn-larg" type="submit">Iniciar sessão</button></form>' +
        '<p style="margin:10px 0 0"><button class="link" data-m="recuperar">Esqueceu-se da palavra-passe?</button></p>';
    }
    box.innerHTML = corpo + '<div class="nota">Apenas são aceites e-mails @ins.gov.mz. Cada nome fica associado a uma única conta e cada conta vota uma única vez.</div>';
    box.querySelectorAll("[data-m]").forEach((b) => (b.onclick = () => { modo = b.dataset.m; desenharConta(); }));
    if (modo === "criar") $("#regSetor").onchange = () => actualizarNomes("regSetor", "regNome");

    $("#formConta").addEventListener("submit", async (ev) => {
      ev.preventDefault();
      const email = $("#email").value.trim().toLowerCase();
      const err = $("#erroConta");
      err.textContent = "";
      if (modo === "criar" && !$("#regNome").value) { err.textContent = "Seleccione o departamento ou unidade e o seu nome."; return; }
      if (!DB.DOMINIO.test(email)) { err.textContent = "Indique o seu e-mail institucional (terminado em @ins.gov.mz)."; return; }
      const btn = ev.target.querySelector("button[type=submit]");
      btn.disabled = true;
      try {
        if (modo === "recuperar") { await DB.auth.recuperar(email); aviso("Se o e-mail estiver registado, receberá uma ligação de recuperação."); modo = "entrar"; desenharConta(); return; }
        const senha = $("#senha").value;
        if (modo === "criar") {
          if (senha.length < 6) { err.textContent = "A palavra-passe deve ter, no mínimo, 6 caracteres."; return; }
          if (senha !== $("#senha2").value) { err.textContent = "As palavras-passe indicadas não coincidem."; return; }
          try { localStorage.setItem(PENDENTE, JSON.stringify({ email, pid: $("#regNome").value })); } catch (e) {}
          await DB.auth.criarConta(email, senha);
          aviso("Conta criada.");
        } else {
          await DB.auth.entrar(email, senha);
        }
      } catch (e) { err.textContent = msgErro(e); }
      finally { btn.disabled = false; }
    });
  }

  /* ---------- Ecrãs ---------- */
  function desenhar() {
    if (!config) return;
    if (!utilizador) {
      $("#ecraBoletim").hidden = true;
      $("#ecraEntrada").hidden = false;
      desenharConta();
      return;
    }
    if (!registo) return desenharIdentificacao();
    desenharBoletim();
  }

  function mostrar(html) {
    const box = $("#ecraBoletim");
    box.innerHTML = html;
    $("#ecraEntrada").hidden = true;
    box.hidden = false;
    window.scrollTo(0, 0);
    const s = $("#btnSair"); if (s) s.onclick = () => DB.auth.sair();
  }
  function mensagem(ic, titulo, corpo, cls) {
    return '<div class="mensagem ' + (cls || "") + '">' + ic + "<div><h3>" + titulo + "</h3>" + corpo + "</div></div>";
  }
  function ficha(p, rotulo) {
    return '<div class="ficha"><div class="r">' + rotulo + '</div><div class="nm">' + esc(p.nome) + '</div><dl><dt>Categoria</dt><dd>' + esc(p.categoria || "—") + "</dd><dt>Departamento/unidade</dt><dd>" + esc(SETOR[p.setor].nome) + "</dd></dl></div>";
  }

  /* Conclusão do registo: os dados escolhidos no formulário aparecem bloqueados. */
  async function desenharIdentificacao() {
    try { ocupados = (await DB.get("ocupados")) || {}; } catch (e) {}
    let pend = null;
    try { pend = JSON.parse(localStorage.getItem(PENDENTE) || "null"); } catch (e) {}
    const p = pend && pend.email === utilizador.email && PESSOA[pend.pid] && !ocupados[pend.pid] ? PESSOA[pend.pid] : null;
    const topo = '<div class="eleitor"><div class="quem">' + icone("email", "p") + '<div><div class="nome" style="font-size:22px">' + esc(utilizador.email) + '</div><div class="setor">' + "Conta criada" + '</div></div></div><button class="link" id="btnSair">Terminar sessão</button></div>' +
      '<h2 class="pergunta">Conclusão do registo</h2>';
    if (p) {
      mostrar(topo + '<p class="sub">Verifique os dados abaixo. Após a conclusão do registo, estes dados não podem ser alterados.</p>' + ficha(p, "Titular da conta") +
        '<div class="acoes"><button class="btn btn-azul" id="btnConcluir">Concluir registo</button></div>' +
        '<p class="nota">Se os dados não estiverem correctos, termine a sessão e contacte a organização antes de prosseguir.</p>');
      $("#btnConcluir").onclick = () => gravarRegisto(p);
      return;
    }
    /* Sem escolha guardada (por exemplo, noutro aparelho): selecção feita agora, uma única vez. */
    mostrar(topo + '<p class="sub">Seleccione o seu departamento ou unidade e o seu nome. Após a conclusão do registo, estes dados não podem ser alterados.</p>' +
      '<div class="cx-sel"><label class="campo" for="idSetor">Departamento ou unidade</label><select class="texto" id="idSetor">' + opcoesSetor() + "</select>" +
      '<label class="campo" for="idNome" style="margin-top:12px">Nome</label><select class="texto" id="idNome" disabled><option value="">Seleccione primeiro o departamento ou unidade</option></select></div>' +
      '<div id="pre"></div><div class="acoes"><button class="btn btn-azul" id="btnConcluir" disabled>Concluir registo</button></div>' +
      '<p class="nota">Caso o seu nome conste como já registado, contacte a organização antes de prosseguir.</p>');
    $("#idSetor").onchange = () => { actualizarNomes("idSetor", "idNome"); $("#pre").innerHTML = ""; $("#btnConcluir").disabled = true; };
    $("#idNome").onchange = () => {
      const x = PESSOA[$("#idNome").value];
      $("#pre").innerHTML = x ? ficha(x, "Titular da conta") : "";
      $("#btnConcluir").disabled = !x;
    };
    $("#btnConcluir").onclick = () => { const x = PESSOA[$("#idNome").value]; if (x) gravarRegisto(x); };
  }

  async function gravarRegisto(p) {
    $("#btnConcluir").disabled = true;
    const r = { pid: p.id, setor: p.setor, chefe: !!p.chefe, email: utilizador.email, verificado: !!utilizador.emailVerified, ts: DB.agora() };
    try {
      await DB.update("", { ["registos/" + utilizador.uid]: r, ["ocupados/" + p.id]: utilizador.uid });
      try { localStorage.removeItem(PENDENTE); } catch (e) {}
      registo = await DB.get("registos/" + utilizador.uid);
      aviso("Registo concluído. Pode agora votar.");
      desenhar();
    } catch (e) {
      aviso("Não foi possível concluir o registo. Este nome poderá ter sido associado a outra conta.", "erro-t");
      try { localStorage.removeItem(PENDENTE); } catch (x) {}
      desenharIdentificacao();
    }
  }

  function cabecalho() {
    const p = PESSOA[registo.pid], s = SETOR[registo.setor];
    return '<div class="eleitor"><div class="quem">' + icone(registo.chefe ? "premio" : "pessoas", registo.chefe ? "v" : "") +
      '<div><div class="nome">' + esc(p ? p.nome : registo.pid) + '</div><div class="setor">' + esc(s ? s.nome : "") + (registo.chefe ? " · Chefia" : "") + "</div></div></div>" +
      '<button class="link" id="btnSair">Terminar sessão</button></div>';
  }

  async function desenharBoletim() {
    /* A votação está sempre aberta, salvo se a organização a encerrar no painel. */
    const fase = config.fase === "encerrada" ? "encerrada" : "fase1";
    let corpo = "";
    if (!PESSOA[registo.pid] || !SETOR[registo.setor] || !SETOR[registo.setor].participa) {
      corpo = mensagem(icone("cadeado", "p"), "Departamento não abrangido", "<p>O seu departamento ou unidade não participa nesta votação.</p>");
    } else if (fase === "encerrada") {
      corpo = mensagem(icone("cadeado", "p"), "Votação encerrada", "<p>Agradecemos a sua participação.</p>");
    } else if (fase === "fase1") {
      corpo = await votoOuLista(1);
    }
    mostrar(cabecalho() + corpo);
    ligarVoto();
  }

  async function votoOuLista(n) {
    const v = await DB.get("votos" + n + "/" + utilizador.uid).catch(() => null);
    if (v) {
      const p = PESSOA[v.candidato];
      return mensagem(icone("certo"), "Voto registado", "<p>O seu voto foi atribuído a:</p><div class=\"escolhido\">" + esc(p ? p.nome : v.candidato) + '</div><p style="color:var(--cinza)">Registado em ' + dataHora(v.ts) + ". O voto não pode ser alterado.</p>", "ok");
    }
    /* O próprio votante nunca consta da lista (também é recusado pelas regras da base de dados). */
    let ids;
    if (n === 1) ids = SETOR[registo.setor].pessoas.filter((p) => !p.chefe && p.id !== registo.pid).map((p) => p.id);
    else ids = Object.keys(finalistas[registo.setor] || {}).filter((id) => id !== registo.pid);
    ids.sort((a, b) => PESSOA[a].nome.localeCompare(PESSOA[b].nome, "pt"));
    const titulo = "Escolha o colega";
    const sub = n === 1
      ? "Seleccione o colega do " + esc(SETOR[registo.setor].curto) + " que, em 2026, fez a diferença para si. Os chefes não podem ser votados."
      : "";
    return '<h2 class="pergunta">' + titulo + '</h2><p class="sub">' + sub + "</p>" +
      '<div class="cx-sel"><label class="campo" for="selCand">Colega</label><select class="texto" id="selCand" data-fase="' + n + '"><option value="">Seleccione um nome</option>' +
      ids.map((id) => '<option value="' + id + '">' + esc(PESSOA[id].nome) + "</option>").join("") + "</select></div>" +
      '<div id="pre"></div><div class="acoes"><button class="btn btn-pri" id="btnContinuar" disabled>Continuar</button></div>';
  }

  function ligarVoto() {
    const sel = $("#selCand");
    if (!sel) return;
    const n = Number(sel.dataset.fase);
    sel.onchange = () => {
      const p = PESSOA[sel.value];
      $("#pre").innerHTML = p ? ficha(p, "Funcionário seleccionado") : "";
      $("#btnContinuar").disabled = !p;
    };
    $("#btnContinuar").onclick = () => { const p = PESSOA[sel.value]; if (p) confirmarVoto(p, n); };
  }

  /* Ecrã próprio de confirmação: o votante vê claramente a quem atribui o voto. */
  function confirmarVoto(p, n) {
    mostrar(cabecalho() + '<h2 class="pergunta">Confirmação do voto</h2><p class="sub">Confirme que pretende votar em:</p>' + ficha(p, "Voto a atribuir") +
      '<div class="aviso-final">O voto é anónimo e, depois de confirmado, não pode ser alterado.</div>' +
      '<div class="acoes"><button class="btn btn-sec" id="btnCorrigir">Corrigir a escolha</button><button class="btn btn-pri" id="btnConfirmar">Confirmar voto</button></div>');
    $("#btnCorrigir").onclick = () => desenharBoletim();
    $("#btnConfirmar").onclick = async () => {
      $("#btnConfirmar").disabled = true; $("#btnCorrigir").disabled = true;
      if (p.id === registo.pid) { aviso("Não é permitido votar em si próprio.", "erro-t"); return desenharBoletim(); }
      try {
        await DB.set("votos" + n + "/" + utilizador.uid, { setor: registo.setor, candidato: p.id, ts: DB.agora() });
        aviso("Voto registado com sucesso.");
      } catch (e) {
        const ja = await DB.get("votos" + n + "/" + utilizador.uid).catch(() => null);
        if (!ja) aviso("Não foi possível registar o voto. A votação poderá ter sido encerrada; actualize a página.", "erro-t");
      }
      desenharBoletim();
    };
  }
})();

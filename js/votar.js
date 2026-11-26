(function () {
  /* Votação sem conta: o votante identifica-se com departamento/unidade, nome e e-mail institucional.
     Cada nome e cada e-mail só podem votar uma vez (garantido pelas regras da base de dados). */
  const $ = (s) => document.querySelector(s);
  const { SETOR, PESSOA, icone, faixa, esc, aviso, dataHora, NOME_FASE } = VOT;
  const EMAIL_OK = /^[a-z0-9._%+-]+@ins\.gov\.mz$/;
  const chaveEmail = (e) => e.toLowerCase().replace(/\./g, ",");
  let config = null;
  let votaram = {};   // {pid: true} — só indica quem já votou, nunca em quem
  let votante = null; // {pid, setor, email}
  /* Bloqueio no aparelho: depois de votar, este navegador não deixa votar outra vez. */
  const CHAVE_APARELHO = "dpcm-reconhecimento-2026-votou";
  function jaVotouAqui() { try { return JSON.parse(localStorage.getItem(CHAVE_APARELHO) || "null"); } catch (e) { return null; } }
  function marcarAparelho(nome) {
    const v = JSON.stringify({ nome, ts: Date.now() });
    try { localStorage.setItem(CHAVE_APARELHO, v); } catch (e) {}
    try { document.cookie = CHAVE_APARELHO + "=1; max-age=31536000; path=/; SameSite=Lax"; } catch (e) {}
  }
  const cookieVotou = () => document.cookie.split("; ").some((c) => c.indexOf(CHAVE_APARELHO + "=") === 0);

  document.title = TITULO_VOTACAO + " · DPCM";
  $("#tituloTopo").textContent = TITULO_VOTACAO;
  $("#sobre").textContent = TITULO_VOTACAO;
  $("#malhaTopo").innerHTML = faixa(60, 28, 0);
  $("#malhaBase").innerHTML = faixa(80, 22, 5).replace('class="malha"', 'class="malha malha-base"');
  $("#passos").innerHTML =
    "<li><b>Identificação</b>Seleccione o departamento ou unidade e o seu nome, e indique o e-mail institucional.</li>" +
    "<li><b>Voto</b>Escolha um colega do mesmo departamento ou unidade. Os chefes também votam, mas não podem ser votados.</li>" +
    "<li><b>Anonimato</b>Os resultados são apresentados apenas em totais. Cada pessoa vota uma única vez.</li>";

  if (DB.demo) {
    DB.semear();
    $("#faixaDemo").innerHTML = '<div class="faixa-demo"><div><b>Modo de demonstração.</b> A base de dados ainda não está configurada. Os votos ficam guardados apenas neste navegador.</div></div>';
  }

  DB.on("config", (c) => {
    config = c || {};
    const f = config.fase === "encerrada" ? "encerrada" : "fase1";
    const e = $("#estado");
    e.textContent = NOME_FASE[f];
    e.className = "estado " + f;
    if (!votante) desenharIdentificacao();
  });
  DB.on("votaram", (v) => { votaram = v || {}; if (!votante) actualizarNomes(); }, () => {});

  /* ---------- Identificação ---------- */
  function opcoesSetor() {
    return '<option value="">Seleccione o departamento ou unidade</option>' + VOT.ativos().map((s) => '<option value="' + s.id + '">' + esc(s.nome) + "</option>").join("");
  }
  function actualizarNomes() {
    const sel = $("#idSetor"), nome = $("#idNome");
    if (!sel || !nome) return;
    const atual = nome.value;
    const s = SETOR[sel.value];
    if (!s) { nome.innerHTML = '<option value="">Seleccione primeiro o departamento ou unidade</option>'; nome.disabled = true; return; }
    nome.disabled = false;
    nome.innerHTML = '<option value="">Seleccione o seu nome</option>' + s.pessoas.slice().sort((a, b) => a.nome.localeCompare(b.nome, "pt")).map((p) => {
      const ja = !!votaram[p.id];
      return '<option value="' + p.id + '"' + (ja ? " disabled" : "") + (p.id === atual && !ja ? " selected" : "") + ">" + esc(p.nome) + (ja ? " (já votou)" : "") + "</option>";
    }).join("");
  }

  function desenharIdentificacao() {
    $("#ecraBoletim").hidden = true;
    $("#ecraEntrada").hidden = false;
    const box = $("#cartaoConta");
    if (config && config.fase === "encerrada") {
      box.innerHTML = "<h2>Votação encerrada</h2><p class=\"ajuda\">Agradecemos a sua participação.</p>";
      return;
    }
    const aqui = jaVotouAqui();
    if (aqui || cookieVotou()) {
      box.innerHTML = "<h2>Voto já registado</h2><p class=\"ajuda\">Já foi registado um voto a partir deste aparelho" + (aqui && aqui.nome ? ", em nome de <b>" + esc(aqui.nome) + "</b>" : "") +
        ". Cada pessoa vota uma única vez.</p><p class=\"ajuda\">Se outra pessoa precisa de votar, deve fazê-lo no seu próprio telemóvel ou computador.</p>";
      return;
    }
    box.innerHTML = '<h2>Identificação</h2><p class="ajuda">Seleccione o seu departamento ou unidade e o seu nome, e indique o seu e-mail institucional.</p>' +
      '<form id="formId" autocomplete="on">' +
      '<label class="campo" for="idSetor">Departamento ou unidade</label><select class="texto" id="idSetor">' + opcoesSetor() + "</select>" +
      '<label class="campo" for="idNome" style="margin-top:12px">Nome</label><select class="texto" id="idNome" disabled><option value="">Seleccione primeiro o departamento ou unidade</option></select>' +
      '<label class="campo" for="idEmail" style="margin-top:12px">E-mail institucional</label><input class="texto" id="idEmail" type="email" autocomplete="email" placeholder="nome.apelido@ins.gov.mz">' +
      '<div class="erro" id="erroId" role="alert"></div><button class="btn btn-pri btn-larg" type="submit">Continuar para a votação</button></form>' +
      '<div class="nota">Apenas são aceites e-mails @ins.gov.mz. Cada nome e cada e-mail só podem votar uma vez.</div>';
    $("#idSetor").onchange = actualizarNomes;
    $("#formId").addEventListener("submit", async (ev) => {
      ev.preventDefault();
      const err = $("#erroId");
      err.textContent = "";
      const pid = $("#idNome").value;
      const email = $("#idEmail").value.trim().toLowerCase();
      if (!pid) { err.textContent = "Seleccione o departamento ou unidade e o seu nome."; return; }
      if (!EMAIL_OK.test(email)) { err.textContent = "Indique o seu e-mail institucional (terminado em @ins.gov.mz)."; return; }
      if (votaram[pid]) { err.textContent = "Este nome já votou. Se não foi o senhor/a senhora, contacte a organização."; return; }
      if (jaVotouAqui() || cookieVotou()) { desenharIdentificacao(); return; }
      votante = { pid, setor: PESSOA[pid].setor, email };
      desenharVoto();
    });
  }

  /* ---------- Voto ---------- */
  function mostrar(html) {
    const box = $("#ecraBoletim");
    box.innerHTML = html;
    $("#ecraEntrada").hidden = true;
    box.hidden = false;
    window.scrollTo(0, 0);
    const s = $("#btnSair"); if (s) s.onclick = recomecar;
  }
  function recomecar() { votante = null; desenharIdentificacao(); window.scrollTo(0, 0); }
  function cabecalho() {
    const p = PESSOA[votante.pid];
    return '<div class="eleitor"><div class="quem">' + icone(p.chefe ? "premio" : "pessoas", p.chefe ? "v" : "") +
      '<div><div class="nome">' + esc(p.nome) + '</div><div class="setor">' + esc(SETOR[votante.setor].nome) + " · " + esc(votante.email) + "</div></div></div>" +
      '<button class="link" id="btnSair">Não sou eu</button></div>';
  }
  function ficha(p, rotulo) {
    return '<div class="ficha"><div class="r">' + rotulo + '</div><div class="nm">' + esc(p.nome) + '</div><dl><dt>Categoria</dt><dd>' + esc(p.categoria || "—") + "</dd><dt>Departamento/unidade</dt><dd>" + esc(SETOR[p.setor].nome) + "</dd></dl></div>";
  }

  function desenharVoto() {
    const ids = SETOR[votante.setor].pessoas.filter((p) => !p.chefe && p.id !== votante.pid).map((p) => p.id)
      .sort((a, b) => PESSOA[a].nome.localeCompare(PESSOA[b].nome, "pt"));
    mostrar(cabecalho() + '<h2 class="pergunta">Escolha o colega</h2><p class="sub">Seleccione o colega do ' + esc(SETOR[votante.setor].curto) + " que, em 2026, fez a diferença para si. Os chefes não podem ser votados.</p>" +
      '<div class="cx-sel"><label class="campo" for="selCand">Colega</label><select class="texto" id="selCand"><option value="">Seleccione um nome</option>' +
      ids.map((id) => '<option value="' + id + '">' + esc(PESSOA[id].nome) + "</option>").join("") + "</select></div>" +
      '<div id="pre"></div><div class="acoes"><button class="btn btn-pri" id="btnContinuar" disabled>Continuar</button></div>');
    const sel = $("#selCand");
    sel.onchange = () => {
      const p = PESSOA[sel.value];
      $("#pre").innerHTML = p ? ficha(p, "Colega seleccionado") : "";
      $("#btnContinuar").disabled = !p;
    };
    $("#btnContinuar").onclick = () => { const p = PESSOA[sel.value]; if (p) confirmarVoto(p); };
  }

  function confirmarVoto(p) {
    mostrar(cabecalho() + '<h2 class="pergunta">Confirmação do voto</h2><p class="sub">Confirme que pretende votar em:</p>' + ficha(p, "Voto a atribuir") +
      '<div class="aviso-final">O voto é anónimo e, depois de confirmado, não pode ser alterado.</div>' +
      '<div class="acoes"><button class="btn btn-sec" id="btnCorrigir">Corrigir a escolha</button><button class="btn btn-pri" id="btnConfirmar">Confirmar voto</button></div>');
    $("#btnCorrigir").onclick = desenharVoto;
    $("#btnConfirmar").onclick = async () => {
      $("#btnConfirmar").disabled = true; $("#btnCorrigir").disabled = true;
      if (p.id === votante.pid) { aviso("Não é permitido votar em si próprio.", "erro-t"); return desenharVoto(); }
      const v = { setor: votante.setor, candidato: p.id, email: votante.email, ts: DB.agora() };
      try {
        await DB.update("", { ["votos/" + votante.pid]: v, ["votaram/" + votante.pid]: true, ["emails/" + chaveEmail(votante.email)]: votante.pid });
        marcarAparelho(PESSOA[votante.pid].nome);
        mostrar(cabecalho().replace('<button class="link" id="btnSair">Não sou eu</button>', "") +
          '<div class="mensagem ok">' + icone("certo") + '<div><h3>Voto registado</h3><p>O seu voto foi atribuído a:</p><div class="escolhido">' + esc(p.nome) + '</div><p style="color:var(--cinza)">Registado em ' + dataHora(Date.now()) + ". Agradecemos a sua participação.</p></div></div>" +
          "");
      } catch (e) {
        const ja = !!votaram[votante.pid];
        aviso(ja ? "Este nome já tinha votado." : "Não foi possível registar o voto. Este e-mail pode já ter sido usado, ou a votação foi encerrada.", "erro-t");
        recomecar();
      }
    };
  }
})();

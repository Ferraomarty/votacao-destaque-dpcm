(function () {
  const $ = (s) => document.querySelector(s);
  const { SETOR, PESSOA, icone, faixa, esc, confirmar, aviso, dataHora, NOME_FASE } = VOT;
  let config = null;
  let sessao = null; // {codigo, pid, setor, chefe}
  let finalistas = {};

  document.title = TITULO_VOTACAO + " · DPCM";
  $("#tituloTopo").textContent = TITULO_VOTACAO;
  $("#sobre").textContent = TITULO_VOTACAO;
  $("#malhaTopo").innerHTML = faixa(60, 28, 0);
  $("#malhaBase").innerHTML = faixa(80, 22, 5).replace('class="malha"', 'class="malha malha-base"');
  $("#iconeCadeado").innerHTML = icone("cadeado", "peq p");
  $("#passos").innerHTML =
    "<li>" + icone("pessoas") + "<div><b>1ª fase, por sector</b><span class=\"t\">Vota num colega do seu sector. Os chefes não entram como candidatos.</span></div></li>" +
    "<li>" + icone("premio", "v") + "<div><b>2ª fase, chefes de sector</b><span class=\"t\">Os chefes escolhem entre os mais votados do seu sector.</span></div></li>";

  if (DB.demo) {
    DB.semear();
    $("#faixaDemo").innerHTML = '<div class="faixa-demo"><div><b>Modo de demonstração.</b> O Firebase ainda não está configurado: os votos ficam só neste navegador.</div></div>';
    mostrarCodigosDemo();
  }

  DB.on("config", (c) => {
    config = c || { fase: "fechada" };
    const e = $("#estado");
    e.textContent = NOME_FASE[config.fase] || "Votação por abrir";
    e.className = "estado " + (config.fase || "");
    if (sessao) desenharBoletim();
  });
  DB.on("finalistas", (f) => { finalistas = f || {}; if (sessao && config && config.fase === "fase2") desenharBoletim(); });

  $("#formCodigo").addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const cod = VOT.limparCodigo($("#codigo").value);
    $("#erroCodigo").textContent = "";
    if (cod.length !== 6) { $("#erroCodigo").textContent = "O código tem 6 letras e números."; return; }
    $("#btnEntrar").disabled = true;
    try {
      const info = await DB.get("codigos/" + cod);
      if (!info || !PESSOA[info.pid]) { $("#erroCodigo").textContent = "Código não encontrado. Confira as letras e os números do cartão."; return; }
      sessao = Object.assign({ codigo: cod }, info);
      sessionStorage.setItem("dpcm-codigo", cod);
      desenharBoletim();
    } catch (e) {
      $("#erroCodigo").textContent = "Sem ligação à base de dados. Verifique a internet e tente de novo.";
    } finally { $("#btnEntrar").disabled = false; }
  });

  /* Retoma a sessão se a página for recarregada. */
  const guardado = sessionStorage.getItem("dpcm-codigo");
  if (guardado) { $("#codigo").value = guardado; setTimeout(() => $("#formCodigo").requestSubmit(), 50); }

  function sair() {
    sessao = null;
    sessionStorage.removeItem("dpcm-codigo");
    $("#codigo").value = "";
    $("#ecraBoletim").hidden = true;
    $("#ecraEntrada").hidden = false;
  }

  function cabecalho() {
    const p = PESSOA[sessao.pid], s = SETOR[sessao.setor];
    return '<div class="eleitor"><div class="quem">' + icone(sessao.chefe ? "premio" : "pessoas", sessao.chefe ? "v" : "") +
      '<div><div class="nome">' + esc(p.nome) + '</div><div class="setor">' + esc(s.nome) + (sessao.chefe ? " · chefe de sector" : "") + "</div></div></div>" +
      '<button class="link" id="btnSair">Não sou eu / sair</button></div>';
  }
  function mensagem(ic, titulo, corpo, cls) {
    return '<div class="mensagem ' + (cls || "") + '">' + ic + "<div><h3>" + titulo + "</h3>" + corpo + "</div></div>";
  }

  async function desenharBoletim() {
    if (!sessao || !config) return;
    const box = $("#ecraBoletim");
    const fase = config.fase;
    let corpo = "";

    if (fase === "fechada" || !fase) {
      corpo = mensagem(icone("relogio"), "A votação ainda não abriu", "<p>Guarde o seu cartão. Quando a 1ª fase abrir, volte a esta página com o mesmo código.</p>");
    } else if (fase === "encerrada") {
      corpo = mensagem(icone("cadeado", "p"), "A votação terminou", "<p>Obrigado por participar. Os resultados serão anunciados pela Delegação.</p>");
    } else if (fase === "fase1") {
      if (sessao.chefe && !config.chefesFase1) {
        corpo = mensagem(icone("premio", "v"), "Os chefes votam na 2ª fase", "<p>Nesta fase votam os restantes funcionários do sector. Quando a 2ª fase abrir, use este mesmo código para escolher entre os finalistas.</p>", "v");
      } else {
        corpo = await votoOuLista(1);
      }
    } else if (fase === "fase2") {
      if (!sessao.chefe) {
        const v = await DB.get("votos1/" + sessao.codigo);
        corpo = mensagem(icone("certo"), "A 2ª fase é dos chefes de sector", "<p>" + (v ? "O seu voto da 1ª fase está registado. " : "") + "Agora os chefes escolhem entre os mais votados de cada sector.</p>");
      } else if (!Object.keys(finalistas[sessao.setor] || {}).length) {
        corpo = mensagem(icone("relogio"), "Finalistas por publicar", "<p>Os finalistas do seu sector ainda não foram publicados. Tente mais tarde.</p>");
      } else {
        corpo = await votoOuLista(2);
      }
    }
    const novo = box.hidden || !box.innerHTML;
    box.innerHTML = cabecalho() + corpo;
    $("#ecraEntrada").hidden = true;
    box.hidden = false;
    if (novo || !$("#lista")) window.scrollTo(0, 0);
    $("#btnSair").onclick = sair;
    ligarLista();
  }

  async function votoOuLista(n) {
    const v = await DB.get("votos" + n + "/" + sessao.codigo);
    if (v) {
      const p = PESSOA[v.candidato];
      return mensagem(icone("certo"), "O seu voto já está registado", "<p>Na " + n + "ª fase votou em</p><div class=\"escolhido\">" + esc(p ? p.nome : v.candidato) + "</div><p class=\"setor\" style=\"color:var(--cinza)\">" + dataHora(v.ts) + "</p>", "ok");
    }
    let ids;
    if (n === 1) ids = SETOR[sessao.setor].pessoas.filter((p) => !p.chefe && p.id !== sessao.pid).map((p) => p.id);
    else ids = Object.keys(finalistas[sessao.setor] || {}).filter((id) => id !== sessao.pid);
    ids.sort((a, b) => PESSOA[a].nome.localeCompare(PESSOA[b].nome, "pt"));
    const itens = ids.map((id) =>
      '<li data-nome="' + esc(semAcentos(PESSOA[id].nome)) + '"><label><input type="radio" name="cand" value="' + id + '"><span><span class="n">' + esc(PESSOA[id].nome) + '</span><span class="c">' + esc(PESSOA[id].categoria) + "</span></span></label></li>"
    ).join("");
    const titulo = n === 1 ? "Em quem vota no seu sector?" : "Escolha o funcionário em destaque";
    const sub = n === 1
      ? "Escolha uma pessoa. A lista tem só os colegas do " + esc(SETOR[sessao.setor].curto) + "; os chefes de sector não aparecem."
      : "Estes são os finalistas do " + esc(SETOR[sessao.setor].curto) + ", os mais votados na 1ª fase.";
    return '<h2 class="pergunta">' + titulo + '</h2><p style="color:var(--cinza);margin:0">' + sub + "</p>" +
      (ids.length > 8 ? '<div class="busca"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">' + '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg><input class="texto" id="busca" placeholder="Procurar pelo nome"></div>' : '<div style="height:16px"></div>') +
      '<ul class="lista" id="lista" data-fase="' + n + '">' + itens + '</ul><div class="vazio" id="semRes" hidden>Nenhum nome encontrado.</div>' +
      '<div class="barra-voto"><div class="esc" id="esc">Ainda não escolheu ninguém.</div><button class="btn btn-pri" id="btnVotar" disabled>Confirmar voto</button></div>';
  }

  function semAcentos(s) { return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase(); }

  function ligarLista() {
    const lista = $("#lista");
    if (!lista) return;
    const n = Number(lista.dataset.fase);
    let escolha = null;
    lista.addEventListener("change", (e) => {
      escolha = e.target.value;
      lista.querySelectorAll("li").forEach((li) => li.classList.toggle("sel", li.querySelector("input").checked));
      $("#esc").innerHTML = "A sua escolha<b>" + esc(PESSOA[escolha].nome) + "</b>";
      $("#btnVotar").disabled = false;
    });
    const busca = $("#busca");
    if (busca) busca.addEventListener("input", () => {
      const q = semAcentos(busca.value.trim());
      let vis = 0;
      lista.querySelectorAll("li").forEach((li) => { const m = !q || li.dataset.nome.includes(q); li.hidden = !m; if (m) vis++; });
      $("#semRes").hidden = vis > 0;
    });
    $("#btnVotar").onclick = async () => {
      if (!escolha) return;
      const ok = await confirmar("Confirmar o voto?", "<p>Vai votar em <b>" + esc(PESSOA[escolha].nome) + "</b>.</p><p style=\"color:var(--cinza)\">Depois de confirmar não é possível mudar o voto.</p>", "Sim, votar");
      if (!ok) return;
      $("#btnVotar").disabled = true;
      try {
        await DB.set("votos" + n + "/" + sessao.codigo, { setor: sessao.setor, candidato: escolha, ts: DB.agora() });
        aviso("Voto registado. Obrigado.");
      } catch (e) {
        const ja = await DB.get("votos" + n + "/" + sessao.codigo).catch(() => null);
        if (!ja) aviso("Não foi possível registar o voto. A fase pode ter fechado; actualize a página.", "erro-t");
      }
      desenharBoletim();
    };
  }

  function mostrarCodigosDemo() {
    DB.get("codigos").then((cods) => {
      const porPid = {};
      Object.entries(cods || {}).forEach(([c, v]) => (porPid[v.pid] = c));
      const s = SETOR.dpfis || VOT.ativos()[0];
      const func = s.pessoas.filter((p) => !p.chefe).slice(0, 2);
      const chefes = s.pessoas.filter((p) => p.chefe).slice(0, 2);
      const linhas = func.concat(chefes).map((p) => "<tr><td><code data-c=\"" + porPid[p.id] + "\">" + porPid[p.id] + "</code></td><td>" + esc(p.nome) + (p.chefe ? " <b>(chefe)</b>" : "") + "</td></tr>").join("");
      $("#demoCodigos").innerHTML = '<div class="demo-codigos"><b>Códigos de teste (' + esc(s.curto) + ')</b>. Clique num código para o usar. O painel está em <a href="admin.html">admin.html</a>.<table>' + linhas + "</table></div>";
      $("#demoCodigos").addEventListener("click", (e) => { const c = e.target.dataset && e.target.dataset.c; if (c) { $("#codigo").value = c; $("#formCodigo").requestSubmit(); } });
    });
  }
})();

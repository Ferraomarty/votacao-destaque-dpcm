(function () {
  const $ = (s) => document.querySelector(s);
  const { SETOR, PESSOA, ativos, esc, faixa, confirmar, aviso, NOME_FASE } = VOT;
  const D = { config: {}, codigos: {}, votos1: {}, votos2: {}, finalistas: {}, candidatos: {} };
  const desligar = [];

  $("#malhaTopo").innerHTML = faixa(60, 28, 3);
  $("#malhaBase").innerHTML = faixa(80, 22, 9).replace('class="malha"', 'class="malha malha-base"');
  if (DB.demo) {
    DB.semear();
    $("#faixaDemo").innerHTML = '<div class="faixa-demo"><div><b>Modo de demonstração.</b> Qualquer e-mail e palavra-passe entram. Os dados ficam só neste navegador. <button class="link" id="btnReDemo">Recomeçar a demonstração</button></div></div>';
    $("#btnReDemo").onclick = () => { DB.reiniciarDemo(); location.reload(); };
  }

  /* ---------- Sessão ---------- */
  DB.auth.aoMudar((u) => {
    desligar.splice(0).forEach((f) => f());
    $("#ecraLogin").hidden = !!u;
    $("#ecraPainel").hidden = !u;
    $("#quem").textContent = u ? u.email : "";
    if (u) ouvir();
  });
  $("#formLogin").addEventListener("submit", async (e) => {
    e.preventDefault();
    $("#erroLogin").textContent = "";
    try { await DB.auth.entrar($("#email").value.trim(), $("#senha").value); }
    catch (x) { $("#erroLogin").textContent = "E-mail ou palavra-passe errados."; }
  });
  $("#btnSairAdmin").onclick = () => DB.auth.sair();

  function ouvir() {
    Object.keys(D).forEach((k) =>
      desligar.push(DB.on(k, (v) => { D[k] = v || {}; desenhar(); }, () => {
        $("#ecraPainel").hidden = true; $("#ecraLogin").hidden = false;
        $("#erroLogin").textContent = "Esta conta não tem acesso ao painel. Confirme o UID nas regras da base de dados.";
      }))
    );
  }

  /* ---------- Abas ---------- */
  $("#abas").addEventListener("click", (e) => {
    const a = e.target.dataset.aba;
    if (!a) return;
    document.querySelectorAll("#abas button").forEach((b) => b.classList.toggle("ativa", b.dataset.aba === a));
    document.querySelectorAll(".aba").forEach((x) => (x.hidden = x.id !== "aba-" + a));
  });

  /* ---------- Cálculos ---------- */
  const porPid = () => { const m = {}; Object.entries(D.codigos).forEach(([c, v]) => (m[v.pid] = c)); return m; };
  function eleitores1(sid) { return Object.entries(D.codigos).filter(([, v]) => v.setor === sid && (!v.chefe || D.config.chefesFase1)).map(([c]) => c); }
  function eleitores2(sid) { return Object.entries(D.codigos).filter(([, v]) => v.setor === sid && v.chefe).map(([c]) => c); }
  const pct = (a, b) => (b ? Math.round((100 * a) / b) : 0);
  const medidor = (p, v) => '<div class="medidor' + (v ? " v" : "") + '"><i style="width:' + p + '%"></i></div>';

  function desenhar() {
    desenharEstado();
    desenharCodigos();
    desenharFase1();
    desenharFinal();
  }

  function desenharEstado() {
    const fase = D.config.fase || "fechada";
    $("#fases").innerHTML = ["fechada", "fase1", "fase2", "encerrada"].map((f) =>
      '<button data-f="' + f + '" class="' + (f === fase ? "ativa" : "") + '">' + { fechada: "Por abrir", fase1: "1ª fase", fase2: "2ª fase", encerrada: "Encerrada" }[f] + "</button>").join("");
    $("#chefesFase1").checked = !!D.config.chefesFase1;

    let e1 = 0, v1 = 0, e2 = 0, v2 = 0;
    const linhas = ativos().map((s) => {
      const el1 = eleitores1(s.id), el2 = eleitores2(s.id);
      const f1 = el1.filter((c) => D.votos1[c]).length, f2 = el2.filter((c) => D.votos2[c]).length;
      e1 += el1.length; v1 += f1; e2 += el2.length; v2 += f2;
      return "<tr><td><b>" + esc(s.curto) + '</b></td><td class="num">' + f1 + " / " + el1.length + "</td><td>" + medidor(pct(f1, el1.length)) +
        '</td><td class="num">' + (el2.length ? f2 + " / " + el2.length : '<span class="etq v">sem chefes</span>') + "</td><td>" + (el2.length ? medidor(pct(f2, el2.length), true) : "") + "</td></tr>";
    }).join("");
    $("#tabParticipacao").innerHTML = '<tr><th>Sector</th><th class="num">1ª fase</th><th></th><th class="num">2ª fase (chefes)</th><th></th></tr>' + linhas;
    const fora = SETORES.filter((s) => !s.participa).map((s) => s.curto + " (" + s.pessoas.length + ")");
    $("#notaExcluidos").textContent = fora.length ? "Fora da votação por terem poucos funcionários: " + fora.join(", ") + "." : "";
    $("#numeros").innerHTML =
      '<div><div class="n">' + v1 + '</div><div class="l">votos na 1ª fase, de ' + e1 + " eleitores</div></div>" +
      '<div><div class="n">' + pct(v1, e1) + '%</div><div class="l">participação na 1ª fase</div></div>' +
      '<div><div class="n v">' + v2 + '</div><div class="l">votos de chefes, de ' + e2 + "</div></div>" +
      '<div><div class="n">' + Object.keys(D.codigos).length + '</div><div class="l">códigos gerados</div></div>';
  }

  $("#fases").addEventListener("click", async (e) => {
    const f = e.target.dataset.f;
    if (!f || f === D.config.fase) return;
    let aviso2 = "";
    if (f === "fase2" && !Object.keys(D.finalistas).length) aviso2 = "<p><b>Atenção:</b> ainda não publicou os finalistas. Os chefes não terão em quem votar.</p>";
    const ok = await confirmar("Mudar para «" + NOME_FASE[f] + "»?", "<p>Quem estiver com a página aberta vê a mudança de imediato.</p>" + aviso2, "Mudar");
    if (ok) await DB.update("config", { fase: f });
  });
  $("#chefesFase1").addEventListener("change", (e) => DB.update("config", { chefesFase1: e.target.checked }));

  /* ---------- Códigos ---------- */
  function desenharCodigos() {
    const nCand = Object.values(D.candidatos).reduce((a, s) => a + Object.keys(s || {}).length, 0);
    $("#stCand").textContent = nCand ? nCand + " candidatos carregados em " + Object.keys(D.candidatos).length + " sectores." : "Ainda não carregado.";
    const total = ativos().reduce((a, s) => a + s.pessoas.length, 0);
    const n = Object.keys(D.codigos).length;
    $("#stCod").textContent = n ? n + " de " + total + " funcionários com código." : "Ainda sem códigos.";
    const q = semAcentos($("#buscaCod").value || "");
    const linhas = linhasCodigos().filter((r) => !q || semAcentos(r.join(" ")).includes(q))
      .map((r) => "<tr><td>" + esc(r[0]) + "</td><td>" + esc(r[1]) + (r[3] === "Sim" ? ' <span class="etq v">chefe</span>' : "") + '</td><td><code>' + esc(r[4]) + "</code></td><td>" + esc(r[5]) + "</td><td>" + esc(r[6]) + "</td></tr>").join("");
    $("#tabCodigos").innerHTML = "<tr><th>Sector</th><th>Nome</th><th>Código</th><th>Votou 1ª fase</th><th>Votou 2ª fase</th></tr>" + (linhas || '<tr><td colspan="5" class="vazio">Sem códigos.</td></tr>');
  }
  $("#buscaCod").addEventListener("input", desenharCodigos);
  function semAcentos(s) { return String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase(); }
  function linhasCodigos() {
    const m = porPid(), r = [];
    ativos().forEach((s) => s.pessoas.forEach((p) => {
      const c = m[p.id];
      if (!c) return;
      r.push([s.curto, p.nome, p.categoria, p.chefe ? "Sim" : "Não", c, D.votos1[c] ? "Sim" : (p.chefe && !D.config.chefesFase1 ? "—" : "Não"), p.chefe ? (D.votos2[c] ? "Sim" : "Não") : "—"]);
    }));
    return r;
  }

  $("#btnCand").onclick = async () => {
    await DB.set("candidatos", VOT.mapaCandidatos());
    aviso("Lista de candidatos carregada.");
  };
  $("#btnCod").onclick = async () => {
    const novos = VOT.gerarCodigos(D.codigos);
    const n = Object.keys(novos).length;
    if (!n) return aviso("Todos os funcionários já têm código.");
    const ok = await confirmar("Gerar " + n + " códigos?", "<p>Os códigos que já existem não mudam.</p>", "Gerar");
    if (!ok) return;
    await DB.update("codigos", novos);
    aviso(n + " códigos gerados.");
  };
  $("#btnExpCod").onclick = () => {
    const ws = XLSX.utils.aoa_to_sheet([["Sector", "Nome", "Categoria", "Chefe", "Código", "Votou 1ª fase", "Votou 2ª fase"]].concat(linhasCodigos()));
    ws["!cols"] = [{ wch: 14 }, { wch: 42 }, { wch: 34 }, { wch: 7 }, { wch: 10 }, { wch: 13 }, { wch: 13 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Códigos");
    XLSX.writeFile(wb, "codigos_votacao_DPCM.xlsx");
  };
  $("#btnImprimir").onclick = () => {
    const url = location.href.replace(/admin\.html.*$/, "");
    const logo = "assets/logo-dpcm.png";
    const m = porPid();
    const cartoes = [];
    ativos().forEach((s) => s.pessoas.forEach((p) => {
      if (!m[p.id]) return;
      cartoes.push('<div class="c"><img src="' + logo + '"><div class="t">' + esc(TITULO_VOTACAO) + '</div><div class="n">' + esc(p.nome) + '</div><div class="s">' + esc(s.curto) + (p.chefe ? " · chefe de sector" : "") +
        '</div><div class="cod">' + m[p.id] + '</div><div class="i">Abra <b>' + esc(url) + "</b>, escreva este código e vote. O código é pessoal: não o partilhe.</div></div>");
    }));
    let area = document.getElementById("areaImpressao");
    if (!area) { area = document.createElement("div"); area.id = "areaImpressao"; document.body.appendChild(area); }
    area.innerHTML = '<div class="g">' + cartoes.join("") + "</div>";
    const imgs = [...area.querySelectorAll("img")];
    Promise.all(imgs.map((i) => (i.complete ? 1 : new Promise((r) => { i.onload = i.onerror = r; })))).then(() => window.print());
  };
  $("#btnLimpar").onclick = async () => {
    const ok = await confirmar("Apagar todos os votos?", "<p>Apaga os votos das duas fases e os finalistas publicados. Não há forma de recuperar.</p>", "Apagar", true);
    if (!ok) return;
    await DB.update("", { votos1: null, votos2: null, finalistas: null });
    aviso("Votos apagados.");
  };

  /* ---------- 1ª fase ---------- */
  function desenharFase1() {
    const publicados = Object.keys(D.finalistas).length > 0;
    $("#notaFinalistas").innerHTML = "Passam à 2ª fase os " + N_FINALISTAS + " mais votados de cada sector; quem empata com o último lugar também passa. " +
      (publicados ? '<span class="etq">Finalistas publicados</span>' : '<span class="etq v">Finalistas por publicar</span>');
    $("#contagem1").innerHTML = ativos().map((s) => {
      const c = VOT.contar(D.votos1, s.id);
      const fin = publicados ? D.finalistas[s.id] || {} : VOT.calcularFinalistas(D.votos1, s.id, N_FINALISTAS);
      const ord = Object.entries(c).sort((a, b) => b[1] - a[1]);
      const max = ord.length ? ord[0][1] : 1;
      const total = ord.reduce((a, x) => a + x[1], 0);
      const li = ord.slice(0, 12).map(([id, v]) => '<li class="' + (id in fin ? "fin" : "") + '"><span class="nome">' + esc(PESSOA[id] ? PESSOA[id].nome : id) + '</span><span class="v">' + v + "</span>" + medidor(pct(v, max)) + "</li>").join("");
      return '<div class="setor-cx"><h3>' + esc(s.curto) + '</h3><div class="sub">' + total + " votos · " + Object.keys(fin).length + " finalistas" + (ord.length > 12 ? " · mostra os 12 primeiros" : "") + '</div><ul class="rank">' + (li || '<li class="vazio">Sem votos ainda.</li>') + "</ul></div>";
    }).join("");
  }
  $("#btnPublicar").onclick = async () => {
    const f = {};
    ativos().forEach((s) => { const x = VOT.calcularFinalistas(D.votos1, s.id, N_FINALISTAS); if (Object.keys(x).length) f[s.id] = x; });
    const resumo = ativos().map((s) => "<li><b>" + esc(s.curto) + ":</b> " + (f[s.id] ? Object.keys(f[s.id]).map((id) => esc(PESSOA[id].nome)).join(", ") : "sem votos") + "</li>").join("");
    const ok = await confirmar("Publicar finalistas?", '<ul style="padding-left:18px;font-size:15px">' + resumo + "</ul><p>Os chefes passam a ver estes nomes quando a 2ª fase abrir. Pode publicar de novo se a contagem mudar.</p>", "Publicar");
    if (!ok) return;
    await DB.set("finalistas", f);
    aviso("Finalistas publicados.");
  };

  /* ---------- Resultado ---------- */
  function desenharFinal() {
    $("#resultado").innerHTML = ativos().map((s) => {
      const r = VOT.resultado(s.id, D.votos1, D.votos2, D.finalistas);
      const top = r.lista[0];
      const cab = !top ? '<div class="vazio">Sem votos.</div>' :
        '<div class="vencedor"><div class="t">' + (r.empate ? "Empate, decisão da Delegação" : "Funcionário em destaque") + '</div><div class="nm">' + (r.empate ? r.lista.filter((x) => x.v1 === top.v1 && x.v2 === top.v2).map((x) => esc(PESSOA[x.id].nome)).join(" / ") : esc(PESSOA[top.id].nome)) + "</div></div>";
      const li = r.lista.map((x) => '<li><span class="nome">' + esc(PESSOA[x.id].nome) + '</span><span class="v">' + x.v2 + ' <small style="color:var(--cinza);font-weight:400">chefes</small> · ' + x.v1 + ' <small style="color:var(--cinza);font-weight:400">1ª fase</small></span></li>').join("");
      return '<div class="setor-cx"><h3>' + esc(s.curto) + '</h3><div class="sub">' + (r.semChefes ? "Sector sem chefes marcados: conta a 1ª fase" : (eleitores2(s.id).length === 1 ? "1 chefe vota" : eleitores2(s.id).length + " chefes votam")) + "</div>" + cab + '<ul class="rank">' + li + "</ul></div>";
    }).join("");
  }
  $("#btnExpRes").onclick = () => {
    const wb = XLSX.utils.book_new();
    const res = [["Sector", "Posição", "Nome", "Categoria", "Votos dos chefes", "Votos 1ª fase"]];
    ativos().forEach((s) => VOT.resultado(s.id, D.votos1, D.votos2, D.finalistas).lista.forEach((x, i) => res.push([s.curto, i + 1, PESSOA[x.id].nome, PESSOA[x.id].categoria, x.v2, x.v1])));
    const f1 = [["Sector", "Nome", "Categoria", "Votos 1ª fase"]];
    ativos().forEach((s) => Object.entries(VOT.contar(D.votos1, s.id)).sort((a, b) => b[1] - a[1]).forEach(([id, v]) => f1.push([s.curto, PESSOA[id].nome, PESSOA[id].categoria, v])));
    const part = [["Sector", "Eleitores 1ª fase", "Votaram 1ª fase", "Chefes", "Chefes que votaram"]];
    ativos().forEach((s) => { const a = eleitores1(s.id), b = eleitores2(s.id); part.push([s.curto, a.length, a.filter((c) => D.votos1[c]).length, b.length, b.filter((c) => D.votos2[c]).length]); });
    [["Resultado", res], ["1ª fase", f1], ["Participação", part]].forEach(([n, d]) => { const ws = XLSX.utils.aoa_to_sheet(d); ws["!cols"] = d[0].map((h, i) => ({ wch: i === 2 || (n !== "Resultado" && i === 1) ? 42 : 16 })); XLSX.utils.book_append_sheet(wb, ws, n); });
    XLSX.writeFile(wb, "resultados_votacao_DPCM.xlsx");
  };
})();

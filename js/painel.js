(function () {
  const $ = (s) => document.querySelector(s);
  const { SETOR, PESSOA, ativos, esc, faixa, confirmar, aviso, semAcentos, dataHora } = VOT;
  const D = { config: {}, pessoas: {}, votos: {} };
  const desligar = [];
  const URL_VOTO = location.href.replace(/admin\.html.*$/, "");
  const chaveEmail = (e) => String(e).toLowerCase().replace(/\./g, ",");

  $("#malhaTopo").innerHTML = faixa(60, 28, 3);
  $("#malhaBase").innerHTML = faixa(80, 22, 9).replace('class="malha"', 'class="malha malha-base"');
  $("#stUrl").textContent = URL_VOTO;
  if (DB.demo) {
    DB.semear();
    $("#faixaDemo").innerHTML = '<div class="faixa-demo"><div><b>Modo de demonstração.</b> Qualquer e-mail @ins.gov.mz entra no painel. Os dados ficam só neste navegador. <button class="link" id="btnReDemo">Recomeçar a demonstração</button></div></div>';
    $("#btnReDemo").onclick = () => { DB.reiniciarDemo(); location.reload(); };
  }

  /* ---------- Sessão (só a organização) ---------- */
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
    const email = $("#email").value.trim(), senha = $("#senha").value;
    try { await DB.auth.entrar(email, senha); }
    catch (x) {
      if (DB.demo && DB.DOMINIO.test(email) && senha) { try { await DB.auth.criarConta(email, senha); return; } catch (y) {} }
      $("#erroLogin").textContent = "E-mail ou palavra-passe errados.";
    }
  });
  $("#btnSairAdmin").onclick = () => DB.auth.sair();

  function ouvir() {
    Object.keys(D).forEach((k) =>
      desligar.push(DB.on(k, (v) => { D[k] = v || {}; desenhar(); }, () => {
        $("#ecraPainel").hidden = true; $("#ecraLogin").hidden = false;
        $("#erroLogin").textContent = "Esta conta não tem acesso ao painel. Confirme o UID do administrador nas regras da base de dados.";
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

  const pct = (a, b) => (b ? Math.round((100 * a) / b) : 0);
  const medidor = (p, v) => '<div class="medidor' + (v ? " v" : "") + '"><i style="width:' + p + '%"></i></div>';
  const votosValidos = () => Object.entries(D.votos).filter(([pid, v]) => v && PESSOA[pid]);

  function desenhar() { desenharEstado(); desenharVotos(); desenharContagem(); desenharFinal(); }

  /* ---------- Estado e participação ---------- */
  function desenharEstado() {
    const fase = D.config.fase === "encerrada" ? "encerrada" : "fase1";
    $("#fases").innerHTML = ["fase1", "encerrada"].map((f) =>
      '<button data-f="' + f + '" class="' + (f === fase ? "ativa" : "") + '">' + { fase1: "Aberta", encerrada: "Encerrada" }[f] + "</button>").join("");
    let total = 0, votaram = 0;
    const linhas = ativos().map((s) => {
      const n = s.pessoas.length, v = s.pessoas.filter((p) => D.votos[p.id]).length;
      total += n; votaram += v;
      return "<tr><td><b>" + esc(s.curto) + '</b></td><td class="num">' + v + " / " + n + "</td><td>" + medidor(pct(v, n)) + '</td><td class="num">' + pct(v, n) + "%</td></tr>";
    }).join("");
    $("#tabParticipacao").innerHTML = '<tr><th>Sector</th><th class="num">Votaram</th><th></th><th class="num">%</th></tr>' + linhas;
    const fora = SETORES.filter((s) => !s.participa).map((s) => s.curto + " (" + s.pessoas.length + ")");
    $("#notaExcluidos").textContent = fora.length ? "Fora da votação por terem poucos funcionários: " + fora.join(", ") + "." : "";
    const rever = votosValidos().filter(([pid, v]) => !VOT.emailCorresponde(v.email, PESSOA[pid].nome)).length;
    $("#numeros").innerHTML =
      '<div><div class="n">' + votaram + '</div><div class="l">votos registados</div></div>' +
      '<div><div class="n">' + pct(votaram, total) + '%</div><div class="l">participação, de ' + total + " funcionários</div></div>" +
      '<div><div class="n">' + (total - votaram) + '</div><div class="l">por votar</div></div>' +
      '<div><div class="n' + (rever ? " v" : "") + '">' + rever + '</div><div class="l">votos a rever (e-mail não corresponde ao nome)</div></div>';
  }
  $("#fases").addEventListener("click", async (e) => {
    const f = e.target.dataset.f;
    const atual = D.config.fase === "encerrada" ? "encerrada" : "fase1";
    if (!f || f === atual) return;
    const ok = await confirmar(f === "encerrada" ? "Encerrar a votação?" : "Reabrir a votação?", "<p>A alteração tem efeito imediato para todos os utilizadores.</p>", f === "encerrada" ? "Encerrar" : "Reabrir");
    if (ok) await DB.update("config", { fase: f });
  });

  /* ---------- Votantes (quem votou e com que e-mail; nunca em quem) ---------- */
  function linhasVotantes() {
    const r = [];
    ativos().forEach((s) => s.pessoas.forEach((p) => {
      const v = D.votos[p.id];
      r.push({ pid: p.id, setor: s.curto, nome: p.nome, categoria: p.categoria, chefe: p.chefe, email: v ? v.email : "", data: v ? v.ts : null, votou: !!v, rever: v ? !VOT.emailCorresponde(v.email, p.nome) : false });
    }));
    return r;
  }
  function desenharVotos() {
    const n = Object.keys(D.pessoas).length;
    $("#stCand").textContent = n ? n + " pessoas carregadas." : "Ainda não carregada. Sem este passo ninguém consegue votar.";
    const q = semAcentos($("#buscaCod").value || ""), f = $("#filtroReg").value;
    const linhas = linhasVotantes()
      .filter((r) => f === "todos" || (f === "sim" && r.votou) || (f === "nao" && !r.votou) || (f === "rever" && r.rever))
      .filter((r) => !q || semAcentos([r.setor, r.nome, r.email].join(" ")).includes(q))
      .map((r) => "<tr><td>" + esc(r.setor) + "</td><td>" + esc(r.nome) + (r.chefe ? ' <span class="etq v">chefe</span>' : "") + "</td><td>" +
        (r.votou ? '<span class="email">' + esc(r.email) + "</span>" + (r.rever ? '<div class="alerta">e-mail não corresponde ao nome</div>' : "") : '<span style="color:var(--cinza)">ainda não votou</span>') +
        "</td><td>" + (r.data ? esc(dataHora(r.data)) : "") + "</td><td>" +
        (r.votou ? '<button class="btn btn-sec btn-peq" data-anular="' + esc(r.pid) + '">Anular voto</button>' : "") + "</td></tr>").join("");
    $("#tabCodigos").innerHTML = "<tr><th>Sector</th><th>Nome</th><th>E-mail usado</th><th>Data</th><th></th></tr>" + (linhas || '<tr><td colspan="5" class="vazio">Nada a mostrar.</td></tr>');
  }
  $("#buscaCod").addEventListener("input", desenharVotos);
  $("#filtroReg").addEventListener("change", desenharVotos);
  $("#tabCodigos").addEventListener("click", async (e) => {
    const pid = e.target.dataset && e.target.dataset.anular;
    if (!pid) return;
    const v = D.votos[pid];
    const ok = await confirmar("Anular este voto?", "<p>O voto feito em nome de <b>" + esc(PESSOA[pid].nome) + "</b> com o e-mail <b>" + esc(v.email) + "</b> é apagado.</p><p style=\"color:var(--cinza)\">O nome e o e-mail ficam livres para votar de novo.</p>", "Anular", true);
    if (!ok) return;
    await DB.update("", { ["votos/" + pid]: null, ["votaram/" + pid]: null, ["emails/" + chaveEmail(v.email)]: null });
    aviso("Voto anulado.");
  });
  $("#btnCand").onclick = async () => { await DB.set("pessoas", VOT.mapaPessoas()); aviso("Lista de pessoal carregada."); };
  $("#btnCopiar").onclick = async () => { try { await navigator.clipboard.writeText(URL_VOTO); aviso("Endereço copiado."); } catch (e) { aviso(URL_VOTO); } };
  $("#btnExpReg").onclick = () => {
    const d = [["Sector", "Nome", "Categoria", "Chefe", "Votou", "E-mail usado", "Data", "E-mail não corresponde ao nome"]]
      .concat(linhasVotantes().map((r) => [r.setor, r.nome, r.categoria, r.chefe ? "Sim" : "Não", r.votou ? "Sim" : "Não", r.email, r.data ? dataHora(r.data) : "", r.rever ? "Sim" : ""]));
    const ws = XLSX.utils.aoa_to_sheet(d);
    ws["!cols"] = [{ wch: 14 }, { wch: 42 }, { wch: 32 }, { wch: 7 }, { wch: 7 }, { wch: 34 }, { wch: 20 }, { wch: 12 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Votantes");
    XLSX.writeFile(wb, "votantes_DPCM.xlsx");
  };
  $("#btnLimpar").onclick = async () => {
    const ok = await confirmar("Apagar todos os votos?", "<p>Apaga todos os votos registados. Não há forma de recuperar.</p>", "Apagar", true);
    if (!ok) return;
    await DB.update("", { votos: null, votaram: null, emails: null });
    aviso("Votos apagados.");
  };

  /* ---------- Contagem ---------- */
  function desenharContagem() {
    $("#notaFinalistas").textContent = "Votos por sector, do mais votado para o menos votado. Os " + N_FINALISTAS + " primeiros (e empatados) aparecem a negrito.";
    $("#contagem1").innerHTML = ativos().map((s) => {
      const c = VOT.contar(D.votos, s.id);
      const fin = VOT.calcularFinalistas(D.votos, s.id, N_FINALISTAS);
      const ord = Object.entries(c).sort((a, b) => b[1] - a[1]);
      const max = ord.length ? ord[0][1] : 1;
      const total = ord.reduce((a, x) => a + x[1], 0);
      const li = ord.slice(0, 12).map(([id, v]) => '<li class="' + (id in fin ? "fin" : "") + '"><span class="nome">' + esc(PESSOA[id] ? PESSOA[id].nome : id) + '</span><span class="v">' + v + "</span>" + medidor(pct(v, max)) + "</li>").join("");
      return '<div class="setor-cx"><h3>' + esc(s.curto) + '</h3><div class="sub">' + total + " votos" + (ord.length > 12 ? " · mostra os 12 primeiros" : "") + '</div><ul class="rank">' + (li || '<li class="vazio">Sem votos ainda.</li>') + "</ul></div>";
    }).join("");
  }

  /* ---------- Resultado ---------- */
  function desenharFinal() {
    $("#resultado").innerHTML = ativos().map((s) => {
      const r = VOT.resultado(s.id, D.votos, {}, {});
      const top = r.lista[0];
      const cab = !top ? '<div class="vazio">Sem votos.</div>' :
        '<div class="vencedor"><div class="t">' + (r.empate ? "Empate" : "Mais votado") + '</div><div class="nm">' +
        (r.empate ? r.lista.filter((x) => x.v1 === top.v1).map((x) => esc(PESSOA[x.id].nome)).join(" / ") : esc(PESSOA[top.id].nome)) + "</div></div>";
      const li = r.lista.map((x) => '<li><span class="nome">' + esc(PESSOA[x.id].nome) + '</span><span class="v">' + x.v1 + ' <small style="color:var(--cinza);font-weight:400">votos</small></span></li>').join("");
      return '<div class="setor-cx"><h3>' + esc(s.curto) + '</h3><div class="sub">' + s.pessoas.length + " funcionários</div>" + cab + '<ul class="rank">' + li + "</ul></div>";
    }).join("");
  }
  $("#btnExpRes").onclick = () => {
    const wb = XLSX.utils.book_new();
    const res = [["Sector", "Posição", "Nome", "Categoria", "Votos"]];
    ativos().forEach((s) => VOT.resultado(s.id, D.votos, {}, {}).lista.forEach((x, i) => res.push([s.curto, i + 1, PESSOA[x.id].nome, PESSOA[x.id].categoria, x.v1])));
    const part = [["Sector", "Funcionários", "Votaram"]];
    ativos().forEach((s) => part.push([s.curto, s.pessoas.length, s.pessoas.filter((p) => D.votos[p.id]).length]));
    [["Resultado", res], ["Participação", part]].forEach(([n, d]) => { const ws = XLSX.utils.aoa_to_sheet(d); ws["!cols"] = d[0].map((h, i) => ({ wch: n === "Resultado" && i === 2 ? 42 : 16 })); XLSX.utils.book_append_sheet(wb, ws, n); });
    XLSX.writeFile(wb, "resultados_votacao_DPCM.xlsx");
  };
})();

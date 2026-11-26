(function () {
  const $ = (s) => document.querySelector(s);
  const { SETOR, PESSOA, ativos, esc, faixa, confirmar, aviso, NOME_FASE, semAcentos, dataHora } = VOT;
  const D = { config: {}, pessoas: {}, registos: {}, votos1: {}, votos2: {}, finalistas: {} };
  const desligar = [];
  const URL_VOTO = location.href.replace(/admin\.html.*$/, "");

  $("#malhaTopo").innerHTML = faixa(60, 28, 3);
  $("#malhaBase").innerHTML = faixa(80, 22, 9).replace('class="malha"', 'class="malha malha-base"');
  $("#stUrl").textContent = URL_VOTO;
  if (DB.demo) {
    DB.semear();
    $("#faixaDemo").innerHTML = '<div class="faixa-demo"><div><b>Modo de demonstração.</b> Qualquer e-mail @ins.gov.mz entra (a conta é criada na hora). Os dados ficam só neste navegador. <button class="link" id="btnReDemo">Recomeçar a demonstração</button></div></div>';
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

  /* ---------- Cálculos ---------- */
  const regs = () => Object.entries(D.registos).filter(([, r]) => r && PESSOA[r.pid]);
  const porPid = () => { const m = {}; regs().forEach(([uid, r]) => (m[r.pid] = Object.assign({ uid }, r))); return m; };
  const podeFase1 = () => true; // todos os funcionários do sector, chefes incluídos, votam na 1.ª fase
  const pct = (a, b) => (b ? Math.round((100 * a) / b) : 0);
  const medidor = (p, v) => '<div class="medidor' + (v ? " v" : "") + '"><i style="width:' + p + '%"></i></div>';
  function porSetor(sid) {
    const m = porPid(), s = SETOR[sid];
    const el1 = s.pessoas.filter(podeFase1), chefes = s.pessoas.filter((p) => p.chefe);
    const reg = s.pessoas.filter((p) => m[p.id]).length;
    const v1 = el1.filter((p) => m[p.id] && D.votos1[m[p.id].uid]).length;
    const v2 = chefes.filter((p) => m[p.id] && D.votos2[m[p.id].uid]).length;
    return { total: s.pessoas.length, reg, el1: el1.length, v1, ch: chefes.length, v2 };
  }

  function desenhar() {
    desenharEstado();
    desenharRegistos();
    desenharFase1();
    desenharFinal();
  }

  function desenharEstado() {
    const fase = D.config.fase === "fase2" || D.config.fase === "encerrada" ? D.config.fase : "fase1";
    $("#fases").innerHTML = ["fase1", "fase2", "encerrada"].map((f) =>
      '<button data-f="' + f + '" class="' + (f === fase ? "ativa" : "") + '">' + { fase1: "1.ª fase", fase2: "2.ª fase", encerrada: "Encerrada" }[f] + "</button>").join("");
    const t = { total: 0, reg: 0, el1: 0, v1: 0, ch: 0, v2: 0 };
    const linhas = ativos().map((s) => {
      const x = porSetor(s.id);
      Object.keys(t).forEach((k) => (t[k] += x[k]));
      return "<tr><td><b>" + esc(s.curto) + '</b></td><td class="num">' + x.reg + " / " + x.total + '</td><td class="num">' + x.v1 + " / " + x.el1 + "</td><td>" + medidor(pct(x.v1, x.el1)) +
        '</td><td class="num">' + (x.ch ? x.v2 + " / " + x.ch : '<span class="etq v">sem chefes</span>') + "</td><td>" + (x.ch ? medidor(pct(x.v2, x.ch), true) : "") + "</td></tr>";
    }).join("");
    $("#tabParticipacao").innerHTML = '<tr><th>Sector</th><th class="num">Registados</th><th class="num">Votaram 1.ª fase</th><th></th><th class="num">Chefes, 2.ª fase</th><th></th></tr>' + linhas;
    const fora = SETORES.filter((s) => !s.participa).map((s) => s.curto + " (" + s.pessoas.length + ")");
    $("#notaExcluidos").textContent = fora.length ? "Fora da votação por terem poucos funcionários: " + fora.join(", ") + "." : "";
    const rever = regs().filter(([, r]) => !VOT.emailCorresponde(r.email, PESSOA[r.pid].nome)).length;
    $("#numeros").innerHTML =
      '<div><div class="n">' + t.reg + '</div><div class="l">registados, de ' + t.total + " funcionários</div></div>" +
      '<div><div class="n">' + t.v1 + '</div><div class="l">votos na 1.ª fase (' + pct(t.v1, t.el1) + "% de " + t.el1 + ")</div></div>" +
      '<div><div class="n v">' + t.v2 + '</div><div class="l">votos de chefes, de ' + t.ch + "</div></div>" +
      '<div><div class="n' + (rever ? " v" : "") + '">' + rever + '</div><div class="l">registos a rever (e-mail não corresponde ao nome)</div></div>';
  }

  $("#fases").addEventListener("click", async (e) => {
    const f = e.target.dataset.f;
    const atual = D.config.fase === "fase2" || D.config.fase === "encerrada" ? D.config.fase : "fase1";
    if (!f || f === atual) return;
    let extra = "";
    if (f === "fase2" && !Object.keys(D.finalistas).length) extra = "<p><b>Atenção:</b> ainda não publicou os finalistas. Os chefes não terão em quem votar.</p>";
    const ok = await confirmar("Mudar para «" + NOME_FASE[f] + "»?", "<p>A alteração tem efeito imediato para todos os utilizadores.</p>" + extra, "Mudar");
    if (ok) await DB.update("config", { fase: f });
  });

  /* ---------- Registos ---------- */
  function linhasRegistos() {
    const m = porPid(), r = [];
    ativos().forEach((s) => s.pessoas.forEach((p) => {
      const g = m[p.id];
      r.push({
        pid: p.id, uid: g && g.uid, setor: s.curto, nome: p.nome, categoria: p.categoria, chefe: p.chefe,
        email: g ? g.email : "", data: g ? g.ts : null, rever: g ? !VOT.emailCorresponde(g.email, p.nome) : false,
        v1: g && D.votos1[g.uid] ? "Sim" : "Não", v2: p.chefe ? (g && D.votos2[g.uid] ? "Sim" : "Não") : "—",
      });
    }));
    return r;
  }
  function desenharRegistos() {
    const n = Object.keys(D.pessoas).length;
    $("#stCand").textContent = n ? n + " pessoas carregadas." : "Ainda não carregada.";
    const q = semAcentos($("#buscaCod").value || ""), f = $("#filtroReg").value;
    const linhas = linhasRegistos()
      .filter((r) => f === "todos" || (f === "sim" && r.uid) || (f === "nao" && !r.uid) || (f === "rever" && r.rever))
      .filter((r) => !q || semAcentos([r.setor, r.nome, r.email].join(" ")).includes(q))
      .map((r) => "<tr><td>" + esc(r.setor) + "</td><td>" + esc(r.nome) + (r.chefe ? ' <span class="etq v">chefe</span>' : "") + "</td><td>" +
        (r.uid ? '<span class="email">' + esc(r.email) + "</span>" + (r.rever ? '<div class="alerta">e-mail não corresponde ao nome</div>' : "") : '<span style="color:var(--cinza)">por registar</span>') +
        '</td><td>' + (r.data ? esc(dataHora(r.data)) : "") + "</td><td>" + r.v1 + "</td><td>" + r.v2 + '</td><td class="grupo-btn">' +
        (r.uid ? '<button class="btn btn-sec btn-peq" data-anular="' + esc(r.uid) + '" data-pid="' + esc(r.pid) + '">Anular</button>' : "") + "</td></tr>").join("");
    $("#tabCodigos").innerHTML = "<tr><th>Sector</th><th>Nome</th><th>E-mail</th><th>Registo</th><th>1.ª fase</th><th>2.ª fase</th><th></th></tr>" + (linhas || '<tr><td colspan="7" class="vazio">Nada a mostrar.</td></tr>');
  }
  $("#buscaCod").addEventListener("input", desenharRegistos);
  $("#filtroReg").addEventListener("change", desenharRegistos);
  $("#tabCodigos").addEventListener("click", async (e) => {
    const uid = e.target.dataset && e.target.dataset.anular;
    if (!uid) return;
    const pid = e.target.dataset.pid, r = D.registos[uid];
    const ok = await confirmar("Anular este registo?", "<p><b>" + esc(PESSOA[pid].nome) + "</b> deixa de estar ligado a <b>" + esc(r.email) + "</b>. Os votos feitos com esta conta são apagados.</p><p style=\"color:var(--cinza)\">O titular do nome poderá depois registar-se com o seu próprio e-mail.</p>", "Anular", true);
    if (!ok) return;
    await DB.update("", { ["registos/" + uid]: null, ["ocupados/" + pid]: null, ["votos1/" + uid]: null, ["votos2/" + uid]: null });
    aviso("Registo anulado.");
  });
  $("#btnCand").onclick = async () => { await DB.set("pessoas", VOT.mapaPessoas()); aviso("Lista de pessoal carregada."); };
  $("#btnCopiar").onclick = async () => {
    try { await navigator.clipboard.writeText(URL_VOTO); aviso("Endereço copiado."); } catch (e) { aviso(URL_VOTO); }
  };
  $("#btnExpReg").onclick = () => {
    const d = [["Sector", "Nome", "Categoria", "Chefe", "E-mail", "Data do registo", "E-mail não corresponde ao nome", "Votou 1.ª fase", "Votou 2.ª fase"]]
      .concat(linhasRegistos().map((r) => [r.setor, r.nome, r.categoria, r.chefe ? "Sim" : "Não", r.email, r.data ? dataHora(r.data) : "", r.rever ? "Sim" : "", r.v1, r.v2]));
    const ws = XLSX.utils.aoa_to_sheet(d);
    ws["!cols"] = [{ wch: 14 }, { wch: 42 }, { wch: 32 }, { wch: 7 }, { wch: 34 }, { wch: 20 }, { wch: 9 }, { wch: 13 }, { wch: 13 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Registos");
    XLSX.writeFile(wb, "registos_votacao_DPCM.xlsx");
  };
  $("#btnLimpar").onclick = async () => {
    const ok = await confirmar("Apagar todos os votos?", "<p>Apaga os votos das duas fases e os finalistas publicados. Não há forma de recuperar.</p>", "Apagar", true);
    if (!ok) return;
    await DB.update("", { votos1: null, votos2: null, finalistas: null });
    aviso("Votos apagados.");
  };

  /* ---------- 1.ª fase ---------- */
  function desenharFase1() {
    const publicados = Object.keys(D.finalistas).length > 0;
    $("#notaFinalistas").innerHTML = "Passam à 2.ª fase os " + N_FINALISTAS + " mais votados de cada sector; quem empata com o último lugar também passa. " +
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
    const ok = await confirmar("Publicar finalistas?", '<ul style="padding-left:18px;font-size:15px">' + resumo + "</ul><p>Os chefes passam a ver estes nomes quando a 2.ª fase abrir. Pode publicar de novo se a contagem mudar.</p>", "Publicar");
    if (!ok) return;
    await DB.set("finalistas", f);
    aviso("Finalistas publicados.");
  };

  /* ---------- Resultado ---------- */
  function desenharFinal() {
    $("#resultado").innerHTML = ativos().map((s) => {
      const r = VOT.resultado(s.id, D.votos1, D.votos2, D.finalistas);
      const top = r.lista[0];
      const ch = s.pessoas.filter((p) => p.chefe).length;
      const cab = !top ? '<div class="vazio">Sem votos.</div>' :
        '<div class="vencedor"><div class="t">' + (r.empate ? "Empate, decisão da Delegação" : "Funcionário em destaque") + '</div><div class="nm">' +
        (r.empate ? r.lista.filter((x) => x.v1 === top.v1 && x.v2 === top.v2).map((x) => esc(PESSOA[x.id].nome)).join(" / ") : esc(PESSOA[top.id].nome)) + "</div></div>";
      const li = r.lista.map((x) => '<li><span class="nome">' + esc(PESSOA[x.id].nome) + '</span><span class="v">' + x.v2 + ' <small style="color:var(--cinza);font-weight:400">chefes</small> · ' + x.v1 + ' <small style="color:var(--cinza);font-weight:400">1.ª fase</small></span></li>').join("");
      return '<div class="setor-cx"><h3>' + esc(s.curto) + '</h3><div class="sub">' + (r.semChefes ? "Sector sem chefes marcados: conta a 1.ª fase" : (ch === 1 ? "1 chefe vota" : ch + " chefes votam")) + "</div>" + cab + '<ul class="rank">' + li + "</ul></div>";
    }).join("");
  }
  $("#btnExpRes").onclick = () => {
    const wb = XLSX.utils.book_new();
    const res = [["Sector", "Posição", "Nome", "Categoria", "Votos dos chefes", "Votos 1.ª fase"]];
    ativos().forEach((s) => VOT.resultado(s.id, D.votos1, D.votos2, D.finalistas).lista.forEach((x, i) => res.push([s.curto, i + 1, PESSOA[x.id].nome, PESSOA[x.id].categoria, x.v2, x.v1])));
    const f1 = [["Sector", "Nome", "Categoria", "Votos 1.ª fase"]];
    ativos().forEach((s) => Object.entries(VOT.contar(D.votos1, s.id)).sort((a, b) => b[1] - a[1]).forEach(([id, v]) => f1.push([s.curto, PESSOA[id].nome, PESSOA[id].categoria, v])));
    const part = [["Sector", "Funcionários", "Registados", "Podiam votar 1.ª fase", "Votaram 1.ª fase", "Chefes", "Chefes que votaram"]];
    ativos().forEach((s) => { const x = porSetor(s.id); part.push([s.curto, x.total, x.reg, x.el1, x.v1, x.ch, x.v2]); });
    [["Resultado", res], ["1.ª fase", f1], ["Participação", part]].forEach(([n, d]) => { const ws = XLSX.utils.aoa_to_sheet(d); ws["!cols"] = d[0].map((h, i) => ({ wch: (n === "Resultado" ? i === 2 : i === 1) ? 42 : 16 })); XLSX.utils.book_append_sheet(wb, ws, n); });
    XLSX.writeFile(wb, "resultados_votacao_DPCM.xlsx");
  };
})();

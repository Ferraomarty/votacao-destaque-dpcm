/* Funções partilhadas pela página de voto e pelo painel. */
(function () {
  const SETOR = {};
  const PESSOA = {};
  (window.SETORES || []).forEach((s) => {
    SETOR[s.id] = s;
    s.pessoas.forEach((p) => (PESSOA[p.id] = Object.assign({ setor: s.id }, p)));
  });
  const ativos = () => SETORES.filter((s) => s.participa);

  /* Pessoas que entram na votação: {id: {setor, chefe}}. Chefes votam mas não são votados. */
  function mapaPessoas() {
    const m = {};
    ativos().forEach((s) => s.pessoas.forEach((p) => (m[p.id] = { setor: s.id, chefe: !!p.chefe })));
    return m;
  }

  function semAcentos(s) { return String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase(); }

  /* Verifica se alguma parte do e-mail lembra o nome da pessoa. Serve só para assinalar casos a rever. */
  function emailCorresponde(email, nome) {
    const ep = semAcentos(String(email).split("@")[0]).split(/[^a-z]+/).filter((t) => t.length >= 3);
    const np = semAcentos(nome).split(/[^a-z]+/).filter((t) => t.length >= 3);
    return ep.some((e) => np.some((n) => n.startsWith(e.slice(0, 4)) || e.startsWith(n.slice(0, 4))));
  }

  function contar(votos, setor) {
    const r = {};
    Object.values(votos || {}).forEach((v) => { if (v && v.setor === setor) r[v.candidato] = (r[v.candidato] || 0) + 1; });
    return r;
  }

  /* Os N mais votados da 1.ª fase; quem empata com o último lugar também passa. */
  function calcularFinalistas(votos1, setor, n) {
    const c = contar(votos1, setor);
    const ord = Object.entries(c).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
    if (!ord.length) return {};
    const corte = ord[Math.min(n, ord.length) - 1][1];
    const r = {};
    ord.filter(([, v]) => v >= corte).forEach(([id, v]) => (r[id] = v));
    return r;
  }

  /* Ordem final: votos dos chefes, depois votos da 1.ª fase como desempate. */
  function resultado(setor, votos1, votos2, finalistas) {
    const v1 = contar(votos1, setor), v2 = contar(votos2, setor);
    const fin = Object.keys((finalistas || {})[setor] || {});
    const base = fin.length ? fin : Object.keys(v1);
    const lista = base.map((id) => ({ id, v1: v1[id] || 0, v2: v2[id] || 0 })).sort((a, b) => b.v2 - a.v2 || b.v1 - a.v1);
    const empate = lista.length > 1 && lista[0].v1 === lista[1].v1 && lista[0].v2 === lista[1].v2;
    return { lista, empate, semChefes: !SETOR[setor].pessoas.some((p) => p.chefe) };
  }

  /* Ícones de traço (24 px, 1,8 px, branco), como na iconografia do manual. */
  const ICONES = {
    pessoas: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    premio: '<circle cx="12" cy="8" r="6"/><path d="M15.48 12.89 17 22l-5-3-5 3 1.52-9.11"/>',
    chave: '<circle cx="7.5" cy="15.5" r="5.5"/><path d="m21 2-9.6 9.6"/><path d="m15.5 7.5 3 3L22 7l-3-3"/>',
    certo: '<path d="M20 6 9 17l-5-5"/>',
    cadeado: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
    lupa: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
    grafico: '<path d="M3 3v18h18"/><path d="M7 16v-5"/><path d="M12 16V8"/><path d="M17 16v-3"/>',
    relogio: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
    sair: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/>',
    email: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 5L2 7"/>',
    imprimir: '<path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>',
    folha: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M8 13h8"/><path d="M8 17h8"/>',
  };
  function icone(nome, cls) {
    return '<span class="icone ' + (cls || "") + '"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' + (ICONES[nome] || "") + "</svg></span>";
  }

  /* Faixa da malha modular: quadrados com cheio, quarto, meio, círculo, losango ou pontos. */
  const COR = { azul: "#00768A", verm: "#B2204A", pet: "#0B3B47", a15: "#D9EAED", v15: "#F3DEE4", a60: "#66ADB9" };
  function peca(tipo, x, s, fundo, cor) {
    let g = '<rect x="' + x + '" y="0" width="' + s + '" height="' + s + '" fill="' + fundo + '"/>';
    const h = s / 2;
    if (tipo === "quarto") g += '<path d="M' + x + " " + s + " L" + x + " 0 A" + s + " " + s + " 0 0 1 " + (x + s) + " " + s + ' Z" fill="' + cor + '"/>';
    if (tipo === "meio") g += '<path d="M' + x + " " + s + " A" + h + " " + h + " 0 0 1 " + (x + s) + " " + s + ' Z" fill="' + cor + '"/>';
    if (tipo === "circulo") g += '<circle cx="' + (x + h) + '" cy="' + h + '" r="' + h * 0.92 + '" fill="' + cor + '"/>';
    if (tipo === "losango") g += '<path d="M' + (x + h) + " " + s * 0.08 + " L" + (x + s * 0.92) + " " + h + " L" + (x + h) + " " + s * 0.92 + " L" + (x + s * 0.08) + " " + h + ' Z" fill="' + cor + '"/>';
    if (tipo === "pontos") for (let i = 1; i <= 3; i++) for (let j = 1; j <= 3; j++) g += '<circle cx="' + (x + (s * i) / 4) + '" cy="' + (s * j) / 4 + '" r="' + s * 0.05 + '" fill="' + cor + '"/>';
    return g;
  }
  const SEQ = [
    ["cheio", COR.azul], ["quarto", COR.verm, COR.a15], ["losango", COR.azul, "#fff"], ["cheio", COR.pet], ["meio", COR.azul, COR.v15],
    ["circulo", COR.verm, "#fff"], ["cheio", COR.a15], ["quarto", COR.azul, COR.pet], ["pontos", COR.pet, COR.a15], ["cheio", COR.verm],
    ["losango", COR.pet, COR.a60], ["meio", COR.verm, "#fff"], ["cheio", COR.azul], ["circulo", COR.a60, COR.pet],
  ];
  function faixa(n, s, desloc) {
    s = s || 28; desloc = desloc || 0;
    let g = "";
    for (let i = 0; i < n; i++) {
      const [t, a, b] = SEQ[(i + desloc) % SEQ.length];
      g += t === "cheio" ? peca("cheio", i * s, s, a) : peca(t, i * s, s, b || "#fff", a);
    }
    return '<svg class="malha" viewBox="0 0 ' + n * s + " " + s + '" preserveAspectRatio="xMinYMid slice" aria-hidden="true">' + g + "</svg>";
  }

  /* Janela de confirmação própria (sem alert/confirm do navegador). */
  function confirmar(titulo, html, rotulo, perigo) {
    return new Promise((ok) => {
      const d = document.createElement("div");
      d.className = "modal-fundo";
      d.innerHTML = '<div class="modal" role="dialog" aria-modal="true"><h3>' + titulo + "</h3><div>" + html + '</div><div class="modal-acoes"><button class="btn btn-sec" data-r="0">Cancelar</button><button class="btn ' + (perigo ? "btn-perigo" : "btn-pri") + '" data-r="1">' + (rotulo || "Confirmar") + "</button></div></div>";
      document.body.appendChild(d);
      d.querySelector('[data-r="1"]').focus();
      d.addEventListener("click", (e) => {
        const r = e.target.getAttribute && e.target.getAttribute("data-r");
        if (r === null && e.target !== d) return;
        d.remove();
        ok(r === "1");
      });
    });
  }
  function aviso(txt, tipo) {
    const t = document.createElement("div");
    t.className = "toast " + (tipo || "");
    t.textContent = txt;
    document.body.appendChild(t);
    setTimeout(() => t.classList.add("sai"), 3200);
    setTimeout(() => t.remove(), 3700);
  }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
  function dataHora(ts) {
    if (!ts) return "";
    const d = new Date(ts);
    return d.toLocaleDateString("pt-PT") + " às " + d.toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" });
  }
  const NOME_FASE = { fase1: "Votação aberta", fase2: "Votação aberta", encerrada: "Votação encerrada" };

  window.VOT = { SETOR, PESSOA, ativos, mapaPessoas, semAcentos, emailCorresponde, contar, calcularFinalistas, resultado, icone, faixa, confirmar, aviso, esc, dataHora, NOME_FASE };
})();

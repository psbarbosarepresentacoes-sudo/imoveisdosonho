// ============================================================
//  LÓGICA PRINCIPAL DO APP
// ============================================================

const ESTADO = {
  imoveis: [],        // catálogo carregado do backend
  fotos: [],          // fotos (data URLs) do anúncio em edição
  videoDataUrl: null, // vídeo gerado do anúncio em edição
  trilha: "chill",
};

// ---------- Troca de telas ----------
function abrirTela(nome) {
  document.querySelectorAll(".tela").forEach((t) => t.classList.remove("ativa"));
  const alvo = document.getElementById("tela-" + nome);
  if (alvo) alvo.classList.add("ativa");
  document.querySelectorAll(".tabbar__item").forEach((b) => {
    b.classList.toggle("ativo", b.dataset.tela === nome);
  });
  if (nome === "anunciar") prepararAnunciar();
  if (nome === "perfil") renderPerfil();
  if (nome === "feed") renderFeed();
  window.scrollTo(0, 0);
}

// Pinta todos os ícones minimalistas (elementos com data-ico)
function pintarIcones() {
  document.querySelectorAll("[data-ico]").forEach((el) => {
    if (!el.dataset.pintado) { el.innerHTML = ICONE(el.dataset.ico); el.dataset.pintado = "1"; }
  });
}

// ---------- Catálogo (cards minimalistas) ----------
function specsHTML(im, tam) {
  const it = [];
  if (im.quartos) it.push(`<span>${ICONE("quarto", tam)}${im.quartos}</span>`);
  if (im.banheiros) it.push(`<span>${ICONE("banheiro", tam)}${im.banheiros}</span>`);
  if (im.vagas) it.push(`<span>${ICONE("vaga", tam)}${im.vagas}</span>`);
  if (im.area) it.push(`<span>${ICONE("area", tam)}${im.area}m²</span>`);
  return it.join("");
}

function cardImovel(im) {
  const foto = (im.fotos && im.fotos[0]) || "";
  const badge = im.finalidade === "aluguel" ? "Aluguel" : "Venda";
  const preco = formatarPreco(im.preco) + (im.finalidade === "aluguel" ? "/mês" : "");
  const selo = im.tem_video ? `<span class="card__video">${ICONE("feed", 12)}vídeo</span>` : "";
  const qtd = im.fotos_qtd > 1 ? `<span class="card__qtd">1 / ${im.fotos_qtd}</span>` : "";
  return `
    <article class="card" data-id="${im.id}">
      <div class="card__img" style="background-image:url('${foto}')">
        <span class="card__badge">${badge}</span>${selo}
        <button class="card__fav ${im.curtido ? "ativo" : ""}" data-fav="${im.id}" aria-label="Favoritar">${ICONE("curtir", 20)}</button>
        ${qtd}
      </div>
      <div class="card__body">
        <h3 class="card__titulo">${im.titulo}</h3>
        <p class="card__local">${im.bairro || ""}${im.cidade ? " · " + im.cidade : ""}</p>
        <div class="card__specs">${specsHTML(im, 16)}</div>
        <div class="card__rodape">
          <div class="card__preco">${preco}</div>
          ${cardWhatsApp(im)}
        </div>
        <p class="card__corretor">${im.corretor_nome || ""}</p>
      </div>
    </article>`;
}

function cardWhatsApp(im) {
  if (!im.contato) return "";
  const msg = `Olá! Tenho interesse no imóvel "${im.titulo}" que vi no ImóvelIA.`;
  const wa = linkWhatsApp(im.contato, msg);
  return `<a class="card__wa" href="${wa}" target="_blank" rel="noopener" onclick="event.stopPropagation()" aria-label="WhatsApp">${ICONE("whatsapp", 18)}</a>`;
}

function renderizar(lista) {
  const grid = document.getElementById("grid");
  const contador = document.getElementById("contador");
  if (!lista.length) {
    grid.innerHTML = `<div class="vazio">Nenhum imóvel encontrado.<br>Tente outro bairro ou faixa de preço.</div>`;
    contador.textContent = "0 imóveis";
    return;
  }
  grid.innerHTML = lista.map(cardImovel).join("");
  contador.textContent = lista.length + (lista.length === 1 ? " imóvel" : " imóveis");
  grid.querySelectorAll(".card").forEach((c) => {
    c.addEventListener("click", (e) => {
      if (e.target.closest("[data-fav]")) return;
      abrirDetalhe(c.dataset.id);
    });
  });
  grid.querySelectorAll("[data-fav]").forEach((b) =>
    b.addEventListener("click", async (e) => {
      e.stopPropagation();
      if (!API.logado()) { abrirModalLogin(); return; }
      try {
        const r = await API.curtir(parseInt(b.dataset.fav));
        b.classList.toggle("ativo", r.curtido);
      } catch (err) { alert(err.message); }
    })
  );
}

// ---------- Chips de categoria (filtro rápido) ----------
const CHIPS = [
  { label: "Todos", filtro: {} },
  { label: "Casa", filtro: { tipo: "casa" } },
  { label: "Apartamento", filtro: { tipo: "apartamento" } },
  { label: "Venda", filtro: { finalidade: "venda" } },
  { label: "Aluguel", filtro: { finalidade: "aluguel" } },
];

function renderChips() {
  const c = document.getElementById("chips");
  if (!c) return;
  c.innerHTML = CHIPS.map((ch, i) =>
    `<button class="chip ${i === (ESTADO.chipAtivo || 0) ? "ativo" : ""}" data-chip="${i}">${ch.label}</button>`
  ).join("");
  c.querySelectorAll("[data-chip]").forEach((b) =>
    b.addEventListener("click", () => aplicarChip(parseInt(b.dataset.chip)))
  );
}

function aplicarChip(i) {
  ESTADO.chipAtivo = i;
  renderChips();
  const f = CHIPS[i].filtro;
  const lista = ESTADO.imoveis.filter((im) => {
    if (f.tipo && im.tipo !== f.tipo) return false;
    if (f.finalidade && im.finalidade !== f.finalidade) return false;
    return true;
  });
  document.getElementById("campoBusca").value = "";
  document.getElementById("interpretacao").style.display = "none";
  renderizar(lista);
}

async function carregarImoveis() {
  const grid = document.getElementById("grid");
  if (grid && !grid.children.length) grid.innerHTML = '<div class="carregando">Carregando imóveis...</div>';
  try {
    ESTADO.imoveis = await API.listarImoveis();
    ESTADO.chipAtivo = 0;
    renderChips();
    renderizar(ESTADO.imoveis);
  } catch (e) {
    document.getElementById("grid").innerHTML = `<div class="vazio">Erro ao carregar imóveis.<br>${e.message}</div>`;
  }
}

function buscar(frase) {
  const filtros = interpretarBusca(frase, ESTADO.imoveis);
  const resultado = filtrarImoveis(filtros, ESTADO.imoveis);
  ESTADO.chipAtivo = 0;
  renderChips();
  const chip = document.getElementById("interpretacao");
  chip.style.display = "block";
  chip.innerHTML = `<strong>Entendi:</strong> ${resumoFiltros(filtros) || "todos os imóveis"}`;
  renderizar(resultado);
}

// ---------- Detalhe do anúncio (ver como fica ao clicar) ----------
async function abrirDetalhe(id) {
  const cont = document.getElementById("detalheConteudo");
  cont.innerHTML = '<div class="carregando">Carregando anúncio...</div>';
  document.getElementById("detalhe").classList.add("aberto");
  try {
    const im = await API.verImovel(id);
    ESTADO.detalheImovel = im;
    ESTADO.detalheFotos = im.fotos || [];
    cont.innerHTML = htmlDetalhe(im);
    montarCarrossel();
    const bp = document.getElementById("btnFazerParceria");
    if (bp) bp.addEventListener("click", abrirModalParceria);
    const lm = document.getElementById("btnLerMais");
    if (lm) lm.addEventListener("click", () => {
      const t = document.getElementById("descTexto");
      const clamped = t.classList.toggle("clamp");
      lm.textContent = clamped ? "Ler mais ▾" : "Ler menos ▴";
    });
  } catch (e) {
    cont.innerHTML = `<div class="vazio">Erro: ${e.message}</div>`;
  }
}

function htmlDetalhe(im) {
  const preco = formatarPreco(im.preco) + (im.finalidade === "aluguel" ? "/mês" : "");
  const fotos = im.fotos || [];
  const slides = fotos.map((f) => `<div class="slide" style="background-image:url('${f}')"></div>`).join("");
  const bolinhas = fotos.map((_, i) => `<span class="bolinha ${i === 0 ? "ativa" : ""}"></span>`).join("");
  const video = (im.video_url || im.tem_video)
    ? `<div class="detalhe__video"><h3>🎬 Vídeo de apresentação (tour)</h3><video src="${im.video_url || ("/api/video/" + im.id)}" controls playsinline preload="none"></video></div>`
    : "";
  const zap = (im.corretor_nome || "Corretor");

  // Botão de contato via WhatsApp
  const msgWa = `Olá ${im.corretor_nome || ""}! Tenho interesse no imóvel "${im.titulo}" (${preco}) que vi no ImóvelIA.`;
  const wa = linkWhatsApp(im.contato, msgWa);
  const botaoContato = wa
    ? `<a class="botao-primario botao-wa" href="${wa}" target="_blank" rel="noopener">${ICONE("whatsapp", 20)} Falar no WhatsApp</a>`
    : `<button class="botao-primario" onclick="alert('Este anunciante não informou um WhatsApp.')">💬 Falar com o anunciante</button>`;

  // Botão "Fazer parceria": só para contas de corretor/imobiliária logadas
  const s = API.sessao();
  const podeParceria = s && s.token && (s.tipo === "corretor" || s.tipo === "imobiliaria");
  const botaoParceria = podeParceria
    ? `<button class="botao-secundario" id="btnFazerParceria">🤝 Fazer parceria</button>`
    : "";

  return `
    <div class="carrossel" id="carrossel">
      <div class="carrossel__trilho">${slides || '<div class="slide sem-foto">Sem fotos</div>'}</div>
      <div class="carrossel__bolinhas">${bolinhas}</div>
      <span class="detalhe__badge">${im.finalidade === "aluguel" ? "Aluguel" : "Venda"}</span>
      ${fotos.length ? '<button class="carrossel__ampliar" id="btnAmpliar">⛶ Ampliar</button>' : ""}
    </div>
    <div class="detalhe__corpo">
      <div class="detalhe__preco">${preco}</div>
      <h1 class="detalhe__titulo">${im.titulo}</h1>
      <p class="detalhe__local">📍 ${im.bairro || ""}, ${im.cidade || ""}</p>
      <div class="detalhe__specs">
        <div>${ICONE("quarto", 22)}<b>${im.quartos || 0}</b><span>quartos</span></div>
        <div>${ICONE("banheiro", 22)}<b>${im.banheiros || 0}</b><span>banheiros</span></div>
        <div>${ICONE("vaga", 22)}<b>${im.vagas || 0}</b><span>vagas</span></div>
        <div>${ICONE("area", 22)}<b>${im.area || 0}</b><span>m²</span></div>
      </div>
      ${video}
      <h3>Descrição</h3>
      <p class="detalhe__desc ${(im.descricao || "").length > 140 ? "clamp" : ""}" id="descTexto">${im.descricao || "Sem descrição."}</p>
      ${(im.descricao || "").length > 140 ? '<button class="ler-mais" id="btnLerMais">Ler mais ▾</button>' : ""}
      <div class="detalhe__corretor">
        <div class="avatar">${(im.corretor_nome || "?").charAt(0)}</div>
        <div><b>${im.corretor_nome || "-"}</b><span>Anunciante</span></div>
      </div>
    </div>
    <div class="detalhe__acao">
      ${botaoContato}
      ${botaoParceria}
    </div>`;
}

function montarCarrossel() {
  const car = document.getElementById("carrossel");
  if (!car) return;
  const trilho = car.querySelector(".carrossel__trilho");
  const bolinhas = car.querySelectorAll(".bolinha");
  const total = trilho.children.length;
  let idx = 0;
  const irPara = (novo) => {
    idx = Math.max(0, Math.min(total - 1, novo));
    trilho.style.transform = `translateX(-${idx * 100}%)`;
    bolinhas.forEach((b, i) => b.classList.toggle("ativa", i === idx));
  };
  // toque nas laterais navega; toque no centro amplia
  car.addEventListener("click", (e) => {
    if (e.target.id === "btnAmpliar") return; // tratado separadamente
    const r = car.getBoundingClientRect();
    const x = e.clientX - r.left;
    if (x < r.width * 0.25) irPara(idx - 1);
    else if (x > r.width * 0.75) irPara(idx + 1);
    else abrirLightbox(idx);
  });
  const amp = document.getElementById("btnAmpliar");
  if (amp) amp.addEventListener("click", (e) => { e.stopPropagation(); abrirLightbox(idx); });
}

function fecharDetalhe() {
  document.getElementById("detalhe").classList.remove("aberto");
}

// ---------- Lightbox (foto ampliada com zoom) ----------
function abrirLightbox(idx) {
  const fotos = ESTADO.detalheFotos || [];
  if (!fotos.length) return;
  ESTADO.lbIdx = idx;
  const lb = document.getElementById("lightbox");
  lb.classList.add("aberto");
  mostrarLightbox();
}

function mostrarLightbox() {
  const fotos = ESTADO.detalheFotos || [];
  const img = document.getElementById("lbImg");
  img.classList.remove("zoom");
  img.src = fotos[ESTADO.lbIdx];
  document.getElementById("lbContador").textContent = (ESTADO.lbIdx + 1) + " / " + fotos.length;
}

function navLightbox(dir) {
  const fotos = ESTADO.detalheFotos || [];
  ESTADO.lbIdx = (ESTADO.lbIdx + dir + fotos.length) % fotos.length;
  mostrarLightbox();
}

function fecharLightbox() {
  document.getElementById("lightbox").classList.remove("aberto");
}

// ---------- Parceria (corretor/imobiliária) ----------
function abrirModalParceria() {
  const im = ESTADO.detalheImovel;
  if (!im) return;
  document.getElementById("parceriaTexto").textContent =
    `Enviar proposta de parceria para ${im.corretor_nome || "o anunciante"} sobre "${im.titulo}".`;
  document.getElementById("statusParceria").textContent = "";
  document.getElementById("formParceria").reset();
  document.getElementById("modalParceria").classList.add("aberto");
}

function fecharModalParceria() {
  document.getElementById("modalParceria").classList.remove("aberto");
}

// ---------- Login / cadastro ----------
function abrirModalLogin() { document.getElementById("modalLogin").classList.add("aberto"); }
function fecharModalLogin() { document.getElementById("modalLogin").classList.remove("aberto"); }

function atualizarBarraConta() {
  const s = API.sessao();
  const btn = document.getElementById("btnConta");
  const sub = document.getElementById("topoSub");
  if (s && s.token) {
    btn.textContent = "Sair";
    sub.textContent = "Olá, " + s.nome + " 👋";
  } else {
    btn.textContent = "Entrar";
    sub.textContent = "Fale ou digite o que procura";
  }
}

async function fazerLogin(dados) {
  const r = await API.login(dados);
  API.salvarSessao({ token: r.token, nome: r.nome, tipo: r.tipo });
}

async function fazerCadastro(dados) {
  const r = await API.cadastrar(dados);
  API.salvarSessao({ token: r.token, nome: r.nome, tipo: r.tipo });
}

// ---------- Tela Anunciar ----------
function prepararAnunciar() {
  const bloqueado = document.getElementById("anunciarBloqueado");
  const form = document.getElementById("formAnuncio");
  if (API.logado()) {
    bloqueado.style.display = "none";
    form.style.display = "block";
    renderTrilhas();
    // pré-preenche o WhatsApp com o telefone do cadastro
    const campoWa = form.whatsapp;
    if (campoWa && !campoWa.value) {
      API.eu().then((u) => { if (u.telefone && !campoWa.value) campoWa.value = u.telefone; }).catch(() => {});
    }
  } else {
    bloqueado.style.display = "block";
    form.style.display = "none";
  }
}

function renderTrilhas() {
  const cont = document.getElementById("trilhas");
  if (cont.dataset.pronto) return;
  cont.innerHTML = Object.entries(TRILHAS).map(([chave, t]) =>
    `<button type="button" class="trilha ${chave === ESTADO.trilha ? "ativa" : ""}" data-chave="${chave}">${t.emoji} ${t.nome}</button>`
  ).join("");
  cont.dataset.pronto = "1";
  cont.querySelectorAll(".trilha").forEach((b) => {
    b.addEventListener("click", () => {
      ESTADO.trilha = b.dataset.chave;
      cont.querySelectorAll(".trilha").forEach((x) => x.classList.remove("ativa"));
      b.classList.add("ativa");
    });
  });
}

function renderMiniaturas() {
  const cont = document.getElementById("miniaturas");
  cont.innerHTML = ESTADO.fotos.map((f, i) =>
    `<div class="mini" style="background-image:url('${f}')"><button type="button" data-i="${i}">✕</button></div>`
  ).join("");
  cont.querySelectorAll("button").forEach((b) => {
    b.addEventListener("click", () => {
      ESTADO.fotos.splice(parseInt(b.dataset.i), 1);
      renderMiniaturas();
    });
  });
}

function lerArquivos(files) {
  Array.from(files).forEach((file) => {
    comprimirImagem(file, 1600, 0.72).then((dataUrl) => {
      ESTADO.fotos.push(dataUrl);
      renderMiniaturas();
    });
  });
}

// Reduz a foto no próprio navegador (redimensiona + comprime em JPEG)
// para não guardar imagens gigantes. Uma foto de 40 MB vira ~200-400 KB.
function comprimirImagem(file, maxLado, qualidade) {
  return new Promise((resolve) => {
    const r = new FileReader();
    r.onload = () => {
      const img = new Image();
      img.onload = () => {
        let w = img.width, h = img.height;
        if (w > maxLado || h > maxLado) {
          if (w >= h) { h = Math.round(h * maxLado / w); w = maxLado; }
          else { w = Math.round(w * maxLado / h); h = maxLado; }
        }
        const c = document.createElement("canvas");
        c.width = w; c.height = h;
        c.getContext("2d").drawImage(img, 0, 0, w, h);
        resolve(c.toDataURL("image/jpeg", qualidade));
      };
      img.onerror = () => resolve(r.result);
      img.src = r.result;
    };
    r.readAsDataURL(file);
  });
}

async function acaoGerarVideo() {
  if (!ESTADO.fotos.length) {
    document.getElementById("statusAnuncio").textContent = "Adicione fotos antes de gerar o vídeo.";
    return;
  }
  const form = document.getElementById("formAnuncio");
  const titulo = form.titulo.value || "Imóvel à venda";
  const local = [form.bairro.value, form.cidade.value].filter(Boolean).join(", ");
  const barra = document.getElementById("progressoVideo");
  const preview = document.getElementById("previewVideo");
  const btn = document.getElementById("btnGerarVideo");
  barra.style.display = "flex";
  preview.style.display = "none";
  btn.disabled = true;
  btn.textContent = "Gerando... (grava em tempo real)";
  try {
    const overlay = { linha1: titulo, linha2: local };
    const { dataUrl } = await gerarVideo(ESTADO.fotos, ESTADO.trilha, overlay, (pct) => {
      document.getElementById("progressoBarra").style.width = pct + "%";
      document.getElementById("progressoTexto").textContent = Math.round(pct) + "%";
    });
    ESTADO.videoDataUrl = dataUrl;
    preview.src = dataUrl;
    preview.style.display = "block";
    barra.style.display = "none";
  } catch (e) {
    document.getElementById("statusAnuncio").textContent = "Erro ao gerar vídeo: " + e.message;
    barra.style.display = "none";
  } finally {
    btn.disabled = false;
    btn.textContent = "✨ Gerar vídeo com as fotos";
  }
}

// ---------- Tour com IA (fluxo real: fila + status) ----------
async function acaoTourIA() {
  if (!API.logado()) { abrirModalLogin(); return; }
  if (!ESTADO.fotos.length) {
    document.getElementById("statusAnuncio").textContent = "Adicione ao menos uma foto para o tour com IA.";
    return;
  }
  const form = document.getElementById("formAnuncio");
  const titulo = form.titulo.value || "Imóvel";
  const btn = document.getElementById("btnTourIA");
  const textoOrig = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = "🤖 IA gerando seu tour...";
  try {
    const r = await API.criarTourIA({
      foto: ESTADO.fotos[0],
      prompt: "Tour cinematográfico caminhando por " + titulo,
      imovel_id: null,
    });
    const final = await pollTour(r.job_id);
    if (final.status === "sem_chave") {
      document.getElementById("modalTourIA").classList.add("aberto");
    } else if (final.status === "concluido") {
      ESTADO.videoDataUrl = final.video_url;
      const preview = document.getElementById("previewVideo");
      preview.src = final.video_url;
      preview.style.display = "block";
      document.getElementById("statusAnuncio").textContent = "";
    } else if (final.status === "erro") {
      document.getElementById("statusAnuncio").textContent = "Erro na IA: " + (final.mensagem || "");
    }
  } catch (e) {
    document.getElementById("statusAnuncio").textContent = e.message;
  } finally {
    btn.disabled = false;
    btn.innerHTML = textoOrig;
  }
}

function pollTour(jobId) {
  return new Promise((resolve, reject) => {
    let tentativas = 0;
    const t = setInterval(async () => {
      tentativas++;
      try {
        const s = await API.statusTourIA(jobId);
        if (["concluido", "sem_chave", "erro"].includes(s.status) || tentativas > 90) {
          clearInterval(t);
          resolve(s);
        }
      } catch (e) {
        clearInterval(t);
        reject(e);
      }
    }, 2000);
  });
}

function renderFeedContagem() {
  if (document.getElementById("tela-feed").classList.contains("ativa")) renderFeed();
}

async function publicarAnuncio(e) {
  e.preventDefault();
  const form = document.getElementById("formAnuncio");
  const status = document.getElementById("statusAnuncio");
  const dados = {
    titulo: form.titulo.value, tipo: form.tipo.value, finalidade: form.finalidade.value,
    cidade: form.cidade.value, bairro: form.bairro.value, preco: form.preco.value,
    quartos: form.quartos.value, banheiros: form.banheiros.value, vagas: form.vagas.value,
    area: form.area.value, descricao: form.descricao.value,
    fotos: ESTADO.fotos, video: ESTADO.videoDataUrl,
  };
  if (!dados.titulo) { status.textContent = "Informe o título."; return; }
  status.textContent = "Publicando...";
  try {
    await API.criarImovel(dados);
    status.textContent = "";
    // limpa e volta pro catálogo
    form.reset();
    ESTADO.fotos = []; ESTADO.videoDataUrl = null;
    renderMiniaturas();
    document.getElementById("previewVideo").style.display = "none";
    await carregarImoveis();
    abrirTela("buscar");
    alert("✅ Anúncio publicado! Ele já aparece no catálogo.");
  } catch (e2) {
    status.textContent = "Erro: " + e2.message;
  }
}

// ---------- Perfil ----------
function renderPerfil() {
  const cont = document.getElementById("perfilConteudo");
  const s = API.sessao();
  if (s && s.token) {
    cont.innerHTML = `
      <div class="perfil">
        <div class="avatar grande">${s.nome.charAt(0)}</div>
        <h2>${s.nome}</h2>
        <p class="perfil__tipo">${s.tipo === "imobiliaria" ? "🏢 Imobiliária" : "🧑‍💼 Corretor"}</p>
        <button class="botao-secundario" onclick="abrirTela('anunciar')">➕ Anunciar imóvel</button>
        <button class="botao-secundario" id="btnSair2">Sair da conta</button>
      </div>`;
    document.getElementById("btnSair2").addEventListener("click", sair);
  } else {
    cont.innerHTML = `
      <div class="embreve">👤<h2>Sua conta</h2><p>Entre para anunciar imóveis, criar vídeos e gerenciar seus anúncios.</p></div>
      <button class="botao-primario" onclick="abrirModalLogin()" style="max-width:320px;margin:0 auto;display:block">Entrar / Criar conta</button>`;
  }
}

function sair() {
  API.sair();
  atualizarBarraConta();
  prepararAnunciar();
  renderPerfil();
  abrirTela("buscar");
}

// ---------- Busca por voz ----------
function iniciarBuscaVoz() {
  const btnVoz = document.getElementById("btnVoz");
  const status = document.getElementById("statusVoz");
  const input = document.getElementById("campoBusca");
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) {
    btnVoz.addEventListener("click", () => {
      status.textContent = "⚠️ Seu navegador não suporta busca por voz. Use o Chrome ou digite.";
    });
    return;
  }
  const rec = new SR();
  rec.lang = "pt-BR"; rec.interimResults = true; rec.continuous = false;
  let ouvindo = false;
  btnVoz.addEventListener("click", () => {
    if (ouvindo) { rec.stop(); return; }
    try { rec.start(); } catch (e) {}
  });
  rec.onstart = () => { ouvindo = true; btnVoz.classList.add("gravando"); status.textContent = "🎙️ Ouvindo... pode falar!"; };
  rec.onresult = (ev) => {
    let texto = "";
    for (let i = 0; i < ev.results.length; i++) texto += ev.results[i][0].transcript;
    input.value = texto;
    status.textContent = '💬 "' + texto + '"';
    if (ev.results[ev.results.length - 1].isFinal) buscar(texto);
  };
  rec.onerror = (ev) => {
    ouvindo = false; btnVoz.classList.remove("gravando");
    if (ev.error === "not-allowed" || ev.error === "service-not-allowed") status.textContent = "🔒 Permita o acesso ao microfone.";
    else if (ev.error === "no-speech") status.textContent = "🤫 Não ouvi nada. Toque no microfone e fale.";
    else status.textContent = "Erro: " + ev.error;
  };
  rec.onend = () => { ouvindo = false; btnVoz.classList.remove("gravando"); };
}

// ---------- Ligações de eventos ----------
function ligarEventos() {
  // busca
  const input = document.getElementById("campoBusca");
  const acaoBuscar = () => { const v = input.value.trim(); v ? buscar(v) : renderizar(ESTADO.imoveis); };
  document.getElementById("btnBuscar").addEventListener("click", acaoBuscar);
  input.addEventListener("keydown", (e) => { if (e.key === "Enter") acaoBuscar(); });
  document.querySelectorAll(".exemplo").forEach((el) => {
    el.addEventListener("click", () => { const f = el.textContent.replace(/["“”]/g, "").trim(); input.value = f; buscar(f); });
  });

  // tabbar
  document.querySelectorAll(".tabbar__item").forEach((b) => {
    b.addEventListener("click", () => abrirTela(b.dataset.tela));
  });

  // conta (topo)
  document.getElementById("btnConta").addEventListener("click", () => {
    if (API.logado()) sair(); else abrirModalLogin();
  });
  document.getElementById("btnIrLogin").addEventListener("click", abrirModalLogin);
  document.getElementById("btnFecharLogin").addEventListener("click", fecharModalLogin);

  // tabs do modal
  document.querySelectorAll(".tab").forEach((t) => {
    t.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach((x) => x.classList.remove("ativa"));
      t.classList.add("ativa");
      const entrar = t.dataset.tab === "entrar";
      document.getElementById("formLogin").style.display = entrar ? "flex" : "none";
      document.getElementById("formCadastro").style.display = entrar ? "none" : "flex";
      document.getElementById("statusAuth").textContent = "";
    });
  });

  // submit login
  document.getElementById("formLogin").addEventListener("submit", async (e) => {
    e.preventDefault();
    const st = document.getElementById("statusAuth");
    st.textContent = "Entrando...";
    try {
      await fazerLogin({ email: e.target.email.value, senha: e.target.senha.value });
      st.textContent = ""; fecharModalLogin(); atualizarBarraConta(); prepararAnunciar();
    } catch (err) { st.textContent = err.message; }
  });

  // submit cadastro
  document.getElementById("formCadastro").addEventListener("submit", async (e) => {
    e.preventDefault();
    const st = document.getElementById("statusAuth");
    st.textContent = "Criando conta...";
    try {
      await fazerCadastro({
        nome: e.target.nome.value, email: e.target.email.value, telefone: e.target.telefone.value,
        senha: e.target.senha.value, tipo: e.target.tipo.value,
      });
      st.textContent = ""; fecharModalLogin(); atualizarBarraConta(); abrirTela("anunciar");
    } catch (err) { st.textContent = err.message; }
  });

  // anunciar: fotos, vídeo, publicar
  document.getElementById("btnAddFotos").addEventListener("click", () => document.getElementById("inputFotos").click());
  document.getElementById("inputFotos").addEventListener("change", (e) => lerArquivos(e.target.files));
  document.getElementById("btnGerarVideo").addEventListener("click", acaoGerarVideo);
  document.getElementById("formAnuncio").addEventListener("submit", publicarAnuncio);

  // tour com IA (premium) — fluxo real com fila e status
  const fecharTourIA = () => document.getElementById("modalTourIA").classList.remove("aberto");
  document.getElementById("btnTourIA").addEventListener("click", acaoTourIA);
  document.getElementById("btnFecharTourIA").addEventListener("click", fecharTourIA);
  document.getElementById("btnFecharTourIA2").addEventListener("click", fecharTourIA);

  // comentários
  document.getElementById("btnFecharComentarios").addEventListener("click", fecharComentarios);
  document.getElementById("formComentario").addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!API.logado()) { fecharComentarios(); abrirModalLogin(); return; }
    const texto = e.target.texto.value.trim();
    if (!texto) return;
    try {
      const r = await API.comentar(ESTADO.comentImovel, texto);
      const lista = document.getElementById("listaComentarios");
      if (lista.querySelector(".coment-vazio")) lista.innerHTML = "";
      lista.insertAdjacentHTML("beforeend", `<div class="coment"><b>${r.autor_nome}</b><span>${r.texto}</span></div>`);
      e.target.reset();
      // atualiza contagem no feed, se estiver visível
      renderFeedContagem();
    } catch (err) {
      document.getElementById("statusComentario").textContent = err.message;
    }
  });

  // detalhe
  document.getElementById("btnFecharDetalhe").addEventListener("click", fecharDetalhe);

  // lightbox
  document.getElementById("lbFechar").addEventListener("click", fecharLightbox);
  document.getElementById("lbPrev").addEventListener("click", () => navLightbox(-1));
  document.getElementById("lbNext").addEventListener("click", () => navLightbox(1));
  document.getElementById("lbImg").addEventListener("click", (e) => {
    e.stopPropagation();
    e.currentTarget.classList.toggle("zoom");
  });
  document.getElementById("lbPalco").addEventListener("click", (e) => {
    // clicar fora da imagem fecha
    if (e.target.id === "lbPalco") fecharLightbox();
  });

  // parceria
  document.getElementById("btnFecharParceria").addEventListener("click", fecharModalParceria);
  document.getElementById("formParceria").addEventListener("submit", async (e) => {
    e.preventDefault();
    const st = document.getElementById("statusParceria");
    st.style.color = "#ff4757";
    st.textContent = "Enviando...";
    try {
      const r = await API.fazerParceria({
        imovel_id: ESTADO.detalheImovel.id,
        mensagem: e.target.mensagem.value,
      });
      st.style.color = "var(--azul)";
      st.textContent = "✅ Proposta enviada para " + (r.anunciante || "o anunciante") + "!";
      setTimeout(fecharModalParceria, 1500);
    } catch (err) {
      st.style.color = "#ff4757";
      st.textContent = err.message;
    }
  });
}

// ---------- Início ----------
document.addEventListener("DOMContentLoaded", () => {
  pintarIcones();
  ligarEventos();
  iniciarBuscaVoz();
  atualizarBarraConta();
  carregarImoveis();
});

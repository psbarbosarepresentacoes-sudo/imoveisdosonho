// ============================================================
//  FEED SOCIAL (curtir, comentar, seguir)
// ============================================================

function postCard(im) {
  const foto = (im.fotos && im.fotos[0]) || "";
  const badge = im.finalidade === "aluguel" ? "Aluguel" : "Venda";
  const preco = formatarPreco(im.preco) + (im.finalidade === "aluguel" ? "/mês" : "");
  const inicial = (im.corretor_nome || "?").charAt(0);
  const s = API.sessao();
  const mostrarSeguir = !(s && s.nome === im.corretor_nome);
  const btnSeguir = mostrarSeguir
    ? `<button class="post__seguir ${im.seguindo ? "seguindo" : ""}" data-seguir="${im.corretor_id}">${im.seguindo ? "Seguindo" : "Seguir"}</button>`
    : "";
  const seloVideo = im.tem_video ? `<span class="post__selo">${ICONE("feed", 12)}vídeo</span>` : "";
  const waMsg = `Olá! Tenho interesse no imóvel "${im.titulo}" que vi no ImóvelIA.`;
  const wa = im.contato ? linkWhatsApp(im.contato, waMsg) : null;

  return `
    <article class="post" data-id="${im.id}">
      <header class="post__cabec">
        <div class="avatar peq">${inicial}</div>
        <div class="post__quem">
          <b>${im.corretor_nome || "-"}</b>
          <span>${im.bairro || ""}${im.cidade ? " · " + im.cidade : ""}</span>
        </div>
        ${btnSeguir}
      </header>
      <div class="post__midia" data-abrir="${im.id}" style="background-image:url('${foto}')">
        <span class="post__badge">${badge}</span>
        ${seloVideo}
      </div>
      <div class="post__acoes">
        <button class="post__acao ${im.curtido ? "curtido" : ""}" data-curtir="${im.id}">
          ${ICONE("curtir", 22)}<span data-contagem="${im.id}">${im.curtidas || 0}</span>
        </button>
        <button class="post__acao" data-coment="${im.id}">
          ${ICONE("comentar", 22)}<span>${im.comentarios_qtd || 0}</span>
        </button>
        <button class="post__acao" data-compart="${im.id}">${ICONE("compartilhar", 22)}</button>
        ${wa ? `<a class="post__acao post__wa" href="${wa}" target="_blank" rel="noopener" onclick="event.stopPropagation()">${ICONE("whatsapp", 22)}</a>` : ""}
      </div>
      <div class="post__corpo" data-abrir="${im.id}">
        <div class="post__linha1">
          <h3 class="post__titulo">${im.titulo}</h3>
          <span class="post__preco2">${preco}</span>
        </div>
        <div class="post__specs">${specsHTML(im, 15)}</div>
      </div>
    </article>`;
}

async function renderFeed() {
  const cont = document.getElementById("feed");
  cont.innerHTML = '<div class="carregando">Carregando feed...</div>';
  try {
    const lista = await API.listarImoveis();
    ESTADO.imoveis = lista; // mantém o catálogo em sincronia
    if (!lista.length) { cont.innerHTML = '<div class="vazio">Ainda não há publicações.</div>'; return; }
    cont.innerHTML = lista.map(postCard).join("");
    ligarEventosFeed();
  } catch (e) {
    cont.innerHTML = `<div class="vazio">Erro ao carregar o feed.<br>${e.message}</div>`;
  }
}

function precisaLogin() {
  if (!API.logado()) { abrirModalLogin(); return true; }
  return false;
}

function ligarEventosFeed() {
  const cont = document.getElementById("feed");

  cont.querySelectorAll("[data-abrir]").forEach((el) =>
    el.addEventListener("click", () => abrirDetalhe(el.dataset.abrir))
  );

  cont.querySelectorAll("[data-curtir]").forEach((el) =>
    el.addEventListener("click", async () => {
      if (precisaLogin()) return;
      try {
        const r = await API.curtir(parseInt(el.dataset.curtir));
        el.classList.toggle("curtido", r.curtido);
        const c = cont.querySelector(`[data-contagem="${el.dataset.curtir}"]`);
        if (c) c.textContent = r.curtidas;
      } catch (e) { alert(e.message); }
    })
  );

  cont.querySelectorAll("[data-coment]").forEach((el) =>
    el.addEventListener("click", () => abrirComentarios(parseInt(el.dataset.coment)))
  );

  cont.querySelectorAll("[data-seguir]").forEach((el) =>
    el.addEventListener("click", async () => {
      if (precisaLogin()) return;
      try {
        const r = await API.seguir(parseInt(el.dataset.seguir));
        el.classList.toggle("seguindo", r.seguindo);
        el.textContent = r.seguindo ? "Seguindo" : "Seguir";
      } catch (e) { alert(e.message); }
    })
  );

  cont.querySelectorAll("[data-compart]").forEach((el) =>
    el.addEventListener("click", () => {
      const url = location.origin + "/#imovel-" + el.dataset.compart;
      if (navigator.share) navigator.share({ title: "ImóvelIA", text: "Veja este imóvel", url });
      else { navigator.clipboard && navigator.clipboard.writeText(url); alert("Link copiado para compartilhar!"); }
    })
  );
}

// ---------- Comentários ----------
async function abrirComentarios(imovelId) {
  ESTADO.comentImovel = imovelId;
  const modal = document.getElementById("modalComentarios");
  const lista = document.getElementById("listaComentarios");
  document.getElementById("statusComentario").textContent = "";
  document.getElementById("formComentario").reset();
  modal.classList.add("aberto");
  lista.innerHTML = '<div class="carregando">Carregando...</div>';
  try {
    const cs = await API.verComentarios(imovelId);
    lista.innerHTML = cs.length
      ? cs.map((c) => `<div class="coment"><b>${c.autor_nome}</b><span>${c.texto}</span></div>`).join("")
      : '<div class="coment-vazio">Seja o primeiro a comentar.</div>';
  } catch (e) {
    lista.innerHTML = `<div class="coment-vazio">${e.message}</div>`;
  }
}

function fecharComentarios() {
  document.getElementById("modalComentarios").classList.remove("aberto");
}

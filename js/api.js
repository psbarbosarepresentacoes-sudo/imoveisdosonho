// ============================================================
//  API - comunicação com o backend + gestão da sessão de login
// ============================================================

const API = {
  // --- sessão (guardada no navegador) ---
  salvarSessao(dados) {
    localStorage.setItem("imovelia_sessao", JSON.stringify(dados));
  },
  sessao() {
    try {
      return JSON.parse(localStorage.getItem("imovelia_sessao"));
    } catch (e) {
      return null;
    }
  },
  logado() {
    const s = this.sessao();
    return !!(s && s.token);
  },
  sair() {
    localStorage.removeItem("imovelia_sessao");
  },

  // --- helper de requisição ---
  async req(metodo, rota, corpo) {
    const headers = { "Content-Type": "application/json" };
    const s = this.sessao();
    if (s && s.token) headers["Authorization"] = "Bearer " + s.token;
    const resp = await fetch(rota, {
      method: metodo,
      headers,
      body: corpo ? JSON.stringify(corpo) : undefined,
    });
    let dados = {};
    try { dados = await resp.json(); } catch (e) {}
    if (!resp.ok) {
      throw new Error(dados.erro || "Erro na requisição (" + resp.status + ")");
    }
    return dados;
  },

  // --- rotas ---
  listarImoveis() { return this.req("GET", "/api/imoveis"); },
  verImovel(id) { return this.req("GET", "/api/imoveis/" + id); },
  cadastrar(dados) { return this.req("POST", "/api/cadastro", dados); },
  login(dados) { return this.req("POST", "/api/login", dados); },
  criarImovel(dados) { return this.req("POST", "/api/imoveis", dados); },
  fazerParceria(dados) { return this.req("POST", "/api/parceria", dados); },
  curtir(imovel_id) { return this.req("POST", "/api/curtir", { imovel_id }); },
  comentar(imovel_id, texto) { return this.req("POST", "/api/comentar", { imovel_id, texto }); },
  verComentarios(imovel_id) { return this.req("GET", "/api/comentarios/" + imovel_id); },
  seguir(corretor_id) { return this.req("POST", "/api/seguir", { corretor_id }); },
  criarTourIA(dados) { return this.req("POST", "/api/tour-ia", dados); },
  statusTourIA(job_id) { return this.req("GET", "/api/tour-ia/" + job_id); },
  eu() { return this.req("GET", "/api/eu"); },
};

// Monta um link do WhatsApp (wa.me) a partir de um telefone brasileiro.
function linkWhatsApp(telefone, mensagem) {
  if (!telefone) return null;
  let num = String(telefone).replace(/\D/g, ""); // só dígitos
  if (!num) return null;
  if (num.length <= 11 && !num.startsWith("55")) num = "55" + num; // adiciona DDI Brasil
  return "https://wa.me/" + num + "?text=" + encodeURIComponent(mensagem || "");
}

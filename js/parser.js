// ============================================================
//  INTERPRETADOR DE LINGUAGEM NATURAL ("a IA da busca")
//  Transforma uma frase falada/digitada em filtros e aplica
//  sobre a lista de imóveis vinda do banco de dados.
// ============================================================

function normalizar(texto) {
  return (texto || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();
}

// Converte "200.000,00", "200 mil", "1,5 milhão" etc. em número inteiro.
function parseValor(trecho) {
  if (!trecho) return null;
  let t = normalizar(trecho);
  let multiplicador = 1;
  if (/milho|milhao|milhoes|mi\b/.test(t)) multiplicador = 1000000;
  else if (/mil\b/.test(t)) multiplicador = 1000;
  let numStr = (t.match(/[\d.,]+/) || [])[0];
  if (!numStr) return null;
  numStr = numStr.replace(/\./g, "").replace(",", ".");
  const n = parseFloat(numStr);
  if (isNaN(n)) return null;
  return Math.round(n * multiplicador);
}

function catalogoLocais(lista) {
  const bairros = new Set();
  const cidades = new Set();
  (lista || []).forEach((im) => {
    if (im.bairro) bairros.add(normalizar(im.bairro));
    if (im.cidade) cidades.add(normalizar(im.cidade));
  });
  return { bairros: [...bairros], cidades: [...cidades] };
}

function interpretarBusca(frase, lista) {
  const texto = normalizar(frase);
  const filtros = {
    textoOriginal: frase, cidade: null, bairro: null, tipo: null,
    finalidade: null, quartos: null, precoMin: null, precoMax: null,
  };

  if (/alugar|aluguel|locacao|locar/.test(texto)) filtros.finalidade = "aluguel";
  else if (/comprar|venda|vender|a venda|compra/.test(texto)) filtros.finalidade = "venda";

  if (/apartamento|apto|ap\b|kitnet|studio|flat/.test(texto)) filtros.tipo = "apartamento";
  else if (/casa|sobrado|residencia/.test(texto)) filtros.tipo = "casa";

  const q = texto.match(/(\d+)\s*(quarto|quartos|dormitorio|dormitorios|dorm)/);
  if (q) filtros.quartos = parseInt(q[1], 10);

  const { bairros, cidades } = catalogoLocais(lista);
  cidades.forEach((c) => { if (texto.includes(c)) filtros.cidade = c; });
  bairros.forEach((b) => { if (texto.includes(b)) filtros.bairro = b; });
  const bMatch = texto.match(/bairro\s+([a-z\s]+?)(?:\s+de\s|\s+em\s|\s+cidade|\s+\d|,|$)/);
  if (bMatch && !filtros.bairro) filtros.bairro = bMatch[1].trim();

  const faixa = texto.match(
    /(?:de|entre)\s+([\d.,]+\s*(?:mil|milhao|milhoes|mi)?)\s*(?:a|ate|e)\s+([\d.,]+\s*(?:mil|milhao|milhoes|mi)?)/
  );
  if (faixa) {
    filtros.precoMin = parseValor(faixa[1]);
    filtros.precoMax = parseValor(faixa[2]);
  } else {
    const ate = texto.match(/(?:ate|abaixo de|no maximo|maximo de|maximo)\s+([\d.,]+\s*(?:mil|milhao|milhoes|mi)?)/);
    if (ate) filtros.precoMax = parseValor(ate[1]);
    const acima = texto.match(/(?:acima de|a partir de|no minimo|minimo de|minimo|mais de)\s+([\d.,]+\s*(?:mil|milhao|milhoes|mi)?)/);
    if (acima) filtros.precoMin = parseValor(acima[1]);
  }
  return filtros;
}

function filtrarImoveis(filtros, lista) {
  return (lista || []).filter((im) => {
    if (filtros.cidade && normalizar(im.cidade) !== filtros.cidade) return false;
    if (filtros.bairro && !normalizar(im.bairro).includes(filtros.bairro)) return false;
    if (filtros.tipo && im.tipo !== filtros.tipo) return false;
    if (filtros.finalidade && im.finalidade !== filtros.finalidade) return false;
    if (filtros.quartos && (im.quartos || 0) < filtros.quartos) return false;
    if (filtros.precoMin && im.preco < filtros.precoMin) return false;
    if (filtros.precoMax && im.preco > filtros.precoMax) return false;
    return true;
  });
}

function resumoFiltros(f) {
  const partes = [];
  if (f.tipo) partes.push(f.tipo === "casa" ? "casas" : "apartamentos");
  else partes.push("imóveis");
  if (f.finalidade) partes.push("para " + (f.finalidade === "aluguel" ? "alugar" : "comprar"));
  if (f.quartos) partes.push("com " + f.quartos + "+ quartos");
  if (f.bairro) partes.push("no bairro " + f.bairro);
  if (f.cidade) partes.push("em " + f.cidade);
  if (f.precoMin && f.precoMax) partes.push("de " + formatarPreco(f.precoMin) + " a " + formatarPreco(f.precoMax));
  else if (f.precoMax) partes.push("até " + formatarPreco(f.precoMax));
  else if (f.precoMin) partes.push("acima de " + formatarPreco(f.precoMin));
  return partes.join(" ");
}

function formatarPreco(valor) {
  return Number(valor || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

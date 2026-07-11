// ============================================================
//  ÍCONES MINIMALISTAS (SVG linha, monocromáticos, herdam a cor)
//  Uso: ICONE('buscar')  ->  string SVG
// ============================================================

const ICONES = {
  buscar: '<circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.5" y2="16.5"/>',
  feed: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/>',
  anunciar: '<circle cx="12" cy="12" r="9"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/>',
  salvos: '<path d="M6 3h12v18l-6-4-6 4z"/>',
  perfil: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7"/>',
  curtir: '<path d="M12 20.5C7 17 3.5 13.5 3.5 9.5 3.5 7 5.4 5.2 7.8 5.2c1.6 0 3 .9 4.2 2.5 1.2-1.6 2.6-2.5 4.2-2.5 2.4 0 4.3 1.8 4.3 4.3 0 4-3.5 7.5-8.5 11z"/>',
  comentar: '<path d="M20 4H4v13h4v3l5-3h7z"/>',
  seguir: '<circle cx="9" cy="8" r="4"/><path d="M2 21c0-4 3.2-6 7-6"/><line x1="18" y1="8" x2="18" y2="14"/><line x1="15" y1="11" x2="21" y2="11"/>',
  compartilhar: '<circle cx="6" cy="12" r="2.4"/><circle cx="18" cy="6" r="2.4"/><circle cx="18" cy="18" r="2.4"/><line x1="8.1" y1="10.9" x2="15.9" y2="7.1"/><line x1="8.1" y1="13.1" x2="15.9" y2="16.9"/>',
  ampliar: '<path d="M9 4H4v5"/><path d="M15 4h5v5"/><path d="M4 15v5h5"/><path d="M20 15v5h-5"/>',
  voz: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0"/><line x1="12" y1="18" x2="12" y2="21"/>',
  voltar: '<path d="M15 5l-7 7 7 7"/>',
  fechar: '<line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/>',
  enviar: '<path d="M4 12l16-8-6 16-3-6-7-2z"/>',
  whatsapp: '<path d="M5 4h3l1.6 4-1.8 1.2a11 11 0 0 0 5 5L14 12.4 18 14v3a2 2 0 0 1-2 2A15 15 0 0 1 3 6a2 2 0 0 1 2-2z"/>',
  quarto: '<path d="M3 18v-5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v5"/><path d="M3 18h18"/><path d="M6 11V8.5A1.5 1.5 0 0 1 7.5 7h9A1.5 1.5 0 0 1 18 8.5V11"/><path d="M4 18v2M20 18v2"/>',
  banheiro: '<path d="M4 12h16v3a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4z"/><path d="M6 12V6.5A2.5 2.5 0 0 1 10.5 5"/><line x1="10" y1="7" x2="10.01" y2="7"/><path d="M7 19l-1 2M17 19l1 2"/>',
  vaga: '<path d="M5 13l1.6-4.4A2 2 0 0 1 8.5 7h7a2 2 0 0 1 1.9 1.6L19 13"/><path d="M4 13h16v4H4z"/><circle cx="7.5" cy="17" r="1.1"/><circle cx="16.5" cy="17" r="1.1"/>',
  area: '<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M4 9h3M4 14h3M9 4v3M14 4v3"/>',
  filtro: '<path d="M3 5h18"/><path d="M6 10h12"/><path d="M10 15h4"/>',
};

function ICONE(nome, tamanho = 24) {
  const corpo = ICONES[nome] || "";
  return `<svg class="ico" viewBox="0 0 24 24" width="${tamanho}" height="${tamanho}" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${corpo}</svg>`;
}

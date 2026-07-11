// ============================================================
//  GERADOR DE VÍDEO (fotos -> clipe de até 30s com música)
//
//  Como funciona (tudo no navegador, sem servidor de vídeo):
//   1. Desenha as fotos numa <canvas> vertical (formato Reels)
//      com efeito "Ken Burns" (zoom lento) e transição suave.
//   2. Captura a canvas como vídeo (canvas.captureStream).
//   3. Gera música royalty-free ao vivo com a Web Audio API
//      (100% livre de direitos autorais - criada na hora).
//   4. Grava vídeo + áudio juntos com o MediaRecorder -> arquivo .webm
//
//  IMPORTANTE (direitos autorais): as trilhas aqui são SINTETIZADAS
//  pelo próprio app, então não há risco jurídico. Hits "virais" reais
//  exigem contrato de licenciamento musical (ver notas no projeto).
// ============================================================

const LARGURA = 720;
const ALTURA = 1280;
const SEG_POR_FOTO = 4;          // segundos por foto (mais tempo = movimento mais suave)
const MAX_SEG = 30;              // duração máxima do clipe
const CROSSFADE = 0.9;           // segundos de transição entre fotos

// Movimentos de câmera que dão sensação de "tour" (não slideshow).
// s = zoom; x,y = deslocamento (fração, -0.5..0.5). A câmera vai de "de" até "ate".
const MOVIMENTOS = [
  { de: { s: 1.03, x: 0,     y: 0.05 }, ate: { s: 1.30, x: 0,     y: -0.02 } }, // avançar (entrar no cômodo)
  { de: { s: 1.24, x: -0.16, y: 0 },    ate: { s: 1.24, x: 0.16,  y: 0 } },     // panorâmica esquerda -> direita
  { de: { s: 1.24, x: 0.16,  y: 0 },    ate: { s: 1.24, x: -0.16, y: 0 } },     // panorâmica direita -> esquerda
  { de: { s: 1.32, x: 0,     y: 0 },    ate: { s: 1.05, x: 0,     y: 0 } },     // recuar (revelar o ambiente)
  { de: { s: 1.26, x: 0,     y: -0.14 },ate: { s: 1.26, x: 0,     y: 0.14 } },  // olhar do teto ao chão
  { de: { s: 1.28, x: -0.12, y: -0.08 },ate: { s: 1.08, x: 0.12,  y: 0.08 } },  // diagonal (varredura)
  { de: { s: 1.06, x: 0.10,  y: 0 },    ate: { s: 1.30, x: -0.06, y: 0 } },     // aproximar virando
];

function suavizar(t) { return -(Math.cos(Math.PI * t) - 1) / 2; } // easeInOutSine

// ---- Trilhas sonoras royalty-free (sintetizadas) ----
const TRILHAS = {
  nenhuma:     { nome: "Sem música", emoji: "🔇" },
  chill:       { nome: "Chill / Relax", emoji: "🌊", tempo: 90,  escala: [0,3,5,7,10], onda: "sine",     acordes: [0,-2,-4,-2] },
  energetico:  { nome: "Energético",   emoji: "⚡", tempo: 128, escala: [0,2,4,7,9],  onda: "sawtooth", acordes: [0,4,5,3] },
  corporativo: { nome: "Corporativo",  emoji: "🏢", tempo: 110, escala: [0,2,4,5,7,9,11], onda: "triangle", acordes: [0,5,3,4] },
  romantico:   { nome: "Romântico",    emoji: "💛", tempo: 80,  escala: [0,3,5,7,10,12], onda: "sine",   acordes: [0,-3,-5,-1] },
};

// Agenda notas na Web Audio para criar uma trilha simples e agradável.
function tocarTrilha(ctx, destino, trilha, duracaoSeg) {
  if (!trilha || !trilha.tempo) return () => {};
  const bpm = trilha.tempo;
  const beat = 60 / bpm;
  const base = 220; // Lá3
  const semitom = (n) => base * Math.pow(2, n / 12);

  const masterGain = ctx.createGain();
  masterGain.gain.value = 0.18;
  masterGain.connect(destino);
  masterGain.connect(ctx.destination); // também sai no alto-falante (preview)

  const nota = (freq, inicio, dur, vol, onda) => {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = onda || "sine";
    osc.frequency.value = freq;
    g.gain.setValueAtTime(0, inicio);
    g.gain.linearRampToValueAtTime(vol, inicio + 0.03);
    g.gain.exponentialRampToValueAtTime(0.001, inicio + dur);
    osc.connect(g);
    g.connect(masterGain);
    osc.start(inicio);
    osc.stop(inicio + dur + 0.05);
  };

  const t0 = ctx.currentTime + 0.1;
  const totalBeats = Math.ceil(duracaoSeg / beat);
  const esc = trilha.escala;
  for (let b = 0; b < totalBeats; b++) {
    const quando = t0 + b * beat;
    // acorde de fundo (pad) troca a cada 4 tempos
    if (b % 4 === 0) {
      const raiz = trilha.acordes[(b / 4) % trilha.acordes.length];
      [0, 4, 7].forEach((iv) => nota(semitom(raiz + iv), quando, beat * 4, 0.10, trilha.onda));
    }
    // melodia/arpejo
    const grau = esc[(b * 2) % esc.length];
    nota(semitom(grau + 12), quando, beat * 0.9, 0.16, trilha.onda);
  }
  return () => { try { masterGain.disconnect(); } catch (e) {} };
}

// Desenha a imagem com movimento de câmera (zoom + panorâmica) tipo tour.
// progresso 0..1 dentro do trecho; mov = um item de MOVIMENTOS; alpha = opacidade.
function desenharQuadro(cx, img, progresso, mov, alpha) {
  const t = suavizar(Math.max(0, Math.min(1, progresso)));
  const s = mov.de.s + (mov.ate.s - mov.de.s) * t;
  const px = mov.de.x + (mov.ate.x - mov.de.x) * t;
  const py = mov.de.y + (mov.ate.y - mov.de.y) * t;

  const iw = img.width, ih = img.height;
  const cobrir = Math.max(LARGURA / iw, ALTURA / ih);
  const escala = cobrir * s;
  const w = iw * escala, h = ih * escala;
  const folgaX = w - LARGURA; // espaço para deslocar sem mostrar fundo
  const folgaY = h - ALTURA;

  // clampa o deslocamento para nunca revelar borda preta
  const dx = Math.max(-folgaX / 2, Math.min(folgaX / 2, px * folgaX));
  const dy = Math.max(-folgaY / 2, Math.min(folgaY / 2, py * folgaY));
  const x = (LARGURA - w) / 2 + dx;
  const y = (ALTURA - h) / 2 + dy;

  cx.globalAlpha = alpha;
  cx.drawImage(img, x, y, w, h);
  cx.globalAlpha = 1;
}

function carregarImagem(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Falha ao carregar imagem"));
    img.src = src;
  });
}

// Gera o vídeo. Retorna { blob, dataUrl, duracao }.
// onProgresso(percentual 0..100) é chamado durante a gravação.
async function gerarVideo(fotos, chaveTrilha, textoOverlay, onProgresso) {
  if (!fotos || !fotos.length) throw new Error("Adicione ao menos uma foto.");

  const imgs = [];
  for (const f of fotos) {
    try { imgs.push(await carregarImagem(f)); } catch (e) { /* ignora foto com erro */ }
  }
  if (!imgs.length) throw new Error("Não foi possível carregar as fotos.");

  const duracao = Math.min(imgs.length * SEG_POR_FOTO, MAX_SEG);
  const segPorFoto = duracao / imgs.length;

  const canvas = document.createElement("canvas");
  canvas.width = LARGURA;
  canvas.height = ALTURA;
  const cx = canvas.getContext("2d");

  const streamVideo = canvas.captureStream(30);

  // --- áudio ---
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  const ctx = new AudioCtx();
  if (ctx.state === "suspended") await ctx.resume();
  const destinoAudio = ctx.createMediaStreamDestination();
  const trilha = TRILHAS[chaveTrilha];
  const pararTrilha = (trilha && trilha.tempo) ? tocarTrilha(ctx, destinoAudio, trilha, duracao) : () => {};

  // combina vídeo + áudio
  const trilhasMistas = [...streamVideo.getVideoTracks(), ...destinoAudio.stream.getAudioTracks()];
  const mixed = new MediaStream(trilhasMistas);

  const mime = MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")
    ? "video/webm;codecs=vp9,opus"
    : "video/webm";
  const rec = new MediaRecorder(mixed, { mimeType: mime, videoBitsPerSecond: 3_000_000 });
  const pedacos = [];
  rec.ondataavailable = (e) => { if (e.data.size) pedacos.push(e.data); };

  const fim = new Promise((resolve) => { rec.onstop = resolve; });
  rec.start();

  const inicio = performance.now();
  await new Promise((resolve) => {
    function frame() {
      const decorrido = (performance.now() - inicio) / 1000;
      const pct = Math.min(100, (decorrido / duracao) * 100);
      if (onProgresso) onProgresso(pct);

      // qual foto e progresso dentro dela
      const idx = Math.min(imgs.length - 1, Math.floor(decorrido / segPorFoto));
      const localProg = (decorrido - idx * segPorFoto) / segPorFoto;
      const movAtual = MOVIMENTOS[idx % MOVIMENTOS.length];

      cx.fillStyle = "#000";
      cx.fillRect(0, 0, LARGURA, ALTURA);
      desenharQuadro(cx, imgs[idx], localProg, movAtual, 1);

      // transição (crossfade) com a próxima foto no fim do trecho, mantendo o movimento
      const inicioFade = 1 - CROSSFADE / segPorFoto;
      if (localProg > inicioFade && idx < imgs.length - 1) {
        const a = (localProg - inicioFade) / (1 - inicioFade);
        const movProx = MOVIMENTOS[(idx + 1) % MOVIMENTOS.length];
        // a próxima foto já entra em movimento (não parada)
        desenharQuadro(cx, imgs[idx + 1], a * (CROSSFADE / segPorFoto), movProx, a);
      }

      // gradiente inferior + texto do anúncio
      const grad = cx.createLinearGradient(0, ALTURA - 320, 0, ALTURA);
      grad.addColorStop(0, "rgba(0,0,0,0)");
      grad.addColorStop(1, "rgba(0,0,0,0.75)");
      cx.fillStyle = grad;
      cx.fillRect(0, ALTURA - 320, LARGURA, 320);

      if (textoOverlay) {
        cx.fillStyle = "#fff";
        cx.font = "bold 52px -apple-system, Segoe UI, sans-serif";
        cx.textAlign = "left";
        envolverTexto(cx, textoOverlay.linha1 || "", 40, ALTURA - 180, LARGURA - 80, 60);
        if (textoOverlay.linha2) {
          cx.font = "500 36px -apple-system, Segoe UI, sans-serif";
          cx.fillStyle = "rgba(255,255,255,0.9)";
          cx.fillText(textoOverlay.linha2, 40, ALTURA - 90);
        }
      }
      // marca d'água
      cx.fillStyle = "rgba(255,255,255,0.85)";
      cx.font = "bold 34px -apple-system, Segoe UI, sans-serif";
      cx.textAlign = "right";
      cx.fillText("🏠 ImóvelIA", LARGURA - 30, 60);
      cx.textAlign = "left";

      if (decorrido >= duracao) { resolve(); return; }
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  });

  rec.stop();
  pararTrilha();
  await fim;
  try { ctx.close(); } catch (e) {}

  const blob = new Blob(pedacos, { type: "video/webm" });
  const dataUrl = await blobParaDataUrl(blob);
  if (onProgresso) onProgresso(100);
  return { blob, dataUrl, duracao };
}

function envolverTexto(cx, texto, x, y, larguraMax, alturaLinha) {
  const palavras = texto.split(" ");
  let linha = "";
  let linhas = [];
  for (const p of palavras) {
    const teste = linha + p + " ";
    if (cx.measureText(teste).width > larguraMax && linha) {
      linhas.push(linha);
      linha = p + " ";
    } else linha = teste;
  }
  linhas.push(linha);
  linhas = linhas.slice(-2); // no máximo 2 linhas
  const yInicial = y - (linhas.length - 1) * alturaLinha;
  linhas.forEach((l, i) => cx.fillText(l.trim(), x, yInicial + i * alturaLinha));
}

function blobParaDataUrl(blob) {
  return new Promise((resolve) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.readAsDataURL(blob);
  });
}

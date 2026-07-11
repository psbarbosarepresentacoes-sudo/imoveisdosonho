// ============================================================
//  PWA — instalação do app e registro do service worker
// ============================================================

let promptInstalar = null;

// Registra o service worker (necessário para instalar e usar offline)
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  });
}

// Android/Chrome: guarda o evento para disparar a instalação no nosso botão
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  promptInstalar = e;
  mostrarBannerInstalar();
});

function estaInstalado() {
  return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
}

function ehIOS() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function mostrarBannerInstalar() {
  if (estaInstalado()) return;
  if (localStorage.getItem("imovelia_banner_fechado")) return;
  const b = document.getElementById("bannerInstalar");
  if (b) b.style.display = "flex";
}

async function instalarApp() {
  if (promptInstalar) {
    // Android/Chrome: mostra o diálogo nativo de instalação
    promptInstalar.prompt();
    await promptInstalar.userChoice;
    promptInstalar = null;
    esconderBanner();
  } else if (ehIOS()) {
    // iPhone (Safari): instalação é manual
    alert(
      "Para instalar no iPhone:\n\n" +
      "1. Toque no botão Compartilhar (o quadrado com a seta para cima)\n" +
      "2. Escolha \"Adicionar à Tela de Início\"\n" +
      "3. Toque em Adicionar"
    );
  } else {
    alert("No navegador do celular, abra o menu (⋮) e toque em \"Instalar aplicativo\" ou \"Adicionar à tela inicial\".");
  }
}

function esconderBanner() {
  const b = document.getElementById("bannerInstalar");
  if (b) b.style.display = "none";
}

window.addEventListener("appinstalled", esconderBanner);

document.addEventListener("DOMContentLoaded", () => {
  const btn = document.getElementById("btnInstalar");
  const fechar = document.getElementById("btnFecharBanner");
  if (btn) btn.addEventListener("click", instalarApp);
  if (fechar) fechar.addEventListener("click", () => {
    esconderBanner();
    localStorage.setItem("imovelia_banner_fechado", "1");
  });
  // No iPhone o beforeinstallprompt não existe: mostra o banner mesmo assim
  if (ehIOS() && !estaInstalado()) setTimeout(mostrarBannerInstalar, 1500);
});

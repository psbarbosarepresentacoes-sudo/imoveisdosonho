# 📲 Publicar o ImóvelIA no Google Play

O app já é um PWA. Para virar um aplicativo do Google Play, embrulhamos o PWA
como **TWA** (Trusted Web Activity) usando o **Bubblewrap**. O que já deixei pronto
neste projeto: `manifest.json`, ícones, `twa-manifest.json` (configuração) e
`.well-known/assetlinks.json` (prova de propriedade).

## Pré-requisitos (o que você precisa antes)

1. **O app hospedado com URL fixa** (ex.: `https://imovel-ia.onrender.com`).
   Faça o passo 2 do arquivo `HOSPEDAGEM.md` primeiro. O Google Play aponta para essa URL.
2. **Conta de desenvolvedor Google Play** — taxa única de ~US$ 25:
   https://play.google.com/console/signup
3. **Node.js** — já está instalado na sua máquina (v24).

## Passo a passo

### 1) Atualize a URL nos arquivos
Troque `SEU-APP.onrender.com` pela sua URL real em:
- `twa-manifest.json` (campos `host`, `iconUrl`, `maskableIconUrl`)

### 2) Instale o Bubblewrap
No terminal:
```
npm install -g @bubblewrap/cli
```

### 3) Gere o projeto Android
```
bubblewrap init --manifest https://SUA-URL/manifest.json
```
- Na primeira vez ele baixa sozinho o JDK e o Android SDK (uns minutos).
- Aceite os padrões; o Application ID sugerido é `com.imovelia.app`.
- Ele cria uma **chave de assinatura** (`android.keystore`) — **guarde bem** (com senha),
  pois ela é necessária para todas as atualizações futuras.

### 4) Construa o app
```
bubblewrap build
```
Isso gera:
- `app-release-signed.aab` → é o arquivo que você envia ao Google Play.
- A **impressão digital SHA-256** da sua chave (também via `bubblewrap fingerprint`).

### 5) Conecte o app ao site (Digital Asset Links)
1. Copie o **SHA-256** e cole no arquivo `.well-known/assetlinks.json`
   (no lugar de `COLE_AQUI_...`).
2. Publique de novo o site (redeploy no Render), para que
   `https://SUA-URL/.well-known/assetlinks.json` mostre a impressão correta.
   > Isso é o que faz o app abrir **sem a barra de navegador** (cara de app nativo).
   > Obs.: se usar o "App Signing" do Google Play, pegue o SHA-256 em
   > Play Console → Configuração → Integridade do app → Certificado da chave de assinatura.

### 6) Publique no Play Console
1. Play Console → **Criar app** → nome "ImóvelIA", idioma Português (Brasil).
2. Preencha a **ficha da loja**: descrição, ícone (use `icons/icon-512.png`),
   capturas de tela do app, categoria "Casa e decoração" ou "Estilo de vida".
3. Em **Versões → Produção → Criar versão**, envie o `app-release-signed.aab`.
4. Preencha os questionários (classificação, privacidade) e **envie para revisão**.

A análise do Google costuma levar de algumas horas a alguns dias.

## Atualizações futuras
Quando quiser atualizar o app:
- Mudou só o site (telas, cores, funções)? **Não precisa reenviar** ao Google —
  o TWA carrega o site ao vivo, então basta publicar no Render.
- Mudou o ícone/nome/versão nativa? Rode `bubblewrap build` de novo (aumentando
  `appVersionCode` no `twa-manifest.json`) e envie o novo `.aab`.

## E o iPhone (App Store)?
A Apple não aceita TWA. Para iOS, embrulha-se com **Capacitor**, mas exige um
**Mac com Xcode** + conta Apple Developer (US$ 99/ano). Me avise quando for a hora.

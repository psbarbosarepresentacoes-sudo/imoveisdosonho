# 🌐 Como colocar o ImóvelIA na internet

Há dois caminhos. Comece pelo 1 (rápido, para testar no celular) e vá para o 2
quando quiser algo definitivo.

---

## 1) Túnel rápido (funciona AGORA, grátis, sem conta)

Expõe o app que roda no seu PC para a internet, na hora. Ótimo para testar no celular
e mostrar para clientes. **Requer o seu PC ligado com o servidor rodando.**

1. Rode o servidor:  `python imovel-ia/server.py`
2. Em outro terminal, rode o cloudflared apontando para a porta 5500:
   ```
   cloudflared.exe tunnel --url http://localhost:5500
   ```
3. Ele mostra uma URL tipo `https://algo-aleatorio.trycloudflare.com`.
   Abra essa URL em qualquer celular.

> A URL muda cada vez que você reinicia o túnel. Para uma URL fixa, use o caminho 2.

---

## 2) Hospedagem permanente (na nuvem)

Assim o app fica no ar 24h, com endereço fixo, sem depender do seu PC.
Recomendo o **Render** (tem plano gratuito). Passo a passo:

### a) Coloque o código no GitHub
1. Crie uma conta em https://github.com
2. Crie um repositório novo e envie a pasta `imovel-ia` para ele.
   (Posso te ajudar a fazer isso com os comandos `git`.)

### b) Crie o serviço no Render
1. Crie uma conta em https://render.com (pode entrar com o GitHub)
2. **New → Web Service** e conecte o repositório
3. Configure:
   - **Root Directory:** `imovel-ia` (se o repo tiver a pasta pai)
   - **Runtime:** Python
   - **Build Command:** (deixe vazio)
   - **Start Command:** `python server.py`
   - **Plan:** Free
4. Clique em **Create Web Service**. Em poucos minutos ele te dá uma URL fixa
   tipo `https://imovel-ia.onrender.com`.

O arquivo `render.yaml` já está pronto neste projeto para facilitar.

### ⚠️ Importante sobre os dados (banco)
No plano gratuito, o disco é **temporário**: cada vez que o serviço reinicia ou você
publica uma nova versão, o banco `db.sqlite3` volta ao estado inicial (perde anúncios/contas).
Para um produto de verdade, o próximo passo é trocar o SQLite por um **banco gerenciado**
(ex.: PostgreSQL, que o Render também oferece). É uma evolução natural — me avise quando
chegar a hora que eu faço essa migração.

### Ativar o Tour com IA na nuvem
No painel do Render, em **Environment**, adicione a variável `IA_VIDEO_API_KEY`
com a chave do seu provedor de IA. (E implemente `chamar_provedor_ia` no `server.py`.)

---

## 3) App instalável (PWA) — JÁ PRONTO ✅
O app já é um **PWA**: pode ser instalado na tela inicial do celular e abre em tela cheia,
com ícone próprio, funcionando até offline.

**Como instalar no celular** (abrindo a URL do app):
- **Android (Chrome):** aparece o banner "Instalar", ou menu ⋮ → "Instalar aplicativo".
- **iPhone (Safari):** botão Compartilhar → "Adicionar à Tela de Início".

## 4) Virar app das LOJAS (Google Play / App Store)
Com o app hospedado + PWA pronto, o empacotamento para as lojas é:
- **Google Play:** embrulhar o PWA como TWA (ferramenta Bubblewrap). Node.js já instalado.
  Precisa de conta de desenvolvedor Google (taxa única ~US$25).
- **App Store (iPhone):** embrulhar com Capacitor. Precisa de um **Mac com Xcode** e
  conta Apple Developer (US$99/ano).

Me avise quando quiser seguir para as lojas que eu preparo o empacotamento.

# 🏠 ImóvelIA

Aplicativo de compra/venda/aluguel de imóveis com **busca por voz (IA)**,
**gerador de vídeo** a partir de fotos e **área de login** para corretores e imobiliárias.

## Como rodar

1. Abra o terminal na pasta do projeto.
2. Rode:  `python imovel-ia/server.py`
3. Abra no **Chrome** ou **Edge**:  `http://localhost:5500`

> A busca por voz e a gravação de vídeo funcionam melhor no Chrome/Edge
> (precisam de permissão de microfone / gravação da tela do app).

## Conta de teste

- **E-mail:** demo@imovelia.com
- **Senha:** demo123

Ou crie sua própria conta em "Entrar → Criar conta".

## O que já funciona (etapas 1 e 2)

- 🔍 **Busca por voz e texto** — fale/digite "casa no Tiradentes de 200 a 300 mil" e a IA filtra.
- 🔐 **Login com senha** para corretores e imobiliárias (senha guardada com hash PBKDF2 + salt).
- ➕ **Anunciar imóvel** — formulário com fotos.
- 🎬 **Gerador de vídeo** — transforma as fotos num clipe de até 30s (estilo Reels),
  com **trilhas royalty-free geradas pelo próprio app** (sem risco de direitos autorais).
- 👀 **Ver o anúncio** — clique em qualquer imóvel para ver a tela de detalhe
  (carrossel de fotos, vídeo, specs, contato).

## Estrutura

```
imovel-ia/
├── server.py        # Backend (API + banco SQLite), Python puro, sem dependências
├── index.html       # Telas do app
├── css/styles.css   # Visual (mobile-first)
├── js/
│   ├── parser.js    # "IA" que interpreta a busca por voz
│   ├── api.js       # Comunicação com o backend + sessão
│   ├── video.js     # Gerador de vídeo (fotos → clipe com música)
│   └── app.js       # Lógica das telas
└── db.sqlite3       # Banco de dados (criado automaticamente)
```

## Sobre as músicas "virais" (direitos autorais)

As trilhas atuais são **sintetizadas pelo app** — 100% livres de direitos autorais.
Para usar hits reais ("virais" como no Instagram), é preciso **licenciamento musical**
(ex.: bibliotecas licenciadas como Epidemic Sound / Artlist, ou contrato direto com
gravadoras/editoras). O Instagram paga licenças caríssimas para isso — num app próprio,
o caminho seguro é uma biblioteca licenciada. Podemos integrar isso numa etapa futura.

## Feed social (etapa 3 — pronto)

Aba **Feed**: publicações estilo rede social com **curtir, comentar, seguir** e compartilhar.
Ícones minimalistas (SVG de linha) na navegação e nas ações.

## Tour com IA de verdade (arquitetura pronta — falta a chave)

O botão **"🤖 Gerar TOUR com IA"** (no formulário de anúncio) já chama o backend, que
coloca o pedido numa **fila** e devolve o **status**. Só falta conectar o provedor de IA:

1. Escolha um provedor de vídeo por IA e contrate um plano.
2. Antes de rodar o servidor, defina a chave:
   - PowerShell: `$env:IA_VIDEO_API_KEY = "sua-chave"`
3. Em `server.py`, implemente a função `chamar_provedor_ia(foto, prompt)`
   (é o único ponto de integração — recebe a foto e retorna a URL do vídeo).

Enquanto a chave não existir, o app mostra o aviso "recurso premium".
Validamos o conceito com o modelo **Higgsfield Cinema Studio** (~3 créditos por clipe de 3s).

## Próximas etapas do projeto

4. Contato via WhatsApp/telefone e chat.
5. Hospedagem na internet + empacotar para Google Play / App Store.
6. Ligar a IA de verdade (quando tiver plano + chave do provedor).

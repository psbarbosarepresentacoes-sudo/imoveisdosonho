# ============================================================
#  ImóvelIA - Servidor (backend) em Python puro (sem dependências)
#  - Serve a API REST (/api/...) e também os arquivos do site.
#  - Banco de dados SQLite (arquivo db.sqlite3 criado automaticamente).
#  - Login com senha guardada de forma segura (PBKDF2 + salt).
#
#  Rodar:  python server.py
#  Abrir:  http://localhost:5500
# ============================================================

import http.server
import socketserver
import sqlite3
import hashlib
import hmac
import secrets
import json
import os
import time
import threading
import base64
import re

PORTA = int(os.environ.get("PORT", "5500"))  # hospedagem define PORT automaticamente
PASTA = os.path.dirname(os.path.abspath(__file__))
BANCO = os.path.join(PASTA, "db.sqlite3")

# ------------------------------------------------------------
#  Configuração do provedor de IA de vídeo (Tour com IA)
#  Para ATIVAR: defina a variável de ambiente antes de rodar o servidor:
#     Windows (PowerShell):  $env:IA_VIDEO_API_KEY = "sua-chave"
#     Linux/Mac:             export IA_VIDEO_API_KEY="sua-chave"
#  Enquanto a chave não existir, o app mostra "aguardando configuração"
#  (a arquitetura de fila/status já funciona; só falta plugar a chamada real).
# ------------------------------------------------------------
IA_VIDEO_API_KEY = os.environ.get("IA_VIDEO_API_KEY", "").strip()
IA_VIDEO_PROVIDER = os.environ.get("IA_VIDEO_PROVIDER", "higgsfield").strip()


def chamar_provedor_ia(foto, prompt):
    """
    PONTO DE INTEGRAÇÃO ÚNICO com o provedor de IA de vídeo.
    Recebe a foto de origem + o prompt e deve devolver a URL do vídeo gerado.

    Hoje está como stub: quando você tiver a chave e o provedor escolhido,
    implemente aqui a chamada HTTP (enviar imagem -> aguardar -> retornar URL).
    Exemplo do fluxo que validamos (Higgsfield/Cinema Studio):
      1) importar a foto  -> media_id
      2) criar geração    -> job_id
      3) consultar job    -> status 'completed'
      4) retornar results.rawUrl (.mp4)
    """
    raise NotImplementedError("Chamada ao provedor de IA ainda não implementada.")


def processar_tour(job_id):
    """Roda em segundo plano: processa um pedido de tour com IA."""
    con = conectar()
    try:
        job = con.execute("SELECT * FROM tours_ia WHERE id=?", (job_id,)).fetchone()
        if not job:
            return
        con.execute("UPDATE tours_ia SET status='processando' WHERE id=?", (job_id,))
        con.commit()

        if not IA_VIDEO_API_KEY:
            con.execute(
                "UPDATE tours_ia SET status='sem_chave', mensagem=? WHERE id=?",
                ("Recurso premium: configure a chave do provedor de IA (IA_VIDEO_API_KEY) para ativar.", job_id),
            )
            con.commit()
            return

        try:
            url = chamar_provedor_ia(job["foto"], job["prompt"])
            con.execute("UPDATE tours_ia SET status='concluido', video_url=? WHERE id=?", (url, job_id))
            # anexa o vídeo ao imóvel também
            if job["imovel_id"]:
                con.execute("UPDATE imoveis SET video=? WHERE id=?", (url, job["imovel_id"]))
            con.commit()
        except Exception as e:
            con.execute("UPDATE tours_ia SET status='erro', mensagem=? WHERE id=?", (str(e), job_id))
            con.commit()
    finally:
        con.close()

# ------------------------------------------------------------
#  Banco de dados: PostgreSQL na nuvem (se a variável DATABASE_URL
#  existir) OU SQLite local (desenvolvimento). Um adaptador cuida
#  das diferenças para o resto do código continuar igual.
# ------------------------------------------------------------
DATABASE_URL = os.environ.get("DATABASE_URL", "").strip()
# Render às vezes usa 'postgres://'; o psycopg espera 'postgresql://'
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = "postgresql://" + DATABASE_URL[len("postgres://"):]
USAR_PG = bool(DATABASE_URL)

if USAR_PG:
    import psycopg
    from psycopg.errors import IntegrityError as _PgIntegrityError
    ERROS_INTEGRIDADE = (_PgIntegrityError,)
    TIPO_ID = "SERIAL PRIMARY KEY"
else:
    ERROS_INTEGRIDADE = (sqlite3.IntegrityError,)
    TIPO_ID = "INTEGER PRIMARY KEY AUTOINCREMENT"


class Linha(dict):
    """Linha de resultado que aceita acesso por nome (row['x']) e por índice (row[0])."""
    def __init__(self, colunas, valores):
        super().__init__(zip(colunas, valores))
        self._vals = list(valores)

    def __getitem__(self, chave):
        if isinstance(chave, int):
            return self._vals[chave]
        return super().__getitem__(chave)


class Cursor:
    def __init__(self, cur):
        self._cur = cur

    def _colunas(self):
        return [d[0] for d in self._cur.description] if self._cur.description else []

    def fetchone(self):
        r = self._cur.fetchone()
        return Linha(self._colunas(), r) if r is not None else None

    def fetchall(self):
        cols = self._colunas()
        return [Linha(cols, r) for r in self._cur.fetchall()]


class Conexao:
    """Interface única sobre sqlite3 e psycopg (placeholders, linhas, etc.)."""
    def __init__(self, raw):
        self._raw = raw

    def execute(self, sql, params=()):
        if USAR_PG:
            sql = sql.replace("?", "%s")
        cur = self._raw.cursor()
        cur.execute(sql, params)
        return Cursor(cur)

    def executescript(self, sql):
        for stmt in sql.split(";"):
            if stmt.strip():
                self.execute(stmt)

    def commit(self):
        self._raw.commit()

    def rollback(self):
        try:
            self._raw.rollback()
        except Exception:
            pass

    def close(self):
        try:
            self._raw.close()
        except Exception:
            pass


def conectar():
    if USAR_PG:
        return Conexao(psycopg.connect(DATABASE_URL))
    return Conexao(sqlite3.connect(BANCO))


def criar_tabelas():
    con = conectar()
    con.executescript(
        ("""
        CREATE TABLE IF NOT EXISTS corretores (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nome TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            senha_hash TEXT NOT NULL,
            senha_salt TEXT NOT NULL,
            tipo TEXT NOT NULL DEFAULT 'corretor',   -- 'corretor' ou 'imobiliaria'
            telefone TEXT,
            criado_em INTEGER
        );

        CREATE TABLE IF NOT EXISTS imoveis (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            corretor_id INTEGER,
            corretor_nome TEXT,
            titulo TEXT NOT NULL,
            tipo TEXT,
            finalidade TEXT,
            cidade TEXT,
            bairro TEXT,
            preco REAL,
            quartos INTEGER,
            banheiros INTEGER,
            vagas INTEGER,
            area REAL,
            descricao TEXT,
            video TEXT,               -- vídeo (data URL base64), opcional
            criado_em INTEGER
        );

        CREATE TABLE IF NOT EXISTS fotos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            imovel_id INTEGER,
            dados TEXT,               -- URL http OU data URL base64
            ordem INTEGER DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS sessoes (
            token TEXT PRIMARY KEY,
            corretor_id INTEGER,
            criado_em INTEGER
        );

        CREATE TABLE IF NOT EXISTS parcerias (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            de_corretor_id INTEGER,     -- quem propôs
            de_nome TEXT,
            imovel_id INTEGER,          -- sobre qual anúncio
            para_corretor_id INTEGER,   -- anunciante do imóvel
            mensagem TEXT,
            criado_em INTEGER
        );

        CREATE TABLE IF NOT EXISTS curtidas (
            corretor_id INTEGER,
            imovel_id INTEGER,
            criado_em INTEGER,
            PRIMARY KEY (corretor_id, imovel_id)
        );

        CREATE TABLE IF NOT EXISTS comentarios (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            imovel_id INTEGER,
            autor_id INTEGER,
            autor_nome TEXT,
            texto TEXT,
            criado_em INTEGER
        );

        CREATE TABLE IF NOT EXISTS seguidores (
            seguidor_id INTEGER,
            seguido_id INTEGER,
            criado_em INTEGER,
            PRIMARY KEY (seguidor_id, seguido_id)
        );

        CREATE TABLE IF NOT EXISTS tours_ia (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            imovel_id INTEGER,
            corretor_id INTEGER,
            foto TEXT,                  -- foto de origem (data URL ou URL)
            prompt TEXT,
            status TEXT,                -- na_fila | processando | concluido | sem_chave | erro
            mensagem TEXT,
            video_url TEXT,
            criado_em INTEGER
        );
        """).replace("INTEGER PRIMARY KEY AUTOINCREMENT", TIPO_ID)
    )
    con.commit()
    con.close()


def migrar():
    """Adiciona colunas novas em bancos já existentes (sem perder dados)."""
    con = conectar()
    try:
        if USAR_PG:
            cols = [r[0] for r in con.execute(
                "SELECT column_name FROM information_schema.columns WHERE table_name='imoveis'"
            ).fetchall()]
        else:
            cols = [r[1] for r in con.execute("PRAGMA table_info(imoveis)").fetchall()]
        if "contato" not in cols:
            con.execute("ALTER TABLE imoveis ADD COLUMN contato TEXT")
            # herda o telefone do dono do anúncio
            con.execute(
                "UPDATE imoveis SET contato = (SELECT telefone FROM corretores WHERE id = imoveis.corretor_id) "
                "WHERE contato IS NULL"
            )
        con.commit()
    finally:
        con.close()


# ------------------------------------------------------------
#  Senhas (PBKDF2) e sessões
# ------------------------------------------------------------
def hash_senha(senha, salt=None):
    if salt is None:
        salt = secrets.token_hex(16)
    dk = hashlib.pbkdf2_hmac("sha256", senha.encode("utf-8"), salt.encode("utf-8"), 100_000)
    return dk.hex(), salt


def senha_confere(senha, senha_hash, salt):
    calc, _ = hash_senha(senha, salt)
    return hmac.compare_digest(calc, senha_hash)


def criar_sessao(corretor_id):
    token = secrets.token_hex(32)
    con = conectar()
    con.execute(
        "INSERT INTO sessoes (token, corretor_id, criado_em) VALUES (?,?,?)",
        (token, corretor_id, int(time.time())),
    )
    con.commit()
    con.close()
    return token


def corretor_da_sessao(token):
    if not token:
        return None
    con = conectar()
    row = con.execute(
        "SELECT c.* FROM sessoes s JOIN corretores c ON c.id = s.corretor_id WHERE s.token = ?",
        (token,),
    ).fetchone()
    con.close()
    return row


# ------------------------------------------------------------
#  Dados iniciais (para o catálogo não começar vazio)
# ------------------------------------------------------------
SEED = [
    ("Casa 3 quartos com quintal","casa","venda","Campo Grande","Tiradentes",235000,3,2,2,120,
     "Casa térrea, quintal amplo, garagem coberta para 2 carros. Próxima a escolas e mercado.","Paulo Barbosa",
     ["https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=800&q=80",
      "https://images.unsplash.com/photo-1570129477492-45c003edd2be?w=800&q=80"]),
    ("Apartamento 2 quartos mobiliado","apartamento","venda","Campo Grande","Tiradentes",289000,2,1,1,68,
     "Apartamento reformado, mobiliado, com sacada. Condomínio com piscina e academia.","Paulo Barbosa",
     ["https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800&q=80"]),
    ("Casa ampla 4 quartos","casa","venda","Campo Grande","Tiradentes",315000,4,3,3,180,
     "Casa espaçosa com suíte, escritório e edícula nos fundos. Ótima localização.","Ana Lima",
     ["https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&q=80"]),
    ("Apartamento compacto","apartamento","venda","Campo Grande","Centro",198000,1,1,1,45,
     "Studio moderno no coração da cidade, ideal para investimento ou primeiro imóvel.","Ana Lima",
     ["https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800&q=80"]),
    ("Casa de esquina 3 quartos","casa","venda","Campo Grande","Jardim dos Estados",420000,3,2,2,150,
     "Casa de esquina, bem iluminada, com espaço gourmet. Bairro nobre e arborizado.","Paulo Barbosa",
     ["https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=800&q=80"]),
    ("Apartamento 3 quartos com suíte","apartamento","venda","Campo Grande","Tiradentes",275000,3,2,2,85,
     "Apartamento com suíte, varanda gourmet e vista livre. Lazer completo no condomínio.","Carlos Souza",
     ["https://images.unsplash.com/photo-1493809842364-78817add7ffb?w=800&q=80"]),
    ("Casa para aluguel 2 quartos","casa","aluguel","Campo Grande","Tiradentes",1800,2,1,1,90,
     "Casa para locação, quintal pequeno, próxima ao transporte público.","Carlos Souza",
     ["https://images.unsplash.com/photo-1583608205776-bfd35f0d9f83?w=800&q=80"]),
    ("Sobrado 4 quartos alto padrão","casa","venda","Campo Grande","Carandá Bosque",680000,4,4,4,260,
     "Sobrado de alto padrão em condomínio fechado, piscina privativa e área gourmet.","Ana Lima",
     ["https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=800&q=80"]),
]


def semear():
    con = conectar()
    n = con.execute("SELECT COUNT(*) FROM imoveis").fetchone()[0]
    if n > 0:
        con.close()
        return
    # cria uma conta demo dona dos anúncios de exemplo
    h, s = hash_senha("demo123")
    cur = con.execute(
        "INSERT INTO corretores (nome,email,senha_hash,senha_salt,tipo,telefone,criado_em) VALUES (?,?,?,?,?,?,?) RETURNING id",
        ("Paulo Barbosa", "demo@imovelia.com", h, s, "corretor", "(67) 99999-0000", int(time.time())),
    )
    dono = cur.fetchone()[0]
    for t in SEED:
        titulo,tipo,fin,cid,bairro,preco,q,ban,vag,area,desc,cor,fotos = t
        cur = con.execute(
            """INSERT INTO imoveis
               (corretor_id,corretor_nome,titulo,tipo,finalidade,cidade,bairro,preco,quartos,banheiros,vagas,area,descricao,criado_em)
               VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?) RETURNING id""",
            (dono,cor,titulo,tipo,fin,cid,bairro,preco,q,ban,vag,area,desc,int(time.time())),
        )
        imovel_id = cur.fetchone()[0]
        for i, url in enumerate(fotos):
            con.execute("INSERT INTO fotos (imovel_id,dados,ordem) VALUES (?,?,?)", (imovel_id, url, i))
    con.commit()
    con.close()


# ------------------------------------------------------------
#  Montagem dos dados de resposta
# ------------------------------------------------------------
def imovel_para_json(row, con, incluir_video=False, corretor_id=None, so_capa=False):
    d = dict(row)
    if so_capa:
        # lista/feed: manda só a 1ª foto (capa) para a resposta ficar leve
        cap = con.execute(
            "SELECT dados FROM fotos WHERE imovel_id=? ORDER BY ordem LIMIT 1", (row["id"],)
        ).fetchone()
        qtd = con.execute("SELECT COUNT(*) FROM fotos WHERE imovel_id=?", (row["id"],)).fetchone()[0]
        d["fotos"] = [cap["dados"]] if cap else []
        d["fotos_qtd"] = qtd
    else:
        fotos = con.execute(
            "SELECT dados FROM fotos WHERE imovel_id=? ORDER BY ordem", (row["id"],)
        ).fetchall()
        d["fotos"] = [f["dados"] for f in fotos]
        d["fotos_qtd"] = len(fotos)
    d["tem_video"] = bool(row["video"])
    d["curtidas"] = con.execute("SELECT COUNT(*) FROM curtidas WHERE imovel_id=?", (row["id"],)).fetchone()[0]
    d["comentarios_qtd"] = con.execute("SELECT COUNT(*) FROM comentarios WHERE imovel_id=?", (row["id"],)).fetchone()[0]
    if corretor_id:
        d["curtido"] = bool(con.execute(
            "SELECT 1 FROM curtidas WHERE imovel_id=? AND corretor_id=?", (row["id"], corretor_id)
        ).fetchone())
        if row["corretor_id"]:
            d["seguindo"] = bool(con.execute(
                "SELECT 1 FROM seguidores WHERE seguidor_id=? AND seguido_id=?", (corretor_id, row["corretor_id"])
            ).fetchone())
    else:
        d["curtido"] = False
        d["seguindo"] = False
    # contato (whatsapp): se faltar no anúncio, herda do dono
    if not d.get("contato") and row["corretor_id"]:
        dono = con.execute("SELECT telefone FROM corretores WHERE id=?", (row["corretor_id"],)).fetchone()
        d["contato"] = dono["telefone"] if dono else None
    # vídeo: nunca embute o base64 na resposta (é pesado). Manda uma URL.
    if incluir_video and row["video"]:
        v = row["video"]
        d["video_url"] = v if str(v).startswith("http") else "/api/video/" + str(row["id"])
    d.pop("video", None)
    return d


# ------------------------------------------------------------
#  Servidor HTTP
# ------------------------------------------------------------
class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=PASTA, **kwargs)

    # --- utilidades ---
    def responder_json(self, obj, status=200):
        corpo = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(corpo)))
        self.end_headers()
        self.wfile.write(corpo)

    def ler_json(self):
        tam = int(self.headers.get("Content-Length", 0))
        if tam == 0:
            return {}
        dados = self.rfile.read(tam)
        try:
            return json.loads(dados.decode("utf-8"))
        except Exception:
            return {}

    def token(self):
        auth = self.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            return auth[7:]
        return None

    # --- roteamento ---
    def do_GET(self):
        if self.path.startswith("/api/"):
            return self.rota_get()
        # senão, serve arquivos normalmente (index.html, css, js)
        return super().do_GET()

    def do_POST(self):
        if self.path.startswith("/api/"):
            return self.rota_post()
        self.send_error(404)

    # --- rotas GET ---
    def rota_get(self):
        con = conectar()
        cor = corretor_da_sessao(self.token())
        meu_id = cor["id"] if cor else None
        try:
            if self.path == "/api/imoveis":
                rows = con.execute("SELECT * FROM imoveis ORDER BY criado_em DESC").fetchall()
                lista = [imovel_para_json(r, con, corretor_id=meu_id, so_capa=True) for r in rows]
                return self.responder_json(lista)

            if self.path.startswith("/api/comentarios/"):
                ident = self.path.split("/")[-1]
                if not ident.isdigit():
                    return self.responder_json({"erro": "id inválido"}, 400)
                rows = con.execute(
                    "SELECT autor_nome, texto, criado_em FROM comentarios WHERE imovel_id=? ORDER BY criado_em",
                    (int(ident),),
                ).fetchall()
                return self.responder_json([dict(r) for r in rows])

            if self.path.startswith("/api/video/"):
                ident = self.path.split("/")[-1]
                if not ident.isdigit():
                    return self.responder_json({"erro": "id inválido"}, 400)
                row = con.execute("SELECT video FROM imoveis WHERE id=?", (int(ident),)).fetchone()
                if not row or not row["video"]:
                    return self.send_error(404)
                v = row["video"]
                m = re.match(r"data:(video/[\w.+-]+);base64,(.*)", v, re.S)
                if not m:
                    return self.send_error(404)
                dados = base64.b64decode(m.group(2))
                self.send_response(200)
                self.send_header("Content-Type", m.group(1))
                self.send_header("Content-Length", str(len(dados)))
                self.send_header("Accept-Ranges", "none")
                self.send_header("Cache-Control", "public, max-age=86400")
                self.end_headers()
                self.wfile.write(dados)
                return

            if self.path.startswith("/api/tour-ia/"):
                ident = self.path.split("/")[-1]
                if not ident.isdigit():
                    return self.responder_json({"erro": "id inválido"}, 400)
                row = con.execute("SELECT id,status,mensagem,video_url FROM tours_ia WHERE id=?", (int(ident),)).fetchone()
                if not row:
                    return self.responder_json({"erro": "não encontrado"}, 404)
                return self.responder_json(dict(row))

            if self.path.startswith("/api/imoveis/"):
                ident = self.path.split("/")[-1]
                if not ident.isdigit():
                    return self.responder_json({"erro": "id inválido"}, 400)
                row = con.execute("SELECT * FROM imoveis WHERE id=?", (int(ident),)).fetchone()
                if not row:
                    return self.responder_json({"erro": "não encontrado"}, 404)
                return self.responder_json(imovel_para_json(row, con, incluir_video=True, corretor_id=meu_id))

            if self.path == "/api/eu":
                cor = corretor_da_sessao(self.token())
                if not cor:
                    return self.responder_json({"erro": "não autenticado"}, 401)
                return self.responder_json({"id": cor["id"], "nome": cor["nome"], "email": cor["email"], "tipo": cor["tipo"], "telefone": cor["telefone"]})

            return self.responder_json({"erro": "rota não encontrada"}, 404)
        finally:
            con.close()

    # --- rotas POST ---
    def rota_post(self):
        dados = self.ler_json()

        if self.path == "/api/cadastro":
            return self.cadastro(dados)
        if self.path == "/api/login":
            return self.login(dados)
        if self.path == "/api/imoveis":
            return self.criar_imovel(dados)
        if self.path == "/api/parceria":
            return self.criar_parceria(dados)
        if self.path == "/api/curtir":
            return self.curtir(dados)
        if self.path == "/api/comentar":
            return self.comentar(dados)
        if self.path == "/api/seguir":
            return self.seguir(dados)
        if self.path == "/api/tour-ia":
            return self.criar_tour_ia(dados)

        return self.responder_json({"erro": "rota não encontrada"}, 404)

    def cadastro(self, d):
        nome = (d.get("nome") or "").strip()
        email = (d.get("email") or "").strip().lower()
        senha = d.get("senha") or ""
        tipo = d.get("tipo") if d.get("tipo") in ("corretor", "imobiliaria") else "corretor"
        telefone = (d.get("telefone") or "").strip()
        if not nome or not email or len(senha) < 6:
            return self.responder_json({"erro": "Preencha nome, e-mail e senha (mín. 6 caracteres)."}, 400)
        h, s = hash_senha(senha)
        con = conectar()
        try:
            cur = con.execute(
                "INSERT INTO corretores (nome,email,senha_hash,senha_salt,tipo,telefone,criado_em) VALUES (?,?,?,?,?,?,?) RETURNING id",
                (nome, email, h, s, tipo, telefone, int(time.time())),
            )
            novo_id = cur.fetchone()[0]
            con.commit()
            token = criar_sessao(novo_id)
            return self.responder_json({"token": token, "nome": nome, "tipo": tipo})
        except ERROS_INTEGRIDADE:
            con.rollback()
            return self.responder_json({"erro": "Este e-mail já está cadastrado."}, 409)
        finally:
            con.close()

    def login(self, d):
        email = (d.get("email") or "").strip().lower()
        senha = d.get("senha") or ""
        con = conectar()
        try:
            row = con.execute("SELECT * FROM corretores WHERE email=?", (email,)).fetchone()
            if not row or not senha_confere(senha, row["senha_hash"], row["senha_salt"]):
                return self.responder_json({"erro": "E-mail ou senha incorretos."}, 401)
            token = criar_sessao(row["id"])
            return self.responder_json({"token": token, "nome": row["nome"], "tipo": row["tipo"]})
        finally:
            con.close()

    def criar_imovel(self, d):
        cor = corretor_da_sessao(self.token())
        if not cor:
            return self.responder_json({"erro": "Faça login para anunciar."}, 401)
        titulo = (d.get("titulo") or "").strip()
        if not titulo:
            return self.responder_json({"erro": "Informe um título para o anúncio."}, 400)
        con = conectar()
        try:
            contato = (d.get("whatsapp") or "").strip() or cor["telefone"]
            cur = con.execute(
                """INSERT INTO imoveis
                   (corretor_id,corretor_nome,titulo,tipo,finalidade,cidade,bairro,preco,quartos,banheiros,vagas,area,descricao,video,contato,criado_em)
                   VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) RETURNING id""",
                (
                    cor["id"], cor["nome"], titulo,
                    d.get("tipo"), d.get("finalidade"), d.get("cidade"), d.get("bairro"),
                    _num(d.get("preco")), _int(d.get("quartos")), _int(d.get("banheiros")),
                    _int(d.get("vagas")), _num(d.get("area")), d.get("descricao"),
                    d.get("video"), contato, int(time.time()),
                ),
            )
            imovel_id = cur.fetchone()[0]
            fotos = d.get("fotos") or []
            for i, f in enumerate(fotos):
                con.execute("INSERT INTO fotos (imovel_id,dados,ordem) VALUES (?,?,?)", (imovel_id, f, i))
            con.commit()
            return self.responder_json({"id": imovel_id, "ok": True})
        finally:
            con.close()

    def criar_parceria(self, d):
        cor = corretor_da_sessao(self.token())
        if not cor:
            return self.responder_json({"erro": "Faça login para propor parceria."}, 401)
        if cor["tipo"] not in ("corretor", "imobiliaria"):
            return self.responder_json({"erro": "Apenas corretores e imobiliárias podem fazer parceria."}, 403)
        imovel_id = _int(d.get("imovel_id"))
        if not imovel_id:
            return self.responder_json({"erro": "Imóvel inválido."}, 400)
        con = conectar()
        try:
            imv = con.execute("SELECT corretor_id, corretor_nome FROM imoveis WHERE id=?", (imovel_id,)).fetchone()
            if not imv:
                return self.responder_json({"erro": "Anúncio não encontrado."}, 404)
            con.execute(
                """INSERT INTO parcerias (de_corretor_id,de_nome,imovel_id,para_corretor_id,mensagem,criado_em)
                   VALUES (?,?,?,?,?,?)""",
                (cor["id"], cor["nome"], imovel_id, imv["corretor_id"], (d.get("mensagem") or "").strip(), int(time.time())),
            )
            con.commit()
            return self.responder_json({"ok": True, "anunciante": imv["corretor_nome"]})
        finally:
            con.close()

    def curtir(self, d):
        cor = corretor_da_sessao(self.token())
        if not cor:
            return self.responder_json({"erro": "Entre para curtir."}, 401)
        imovel_id = _int(d.get("imovel_id"))
        if not imovel_id:
            return self.responder_json({"erro": "Imóvel inválido."}, 400)
        con = conectar()
        try:
            ja = con.execute(
                "SELECT 1 FROM curtidas WHERE corretor_id=? AND imovel_id=?", (cor["id"], imovel_id)
            ).fetchone()
            if ja:
                con.execute("DELETE FROM curtidas WHERE corretor_id=? AND imovel_id=?", (cor["id"], imovel_id))
                curtido = False
            else:
                con.execute(
                    "INSERT INTO curtidas (corretor_id,imovel_id,criado_em) VALUES (?,?,?)",
                    (cor["id"], imovel_id, int(time.time())),
                )
                curtido = True
            con.commit()
            total = con.execute("SELECT COUNT(*) FROM curtidas WHERE imovel_id=?", (imovel_id,)).fetchone()[0]
            return self.responder_json({"curtido": curtido, "curtidas": total})
        finally:
            con.close()

    def comentar(self, d):
        cor = corretor_da_sessao(self.token())
        if not cor:
            return self.responder_json({"erro": "Entre para comentar."}, 401)
        imovel_id = _int(d.get("imovel_id"))
        texto = (d.get("texto") or "").strip()
        if not imovel_id or not texto:
            return self.responder_json({"erro": "Escreva um comentário."}, 400)
        con = conectar()
        try:
            con.execute(
                "INSERT INTO comentarios (imovel_id,autor_id,autor_nome,texto,criado_em) VALUES (?,?,?,?,?)",
                (imovel_id, cor["id"], cor["nome"], texto, int(time.time())),
            )
            con.commit()
            total = con.execute("SELECT COUNT(*) FROM comentarios WHERE imovel_id=?", (imovel_id,)).fetchone()[0]
            return self.responder_json({"ok": True, "autor_nome": cor["nome"], "texto": texto, "comentarios_qtd": total})
        finally:
            con.close()

    def seguir(self, d):
        cor = corretor_da_sessao(self.token())
        if not cor:
            return self.responder_json({"erro": "Entre para seguir."}, 401)
        alvo = _int(d.get("corretor_id"))
        if not alvo or alvo == cor["id"]:
            return self.responder_json({"erro": "Alvo inválido."}, 400)
        con = conectar()
        try:
            ja = con.execute(
                "SELECT 1 FROM seguidores WHERE seguidor_id=? AND seguido_id=?", (cor["id"], alvo)
            ).fetchone()
            if ja:
                con.execute("DELETE FROM seguidores WHERE seguidor_id=? AND seguido_id=?", (cor["id"], alvo))
                seguindo = False
            else:
                con.execute(
                    "INSERT INTO seguidores (seguidor_id,seguido_id,criado_em) VALUES (?,?,?)",
                    (cor["id"], alvo, int(time.time())),
                )
                seguindo = True
            con.commit()
            return self.responder_json({"seguindo": seguindo})
        finally:
            con.close()

    def criar_tour_ia(self, d):
        cor = corretor_da_sessao(self.token())
        if not cor:
            return self.responder_json({"erro": "Faça login para gerar o tour."}, 401)
        foto = d.get("foto")
        if not foto:
            return self.responder_json({"erro": "Selecione uma foto para o tour."}, 400)
        con = conectar()
        try:
            cur = con.execute(
                """INSERT INTO tours_ia (imovel_id,corretor_id,foto,prompt,status,criado_em)
                   VALUES (?,?,?,?,?,?) RETURNING id""",
                (_int(d.get("imovel_id")), cor["id"], foto, d.get("prompt") or "",
                 "na_fila", int(time.time())),
            )
            job_id = cur.fetchone()[0]
            con.commit()
        finally:
            con.close()
        # processa em segundo plano (fila)
        threading.Thread(target=processar_tour, args=(job_id,), daemon=True).start()
        return self.responder_json({"job_id": job_id, "status": "na_fila", "ia_configurada": bool(IA_VIDEO_API_KEY)})

    def end_headers(self):
        # Arquivos do app (html/js/css): exige revalidação para as ATUALIZAÇÕES
        # aparecerem (sem isso o navegador serve versões antigas do cache).
        # A API e os vídeos definem seu próprio cache.
        if not self.path.startswith("/api/"):
            self.send_header("Cache-Control", "no-cache")
        super().end_headers()

    # silencia logs verbosos
    def log_message(self, *args):
        pass


def _num(v):
    try:
        return float(str(v).replace(".", "").replace(",", ".")) if v not in (None, "") else None
    except Exception:
        return None


def _int(v):
    try:
        return int(v) if v not in (None, "") else None
    except Exception:
        return None


class Servidor(socketserver.ThreadingMixIn, socketserver.TCPServer):
    allow_reuse_address = True
    daemon_threads = True


if __name__ == "__main__":
    criar_tabelas()
    migrar()
    semear()
    print(f"ImóvelIA rodando na porta {PORTA}")
    with Servidor(("0.0.0.0", PORTA), Handler) as httpd:
        httpd.serve_forever()

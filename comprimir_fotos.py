# Migração única: encolhe as fotos gigantes já salvas no banco.
# Redimensiona para no máx. 1600px e recomprime em JPEG. Usa Pillow.
import sqlite3, base64, io, re, os
from PIL import Image

BANCO = os.path.join(os.path.dirname(os.path.abspath(__file__)), "db.sqlite3")
MAX_LADO = 1600
QUALIDADE = 72
LIMITE = 400_000  # só mexe em fotos acima de ~400 KB

con = sqlite3.connect(BANCO)
con.row_factory = sqlite3.Row
rows = con.execute("SELECT id, dados FROM fotos").fetchall()

antes = depois = 0
mexidas = 0
for r in rows:
    dados = r["dados"]
    antes += len(dados)
    if not dados.startswith("data:") or len(dados) < LIMITE:
        depois += len(dados)
        continue
    m = re.match(r"data:(image/[\w.+-]+);base64,(.*)", dados, re.S)
    if not m:
        depois += len(dados)
        continue
    try:
        raw = base64.b64decode(m.group(2))
        img = Image.open(io.BytesIO(raw)).convert("RGB")
        img.thumbnail((MAX_LADO, MAX_LADO))
        buf = io.BytesIO()
        img.save(buf, "JPEG", quality=QUALIDADE, optimize=True)
        novo = "data:image/jpeg;base64," + base64.b64encode(buf.getvalue()).decode()
        if len(novo) < len(dados):
            con.execute("UPDATE fotos SET dados=? WHERE id=?", (novo, r["id"]))
            mexidas += 1
            depois += len(novo)
        else:
            depois += len(dados)
    except Exception as e:
        print("falha na foto", r["id"], e)
        depois += len(dados)

con.commit()
con.close()
print(f"fotos comprimidas: {mexidas}")
print(f"antes:  {antes/1024/1024:.1f} MB")
print(f"depois: {depois/1024/1024:.1f} MB")

# Gera os ícones do PWA (PNG) em Python puro, sem dependências.
# Desenha a "casa" da marca ImóvelIA sobre um fundo verde em degradê.
import zlib, struct, os

PASTA = os.path.join(os.path.dirname(os.path.abspath(__file__)), "icons")
os.makedirs(PASTA, exist_ok=True)

VERDE_TOPO = (11, 61, 117)     # #0b3d75 (azul principal)
VERDE_BASE = (23, 99, 182)     # #1763b6 (azul claro)
BRANCO = (222, 184, 63)        # #deb83f (casa dourada)


def lerp(a, b, t):
    return int(a + (b - a) * t)


def dentro_triangulo(px, py, a, b, c):
    def sinal(p1, p2, p3):
        return (p1[0]-p3[0])*(p2[1]-p3[1]) - (p2[0]-p3[0])*(p1[1]-p3[1])
    d1 = sinal((px, py), a, b)
    d2 = sinal((px, py), b, c)
    d3 = sinal((px, py), c, a)
    tem_neg = (d1 < 0) or (d2 < 0) or (d3 < 0)
    tem_pos = (d1 > 0) or (d2 > 0) or (d3 > 0)
    return not (tem_neg and tem_pos)


def gerar(tamanho, arquivo, maskable=False):
    S = tamanho
    raio = int(S * 0.22)                 # cantos arredondados (só quando não é maskable)
    escala = 0.50 if maskable else 0.66  # casa menor no maskable (zona de segurança)
    H = S * escala
    cx, cy = S / 2, S / 2

    # geometria da casa
    corpo_topo = cy - 0.06 * H
    corpo_baixo = cy + 0.42 * H
    corpo_esq = cx - 0.34 * H
    corpo_dir = cx + 0.34 * H
    apex = (cx, cy - 0.46 * H)
    base_esq = (cx - 0.48 * H, corpo_topo)
    base_dir = (cx + 0.48 * H, corpo_topo)
    porta_esq, porta_dir = cx - 0.10 * H, cx + 0.10 * H
    porta_topo = corpo_baixo - 0.24 * H

    linhas = bytearray()
    for y in range(S):
        linhas.append(0)  # filtro 0
        for x in range(S):
            # fundo (degradê vertical)
            t = y / S
            r = lerp(VERDE_TOPO[0], VERDE_BASE[0], t)
            g = lerp(VERDE_TOPO[1], VERDE_BASE[1], t)
            b = lerp(VERDE_TOPO[2], VERDE_BASE[2], t)
            a = 255

            # cantos arredondados (transparente) — só ícone "any"
            if not maskable:
                dx = dy = 0
                if x < raio and y < raio: dx, dy = raio - x, raio - y
                elif x >= S - raio and y < raio: dx, dy = x - (S - raio - 1), raio - y
                elif x < raio and y >= S - raio: dx, dy = raio - x, y - (S - raio - 1)
                elif x >= S - raio and y >= S - raio: dx, dy = x - (S - raio - 1), y - (S - raio - 1)
                if dx * dx + dy * dy > raio * raio:
                    a = 0

            # casa branca (telhado + corpo), porta recortada
            eh_casa = False
            if dentro_triangulo(x, y, apex, base_esq, base_dir):
                eh_casa = True
            if corpo_esq <= x <= corpo_dir and corpo_topo <= y <= corpo_baixo:
                eh_casa = True
            if porta_esq <= x <= porta_dir and porta_topo <= y <= corpo_baixo:
                eh_casa = False  # porta = fundo verde

            if eh_casa and a > 0:
                r, g, b = BRANCO

            linhas += bytes((r, g, b, a))

    # codifica PNG (RGBA, 8 bits)
    def chunk(tipo, dados):
        c = tipo + dados
        return struct.pack(">I", len(dados)) + c + struct.pack(">I", zlib.crc32(c) & 0xffffffff)

    png = b"\x89PNG\r\n\x1a\n"
    png += chunk(b"IHDR", struct.pack(">IIBBBBB", S, S, 8, 6, 0, 0, 0))
    png += chunk(b"IDAT", zlib.compress(bytes(linhas), 9))
    png += chunk(b"IEND", b"")

    caminho = os.path.join(PASTA, arquivo)
    with open(caminho, "wb") as f:
        f.write(png)
    print("gerado:", arquivo, f"({len(png)//1024} KB)")


gerar(192, "icon-192.png")
gerar(512, "icon-512.png")
gerar(512, "icon-512-maskable.png", maskable=True)
gerar(180, "apple-touch-icon.png", maskable=True)  # iOS aplica o próprio arredondamento
print("OK")

"""Gera o ícone do The Editor em todos os tamanhos que o app usa.

Marca: quadrado arredondado Azul Klein, "play" branco atravessado por um corte
diagonal (a edição) e um brilho de 4 pontas (a IA). Rodar:
    python branding/make_icons.py
"""
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
S = 1024  # canvas base
SS = 4    # supersampling p/ bordas lisas

BG = (0, 47, 167, 255)  # Azul Klein #002FA7
FG = (255, 255, 255, 255)

MARGIN = 40
RADIUS = 230
TRIANGLE = [(372, 292), (372, 732), (752, 512)]
CUT = [(300, 600), (800, 340)]  # faixa preta atravessando o play
CUT_W = 40
SPARK_C, SPARK_R, SPARK_r = (770, 262), 96, 20


def star(cx, cy, R, r):
    # 4 pontas: alterna raio externo (eixos) e interno (diagonais)
    import math
    pts = []
    for i in range(8):
        ang = math.pi / 2 * (i // 2) + (math.pi / 4 if i % 2 else 0) - math.pi / 2
        rad = R if i % 2 == 0 else r
        pts.append((cx + rad * math.cos(ang), cy + rad * math.sin(ang)))
    return pts


def render(size: int) -> Image.Image:
    big = S * SS
    img = Image.new("RGBA", (big, big), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    k = SS
    d.rounded_rectangle(
        [MARGIN * k, MARGIN * k, (S - MARGIN) * k, (S - MARGIN) * k],
        radius=RADIUS * k, fill=BG,
    )
    d.polygon([(x * k, y * k) for x, y in TRIANGLE], fill=FG)
    d.line([(x * k, y * k) for x, y in CUT], fill=BG, width=CUT_W * k)
    d.polygon([(x * k, y * k) for x, y in star(*SPARK_C, SPARK_R, SPARK_r)], fill=FG)
    return img.resize((size, size), Image.LANCZOS)


def svg() -> str:
    tri = " ".join(f"{x},{y}" for x, y in TRIANGLE)
    st = " ".join(f"{x:.1f},{y:.1f}" for x, y in star(*SPARK_C, SPARK_R, SPARK_r))
    (x1, y1), (x2, y2) = CUT
    w = S - 2 * MARGIN
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {S} {S}">'
        f'<rect x="{MARGIN}" y="{MARGIN}" width="{w}" height="{w}" rx="{RADIUS}" fill="#002fa7"/>'
        f'<polygon points="{tri}" fill="#fff"/>'
        f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" stroke="#002fa7" stroke-width="{CUT_W}"/>'
        f'<polygon points="{st}" fill="#fff"/></svg>\n'
    )


def main():
    master = render(1024)
    out = ROOT / "branding"
    master.save(out / "the-editor-1024.png")

    desktop_build = ROOT / "apps" / "desktop" / "build"
    master.resize((512, 512), Image.LANCZOS).save(desktop_build / "icon.png")
    master.save(desktop_build / "icon.ico", sizes=[(s, s) for s in (16, 24, 32, 48, 64, 128, 256)])

    icons = ROOT / "apps" / "web" / "public" / "icons"
    for name, size in {
        "favicon-16.png": 16, "favicon-32.png": 32, "apple-touch-icon.png": 180,
        "icon-192.png": 192, "icon-512.png": 512,
    }.items():
        render(size).save(icons / name)
    # maskable: fundo preto cheio (o SO recorta)
    mask = Image.new("RGBA", (512, 512), BG)
    mask.alpha_composite(render(400), (56, 56))
    mask.save(icons / "icon-maskable-512.png")

    s = svg()
    (out / "the-editor.svg").write_text(s, encoding="utf-8")
    (ROOT / "apps" / "web" / "public" / "favicon.svg").write_text(s, encoding="utf-8")
    (icons / "editor-reel.svg").write_text(s, encoding="utf-8")
    print("ok")


if __name__ == "__main__":
    main()

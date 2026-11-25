# BeatWave · logo propio: tres carriles con notas que caen y una línea de golpe (no usa círculos ni barras de sonido).
# Uso:  pip install pillow   y luego   python tools/make_logo.py
# Crea icon-512.png e icon-192.png en la carpeta del proyecto (ocupan todo el cuadro, sirven como ícono "maskable").
import os
from PIL import Image, ImageDraw, ImageFilter
S = 2048; K = S / 1024.0
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
def lerp(a, b, t): return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))
MINT, BLUE = (99, 242, 168), (77, 141, 245)
bg = Image.new("RGB", (S, S)); px = bg.load()
for y in range(S):
    c = lerp((22, 22, 44), (7, 7, 13), y / S)
    for x in range(S): px[x, y] = c
glow = Image.new("RGBA", (S, S), (0, 0, 0, 0)); gd = ImageDraw.Draw(glow)
gd.ellipse([S * .12, S * .62, S * .88, S * 1.12], fill=MINT + (110,)); gd.ellipse([S * .3, S * .05, S * .95, S * .5], fill=BLUE + (60,))
glow = glow.filter(ImageFilter.GaussianBlur(160 * K / 2)); im = Image.alpha_composite(bg.convert("RGBA"), glow)
def grad_rr(box, r, c0=MINT, c1=BLUE):
    x0, y0, x1, y1 = [int(v * K) for v in box]; w, h = x1 - x0, y1 - y0
    g = Image.new("RGBA", (w, h)); gp = g.load()
    for yy in range(h):
        for xx in range(w): gp[xx, yy] = lerp(c0, c1, (xx / w * .4 + yy / h * .6)) + (255,)
    m = Image.new("L", (w, h), 0); ImageDraw.Draw(m).rounded_rectangle([0, 0, w - 1, h - 1], int(r * K), fill=255)
    return g, m, (x0, y0)
LW, GAP = 190, 30; left = 512 - (3 * LW + 2 * GAP) / 2; lanes = [left + i * (LW + GAP) for i in range(3)]
lay = Image.new("RGBA", (S, S), (0, 0, 0, 0)); d = ImageDraw.Draw(lay)
for x in lanes: d.rounded_rectangle([x * K, 170 * K, (x + LW) * K, 880 * K], int(34 * K), fill=(255, 255, 255, 16))
im = Image.alpha_composite(im, lay)
notes = [(0, 250, 372), (1, 300, 640), (2, 470, 592)]  # carril, arriba, abajo (el del centro es una nota larga)
sh = Image.new("RGBA", (S, S), (0, 0, 0, 0)); sd = ImageDraw.Draw(sh)
for l, t, b in notes: sd.rounded_rectangle([(lanes[l] + 16) * K, t * K, (lanes[l] + LW - 16) * K, b * K], int(36 * K), fill=MINT + (150,))
im = Image.alpha_composite(im, sh.filter(ImageFilter.GaussianBlur(26 * K)))
for l, t, b in notes:
    g, m, pos = grad_rr([lanes[l] + 16, t, lanes[l] + LW - 16, b], 36); im.paste(g, pos, m)
hit = Image.new("RGBA", (S, S), (0, 0, 0, 0)); hd = ImageDraw.Draw(hit)
hd.rounded_rectangle([(lanes[0] - 22) * K, 772 * K, (lanes[2] + LW + 22) * K, 792 * K], int(10 * K), fill=(255, 255, 255, 235))
for x in lanes: hd.rounded_rectangle([(x + 8) * K, 722 * K, (x + LW - 8) * K, 842 * K], int(40 * K), outline=MINT + (200,), width=int(9 * K))
im = Image.alpha_composite(im, hit.filter(ImageFilter.GaussianBlur(14 * K)).point(lambda v: v)); im = Image.alpha_composite(im, hit)
im = im.convert("RGB")
for n in (512, 192): im.resize((n, n), Image.LANCZOS).save(os.path.join(OUT, f"icon-{n}.png"), optimize=True); print("listo: icon-%d.png" % n)
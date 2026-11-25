# BeatWave · fondos de tema en alta resolución (2160x3840, vertical).
# Uso:  pip install pillow numpy   y luego   python tools/make_assets_hd.py
# Crea assets/themes/<tema>.png
import os, math, random
import numpy as np
from PIL import Image, ImageDraw
dst = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "assets", "themes")
os.makedirs(dst, exist_ok=True)
W, H = 2160, 3840
THEMES = {  # nombre: (color arriba, color abajo, color de acento)
    "menta":     ((10, 28, 26), (7, 12, 22), (99, 242, 168)),
    "atardecer": ((38, 14, 28), (12, 10, 28), (255, 90, 140)),
    "oceano":    ((8, 20, 46), (7, 10, 22), (77, 141, 245)),
    "violeta":   ((26, 16, 52), (10, 8, 24), (160, 110, 245)),
    "carbon":    ((26, 26, 32), (8, 8, 12), (170, 180, 200)),
    "ambar":     ((40, 24, 10), (14, 10, 8), (255, 159, 67)),
}
def grad(c1, c2, ang=0.3):
    y, x = np.mgrid[0:H, 0:W].astype("float32")
    t = x * math.sin(ang) + y * math.cos(ang); t = (t - t.min()) / (t.max() - t.min())
    a = np.array(c1, "float32")[None, None, :] * (1 - t[..., None]) + np.array(c2, "float32")[None, None, :] * t[..., None]
    return Image.fromarray(a.astype("uint8")).convert("RGBA")
for i, (name, (c1, c2, acc)) in enumerate(THEMES.items()):
    random.seed(10 + i)
    im = grad(c1, c2); L = Image.new("RGBA", (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(L)
    for _ in range(46):  # triángulos grandes translúcidos (estilo low-poly)
        x, y, s = random.randint(-200, W), random.randint(-200, H), random.randint(260, 900)
        d.polygon([(x, y), (x + s, y + random.randint(-120, 120)), (x + s // 2, y - int(s * .86))], fill=acc + (random.randint(8, 24),))
    for _ in range(6):   # planos inclinados
        x, y, w, h, s = random.randint(-400, W), random.randint(0, H - 600), random.randint(500, 1300), random.randint(900, 2200), random.randint(240, 520)
        d.polygon([(x + s, y), (x + w + s, y), (x + w, y + h), (x, y + h)], fill=acc + (random.randint(14, 34),))
    bars = 56; bw = W / bars
    for k in range(bars):  # ecualizador plano abajo
        hh = 140 + abs(math.sin(k * .45)) * 380 + random.randint(0, 120)
        d.polygon([(k * bw + 20 + 30, H - hh), (k * bw + bw - 8 + 30, H - hh), (k * bw + bw - 8, H), (k * bw + 20, H)], fill=acc + (96,))
    for gx in range(0, W, 108):
        for gy in range(0, H, 108): d.ellipse([gx, gy, gx + 5, gy + 5], fill=(255, 255, 255, 20))
    Image.alpha_composite(im, L).convert("RGB").save(os.path.join(dst, name + ".png"), optimize=True)
    print("listo:", name)

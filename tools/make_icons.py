"""Pone el logo de BeatWave como icono y pantalla de arranque de la app Android.
Se ejecuta en el build (después de «cap add android»). Usa icon-512.png e icon-maskable-512.png de la raíz del proyecto.
Opcional: pasa otra carpeta raíz como primer argumento (para probar)."""
import glob, os, re, sys
from PIL import Image, ImageDraw

root = sys.argv[1] if len(sys.argv) > 1 else os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
res = os.path.join(root, 'android', 'app', 'src', 'main', 'res')
if not os.path.isdir(res):
    sys.exit('No encuentro ' + res + ' (¿se ejecutó «npx cap add android» antes?)')

def inventario():
    return sorted(os.path.relpath(f, res) for f in glob.glob(os.path.join(res, '**', '*'), recursive=True) if os.path.isfile(f) and re.search(r'(ic_launcher|splash)', os.path.basename(f)))
print('ANTES (lo que trae Capacitor):'); [print('  ', f) for f in inventario()]
# se borra lo viejo para que no quede nada de Capacitor mezclado con lo nuestro
for f in glob.glob(os.path.join(res, '**', '*'), recursive=True):
    b = os.path.basename(f)
    if os.path.isfile(f) and (b.startswith('ic_launcher') or b.startswith('splash')) and not b.startswith('bw_'):
        os.remove(f)
icon = Image.open(os.path.join(root, 'icon-512.png')).convert('RGBA')
mask = Image.open(os.path.join(root, 'icon-maskable-512.png')).convert('RGBA')
bg = mask.getpixel((6, 6))[:3]
bg_hex = '#%02X%02X%02X' % bg

# 1) iconos del lanzador (cuadrado, redondo y adaptable)
DENS = {'mdpi': 1, 'hdpi': 1.5, 'xhdpi': 2, 'xxhdpi': 3, 'xxxhdpi': 4}
for d, k in DENS.items():
    folder = os.path.join(res, 'mipmap-' + d)
    os.makedirs(folder, exist_ok=True)
    s = round(48 * k)
    icon.resize((s, s), Image.LANCZOS).save(os.path.join(folder, 'ic_launcher.png'))
    rd = icon.resize((s, s), Image.LANCZOS); m = Image.new('L', (s * 4, s * 4), 0)
    ImageDraw.Draw(m).ellipse((0, 0, s * 4 - 1, s * 4 - 1), fill=255); rd.putalpha(m.resize((s, s), Image.LANCZOS))
    rd.save(os.path.join(folder, 'ic_launcher_round.png'))
    f = round(108 * k); fg = Image.new('RGBA', (f, f), bg + (255,))
    inner = round(f * 0.83); fg.alpha_composite(mask.resize((inner, inner), Image.LANCZOS), ((f - inner) // 2, (f - inner) // 2))
    fg.save(os.path.join(folder, 'ic_launcher_foreground.png'))
xml = '<?xml version="1.0" encoding="utf-8"?>\n<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">\n    <background android:drawable="@color/bw_icon_bg"/>\n    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>\n</adaptive-icon>\n'
os.makedirs(os.path.join(res, 'mipmap-anydpi-v26'), exist_ok=True)
for name in ('ic_launcher.xml', 'ic_launcher_round.xml'):
    open(os.path.join(res, 'mipmap-anydpi-v26', name), 'w', encoding='utf8').write(xml)
os.makedirs(os.path.join(res, 'values'), exist_ok=True)
open(os.path.join(res, 'values', 'bw_icon.xml'), 'w', encoding='utf8').write('<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="bw_icon_bg">%s</color>\n</resources>\n' % bg_hex)

# 2) pantalla de arranque (Android 11 o menos): fondo oscuro con el logo, en lugar del cuadro de Capacitor
n = 0
for p in glob.glob(os.path.join(res, '**', 'splash*.png'), recursive=True):
    try: w, h = Image.open(p).size
    except Exception: w, h = 1080, 1920
    im = Image.new('RGB', (w, h), bg); s = int(min(w, h) * 0.34); lg = icon.resize((s, s), Image.LANCZOS)
    im.paste(lg, ((w - s) // 2, (h - s) // 2), lg); im.save(p); n += 1

# (siempre debe existir drawable/splash.png: el tema de la app lo usa)
base = os.path.join(res, 'drawable', 'splash.png')
if not os.path.exists(base):
    os.makedirs(os.path.dirname(base), exist_ok=True)
    im = Image.new('RGB', (1080, 1920), bg); s = 360; lg = icon.resize((s, s), Image.LANCZOS); im.paste(lg, ((1080 - s) // 2, (1920 - s) // 2), lg); im.save(base); n += 1
# 3) pantalla de arranque (Android 12 o más): fondo y logo propios
sx = os.path.join(res, 'values', 'styles.xml')
if os.path.exists(sx):
    t = open(sx, encoding='utf8').read()
    m = re.search(r'<style name="AppTheme\.NoActionBarLaunch"[^>]*parent="Theme\.SplashScreen"[^>]*>', t)
    if m and 'windowSplashScreenBackground' not in t:
        t = t.replace(m.group(0), m.group(0) + '\n        <item name="windowSplashScreenBackground">@color/bw_icon_bg</item>\n        <item name="windowSplashScreenAnimatedIcon">@mipmap/ic_launcher_foreground</item>', 1)
        open(sx, 'w', encoding='utf8').write(t); print('Pantalla de arranque Android 12+ actualizada')
print('DESPUÉS (lo nuestro):'); [print('  ', f) for f in inventario()]
print('Icono de BeatWave listo (fondo %s) · imágenes de arranque: %d' % (bg_hex, n))

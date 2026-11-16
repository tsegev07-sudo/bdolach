# Makes every app icon size from icon/icon.png (a 1024x1024 square picture).
# Run from the repo root after replacing icon.png:  python3 icon/make-icons.py
# Needs Pillow and numpy (pip install pillow numpy).
#
# Writes:
#   www/icons/                 icons for iPhone / browser (PWA)
#   icon/android-res/          Android launcher icons, copied into the APK by
#                              .github/workflows/android.yml
import os
import numpy as np
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
src = Image.open(os.path.join(ROOT, "icon", "icon.png")).convert("RGB")


def padded(size, picture_share):
    """The picture shrunk to picture_share of the size, with its edges stretched
    outwards to fill the rest, so shapes that crop the icon (circles, squircles)
    never cut into the drawing."""
    inner = round(size * picture_share)
    pad_before = (size - inner) // 2
    pad_after = size - inner - pad_before
    pixels = np.asarray(src.resize((inner, inner), Image.LANCZOS))
    pixels = np.pad(pixels, ((pad_before, pad_after), (pad_before, pad_after), (0, 0)), mode="edge")
    return Image.fromarray(pixels)


def plain(size):
    return src.resize((size, size), Image.LANCZOS)


def round_cut(size):
    picture = padded(size, 0.9).convert("RGBA")
    scale = 4  # draw the circle large, then shrink it, for a smooth edge
    mask = Image.new("L", (size * scale, size * scale), 0)
    ImageDraw.Draw(mask).ellipse((0, 0, size * scale - 1, size * scale - 1), fill=255)
    picture.putalpha(mask.resize((size, size), Image.LANCZOS))
    return picture


def save(picture, *path):
    full = os.path.join(ROOT, *path)
    os.makedirs(os.path.dirname(full), exist_ok=True)
    picture.save(full, optimize=True)


# iPhone / browser
save(plain(192), "www", "icons", "icon-192.png")
save(plain(512), "www", "icons", "icon-512.png")
save(plain(180), "www", "icons", "apple-touch-icon.png")
# "maskable": the phone may crop it to any shape that covers the middle 80% circle
save(padded(512, 0.82), "www", "icons", "icon-maskable-512.png")

# Android. Older phones use ic_launcher / ic_launcher_round as they are.
# Android 8+ uses ic_launcher_foreground (108dp, of which only the middle
# 72dp shows, cropped to the phone's icon shape), see mipmap-anydpi-v26/.
densities = {"mdpi": 1, "hdpi": 1.5, "xhdpi": 2, "xxhdpi": 3, "xxxhdpi": 4}
for name, factor in densities.items():
    folder = "mipmap-" + name
    save(plain(round(48 * factor)), "icon", "android-res", folder, "ic_launcher.png")
    save(round_cut(round(48 * factor)), "icon", "android-res", folder, "ic_launcher_round.png")
    save(padded(round(108 * factor), 66 / 108), "icon", "android-res", folder, "ic_launcher_foreground.png")

print("Icons written.")

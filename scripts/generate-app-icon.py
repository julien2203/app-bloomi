"""
Recadre les marges transparentes autour du logo puis remplit un carré 1024×1024 (fond blanc).
Usage: python scripts/generate-app-icon.py
Requires: pip install Pillow
"""

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
INPUT_PATH = ROOT / "assets/brand/icone-app.png"
OUTPUT_PATH = ROOT / "assets/icon-fullsize.png"
SIZE = 1024


def main() -> None:
    if not INPUT_PATH.exists():
        raise SystemExit(f"Missing source icon: {INPUT_PATH}")

    img = Image.open(INPUT_PATH).convert("RGBA")

    bbox = img.getbbox()
    if bbox is None:
        raise SystemExit("Image has no opaque pixels (fully transparent)")
    cropped = img.crop(bbox)

    cropped_resized = cropped.resize((SIZE, SIZE), Image.Resampling.LANCZOS)

    background = Image.new("RGBA", (SIZE, SIZE), (255, 255, 255, 255))
    alpha = cropped_resized.split()[3]
    background.paste(cropped_resized, mask=alpha)

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    background.convert("RGB").save(OUTPUT_PATH, format="PNG")

    print(f"Wrote {OUTPUT_PATH.relative_to(ROOT)} ({SIZE}x{SIZE})")


if __name__ == "__main__":
    main()

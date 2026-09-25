"""Картинка-чертёж (белые линии на синем, 3/4 спереди слева) → маска линий для VehicleSchematic.

Результат — WebP: белый цвет + альфа = яркость линии. В приложении маска красится токенами темы
(`mask-image`), поэтому одной картинки хватает на обе темы. Фон и сетка исходника отсекаются порогом.

    python tools/schematic-mask.py исходник.png src/ui/components/VehicleSchematic/art/<модель>.webp

Печатает соотношение сторон — его вписать в `models.ts`. Нужны numpy и Pillow.
"""
import sys

import numpy as np
from PIL import Image

LO, HI = 0.30, 0.85  # яркость фона/сетки исходника ниже LO, линии кузова — до HI
OUT_W = 1000  # ширина карточки ~340 css px × 3 dpr
PAD = 16


def main(src: str, dst: str) -> None:
    im = np.asarray(Image.open(src).convert('RGB')).astype(np.float32) / 255
    lum = 0.2126 * im[..., 0] + 0.7152 * im[..., 1] + 0.0722 * im[..., 2]
    t = np.clip((lum - LO) / (HI - LO), 0, 1) ** 0.85
    strong = t > 0.45
    rows = np.where(strong.sum(1) > 12)[0]
    cols = np.where(strong.sum(0) > 12)[0]
    y0, y1 = max(rows.min() - PAD, 0), min(rows.max() + PAD, t.shape[0])
    x0, x1 = max(cols.min() - PAD, 0), min(cols.max() + PAD, t.shape[1])
    alpha = Image.fromarray((t[y0:y1, x0:x1] * 255).astype(np.uint8), 'L')
    alpha = alpha.resize((OUT_W, round(OUT_W * (y1 - y0) / (x1 - x0))), Image.LANCZOS)
    white = Image.new('L', alpha.size, 255)
    Image.merge('RGBA', (white, white, white, alpha)).save(dst, quality=80, method=6)
    print(f'{dst}: {alpha.size[0]}x{alpha.size[1]}, aspect {alpha.size[0] / alpha.size[1]:.4f}')


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])

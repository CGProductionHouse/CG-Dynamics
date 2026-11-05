"""Source-specific local Kevin bust mask proof; no remote segmentation upload."""
from pathlib import Path
import cv2
import numpy as np
from PIL import Image

ROOT = Path(r"C:\Users\chris\Videos\CG-AI-Editing\Nolan-Studio-Private\TBS-Nov-2026-Goods-Transit\kevin-motion-r07")
src = ROOT / "kevin-neutral-0p08.png"
image = cv2.imread(str(src), cv2.IMREAD_COLOR)
assert image is not None and image.shape[:2] == (1920, 1080)

# The bottom is deliberately outside the delivered frame. It does not leave a
# cut arm or a floating rectangular edge inside the motion graphic.
outline = np.array([
    [252, 1300], [235, 1210], [252, 1120], [300, 1050], [392, 997],
    [458, 955], [445, 872], [438, 780], [448, 663], [477, 595],
    [536, 560], [625, 555], [699, 577], [734, 646], [743, 733],
    [757, 813], [734, 889], [706, 955], [789, 989], [864, 1045],
    [908, 1148], [930, 1300],
], dtype=np.int32)
mask = np.full(image.shape[:2], cv2.GC_BGD, np.uint8)
cv2.fillPoly(mask, [outline], cv2.GC_PR_FGD)
core = cv2.erode((mask == cv2.GC_PR_FGD).astype(np.uint8), np.ones((37, 37), np.uint8), iterations=1)
mask[core > 0] = cv2.GC_FGD
bg = np.zeros((1, 65), np.float64)
fg = np.zeros((1, 65), np.float64)
cv2.grabCut(image, mask, None, bg, fg, 5, cv2.GC_INIT_WITH_MASK)
alpha = np.where((mask == cv2.GC_FGD) | (mask == cv2.GC_PR_FGD), 255, 0).astype(np.uint8)
alpha = cv2.medianBlur(alpha, 5)
alpha = cv2.GaussianBlur(alpha, (0, 0), 1.4)
rgba = cv2.cvtColor(image, cv2.COLOR_BGR2RGBA)
rgba[:, :, 3] = alpha
cut = Image.fromarray(rgba[530:1300, 210:950])
cut.save(ROOT / "kevin-bust-cutout.png")
background = Image.new("RGBA", cut.size, (217, 223, 209, 255))
background.alpha_composite(cut)
background.convert("RGB").save(ROOT / "kevin-mask-check.jpg", quality=94)
print(ROOT / "kevin-bust-cutout.png")

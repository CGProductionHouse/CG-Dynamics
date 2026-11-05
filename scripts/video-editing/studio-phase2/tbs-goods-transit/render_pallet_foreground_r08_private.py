"""Let the real warehouse worker walk in front of TRANSIT typography.

Source-specific human matte. The U2Net model and all media remain private.
"""
from pathlib import Path
import subprocess
import cv2
import numpy as np
import onnxruntime as ort

ROOT = Path(r"C:\Users\chris\Videos\CG-AI-Editing\Nolan-Studio-Private\TBS-Nov-2026-Goods-Transit")
R06 = ROOT / "film-r06-private"
R08 = ROOT / "film-r08-private"
SRC = ROOT / "source" / "adobe-free-520299893.mov"
MODEL = ROOT / "kevin-motion-r08" / "u2net_human_seg.onnx"
W, H, FPS, N = 1920, 1080, 30, 90


def run(*args: object) -> None:
    subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
                    *map(str, args)], check=True)


def main() -> None:
    clean = R08 / "04-pallet-clean.mp4"
    base = "fps=30,scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,setsar=1,eq=contrast=1.045:saturation=0.92"
    run("-ss", 15.8, "-i", SRC, "-loop", 1, "-i", R06 / "side-shade.png",
        "-filter_complex", f"[0:v]{base}[v];[1:v]format=rgba,colorchannelmixer=aa=0.88[shade];[v][shade]overlay=0:0[out]",
        "-map", "[out]", "-frames:v", N, "-an", "-c:v", "libx264",
        "-preset", "fast", "-crf", 18, "-pix_fmt", "yuv420p", "-r", FPS, clean)

    annotated = cv2.VideoCapture(str(R06 / "04-pallet.mp4"))
    plain = cv2.VideoCapture(str(clean))
    assert annotated.isOpened() and plain.isOpened()
    session = ort.InferenceSession(str(MODEL), providers=["CPUExecutionProvider"])
    input_name = session.get_inputs()[0].name
    mean = np.array([.485, .456, .406], dtype=np.float32)
    std = np.array([.229, .224, .225], dtype=np.float32)
    folder = R08 / "04-pallet-foreground-frames"
    folder.mkdir(exist_ok=True)
    for n in range(N):
        ok_a, front = annotated.read()
        ok_p, back = plain.read()
        assert ok_a and ok_p, n
        if n >= 10:
            # Crop to the worker's travel lane to retain limb detail at the
            # model's 320px input. Ignore the right-hand package stack.
            crop = back[:, :1200]
            rgb = cv2.cvtColor(cv2.resize(crop, (320, 320)), cv2.COLOR_BGR2RGB)
            arr = (rgb.astype(np.float32) / 255 - mean) / std
            tensor = arr.transpose(2, 0, 1)[None]
            pred = session.run(None, {input_name: tensor})[0][0, 0]
            pred = (pred - pred.min()) / max(1e-6, pred.max() - pred.min())
            m = cv2.resize(pred, (1200, H), interpolation=cv2.INTER_LINEAR)
            mask = np.zeros((H, W), np.float32)
            mask[:, :1200] = m
            mask = np.clip((mask - .42) / .29, 0, 1)
            mask = cv2.GaussianBlur(mask, (0, 0), .9)
            # Only reveal the worker in the typography's lower field. This
            # avoids changing unrelated areas classified by the model.
            mask[:540] = 0
            front = np.uint8(np.clip(front.astype(np.float32) * (1 - mask[:, :, None]) +
                                     back.astype(np.float32) * mask[:, :, None], 0, 255))
        cv2.imwrite(str(folder / f"frame-{n:04d}.jpg"), front,
                    [cv2.IMWRITE_JPEG_QUALITY, 95])
    annotated.release()
    plain.release()
    target = R08 / "04-pallet.mp4"
    run("-framerate", FPS, "-i", folder / "frame-%04d.jpg", "-c:v", "libx264",
        "-crf", 18, "-preset", "fast", "-vf",
        "scale=in_range=pc:out_range=tv,format=yuv420p", "-color_range", "tv",
        "-r", FPS, target)
    print(target)


if __name__ == "__main__":
    main()

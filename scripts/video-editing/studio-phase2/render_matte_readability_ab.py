"""Compare the opening word's background fill at small-screen size."""

from hashlib import sha256
from pathlib import Path
import subprocess

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent
SOURCE = ROOT / "media/mixkit-28306-2160.mp4"
MASKS = ROOT / "output/reference-matte/mask"
OUT = ROOT / "output/matte-readability"
PROOF = ROOT / "proof-matte-readability-ab.mp4"
SOURCE_SHA = "80e0bf3d84faf6e2b0efabfc9001aeadde09e1ce56d0530360ceff5b9be596a5"
MASK_SHA = "b30df88c164301a105c4b250ad3f601435c0a804da159f0e2ee850e5b38551db"


def run(*args: str) -> None:
    subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", *args], check=True)


def main() -> None:
    if not SOURCE.exists() or sha256(SOURCE.read_bytes()).hexdigest() != SOURCE_SHA:
        raise SystemExit("Missing or changed Mixkit #28306 source")
    if len(list(MASKS.glob("*.png"))) != 108:
        raise SystemExit("Generate the original matte's 108 mask frames first: python render_reference_matte.py")
    mask_digest = sha256()
    for n in range(30):
        mask_digest.update((MASKS / f"{n:04d}.png").read_bytes())
    if mask_digest.hexdigest() != MASK_SHA:
        raise SystemExit("The first 30 original matte frames changed; inspect before comparing")
    OUT.mkdir(parents=True, exist_ok=True)
    for name, bg in (("original", "0x143448"), ("brighter", "0x427b98")):
        graph = (
            f"color=c={bg}:s=1080x1920:r=24:d=1.25[bg];"
            "[0:v]trim=start=3:duration=1.25,setpts=PTS-STARTPTS,crop=1215:2160:1312:0,"
            "scale=900:1600,chromakey=0x56ee00:0.13:0.09,"
            "despill=type=green:mix=0.7:expand=0.05,format=yuva420p[person];"
            "[bg][person]overlay=x=180:y=430:format=auto,format=rgb24[scene];"
            "[1:v]format=gray[matte];[scene]format=rgba[picture];"
            "[picture][matte]alphamerge[aperture];"
            "color=c=0x06090c:s=1080x1920:r=24:d=1.25[black];"
            "[black][aperture]overlay=0:0:format=auto,format=yuv420p[v]"
        )
        run("-i", str(SOURCE), "-framerate", "24", "-i", str(MASKS / "%04d.png"),
            "-filter_complex", graph, "-map", "[v]", "-frames:v", "30", "-an",
            "-c:v", "libx264", "-crf", "18", "-preset", "medium", "-pix_fmt", "yuv420p",
            str(OUT / f"{name}.mp4"))
    labels = Image.new("RGBA", (540, 480), (0, 0, 0, 0))
    draw = ImageDraw.Draw(labels)
    font = ImageFont.truetype(str(ROOT / "scene/assets/SpaceGrotesk.ttf"), 17)
    draw.text((8, 8), "ORIGINAL", font=font, fill="white")
    draw.text((278, 8), "BRIGHTER FILL", font=font, fill="white")
    label_path = OUT / "labels.png"
    labels.save(label_path)
    run("-i", str(OUT / "original.mp4"), "-i", str(OUT / "brighter.mp4"),
        "-loop", "1", "-i", str(label_path),
        "-filter_complex", "[0:v]scale=270:480[a];[1:v]scale=270:480[b];"
        "[a][b]hstack=inputs=2[p];[p][2:v]overlay=shortest=1[v]",
        "-map", "[v]", "-frames:v", "30", "-an", "-c:v", "libx264", "-crf", "18",
        "-preset", "medium", "-pix_fmt", "yuv420p", str(PROOF))
    print(PROOF)


if __name__ == "__main__":
    main()

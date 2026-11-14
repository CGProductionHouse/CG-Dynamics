"""Offline U2-Net alpha masks; original photo pixels remain independent.

Requires existing Pillow, NumPy and ONNX Runtime. No downloader, HTTP server,
cloud inference, generated replacement pixels or application dependency changes.
Model provenance: https://github.com/danielgatis/rembg/blob/main/rembg/sessions/u2net.py
Upstream licence: https://github.com/xuebinqin/U-2-Net/blob/master/LICENSE
Only the separately reviewed U2-Net ONNX checkpoint below is accepted.
"""
import argparse
import hashlib
import json
import time
from pathlib import Path

import numpy as np
from PIL import Image
from photo_colour import prepare_srgb

MODEL_SHA256 = "8d10d2f3bb75ae3b6d527c77944fc5e7dcd94b29809d47a739a7a728a912b491"


def digest(path):
    with path.open("rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()


def input_tensor(image):
    rgb = image.convert("RGB").resize((320, 320), Image.Resampling.LANCZOS)
    values = np.asarray(rgb, dtype=np.float32)
    values /= max(float(values.max()), 1.0)
    values = (values - np.array([.485, .456, .406], dtype=np.float32)) / np.array([.229, .224, .225], dtype=np.float32)
    return np.ascontiguousarray(values.transpose(2, 0, 1)[None], dtype=np.float32)


def alpha_mask(prediction, size):
    values = np.asarray(prediction, dtype=np.float32)
    if values.shape != (1, 1, 320, 320) or not np.isfinite(values).all():
        raise ValueError("Unexpected or non-finite U2-Net prediction")
    low, high = float(values.min()), float(values.max())
    if high - low < 1e-6:
        raise ValueError("Constant prediction; no usable subject separation")
    values = np.clip((values[0, 0] - low) / (high - low), 0, 1)
    return Image.fromarray(np.rint(values * 255).astype(np.uint8)).resize(size, Image.Resampling.LANCZOS)


def apply_alpha(image, mask):
    if mask.mode != "L" or mask.size != image.size:
        raise ValueError("A same-size grayscale mask is required")
    result = image.convert("RGBA")
    # Preserve pre-existing transparency; alpha is the only altered channel.
    previous = np.asarray(result.getchannel("A"), dtype=np.uint16)
    combined = (previous * np.asarray(mask, dtype=np.uint16) + 127) // 255
    result.putalpha(Image.fromarray(combined.astype(np.uint8)))
    result.info.clear()
    if image.info.get("icc_profile"):
        result.info["icc_profile"] = image.info["icc_profile"]
    return result


def destinations(source, model, output):
    paths = [output, output.with_name(output.stem + "-alpha.png"), output.with_suffix(".receipt.json")]
    if output.suffix.lower() != ".png":
        raise ValueError("Use a new PNG cutout destination")
    protected = {source.resolve(), model.resolve()}
    if len(set(p.resolve() for p in paths)) != 3 or any(p.resolve() in protected or p.exists() for p in paths):
        raise ValueError("Never overwrite an original, model or prior output/receipt")
    if not output.parent.is_dir():
        raise ValueError("Create the intended private output directory first")
    return paths


def run(source, model, output, adobe_rgb_profile=None):
    targets = destinations(source, model, output)
    started = time.perf_counter()
    if digest(model) != MODEL_SHA256:
        raise ValueError("Unreviewed model hash; no inference or automatic download performed")
    source_hash = digest(source)
    with Image.open(source) as opened:
        image, colour = prepare_srgb(opened, adobe_rgb_profile)
    import onnxruntime as ort
    options = ort.SessionOptions()
    options.intra_op_num_threads = 2
    options.inter_op_num_threads = 1
    session = ort.InferenceSession(str(model), sess_options=options, providers=["CPUExecutionProvider"])
    tensor = input_tensor(image)
    inference_start = time.perf_counter()
    prediction = session.run(None, {session.get_inputs()[0].name: tensor})[0]
    inference_seconds = time.perf_counter() - inference_start
    mask = alpha_mask(prediction, image.size)
    result = apply_alpha(image, mask)
    if result.convert("RGB").tobytes() != image.convert("RGB").tobytes():
        raise ValueError("Cutout RGB invariant failed")
    if digest(source) != source_hash:
        raise ValueError("Source changed during job; output held")
    for target, content in zip(targets[:2], [result, mask]):
        with target.open("xb") as stream:
            content.save(stream, format="PNG", **({"icc_profile": image.info["icc_profile"]} if target == output else {}))
    report = {
        "schemaVersion": 1, "sourceSha256": source_hash,
        "model": "U2-Net", "modelSha256": MODEL_SHA256,
        "onnxRuntimeVersion": ort.__version__, "provider": session.get_providers(),
        "threads": {"intra": 2, "inter": 1}, "colour": colour,
        "dimensions": list(image.size), "preparedRgbPixelsUnchanged": True,
        "originalFileUnchanged": True, "privateMetadataCopied": False,
        "generativeProcessing": False, "networkUsedByRunner": False,
        "inferenceSeconds": round(inference_seconds, 3),
        "totalSeconds": round(time.perf_counter() - started, 3),
        "outputs": [{"file": p.name, "sha256": digest(p), "bytes": p.stat().st_size} for p in targets[:2]],
        "qualityApproved": False,
        "limitations": ["Salient-object mask, not semantic/person identification or retouching.",
                        "Inspect actual alpha against light and dark grounds and at final placement/HD.",
                        "Hair, glass, chair and overlapping objects may need local mask correction.",
                        "Never use this mask as proof of eyes-open, source non-use or creative approval."],
    }
    with targets[2].open("x", encoding="utf-8") as stream:
        json.dump(report, stream, indent=2)
        stream.write("\n")
    return report


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--model", type=Path, required=True)
    parser.add_argument("--adobe-rgb-profile", type=Path)
    args = parser.parse_args()
    receipt = run(args.source, args.model, args.output, args.adobe_rgb_profile)
    print(json.dumps({k: receipt[k] for k in ["dimensions", "preparedRgbPixelsUnchanged", "inferenceSeconds", "totalSeconds", "qualityApproved"]}))

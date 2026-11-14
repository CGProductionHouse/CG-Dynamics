"""Resolve JPEG colour evidence before finishing; never silently relabel Adobe RGB.

Local Pillow/LittleCMS only. No network, generation or original-file writes.
DCF evidence: https://github.com/exiftool/exiftool/blob/master/lib/Image/ExifTool/Exif.pm
Conversion: https://pillow.readthedocs.io/en/stable/reference/ImageCms.html
"""
import argparse
import hashlib
import io
import json
from pathlib import Path

from PIL import Image, ImageCms, ImageOps, __version__ as pillow_version


def prepare_srgb(image, adobe_rgb_profile=None):
    """Return an oriented, metadata-clean RGB image plus the actual profile decision.

    Uncalibrated (65535) alone is not Adobe RGB evidence. R03 is also required.
    Unknown inputs fail rather than gaining a guessed sRGB label.
    """
    exif = image.getexif()
    photo_ifd = exif.get_ifd(34665)
    colour_space = photo_ifd.get(40961)
    interoperability = exif.get_ifd(40965).get(1) if 40965 in photo_ifd else None
    if isinstance(interoperability, bytes):
        interoperability = interoperability.decode("ascii", errors="strict").rstrip("\0")
    embedded = image.info.get("icc_profile")
    destination = ImageCms.ImageCmsProfile(ImageCms.createProfile("sRGB"))
    if embedded:
        source = ImageCms.ImageCmsProfile(io.BytesIO(embedded))
        decision = "embedded-icc"
        conversion = True
    elif colour_space == 1:
        if interoperability == "R03":
            raise ValueError("Conflicting sRGB and DCF R03 colour evidence; review source")
        source = destination
        decision = "exif-srgb"
        conversion = False
    elif colour_space == 65535 and interoperability == "R03":
        if not adobe_rgb_profile:
            raise ValueError("DCF R03 Adobe RGB requires the existing local Adobe RGB ICC profile")
        source = ImageCms.ImageCmsProfile(str(adobe_rgb_profile))
        if "Adobe RGB (1998)" not in ImageCms.getProfileName(source):
            raise ValueError("Provided profile is not Adobe RGB (1998)")
        decision = "dcf-r03-adobe-rgb"
        conversion = True
    else:
        raise ValueError("Unknown colour space: supply reviewed profile evidence, never silently assume sRGB")
    if source.profile.xcolor_space.strip() != "RGB":
        raise ValueError("Only reviewed RGB photographic sources are supported")
    if image.mode not in ("RGB", "RGBA"):
        raise ValueError("Only RGB/RGBA photographs are supported; do not guess a CMYK transform")
    oriented = ImageOps.exif_transpose(image)
    alpha = oriented.getchannel("A") if oriented.mode == "RGBA" else None
    rgb = oriented.convert("RGB")
    if conversion:
        rgb = ImageCms.profileToProfile(
            rgb, source, destination, outputMode="RGB",
            renderingIntent=ImageCms.Intent.RELATIVE_COLORIMETRIC,
            flags=ImageCms.Flags.BLACKPOINTCOMPENSATION,
        )
    if alpha is not None:
        rgb.putalpha(alpha)
    rgb.info.clear()
    rgb.info["icc_profile"] = destination.tobytes()
    return rgb, {
        "profileDecision": decision,
        "sourceProfile": ImageCms.getProfileName(source).strip(),
        "sourceProfileSha256": hashlib.sha256(source.tobytes()).hexdigest(),
        "destinationProfile": "sRGB", "conversionPerformed": conversion,
        "exifColourSpace": colour_space, "interoperabilityIndex": interoperability,
        "orientationApplied": True, "outputDimensions": list(rgb.size),
        "privateMetadataCopied": False, "generativeProcessing": False,
        "pillowVersion": pillow_version,
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path)
    parser.add_argument("output", type=Path, help="New private PNG derivative, never the original")
    parser.add_argument("--adobe-rgb-profile", type=Path)
    args = parser.parse_args()
    source, output = args.source.resolve(), args.output.resolve()
    receipt_path = output.with_suffix(output.suffix + ".receipt.json")
    if source == output or output.suffix.lower() != ".png" or output.exists() or receipt_path.exists():
        raise ValueError("Use a new versioned PNG/receipt path; originals and previous versions cannot be overwritten")
    original_hash = hashlib.sha256(source.read_bytes()).hexdigest()
    with Image.open(source) as image:
        prepared, receipt = prepare_srgb(image, args.adobe_rgb_profile)
    output.parent.mkdir(parents=True, exist_ok=True)
    with output.open("xb") as stream:
        prepared.save(stream, format="PNG", icc_profile=prepared.info["icc_profile"])
    if hashlib.sha256(source.read_bytes()).hexdigest() != original_hash:
        raise ValueError("Original changed during preparation; stop the job")
    receipt.update(sourceSha256=original_hash, outputSha256=hashlib.sha256(output.read_bytes()).hexdigest(), originalUnchanged=True)
    with receipt_path.open("x", encoding="utf-8") as stream:
        json.dump(receipt, stream, indent=2)
        stream.write("\n")
    print(json.dumps(receipt))


if __name__ == "__main__":
    main()

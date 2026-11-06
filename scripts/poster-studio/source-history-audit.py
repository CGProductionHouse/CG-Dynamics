"""Read-only, non-biometric source-photo matching against local poster previews.

Requires the existing OpenCV/Pillow runtime. No network, face recognition or writes
to inputs. A negative result is not an unused-photo certificate: heavy overlays,
small photos, alternate bursts and missing history need visual review.
"""
import argparse
import hashlib
import json
from pathlib import Path

import cv2
import numpy as np


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def features(path, detector, maximum=1600):
    pixels = cv2.imread(str(path), cv2.IMREAD_GRAYSCALE)
    if pixels is None:
        raise ValueError("Cannot decode " + path.name)
    height, width = pixels.shape
    ratio = min(1, maximum / max(width, height))
    pixels = cv2.resize(pixels, (round(width * ratio), round(height * ratio)))
    points, descriptors = detector.detectAndCompute(pixels, None)
    return points, descriptors, list(pixels.shape[::-1])


def compare(source, poster):
    sp, sd, source_dimensions = source
    pp, pd, dimensions = poster
    if sd is None or pd is None or min(len(sd), len(pd)) < 4:
        return {"ratioMatches": 0, "inliers": 0, "suspectedReuse": False}
    pairs = cv2.BFMatcher().knnMatch(sd, pd, k=2)
    good = [a for pair in pairs if len(pair) == 2 for a, b in [pair] if a.distance < .72 * b.distance]
    inliers = 0
    coverage = 0.0
    plausible = False
    if len(good) >= 4:
        left = np.float32([sp[m.queryIdx].pt for m in good]).reshape(-1, 1, 2)
        right = np.float32([pp[m.trainIdx].pt for m in good]).reshape(-1, 1, 2)
        matrix, mask = cv2.findHomography(left, right, cv2.RANSAC, 4)
        if matrix is not None and np.isfinite(matrix).all() and mask is not None and int(mask.sum()) >= 4:
            inliers = int(mask.sum())
            source_hull = cv2.convexHull(left[mask.ravel().astype(bool)])
            coverage = cv2.contourArea(source_hull) / (source_dimensions[0] * source_dimensions[1])
            sw, sh = source_dimensions
            corners = np.float32([[0, 0], [sw, 0], [sw, sh], [0, sh]]).reshape(-1, 1, 2)
            projected = cv2.perspectiveTransform(corners, matrix)
            projected_area = abs(cv2.contourArea(projected))
            plausible = bool(np.isfinite(projected).all() and cv2.isContourConvex(projected)
                             and dimensions[0] * dimensions[1] * .01 < projected_area < dimensions[0] * dimensions[1] * 12)
    return {
        "ratioMatches": len(good),
        "inliers": inliers,
        "sourceFeatureCoverage": coverage,
        "plausibleGeometry": plausible,
        "suspectedReuse": len(good) >= 14 and inliers >= 12 and inliers / len(good) >= .45 and coverage >= .025 and plausible,
        "previewDimensions": dimensions,
    }


def audit(sources, history):
    # OpenCV's machine-wide thread default retained ~9 GB during a real multi-source
    # pass on the shared MSI. Bound this process without changing match thresholds.
    if cv2.getNumThreads() <= 0 or cv2.getNumThreads() > 2:
        cv2.setNumThreads(2)
    detector = cv2.SIFT_create(nfeatures=2400)
    cached = [(path, features(path, detector), digest(path)) for path in sources]
    rows, errors = [], []
    previews = sorted(history.glob("*.png"))
    for path in previews:
        try:
            target = features(path, detector)
            rows.append({
                "preview": path.name,
                "sha256": digest(path),
                "sourceMatches": [
                    {"source": source.name, "sourceSha256": sha, **compare(descriptors, target)}
                    for source, descriptors, sha in cached
                ],
            })
        except (ValueError, cv2.error) as exc:
            errors.append({"preview": path.name, "error": str(exc)})
    return {
        "schemaVersion": 1,
        "method": "SIFT local photo features + ratio matching + RANSAC geometry",
        "opencvVersion": cv2.__version__,
        "opencvThreads": cv2.getNumThreads(),
        "faceRecognitionUsed": False,
        "previewCount": len(previews),
        "reviewedCount": len(rows),
        "errors": errors,
        "unusedCertified": False,
        "limitation": "No detected match does not rule out small, masked, altered or missing uses, another frame of the same shoot, or a repeated person/concept.",
        "pages": rows,
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, action="append", required=True)
    parser.add_argument("--history", type=Path, required=True)
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args()
    inputs = [*args.source, *args.history.glob("*.png")]
    if args.out.resolve() in [path.resolve() for path in inputs]:
        raise ValueError("Report must not overwrite a source or preview")
    result = audit(args.source, args.history)
    args.out.write_text(json.dumps(result, indent=2), encoding="utf-8")
    matches = [(page["preview"], match) for page in result["pages"] for match in page["sourceMatches"] if match["suspectedReuse"]]
    print(json.dumps({"previewCount": result["previewCount"], "errors": result["errors"], "suspectedMatches": matches, "unusedCertified": False}))


if __name__ == "__main__":
    main()

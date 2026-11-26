"""Read-only, non-biometric source-photo matching against local poster previews.

Requires the existing OpenCV/Pillow runtime. No network, face recognition or writes
to inputs. A negative result is not an unused-photo certificate: heavy overlays,
small photos, alternate bursts and missing history need visual review.
"""
import argparse
import hashlib
import json
from datetime import datetime, timedelta, timezone
from pathlib import Path

import cv2
import numpy as np


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def preview_files(history):
    return sorted(path for path in history.iterdir()
                  if path.is_file() and path.suffix.lower() in {'.png', '.jpg', '.jpeg', '.webp'})


def verify_reference_manifest(history, manifest_path, expected_design_id, expected_updated_at,
                              now=None):
    """Validate local evidence bindings; this does not authenticate Canva's server.

    The caller obtains the expected ID/revision from a fresh authorised read.
    Folder order, equal page counts and dates alone cannot establish identity.
    """
    if (not isinstance(expected_design_id, str) or not expected_design_id.strip()
            or not isinstance(expected_updated_at, int) or isinstance(expected_updated_at, bool)
            or expected_updated_at <= 0):
        raise ValueError("Fresh expected Canva design ID and integer saved revision required")
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    if not isinstance(manifest, dict):
        raise ValueError("Reference manifest must be an object")
    if (manifest.get("captureMode") != "read-only-transaction"
            or not isinstance(manifest.get("readOnlyTransactionId"), str)
            or not manifest["readOnlyTransactionId"].strip()):
        raise ValueError("Explicit read-only transaction capture provenance required")
    if (manifest.get("designId") != expected_design_id
            or manifest.get("designUpdatedAt") != expected_updated_at):
        raise ValueError("Reference design/revision differs from the fresh expected authority")
    try:
        observed = datetime.fromisoformat(manifest["observedAt"].replace("Z", "+00:00"))
    except (AttributeError, KeyError, TypeError, ValueError) as exc:
        raise ValueError("Timezone-aware observedAt required") from exc
    current = now or datetime.now(timezone.utc)
    if observed.tzinfo is None or not current - timedelta(hours=24) <= observed <= current:
        raise ValueError("Reference observation is stale, future-dated or missing its timezone")
    pages = manifest.get("pages")
    count = manifest.get("pageCount")
    if (not isinstance(pages, list) or not pages or not isinstance(count, int)
            or isinstance(count, bool) or count != len(pages)):
        raise ValueError("Explicit complete page count and page manifest required")
    root = history.resolve()
    by_file, ids, numbers = {}, set(), set()
    for page in pages:
        if not isinstance(page, dict):
            raise ValueError("Invalid page record")
        name, page_id, number = page.get("file"), page.get("pageId"), page.get("page")
        if (not isinstance(name, str) or not name or not isinstance(page_id, str)
                or not page_id.strip() or not isinstance(number, int) or isinstance(number, bool)
                or name in by_file or page_id in ids or number in numbers):
            raise ValueError("Unique filenames, stable page IDs and integer page numbers required")
        target = (root / name).resolve()
        if target.parent != root or target.name != name:
            raise ValueError("Reference file must be directly contained in its history folder")
        if not target.is_file() or digest(target) != page.get("sha256"):
            raise ValueError("Missing or changed reference preview: " + name)
        by_file[name] = page
        ids.add(page_id)
        numbers.add(number)
    if numbers != set(range(1, count + 1)):
        raise ValueError("Page sequence is incomplete")
    if set(by_file) != {path.name for path in preview_files(history)}:
        raise ValueError("History image inventory differs from the bound page manifest")
    return by_file, {
        "mode": "bound-master-snapshot", "bindingsValidatedLocally": True,
        "designId": expected_design_id, "designUpdatedAt": expected_updated_at,
        "captureMode": manifest["captureMode"],
        "observedAt": manifest["observedAt"], "manifestSha256": digest(manifest_path),
        "externallyAuthenticated": False,
        "limitation": "Caller-supplied authority must come from a fresh authorised Canva read; local validation does not authenticate that provenance or clear photo/project/person/concept reuse.",
    }


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


def audit(sources, history, manifest_path=None, expected_design_id=None, expected_updated_at=None):
    supplied = [manifest_path is not None, expected_design_id is not None, expected_updated_at is not None]
    if any(supplied) and not all(supplied):
        raise ValueError("Use manifest, expected design ID and expected saved revision together")
    pages, provenance = ({}, {
        "mode": "legacy-unbound", "bindingsValidatedLocally": False,
        "limitation": "Index-only cached previews are unbound exploratory evidence, not current master clearance.",
    })
    if manifest_path is not None:
        pages, provenance = verify_reference_manifest(
            history, manifest_path, expected_design_id, expected_updated_at)
    # OpenCV's machine-wide thread default retained ~9 GB during a real multi-source
    # pass on the shared MSI. Bound this process without changing match thresholds.
    if cv2.getNumThreads() <= 0 or cv2.getNumThreads() > 2:
        cv2.setNumThreads(2)
    detector = cv2.SIFT_create(nfeatures=2400)
    cached = [(path, features(path, detector), digest(path)) for path in sources]
    rows, errors = [], []
    previews = preview_files(history)
    for path in previews:
        try:
            target = features(path, detector)
            rows.append({
                "preview": path.name,
                "sha256": digest(path),
                **({"canvaDesignId": expected_design_id, "canvaPageId": pages[path.name]["pageId"],
                    "canvaPageNumber": pages[path.name]["page"]} if pages else {}),
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
        "referenceProvenance": provenance,
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
    parser.add_argument("--manifest", type=Path)
    parser.add_argument("--expected-design")
    parser.add_argument("--expected-updated-at", type=int)
    args = parser.parse_args()
    inputs = [*args.source, *preview_files(args.history), *([args.manifest] if args.manifest else [])]
    if args.out.resolve() in [path.resolve() for path in inputs]:
        raise ValueError("Report must not overwrite a source or preview")
    result = audit(args.source, args.history, args.manifest, args.expected_design, args.expected_updated_at)
    args.out.write_text(json.dumps(result, indent=2), encoding="utf-8")
    matches = [(page["preview"], match) for page in result["pages"] for match in page["sourceMatches"] if match["suspectedReuse"]]
    print(json.dumps({"previewCount": result["previewCount"], "errors": result["errors"],
                      "referenceMode": result["referenceProvenance"]["mode"],
                      "suspectedMatches": matches, "unusedCertified": False}))


if __name__ == "__main__":
    main()

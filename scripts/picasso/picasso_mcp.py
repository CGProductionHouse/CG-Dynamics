"""Private local MCP facade for PICASSO's reviewed JPEG workflow.

The server uses newline-delimited JSON-RPC over stdio.  It deliberately exposes
only six workflow tools, never arbitrary shell execution, deletion, publishing,
messaging, credentials, or unrestricted filesystem browsing.
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
from pathlib import Path
from typing import Any


VERSION = "0.1.0"
PROTOCOL_VERSION = "2025-06-18"
RUNTIME = Path(__file__).resolve().parent


def _default_roots() -> list[Path]:
    candidates = [Path.home() / "Pictures"]
    for name in ("OneDriveCommercial", "OneDrive", "LOCALAPPDATA"):
        value = os.environ.get(name)
        if value:
            root = Path(value)
            if name == "LOCALAPPDATA":
                root /= "CGProductionHouse" / "PICASSO"
            candidates.append(root)
    return candidates


def allowed_roots() -> list[Path]:
    configured = os.environ.get("PICASSO_ALLOWED_ROOTS", "")
    values = [Path(value.strip()) for value in configured.split(os.pathsep) if value.strip()]
    roots = values or _default_roots()
    return [root.expanduser().resolve(strict=False) for root in roots]


def private_path(value: str, *, must_exist: bool = False) -> Path:
    if not isinstance(value, str) or not value.strip():
        raise ValueError("A non-empty local path is required")
    path = Path(value).expanduser().resolve(strict=False)
    if not any(path == root or path.is_relative_to(root) for root in allowed_roots()):
        raise ValueError("Path is outside PICASSO_ALLOWED_ROOTS")
    if must_exist and not path.exists():
        raise ValueError("Local path does not exist")
    return path


def separate_job(source: Path, job: Path) -> None:
    if job == source or job.is_relative_to(source) or source.is_relative_to(job):
        raise ValueError("Job folder must be separate from the source tree")


def _execute(program: str, arguments: list[str], *, accept_review_failure: bool = False) -> dict[str, Any]:
    command = [sys.executable, str(RUNTIME / program), *arguments]
    result = subprocess.run(command, capture_output=True, text=True, encoding="utf-8", timeout=None)
    stdout = result.stdout.strip()
    payload: dict[str, Any] | None = None
    if stdout:
        try:
            payload = json.loads(stdout)
        except json.JSONDecodeError as error:
            raise RuntimeError("PICASSO returned an unreadable result") from error
    if result.returncode and not (accept_review_failure and payload is not None):
        message = result.stderr.strip().splitlines()[-1] if result.stderr.strip() else "PICASSO command failed"
        raise RuntimeError(message)
    return payload or {"ok": True}


def inspect_folder(args: dict[str, Any]) -> dict[str, Any]:
    source = private_path(args["folder"], must_exist=True)
    command = ["preflight", "--input", str(source)]
    if args.get("job"):
        command.extend(["--job", str(private_path(args["job"]))])
    if args.get("limit") is not None:
        command.extend(["--limit", str(int(args["limit"]))])
    return _execute("picasso.py", command, accept_review_failure=True)


def analyze_shoot(args: dict[str, Any]) -> dict[str, Any]:
    source = private_path(args["folder"], must_exist=True)
    job = private_path(args["job"])
    separate_job(source, job)
    mode = args.get("mode", "fast")
    if mode not in {"fast", "detailed"}:
        raise ValueError("mode must be fast or detailed")
    command = ["index", "--input", str(source), "--job", str(job), "--mode", mode]
    if not args.get("create_contact_sheets", True):
        command.append("--no-sheets")
    return _execute("shoot_index.py", command)


def review_previews(args: dict[str, Any]) -> dict[str, Any]:
    job = private_path(args["job"], must_exist=True)
    index = job / "index.sqlite3"
    if index.is_file():
        result = _execute("shoot_index.py", ["status", "--job", str(job)])
        preview = job / "contact-sheets"
    else:
        result = _execute("picasso.py", ["status", "--job", str(job)])
        preview = job / "previews"
    result["preview_folder"] = str(preview)
    result["human_review_required"] = True
    return result


def edit_jpegs(args: dict[str, Any]) -> dict[str, Any]:
    source = private_path(args["folder"], must_exist=True)
    job = private_path(args["job"])
    separate_job(source, job)
    look = args.get("look", "natural")
    if look not in {"natural", "cg-formal-warm"}:
        raise ValueError("Unsupported look")
    command = ["run", "--input", str(source), "--job", str(job), "--look", look]
    if args.get("limit") is not None:
        command.extend(["--limit", str(int(args["limit"]))])
    result = _execute("picasso.py", command)
    result["delivery_ready"] = False
    result["next_gate"] = "Review previews at 100%, classify, approve, then export"
    return result


def export_review(args: dict[str, Any]) -> dict[str, Any]:
    job = private_path(args["job"], must_exist=True)
    verified = _execute("picasso.py", ["verify", "--job", str(job), "--quality"])
    if verified.get("failures"):
        raise RuntimeError("Output verification failed; export blocked")
    approved_ids = args.get("approved_ids")
    reviewer = args.get("reviewer")
    if approved_ids is not None:
        if not reviewer:
            raise ValueError("reviewer is required with approved_ids")
        approval = ["approve-review", "--job", str(job), "--reviewer", str(reviewer),
                    "--ids", *[str(value) for value in approved_ids]]
        if args.get("latest_revisions", False):
            approval.append("--latest-revisions")
        _execute("picasso.py", approval)
    elif reviewer is not None:
        raise ValueError("approved_ids is required with reviewer")
    result = _execute("picasso.py", ["prepare-review", "--job", str(job)])
    result["published"] = False
    result["note"] = "Local review export only; PICASSO never publishes or messages from MCP"
    return result


def job_status(args: dict[str, Any]) -> dict[str, Any]:
    job = private_path(args["job"], must_exist=True)
    if (job / "index.sqlite3").is_file() and not (job / "manifest.json").is_file():
        return _execute("shoot_index.py", ["status", "--job", str(job)])
    return _execute("picasso.py", ["status", "--job", str(job)])


TOOLS: dict[str, tuple[dict[str, Any], Any]] = {
    "picasso_inspect_folder": ({
        "description": "Privately inspect a local JPEG folder for count, hydration, and disk readiness without editing or listing filenames.",
        "inputSchema": {"type": "object", "properties": {
            "folder": {"type": "string"}, "job": {"type": "string"},
            "limit": {"type": "integer", "minimum": 1}}, "required": ["folder"], "additionalProperties": False},
        "annotations": {"readOnlyHint": True, "destructiveHint": False, "openWorldHint": False},
    }, inspect_folder),
    "picasso_analyze_shoot": ({
        "description": "Create or resume a private, reversible shoot index with technical analysis, burst hints, and local contact sheets. Never edits originals.",
        "inputSchema": {"type": "object", "properties": {
            "folder": {"type": "string"}, "job": {"type": "string"},
            "mode": {"type": "string", "enum": ["fast", "detailed"], "default": "fast"},
            "create_contact_sheets": {"type": "boolean", "default": True}},
            "required": ["folder", "job"], "additionalProperties": False},
        "annotations": {"readOnlyHint": False, "destructiveHint": False, "openWorldHint": False},
    }, analyze_shoot),
    "picasso_review_previews": ({
        "description": "Return private preview/contact-sheet location and review status for a PICASSO job; never claims previews are client-ready.",
        "inputSchema": {"type": "object", "properties": {"job": {"type": "string"}},
                        "required": ["job"], "additionalProperties": False},
        "annotations": {"readOnlyHint": True, "destructiveHint": False, "openWorldHint": False},
    }, review_previews),
    "picasso_edit_jpegs": ({
        "description": "Create or resume conservative local sRGB JPEG first-pass edits in a separate job folder. Originals remain read-only; human quality review is mandatory.",
        "inputSchema": {"type": "object", "properties": {
            "folder": {"type": "string"}, "job": {"type": "string"},
            "look": {"type": "string", "enum": ["natural", "cg-formal-warm"], "default": "natural"},
            "limit": {"type": "integer", "minimum": 1}},
            "required": ["folder", "job"], "additionalProperties": False},
        "annotations": {"readOnlyHint": False, "destructiveHint": False, "openWorldHint": False},
    }, edit_jpegs),
    "picasso_export_review": ({
        "description": "After explicit human approval of exact IDs, record that approval, verify, and stage a private local review folder. Does not upload, publish, share, or send messages.",
        "inputSchema": {"type": "object", "properties": {
            "job": {"type": "string"}, "reviewer": {"type": "string", "minLength": 1},
            "approved_ids": {"type": "array", "items": {"type": "string"}, "minItems": 1, "uniqueItems": True},
            "latest_revisions": {"type": "boolean", "default": False}},
                        "required": ["job"], "additionalProperties": False},
        "annotations": {"readOnlyHint": False, "destructiveHint": False, "openWorldHint": False},
    }, export_review),
    "picasso_job_status": ({
        "description": "Read a PICASSO edit or culling job status without exposing private photo filenames.",
        "inputSchema": {"type": "object", "properties": {"job": {"type": "string"}},
                        "required": ["job"], "additionalProperties": False},
        "annotations": {"readOnlyHint": True, "destructiveHint": False, "openWorldHint": False},
    }, job_status),
}


def dispatch(request: dict[str, Any]) -> dict[str, Any] | None:
    method = request.get("method")
    request_id = request.get("id")
    if method and method.startswith("notifications/"):
        return None
    if method == "initialize":
        result = {"protocolVersion": PROTOCOL_VERSION, "capabilities": {"tools": {"listChanged": False}},
                  "serverInfo": {"name": "picasso-local", "version": VERSION},
                  "instructions": "Private local JPEG workflow. Never publish, share, delete originals, or bypass human quality approval."}
    elif method == "ping":
        result = {}
    elif method == "tools/list":
        result = {"tools": [{"name": name, **descriptor} for name, (descriptor, _) in TOOLS.items()]}
    elif method == "tools/call":
        params = request.get("params") or {}
        name = params.get("name")
        if name not in TOOLS:
            raise ValueError("Unknown PICASSO tool")
        value = TOOLS[name][1](params.get("arguments") or {})
        result = {"content": [{"type": "text", "text": json.dumps(value, ensure_ascii=False)}],
                  "structuredContent": value, "isError": False}
    else:
        return {"jsonrpc": "2.0", "id": request_id,
                "error": {"code": -32601, "message": "Method not found"}}
    return {"jsonrpc": "2.0", "id": request_id, "result": result}


def main() -> int:
    for line in sys.stdin:
        if not line.strip():
            continue
        request: dict[str, Any] = {}
        try:
            request = json.loads(line)
            response = dispatch(request)
        except Exception as error:
            response = {"jsonrpc": "2.0", "id": request.get("id"),
                        "error": {"code": -32000, "message": f"{type(error).__name__}: {error}"}}
        if response is not None:
            print(json.dumps(response, ensure_ascii=False), flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

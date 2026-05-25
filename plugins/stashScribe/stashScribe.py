#!/usr/bin/env python3
"""Stash Scribe — Python proxy invoked by Stash via `runPluginOperation`.

Why this exists: Stash's CSP allows fetch only to `'self'` plus the
three scraper-DB GraphQL hosts. Any direct browser fetch to Ollama
(even with CORS open) is blocked at the CSP layer. So the JS side
calls `runPluginOperation(plugin_id: "stashScribe", args: {...})` —
same-origin from the browser's perspective — Stash spawns this
script with a JSON payload on stdin, and we proxy to Ollama on the
PC's localhost (where there are no CSP / CORS concerns).

I/O contract:
  stdin:  one JSON object {"server_connection": {...}, "args": {...}}
  stdout: one JSON object — Stash returns it verbatim as the
          runPluginOperation result on the JS side.
  stderr: free-form, captured to Stash's plugin log.

`args` shape (set by JS):
  {"op": "chat", "ollamaUrl": "http://localhost:11434",
   "model": "...", "messages": [...], "temperature": 0.85}
  {"op": "list_models", "ollamaUrl": "http://localhost:11434"}
"""

import json
import sys
import urllib.error
import urllib.request


def _log(msg: str) -> None:
    sys.stderr.write(f"[stashScribe] {msg}\n")
    sys.stderr.flush()


def _http_post(url: str, payload: dict, timeout: int = 600) -> dict:
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read().decode("utf-8"))


def _http_get(url: str, timeout: int = 30) -> dict:
    with urllib.request.urlopen(url, timeout=timeout) as resp:
        return json.loads(resp.read().decode("utf-8"))


def do_chat(args: dict) -> dict:
    """Use Ollama's native /api/chat (not the OpenAI-compat
    /v1/chat/completions) because the native endpoint accepts the
    `options.num_ctx` knob — vital for keeping large quantised models
    fully GPU-resident on a 24 GB card. The OpenAI-compat layer ignores
    Ollama-specific options and loads the model with its baked-in
    32K context, which spills ~4 GB to CPU on a 24B-Q6 model and
    tanks throughput.

    12K covers performer reviews (notable scenes + 5 exchanges + a
    3-6 paragraph review with 1-2K output headroom) while keeping a
    24B-Q6 model fully on a 24 GB GPU. Drop back to 8192 if VRAM
    pressure shows up; raise to 16384+ only on Q4 weights or a 32 GB
    card. """
    base = (args.get("ollamaUrl") or "http://localhost:11434").rstrip("/")
    payload = {
        "model": args.get("model") or "",
        "messages": args.get("messages") or [],
        "stream": False,
        "options": {
            "num_ctx": int(args.get("num_ctx", 12288)),
            "temperature": float(args.get("temperature", 0.85)),
        },
    }
    try:
        body = _http_post(base + "/api/chat", payload)
    except urllib.error.HTTPError as e:
        return {"error": f"Ollama HTTP {e.code}: {e.read().decode('utf-8', errors='replace')[:300]}"}
    except urllib.error.URLError as e:
        return {"error": f"Ollama unreachable at {base}: {e.reason}"}
    except Exception as e:
        return {"error": f"chat call failed: {type(e).__name__}: {e}"}
    try:
        content = body["message"]["content"]
    except (KeyError, TypeError):
        return {"error": "Ollama returned no message content", "raw": body}
    return {"content": content}


def do_list_models(args: dict) -> dict:
    """Use native /api/tags — returns local Ollama tags directly
    rather than the OpenAI-compat shape (which sometimes omits
    HuggingFace-pulled models)."""
    base = (args.get("ollamaUrl") or "http://localhost:11434").rstrip("/")
    try:
        body = _http_get(base + "/api/tags")
    except urllib.error.HTTPError as e:
        return {"error": f"Ollama HTTP {e.code}"}
    except urllib.error.URLError as e:
        return {"error": f"Ollama unreachable at {base}: {e.reason}"}
    except Exception as e:
        return {"error": f"list_models failed: {type(e).__name__}: {e}"}
    return {"models": [m.get("name") or m.get("model") for m in (body.get("models") or [])]}


def main() -> None:
    # Force UTF-8 on stdin/stdout. On Windows, Python defaults to the
    # system codepage (CP1252) which mangles UTF-8 bytes coming from
    # Stash on the way in, and our ASCII JSON output is unaffected on
    # the way out — but the input path was the source of em-dashes
    # showing up as "Ã¢â‚¬â€" in saved reviews: prior assistant turns
    # (with em-dashes) round-tripped through Python with CP1252
    # interpretation, garbling them, and the LLM then echoed the
    # garbled forms in the next generation.
    try:
        sys.stdin.reconfigure(encoding="utf-8", errors="replace")
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass  # Python <3.7 fallback — accept whatever default we get.
    try:
        raw = sys.stdin.read()
    except Exception as e:
        print(json.dumps({"error": f"stdin read failed: {e}"}))
        return
    if not raw.strip():
        print(json.dumps({"error": "empty stdin"}))
        return
    try:
        envelope = json.loads(raw)
    except json.JSONDecodeError as e:
        print(json.dumps({"error": f"stdin not JSON: {e}"}))
        return
    args = envelope.get("args") if isinstance(envelope, dict) else None
    if args is None:
        # Stash sometimes passes args at the top level instead of nested.
        args = envelope if isinstance(envelope, dict) else {}
    op = (args.get("op") or "chat").lower()
    _log(f"op={op}")
    if op == "chat":
        result = do_chat(args)
    elif op == "list_models":
        result = do_list_models(args)
    else:
        result = {"error": f"unknown op: {op}"}
    # Stash's raw-plugin protocol: stdout JSON should be wrapped as
    # {"output": <value>} (or {"error": "..."}) for runPluginOperation
    # to return the value. Without this wrapper, the GraphQL response
    # comes back as null.
    if "error" in result and len(result) == 1:
        print(json.dumps({"error": result["error"]}))
    else:
        print(json.dumps({"output": result}))
    sys.stdout.flush()


if __name__ == "__main__":
    main()

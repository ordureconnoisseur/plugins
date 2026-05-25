# Stash Scribe

LLM-driven scene + performer review assistant for [Stash](https://github.com/stashapp/stash). Click a button on the scene or performer page; a local Ollama-served model interviews you with short questions, writes the review for you, and (when [stash-advanced-rating](https://github.com/ordureconnoisseur/stash-advanced-rating) is installed) suggests per-criterion scores.

The review writes back to the subject's **Details** field. Scores write via the exact tag-name format the Advanced Rating plugin uses, so its recalc hook picks them up automatically. The two plugins are independent — Advanced Rating works fine without Scribe, Scribe works fine without Advanced Rating (just hides the score sliders).

## Workflow

1. Open any `/scenes/<id>` page.
2. Click the **✎ Write Review** button in the scene toolbar (next to the Advanced Rating plugin's `★+` and the favourite heart).
3. The Scribe modal opens. If there's no review yet, you choose:
   - **Start LLM interview** — the model asks one short question at a time (performer energy, standout moments, chemistry); you answer in 1-2 sentence bursts.
   - **Write manually** — skip the interview, type the review yourself, set scores. Same save target, no LLM call. Useful when Ollama is offline or you just want to type your own.
4. (LLM path) After 3-5 exchanges, the **Generate Review** button enables. Click it.
5. The LLM produces:
   - A 2-4 paragraph review (editable)
   - Suggested 0-5 scores per Advanced Rating criterion (slider per criterion, editable, dismissable per-row with ×)
6. Click **Save review + scores** to write everything back. The Advanced Rating plugin's hook recalculates the overall `rating100` automatically.

Performers work the same way: open `/performers/<id>` → same button + workflow, with a longer-form review grounded in their library aggregates.

## Install

1. **Settings → Plugins → Available Plugins → Add Source**
2. Paste this URL:
   ```
   https://ordureconnoisseur.github.io/plugins/main/index.yml
   ```
3. Find **Stash Scribe** and click Install.
4. Reload Stash.

## Requirements

- **[Ollama](https://ollama.com/)** running on the same machine as Stash (or any host the Stash browser can reach over HTTP).
- A capable text-generation model pulled into Ollama. The default model name is `weirdcompound:latest` — change it in **Settings → Plugins → Stash Scribe → Model** to whatever you have pulled (e.g. `llama3.1:8b`, `mistral:7b`, etc.).
- **CORS** — Ollama refuses cross-origin requests by default. Set `OLLAMA_ORIGINS=*` (or specifically your Stash URL) in the environment where Ollama runs, then restart Ollama. Otherwise the browser will reject the request and the modal will show a connection error.

  On Windows:
  ```powershell
  setx OLLAMA_ORIGINS "*"
  # Restart the Ollama service / app afterwards.
  ```

  On macOS / Linux:
  ```bash
  export OLLAMA_ORIGINS="*"
  ollama serve
  ```

- **Optional but recommended**: install [stash-advanced-rating](https://github.com/ordureconnoisseur/stash-advanced-rating) and configure your scene + performer criteria. Stash Scribe will read them automatically and suggest scores per criterion.

## Settings

**Settings → Plugins → Stash Scribe**:

| Field | What it does |
| --- | --- |
| **Ollama URL** | Base URL for Ollama's OpenAI-compatible endpoint (default `http://localhost:11434`). |
| **Model** | Model tag to call (default `weirdcompound:latest`). |
| **Interview system prompt** | Instructions the LLM gets for the question/answer phase. Tweak to match your voice / level of explicitness. |
| **Review generation system prompt** | Instructions the LLM gets when you click Generate. Controls the output format — keep the `REVIEW: ... SCORES: ...` structure or the parser will fail. |
| **Default length** | Short / Medium / Long — passed to the LLM as a hint. |
| **Default tone** | Direct / Sensual / Vulgar / Elegant. |
| **Auto-create missing criterion tags** | When writing scores, if a `<Name> ★: <score>` tag doesn't exist yet, Scribe creates it. Disable if you want to keep tag-creation manual. |

The **Test connection** button hits Ollama's `/v1/models` to verify the URL works + CORS is allowed.

## Compatibility

- **Stash**: tested on 0.27.x.
- **Browsers**: Chrome ≥ 105, Edge ≥ 105, Safari ≥ 15.4, Firefox ≥ 121.
- **Ollama**: any version that exposes the OpenAI-compatible `/v1/chat/completions` endpoint (Ollama ≥ 0.1.30).

## Known limitations

- **Streaming responses not supported in v1** — the modal waits for the full LLM reply before rendering each turn. On slow hardware that's a few-second wait. Streaming is on the roadmap.
- **Score parsing is regex-based** — if the LLM goes off-script and doesn't emit the `SCORES: - Name: N` format, scores won't be populated. The review text still saves. Tightening the Review system prompt or switching to a stricter model fixes this.

## License

[AGPL-3.0](./LICENSE)

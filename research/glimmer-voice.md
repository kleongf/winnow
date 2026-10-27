# Muse Glimmer and Muse Voice Transcribe: availability this week

*Research for issue #4. Checked 2026-10-26/27. Every claim links to the page it came from. Where sources disagree, both are given.*

## Summary

- **Muse Glimmer can be used this week, but only through a hosted API, not on this Mac.** It is one open-weights model (30B, dense, Apache 2.0) that takes text and images, not video. The Meta Model API does not serve it. You can call it through OpenRouter (DeepInfra bf16 or Together) for about $0.30–0.35 per 1M input tokens. The development machine (Apple M2, 16 GB) can't hold even the 4-bit build: Meta's own memory budget for that build is 19.0 GiB.
- **Muse Voice Transcribe can be used this week through the Meta Model API.** It costs $0.18 per audio hour and offers REST batch upload plus WebSocket streaming. **It does not return word-level timestamps.** It returns turn-level `startMs`/`endMs`, plus `audioProcessedMs` on streaming events. That is enough for moment-level labels if each spoken remark is treated as one turn (see "Implications").

---

## Muse Glimmer

### What it is

| Fact | Value | Source |
|---|---|---|
| Distribution | Open weights; "runs on a single GPU" or Mac | [Model page][g-model] |
| Licence | Apache 2.0, not gated | [Model page][g-model], [HF model card][g-hf] |
| Sizes | One size: 30B ("~29.6B parameters (including vision encoder)"), dense, not MoE | [HF model card][g-hf], [Docs][g-docs] |
| Lineage | "distilled from Muse Spark" | [OpenRouter model API][or-api] |
| Inputs / outputs | Text and image in, text out. Max 4,096 visual tokens per image | [HF model card][g-hf], [Docs][g-docs] |
| Video | Model card: "not explicitly optimized for video; video input is processed as individual frames." Deploy guide: "No video input: text and images only." | [HF model card][g-hf], [Run inference][g-deploy] |
| Context | 128K tokens by default ("131,072+") | [Docs][g-docs], [HF model card][g-hf] |
| Release | August 2026. Knowledge cutoff 2026-01-04 | [HF model card][g-hf] |
| Intended uses listed | Includes "LLM-as-a-judge evaluation" and multimodal reasoning | [HF model card][g-hf] |
| Robotics or video benchmarks | None in the model card | [HF model card][g-hf] |

Hugging Face repos: `meta-models/Muse-Glimmer-30B` (bf16, about 60 GB), `-GGUF` (quantized builds plus vision projector), `-assistant` (DFlash draft model), `-ExecuTorch-PTE` ([Get the model][g-get]).

### Hosted access (works this week)

- **Not on the Meta Model API.** The pricing and rate-limit page lists Muse Wonder, Muse Spark, Muse Image, Muse Voice Transcribe and SAM 3.1. Glimmer is not listed ([Pricing & rate limits][m-pricing]). So it **won't use the $150 Meta credits**; it needs a separate account and payment.
- **OpenRouter** `meta/muse-glimmer-30b`, `input_modalities: ["text","image"]`, context 131,072 ([OpenRouter endpoints API][or-api], queried 2026-10-27):
  - DeepInfra, `bf16`: $0.30 / 1M prompt, $1.20 / 1M completion, max completion 16,384.
  - Together: $0.35 / 1M prompt, $1.50 / 1M completion. Its 1-day uptime read 32.7% when queried.
- Meta's deploy guide also lists Together AI serving `meta-models/Muse-Glimmer-30B` at "$0.35 / 1M tokens" input, "$1.50 / 1M tokens" output ([Run inference][g-deploy]).
- Not verified: how many images one hosted request accepts. The only documented limit is "one image per request" for the ExecuTorch runtime ([Run inference][g-deploy]).

### Running locally on this machine

This machine: `Apple M2`, `hw.memsize` = 17179869184 bytes (16 GiB). Checked with `sysctl`.

| Build | Size / memory | Source |
|---|---|---|
| bf16 (vision-capable) | about 60 GB of weights; "Budget 72 GB of VRAM" for vLLM | [Run inference][g-deploy] |
| K-Quant-17GB (Q4) | 16.8 GB download; **19.0 GiB total** (15.6 text + 1.3 vision projector + 2.1 KV/compute) | [Quantization][g-quant] |
| K-Quant-Dynamic | 19.7 GB download | [Quantization][g-quant] |
| Ollama `muse-glimmer:30b` / `:30b-mlx` | 18 GB / 19 GB | [Ollama library][ollama] |
| Unsloth 4-bit | 17 GB; Unsloth recommends "Mac 32GB" | [Unsloth docs][unsloth] |
| Unsloth 2-bit | 12–14 GB minimum RAM | [Unsloth docs][unsloth] |
| SGLang MLX Q4 | "Apple silicon, 48 GB or more of unified memory" | [Run inference][g-deploy] |

**Verdict: no.** Every vision-capable build, including the 4-bit ones, needs more than 16 GiB on its own. The 2-bit build might load, but it would leave almost no memory for macOS and Winnow. Nobody has documented a test of it with image input on a 16 GB Mac. One third-party tester calls "32 GB … our practical minimum" ([holaclaw][holaclaw]). A Medium post titled "Muse Glimmer on a 16 GB Mac mini" exists but returned 403, so it was **not verified**.

Speed where the model does fit (model card, 4-bit, baseline decoding): Apple M4 Max 23.7 tok/s, M5 Max 26.6 tok/s, RTX 5090 74.9 tok/s ([HF model card][g-hf]). No first-party figure exists for a base M2.

**Docs disagree on whether quantized builds take images.** Meta's deploy guide says "GGUF Q4_K_M · Text only", "MLX Q4 variants · Text only" and "bf16 checkpoint is the only one that takes images" ([Run inference][g-deploy]). But Meta's quantization page ships a 1.4 GB vision projector with the K-Quant builds ([Quantization][g-quant]). Ollama marks `30b-mlx` as "Text, Image" with "image input" ([Ollama library][ollama]). Unsloth documents `mmproj-BF16.gguf` for vision ([Unsloth docs][unsloth]). Anyone running locally on a bigger machine should test this before relying on it.

---

## Muse Voice Transcribe

| Fact | Value | Source |
|---|---|---|
| Model id | `muse-voice-transcribe-1.0` | [Model page][v-model] |
| Price | $0.18 per audio hour ($3.00 per 1,000 min). Streaming and batch cost the same | [Pricing & rate limits][m-pricing], [Model page][v-model] |
| Limits | No RPM/TPM limit. "256 concurrent streams; 16,000 streams per hour". Realtime sessions max 60 min | [Pricing & rate limits][m-pricing], [Speech to text][v-stt] |
| Languages | 25, with code-switching (English included) | [Speech to text][v-stt] |
| Extras | Keyword biasing (`keywords`), `languageBias`, diarization for "20+ speakers" | [Speech to text][v-stt], [Model page][v-model] |

### API shape

- **Batch:** `POST https://api.meta.ai/v1/asr/transcribe`, multipart with a `request` JSON part (`model`, `audioEncoding: "WAV"`, `mode`) and an `audio` part. Accepts WAV only: mono 16-bit PCM at 16 or 24 kHz, max 10 minutes and 32 MB. The `Accept` header picks the response format: `application/json`, `text/event-stream` or `text/plain` ([Transcribe endpoint][v-transcribe], [Speech to text][v-stt]).
- **Streaming:** `wss://api.meta.ai/v1/asr/realtime`. The handshake JSON carries `authorization.accessToken` ("The credential travels here, not in the Authorization header"), plus `audioEncoding` (`PCM_24KHZ`/`PCM_16KHZ`), `model`, `mode`, `partialMode` (`CUMULATIVE`/`DELTA`) and `emitAudioProgress`. Audio is raw signed 16-bit little-endian mono PCM ([Realtime endpoint][v-realtime], [Speech to text][v-stt]).
- **Modes:** `PUSH_TO_TALK` (default; the client marks where a turn starts and ends). `ENDPOINTING` emits `speechStart` → partial `transcript`s → `speechEnd` → `speechComplete`, keyed by `turnId`. `DIARIZATION` adds `speaker` events and is "not tuned for low-latency, voice-command use" ([Speech to text][v-stt]).
- The docs give no browser-client guidance and no ephemeral tokens. The Model API key goes in the handshake ([Speech to text][v-stt]). So browser audio would have to go through Winnow's backend (inference, not stated in the docs).

### Timestamps (the deciding question)

- "Muse Voice Transcribe returns turn-level timestamps, not word-level timestamps." Also: "Word-level timestamps, confidence scores, sound event detection, emotion detection, and transcript reformatting are not available." ([Speech to text][v-stt])
- Batch `turns[]` carry `startMs`/`endMs`: "Audio processed when the model detected the turn's speech onset/end, in milliseconds from the start of the clip." ([Voice schemas][v-schemas])
- Streaming `speechStart`/`speechEnd`/`speechComplete`/`transcript` events carry `audioProcessedMs`: "Audio processed when the model emitted this event". This is "processing progress, not a word timestamp." ([Voice schemas][v-schemas], [Speech to text][v-stt])
- No confidence scores ([Speech to text][v-stt]).

---

## Implications for Winnow

These are inferences from the facts above, not claims made by the sources.

1. **Glimmer as second-opinion judge:** feasible over OpenRouter on 1-fps Episode frames sent as images. Compare the cost to Spark contributor tier ($0.10 / 1M input, [Pricing][m-pricing]): Glimmer is about 3x more per input token and needs a separate bill. "Data never leaves the machine" isn't true for the demo, because it would be hosted. Keep the "local option" as a roadmap line ("runs on a 32 GB+ Mac or a 24 GB GPU"), and don't present it as built.
2. **Open-weights bonus prize:** the open-weights claim still holds if the hosted endpoint serves the exact Apache-2.0 checkpoint. DeepInfra lists `bf16`. Whether judges count a hosted call as a "build on open weights" model can't be confirmed from sources; ask on Discord.
3. **Voice labeling:** with no word timestamps, record the video playhead on the client the moment the user speaks. Use `ENDPOINTING` mode, take `speechStart.audioProcessedMs` (or batch `turns[].startMs`), and add it to the playhead time at stream start. Each spoken remark ("slips here") becomes one moment-level label, accurate to roughly the onset of the remark. No confidence scores means the transcript's reliability can't feed the Needs review signal.
4. **Cost is negligible:** at $0.18/hour, narrating 100 Episodes of about 1 minute each costs about $0.30.

## Contradictions with AGENTS.md

- §6 says Glimmer gives a "local option so data never leaves the machine". That's true for 24 GB+ GPUs or 32 GB+ Macs, but **not on the development M2 / 16 GB**. The demo would call a hosted endpoint, and not through the Meta Model API or its credits.
- §6 says Glimmer works on "borderline episodes" as a video judge. Glimmer doesn't take video, only frames sent as images.
- §6 and §9 say "moment-level labels from speech". Not natively: Voice Transcribe has turn-level timestamps only. Moments have to come from turn onsets aligned to the client's playhead.

[g-model]: https://dev.meta.ai/models/muse-glimmer/
[g-docs]: https://dev.meta.ai/docs/muse-glimmer/
[g-get]: https://dev.meta.ai/docs/muse-glimmer/get-the-model
[g-deploy]: https://dev.meta.ai/docs/muse-glimmer/deploy
[g-quant]: https://dev.meta.ai/docs/muse-glimmer/quantization
[g-hf]: https://huggingface.co/meta-models/Muse-Glimmer-30B
[or-api]: https://openrouter.ai/api/v1/models/meta/muse-glimmer-30b/endpoints
[ollama]: https://ollama.com/library/muse-glimmer
[unsloth]: https://unsloth.ai/docs/models/muse-glimmer
[holaclaw]: https://holaclaw.ai/blog/muse-glimmer-on-mac
[m-pricing]: https://dev.meta.ai/docs/pricing-rate-limits
[v-model]: https://dev.meta.ai/models/muse-voice-transcribe/
[v-stt]: https://dev.meta.ai/docs/speech-to-text/
[v-transcribe]: https://dev.meta.ai/docs/api-reference/voice/transcribe
[v-realtime]: https://dev.meta.ai/docs/api-reference/voice/realtime
[v-schemas]: https://dev.meta.ai/docs/api-reference/voice/schemas

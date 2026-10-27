# SAM 3.1 and Muse Spark 1.3 on the Meta Model API

Research for issue #2. Checked 2026-10-26/27 against dev.meta.ai docs (primary). The paid API was not called; nothing here is measured by us. Where a fact could not be found in a primary source, it says **Unverified**.

## Answer in brief

- Both models are reached through one OpenAI-compatible endpoint, `POST https://api.meta.ai/v1/responses`, with a Bearer key. The OpenAI SDK works if you change `base_url`. SAM 3.1 returns boxes, masks, stable per-object track ids, and (if you ask) a confidence value per frame for each object, all as streamed special-token text.
- **SAM 3.1 video:** MP4/MOV containers with H.264, H.265 or MPEG-4 video only, up to 15,000 frames per request, up to 16 tracked objects, **one concept (noun phrase) per request**, and **one media part per request** (one camera per call). It costs $0.20 per 1,000 frames, with a minimum of 50 frames billed per request.
- **Spark 1.3 video:** MP4 only, 50 MB inline or 1 GiB via the Files API, 1,048,576-token context. **The docs give no fps sampling rate, maximum duration, or tokens-per-second for video.** Count tokens with `POST /v1/responses/input_tokens`.
- **Code execution:** the API has **no hosted code-execution tool**. The only server-side tools are `web_search` and `tool_search`. To let Spark compute anything, you run the code yourself through function tools.
- **Pricing:** `muse-spark-1.3-contributor` costs $0.10 in / $0.20 out per 1M tokens, against $1.25 / $4.25 for standard. Contributor mode is limited to **150 RPM** (standard gets 3,000) and does **not** support `"max"` reasoning.
- **Latency:** Meta publishes no figures for the API. The only numbers are third-party (Spark) or self-hosted GPU benchmarks (SAM).
- **Dataset gotcha:** `lerobot/droid_100` videos are **AV1**, which SAM 3.1 does not list as an accepted codec. They have to be transcoded to H.264 first.

## 1. Interface (both models)

| Item | Fact | Source |
|---|---|---|
| Base URL | `https://api.meta.ai/v1` | [SAM overview](https://dev.meta.ai/docs/sam/overview) |
| Auth | `Authorization: Bearer $MODEL_API_KEY`. Keys look like `LLM_<numeric id>_<secret>` and are created in the Model API dashboard's "API keys" tab | [Authentication](https://dev.meta.ai/docs/authentication) |
| Endpoints | Responses (`/v1/responses`), Chat Completions (`/v1/chat/completions`), Messages (`/v1/messages`, Anthropic-shaped). SAM is on Responses only | [Models](https://dev.meta.ai/docs/models) |
| SDKs | No Meta SDK. Use the OpenAI SDK (Responses + Chat), the Anthropic SDK (Messages; `base_url=https://api.meta.ai`, key passed as `auth_token`), or any OpenAI-compatible client (LangChain, LiteLLM with an `openai/` prefix). None of them reads `MODEL_API_KEY` automatically | [SDKs and libraries](https://dev.meta.ai/docs/sdks) |
| SAM parsers | `meta-sam-parser` (pip, Python ≥ 3.10, no deps) and `@meta-sam/parser` (npm). Optional `@meta-sam/graphics`, `@meta-sam/video`, `@meta-sam/react` for overlays | [SAM client libraries](https://dev.meta.ai/docs/sam/client-libraries) |
| Files | `POST /v1/files` with `purpose=user_data`. Upload is synchronous (a 200 means ready). Limits: 1 GiB per file, 100 GiB per team in total. Files don't expire unless you set `expires_after`. Inline media limit is 50 MB | [File handling](https://dev.meta.ai/docs/file-handling) |
| Model list | `GET /v1/models` shows which models your team has enabled | [Models](https://dev.meta.ai/docs/models) |
| Status | `GET /status`, no auth needed | [Status API](https://dev.meta.ai/docs/api-reference/status) |
| Timeouts | Non-streaming requests return 504 if the whole response is too slow. Streaming requests return 504 if the first event is too slow. Fix by using `stream: true` or `background: true`. Background request bodies are capped at 1 MiB, and background submissions at 600/min per team | [Error handling](https://dev.meta.ai/docs/error-handling), [Pricing and rate limits](https://dev.meta.ai/docs/pricing-rate-limits) |
| Official examples | Cookbook repo `github.com/meta-models/meta-model-cookbook` (SAM recipes are in `07_sam/`) | [SAM API basics recipe](https://dev.meta.ai/docs/cookbook/sam-api-basics) |

### Minimal SAM 3.1 video request (from the docs)

```python
from openai import OpenAI
import os
client = OpenAI(base_url="https://api.meta.ai/v1", api_key=os.environ["MODEL_API_KEY"])

f = client.files.create(purpose="user_data", file=open("episode_042_ext1.mp4", "rb"))
with client.responses.stream(
    model="sam-3.1",
    input=[{"type": "message", "role": "user", "content": [
        {"type": "input_text", "text": "robot gripper"},        # ONE noun phrase
        {"type": "input_video", "file_id": f.id},               # ONE media part
    ]}],
    extra_body={"metadata": {"include_confidence": "true", "mask_encoding": "one_bit"}},
) as stream:
    for event in stream:
        if event.type == "response.output_text.delta":
            print(event.delta)   # one line per frame
```

Request shape, `metadata` keys, and streaming loop are from [Segmenting with prompts](https://dev.meta.ai/docs/sam/segmenting). The docs show `metadata` in raw JSON bodies. Passing it through `extra_body` in the OpenAI SDK is our assumption and is **unverified**. The SDK's own `metadata=` argument may also work.

### Minimal Spark 1.3 video request (from the docs)

```python
resp = client.responses.create(
    model="muse-spark-1.3-contributor",
    input=[{"type": "message", "role": "user", "content": [
        {"type": "input_text", "text": "Did the robot place the cup in the bowl? When did it fail?"},
        {"type": "input_file", "file_id": f.id},   # or {"type":"input_video","video_url": ...}
    ]}],
)
print(resp.output_text)
```

Source: [Video understanding](https://dev.meta.ai/docs/video-understanding). The docs examples use `muse-spark-1.3`. Contributor mode is the same request with a different model ID ([Models](https://dev.meta.ai/docs/models)).

## 2. SAM 3.1

### Inputs and limits

| Item | Fact | Source |
|---|---|---|
| Model ID | `sam-3.1`. One model handles both images and video | [Models](https://dev.meta.ai/docs/models) |
| Video containers/codecs | MP4 or MOV, with H.264, H.265, or MPEG-4 video. **VP9 and WebM are rejected.** AV1 is not on the accepted list | [Segmenting, Limits](https://dev.meta.ai/docs/sam/segmenting) |
| Video by | `input_video` with `video_url` (a public URL or base64 data URL) or `file_id` | [Segmenting](https://dev.meta.ai/docs/sam/segmenting) |
| Clip length | Up to 15,000 frames ("about 10 minutes") per request | [Segmenting, Limits](https://dev.meta.ai/docs/sam/segmenting) |
| Frame sampling | The docs mention no server-side fps or stride parameter. Every frame appears to be processed and billed per frame. Meta's own recipe downsamples on the client ("`--analysis-fps` only when deliberately sampling frames") and caps resolution with FFmpeg before upload | [Pricing](https://dev.meta.ai/docs/pricing-rate-limits), [Video-to-sticker recipe](https://dev.meta.ai/docs/cookbook/video-to-sticker-pack) |
| Media per request | "A request pairs the prompt with **one media part**." Multiple cameras therefore need one request per camera | [Segmenting, Build the request](https://dev.meta.ai/docs/sam/segmenting) |
| Prompt | Either one short noun phrase **or** box/point prompts, never both. **One concept per request.** "bus, bicycle" returns nothing, and "A and B" returns only one of them. Commands, questions, negation, and spatial phrases ("on the left") are unreliable | [Segmenting](https://dev.meta.ai/docs/sam/segmenting) |
| Objects | Video tracks up to 16 objects per frame. Box/point prompts can name up to 16 objects | [Segmenting, Limits](https://dev.meta.ai/docs/sam/segmenting) |
| Box/point prompts | `<Nf>id<|box;x1;y1;x2;y2;w;h|>` or `<|point;...|>` (prefix `-` for a negative point), on any frame, with ids you choose. Tracking direction is set by `metadata.propagation_direction` = `both` (default) / `forward` / `backward`. Tracking fewer frames costs less | [Segmenting](https://dev.meta.ai/docs/sam/segmenting) |
| Determinism | "Results can vary slightly between runs": box coordinates, mask edges, and sometimes which objects are found | [Segmenting, Stream the response](https://dev.meta.ai/docs/sam/segmenting) |

Search results from third parties mention parameters such as `applyMask`, `videoMaxNumObjects`, `videoDetectionThreshold`, and a 120-character prompt cap. **None of these appear in Meta's API docs**, and the Meta API has no documented detection-threshold knob.

### Output shape

Output streams in the `output_text` lane as one `response.output_text.delta` per frame, ending with `response.completed` ([Reading segmentation output](https://dev.meta.ai/docs/sam/reading-segmentation)):

```
<Nf>id<|box;x1=..;y1=..;x2=..;y2=..;w=W;h=H[;c=conf]|><|mask;x=0;y=0[;c=conf];data=<maskH>,<maskW>,<enc>payload|>,id<|box..|><|mask..|>
```

- **Frame index** `<Nf>` is zero-based. A frame with no visible object emits **no line**, so indices can skip. Concept prompts arrive in ascending order. Box/point prompts with `both` send the forward frames first, then the backward ones.
- **Track id**: an integer that stays stable across frames within one response. Ids are not dense. Don't rely on an id surviving an object's entry, exit, full occlusion, or "very long clips".
- **Box**: inclusive corners in source pixels. `w`/`h` give the displayed frame size, after rotation flags are applied.
- **Mask**: the payload is base85 (not base64). The marker is `~` for lossless (default) or `!` for `one_bit`, set with `metadata.mask_encoding`. Box/point prompts always return `one_bit`. The mask raster `H×W` is smaller than the frame. `decodeMaskToRaster` / `decode_mask_to_raster` turns it into a row-major 0/1 array, and the libraries can also convert to COCO RLE or SVG.
- **Confidence**: set `metadata.include_confidence: "true"` (a string) to get `c` ∈ [0,1] on every box and mask, **per object per frame**. This needs `meta-sam-parser` ≥ 0.0.6 or `@meta-sam/parser` ≥ 0.0.13 ([Segmenting](https://dev.meta.ai/docs/sam/segmenting), [Client libraries](https://dev.meta.ai/docs/sam/client-libraries)).
- **Zero matches** is a normal result: the `output_text` is empty.
- Billing is reported in `usage.video_frames_processed` ([Pricing](https://dev.meta.ai/docs/pricing-rate-limits)).

### Price and limits

- $2.50 per 1,000 images. **$0.20 per 1,000 video frames, at least 50 frames billed per request.** Streaming and non-streaming cost the same. There is no contributor mode for SAM ([Pricing](https://dev.meta.ai/docs/pricing-rate-limits)).
- 3,000 RPM per team, with no TPM limit ([Pricing](https://dev.meta.ai/docs/pricing-rate-limits)).

## 3. Muse Spark 1.3

| Item | Fact | Source |
|---|---|---|
| Model IDs | `muse-spark-1.3` (standard) and `muse-spark-1.3-contributor`. Same endpoints, switched by model ID | [Models](https://dev.meta.ai/docs/models) |
| Inputs | Text, image, video, audio, PDF in. Text out. 1,048,576-token context | [Models](https://dev.meta.ai/docs/models) |
| Video format | `video/mp4` only (the only video MIME type in the file table) | [File handling](https://dev.meta.ai/docs/file-handling), [Video understanding](https://dev.meta.ai/docs/video-understanding) |
| Video by | Responses: `input_file` / `input_video` with `file_id`, or `input_video` with `video_url` (public or base64 data URL). Chat Completions: `video_url` content part | [Video understanding](https://dev.meta.ai/docs/video-understanding) |
| Size | 50 MB inline, 1 GiB via the Files API | [File handling](https://dev.meta.ai/docs/file-handling) |
| fps sampling, max duration, tokens per second of video | **Unverified.** None of these are documented. Token cost has to be measured with `POST /v1/responses/input_tokens`, which only tokenizes and does not generate | [Token counting](https://dev.meta.ai/docs/token-counting) |
| Multiple videos per request | **Unverified.** Images are capped at 50 per request. The docs state no limit for videos | [Image understanding](https://dev.meta.ai/docs/image-understanding) |
| Audio | Spark reads a video's embedded audio track. Audio is "not fully supported" on 1.3; the docs suggest 1.2 or Voice Transcribe instead | [Video understanding](https://dev.meta.ai/docs/video-understanding) |
| Reasoning | `reasoning.effort` (Responses) or `reasoning_effort` (Chat) can be `minimal`/`low`/`medium`/`high`/`xhigh`/`max`. `"none"` returns 400. **`max` is not available on `-contributor`.** Reasoning tokens count against the output budget | [Reasoning](https://dev.meta.ai/docs/reasoning) |
| Structured output | JSON Schema with constrained decoding: `text.format` on Responses, `response_format` on Chat. Recursive schemas are not supported | [Structured output](https://dev.meta.ai/docs/structured-output) |
| Tool calling | You define function and custom tools, and your app executes them. **`tool_choice` only accepts `"auto"`**: `"required"` or a named tool returns 400 | [Tool calling](https://dev.meta.ai/docs/tool-calling) |
| Code execution | **None hosted.** "The API also offers two built-in tools that run server-side: `web_search` … and `tool_search`." Meta's sandbox recipe has Spark run code in **your** Docker container through function tools. The marketing page's line that "visual reasoning runs through a real execution environment" describes internal model behaviour, not a tool developers can call | [Tool calling](https://dev.meta.ai/docs/tool-calling), [Sandboxed execution recipe](https://dev.meta.ai/docs/cookbook/sandboxed-execution), [Muse Spark page](https://dev.meta.ai/models/muse-spark/) |
| Spatial output | For images, Spark returns coordinates as text on a normalized 0–1000 grid (it does not return masks) | [Image understanding](https://dev.meta.ai/docs/image-understanding) |

### Pricing and rate limits ([Pricing and rate limits](https://dev.meta.ai/docs/pricing-rate-limits))

| Per 1M tokens | Standard `muse-spark-1.3` | Contributor `muse-spark-1.3-contributor` |
|---|---|---|
| Input | $1.25 | $0.10 |
| Cached input | $0.15 | $0.002 |
| Output | $4.25 | $0.20 |
| RPM / TPM (per team) | 3,000 / 4,000,000 | **150** / 3,000,000 |

- In contributor mode, the prompts, files and responses you send "may be used to train future Meta models".
- No long-context premium. `web_search` adds $2.50 per 1,000 queries.
- Rate limits are per team, not per key. On a 429, back off and respect `Retry-After`. `x-ratelimit-*` headers are returned on token-based responses.
- No batch discount is documented. (`purpose=batch` exists for JSONL uploads, but no price is given for it.)

## 4. Latency

- **Meta API latency is unverified.** The docs only say that higher reasoning effort increases latency and that the first token arrives after reasoning finishes ([Reasoning](https://dev.meta.ai/docs/reasoning)).
- Third-party, Spark 1.3 at `max` effort on Meta's API: about 176 output tok/s and **about 42 s to first token**. The page doesn't cover video and doesn't give figures for lower effort levels ([Artificial Analysis](https://artificialanalysis.ai/models/muse-spark-1-3), fetched 2026-10-27; the value shifts between fetches).
- SAM 3.1, self-hosted (not API): 32 fps on one H100 for videos with a "medium number of objects" ([Meta AI blog](https://ai.meta.com/blog/segment-anything-model-3/)). API throughput is not published.
- We have to measure latency on day 1, as AGENTS.md §11 already plans.

## 5. What this means for `lerobot/droid_100`

From the dataset's [`meta/info.json`](https://huggingface.co/datasets/lerobot/droid_100/blob/main/meta/info.json):

- The format is LeRobot v3.0: 100 Episodes, 32,212 frames in total, 15 fps.
- There are 3 camera streams (`exterior_image_1_left`, `exterior_image_2_left`, `wrist_image_left`), each 320×180, **`video.codec: av1`**, with no audio.
- Videos are packed into shared `file-NNN.mp4` files (500 MB target), so each Episode has to be cut out.

What follows from that:

1. **Transcode to H.264 MP4 before SAM.** AV1 is not one of SAM's listed codecs. Spark only says "mp4", with no codec stated, so transcoding is the safe choice for Spark too. One option: `ffmpeg -i in.mp4 -c:v libx264 -movflags +faststart out.mp4`. Faststart avoids a server-side remux ([Segmenting](https://dev.meta.ai/docs/sam/segmenting)).
2. **SAM cost estimate:** about 322 frames per Episode × $0.20/1,000 ≈ **$0.064 per camera per concept**. With 100 Episodes, one camera, and two concepts ("robot gripper", plus the object), that is about **$13**. All three cameras would be about **$39**. This is arithmetic from the published prices, not a measurement.
3. **Spark cost per Episode cannot be computed yet** because video tokenization is undocumented. Measure it with `/v1/responses/input_tokens` on a few clips. At the contributor rate, 100k input tokens would cost $0.01.
4. Contributor mode's 150 RPM is enough for 100 Episodes. The `max` reasoning level needs standard mode.

## 6. Where AGENTS.md disagrees with the docs

| AGENTS.md says | Docs say | Impact |
|---|---|---|
| §6: Spark's "visual reasoning runs through a code-execution environment, so it can compute measured criteria over robot data too" | The API has no hosted code execution. The only built-in tools are `web_search` and `tool_search` ([Tool calling](https://dev.meta.ai/docs/tool-calling)) | Compute measured Criteria in Winnow's own code, or give Spark a function tool that runs in our sandbox ([recipe](https://dev.meta.ai/docs/cookbook/sandboxed-execution)). Don't claim API code execution in the pitch |
| §6/§11.4: "one call returns detections, masks, identity-preserving tracks"; prompts "robot gripper" + object | True for **one concept on one video**. Each concept and each camera needs its own request ([Segmenting](https://dev.meta.ai/docs/sam/segmenting)) | Plan for N concepts × M cameras calls per Episode. Track ids are not guaranteed across occlusion or exit, which matters for an "object dropped" Criterion |
| §6: "first-pass judging on Spark's cheaper tier… *(Verify actual tier pricing — listings disagree)*" | Settled: contributor costs $0.10/$0.20 against standard $1.25/$4.25. But contributor is limited to **150 RPM** and has **no `max` reasoning** ([Pricing](https://dev.meta.ai/docs/pricing-rate-limits), [Reasoning](https://dev.meta.ai/docs/reasoning)) | The cascade still works. Escalation to `max` has to use standard mode |
| §6: Glimmer as a second-opinion judge on borderline Episodes | Glimmer takes **text + image only (no video)**, is self-hosted, and is not on the Model API ([Glimmer](https://dev.meta.ai/docs/muse-glimmer), [Models](https://dev.meta.ai/docs/models)) | A Glimmer judge has to work from sampled keyframes |
| §6: Voice Transcribe gives "moment-level labels from speech" | Voice Transcribe gives turn-level timestamps, **not word-level** ([Models](https://dev.meta.ai/docs/models)) | Moment alignment is per utterance |
| §11.2: load `droid_100` and run SAM on the clips | droid_100 is AV1 and packs multiple Episodes per MP4 ([info.json](https://huggingface.co/datasets/lerobot/droid_100/blob/main/meta/info.json)). SAM accepts only H.264/H.265/MPEG-4 | Add a transcode-and-split step before any API call |
| §13: "crop with SAM" to cut video tokens | SAM returns boxes and masks. Cropping or masking is our own client-side work, and Spark's video token cost is undocumented | It can still be done, but the savings have to be measured |

## Unverified (no primary source found)

- Spark: video fps sampling, maximum video duration, video tokens per second, maximum videos per request, which MP4 codecs are accepted.
- SAM: whether AV1 is actually rejected (it is just not on the accepted list), any server-side frame-stride option, and API latency/throughput.
- Whether the OpenAI SDK's `metadata=` argument or `extra_body` passes SAM's `metadata` keys through correctly.
- End-to-end API latency for both models.

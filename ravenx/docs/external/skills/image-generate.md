# Built-in Text-to-Image

RavenOS includes an Image Studio UI panel and a server-side endpoint to generate images via Hugging Face Inference API.

## Endpoint

`POST /api/image/generate`

Body:
- `prompt` (required)
- `negative_prompt` (optional)
- `size` (512x512 | 768x768 | 1024x1024)
- `steps` (1..80)
- `model` (default: Tongyi-MAI/Z-Image)

## Server-side token

Set:
- `RAVENOS_HF_TOKEN`
- `RAVENOS_HF_DEFAULT_MODEL`

The UI never stores this token.

## Agent tool

Expose as a tool named `image.generate` by forwarding tool calls to this endpoint.

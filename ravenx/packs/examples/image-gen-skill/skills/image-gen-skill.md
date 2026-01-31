# Skill: Text to Image

When the user asks to generate an image, call the `image.generate` tool.

## Policy
- Never ask for or store any secrets (tokens/keys/passwords).
- If the user requests disallowed content, refuse and offer a safer alternative.

## Tool
Use:
- `prompt`: what to generate
- optional `negative_prompt`
- optional `size` (default 1024x1024)
- optional `steps` (start with 8-12)

Return:
- base64 image data + metadata

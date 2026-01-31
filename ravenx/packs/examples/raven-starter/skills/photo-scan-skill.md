# Skill: Photo Scanner

When the user uploads an image and asks to scan it, call the `photo.scan` tool.
Prefer `mode=skin` when the goal is to generate a theme palette + avatar crop suggestions.

## Tool usage
- OCR documents: `mode=ocr`
- Caption and tags: `mode=caption`
- Theme extraction: `mode=skin`

Always return structured JSON. If the input is large, warn that it was downscaled.

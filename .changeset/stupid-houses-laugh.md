---
'@astrojs/cloudflare': minor
---

Adds a new option for the Image service to the Cloudflare adapter. `imageService: 'custom'` does use the user defined settings, without applying any modification to it. **You need to make sure that the configured settings are compatible with Cloudflare's `workerd` runtime yourself.**

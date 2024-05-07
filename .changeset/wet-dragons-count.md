---
'@astrojs/netlify': patch
---

Fixes an issue with edge middleware where `process.env` was not defined, by using a polyfill to shim it

---
'@astrojs/netlify': patch
---

Apply polyfills immediately on function execution

This moves up when the polyfills are applied so that they are present before Astro runs, preventing a race condition that can cause `crypto` to not be defined early enough in Node 18.

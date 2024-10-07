---
'@astrojs/netlify': major
---

Changes SSR working directory to site root rather than repo root.

During SSR, the working directory is now the site root, rather than the repo root. This change allows you to use paths in your SSR functions that match the paths used for `includedFiles`. 

---
'@astrojs/netlify': patch
---

Prevent crawling linuxbrew folder

When the build occurs it traces your build output to determine if any dependant files need to be copied over. If you happen to have a route of `/home`, nft will see that and scan your home folder. This is normally ok, but on Netlify there is a `/home/linuxbrew/.linuxbrew` that contains a lot of stuff that shouldn't be scanned. This ignores that folder.

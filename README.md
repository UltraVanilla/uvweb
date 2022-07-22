UltraVanilla dynmap proxy
===

A simple webserver to proxy connections to a Minecraft dynmap page, inject a header and implement various tools.

Features:

- Go to coordinates, paste in output of F3+C
- Copy coordinates in different formats
- Header with server-related links, server address, version
- Jump to spawn
- Shorter URL format that doesn't conflict with formatting codes when pasted into chat
- Go through nether portal (divides coordinates by 8 and vice versa)
- Crosshair showing coordinates at center of screen
- Distance measurement tool
- Configurable UI, hide things you don'tneed

Live demo: https://ultravanilla.world/

Building
---

`npm install` - **Install dependencies and compile everything**

`npm run build` - Compile everything

`npm run ts` - Compile typescript

`npm run bundle` - Compile clientside javascript (must do `ts` first)

`npm run grab-vendor-assets` - Download fonts

---

`npm run watch` - Automatically compile typescript and output bundles as you edit

---

`npm run start` - **Run webserver on $PORT**

License
---

This source code is licensed under the terms of AGPL version 3 or later. You MUST provide source code when hosting it on a server.

Includes modified source code from dynmap released under Apache v2 license - Copyright (c) 2020 Mikeprimm

The files under `dynmap/` remain licensed under the terms of Apache 2.0 for the sake of upstream compatibility.

**Contributing**

By making a contribution to this project, I certify that:

- (a) The contribution was created in whole or in part by me and I have the right to submit it under a suitable open source license; or

- (b) The contribution is based upon previous work that, to the best of my knowledge, is covered under an appropriate open source license and I have the right under that license to submit that work with modifications, whether created in whole or in part by me, under the same open source license (unless I am permitted to submit under a different license), as indicated in the file; or

- (c) The contribution was provided directly to me by some other person who certified (a), (b) or (c) and I have not modified it.

- I understand and agree that this project and the contribution are public and that a record of the contribution is maintained indefinitely and may be redistributed consistent with this project or the open source license(s) involved.

- (d) I understand that this project is currently licensed as AGPLv3+. At the discretion of the leadership of this project (lordpipe) alone, parts or whole of this project may be re-licensed at any time to any of the following list of licenses, and any contributions must be simultaneously compatible with ALL of these licenses:

    - AGPLv3+
    - GPLv3+
    - Apache 2.0

Additionally, I agree:

- To fulfill (d), I hereby grant the leadership of this project (lordpipe) a perpetual, worldwide, non-exclusive, no-charge, royalty-free, irrevocable copyright license that is simultaneously compatible with the above licenses.

This applies to contributions through the pull request process, not simple forks.

**Non-legalese:** You get to use the project as AGPLv3, but you must contribute in a way that permits relicensing any components to GPLv3+ or Apache 2.0.

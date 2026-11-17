# Native motion graphics: Claude, ChatGPT and the Nolan route

Research date: 10 November 2026. This work was requested in normal ChatGPT and is intentionally isolated from Nolan BC's concurrent development.

## Finding

The underlying capability is ordinary code-generated graphics: the assistant writes HTML/JavaScript and a browser draws the composition. That is different from asking a generative-video model to synthesize an MP4. Native Canvas, CSS and SVG can animate without third-party libraries. Libraries such as GSAP and Three.js can simplify or extend the work but are not inherent requirements.

Claude's Artifacts documentation describes standalone HTML and code artifacts. OpenAI's current code-block documentation describes supported HTML/React/SVG previews and says availability depends on account, device, model, workspace settings and rollout. Neither a comment thread nor a successful HTML preview by itself proves how a particular creator produced an MP4.

In this conversation, no native Canvas editing tool was available to call. The study therefore produces a self-contained HTML file and an actual MP4 through the available isolated execution environment. It does not promise that an HTML attachment will play inside every iOS chat. The browser preview is a normal webpage with Play/Pause and timeline scrubbing.

## Reference status

The submitted short URL resolved to @motionlovee, video 7693519537072901398, public reported duration 15s. The metadata was accessible, but the published stream returned HTTP 403. The owner supplied a screenshot showing a dark laptop on a reflective surface with metallic “LINEAR” typography. This is enough to identify visible visual ingredients, but not the creator's code, motion curves, sound or complete workflow. The prototype uses original “MOTION” and “CREATE” designs and an authored generic laptop. It does not claim exact reference replication.

## What already exists

A read-only audit found Nolan BC's installed `nolan-browser-motion` runtime with GSAP, Three.js, Playwright, Lottie and HyperFrames packages, an existing deterministic `window.seek(t)` adapter, and a contract/preflight/release process. This study does not install, upgrade, replace or rewrite that runtime. Its standalone composition conforms to the same seek interface. The different rendering implementation is a self-contained example, not a new global client-production system.

## Native code versus export

The HTML has zero external runtime dependencies, assets, font downloads, network requests or model calls. Its device, reflection, materials and type are computed by JavaScript and Canvas. MP4 export uses Chromium/Playwright to capture exactly 540 timestamped frames, then FFmpeg to encode H.264. Those export tools are dependencies of the capture route, not plugins in the HTML and not a generative-video API. “No plugins” should never be expanded into “no renderer or execution environment.”

The initial WebGL route was unavailable in this sandbox. No browser or OS policy was altered. The delivered study uses Canvas 2D to rasterize authored perspective geometry. This is an approximation of a device/material scene, not a physically based path-traced model or manufacturer-accurate hardware. More realistic devices should use licensed meshes and Nolan's qualified Three.js/Blender route where appropriate.

## Why earlier edits did not prove this capability

Placing staff footage inside moving rectangles is not equivalent to directing a full procedural scene. The relevant choices are camera, geometry, typography, hierarchy, material, transitions and precise timing. The new study proves execution of a complete original coded scene, while intentionally not calling its aesthetic quality approved. More skill files alone do not solve direction or taste.

## Sources

- Claude Artifacts: https://support.claude.com/en/articles/9487310-what-are-artifacts-and-how-do-i-use-them
- OpenAI writing/code blocks and supported previews: https://help.openai.com/en/articles/20001246-working-with-writing-blocks-and-code-blocks-in-chatgpt
- MDN Canvas API: https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API
- MDN requestAnimationFrame timing: https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame
- Playwright screenshot capture: https://playwright.dev/docs/screenshots
- FFmpeg manual: https://ffmpeg.org/ffmpeg.html (manual URL; web fetch timed out in this run, so no specific undocumented claim relies on it)
- User-supplied TikTok: https://vt.tiktok.com/ZSpPVsLPf/

## Remaining gates

Full TikTok motion/audio access; sound design and music licensing/listening; owner creative acceptance; physical-phone presentation; platform-native preview availability; target-machine rendering of this specific composition; manufacturer-accurate model or brand font; production guard and native editable-project acceptance. Do not label those complete based on a clean encode.

// usage: node scripts/stills.mjs <outPrefix> <frame,frame,...> [scale] [inputPropsJSON]
// Bundles once and renders stills of KopenickShort with software WebGL (SwiftShader via ANGLE: no GPU in the cloud).
import fs from "node:fs";
import path from "node:path";
const tmp = process.env.REMOTION_TMP || path.resolve(".remotion-tmp");
fs.mkdirSync(tmp, { recursive: true }); process.env.TMPDIR = process.env.TEMP = process.env.TMP = tmp;
const { bundle } = await import("@remotion/bundler");
const { renderStill, selectComposition } = await import("@remotion/renderer");
const [prefix, frames, scale = "0.5", props = "{}"] = process.argv.slice(2);
const browserExecutable = process.env.CHROME_PATH || "/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell";
const chromiumOptions = { gl: process.env.GL || "swangle" };
const inputProps = JSON.parse(props);
fs.mkdirSync(path.dirname(prefix), { recursive: true });
const serveUrl = await bundle({ entryPoint: path.resolve("src/index.ts"), publicDir: path.resolve("public") });
const composition = await selectComposition({ serveUrl, id: "KopenickShort", browserExecutable, chromiumOptions, inputProps });
const onBrowserLog = (l) => { if (l.type === "error" || l.type === "warning") console.log(`[${l.type}]`, l.text.slice(0, 300)); };
for (const f of frames.split(",").map(Number)) {
  const t0 = Date.now();
  await renderStill({ composition, serveUrl, frame: f, output: `${prefix}${f}.jpg`, imageFormat: "jpeg", jpegQuality: 88, scale: Number(scale),
    browserExecutable, chromiumOptions, inputProps, timeoutInMilliseconds: 600000, onBrowserLog });
  console.log("still", f, ((Date.now() - t0) / 1000).toFixed(1) + "s");
}

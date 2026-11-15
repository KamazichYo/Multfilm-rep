// usage: node scripts/sheet.mjs <outDir> <everyNth> [inputPropsJSON] [from-to]
// One browser session renders every Nth frame (textures are painted once), then python makes a contact sheet.
import fs from "node:fs";
import path from "node:path";
const tmp = process.env.REMOTION_TMP || path.resolve(".remotion-tmp");
fs.mkdirSync(tmp, { recursive: true }); process.env.TMPDIR = process.env.TEMP = process.env.TMP = tmp;
const { bundle } = await import("@remotion/bundler");
const { renderFrames, selectComposition } = await import("@remotion/renderer");
const [outDir, nth = "40", props = "{}", range] = process.argv.slice(2);
const browserExecutable = process.env.CHROME_PATH || "/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell";
const chromiumOptions = { gl: "swangle" };
const inputProps = JSON.parse(props);
fs.mkdirSync(outDir, { recursive: true });
const serveUrl = await bundle({ entryPoint: path.resolve("src/index.ts"), publicDir: path.resolve("public") });
const composition = await selectComposition({ serveUrl, id: "KopenickShort", browserExecutable, chromiumOptions, inputProps });
const t0 = Date.now();
await renderFrames({ composition, serveUrl, inputProps, browserExecutable, chromiumOptions, outputDir: outDir, imageFormat: "jpeg", jpegQuality: 85,
  everyNthFrame: Number(nth), frameRange: range ? range.split("-").map(Number) : null, concurrency: 1, scale: Number(process.env.SCALE || 0.3),
  timeoutInMilliseconds: 600000, onStart: () => {}, onFrameUpdate: () => {},
  onBrowserLog: (l) => { if (l.type === "error") console.log("[err]", l.text.slice(0, 200)); } });
console.log("done in", ((Date.now() - t0) / 1000).toFixed(0), "s");

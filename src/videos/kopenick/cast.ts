// Who stands where in every shot, with expressions and gestures timed to the words (story.ts W()).
// Characters are the bean-head cards of toon.ts; placement / lighting / pooling is cast_base.ts (from the skill).
import * as THREE from "three";
import { Outfit, Expr, FrontOpts, SideOpts, INK, SKINS, townsfolk, fxBurst, fxPuff, Pen } from "./toon";
import { FPS, SHOTS, V3, W, VX, VZ, voigtLeadZ, clamp01 } from "./story";
import { Stage, CamInfo, Who, person, blob, lidAt, viewOf, prepLight } from "./cast_base";
import { fxQuestion, fxCoin, fxNote, fxReceipt, fxCashBox, fxUniform, fxNoPassport, fxTrain } from "./props";

export type { Stage } from "./cast_base";
export { Pool, Actor, Fx, SU } from "./cast_base";

// ---------------- outfits ----------------
const VOIGT_CIV: Outfit = { jacket: "#8a6a4e", pants: "#4a4038", boots: "#3a2a20", hat: "cap", cap: "#5a4a3a", moustache: "#cfc8bd", skin: SKINS[1] };
const VOIGT_HALF: Outfit = { ...VOIGT_CIV, hat: "officercap", cap: "#2a3550" };
const VOIGT: Outfit = { jacket: "#34467a", pants: "#262a3a", boots: INK, hat: "officercap", cap: "#2a3550", buttons: "#e8c45a", sword: true,
  moustache: "#cfc8bd", skin: SKINS[1], belt: null };
const SOLDIER = (v: number): Outfit => ({ jacket: ["#3a4f8a", "#34477e", "#405592", "#2f4478"][v % 4], pants: "#2b2f3c", boots: INK, hat: "pickel",
  belt: "#f1efe6", buttons: "#e8c45a", rifle: true, skin: SKINS[v % 4], moustache: v % 3 === 1 ? "#4a3426" : undefined });
const MAYOR: Outfit = { jacket: "#3c8a4a", pants: "#2e3a30", boots: "#3a2a20", hat: "tophat", moustache: "#5a3b2a", build: "stout", buttons: "#e8c45a", skin: SKINS[2] };
const TREASURER: Outfit = { jacket: "#c25a3a", pants: "#3b3f52", boots: "#3a2a20", hat: "hair", hair: "#3a2a1e", skin: SKINS[0] };
const POLICE = (v: number): Outfit => ({ jacket: "#2f5a46", pants: "#25302a", boots: INK, hat: "pickel", buttons: "#d9dde0", skin: SKINS[(v + 2) % 4],
  moustache: "#3a2a1e", build: v ? "stout" : "adult" });
const KAISER: Outfit = { jacket: "#e9e4d6", pants: "#2b2f3c", boots: INK, hat: "kaiser", sash: "#e8c45a", buttons: "#e8c45a", sword: true,
  moustache: "#3a2a1e", build: "stout", skin: SKINS[0] };
const FOLK = [0, 1, 2, 3, 4, 5].map((v) => townsfolk(v));

const ok = (o: Outfit) => JSON.stringify(o).length + ":" + o.jacket + (o.hat ?? "") + (o.cap ?? "");

// ---------------- helpers ----------------
const hh = (i: number, s = 0) => { const v = Math.sin(i * 127.1 + s * 311.7) * 43758.5453; return v - Math.floor(v); };
const q = (v: number, n = 30) => Math.round(v * n) / n;
const tmp = new THREE.Vector3();
type Pose = {
  i: number; o: Outfit; x: number; z: number; y?: number; expr?: Expr; look?: number; facing?: -1 | 0 | 1; mode?: "march" | "stroll" | "stand";
  phase?: number; wave?: number; tilt?: number; headTilt?: number; side?: [number, number]; scale?: number; noBlob?: boolean; swaps?: number[];
};
/** one character: front view unless side = walking direction (dx, dz) and the camera sees it side-on */
const put = (out: Stage, cam: CamInfo, t: number, P: Pose) => {
  const who: Who = { i: P.i, o: P.o, okey: ok(P.o) };
  const view = P.side ? viewOf(cam, P.x, P.z, P.side[0], P.side[1]) : { side: false, mirror: false, fs: 1 };
  const blink = lidAt(t, P.i, P.swaps ?? []);
  const fo: FrontOpts = { phase: P.phase ?? 0, expr: P.expr ?? "neutral", mode: P.mode ?? "stand", look: P.look ?? 0, blink, wave: P.wave, tilt: P.tilt ?? 0,
    headTilt: P.headTilt ?? 0, facing: P.facing ?? 0 };
  const so: SideOpts = { phase: P.phase ?? 0, expr: P.expr ?? "neutral", mode: P.mode === "march" || P.mode === "stroll" ? "march" : "stand", blink, stride: view.fs };
  out.places.push(person(cam, who, P.x, P.y ?? 0, P.z, view, fo, so, P.scale ?? 1));
  if (!P.noBlob) blob(out, P.x, P.y ?? 0, P.z, P.scale ?? 1);
};
type FxD = { key: string; cw: number; ch: number; draw: (p: Pen) => void };
const fx = (out: Stage, d: FxD, at: V3, w: number, h: number, extra: { flat?: boolean; rot?: number; soft?: boolean } = {}) =>
  out.fx.push({ ...d, x: at[0], y: at[1], z: at[2], w, h, ...extra });
/** pop-in scale for an effect that appears at frame f0 (overshoot), 0 before */
const pop = (f: number, f0: number) => { const n = f - f0; if (n < 0) return 0; if (n > 6) return 1; return [0.3, 0.75, 1.12, 1.08, 1.02, 1, 1][n]; };
const puff = (out: Stage, f: number, f0: number, at: V3, s = 1.4) => {
  const u = (f - f0) / 12;
  if (u < 0 || u >= 1) return;
  const k = q(u);
  fx(out, { key: `puff${k}`, cw: 300, ch: 300, draw: (p) => fxPuff(p, k) }, at, s, s, { soft: true });
};
const burst = (out: Stage, f: number, f0: number, at: V3, s = 1.2, col = "#fff3b0", dur = 10) => {
  const u = (f - f0) / dur;
  if (u < 0 || u >= 1) return;
  const k = q(u);
  fx(out, { key: `burst${col}${k}`, cw: 500, ch: 500, draw: (p) => fxBurst(p, k, col) }, at, s, s);
};
/** marching phase at 2 steps/s */
const march = (t: number, i = 0) => (((t * 1.0 + i * 0.0) % 1) + 1) % 1;

// ---------------- crowd filler ----------------
const FOLK_SPOTS: [number, number][] = [[-12, -8], [-14, 12], [10, 12], [13, -4], [-3, 14], [6, 16], [16, 7], [-17, -2], [3, -12], [-9, -15], [11, -14], [-16, 16]];
const townsfolkAt = (out: Stage, cam: CamInfo, t: number, n = 12, skip: (x: number, z: number) => boolean = () => false) => {
  FOLK_SPOTS.slice(0, n).forEach(([x0, z0], k) => {
    const i = 40 + k, walking = k % 3 === 0;
    const dx = Math.cos(k * 1.7), dz = Math.sin(k * 1.7), d = walking ? ((t * 0.9 + hh(k) * 8) % 8) - 4 : 0;
    const x = x0 + dx * d, z = z0 + dz * d;
    if (skip(x, z)) return;
    put(out, cam, t, { i, o: FOLK[k % 6], x, z, mode: walking ? "stroll" : "stand", phase: walking ? march(t * 0.9) : 0, side: walking ? [dx, dz] : undefined,
      expr: (["neutral", "smile", "smile_closed", "neutral"] as Expr[])[k % 4] });
  });
};

// ---------------- the shots ----------------
type Ctx = { out: Stage; cam: CamInfo; t: number; f: number };
const SHOT: Record<number, (c: Ctx) => void> = {
  1: ({ out, cam, t, f }) => { // hero: the captain before the town hall, guards behind
    put(out, cam, t, { i: 1, o: VOIGT, x: 0, z: -14, expr: f < W(3.5) ? "stern" : "smug", headTilt: -3, swaps: [3.5] });
    put(out, cam, t, { i: 2, o: SOLDIER(0), x: -1.5, z: -17.2, expr: "stern" });
    put(out, cam, t, { i: 3, o: SOLDIER(1), x: 1.6, z: -17.4, expr: "stern" });
    townsfolkAt(out, cam, t, 8, (x, z) => z < -10);
  },
  2: ({ out, cam, t }) => { // aerial: the square, Voigt the civilian crossing it
    const x = -2 - 1.2 * (t - 4.9);
    put(out, cam, t, { i: 1, o: VOIGT_CIV, x, z: 2, mode: "stroll", phase: march(t * 0.9), side: [-1, 0], expr: "sad" });
    townsfolkAt(out, cam, t);
  },
  3: ({ out, cam, t, f }) => { // 57, prison behind him, not a penny
    put(out, cam, t, { i: 1, o: VOIGT_CIV, x: -8, z: 3, expr: f < W(8.9) ? "neutral" : "sad", swaps: [8.9], headTilt: f < W(9.3) ? 0 : 6 });
    townsfolkAt(out, cam, t, 12, (x, z) => Math.hypot(x + 8, z - 3) < 3);
  },
  4: ({ out, cam, t, f }) => { // the stall: cap first, then the coat
    const o = f < W(11.4) ? VOIGT_CIV : f < W(12.1) ? VOIGT_HALF : VOIGT;
    put(out, cam, t, { i: 1, o, x: -16.2, z: 8.6, expr: f < W(12.1) ? "neutral" : "smug", swaps: [11.4, 12.1] });
    put(out, cam, t, { i: 4, o: FOLK[3], x: -19.4, z: 8.0, expr: "smile_closed" });
    puff(out, f, W(11.4), [-16.2, 1.6, 8.7], 0.9);
    puff(out, f, W(12.1), [-16.2, 0.9, 8.7], 1.5);
  },
  5: ({ out, cam, t, f }) => { // the patrol marches up the square, stopped by a raised hand
    const stopT = 14.75, tt = Math.min(t, stopT), front = -17.2 + 1.6 * (tt - 13.1);
    for (let k = 0; k < 6; k++) {
      const marching = t < stopT;
      put(out, cam, t, { i: 10 + k, o: SOLDIER(k), x: -7.6 + (k & 1) * 1.1, z: front - (k >> 1) * 1.3, mode: marching ? "march" : "stand", phase: march(tt),
        expr: f < W(14.5) ? "neutral" : "shock", swaps: [14.5] });
    }
    put(out, cam, t, { i: 1, o: VOIGT, x: VX, z: VZ, facing: -1, expr: "stern", wave: f >= W(14.1) ? Math.min(1, (f - W(14.1)) / 4) : undefined });
  },
  6: ({ out, cam, t }) => { // "Soldiers, follow me!"
    put(out, cam, t, { i: 1, o: VOIGT, x: VX, z: VZ, facing: -1, expr: "shout", wave: 1, headTilt: -4 });
    put(out, cam, t, { i: 11, o: SOLDIER(1), x: VX - 2.4, z: VZ - 3.2, facing: 1, expr: "neutral" });
  },
  7: ({ out, cam, t }) => { // they march after him toward the lens; nobody asks
    const z = voigtLeadZ(t), ph = march(t);
    put(out, cam, t, { i: 1, o: VOIGT, x: -3, z, mode: "march", phase: ph, expr: "smug" });
    for (let k = 0; k < 6; k++)
      put(out, cam, t, { i: 10 + k, o: SOLDIER(k), x: -3.55 + (k & 1) * 1.1, z: z - 1.7 - (k >> 1) * 1.3, mode: "march", phase: ph, expr: "neutral" });
    townsfolkAt(out, cam, t, 12, (x, zz) => x > -6 && x < 0);
  },
  8: ({ out, cam, t, f }) => { // to Köpenick: a little train puffs across the tower view
    const u = (f - 603) / 58;
    fx(out, { key: `train${q(t % 1)}`, cw: 700, ch: 400, draw: (p) => fxTrain(p, q(t % 1)) }, [-14 + 26 * u, 5.0, -9], 3.6, 2.05);
    townsfolkAt(out, cam, t);
  },
  9: ({ out, cam, t, f }) => { // into the town hall, the mayor is arrested
    put(out, cam, t, { i: 1, o: VOIGT, x: -1.3, z: -21.5, facing: 1, expr: "stern", wave: f >= W(22.8) ? 0.6 : undefined });
    put(out, cam, t, { i: 20, o: MAYOR, x: 1.0, z: -22.3, facing: -1, expr: f < W(22.8) ? "smile" : "shock", swaps: [22.8], tilt: f < W(22.8) ? 0 : -4 });
    put(out, cam, t, { i: 12, o: SOLDIER(2), x: -2.6, z: -20.2, facing: 1, expr: "stern" });
    put(out, cam, t, { i: 13, o: SOLDIER(3), x: 2.7, z: -20.6, facing: -1, expr: "stern" });
    burst(out, f, W(22.8), [1.0, 1.7, -22.2], 1.4, "#ffffff", 8);
  },
  10: ({ out, cam, t, f }) => { // the mayor does not argue
    put(out, cam, t, { i: 20, o: MAYOR, x: 1.0, z: -22.3, facing: 0, expr: f < W(24.25) ? "nervous" : "smile_closed", swaps: [24.25], wave: 1 });
    put(out, cam, t, { i: 13, o: SOLDIER(3), x: 2.5, z: -23.0, facing: -1, expr: "stern" });
  },
  11: ({ out, cam, t, f }) => { // the treasurer opens the cash box
    put(out, cam, t, { i: 21, o: TREASURER, x: 5.4, z: -20.6, facing: -1, expr: f < W(26.5) ? "smile" : "grin", swaps: [26.5] });
    put(out, cam, t, { i: 1, o: VOIGT, x: 3.65, z: -18.4, facing: 1, expr: f < W(26.5) ? "neutral" : "smug" });
    const open = clamp01((f - W(25.9)) / 10);
    fx(out, { key: `cash${q(open, 10)}`, cw: 500, ch: 400, draw: (p) => fxCashBox(p, q(open, 10)) }, [4.6, 1.27, -19.45], 0.9, 0.72);
    if (f >= W(26.5)) for (let k = 0; k < 9; k++) {
      const age = (f - W(26.5)) / 30 - k * 0.06;
      if (age < 0 || age > 1.3) continue;
      const a = -1.2 + k * 0.3, x = 4.6 + Math.sin(a) * 1.0 * age, y = 1.4 + 1.5 * age - 1.4 * age * age;
      const note = k % 3 === 2, sp = q((age * 7 + k) % 6.28, 10);
      fx(out, note ? { key: "note", cw: 240, ch: 140, draw: fxNote } : { key: `coin${sp}`, cw: 160, ch: 160, draw: (p) => fxCoin(p, sp) },
        [x, y, -19.2 + 0.05 * k], note ? 0.4 : 0.24, note ? 0.24 : 0.24, { rot: age * 3 * (k % 2 ? 1 : -1) });
    }
  },
  12: ({ out, cam, t, f }) => { // the receipt and the borrowed signature
    put(out, cam, t, { i: 1, o: VOIGT, x: 3.3, z: -18.5, facing: 1, expr: f < W(30.3) ? "neutral" : f < W(31.3) ? "smug" : "grin", swaps: [30.3, 31.3] });
    put(out, cam, t, { i: 21, o: TREASURER, x: 5.6, z: -20.7, facing: -1, expr: "smile" });
    const k = clamp01((f - W(29.7)) / 40);
    fx(out, { key: `rcpt${q(k, 20)}`, cw: 600, ch: 800, draw: (p) => fxReceipt(p, q(k, 20)) }, [4.25, 1.09, -19.4], 0.4, 0.53, { flat: true, rot: 0.15 });
  },
  13: ({ out, cam, t, f }) => { // golden: why did nobody check? question marks pop over the blank faces
    const at = [32.8, 33.3, 33.8];
    const spots: [number, number][] = [[-1.25, -17.3], [0, -16.9], [1.25, -17.4]];
    spots.forEach(([x, z], k) => {
      put(out, cam, t, { i: 10 + k, o: SOLDIER(k), x, z, expr: f < W(at[k]) ? "neutral" : "nervous", look: k === 0 ? 1 : -1, swaps: [at[k]] });
      const s2 = pop(f, W(at[k]));
      if (s2 > 0) fx(out, { key: "q", cw: 200, ch: 300, draw: (p) => fxQuestion(p) }, [x + 0.05, 2.3 + 0.04 * Math.sin(t * 5 + k), z], 0.36 * s2, 0.54 * s2, { rot: (k % 2 ? 0.2 : -0.2) });
    });
  },
  14: ({ out, cam, t, f }) => { // the uniform matters more than the man
    fx(out, { key: "uniform", cw: 600, ch: 1000, draw: fxUniform }, [-0.4, 0.95, -14], 1.14, 1.9);
    put(out, cam, t, { i: 10, o: SOLDIER(0), x: -1.7, z: -14.6, facing: 1, expr: "stern", wave: 0.35 });
    put(out, cam, t, { i: 11, o: SOLDIER(1), x: 0.9, z: -14.7, facing: -1, expr: "stern", wave: 0.35 });
    put(out, cam, t, { i: 1, o: VOIGT_CIV, x: 1.25, z: -12.7, facing: -1, expr: f < W(36.4) ? "neutral" : "sad", swaps: [36.4] });
  },
  15: ({ out, cam, t, f }) => { // shoulder boards make the captain
    burst(out, f, W(38.7), [0, 2.0, -14.3], 3.2, "#ffe58a", 18);
    put(out, cam, t, { i: 1, o: VOIGT, x: 0, z: -14, expr: f < W(38.7) ? "smug" : "grin", swaps: [38.7], headTilt: -4 });
  },
  16: ({ out, cam, t, f }) => { // caught
    const k = clamp01((f - W(41.28)) / 6);
    put(out, cam, t, { i: 1, o: VOIGT_CIV, x: -8, z: 6, expr: f < W(41.28) ? "smug" : "shock", swaps: [41.28], tilt: 3 * k });
    put(out, cam, t, { i: 30, o: POLICE(0), x: -8 - 1.25 + 0.35 * k, z: 5.7, facing: 1, expr: "stern", wave: f >= W(41.28) ? 0.2 : undefined });
    put(out, cam, t, { i: 31, o: POLICE(1), x: -8 + 1.25 - 0.35 * k, z: 5.6, facing: -1, expr: "stern", wave: f >= W(41.28) ? 0.2 : undefined });
    burst(out, f, W(41.28), [-8, 1.3, 6.1], 1.3, "#ffffff", 8);
    townsfolkAt(out, cam, t, 12, (x, z) => Math.hypot(x + 8, z - 6) < 4);
  },
  17: ({ out, cam, t }) => { // the Kaiser laughed
    const shake = Math.sin(t * 22) > 0 ? 3 : -3;
    put(out, cam, t, { i: 50, o: KAISER, x: 8, z: -10, expr: t < 43.1 ? "grin" : "laugh", swaps: [43.1], tilt: t < 43.1 ? 0 : shake, headTilt: t < 43.1 ? 0 : -6 });
    put(out, cam, t, { i: 51, o: SOLDIER(2), x: 9.3, z: -11.6, facing: -1, expr: "nervous" });
  },
  18: ({ out, cam, t, f }) => { // a star: crowd, camera flashes, postcards
    put(out, cam, t, { i: 1, o: VOIGT, x: 0, z: 0, expr: "grin", wave: 0.5 + 0.5 * Math.sin(t * 7) });
    for (let k = 0; k < 10; k++) {
      const a = Math.PI * (1.08 + 0.84 * (k / 9)), r = 2.2 + (k % 3) * 0.8; // an arc behind him
      put(out, cam, t, { i: 60 + k, o: FOLK[k % 6], x: Math.cos(a) * r, z: Math.sin(a) * r - 0.6, expr: (["grin", "laugh", "smile_closed", "shock"] as Expr[])[k % 4],
        wave: k % 2 ? 0.5 + 0.5 * Math.sin(t * 6 + k) : undefined });
    }
    for (const [ft, x, z] of [[46.4, -1.6, -3.2], [47.0, 1.7, -2.9], [47.5, -2.4, -1.4], [48.1, 2.2, -1.8], [48.6, 0.5, -3.8]] as const)
      burst(out, f, W(ft), [x, 2.1, z], 1.3, "#ffffff", 7);
    for (let k = 0; k < 5; k++) { // signed postcards fluttering
      const age = (t - 47.4 - k * 0.25);
      if (age < 0 || age > 2) continue;
      fx(out, { key: "card", cw: 240, ch: 140, draw: (p) => { p.poly([[10, 10], [230, 10], [230, 130], [10, 130]], "#fbf3dc", 7); p.stroke([[40, 90], [80, 60], [120, 95], [190, 55]], 7, "#1f3d8a"); } },
        [Math.sin(k * 2.1) * 1.2, 2.7 - 0.6 * age, Math.cos(k * 2.1) * 0.8], 0.3, 0.18, { rot: Math.sin(age * 5 + k) * 0.6 });
    }
  },
  19: ({ out, cam, t, f }) => { // the twist: a passport office that never was
    put(out, cam, t, { i: 1, o: VOIGT, x: -1.15, z: -22.2, facing: 1, expr: f < W(51.9) ? "smile" : f < W(53.2) ? "neutral" : "sad", swaps: [51.9, 53.2],
      look: f < W(51.9) ? 0 : 1 });
    const s = pop(f, W(52.1));
    fx(out, { key: "nopass", cw: 600, ch: 420, draw: fxNoPassport }, [0.15, 1.75, -23.3], 0.8 * Math.max(0.0001, s), 0.56 * Math.max(0.0001, s));
  },
};

export const stage = (id: number, t: number, cam: CamInfo): Stage => {
  const out: Stage = { places: [], fx: [] };
  prepLight(SHOTS[id - 1].light, cam);
  SHOT[id]?.({ out, cam, t, f: Math.round(t * FPS) });
  return out;
};
export const _keep = tmp;

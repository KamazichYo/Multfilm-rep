// "Капитан из Кёпеника": shot plan, cameras, lens blur, timed to voice/words.json (Piper voice, 54 s).
// World units are metres, ground at y = D0 = 0. The square: town hall on the north side (front at z = -24),
// yellow / blue houses on the other three sides, a fountain in the middle, a second-hand stall on the west side.
export const FPS = 30;
export const TOTAL = 1640;
export const D0 = 0;
export type V3 = [number, number, number];

export const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
export const smooth = (x: number) => { const u = clamp01(x); return u * u * (3 - 2 * u); };
export const glide = (u: number) => { const x = clamp01(u); return x * x * x * (x * (6 * x - 15) + 10); };
/** frame of a voice time (s), with the reference's 2-frame lead: reactions land just before the word */
export const W = (s: number) => Math.round(s * FPS) - 2;

export type Light = "day" | "golden";
export type ShotDef = { id: number; a: number; b: number; light: Light; sunAz?: number; sunEl?: number };
const cuts = [0, 147, 213, 313, 396, 463, 501, 603, 661, 717, 753, 835, 967, 1042, 1123, 1199, 1268, 1353, 1482, TOTAL];
const GOLD = new Set([13, 14, 15]);
export const SHOTS: ShotDef[] = cuts.slice(0, -1).map((a, i) => ({ id: i + 1, a, b: cuts[i + 1], light: GOLD.has(i + 1) ? "golden" : "day" }));
/** crossfade length (frames) INTO a shot: place / light changes */
export const XFADE: Record<number, number> = { 8: 10, 13: 8, 16: 8, 19: 8 };
export const FLASH_AT = 145;

export const shotAt = (f: number) => SHOTS.find((s) => f >= s.a && f < s.b) ?? SHOTS[SHOTS.length - 1];
export const layersAt = (f: number): { id: number; alpha: number }[] => {
  const s = shotAt(f), x = XFADE[s.id] ?? 0;
  if (x && f < s.a + x && s.id > 1) return [{ id: s.id - 1, alpha: 1 }, { id: s.id, alpha: smooth((f - s.a + 1) / (x + 1)) }];
  return [{ id: s.id, alpha: 1 }];
};

// ---------------- cameras ----------------
export type Cam = { pos: V3; look: V3; fov: number; roll: number };
const C = (pos: V3, look: V3, fov = 40, roll = 0): Cam => ({ pos, look, fov, roll });
const lerp3 = (a: V3, b: V3, k: number): V3 => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
const mixCam = (a: Cam, b: Cam, k: number): Cam => ({ pos: lerp3(a.pos, b.pos, k), look: lerp3(a.look, b.look, k), fov: a.fov + (b.fov - a.fov) * k, roll: a.roll + (b.roll - a.roll) * k });
/** creeping push-in toward the look point: rate per frame (reference: 0.15-0.35 %/f, punch words 0.6 %/f) */
const push = (c: Cam, n: number, rate: number): Cam => {
  const k = Math.min(0.45, n * rate);
  return { ...c, pos: lerp3(c.pos, c.look, k) };
};
type Key = { f: number; dur: number; to: Cam };
/** a shot = start camera, glides to later cameras (smootherstep), and a creep that never stops */
const shot = (start: Cam, keys: Key[], rate = 0.0022, punch: [number, number][] = []) => (f: number, a: number): Cam => {
  let c = start;
  for (const k of keys) if (f >= k.f) c = mixCam(c, k.to, glide((f - k.f) / k.dur));
  let n = (f - a) * rate;
  for (const [pf, pr] of punch) if (f > pf) n += Math.min(f - pf, 12) * pr;
  return push(c, 1, Math.min(0.45, n));
};

export const VX = -5.4, VZ = -6.2; // where Voigt stops the patrol
/** z of Voigt leading the column toward the lens (shot 7) */
export const voigtLeadZ = (t: number) => -14 + 1.45 * Math.max(0, t - 16.6);

// Characters are ~1.7 m tall, head centre ~1.45 m: close-ups look at ~1.3 m from ~1.5 m. The frame is 9:16, so the
// horizontal half-width is only ~0.2 x distance at fov 40: groups are staged in depth, not side by side.
const CAMS: Record<number, (f: number, a: number) => Cam> = {
  // 1 hook: low hero angle on the captain in front of the town hall gable
  1: shot(C([0.75, 0.7, -10.4], [0, 1.5, -14], 42, 0.05), [{ f: W(3.5), dur: 30, to: C([0.55, 0.8, -11.0], [0, 1.45, -14], 40, 0.06) }], 0.0018),
  // 2 Berlin 1906: aerial over the square, descending
  2: shot(C([20, 24, 30], [0, 0, -6], 44), [{ f: 150, dur: 60, to: C([11, 11, 21], [-4, 1.5, -2], 42) }], 0.001),
  // 3 Voigt, 57, broke: medium shot
  3: shot(C([-7.4, 1.5, 6.1], [-8, 1.2, 3], 38), [], 0.0026),
  // 4 the second-hand stall, the uniform comes together
  4: shot(C([-12.7, 1.6, 9.6], [-16.8, 1.15, 8.4], 40, -0.03), [{ f: W(12.6), dur: 26, to: C([-13.3, 1.5, 9.2], [-16.6, 1.25, 8.5], 38, -0.04) }], 0.0015),
  // 5 the patrol marches up, he stops it with a raised hand
  5: shot(C([-4.4, 1.75, -1.2], [-7, 1.25, -9], 42), [{ f: W(14.1), dur: 22, to: C([-4.6, 1.6, -2.2], [-6.6, 1.3, -9], 40) }], 0.0015),
  // 6 "Soldiers, follow me!" close-up, punch
  6: shot(C([VX + 0.5, 1.4, VZ + 2.8], [VX - 0.05, 1.38, VZ], 36, 0.07), [], 0.002, [[W(15.44), 0.006]]),
  // 7 they follow: the column marches at the lens, then the camera finds the blank faces
  7: (f, a) => {
    const t = f / FPS, z = voigtLeadZ(t);
    const wide = C([-1.7, 1.8, z + 6.6], [-3, 1.15, z - 1.5], 42);
    const faces = C([-0.4, 1.55, z + 1.4], [-3.0, 1.35, z - 3.2], 38, 0.04);
    return push(mixCam(wide, faces, glide((f - W(18.0)) / 34)), 1, (f - a) * 0.001);
  },
  // 8 to Köpenick: crane up from the square to the town hall tower, a little train puffs by
  8: shot(C([4, 2.2, 6], [3, 3, -8], 42), [{ f: 608, dur: 48, to: C([2.5, 5, -9], [0, 21, -27], 46) }], 0.0008),
  // 9 enters the town hall, arrests the mayor
  9: shot(C([0.1, 1.8, -14.6], [-0.15, 1.2, -22], 44), [], 0.0025, [[W(22.8), 0.0035]]),
  // 10 the mayor does not argue
  10: shot(C([1.5, 1.5, -19.2], [1.0, 1.3, -22.3], 36, -0.05), [], 0.0026),
  // 11 the treasurer opens the cash box
  11: shot(C([4.3, 2.5, -14.6], [4.4, 1.1, -19.9], 42), [{ f: W(26.5), dur: 20, to: C([4.4, 2.35, -15.5], [4.5, 1.15, -19.9], 40) }], 0.0015),
  // 12 the receipt on the table, then up to his grin
  12: shot(C([4.3, 2.05, -18.35], [4.25, 1.05, -19.4], 38, 0.03), [{ f: W(30.2), dur: 30, to: C([4.4, 1.5, -15.9], [3.4, 1.3, -18.6], 38, 0.05) }], 0.0015),
  // 13 golden: nobody checked? three blank soldiers, question marks
  13: shot(C([0, 1.6, -9.6], [0, 1.45, -17], 42), [], 0.0024),
  // 14 the uniform matters more than the man
  14: shot(C([0.3, 1.6, -7.2], [0.1, 1.2, -14], 46, 0.03), [{ f: W(36.2), dur: 24, to: C([0.6, 1.45, -8.0], [0.4, 1.15, -13.5], 44, 0.03) }], 0.0015),
  // 15 shoulder boards make you a captain: low hero CU, punch on "капитан"
  15: shot(C([0.25, 1.0, -11.0], [0, 1.45, -14], 36, -0.06), [], 0.0018, [[W(38.9), 0.006]]),
  // 16 caught ten days later
  16: shot(C([-7.6, 1.6, 11.5], [-8, 1.25, 6], 40, 0.04), [], 0.0024, [[W(41.28), 0.004]]),
  // 17 the Kaiser laughs
  17: shot(C([8.4, 1.45, -6.8], [8, 1.35, -10], 36, -0.04), [], 0.0026),
  // 18 a star: orbit in front of the crowd
  18: shot(C([-3.6, 2.0, 5.2], [0, 1.4, -0.6], 42), [{ f: 1356, dur: 120, to: C([3.2, 1.8, 4.6], [0, 1.4, -0.6], 38) }], 0.0008),
  // 19 the twist: he came for a passport
  19: shot(C([0.9, 1.6, -17.4], [-0.45, 1.55, -23.2], 40), [{ f: W(51.8), dur: 40, to: C([0.4, 1.65, -19.2], [-0.35, 1.7, -23.3], 36) }], 0.0016),
};

/** impact flip-shakes: sign flips every frame, decays over 7 f */
const KICKS = [W(15.44), W(22.8), W(26.6), W(41.28)];
export const kickAt = (f: number) => {
  for (const k of KICKS) { const n = f - k; if (n >= 0 && n < 7) return (n % 2 ? -1 : 1) * 0.022 * (1 - n / 7); }
  return 0;
};
export const camAt = (id: number, f: number): Cam => {
  const s = SHOTS[id - 1], c = CAMS[id](Math.max(s.a - 12, f), s.a), k = kickAt(f);
  return k ? { ...c, roll: c.roll + k, look: [c.look[0], c.look[1] + k * 2, c.look[2]] } : c;
};

// ---------------- lens blur (cInf px at 1080 wide), focus on the eyes ----------------
export type Dof = { cInf: number; focus?: V3 };
const DOFS: Record<number, Dof> = {
  1: { cInf: 13 }, 2: { cInf: 0 }, 3: { cInf: 10 }, 4: { cInf: 9 }, 5: { cInf: 5 }, 6: { cInf: 14 }, 7: { cInf: 8 }, 8: { cInf: 0 },
  9: { cInf: 8 }, 10: { cInf: 13 }, 11: { cInf: 10 }, 12: { cInf: 12 }, 13: { cInf: 9 }, 14: { cInf: 9 }, 15: { cInf: 14 },
  16: { cInf: 10 }, 17: { cInf: 13 }, 18: { cInf: 7 }, 19: { cInf: 9 },
};
export const dofAt = (f: number): Dof => DOFS[shotAt(f).id] ?? { cInf: 0 };

// Flat 2D effect / prop drawings for the Köpenick short (Pen API from toon.ts): question marks, coins, the cash box,
// the receipt, the empty uniform on a stand, the "no passports" sign, camera flash. All original drawings.
import { Pen, INK, rrect } from "./toon";
type P2 = [number, number];
const rad = (d: number) => (d * Math.PI) / 180;

/** bold "?" on a 200 x 300 canvas */
export const fxQuestion = (p: Pen, col = "#ffd84a") => {
  const g = p.g;
  g.lineCap = "round"; g.lineJoin = "round";
  const path = () => { g.beginPath(); g.moveTo(52, 92); g.bezierCurveTo(52, 30, 150, 22, 152, 88); g.bezierCurveTo(154, 140, 100, 140, 100, 196); };
  path(); g.strokeStyle = INK; g.lineWidth = 58; g.stroke();
  path(); g.strokeStyle = col; g.lineWidth = 34; g.stroke();
  p.ell(100, 258, 26, 26, col, 12);
};

/** gold coin (front) on a 160 x 160 canvas */
export const fxCoin = (p: Pen, spin: number) => {
  const w = 62 * Math.max(0.15, Math.abs(Math.cos(spin)));
  p.ell(80, 80, w, 62, "#f2c14e", 9);
  if (w > 30) p.ell(80, 80, w * 0.66, 40, null, 5);
};

/** paper money note on a 240 x 140 canvas */
export const fxNote = (p: Pen) => {
  p.poly(rrect(10, 10, 230, 130, 8), "#bfe0b0", 8);
  p.ell(120, 70, 30, 30, "#e6f3dc", 6);
  p.stroke([[40, 40], [80, 40]], 7, "#5f8f55"); p.stroke([[160, 100], [200, 100]], 7, "#5f8f55");
};

/** receipt on a 600 x 800 canvas: header lines, a big "4002", signature scribble growing with k (0..1) */
export const fxReceipt = (p: Pen, k: number) => {
  const g = p.g;
  p.poly(rrect(20, 20, 580, 780, 14), "#fbf3dc", 12);
  for (let i = 0; i < 4; i++) p.stroke([[80, 110 + i * 46], [i % 2 ? 420 : 520, 110 + i * 46]], 10, "#b9ab8c");
  // "4002" drawn as digits with strokes (no font: deterministic)
  const dig = (x: number, d: string) => {
    const S: Record<string, P2[][]> = {
      "4": [[[x + 50, 0], [x, 70], [x + 70, 70]], [[x + 50, 0], [x + 50, 110]]],
      "0": [],
      "2": [[[x + 5, 25], [x + 30, 0], [x + 60, 10], [x + 62, 40], [x, 110], [x + 70, 110]]],
    };
    if (d === "0") { g.beginPath(); g.ellipse(x + 35, 55, 30, 52, 0, 0, Math.PI * 2); g.strokeStyle = "#3a2a5a"; g.lineWidth = 14; g.stroke(); return; }
    for (const s of S[d]) p.stroke(s, 14, "#3a2a5a");
  };
  g.save(); g.translate(120, 340);
  ["4", "0", "0", "2"].forEach((d, i) => dig(i * 92, d));
  g.restore();
  p.stroke([[80, 520], [520, 520]], 6, "#b9ab8c");
  // signature: a looping scribble revealed left to right
  const pts: P2[] = [];
  const n = Math.max(2, Math.round(80 * k));
  for (let i = 0; i <= n; i++) {
    const u = i / 80;
    pts.push([110 + 380 * u, 640 - 40 * Math.sin(u * 22) * (0.6 + 0.4 * Math.sin(u * 5)) - 30 * u]);
  }
  p.stroke(pts, 9, "#1f3d8a");
  if (k > 0.98) p.stroke([[100, 700], [520, 680]], 7, "#1f3d8a");
};

/** iron-bound cash box, lid open by `open` (0..1), on a 500 x 400 canvas */
export const fxCashBox = (p: Pen, open: number) => {
  p.poly(rrect(60, 180, 440, 370, 16), "#7a4a2c", 12);
  p.stroke([[60, 240], [440, 240]], 14, INK);
  for (const x of [110, 250, 390]) p.dot(x, 300, 9, "#d9b04a");
  const ang = rad(-100 * open);
  const c = Math.cos(ang), s = Math.sin(ang), hx = 60, hy = 180;
  const R = (x: number, y: number): P2 => [hx + (x - hx) * c - (y - hy) * s, hy + (x - hx) * s + (y - hy) * c];
  if (open > 0.05) {
    p.poly([[70, 182], [430, 182], [420, 200], [80, 200]], "#2a1a12", 0);
    for (let i = 0; i < 6; i++) p.ell(110 + i * 55, 178, 26, 12, "#f2c14e", 6);
  }
  p.poly([R(60, 180), R(440, 180), R(440, 120), R(60, 120)], "#8d5a36", 12);
}

/** an empty Prussian captain's uniform on a wooden stand, on a 600 x 1000 canvas (soles at 975 like the cast) */
export const fxUniform = (p: Pen) => {
  p.stroke([[300, 975], [300, 240]], 22, INK); p.stroke([[300, 975], [300, 240]], 12, "#8a5a34");
  p.poly([[180, 975], [420, 975], [380, 940], [220, 940]], "#7a4a2c", 10);
  // coat
  const coat: P2[] = [[200, 330], [400, 330], [430, 380], [420, 720], [180, 720], [170, 380]];
  p.poly(coat, "#34467a", 12);
  p.poly([[200, 330], [250, 330], [300, 420], [350, 330], [400, 330], [380, 360], [300, 470], [220, 360]], "#c0353a", 8);
  for (let i = 0; i < 5; i++) { p.dot(300, 480 + i * 45, 13, INK); p.dot(300, 480 + i * 45, 9, "#e8c45a"); }
  p.stroke([[170, 390], [150, 660]], 34, INK); p.stroke([[170, 390], [150, 660]], 22, "#34467a");
  p.stroke([[430, 390], [450, 660]], 34, INK); p.stroke([[430, 390], [450, 660]], 22, "#34467a");
  for (const x of [176, 424]) p.poly(rrect(x - 40, 318, x + 40, 344, 8), "#e8c45a", 7); // shoulder boards
  p.band([[205, 640], [395, 640]], "#e9e2cf", 22, 5);
  // cap on top
  p.poly([[205, 245], [190, 205], [410, 205], [395, 245]], "#2a3550", 10);
  p.poly([[205, 245], [395, 245], [390, 270], [210, 270]], "#c0353a", 8);
  p.ell(300, 272, 95, 16, "#16141a", 8, 0, 180);
  p.ell(300, 256, 9, 9, "#e8c45a", 4);
  // halo of importance
  const g = p.g; g.save(); g.globalCompositeOperation = "destination-over";
  for (let i = 0; i < 12; i++) {
    const a = rad(i * 30);
    p.poly([[300 + 60 * Math.cos(a - 0.1), 470 + 60 * Math.sin(a - 0.1)], [300 + 300 * Math.cos(a), 470 + 300 * Math.sin(a)], [300 + 60 * Math.cos(a + 0.1), 470 + 60 * Math.sin(a + 0.1)]], "rgba(255,236,150,0.9)", 0);
  }
  g.restore();
};

/** door sign on a 600 x 420 canvas: a passport booklet under a red "no" ring (no text) */
export const fxNoPassport = (p: Pen) => {
  p.poly(rrect(14, 14, 586, 406, 30), "#f6ecd2", 12);
  p.poly(rrect(200, 70, 400, 350, 14), "#8c2f3a", 10);
  p.ell(300, 170, 42, 42, null, 9);
  p.stroke([[258, 170], [342, 170]], 6); p.stroke([[300, 128], [300, 212]], 6);
  p.stroke([[240, 270], [360, 270]], 8, "#e8c45a"); p.stroke([[255, 300], [345, 300]], 8, "#e8c45a");
  const g = p.g;
  g.beginPath(); g.ellipse(300, 210, 175, 175, 0, 0, Math.PI * 2); g.strokeStyle = "#ffffff"; g.lineWidth = 50; g.stroke();
  g.strokeStyle = "#d42f2f"; g.lineWidth = 34; g.stroke();
  p.stroke([[180, 330], [420, 90]], 50, "#ffffff"); p.stroke([[180, 330], [420, 90]], 34, "#d42f2f");
};

/** "1906" flag-free date plate: none (no captions) — instead a tiny steam train for the trip, 700 x 400 canvas */
export const fxTrain = (p: Pen, t: number) => {
  p.poly(rrect(60, 170, 420, 320, 20), "#2f6a43", 12);
  p.poly(rrect(300, 90, 440, 320, 14), "#2f6a43", 12);
  p.poly(rrect(320, 115, 420, 190, 8), "#bfe2ff", 8);
  p.poly(rrect(110, 110, 170, 175, 6), "#3a3d47", 10);
  p.poly(rrect(20, 260, 70, 300, 8), "#c0353a", 8);
  for (const [x, r] of [[130, 50], [250, 50], [380, 60]] as const) {
    p.ell(x, 330, r, r, "#3a3d47", 12);
    const a = t * 9;
    p.stroke([[x, 330], [x + r * 0.7 * Math.cos(a), 330 + r * 0.7 * Math.sin(a)]], 8, "#c9ccd2");
  }
  for (let i = 0; i < 3; i++) {
    const u = (t * 1.5 + i / 3) % 1;
    p.ell(140 - u * 120, 90 - u * 80, 30 + 40 * u, 26 + 30 * u, `rgba(240,240,245,${(1 - u).toFixed(2)})`, 0);
  }
};

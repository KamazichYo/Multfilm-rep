// The whole place as one three.js scene: sky, a cobbled Berlin square ringed by yellow / blue houses, the red-brick
// Köpenick town hall with its clock tower, a fountain, trees, the second-hand stall, the treasury table, and the cast.
// update(id, f, camera) poses everything for shot `id` at frame f (a pure function of id + f). Light rig, sky, fog and
// the camera-relative frozen sun are the skill's (bridge) world.ts, trimmed to what this short needs.
import * as THREE from "three";
import { Batch, boxGeo, V, lam, house, addVeg, clockTex, setSight, Ray, quad, tri, roofMat, Kit } from "./build";
import { ctex, cobbleHD, stoneHD, cloudHD, facadeHD, roofHD, rep, brick } from "./paint";
import { LIGHTS, LOOK, LightPreset } from "./lights";
import { TONE, CHAR, untone } from "./shade";
import { NOINK } from "./ink";
import { Pool, Actor, Fx, stage } from "./cast";
import { FPS, SHOTS, camAt, ShotDef } from "./story";

export const loadKit = async (): Promise<Kit> => ({}); // no external models: everything is drawn in code

const sightLines = (): Ray[] => {
  const out: Ray[] = [];
  for (const s of SHOTS) for (let f = s.a; f < s.b + 8; f += 3) {
    const c = camAt(s.id, f), o = V(...c.pos), look = V(...c.look);
    const fw = look.clone().sub(o), len = fw.length();
    fw.normalize();
    const rt = fw.clone().cross(V(0, 1, 0)).normalize(), up = rt.clone().cross(fw);
    out.push({ o, d: fw, len, core: true });
    for (const [a, b] of [[-0.3, 0], [0.3, 0], [0, 0.45], [-0.25, 0.4], [0.25, 0.4]]) {
      const d = fw.clone().addScaledVector(rt, a).addScaledVector(up, b).normalize();
      out.push({ o, d, len: len * 1.1, core: false });
    }
  }
  return out;
};

export class World {
  root = new THREE.Group();
  private pool = new Pool();
  private actors: Actor[] = [];
  private fxs: Fx[] = [];
  private hemi: THREE.HemisphereLight; private sun: THREE.DirectionalLight;
  private sky: THREE.Mesh; private skyMat: THREE.ShaderMaterial;
  private fog = new THREE.Fog("#bccbec", 25, 420);
  private sunCache = new Map<number, THREE.Vector3>();
  private cloudMaps: Record<"day" | "golden", THREE.Texture[]>;
  private clouds: THREE.Mesh[] = [];
  private water: THREE.Mesh;
  private frustum = new THREE.Frustum();
  private m4 = new THREE.Matrix4(); private v = new THREE.Vector3(); private sph = new THREE.Sphere();

  constructor(_kit: Kit) {
    const R = this.root;
    this.skyMat = new THREE.ShaderMaterial({
      uniforms: { c0: { value: new THREE.Color() }, c1: { value: new THREE.Color() }, c2: { value: new THREE.Color() },
        c3: { value: new THREE.Color() }, c4: { value: new THREE.Color() }, e: { value: new THREE.Vector4() } },
      vertexShader: "varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
      fragmentShader: `uniform vec3 c0, c1, c2, c3, c4; uniform vec4 e; varying vec3 vP;
        void main(){ float el = asin(clamp(normalize(vP).y, -1.0, 1.0));
          vec3 c = mix(c0, c1, smoothstep(0.0, e.x, el));
          c = mix(c, c2, smoothstep(e.x, e.y, el));
          c = mix(c, c3, smoothstep(e.y, e.z, el));
          c = mix(c, c4, smoothstep(e.z, e.w, el));
          gl_FragColor = vec4(c, 1.0); }`,
      side: THREE.BackSide, depthWrite: false, fog: false,
    });
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(1100, 48, 24), this.skyMat);
    this.sky.renderOrder = -1; this.sky.frustumCulled = false; this.sky.layers.set(NOINK);
    R.add(this.sky);
    this.hemi = new THREE.HemisphereLight("#cfe6ff", "#6c5c8c", 1.1);
    this.sun = new THREE.DirectionalLight("#fff0d6", 2.6);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    R.add(this.hemi, this.sun, this.sun.target);
    this.cloudMaps = { day: [0, 1, 2, 3].map((k) => cloudHD(k, LOOK.day.cloud)), golden: [0, 1, 2, 3].map((k) => cloudHD(k, LOOK.golden.cloud)) };
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 + 0.3, d = 560 + (i % 3) * 60;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: this.cloudMaps.day[i % 4], color: new THREE.Color(1.1, 1.1, 1.1), transparent: true, depthWrite: false, fog: false }));
      const w = 130 + (i % 4) * 30;
      m.position.set(Math.cos(a) * d, 110 + (i % 4) * 40, Math.sin(a) * d); m.scale.set(w, w / 2, 1);
      m.layers.set(NOINK);
      this.clouds.push(m); R.add(m);
    }

    setSight(sightLines());
    const b = new Batch();
    // ---- ground: cobbles everywhere, a pale stone pavement ring along the house fronts ----
    const cob = lam("cobbleHD", () => ({ map: cobbleHD() }));
    b.add(quadUp(-300, 300, -300, 300, 150, 150), cob);
    const pave = lam("paveHD", () => ({ map: stoneHD("paveHD", ["#d8cdb8", "#cfc3ad", "#e0d6c3", "#c7baa3"], "#a39584") }));
    for (const [x0, x1, z0, z1] of [[-26, 26, -26, -22.6], [-26, -22.6, -26, 26], [22.6, 26, -26, 26], [-26, 26, 22.6, 26]] as const)
      b.add(quadUp(x0, x1, z0, z1, (x1 - x0) / 2, (z1 - z0) / 2, 0.01), pave);

    // ---- houses around the square (fronts face the middle) ----
    let si = 0;
    const row = (pts: [number, number][], yaw: number, d = 8) => pts.forEach(([x, z], k) => {
      const w = k % 2 ? 7 : 8.5, h = [9.8, 8.4, 11.2, 9.8][(k + si) % 4];
      house(b, x, z, yaw, w, d, h, si++ % 8);
    });
    row([[-30, -18], [-30, -9.5], [-30, -1.5], [-30, 6.5], [-30, 15], [-30, 23]], Math.PI / 2);        // west, fronts at x = -26
    row([[30, -18], [30, -9.5], [30, -1.5], [30, 6.5], [30, 15], [30, 23]], -Math.PI / 2);             // east
    row([[-17, 30], [-8.5, 30], [0, 30], [8.5, 30], [17, 30]], Math.PI);                              // south
    row([[-20, -30], [20, -30]], 0);                                                                   // north, beside the town hall
    // second ring, taller, so every view has roofs behind roofs
    for (let k = 0; k < 16; k++) {
      const a = (k / 16) * Math.PI * 2, r = 52 + (k % 3) * 6;
      house(b, Math.cos(a) * r, Math.sin(a) * r, -a - Math.PI / 2, 9, 9, 12 + (k % 3) * 1.4, (k * 3) % 8);
    }

    // ---- Köpenick town hall: red-brick, stepped gables, clock tower ----
    const hallF = lam("hallF", () => ({ map: facadeHD("hallF", 24, 12, { wall: "#b5543c", shutter: "#3b3f52", brick: true, door: true }) }));
    const hallS = lam("hallS", () => ({ map: facadeHD("hallS", 10, 12, { wall: "#b5543c", shutter: "#3b3f52", brick: true }) }));
    const trim = lam("hallTrim", () => ({ color: "#efe3c8" }));
    const z0 = -24, z1 = -34, hx = 12, H = 12;
    b.add(quad(V(-hx, 0, z0), V(hx, 0, z0), V(hx, H, z0), V(-hx, H, z0)), hallF);
    b.add(quad(V(hx, 0, z1), V(-hx, 0, z1), V(-hx, H, z1), V(hx, H, z1)), hallF);
    b.add(quad(V(-hx, 0, z1), V(-hx, 0, z0), V(-hx, H, z0), V(-hx, H, z1)), hallS);
    b.add(quad(V(hx, 0, z0), V(hx, 0, z1), V(hx, H, z1), V(hx, H, z0)), hallS);
    const slate = roofMat("#8f97a8");
    b.add(quad(V(-hx - 0.4, H - 0.2, z0 + 0.4), V(hx + 0.4, H - 0.2, z0 + 0.4), V(hx + 0.4, H + 4.5, -29), V(-hx - 0.4, H + 4.5, -29), 6, 2), slate);
    b.add(quad(V(hx + 0.4, H - 0.2, z1 - 0.4), V(-hx - 0.4, H - 0.2, z1 - 0.4), V(-hx - 0.4, H + 4.5, -29), V(hx + 0.4, H + 4.5, -29), 6, 2), slate);
    b.add(tri(V(-hx, H, z1), V(-hx, H, z0), V(-hx, H + 4.5, -29)), hallS);
    b.add(tri(V(hx, H, z0), V(hx, H, z1), V(hx, H + 4.5, -29)), hallS);
    b.add(boxGeo(V(-hx - 0.15, H - 0.6, z0 - 0.1), V(hx + 0.15, H - 0.2, z0 + 0.25)), trim);
    b.add(boxGeo(V(-hx - 0.1, -0.05, z0 - 0.1), V(hx + 0.1, 0.55, z0 + 0.15), 2), lam("plinthHD", () => ({ map: stoneHD("copeHD") })));
    // stepped gables (Brandenburg brick gothic) over the entrance risalit
    const gb = lam("gableBrick", () => ({ map: rep(brick(), 2, 2) }));
    for (let s = 0; s < 5; s++) b.add(boxGeo(V(-4 + s * 0.8, H, z0 - 0.4), V(4 - s * 0.8, H + 1.0 + s * 1.0, z0 + 0.6), 2), gb);
    b.add(boxGeo(V(-4.2, 0, z0 - 0.2), V(4.2, H, z0 + 0.6), 3), gb);
    // entrance: arched door + steps
    const doorM = lam("hallDoor", () => ({ map: ctex("hallDoor", 256, 384, (g) => {
      g.fillStyle = "#efe3c8"; g.fillRect(0, 0, 256, 384);
      g.fillStyle = "#6a3a22"; g.beginPath(); g.moveTo(28, 384); g.lineTo(28, 130); g.arc(128, 130, 100, Math.PI, 0); g.lineTo(228, 384); g.fill();
      g.strokeStyle = "rgba(30,15,10,.6)"; g.lineWidth = 6; g.stroke();
      g.fillStyle = "rgba(30,15,10,.45)"; for (let x = 52; x < 220; x += 28) g.fillRect(x, 120, 4, 264);
      g.fillStyle = "#e8c45a"; g.beginPath(); g.arc(170, 260, 9, 0, 7); g.fill();
    }) }));
    b.add(quad(V(-1.15, 0, z0 + 0.62), V(1.15, 0, z0 + 0.62), V(1.15, 3.45, z0 + 0.62), V(-1.15, 3.45, z0 + 0.62)), doorM);
    for (let s = 0; s < 3; s++) b.add(boxGeo(V(-2.6 + s * 0.15, s * 0.14, z0 + 0.6), V(2.6 - s * 0.15, (s + 1) * 0.14, z0 + 1.5 - s * 0.3)), lam("stepsHD", () => ({ map: stoneHD("copeHD") })));
    // clock tower behind the gable
    const tw = lam("towerBrick", () => ({ map: rep(brick(), 1.5, 6) }));
    b.add(boxGeo(V(-2.6, H, -30.6), V(2.6, 27, -25.4), 3), tw);
    b.add(boxGeo(V(-2.9, 26.6, -30.9), V(2.9, 27.4, -25.1)), trim);
    const spire = new THREE.ConeGeometry(4.0, 10, 4, 1); spire.rotateY(Math.PI / 4);
    b.add(spire, lam("spireGreen", () => ({ color: "#5f9e8a" })), new THREE.Matrix4().makeTranslation(0, 32.4, -28));
    b.add(quad(V(-1.6, 21.2, -25.37), V(1.6, 21.2, -25.37), V(1.6, 24.4, -25.37), V(-1.6, 24.4, -25.37)), lam("clock", () => ({ map: clockTex(), alphaTest: 0.5 })));

    // ---- fountain in the middle ----
    const stoneM = lam("fountainHD", () => ({ map: stoneHD("fountainHD") }));
    b.add(new THREE.CylinderGeometry(3.2, 3.4, 0.7, 40, 1), stoneM, new THREE.Matrix4().makeTranslation(0, 0.35, 6));
    b.add(new THREE.CylinderGeometry(0.45, 0.6, 2.6, 20), stoneM, new THREE.Matrix4().makeTranslation(0, 1.3, 6));
    b.add(new THREE.CylinderGeometry(1.4, 0.4, 0.4, 28), stoneM, new THREE.Matrix4().makeTranslation(0, 2.6, 6));
    const waterM = lam("fountainWater", () => ({ color: "#4fb4e0" }));
    this.water = new THREE.Mesh(new THREE.CylinderGeometry(2.95, 2.95, 0.05, 40), waterM);
    this.water.position.set(0, 0.62, 6); R.add(this.water);

    // ---- trees and planters ----
    for (const [x, z, h, k] of [[-18, -18, 7.5, "round"], [18, -17, 8, "fat"], [17, 18, 7, "round"], [-18, 19, 7.5, "fat"], [-21, 3, 6, "round"], [21, -3, 6.5, "round"]] as const)
      addVeg(b, k, x, 0, z, h, x * 31 + z * 7, 0);
    for (const [x, z] of [[-6, -22], [6, -22]] as const) addVeg(b, "bush", x, 0, z, 1.3, x * 11 + z, 0);

    // ---- the second-hand stall (west side): table, awning, posts, goods ----
    const wood = lam("woodStall", () => ({ color: "#a8724a" })), cloth = lam("awning", () => ({ map: ctex("awning", 256, 64, (g) => {
      for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? "#f4efe2" : "#c8423a"; g.fillRect(i * 32, 0, 32, 64); }
    }) }));
    b.add(boxGeo(V(-18.9, 0.95, 6.6), V(-17.8, 1.05, 10.6)), wood);
    for (const [x, z] of [[-18.8, 6.7], [-18.8, 10.5], [-17.9, 6.7], [-17.9, 10.5]] as const) b.add(boxGeo(V(x - 0.05, 0, z - 0.05), V(x + 0.05, 0.95, z + 0.05)), wood);
    for (const z of [6.4, 10.8]) b.add(boxGeo(V(-20.3, 0, z - 0.06), V(-20.2, 2.9, z + 0.06)), wood);
    b.add(quad(V(-17.3, 2.4, 10.9), V(-17.3, 2.4, 6.3), V(-20.4, 2.95, 6.3), V(-20.4, 2.95, 10.9), 4, 1), cloth);
    for (const [z, c] of [[7.2, "#6a5a8a"], [8.0, "#c9a14a"], [9.0, "#3f6fb5"], [9.9, "#8a3b3b"]] as const)
      b.add(boxGeo(V(-18.7, 1.05, z - 0.3), V(-18.0, 1.05 + 0.18 + (z % 1) * 0.3, z + 0.3)), lam("good" + c, () => ({ color: c })));
    // ---- the treasury table at the town hall ----
    const tab = lam("tableWood", () => ({ color: "#9a6a3e" }));
    b.add(boxGeo(V(3.0, 0.98, -20.0), V(6.8, 1.08, -18.9)), tab);
    for (const [x, z] of [[3.1, -19.9], [6.7, -19.9], [3.1, -19.0], [6.7, -19.0]] as const) b.add(boxGeo(V(x - 0.05, 0, z - 0.05), V(x + 0.05, 0.98, z + 0.05)), tab);
    // lamp posts
    const iron = lam("ironPost", () => ({ color: "#2e3240" }));
    for (const [x, z] of [[-10, -21], [10, -21], [-21, -10], [21, 10], [-10, 21], [10, 21]] as const) {
      b.add(new THREE.CylinderGeometry(0.07, 0.11, 3.6, 8), iron, new THREE.Matrix4().makeTranslation(x, 1.8, z));
      b.add(boxGeo(V(x - 0.22, 3.6, z - 0.22), V(x + 0.22, 4.1, z + 0.22)), lam("lampGlass", () => ({ color: "#f7e6a8" })));
    }
    b.build(R);
    void roofHD; void FPS;
  }

  /** camera-relative sun, frozen per shot: the shot's mean view direction turned by az toward screen right, lifted by el */
  private shotSun(id: number, s: ShotDef, L: LightPreset) {
    let v = this.sunCache.get(id);
    if (v) return v;
    let fx = 0, fz = 0;
    for (let f = s.a; f < s.b; f += 3) {
      const c = camAt(id, f), x = c.look[0] - c.pos[0], z = c.look[2] - c.pos[2], n = Math.hypot(x, z) || 1;
      fx += x / n; fz += z / n;
    }
    const n = Math.hypot(fx, fz) || 1; fx /= n; fz /= n;
    const az = THREE.MathUtils.degToRad(s.sunAz ?? L.az), el = THREE.MathUtils.degToRad(s.sunEl ?? (s.light === "golden" ? 14 : L.el));
    const azz = s.light === "golden" ? THREE.MathUtils.degToRad(s.sunAz ?? 40) : az; // golden: side-back light, faces still read
    const hx = fx * Math.cos(azz) - fz * Math.sin(azz), hz = fz * Math.cos(azz) + fx * Math.sin(azz);
    v = new THREE.Vector3(hx * Math.cos(el), Math.sin(el), hz * Math.cos(el)).normalize();
    this.sunCache.set(id, v);
    return v;
  }

  private actor(i: number) { while (this.actors.length <= i) this.actors.push(new Actor(this.root)); return this.actors[i]; }
  private fx(i: number) { while (this.fxs.length <= i) this.fxs.push(new Fx(this.root)); return this.fxs[i]; }

  update(id: number, f: number, cam: THREE.PerspectiveCamera, scene: THREE.Scene) {
    const t = f / FPS, s = SHOTS[id - 1], L = LIGHTS[s.light];
    const c = camAt(id, f);
    cam.position.set(...c.pos); cam.up.set(0, 1, 0); cam.lookAt(...c.look); cam.rotateZ(c.roll);
    cam.fov = c.fov; cam.near = 0.2; cam.far = 1500; cam.updateProjectionMatrix(); cam.updateMatrixWorld();
    const focus = V(...c.look), dist = cam.position.distanceTo(focus);
    cam.layers.enable(NOINK);
    const K = LOOK[s.light], sunDir = this.shotSun(id, s, L);
    this.hemi.color.set(L.sky); this.hemi.groundColor.set(L.ground); this.hemi.intensity = L.hemiI;
    this.sun.color.set(L.sunCol); this.sun.intensity = L.sunI;
    const Rr = THREE.MathUtils.clamp(dist * 1.15 + 9, 14, 70);
    this.sun.position.copy(focus).addScaledVector(sunDir, 220); this.sun.target.position.copy(focus);
    const sc = this.sun.shadow.camera;
    sc.left = -Rr; sc.right = Rr; sc.top = Rr; sc.bottom = -Rr; sc.near = 20; sc.far = 480; sc.updateProjectionMatrix();
    this.sun.shadow.bias = L.bias; this.sun.shadow.normalBias = L.normalBias * (Rr / 12);
    TONE.uLitCol.value.set(...L.lit); TONE.uShadeCol.value.set(...L.shade); TONE.uShadeLift.value.set(...L.lift);
    TONE.uLambert.value = L.lambert; TONE.uSideK.value = L.sideK; TONE.uTerm.value = L.term; TONE.uBounce.value.set(...K.bounce); TONE.uSat.value = K.sat;
    CHAR.uCharTint.value.set(...L.charTint); CHAR.uCharShade.value = L.charShade; CHAR.uGrad.value = L.charGrad;
    CHAR.uBodyGrad.value = L.bodyGrad; CHAR.uSideTint.value.set(...L.sideTint);
    const su = this.skyMat.uniforms;
    K.sky.c.forEach((h, i) => untone(h, su["c" + i].value));
    const e = K.sky.e.map((deg) => THREE.MathUtils.degToRad(deg));
    su.e.value.set(e[1], e[2], e[3], e[4]);
    this.sky.position.copy(cam.position);
    untone(L.fog, this.fog.color); this.fog.near = L.fogNear; this.fog.far = L.fogFar;
    scene.fog = this.fog; scene.background = null;
    for (let i = 0; i < this.clouds.length; i++) {
      const m = this.clouds[i], mat = m.material as THREE.MeshBasicMaterial;
      m.lookAt(cam.position.x, m.position.y, cam.position.z);
      mat.map = this.cloudMaps[s.light][i % 4];
    }
    // ---- cast + effects ----
    const right = V(0, 0, 0).setFromMatrixColumn(cam.matrixWorld, 0);
    const st = stage(id, t, { pos: cam.position, right, sun: sunDir });
    this.frustum.setFromProjectionMatrix(this.m4.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse));
    let ai = 0;
    const used: Actor[] = [];
    for (const p of st.places) {
      const sc2 = p.scale ?? 1;
      if (!this.frustum.intersectsSphere(this.sph.set(this.v.set(p.x, p.y + 1.1 * sc2, p.z), 3.5))) continue;
      const a = this.actor(ai++);
      const [w, h, k] = p.size ?? [300, 500, 0.5];
      a.r = this.pool.req(p.key, w, h, k, p.draw);
      a.mesh.visible = true;
      a.mesh.position.set(p.x, p.y, p.z);
      a.mesh.rotation.set(0, p.yaw ?? Math.atan2(cam.position.x - p.x, cam.position.z - p.z), p.roll ?? 0);
      a.mesh.scale.set(p.mirror ? -sc2 : sc2, sc2, sc2);
      a.mesh.castShadow = L.actorShadow;
      used.push(a);
    }
    for (let i = ai; i < this.actors.length; i++) this.actors[i].mesh.visible = false;
    let fi = 0;
    const fused: Fx[] = [];
    for (const p of st.fx) {
      if (!this.frustum.intersectsSphere(this.sph.set(this.v.set(p.x, p.y, p.z), Math.max(p.w, p.h)))) continue;
      const e2 = this.fx(fi++);
      e2.r = this.pool.req(p.key, p.cw, p.ch, 1, p.draw);
      e2.use(!!p.soft);
      e2.mesh.visible = true;
      e2.mesh.position.set(p.x, p.y, p.z);
      if (p.flat) e2.mesh.rotation.set(-Math.PI / 2, 0, p.rot ?? 0);
      else { e2.mesh.quaternion.copy(cam.quaternion); e2.mesh.rotateZ(p.rot ?? 0); }
      e2.mesh.scale.set(p.w, p.h, 1);
      fused.push(e2);
    }
    for (let i = fi; i < this.fxs.length; i++) this.fxs[i].mesh.visible = false;
    this.pool.flush();
    for (const a of used) a.bind();
    for (const e2 of fused) e2.bind();
    return focus;
  }
}

function quadUp(x0: number, x1: number, z0: number, z1: number, u: number, v: number, dy = 0) {
  return quad(V(x0, dy, z1), V(x1, dy, z1), V(x1, dy, z0), V(x0, dy, z0), u, v);
}

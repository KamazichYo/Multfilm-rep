"""Original synthesized score + SFX for the Köpenick short, mixed under the voice.
usage: python make_audio.py <voice.wav> <out_mix.wav> [duration_s]
Score: a cheeky oom-pah march (tuba on 1 and 3, off-beat chords, glockenspiel tune), 116 bpm, F major; it turns to a
hushed minor pizzicato for the "why did nobody check?" beat (32.2-39.9 s) and back. Ducked ~9 dB under speech.
SFX: footsteps for the marches, pops for the outfit swaps, a hit on each impact kick, coins, pen scratch, camera flashes.
All sounds are generated here from oscillators and noise (no samples)."""
import sys, subprocess, numpy as np

SR = 48000
voice_path, out_path = sys.argv[1], sys.argv[2]
DUR = float(sys.argv[3]) if len(sys.argv) > 3 else 1640 / 30
N = int(DUR * SR)
rng = np.random.default_rng(7)

def load(path):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-ac", "1", "-ar", str(SR), "-f", "f32le", "-"], capture_output=True).stdout
    return np.frombuffer(raw, np.float32).astype(np.float64)

def env(n, a=0.005, d=0.2, s=0.0, r=0.05, hold=None):
    t = np.arange(n) / SR
    e = np.minimum(1, t / max(a, 1e-4))
    dec = s + (1 - s) * np.exp(-(t - a) / max(d, 1e-4))
    e = np.where(t < a, e, dec)
    if hold is not None:
        e *= np.clip((hold + r - t) / r, 0, 1)
    return e

def add(buf, x, at):
    i = int(at * SR)
    if i >= len(buf) or i + len(x) <= 0: return
    j = min(len(buf), i + len(x)); buf[max(0, i):j] += x[max(0, -i):j - i]

def tone(f, dur, kind="sine", **ek):
    n = int(dur * SR); t = np.arange(n) / SR
    if kind == "sine": w = np.sin(2 * np.pi * f * t)
    elif kind == "tri": w = 2 / np.pi * np.arcsin(np.sin(2 * np.pi * f * t))
    elif kind == "brass": w = sum(np.sin(2 * np.pi * f * k * t) / k ** 1.3 for k in range(1, 7))
    elif kind == "bell": w = np.sin(2 * np.pi * f * t) + 0.4 * np.sin(2 * np.pi * f * 2.76 * t) * np.exp(-t * 6) + 0.2 * np.sin(2 * np.pi * f * 5.4 * t) * np.exp(-t * 12)
    elif kind == "pluck":  # Karplus-Strong-ish via decaying harmonics
        w = sum(np.sin(2 * np.pi * f * k * t) * np.exp(-t * (3 + 4 * k)) / k for k in range(1, 8))
    return w * env(n, **ek)

def lp(x, a=0.15):
    y = np.empty_like(x); acc = 0.0
    for i, v in enumerate(x): acc += a * (v - acc); y[i] = acc
    return y

def noise(dur): return rng.standard_normal(int(dur * SR))
def mtof(m): return 440 * 2 ** ((m - 69) / 12)

# ---------------- music ----------------
music = np.zeros(N)
BPM = 116; beat = 60 / BPM; bar = 4 * beat
MINOR = (32.2, 39.9)
# F major progression (I I V V | I IV V I), roots for tuba; chords as midi triads
prog = [("F", 41, [65, 69, 72]), ("F", 41, [65, 69, 72]), ("C", 36, [64, 67, 72]), ("C", 36, [64, 67, 70]),
        ("F", 41, [65, 69, 72]), ("Bb", 46, [65, 70, 74]), ("C", 36, [64, 67, 70]), ("F", 41, [65, 69, 72])]
prog_min = [("Dm", 38, [62, 65, 69]), ("A", 45, [61, 64, 69]), ("Dm", 38, [62, 65, 69]), ("A", 45, [61, 64, 69])]
tune = [72, 74, 76, 77, 79, 77, 76, 74, 72, 76, 79, 84, 81, 79, 77, 76, 74, 76, 77, 74, 72, 71, 72, 72, 77, 76, 74, 72, 70, 69, 67, 65]
t0, k = 0.15, 0
while t0 < DUR - 0.5:
    minor = MINOR[0] - 0.3 <= t0 < MINOR[1]
    name, root, ch = (prog_min[k % 4] if minor else prog[k % 8])
    for b in range(4):
        tb = t0 + b * beat
        if tb > DUR - 0.3: break
        if minor:  # hushed pizzicato bass + tick
            if b % 2 == 0: add(music, 0.35 * tone(mtof(root + 12), 0.4, "pluck"), tb)
            add(music, 0.12 * tone(mtof(ch[b % 3] + 12), 0.25, "pluck"), tb + beat / 2)
        else:
            if b % 2 == 0: add(music, 0.42 * lp(tone(mtof(root - (0 if b == 0 else 7)), beat * 0.8, "brass", a=0.01, d=0.25, s=0.3, r=0.05, hold=beat * 0.7), 0.12), tb)
            else:
                for m in ch: add(music, 0.09 * lp(tone(mtof(m - 12), beat * 0.45, "brass", a=0.005, d=0.08, s=0.2, r=0.03, hold=beat * 0.35), 0.3), tb)
            # glockenspiel tune: 2 notes per beat on even bars
            if k % 2 == 0:
                for h in range(2):
                    note = tune[(k * 4 + b * 2 + h) % len(tune)]
                    add(music, 0.10 * tone(mtof(note + 12), 0.5, "bell", a=0.002, d=0.25), tb + h * beat / 2)
            # snare brush on 2 and 4
            if b % 2 == 1: add(music, 0.05 * lp(noise(0.12), 0.6) * env(int(0.12 * SR), d=0.04), tb)
    t0 += bar; k += 1
# tail: final "ta-da" chord on the last word
for m in [65, 69, 72, 77]: add(music, 0.10 * tone(mtof(m), 1.6, "brass", a=0.01, d=0.6, s=0.0), DUR - 1.7)

# ---------------- SFX ----------------
sfx = np.zeros(N)
def step(at, g=0.25):
    x = lp(noise(0.07), 0.25) * env(int(0.07 * SR), a=0.001, d=0.018); add(sfx, g * x, at)
    add(sfx, g * 0.8 * tone(70, 0.08, a=0.001, d=0.03), at)
def pop(at, g=0.4):
    n = int(0.12 * SR); t = np.arange(n) / SR
    add(sfx, g * np.sin(2 * np.pi * (300 + 1400 * t / 0.12) * t) * env(n, a=0.002, d=0.04), at)
    add(sfx, g * 0.4 * lp(noise(0.25), 0.08) * env(int(0.25 * SR), d=0.1), at)
def hit(at, g=0.5):
    add(sfx, g * tone(55, 0.35, a=0.001, d=0.12), at)
    add(sfx, g * 0.5 * lp(noise(0.2), 0.3) * env(int(0.2 * SR), a=0.001, d=0.05), at)
def coin(at, g=0.18):
    for j in range(6): add(sfx, g * tone(2600 + 900 * rng.random(), 0.25, "bell", a=0.001, d=0.08), at + j * 0.07 + 0.03 * rng.random())
def flash(at, g=0.25):
    add(sfx, g * lp(noise(0.03), 0.9) * env(int(0.03 * SR), a=0.0005, d=0.006), at)
    n = int(0.5 * SR); t = np.arange(n) / SR
    add(sfx, g * 0.25 * np.sin(2 * np.pi * (3000 + 2000 * t) * t) * env(n, a=0.05, d=0.2), at + 0.02)
def scratch(at, dur, g=0.06):
    x = lp(noise(dur), 0.5) * (0.5 + 0.5 * np.abs(np.sin(2 * np.pi * 7 * np.arange(int(dur * SR)) / SR)))
    add(sfx, g * x, at)
def boing(at, g=0.18):
    n = int(0.35 * SR); t = np.arange(n) / SR
    f = 380 + 120 * np.sin(2 * np.pi * 9 * t) * np.exp(-t * 6)
    add(sfx, g * np.sin(2 * np.pi * np.cumsum(f) / SR) * env(n, a=0.003, d=0.15), at)
def whoosh(at, g=0.12, dur=0.5):
    n = int(dur * SR); x = noise(dur); y = np.zeros(n); acc = 0
    for i in range(n): a = 0.02 + 0.3 * np.sin(np.pi * i / n) ** 2; acc += a * (x[i] - acc); y[i] = acc
    add(sfx, g * y * np.sin(np.pi * np.arange(n) / n), at)

for tt in np.arange(13.25, 14.75, 0.5): step(tt, 0.22)        # patrol marching
for tt in np.arange(16.65, 20.1, 0.5): step(tt, 0.25)         # following him
pop(11.35); pop(12.05)                                         # cap, coat
hit(15.40, 0.35); hit(22.75); hit(26.55, 0.35); hit(41.23)     # impact kicks
whoosh(20.05, 0.07, 0.7)                                       # crane to Köpenick
for tt in np.arange(20.3, 22.0, 0.32): step(tt, 0.08)          # little train chuffs
coin(26.6); coin(26.9)
scratch(29.7, 1.4, 0.025)
for tt in [32.75, 33.25, 33.75]: boing(tt)                     # question marks
whoosh(38.6, 0.08, 0.6)                                        # captain reveal
for tt in [46.35, 46.95, 47.45, 48.05, 48.55]: flash(tt)
pop(52.05, 0.3)                                                # the sign

# ---------------- mix ----------------
voice = load(voice_path); v = np.zeros(N); v[:min(N, len(voice))] = voice[:N]
# duck music under speech: envelope follower on the voice
ve = np.abs(v); fol = np.zeros(N); acc = 0.0
att, rel = np.exp(-1 / (0.01 * SR)), np.exp(-1 / (0.25 * SR))
for i in range(0, N, 48):
    x = ve[i:i + 48].max(); acc = att * acc + (1 - att) * x if x > acc else rel * acc + (1 - rel) * x; fol[i:i + 48] = acc
duck = 1 - 0.65 * np.clip(fol / 0.15, 0, 1)
mix = v + 0.55 * music * duck + 0.8 * sfx
mix /= max(1.0, np.abs(mix).max() / 0.95)
subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "f64le", "-ar", str(SR), "-ac", "1", "-i", "-", "-af", "loudnorm=I=-14:TP=-1.5:LRA=7", "-ar", str(SR), out_path],
               input=mix.astype(np.float64).tobytes(), check=True)
print("wrote", out_path, f"{DUR:.2f}s")

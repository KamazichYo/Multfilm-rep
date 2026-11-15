# usage: python scripts/contact.py <dir with element-*.jpg> <out.jpg> [cols]  -> grid with frame numbers
import sys, os, re
from PIL import Image, ImageDraw
d, out = sys.argv[1], sys.argv[2]; cols = int(sys.argv[3]) if len(sys.argv) > 3 else 8
fs = sorted([f for f in os.listdir(d) if f.endswith((".jpg", ".jpeg", ".png"))], key=lambda f: int(re.findall(r"\d+", f)[-1]))
ims = [Image.open(os.path.join(d, f)).convert("RGB") for f in fs]
w, h = ims[0].size; rows = (len(ims) + cols - 1) // cols
S = Image.new("RGB", (cols * w, rows * h), "black"); dr = ImageDraw.Draw(S)
for i, (f, im) in enumerate(zip(fs, ims)):
    x, y = (i % cols) * w, (i // cols) * h; S.paste(im, (x, y)); dr.text((x + 4, y + 4), re.findall(r"\d+", f)[-1], fill="yellow")
S.save(out, quality=85); print(out, S.size)

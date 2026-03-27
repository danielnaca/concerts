"""
Extract dominant color from each artist's Spotify image.
Writes `dominantColor` (hex) back into shows.json per artist.

Algorithm:
1. Download the small (64px) artist image
2. Resize to 50x50, quantize to 8 color buckets (median cut)
3. Skip near-black / near-white / near-grey buckets
4. Pick the most prominent surviving color
5. Mute it: clamp saturation to 25-40%, lightness to 35-50%
   → tiles feel cohesive but each artist has a distinct hue
"""

import json, io, colorsys, time, requests
from PIL import Image

SHOWS_PATH = "/Users/danielnacamuli/Github/concerts/public/data/shows.json"

# Target aesthetic range (tweak these to taste)
TARGET_SAT   = (0.25, 0.42)   # muted, not grey
TARGET_LIGHT = (0.33, 0.50)   # mid-dark, readable


def hls(r, g, b):
    """RGB 0-255 → HLS 0-1 (Python colorsys order)."""
    return colorsys.rgb_to_hls(r / 255, g / 255, b / 255)


def from_hls(h, l, s):
    """HLS 0-1 → hex string."""
    r, g, b = colorsys.hls_to_rgb(h, l, s)
    return "#{:02x}{:02x}{:02x}".format(int(r * 255), int(g * 255), int(b * 255))


def clamp(val, lo, hi):
    return max(lo, min(hi, val))


def extract(url: str) -> str | None:
    try:
        r = requests.get(url, timeout=6)
        r.raise_for_status()
    except Exception:
        return None

    img = Image.open(io.BytesIO(r.content)).convert("RGB").resize((50, 50))

    # Quantize to 8 buckets
    q = img.quantize(colors=8, method=Image.Quantize.MEDIANCUT)
    palette = q.getpalette()          # flat [r,g,b, r,g,b, ...]
    pixels = list(q.getdata())
    counts = {}
    for px in pixels:
        counts[px] = counts.get(px, 0) + 1

    candidates = []
    for idx, count in sorted(counts.items(), key=lambda x: -x[1]):
        rv, gv, bv = palette[idx * 3], palette[idx * 3 + 1], palette[idx * 3 + 2]
        h, l, s = hls(rv, gv, bv)
        # Skip near-black, near-white, and near-grey
        if l < 0.12 or l > 0.88 or s < 0.08:
            continue
        candidates.append((count, h, l, s))

    if not candidates:
        return None

    # Take the most frequent surviving color
    _, h, l, s = candidates[0]

    # Mute it into target aesthetic range
    s_out = clamp(s * 0.7, *TARGET_SAT)
    l_out = clamp(l * 0.8, *TARGET_LIGHT)

    return from_hls(h, l_out, s_out)


def main():
    with open(SHOWS_PATH) as f:
        data = json.load(f)

    total = sum(len(c["artists"]) for c in data["concerts"])
    done  = 0

    for concert in data["concerts"]:
        for artist in concert["artists"]:
            done += 1
            # Use the already-in-JSON small image URL
            img_url = artist.get("images", {}).get("small") or \
                      artist.get("images", {}).get("medium") or \
                      artist.get("images", {}).get("large")

            if not img_url:
                print(f"  [{done}/{total}] {artist['name']} — no image, skipping")
                continue

            color = extract(img_url)
            if color:
                artist["dominantColor"] = color
                print(f"  [{done}/{total}] {artist['name']} → {color}")
            else:
                print(f"  [{done}/{total}] {artist['name']} — could not extract, skipping")

            time.sleep(0.05)

    with open(SHOWS_PATH, "w") as f:
        json.dump(data, f, indent=2)

    enriched = sum(
        1 for c in data["concerts"] for a in c["artists"] if a.get("dominantColor")
    )
    print(f"\nDone. {enriched}/{total} artists have a dominantColor.")


if __name__ == "__main__":
    main()

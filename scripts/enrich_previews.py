import json
import requests
import time

def itunes_preview(artist_name, track_name=None):
    query = f"{artist_name} {track_name}" if track_name else artist_name
    for attempt in range(4):
        r = requests.get(
            "https://itunes.apple.com/search",
            params={"term": query, "media": "music", "entity": "song", "limit": 10},
        )
        if r.status_code in (429, 403):
            wait = 8 * (attempt + 1)
            print(f"    rate limited ({r.status_code}), waiting {wait}s...")
            time.sleep(wait)
            continue
        r.raise_for_status()
        break
    else:
        return None
    try:
        results = r.json().get("results", [])
    except Exception:
        return None

    # prefer a result where the artist name matches closely
    name_lower = artist_name.lower()
    for result in results:
        if name_lower in result.get("artistName", "").lower() and result.get("previewUrl"):
            return result
    # fallback: any result with a preview
    for result in results:
        if result.get("previewUrl"):
            return result
    return None


def main():
    path = "/Users/danielnacamuli/Github/concerts/public/data/shows.json"
    with open(path) as f:
        data = json.load(f)

    total = sum(len(c["artists"]) for c in data["concerts"])
    enriched = 0
    found = 0

    for concert in data["concerts"]:
        print(f"{concert['date']} — {concert['genre']} @ {concert['venue']}")
        for artist in concert["artists"]:
            # skip if already enriched
            if (artist.get("previewTrack") or {}).get("previewUrl"):
                found += 1
                enriched += 1
                print(f"  – {artist['name']} already has preview, skipping")
                continue

            track_name = (artist.get("previewTrack") or {}).get("name")
            result = itunes_preview(artist["name"], track_name)
            enriched += 1

            if result and result.get("previewUrl"):
                found += 1
                # backfill previewUrl and also grab iTunes album art as fallback
                if not artist.get("previewTrack"):
                    artist["previewTrack"] = {}
                artist["previewTrack"]["previewUrl"] = result["previewUrl"]
                artist["previewTrack"]["itunesPreviewUrl"] = result["previewUrl"]
                # store iTunes artwork too (higher res version: replace 100x100 with 600x600)
                artwork = result.get("artworkUrl100", "").replace("100x100", "600x600")
                artist["previewTrack"]["itunesAlbumArt"] = artwork
                artist["previewTrack"]["itunesTrackName"] = result.get("trackName")
                artist["previewTrack"]["itunesArtistName"] = result.get("artistName")
                print(f"  ✓ {artist['name']} → \"{result.get('trackName')}\"")
            else:
                print(f"  ✗ {artist['name']} — no preview found")

            time.sleep(0.4)

        # save after each concert in case of interruption
        with open(path, "w") as f:
            json.dump(data, f, indent=2)

    with open(path, "w") as f:
        json.dump(data, f, indent=2)

    print(f"\nDone. {found}/{enriched} artists have preview URLs.")


if __name__ == "__main__":
    main()

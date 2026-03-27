import json
import requests
import time

def itunes_tracks(artist_name, limit=5):
    """Fetch up to `limit` tracks with preview URLs for an artist."""
    for attempt in range(4):
        r = requests.get(
            "https://itunes.apple.com/search",
            params={"term": artist_name, "media": "music", "entity": "song", "limit": 50},
        )
        if r.status_code in (429, 403):
            wait = 10 * (attempt + 1)
            print(f"    rate limited ({r.status_code}), waiting {wait}s...")
            time.sleep(wait)
            continue
        r.raise_for_status()
        break
    else:
        return []

    try:
        results = r.json().get("results", [])
    except Exception:
        return []

    name_lower = artist_name.lower()
    # only keep tracks where the artist name roughly matches
    own = [
        r for r in results
        if name_lower in r.get("artistName", "").lower() and r.get("previewUrl")
    ]

    # deduplicate by track name
    seen = set()
    unique = []
    for t in own:
        key = t.get("trackName", "").lower()
        if key not in seen:
            seen.add(key)
            unique.append(t)

    tracks = unique[:limit]

    return [
        {
            "id":            t.get("trackId"),
            "name":          t.get("trackName"),
            "previewUrl":    t.get("previewUrl"),
            "albumName":     t.get("collectionName"),
            "albumArt":      (t.get("artworkUrl100") or "").replace("100x100", "600x600"),
            "durationMs":    t.get("trackTimeMillis"),
            "spotifyUrl":    None,  # not available from iTunes
        }
        for t in tracks
    ]


def main():
    path = "/Users/danielnacamuli/Github/concerts/public/data/shows.json"
    with open(path) as f:
        data = json.load(f)

    total_artists = sum(len(c["artists"]) for c in data["concerts"])
    processed = 0

    for concert in data["concerts"]:
        print(f"{concert['date']} — {concert['genre']} @ {concert['venue']}")
        for artist in concert["artists"]:
            processed += 1
            print(f"  [{processed}/{total_artists}] {artist['name']}...", end=" ", flush=True)

            tracks = itunes_tracks(artist["name"], limit=5)
            artist["tracks"] = tracks
            print(f"{len(tracks)} tracks")

            time.sleep(0.5)

        # save after each concert
        with open(path, "w") as f:
            json.dump(data, f, indent=2)

    print(f"\nDone.")


if __name__ == "__main__":
    main()

import json
import requests
import base64
import time
import os
from datetime import date, timedelta

CLIENT_ID = os.environ["SPOTIFY_CLIENT_ID"]
CLIENT_SECRET = os.environ["SPOTIFY_CLIENT_SECRET"]

CONCERTS_TEMPLATE = [
    {"genre": "Indie Rock",  "color": "#8B5CF6", "artists": ["Arctic Monkeys", "Tame Impala", "The Strokes"]},
    {"genre": "Hip-Hop",     "color": "#EF4444", "artists": ["Kendrick Lamar", "Tyler the Creator", "Vince Staples", "Isaiah Rashad"]},
    {"genre": "Jazz",        "color": "#F59E0B", "artists": ["Kamasi Washington", "Thundercat", "Robert Glasper", "Nubya Garcia"]},
    {"genre": "Electronic",  "color": "#06B6D4", "artists": ["Four Tet", "Floating Points", "Caribou"]},
    {"genre": "Folk",        "color": "#84CC16", "artists": ["Phoebe Bridgers", "Iron & Wine", "Fleet Foxes", "Bon Iver"]},
    {"genre": "R&B",         "color": "#EC4899", "artists": ["SZA", "Steve Lacy", "Blood Orange", "Moses Sumney"]},
    {"genre": "Punk",        "color": "#F97316", "artists": ["IDLES", "Shame", "Fontaines D.C.", "Amyl and the Sniffers"]},
    {"genre": "Ambient",     "color": "#6366F1", "artists": ["Brian Eno", "Grouper", "Tim Hecker", "Julianna Barwick"]},
    {"genre": "Indie Rock",  "color": "#8B5CF6", "artists": ["Vampire Weekend", "Mac DeMarco", "Beach House", "Alvvays"]},
    {"genre": "Hip-Hop",     "color": "#EF4444", "artists": ["J. Cole", "Joey Bada$$", "Freddie Gibbs", "Conway the Machine"]},
    {"genre": "Jazz",        "color": "#F59E0B", "artists": ["Makaya McCraven", "Ambrose Akinmusire", "Brandee Younger"]},
    {"genre": "Electronic",  "color": "#06B6D4", "artists": ["Jon Hopkins", "Nicolas Jaar", "Bonobo"]},
    {"genre": "Folk",        "color": "#84CC16", "artists": ["Angel Olsen", "Hand Habits", "Waxahatchee", "Great Lake Swimmers"]},
    {"genre": "R&B",         "color": "#EC4899", "artists": ["Frank Ocean", "Syd", "Orion Sun", "Serpentwithfeet"]},
    {"genre": "Punk",        "color": "#F97316", "artists": ["Bob Mould", "Sleater-Kinney", "Parquet Courts", "Protomartyr"]},
    {"genre": "Ambient",     "color": "#6366F1", "artists": ["Stars of the Lid", "William Basinski", "Arca"]},
    {"genre": "Indie Rock",  "color": "#8B5CF6", "artists": ["Car Seat Headrest", "Snail Mail", "Soccer Mommy", "Palehound"]},
    {"genre": "Hip-Hop",     "color": "#EF4444", "artists": ["JPEGMAFIA", "billy woods", "Open Mike Eagle", "Quelle Chris"]},
    {"genre": "Jazz",        "color": "#F59E0B", "artists": ["Esperanza Spalding", "Cecile McLorin Salvant", "Mary Halvorson"]},
    {"genre": "Electronic",  "color": "#06B6D4", "artists": ["Andy Stott", "Lee Gamble", "Special Request"]},
    {"genre": "Folk",        "color": "#84CC16", "artists": ["Adrianne Lenker", "Bill Callahan", "Bonnie Prince Billy"]},
    {"genre": "R&B",         "color": "#EC4899", "artists": ["Amaarae", "Arlo Parks", "Raveena", "Faye Webster"]},
    {"genre": "Punk",        "color": "#F97316", "artists": ["Bikini Kill", "Downtown Boys", "Mannequin Pussy", "Metz"]},
    {"genre": "Ambient",     "color": "#6366F1", "artists": ["Rafael Anton Irisarri", "Caterina Barbieri", "Kali Malone"]},
    {"genre": "Indie Rock",  "color": "#8B5CF6", "artists": ["The National", "Big Thief", "Mitski", "Japanese Breakfast"]},
    {"genre": "Hip-Hop",     "color": "#EF4444", "artists": ["Black Thought", "Armand Hammer", "billy woods", "Mach-Hommy"]},
    {"genre": "Jazz",        "color": "#F59E0B", "artists": ["Henry Threadgill", "Matana Roberts", "Shabaka Hutchings"]},
    {"genre": "Electronic",  "color": "#06B6D4", "artists": ["Actress", "Burial", "Shackleton", "Perc"]},
    {"genre": "Folk",        "color": "#84CC16", "artists": ["Joanna Newsom", "Julia Holter", "Weyes Blood"]},
    {"genre": "R&B",         "color": "#EC4899", "artists": ["Jazmine Sullivan", "Lucky Daye", "Giveon", "PJ Morton"]},
]

VENUES = [
    {"name": "The Fillmore",              "address": "1805 Geary Blvd, San Francisco, CA 94115"},
    {"name": "Great American Music Hall", "address": "859 O'Farrell St, San Francisco, CA 94109"},
    {"name": "The Independent",           "address": "628 Divisadero St, San Francisco, CA 94117"},
    {"name": "Bottom of the Hill",        "address": "1233 17th St, San Francisco, CA 94107"},
    {"name": "The Chapel",                "address": "777 Valencia St, San Francisco, CA 94110"},
    {"name": "August Hall",               "address": "420 Mason St, San Francisco, CA 94102"},
    {"name": "Bimbo's 365 Club",          "address": "1025 Columbus Ave, San Francisco, CA 94133"},
    {"name": "The Warfield",              "address": "982 Market St, San Francisco, CA 94102"},
    {"name": "Cafe Du Nord",              "address": "2170 Market St, San Francisco, CA 94114"},
    {"name": "Rickshaw Stop",             "address": "155 Fell St, San Francisco, CA 94102"},
]


def get_token():
    credentials = base64.b64encode(f"{CLIENT_ID}:{CLIENT_SECRET}".encode()).decode()
    r = requests.post(
        "https://accounts.spotify.com/api/token",
        headers={"Authorization": f"Basic {credentials}"},
        data={"grant_type": "client_credentials"},
    )
    r.raise_for_status()
    return r.json()["access_token"]


def search_artist(token, name):
    r = requests.get(
        "https://api.spotify.com/v1/search",
        headers={"Authorization": f"Bearer {token}"},
        params={"q": name, "type": "artist", "limit": 1},
    )
    r.raise_for_status()
    items = r.json().get("artists", {}).get("items", [])
    return items[0] if items else None


def get_track_with_preview(token, artist_id, artist_name):
    # Search for tracks by this artist and prefer ones with a preview_url
    r = requests.get(
        "https://api.spotify.com/v1/search",
        headers={"Authorization": f"Bearer {token}"},
        params={"q": artist_name, "type": "track", "limit": 10},
    )
    r.raise_for_status()
    tracks = r.json().get("tracks", {}).get("items", [])
    # Only keep tracks where this is actually the main artist
    own = [t for t in tracks if any(a["id"] == artist_id for a in t.get("artists", []))]
    # Prefer tracks with a preview URL
    for t in own:
        if t.get("preview_url"):
            return t
    # Fall back to any track without preview
    return own[0] if own else (tracks[0] if tracks else None)


def build_artist(token, name):
    print(f"  → fetching {name}...")
    artist = search_artist(token, name)
    if not artist:
        print(f"    ✗ not found on Spotify")
        return None

    track = get_track_with_preview(token, artist["id"], artist["name"])
    time.sleep(0.15)  # gentle rate limiting

    images = artist.get("images", [])

    return {
        "id": artist["id"],
        "name": artist["name"],
        "spotifyUrl": artist["external_urls"].get("spotify"),
        "popularity": artist.get("popularity"),
        "followers": artist.get("followers", {}).get("total"),
        "genres": artist.get("genres", []),
        "images": {
            "large":  images[0]["url"] if len(images) > 0 else None,
            "medium": images[1]["url"] if len(images) > 1 else None,
            "small":  images[2]["url"] if len(images) > 2 else None,
        },
        "previewTrack": {
            "id":          track["id"] if track else None,
            "name":        track["name"] if track else None,
            "previewUrl":  track.get("preview_url") if track else None,
            "durationMs":  track.get("duration_ms") if track else None,
            "albumName":   track["album"]["name"] if track else None,
            "albumArt":    track["album"]["images"][0]["url"] if track and track["album"]["images"] else None,
            "spotifyUrl":  track["external_urls"].get("spotify") if track else None,
        } if track else None,
    }


def main():
    print("Getting Spotify token...")
    token = get_token()
    print("Token OK\n")

    concerts = []
    start_date = date.today() + timedelta(days=1)

    for i, template in enumerate(CONCERTS_TEMPLATE):
        concert_date = start_date + timedelta(days=i)
        venue = VENUES[i % len(VENUES)]

        print(f"Concert {i+1}/30 — {concert_date} — {template['genre']} @ {venue['name']}")

        enriched_artists = []
        for name in template["artists"]:
            artist = build_artist(token, name)
            if artist:
                enriched_artists.append(artist)

        concert = {
            "id": f"concert-{i+1:02d}",
            "date": concert_date.isoformat(),
            "doorsTime": "7:00 PM",
            "showTime": "8:00 PM",
            "venue": venue["name"],
            "address": venue["address"],
            "city": "San Francisco",
            "genre": template["genre"],
            "genreColor": template["color"],
            "ticketUrl": f"https://www.ticketweb.com/search?q={venue['name'].replace(' ', '+')}&genre={template['genre'].replace(' ', '+')}",
            "artists": enriched_artists,
        }

        concerts.append(concert)
        print(f"  ✓ {len(enriched_artists)} artists loaded\n")

    output = {
        "generatedAt": date.today().isoformat(),
        "city": "San Francisco",
        "totalConcerts": len(concerts),
        "concerts": concerts,
    }

    out_path = "/Users/danielnacamuli/Github/concerts/public/data/shows.json"
    with open(out_path, "w") as f:
        json.dump(output, f, indent=2)

    print(f"Done. Wrote {len(concerts)} concerts to {out_path}")

    # quick stats
    total_artists = sum(len(c["artists"]) for c in concerts)
    with_preview = sum(
        1 for c in concerts for a in c["artists"]
        if a.get("previewTrack") and a["previewTrack"].get("previewUrl")
    )
    print(f"Total artists: {total_artists}")
    print(f"Artists with preview URL: {with_preview}/{total_artists}")


if __name__ == "__main__":
    main()

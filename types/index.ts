export interface Track {
  id: number | null
  name: string | null
  previewUrl: string | null
  albumName: string | null
  albumArt: string | null
  durationMs: number | null
}

export interface Artist {
  id: string
  name: string
  spotifyUrl: string | null
  popularity: number
  followers: number
  genres: string[]
  images: { large: string | null; medium: string | null; small: string | null }
  previewTrack: Track | null
  tracks: Track[]
  dominantColor?: string
}

export interface Concert {
  id: string
  date: string
  doorsTime: string
  showTime: string
  venue: string
  address: string
  city: string
  genre: string
  genreColor: string
  ticketUrl: string
  artists: Artist[]
  hueShift?: number
}

export interface ShowsData {
  generatedAt: string
  city: string
  totalConcerts: number
  concerts: Concert[]
}

export interface TileData {
  tileIndex: number
  artistIndex: number
  artist: Artist
  track: Track | null
  color: string
}

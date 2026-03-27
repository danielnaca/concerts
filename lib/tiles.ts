import { Artist, TileData } from '@/types'
import { tileColor } from '@/lib/color'

export function buildTiles(artists: Artist[], hueShift = 0): TileData[] {
  const TOTAL = 9
  const n = artists.length
  const base = Math.floor(TOTAL / n)
  const extra = TOTAL % n

  const counts = artists.map((_, i) => base + (i < extra ? 1 : 0))

  const tiles: TileData[] = []
  for (let i = 0; i < n; i++) {
    const artist = artists[i]
    const playable = (artist.tracks ?? []).filter(t => t.previewUrl)
    const color = tileColor(i, n, hueShift)

    for (let j = 0; j < counts[i]; j++) {
      tiles.push({
        tileIndex: tiles.length,
        artistIndex: i,
        artist,
        track: playable[j] ?? null,
        color,
      })
    }
  }

  return tiles
}

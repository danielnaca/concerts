'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { Concert } from '@/types'
import { buildTiles } from '@/lib/tiles'
import { gradientStops, midTileColor } from '@/lib/color'

const LOCUS_SIZE = 76
const GRID_SIZE = 311
const CAROUSEL_STEP = 322
const FADE_STEP = 0.06
const FADE_INTERVAL = 25

// Spiral order: center → right → bottom-right → bottom → bottom-left →
//               left → top-left → top → top-right
const SPIRAL = [4, 5, 8, 7, 6, 3, 0, 1, 2]
const TILE_DELAY = SPIRAL.reduce<Record<number, number>>((acc, tile, i) => {
  acc[tile] = i
  return acc
}, {})

const NOISE = { backgroundImage: "url('/noise.svg')", backgroundRepeat: 'repeat', backgroundSize: '200px 200px' }

export default function ConcertView({ concerts }: { concerts: Concert[] }) {
  const [concertIndex, setConcertIndex] = useState(0)
  const [activeTileIndex, setActiveTileIndex] = useState<number | null>(null)
  const [locusPos, setLocusPos] = useState({ x: GRID_SIZE / 2, y: GRID_SIZE / 2 })
  const [locusVisible, setLocusVisible] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [slideOffset, setSlideOffset] = useState(0)
  const [isSliding, setIsSliding] = useState(false)
  const [photoSlots, setPhotoSlots] = useState<[string | null, string | null]>([null, null])
  const [activePhotoSlot, setActivePhotoSlot] = useState<0 | 1>(0)
  const [detailsAnim, setDetailsAnim] = useState({ opacity: 1, x: 0, transition: false })

  const gridRef = useRef<HTMLDivElement>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const isMutedRef = useRef(false)
  const activeTileRef = useRef<number | null>(null)
  const pendingIndexRef = useRef<number>(0)
  const navDirRef = useRef<1 | -1>(1)
  const hasNavigatedRef = useRef(false)

  useEffect(() => { isMutedRef.current = isMuted }, [isMuted])
  useEffect(() => { activeTileRef.current = activeTileIndex }, [activeTileIndex])

  // ── Derived values (declared before effects that reference them) ───────────

  const n = concerts.length
  const concert = concerts[concertIndex]
  const hue = concert.hueShift ?? 0
  const [gradTop, gradBot] = gradientStops(hue)
  const tiles = buildTiles(concert.artists, hue)
  const sideColor = midTileColor(concert.artists.length, hue)
  const activeArtistIndex = activeTileIndex !== null ? (tiles[activeTileIndex]?.artistIndex ?? null) : null
  const displayArtist = activeArtistIndex !== null ? concert.artists[activeArtistIndex] : concert.artists[0]

  // Neighboring concerts — always rendered in side cards so they slide in smoothly
  const prevConcert = concerts[(concertIndex - 1 + n) % n]
  const nextConcert = concerts[(concertIndex + 1) % n]
  const prevTiles = buildTiles(prevConcert.artists, prevConcert.hueShift ?? 0)
  const nextTiles = buildTiles(nextConcert.artists, nextConcert.hueShift ?? 0)
  const prevSideColor = midTileColor(prevConcert.artists.length, prevConcert.hueShift ?? 0)
  const nextSideColor = midTileColor(nextConcert.artists.length, nextConcert.hueShift ?? 0)

  const dateStr = new Date(concert.date + 'T12:00:00').toLocaleDateString('en-US', {
    month: 'long', day: 'numeric',
  })

  // ── Photo crossfade ───────────────────────────────────────────────────────

  const activePhotoSlotRef = useRef(activePhotoSlot)
  useEffect(() => { activePhotoSlotRef.current = activePhotoSlot }, [activePhotoSlot])

  const crossfadeTo = useCallback((url: string | null) => {
    if (!url) return
    const next = activePhotoSlotRef.current === 0 ? 1 : 0
    setPhotoSlots(prev => {
      const s: [string | null, string | null] = [prev[0], prev[1]]
      s[next] = url
      return s
    })
    requestAnimationFrame(() => setActivePhotoSlot(next))
  }, [])

  useEffect(() => {
    crossfadeTo(displayArtist?.images?.large ?? null)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [displayArtist?.id])

  // ── Audio ─────────────────────────────────────────────────────────────────

  const fadeOut = useCallback((audio: HTMLAudioElement, onDone?: () => void) => {
    const id = setInterval(() => {
      audio.volume = Math.max(0, audio.volume - FADE_STEP)
      if (audio.volume <= 0) { clearInterval(id); audio.pause(); onDone?.() }
    }, FADE_INTERVAL)
  }, [])

  const playTrack = useCallback((url: string | null) => {
    const prev = audioRef.current
    if (prev) fadeOut(prev)
    if (!url) { audioRef.current = null; return }
    const audio = new Audio(url)
    audio.volume = 0
    audioRef.current = audio
    audio.play().catch(() => {})
    const id = setInterval(() => {
      if (audioRef.current !== audio) { clearInterval(id); return }
      audio.volume = Math.min(audio.volume + FADE_STEP, isMutedRef.current ? 0 : 1)
      if (audio.volume >= 1) clearInterval(id)
    }, FADE_INTERVAL)
  }, [fadeOut])

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = isMuted ? 0 : 1
  }, [isMuted])

  const stopAudio = useCallback(() => {
    if (audioRef.current) fadeOut(audioRef.current, () => { audioRef.current = null })
  }, [fadeOut])

  // ── Carousel ──────────────────────────────────────────────────────────────

  const navigate = useCallback((dir: 1 | -1) => {
    if (isSliding) return
    stopAudio()
    setActiveTileIndex(null)
    setLocusVisible(false)
    const next = (concertIndex - dir + n) % n
    pendingIndexRef.current = next
    navDirRef.current = dir
    hasNavigatedRef.current = true
    crossfadeTo(concerts[next].artists[0]?.images?.large ?? null)
    setIsSliding(true)
    setSlideOffset(dir * CAROUSEL_STEP)
    setDetailsAnim({ opacity: 0, x: dir * 20, transition: true })
  }, [isSliding, concertIndex, n, concerts, stopAudio, crossfadeTo])

  const handleTransitionEnd = useCallback((e: React.TransitionEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget || e.propertyName !== 'transform') return
    setConcertIndex(pendingIndexRef.current)
    setIsSliding(false)
    setSlideOffset(0)
    const dir = navDirRef.current
    setDetailsAnim({ opacity: 0, x: -dir * 20, transition: false })
    requestAnimationFrame(() => setDetailsAnim({ opacity: 1, x: 0, transition: true }))
  }, [])

  // ── Locus ─────────────────────────────────────────────────────────────────

  const tileAt = useCallback((x: number, y: number): number => {
    const col = Math.max(0, Math.min(2, Math.floor((x / GRID_SIZE) * 3)))
    const row = Math.max(0, Math.min(2, Math.floor((y / GRID_SIZE) * 3)))
    return row * 3 + col
  }, [])

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (isSliding) return
    const grid = gridRef.current
    if (!grid) return
    const rect = grid.getBoundingClientRect()
    const x = Math.max(0, Math.min(rect.width, e.clientX - rect.left))
    const y = Math.max(0, Math.min(rect.height, e.clientY - rect.top))
    setLocusPos({ x, y })
    setLocusVisible(true)
    const next = tileAt(x, y)
    if (activeTileRef.current !== next) {
      setActiveTileIndex(next)
      playTrack(tiles[next]?.track?.previewUrl ?? null)
    }
  }, [isSliding, tiles, tileAt, playTrack])

  const handlePointerLeave = useCallback(() => {
    setLocusVisible(false)
    setActiveTileIndex(null)
    stopAudio()
  }, [stopAudio])

  // Active grid tile animation:
  // - First load: spiral tileIn
  // - Navigating: all tiles tileOut together (0.3s)
  // - After navigation: no animation (tiles snap to opacity 1, same as incoming side card)
  const activeTileAnim = (i: number) =>
    isSliding
      ? 'tileOut 0.3s ease forwards'
      : hasNavigatedRef.current
        ? 'none'
        : `tileIn 0.2s ease ${TILE_DELAY[i] * 0.1}s both`

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div
      className="relative w-full h-full overflow-hidden select-none"
      style={{ background: `linear-gradient(to bottom, ${gradTop} 0%, ${gradBot} 100%)` }}
    >
      {/* Artist photo — crossfade */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          maskImage: 'linear-gradient(to bottom, black 0%, black 20%, transparent 75%)',
          WebkitMaskImage: 'linear-gradient(to bottom, black 0%, black 20%, transparent 75%)',
        }}
      >
        {([0, 1] as const).map(slot => (
          photoSlots[slot] && (
            <img
              key={slot}
              src={photoSlots[slot]!}
              className="absolute top-0 left-0 w-full object-cover object-top"
              style={{
                height: '75vh',
                filter: 'grayscale(1)',
                opacity: activePhotoSlot === slot ? 1 : 0,
                transition: 'opacity 0.5s linear',
              }}
            />
          )
        ))}
      </div>

      {/* Dark overlay between photo and UI */}
      <div className="absolute inset-0 pointer-events-none" style={{ background: 'rgba(0,0,0,0.2)', zIndex: 2 }} />

      {/* Concert info + artist list */}
      <div
        className="absolute top-7 left-6 flex flex-col gap-6"
        style={{
          zIndex: 10,
          opacity: detailsAnim.opacity,
          transform: `translateX(${detailsAnim.x}px)`,
          transition: detailsAnim.transition ? 'opacity 0.3s ease, transform 0.3s ease' : 'none',
        }}
      >
        <div className="text-white text-sm font-bold leading-relaxed" style={{ opacity: 0.75 }}>
          <p>{dateStr}</p>
          <p>{concert.venue}</p>
        </div>
        <div className="flex flex-col">
          {concert.artists.map((artist, i) => (
            <p
              key={artist.id}
              className="text-white text-2xl font-light transition-opacity duration-300"
              style={{ opacity: activeArtistIndex === null || activeArtistIndex === i ? 1 : 0.4 }}
            >
              {artist.name}
            </p>
          ))}
        </div>
      </div>

      {/* Carousel */}
      <div
        className="absolute left-0 right-0 overflow-hidden"
        style={{ bottom: 100, height: GRID_SIZE, zIndex: 10 }}
      >
        <div
          style={{
            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
            transform: `translateX(${slideOffset}px)`,
            transition: isSliding ? 'transform 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94)' : 'none',
          }}
          onTransitionEnd={handleTransitionEnd}
        >
          {/* Left side card — always shows prev concert */}
          <div
            onClick={() => navigate(1)}
            style={{
              position: 'absolute', top: 0,
              left: `calc(50% - ${CAROUSEL_STEP + GRID_SIZE / 2}px)`,
              width: GRID_SIZE, height: GRID_SIZE,
              borderRadius: 34, overflow: 'hidden',
              backgroundColor: prevSideColor, cursor: 'pointer',
            }}
          >
            <div className="grid grid-cols-3 gap-px w-full h-full">
              {prevTiles.map((tile, i) => (
                <div key={i} style={{ backgroundColor: tile.color }} />
              ))}
            </div>
            <div className="absolute inset-0 pointer-events-none" style={{ ...NOISE, opacity: 0.08, mixBlendMode: 'overlay' }} />
          </div>

          {/* Active grid */}
          <div
            ref={gridRef}
            className="touch-none"
            style={{
              position: 'absolute', top: 0,
              left: `calc(50% - ${GRID_SIZE / 2}px)`,
              width: GRID_SIZE, height: GRID_SIZE,
              borderRadius: 34, overflow: 'hidden',
              boxShadow: '0 6px 34px rgba(0,0,0,0.15)',
              backgroundColor: sideColor,
              cursor: isSliding ? 'default' : 'none',
            }}
            onPointerMove={handlePointerMove}
            onPointerLeave={handlePointerLeave}
          >
            <div className="grid grid-cols-3 gap-px w-full h-full relative">
              {tiles.map((tile, i) => (
                <div
                  key={i}
                  style={{
                    backgroundColor: tile.color,
                    filter: activeTileIndex === i ? 'brightness(1.2)' : 'brightness(1)',
                    animation: activeTileAnim(i),
                    transition: 'filter 0.1s ease',
                  }}
                />
              ))}
            </div>
            <div className="absolute inset-0 pointer-events-none" style={{ ...NOISE, opacity: 0.08, mixBlendMode: 'overlay' }} />

            <div
              className="absolute rounded-full pointer-events-none"
              style={{
                width: LOCUS_SIZE, height: LOCUS_SIZE,
                left: locusPos.x - LOCUS_SIZE / 2,
                top: locusPos.y - LOCUS_SIZE / 2,
                background: 'rgba(255,255,255,0.4)',
                mixBlendMode: 'soft-light',
                opacity: locusVisible ? 1 : 0,
                transition: 'opacity 0.15s ease',
              }}
            />
          </div>

          {/* Right side card — always shows next concert */}
          <div
            onClick={() => navigate(-1)}
            style={{
              position: 'absolute', top: 0,
              left: `calc(50% + ${CAROUSEL_STEP - GRID_SIZE / 2}px)`,
              width: GRID_SIZE, height: GRID_SIZE,
              borderRadius: 34, overflow: 'hidden',
              backgroundColor: nextSideColor, cursor: 'pointer',
            }}
          >
            <div className="grid grid-cols-3 gap-px w-full h-full">
              {nextTiles.map((tile, i) => (
                <div key={i} style={{ backgroundColor: tile.color }} />
              ))}
            </div>
            <div className="absolute inset-0 pointer-events-none" style={{ ...NOISE, opacity: 0.08, mixBlendMode: 'overlay' }} />
          </div>
        </div>
      </div>

      {/* Controls */}
      <div
        className="absolute bottom-0 left-0 right-0 flex justify-between items-center px-10"
        style={{ height: 80, zIndex: 10 }}
      >
        <button onClick={() => navigate(1)} className="text-white text-2xl font-light opacity-80 hover:opacity-100 transition-opacity">Prev</button>
        <button onClick={() => setIsMuted(m => !m)} className="text-white text-2xl font-light opacity-80 hover:opacity-100 transition-opacity">
          {isMuted ? 'Unmute' : 'Mute'}
        </button>
        <button onClick={() => navigate(-1)} className="text-white text-2xl font-light opacity-80 hover:opacity-100 transition-opacity">Next</button>
      </div>
    </div>
  )
}

'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { Concert } from '@/types'
import { buildTiles } from '@/lib/tiles'
import { gradientStops, midTileColor } from '@/lib/color'

const LOCUS_SIZE = 76
const GRID_SIZE = 300
const CAROUSEL_STEP = 324
const SLIDE_MS = 600
const VISIBLE_RANGE = 3

// Deterministic overlay hue per concert — picks from 0–14 (reds) or 220–360 (blues/magentas)
function overlayHue(idx: number): number {
  const n = (idx * 47 + 13) % 156
  return n < 15 ? n : n - 15 + 220
}

// Random-looking tile reveal order (fixed so no hydration mismatch)
const TILE_ORDER = [5, 1, 7, 3, 0, 6, 2, 8, 4]
const TILE_DELAY = TILE_ORDER.reduce<Record<number, number>>((acc, tileIdx, pos) => {
  acc[tileIdx] = pos
  return acc
}, {})

// Noise images: 1 is darkest, 2 is palest, 3-9 fill the range
// tileIndex 0 (lightest) → 2.png, tileIndex 1-7 → 3-9.png, tileIndex 8 (darkest) → 1.png
const NOISE_SRCS = ['/noise/2.png', '/noise/3.png', '/noise/4.png', '/noise/5.png', '/noise/6.png', '/noise/7.png', '/noise/8.png', '/noise/9.png', '/noise/1.png']

export default function ConcertView({ concerts }: { concerts: Concert[] }) {
  const [concertIndex, setConcertIndex] = useState(0)
  const [hasInteracted, setHasInteracted] = useState(true)
  const [hasSettled, setHasSettled] = useState(false)
  const [showCommit, setShowCommit] = useState(false)
  const [showOverlay, setShowOverlay] = useState(false)
  const [activeTileIndex, setActiveTileIndex] = useState<number | null>(null)
  const [locusPos, setLocusPos] = useState({ x: GRID_SIZE / 2, y: GRID_SIZE / 2 })
  const [locusVisible, setLocusVisible] = useState(false)
  const [isSliding, setIsSliding] = useState(false)
  const [photoSlots, setPhotoSlots] = useState<[string | null, string | null]>([null, null])
  const [activePhotoSlot, setActivePhotoSlot] = useState<0 | 1>(0)
  const [detailsSlots, setDetailsSlots] = useState<[number, number]>([0, 0])
  const [activeDetailsSlot, setActiveDetailsSlot] = useState<0 | 1>(0)

  const gridRef = useRef<HTMLDivElement>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const fadeIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const activeTileRef = useRef<number | null>(null)
  const pointerDownPos = useRef<{ x: number; y: number } | null>(null)
  const slideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const activePhotoSlotRef = useRef<0 | 1>(0)
  const activeDetailsSlotRef = useRef<0 | 1>(0)

  useEffect(() => { activeTileRef.current = activeTileIndex }, [activeTileIndex])
  useEffect(() => { activePhotoSlotRef.current = activePhotoSlot }, [activePhotoSlot])
  useEffect(() => { activeDetailsSlotRef.current = activeDetailsSlot }, [activeDetailsSlot])
// ── Derived values ────────────────────────────────────────────────────────

  const n = concerts.length
  const concert = concerts[concertIndex]
  const hue = concert.hueShift ?? 0
  const [gradTop, gradBot] = gradientStops(hue)
  const tiles = buildTiles(concert.artists, hue)
  const activeArtistIndex = activeTileIndex !== null ? (tiles[activeTileIndex]?.artistIndex ?? null) : null
  const displayArtist = activeArtistIndex !== null ? concert.artists[activeArtistIndex] : concert.artists[0]

  // ── Photo crossfade ───────────────────────────────────────────────────────

  const crossfadeTo = useCallback((url: string | null) => {
    if (!url) return
    const next = activePhotoSlotRef.current === 0 ? 1 : 0
    setPhotoSlots(prev => { const s: [string | null, string | null] = [prev[0], prev[1]]; s[next] = url; return s })
    requestAnimationFrame(() => setActivePhotoSlot(next))
  }, [])

  useEffect(() => {
    crossfadeTo(displayArtist?.images?.large ?? null)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [displayArtist?.id])

  // ── Details crossfade ─────────────────────────────────────────────────────

  const crossfadeDetailsTo = useCallback((concertIdx: number) => {
    const next = activeDetailsSlotRef.current === 0 ? 1 : 0
    setDetailsSlots(prev => { const s: [number, number] = [prev[0], prev[1]]; s[next] = concertIdx; return s })
    requestAnimationFrame(() => setActiveDetailsSlot(next))
  }, [])

  // ── Audio ─────────────────────────────────────────────────────────────────

  const playTrack = useCallback((url: string | null) => {
    if (fadeIntervalRef.current) { clearInterval(fadeIntervalRef.current); fadeIntervalRef.current = null }
    if (!url) {
      if (audioRef.current) audioRef.current.pause()
      return
    }
    if (!audioRef.current) audioRef.current = new Audio()
    audioRef.current.src = url
    audioRef.current.volume = 0
    audioRef.current.play().catch(() => {})
    audioRef.current.addEventListener('playing', () => {
      fadeIntervalRef.current = setInterval(() => {
        if (!audioRef.current) { clearInterval(fadeIntervalRef.current!); fadeIntervalRef.current = null; return }
        audioRef.current.volume = Math.min(1, audioRef.current.volume + 0.025)
        if (audioRef.current.volume >= 1) { clearInterval(fadeIntervalRef.current!); fadeIntervalRef.current = null }
      }, 25)
    }, { once: true })
  }, [])

  const stopAudio = useCallback(() => {
    if (audioRef.current) audioRef.current.pause()
  }, [])

  // ── Carousel ──────────────────────────────────────────────────────────────

  const navigate = useCallback((dir: 1 | -1) => {
    if (isSliding) return
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null }
    setActiveTileIndex(null)
    setLocusVisible(false)
    const next = (concertIndex - dir + n) % n
    setHasInteracted(true)
    crossfadeTo(concerts[next].artists[0]?.images?.large ?? null)
    crossfadeDetailsTo(next)
    setConcertIndex(next)
    setIsSliding(true)

    if (slideTimerRef.current) clearTimeout(slideTimerRef.current)
    slideTimerRef.current = setTimeout(() => setIsSliding(false), SLIDE_MS)
  }, [isSliding, concertIndex, n, concerts, stopAudio, crossfadeTo, crossfadeDetailsTo])

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
    setHasInteracted(true)
    setLocusPos({ x, y })
    setLocusVisible(e.pointerType !== 'touch')
    const next = tileAt(x, y)
    if (activeTileRef.current !== next) {
      activeTileRef.current = next
      setActiveTileIndex(next)
      playTrack(tiles[next]?.track?.previewUrl ?? null)
      navigator.vibrate?.(10)
    }
  }, [isSliding, tiles, tileAt, playTrack])

  const handlePointerLeave = useCallback(() => {
    setLocusVisible(false)
    setActiveTileIndex(null)
    setHasSettled(true)
    stopAudio()
  }, [stopAudio])

  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    pointerDownPos.current = { x: e.clientX, y: e.clientY }
    handlePointerMove(e)
  }, [handlePointerMove])

  const handlePointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const wasPlaying = audioRef.current && !audioRef.current.paused
    if (!wasPlaying && pointerDownPos.current) {
      const dx = e.clientX - pointerDownPos.current.x
      const dy = e.clientY - pointerDownPos.current.y
      pointerDownPos.current = null
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) {
        navigate(dx > 0 ? 1 : -1)
        return
      }
    }
    pointerDownPos.current = null
    handlePointerLeave()
  }, [navigate, handlePointerLeave])

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div
      data-layer="app-root"
      className="relative w-full h-full overflow-hidden select-none"
      style={{ paddingBottom: '70px' }}
    >

      <div style={{ position: 'absolute', height: '100dvh', width: 30, backgroundColor: 'green', zIndex: 99 }} />
      {/* Artist photo — crossfade */}
      <div
        data-layer="photo-mask"
        className="absolute top-0 left-0 right-0 pointer-events-none"
        style={{
          height: '100dvh',
          maskImage: 'linear-gradient(to bottom, transparent 0%, black 100%)',
          WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, black 100%)',
          opacity: hasInteracted ? 1 : 0,
          transition: 'opacity 1s ease',
        }}
      >
        {([0, 1] as const).map(slot => (
          photoSlots[slot] && (
            <img
              key={slot}
              data-layer={`photo-slot-${slot}`}
              src={photoSlots[slot]!}
              className="absolute inset-0 w-full h-full object-cover object-top"
              style={{
                filter: 'grayscale(1)',
                opacity: activePhotoSlot === slot ? 1 : 0,
                transition: 'opacity 0.5s linear',
              }}
            />
          )
        ))}
      </div>
      {/* Color overlay — above photo, behind UI and cards */}
      <div data-layer="color-overlay" className="absolute inset-0 pointer-events-none" style={{ background: '#006191', mixBlendMode: 'multiply', zIndex: 2, opacity: showOverlay ? 1 : 0, transition: 'opacity 0.3s ease' }} />

      {/* Concert info — crossfade like photos */}
      <div data-layer="concert-info" className="absolute top-7 left-6 right-6" style={{ zIndex: 10, opacity: hasInteracted ? 1 : 0, transition: 'opacity 1s ease' }}>
        {([0, 1] as const).map(slot => {
          const c = concerts[detailsSlots[slot]]
          const isActive = activeDetailsSlot === slot
          const cDateStr = new Date(c.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric' })
          return (
            <div
              key={slot}
              data-layer={`concert-info-slot-${slot}`}
              className="flex flex-col gap-6"
              style={{
                position: slot === 0 ? 'relative' : 'absolute',
                top: 0, left: 0,
                opacity: isActive ? 1 : 0,
                transition: 'opacity 0.3s linear',
                pointerEvents: isActive ? 'auto' : 'none',
              }}
            >
              <div data-layer="date-venue" className="text-white text-sm font-bold leading-relaxed" style={{ opacity: 0.75, textShadow: '0 1px 12px rgba(0,0,0,0.25)' }}>
                <p>{cDateStr}</p>
                <p>{c.venue}</p>
              </div>
              <div data-layer="artist-names" className="flex flex-col">
                {c.artists.map((artist, i) => (
                  <p
                    key={artist.id}
                    data-layer={`artist-name-${i}`}
                    className="text-white text-2xl font-bold"
                    style={{
                      opacity: isActive && (activeArtistIndex === null || activeArtistIndex === i) ? 1 : isActive ? 0.4 : 1,
                      transition: 'opacity 0.3s ease',
                      textShadow: '0 1px 12px rgba(0,0,0,0.25)',
                    }}
                  >
                    {artist.name}
                  </p>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {/* Film strip carousel */}
      <div
        data-layer="carousel"
        className="absolute left-0 right-0"
        style={{ bottom: 60, height: GRID_SIZE, zIndex: 10 }}
      >
        {Array.from({ length: VISIBLE_RANGE * 2 + 1 }, (_, k) => {
          const relIdx = k - VISIBLE_RANGE
          const idx = ((concertIndex + relIdx) % n + n) % n
          const c = concerts[idx]
          const cHue = c.hueShift ?? 0
          const cTiles = buildTiles(c.artists, cHue)
          const isCenter = relIdx === 0

          return (
            <div
              key={idx}
              data-layer={isCenter ? 'card-center' : `card-side-${relIdx}`}
              ref={isCenter ? gridRef : null}
              className={isCenter ? 'touch-none' : ''}
              style={{
                position: 'absolute', top: 0,
                left: `calc(50% - ${GRID_SIZE / 2}px)`,
                width: GRID_SIZE, height: GRID_SIZE,
                borderRadius: 34, overflow: 'hidden',
                backgroundColor: 'transparent',
                boxShadow: isCenter ? 'rgba(0, 0, 0, 0.35) 0px 6px 34px' : 'none',
                cursor: isCenter && !isSliding ? 'none' : 'pointer',
                opacity: isCenter && !hasInteracted ? 0.3 : 1,
                transform: `translateX(${relIdx * (hasSettled ? CAROUSEL_STEP : GRID_SIZE + 100)}px)`,
                transition: `transform ${SLIDE_MS}ms cubic-bezier(0.34, 1.3, 0.64, 1), opacity 1s ease`,
              }}
              onClick={!isCenter ? () => navigate(relIdx > 0 ? -1 : 1) : undefined}
              onPointerDown={isCenter ? handlePointerDown : undefined}
              onPointerMove={isCenter ? handlePointerMove : undefined}
              onPointerUp={isCenter ? handlePointerUp : undefined}
              onPointerLeave={isCenter ? handlePointerLeave : undefined}
            >
              <div data-layer="tile-grid" className="grid grid-cols-3 w-full h-full relative" style={{ gap: 0 }}>
                {cTiles.map((tile, i) => {
                  const nArtists = c.artists.length
                  const mid = (nArtists - 1) / 2
                  const noiseIdx = Math.max(0, Math.min(8, Math.round(3 + tile.artistIndex - mid)))
                  return (
                  <div
                    key={i}
                    data-layer={`tile-${i}`}
                    style={{
                      backgroundImage: `url('${NOISE_SRCS[noiseIdx]}')`,
                      backgroundSize: 'cover',
                      backgroundPosition: 'center',
                      boxShadow: isCenter && activeTileIndex === i ? 'inset 0 0 0 999px rgba(255,255,255,0.2)' : 'inset 0 0 0 999px rgba(255,255,255,0)',
                      transition: 'box-shadow 0.25s ease',
                    }}
                  />
                  )
                })}
              </div>
              {isCenter && (
                <div
                  data-layer="locus"
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
              )}
            </div>
          )
        })}
      </div>
      {/* Intro text */}
      <div
        data-layer="intro-text"
        className="absolute left-6 right-6 pointer-events-none"
        style={{ top: 88, zIndex: 20, opacity: hasInteracted ? 0 : 1, transition: 'opacity 1s ease' }}
      >
        <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 14, lineHeight: 1.5, textAlign: 'center' }}>
          We haven't heard most of the bands playing in our city, and there's a handful we'd see if we knew their music.<br /><br />Each grid represents a concert in your city, run your finger across it to sample the music.
        </p>
      </div>
      {/* Top-left tap target to toggle overlay */}
      <div
        data-layer="tap-overlay-toggle"
        className="absolute top-0 left-0"
        style={{ width: 60, height: 60, zIndex: 30 }}
        onClick={() => setShowOverlay(v => !v)}
      />
      {/* Top-right tap target to reveal commit info */}
      <div
        data-layer="tap-commit-toggle"
        className="absolute top-0 right-0"
        style={{ width: 60, height: 60, zIndex: 30 }}
        onClick={() => setShowCommit(v => !v)}
      />
      {/* Build info */}
      <div
        data-layer="build-info"
        className="absolute bottom-2 left-0 right-0 text-center pointer-events-none"
        style={{ zIndex: 20, fontSize: 14, color: 'rgba(255,255,255,0.5)', letterSpacing: '0.02em', opacity: showCommit ? 1 : 0, transition: 'opacity 0.3s ease' }}
      >
        {process.env.NEXT_PUBLIC_COMMIT_INFO}
      </div>
    </div>
  )
}

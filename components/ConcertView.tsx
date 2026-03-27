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
const SLIDE_MS = 400
const VISIBLE_RANGE = 3

// Random-looking tile reveal order (fixed so no hydration mismatch)
const TILE_ORDER = [5, 1, 7, 3, 0, 6, 2, 8, 4]
const TILE_DELAY = TILE_ORDER.reduce<Record<number, number>>((acc, tileIdx, pos) => {
  acc[tileIdx] = pos
  return acc
}, {})

const NOISE = { backgroundImage: "url('/noise.svg')", backgroundRepeat: 'repeat', backgroundSize: '200px 200px' }
const TILE_GREY = '#8C8C8C'

export default function ConcertView({ concerts }: { concerts: Concert[] }) {
  const [concertIndex, setConcertIndex] = useState(0)
  const [initialReveal, setInitialReveal] = useState(false)
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
  const isMutedRef = useRef(false)
  const activeTileRef = useRef<number | null>(null)
  const hasNavigatedRef = useRef(false)
  const slideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const activePhotoSlotRef = useRef<0 | 1>(0)
  const activeDetailsSlotRef = useRef<0 | 1>(0)

  useEffect(() => { activeTileRef.current = activeTileIndex }, [activeTileIndex])
  useEffect(() => { activePhotoSlotRef.current = activePhotoSlot }, [activePhotoSlot])
  useEffect(() => { activeDetailsSlotRef.current = activeDetailsSlot }, [activeDetailsSlot])
  useEffect(() => { requestAnimationFrame(() => setInitialReveal(true)) }, [])

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

  const fadeOut = useCallback((audio: HTMLAudioElement, onDone?: () => void) => {
    const id = setInterval(() => {
      audio.volume = Math.max(0, audio.volume - FADE_STEP)
      if (audio.volume <= 0) { clearInterval(id); audio.pause(); onDone?.() }
    }, FADE_INTERVAL)
  }, [])

  const playTrack = useCallback((url: string | null) => {
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null }
    if (!url) return
    const audio = new Audio(url)
    audio.volume = 0
    audioRef.current = audio
    audio.play().catch(() => {})
    const id = setInterval(() => {
      if (audioRef.current !== audio) { clearInterval(id); return }
      audio.volume = Math.min(audio.volume + FADE_STEP, 1)
      if (audio.volume >= 1) clearInterval(id)
    }, FADE_INTERVAL)
  }, [])

  const stopAudio = useCallback(() => {
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null }
  }, [])

  // ── Carousel ──────────────────────────────────────────────────────────────

  const navigate = useCallback((dir: 1 | -1) => {
    if (isSliding) return
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null }
    setActiveTileIndex(null)
    setLocusVisible(false)
    const next = (concertIndex - dir + n) % n
    hasNavigatedRef.current = true

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
    setLocusPos({ x, y })
    setLocusVisible(true)
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
    stopAudio()
  }, [stopAudio])

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

      {/* Dark overlay */}
      <div className="absolute inset-0 pointer-events-none" style={{ background: 'rgba(0,0,0,0.3)', zIndex: 2 }} />

      {/* Concert info — crossfade like photos */}
      <div className="absolute top-7 left-6" style={{ zIndex: 10 }}>
        {([0, 1] as const).map(slot => {
          const c = concerts[detailsSlots[slot]]
          const isActive = activeDetailsSlot === slot
          const cDateStr = new Date(c.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric' })
          return (
            <div
              key={slot}
              className="flex flex-col gap-6"
              style={{
                position: slot === 0 ? 'relative' : 'absolute',
                top: 0, left: 0,
                opacity: isActive ? 1 : 0,
                transition: 'opacity 0.3s linear',
                pointerEvents: isActive ? 'auto' : 'none',
              }}
            >
              <div className="text-white text-sm font-bold leading-relaxed" style={{ opacity: 0.75 }}>
                <p>{cDateStr}</p>
                <p>{c.venue}</p>
              </div>
              <div className="flex flex-col">
                {c.artists.map((artist, i) => (
                  <p
                    key={artist.id}
                    className="text-white text-2xl font-light"
                    style={{
                      opacity: isActive && (activeArtistIndex === null || activeArtistIndex === i) ? 1 : isActive ? 0.4 : 1,
                      transition: 'opacity 0.3s ease',
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
        className="absolute left-0 right-0 overflow-hidden"
        style={{ bottom: 100, height: GRID_SIZE, zIndex: 10 }}
      >
        {Array.from({ length: VISIBLE_RANGE * 2 + 1 }, (_, k) => {
          const relIdx = k - VISIBLE_RANGE
          const idx = ((concertIndex + relIdx) % n + n) % n
          const c = concerts[idx]
          const cHue = c.hueShift ?? 0
          const cTiles = buildTiles(c.artists, cHue)
          const isCenter = relIdx === 0
          const showColor = isCenter && (initialReveal || hasNavigatedRef.current)

          return (
            <div
              key={idx}
              ref={isCenter ? gridRef : null}
              className={isCenter ? 'touch-none' : ''}
              style={{
                position: 'absolute', top: 0,
                left: `calc(50% - ${GRID_SIZE / 2}px)`,
                width: GRID_SIZE, height: GRID_SIZE,
                borderRadius: 34, overflow: 'hidden',
                backgroundColor: 'transparent',
                boxShadow: isCenter ? '0 6px 34px rgba(0,0,0,0.15)' : 'none',
                cursor: isCenter && !isSliding ? 'none' : 'pointer',
                transform: `translateX(${relIdx * CAROUSEL_STEP}px)`,
                transition: `transform ${SLIDE_MS}ms cubic-bezier(0.34, 1.56, 0.64, 1)`,
              }}
              onClick={!isCenter ? () => navigate(relIdx > 0 ? -1 : 1) : undefined}
              onPointerDown={isCenter ? handlePointerMove : undefined}
              onPointerMove={isCenter ? handlePointerMove : undefined}
              onPointerUp={isCenter ? handlePointerLeave : undefined}
              onPointerLeave={isCenter ? handlePointerLeave : undefined}
            >
              <div className="grid grid-cols-3 gap-px w-full h-full relative">
                {cTiles.map((tile, i) => (
                  <div
                    key={i}
                    style={{
                      backgroundColor: showColor ? tile.color : TILE_GREY,
                      boxShadow: isCenter && activeTileIndex === i ? 'inset 0 0 0 999px rgba(255,255,255,0.2)' : 'inset 0 0 0 999px rgba(255,255,255,0)',
                      transition: 'box-shadow 0.1s ease',
                    }}
                  />
                ))}
              </div>
              <div className="absolute inset-0 pointer-events-none" style={{ ...NOISE, opacity: 0.08, mixBlendMode: 'overlay' }} />
              {isCenter && (
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
              )}
            </div>
          )
        })}
      </div>
      {/* Build info */}
      <div
        className="absolute bottom-2 left-0 right-0 text-center pointer-events-none"
        style={{ zIndex: 20, fontSize: 14, color: 'rgba(255,255,255,0.5)', letterSpacing: '0.02em' }}
      >
        {process.env.NEXT_PUBLIC_COMMIT_INFO}
      </div>
    </div>
  )
}

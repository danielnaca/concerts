import ConcertView from '@/components/ConcertView'
import { ShowsData } from '@/types'
import rawData from '@/public/data/shows.json'

export default function Home() {
  const data = rawData as unknown as ShowsData

  return (
    <main style={{ position: 'fixed', top: 0, left: 0, right: 0, height: '100dvh' }}>
      <ConcertView concerts={data.concerts} />
    </main>
  )
}

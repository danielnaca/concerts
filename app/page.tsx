import ConcertView from '@/components/ConcertView'
import { ShowsData } from '@/types'
import rawData from '@/public/data/shows.json'

export default function Home() {
  const data = rawData as unknown as ShowsData

  return (
    <main className="w-full" style={{ height: '100dvh', paddingBottom: 'env(safe-area-inset-bottom)', border: '2px solid red' }}>
      <ConcertView concerts={data.concerts} />
    </main>
  )
}

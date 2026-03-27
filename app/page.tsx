import ConcertView from '@/components/ConcertView'
import { ShowsData } from '@/types'
import rawData from '@/public/data/shows.json'

export default function Home() {
  const data = rawData as unknown as ShowsData

  return (
    <main style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: '-70px', paddingBottom: '70px', border: '2px solid red' }}>
      <ConcertView concerts={data.concerts} />
    </main>
  )
}

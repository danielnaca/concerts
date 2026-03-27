import { readFileSync } from 'fs'
import { join } from 'path'
import ConcertView from '@/components/ConcertView'
import { ShowsData } from '@/types'

export default function Home() {
  const data: ShowsData = JSON.parse(
    readFileSync(join(process.cwd(), 'public/data/shows.json'), 'utf-8')
  )

  return (
    <main className="w-full h-full">
      <ConcertView concerts={data.concerts} />
    </main>
  )
}

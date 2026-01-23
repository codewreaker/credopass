import Analytics from '../Analytics/index'
import Tables from '../Tables'


export default function HomePage() {

  return (
    <>
      <Analytics />
      <div className="my-2 h-px bg-border/50" />
      <Tables/>
    </>
  )
}

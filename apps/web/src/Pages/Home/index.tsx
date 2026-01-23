import Analytics from '../Analytics/index'
import Members from '../Members/index'


export default function HomePage() {

  return (
    <>
      <Analytics />
      <div className="my-2 h-px bg-border/50" />
      <Members/>
    </>
  )
}

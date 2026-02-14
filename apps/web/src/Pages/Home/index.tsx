import Analytics from '../Analytics/index'
import Tables from '../Tables'


export default function HomePage() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold tracking-tight text-foreground">
            Dashboard
          </h1>
          <p className="text-xs text-muted-foreground">
            Overview of your attendance data and analytics
          </p>
        </div>
      </div>
      <Analytics />
      <div className="h-px bg-border/40" />
      <Tables />
    </div>
  )
}

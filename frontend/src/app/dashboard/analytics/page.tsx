export default function AnalyticsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Analytics</h1>
        <p className="text-muted-foreground">
          View insights and statistics from your surveys
        </p>
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        <div className="rounded-lg border p-6">
          <h2 className="text-lg font-semibold">NPS Trend</h2>
          <div className="mt-4 h-[300px] flex items-center justify-center text-muted-foreground">
            Chart placeholder
          </div>
        </div>
        <div className="rounded-lg border p-6">
          <h2 className="text-lg font-semibold">Response Distribution</h2>
          <div className="mt-4 h-[300px] flex items-center justify-center text-muted-foreground">
            Chart placeholder
          </div>
        </div>
        <div className="rounded-lg border p-6">
          <h2 className="text-lg font-semibold">Word Cloud</h2>
          <div className="mt-4 h-[300px] flex items-center justify-center text-muted-foreground">
            Word cloud placeholder
          </div>
        </div>
        <div className="rounded-lg border p-6">
          <h2 className="text-lg font-semibold">Sentiment Analysis</h2>
          <div className="mt-4 h-[300px] flex items-center justify-center text-muted-foreground">
            Sentiment chart placeholder
          </div>
        </div>
      </div>
    </div>
  )
} 
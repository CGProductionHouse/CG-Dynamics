import { useSearchParams } from 'react-router-dom'
import MyDayPage from './MyDayPage'
import CommandCentrePage from './CommandCentrePage'

type MyWorkTab = 'my-day' | 'daily-tasks'

export default function MyWorkPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const tab: MyWorkTab = searchParams.get('tab') === 'daily-tasks' ? 'daily-tasks' : 'my-day'

  return (
    <div>
      <div className="mx-auto max-w-7xl px-4 pt-4 sm:px-6 lg:px-10">
        <div className="rounded-2xl border border-white/10 bg-brand-surface/60 p-3 sm:p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-teal">Daily workflow</p>
              <h1 className="mt-1 text-2xl font-black text-white">My Work</h1>
            </div>
            <div className="grid grid-cols-2 gap-1 rounded-xl border border-white/10 bg-black/20 p-1 sm:min-w-80">
              {([
                ['my-day', 'My Day'],
                ['daily-tasks', 'Daily Tasks'],
              ] as const).map(([value, label]) => (
                <button key={value} type="button" onClick={() => setSearchParams({ tab: value })} className={`rounded-lg px-4 py-3 text-sm font-black transition-colors ${tab === value ? 'bg-brand-teal text-black' : 'text-brand-primary hover:bg-white/[0.05] hover:text-white'}`}>
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
      {tab === 'my-day' ? <MyDayPage embedded /> : <CommandCentrePage embedded />}
    </div>
  )
}

import { useState } from 'react'
import { useBudget } from '../context/BudgetContext'
import TripModal from './TripModal'

const fmt = (n) => `£${(n || 0).toLocaleString('en-GB', { minimumFractionDigits: 0 })}`

const STATUS_STYLE = {
  planned:   { bg: 'bg-amber-900/30',   text: 'text-amber-400',   label: 'Planned' },
  booked:    { bg: 'bg-emerald-900/30', text: 'text-emerald-400', label: 'Booked' },
  completed: { bg: 'bg-nb-600',         text: 'text-slate-400',   label: 'Done' }
}

function days(dep, ret) {
  if (!dep || !ret) return null
  return Math.round((new Date(ret) - new Date(dep)) / 86400000)
}

function TripCard({ trip, monthlyContrib, onEdit, onDelete }) {
  const total = trip.totalBudget || 0
  const actual = Object.values(trip.budget).reduce((s, b) => s + (b.actual || 0), 0)
  const progress = total > 0 ? Math.min(100, (actual / total) * 100) : 0
  const st = STATUS_STYLE[trip.status] || STATUS_STYLE.planned
  const d = days(trip.departureDate, trip.returnDate)
  const daysLeft = trip.departureDate ? Math.ceil((new Date(trip.departureDate) - new Date()) / 86400000) : null
  const monthsToSave = monthlyContrib > 0 && total > 0 ? Math.ceil(total / monthlyContrib) : null

  // Funded %
  const saved = trip.savedAmount || 0
  const fundedPct = total > 0 ? Math.round((saved / total) * 100) : 0

  // Book-by countdown (trip.bookByDate or departure - 90 days)
  const bookByDate = trip.bookByDate
    ? new Date(trip.bookByDate)
    : trip.departureDate
      ? new Date(new Date(trip.departureDate).getTime() - 90 * 86400000)
      : null
  const daysToBookBy = bookByDate ? Math.ceil((bookByDate - new Date()) / 86400000) : null
  const showBookBy = daysToBookBy !== null && daysToBookBy > 0 && trip.status !== 'booked' && trip.status !== 'completed'
  const bookByColor = daysToBookBy < 14
    ? 'text-red-400 bg-red-900/30 border-red-800/60'
    : daysToBookBy < 30
      ? 'text-amber-400 bg-amber-900/30 border-amber-800/60'
      : 'text-neuro-400 bg-neuro-900/30 border-neuro-800/60'

  return (
    <div className="bg-nb-750 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-nb-600 flex items-start justify-between">
        <div>
          <h3 className="font-bold text-slate-300 text-base">{trip.destination}</h3>
          <div className="flex items-center gap-3 mt-1 flex-wrap">
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${st.bg} ${st.text}`}>{st.label}</span>
            {trip.status !== 'completed' && total > 0 && (
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${fundedPct >= 100 ? 'bg-emerald-900/30 text-emerald-400' : fundedPct >= 50 ? 'bg-neuro-900/30 text-neuro-400' : 'bg-nb-700 text-slate-400'}`}>
                {fundedPct}% funded
              </span>
            )}
            {trip.departureDate && (
              <span className="text-xs text-slate-400">
                {new Date(trip.departureDate).toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' })}
                {d && ` · ${d} days`}
              </span>
            )}
            {daysLeft !== null && daysLeft > 0 && (
              <span className="text-xs font-medium text-neuro-400">{daysLeft}d to go</span>
            )}
          </div>
          {showBookBy && (
            <div className={`mt-2 text-xs font-medium border rounded-lg px-2 py-1 inline-block ${bookByColor}`}>
              Book by {bookByDate.toLocaleDateString('en-GB', { day:'numeric', month:'short' })} — {daysToBookBy} days
            </div>
          )}
        </div>
        <div className="flex gap-2">
          <button onClick={onEdit} className="text-xs text-neuro-400 hover:text-neuro-300 px-2 py-1 rounded hover:bg-nb-700">Edit</button>
          <button onClick={onDelete} className="text-xs text-red-500 hover:text-red-400 px-2 py-1 rounded hover:bg-nb-700">Delete</button>
        </div>
      </div>

      {/* Budget breakdown */}
      <div className="px-5 py-3">
        <div className="grid grid-cols-3 gap-3 mb-3 text-center">
          {[
            ['Flights',        trip.budget.flights],
            ['Accommodation',  trip.budget.accommodation],
            ['On-ground',      trip.budget.onGround],
          ].map(([label, b]) => (
            <div key={label} className="bg-nb-800 rounded-lg p-2">
              <div className="text-xs text-slate-500 mb-0.5">{label}</div>
              <div className="text-sm font-semibold text-slate-300">{fmt(b.budgeted)}</div>
              {b.actual !== null && (
                <div className={`text-xs font-medium ${b.actual > b.budgeted ? 'text-red-400' : 'text-emerald-400'}`}>
                  actual {fmt(b.actual)}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Total + progress */}
        <div className="flex justify-between text-sm font-semibold text-slate-300 mb-1.5">
          <span>Total budget</span>
          <span className="text-neuro-400">{fmt(total)}</span>
        </div>

        {/* Savings progress bar (planned/booked) */}
        {trip.status !== 'completed' && total > 0 && (
          <>
            {(() => {
              const saved = trip.savedAmount || 0
              const pct = Math.min((saved / total) * 100, 100)
              const remaining = Math.max(total - saved, 0)
              const monthsLeft = monthlyContrib > 0 && remaining > 0 ? Math.ceil(remaining / monthlyContrib) : null
              return (
                <>
                  <div className="w-full bg-nb-700 rounded-full h-2 mb-1">
                    <div className="bg-neuro-500 h-2 rounded-full transition-all" style={{ width: `${pct}%` }} />
                  </div>
                  <div className="flex justify-between text-xs text-slate-500">
                    <span>Saved {fmt(saved)}</span>
                    <span>{fmt(remaining)} to go{monthsLeft ? ` · ~${monthsLeft}mo` : ''}</span>
                  </div>
                </>
              )
            })()}
          </>
        )}

        {/* Spending progress (completed) */}
        {trip.status === 'completed' && (
          <>
            <div className="w-full bg-nb-700 rounded-full h-2 mb-1">
              <div className="bg-neuro-500 h-2 rounded-full transition-all" style={{ width: `${progress}%` }} />
            </div>
            <div className="flex justify-between text-xs text-slate-500">
              <span>Spent {fmt(actual)}</span>
              <span>{fmt(total - actual)} {total >= actual ? 'under' : 'over'} budget</span>
            </div>
          </>
        )}

        {/* Savings context */}
        {trip.status !== 'completed' && monthlyContrib > 0 && (
          <div className="mt-2 pt-2 border-t border-nb-600 text-xs text-slate-500">
            <span>Saving {fmt(monthlyContrib)}/month from budget</span>
          </div>
        )}

        {/* Notes */}
        {trip.notes && (
          <p className="mt-3 pt-3 border-t border-nb-600 text-xs text-slate-500 leading-relaxed">{trip.notes}</p>
        )}
        {trip.itineraryUrl && (
          <a href={trip.itineraryUrl} target="_blank" rel="noopener noreferrer"
            className="mt-1 text-xs text-neuro-400 hover:text-neuro-300 hover:underline block">Itinerary / booking</a>
        )}
      </div>
    </div>
  )
}

export default function HolidayPlanner() {
  const { data, save, getHolidayContribution } = useBudget()
  const [modal, setModal] = useState(null) // null | 'add' | trip (for edit)
  const [copyFlash, setCopyFlash] = useState(false)
  const [importError, setImportError] = useState(null)
  const [importPreview, setImportPreview] = useState(null)

  const monthlyContrib = getHolidayContribution()
  const trips = data?.holidays?.trips || []
  const totalBudgeted = trips.reduce((s, t) => s + (t.totalBudget || 0), 0)

  const saveTrips = (updatedTrips) => {
    save({ ...data, holidays: { ...data.holidays, trips: updatedTrips } })
  }

  const addTrip = (trip) => {
    saveTrips([...trips, { ...trip, id: `trip-${Date.now()}` }])
    setModal(null)
  }

  const editTrip = (trip) => {
    saveTrips(trips.map(t => t.id === trip.id ? trip : t))
    setModal(null)
  }

  const deleteTrip = (id) => {
    if (window.confirm('Delete this trip?')) saveTrips(trips.filter(t => t.id !== id))
  }

  // Export / Import (holidays-specific)
  const copyForClaude = () => {
    const text = `=== HOLIDAY PLANNER SNAPSHOT ===
Generated: ${new Date().toLocaleString('en-GB')}

Monthly contribution: £${monthlyContrib}/month (auto-pulled from budget)
Total trips budgeted: £${totalBudgeted.toLocaleString('en-GB')}

TRIPS:
${trips.map(t => `
• ${t.destination} (${t.status})
  Dates: ${t.departureDate || '—'} → ${t.returnDate || '—'}
  Budget: Flights £${t.budget.flights.budgeted} | Accommodation £${t.budget.accommodation.budgeted} | On-ground £${t.budget.onGround.budgeted} | Total £${t.totalBudget}
  Notes: ${t.notes || '—'}
`).join('')}

════════════════════════════════════
INSTRUCTIONS FOR CLAUDE
════════════════════════════════════
You are a travel and financial advisor. The holiday data is in the JSON below.
Discuss changes to trips, budgets, and destinations.
When done, output the complete updated holidays object inside a code block tagged: \`\`\`holidays-json
Preserve existing trip IDs. New trips use id format "trip-<timestamp>".
════════════════════════════════════

\`\`\`holidays-json
${JSON.stringify(data.holidays, null, 2)}
\`\`\``
    navigator.clipboard.writeText(text).then(() => {
      setCopyFlash(true); setTimeout(() => setCopyFlash(false), 2500)
    })
  }

  const handleFileChange = (e) => {
    setImportError(null)
    const file = e.target.files[0]; if (!file) return
    e.target.value = ''
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target.result)
        if (!parsed.trips || !Array.isArray(parsed.trips)) {
          setImportError('Invalid file — expected a holidays object with a trips array')
          return
        }
        setImportPreview(parsed)
      } catch { setImportError("Couldn't parse file") }
    }
    reader.readAsText(file)
  }

  const confirmImport = () => {
    save({ ...data, holidays: importPreview })
    setImportPreview(null)
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-5">
      {/* Header bar */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-300">Holiday Planner</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Saving <span className="font-semibold text-neuro-400">£{monthlyContrib}/month</span> from budget ·
            <span className="font-semibold text-slate-300"> £{totalBudgeted.toLocaleString('en-GB')} total budgeted across {trips.length} trip{trips.length !== 1 ? 's' : ''}</span>
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <label className="cursor-pointer px-3 py-2 rounded-lg text-xs font-medium bg-neuro-600 text-white hover:bg-neuro-500">
            Import
            <input type="file" accept=".json" className="hidden" onChange={handleFileChange} />
          </label>
          <button onClick={copyForClaude}
            className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${copyFlash ? 'bg-nb-700 text-slate-300 border border-nb-500' : 'bg-nb-700 text-slate-300 hover:bg-nb-600 border border-nb-500'}`}>
            {copyFlash ? 'Copied!' : 'Copy for Claude'}
          </button>
          <button onClick={() => setModal('add')}
            className="px-3 py-2 rounded-lg text-xs font-medium bg-nb-700 text-slate-300 hover:bg-nb-600 border border-nb-500">
            + Add Trip
          </button>
        </div>
      </div>

      {/* Trip cards */}
      {trips.length === 0 ? (
        <div className="bg-nb-750 rounded-xl p-12 text-center text-slate-500">
          <p className="text-sm">No trips yet — add one to get started</p>
          <button onClick={() => setModal('add')} className="mt-4 text-neuro-400 text-sm hover:underline">+ Add your first trip</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {trips.map(trip => (
            <TripCard
              key={trip.id}
              trip={trip}
              monthlyContrib={monthlyContrib}
              onEdit={() => setModal(trip)}
              onDelete={() => deleteTrip(trip.id)}
            />
          ))}
        </div>
      )}

      {/* Modals */}
      {modal === 'add' && <TripModal onSave={addTrip} onClose={() => setModal(null)} />}
      {modal && modal !== 'add' && (
        <TripModal initial={modal} onSave={editTrip} onClose={() => setModal(null)} />
      )}

      {importError && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-red-900 border border-red-700 text-red-200 text-sm px-5 py-3 rounded-xl shadow-lg flex items-center gap-3 z-50">
          <span>{importError}</span>
          <button onClick={() => setImportError(null)} className="font-bold text-lg">&times;</button>
        </div>
      )}

      {importPreview && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-nb-750 rounded-xl w-full max-w-sm p-6">
            <h2 className="text-lg font-bold text-slate-300 mb-2">Import Holiday Data</h2>
            <p className="text-sm text-slate-400 mb-4">This will replace your current trip list with <strong className="text-slate-300">{importPreview.trips?.length} trip(s)</strong>.</p>
            <div className="flex gap-3">
              <button onClick={() => setImportPreview(null)} className="flex-1 border border-nb-600 text-slate-400 px-4 py-2 rounded-lg text-sm hover:bg-nb-700">Cancel</button>
              <button onClick={confirmImport} className="flex-1 bg-neuro-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-neuro-500">Import</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

import { useState } from 'react'
import { useBudget } from '../context/BudgetContext'
import TripModal from './TripModal'

const fmt = (n) => `£${(n || 0).toLocaleString('en-GB', { minimumFractionDigits: 0 })}`

const STATUS_STYLE = {
  planned:   { bg: 'bg-lemon-chiffon-100',  text: 'text-lemon-chiffon-700',  label: '🗓 Planned' },
  booked:    { bg: 'bg-soft-linen-100',  text: 'text-soft-linen-600',  label: '✅ Booked' },
  completed: { bg: 'bg-ash-grey-100',   text: 'text-ash-grey-600',   label: '✓ Done' }
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
  const bookByColor = daysToBookBy < 14 ? 'text-vibrant-coral-600 bg-vibrant-coral-50 border-vibrant-coral-200' : daysToBookBy < 30 ? 'text-lemon-chiffon-700 bg-lemon-chiffon-50 border-lemon-chiffon-200' : 'text-tropical-teal-600 bg-tropical-teal-50 border-tropical-teal-200'

  return (
    <div className="bg-white rounded-xl border border-ash-grey-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-ash-grey-100 flex items-start justify-between">
        <div>
          <h3 className="font-bold text-ash-grey-800 text-base">{trip.destination}</h3>
          <div className="flex items-center gap-3 mt-1 flex-wrap">
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${st.bg} ${st.text}`}>{st.label}</span>
            {trip.status !== 'completed' && total > 0 && (
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${fundedPct >= 100 ? 'bg-soft-linen-100 text-soft-linen-700' : fundedPct >= 50 ? 'bg-tropical-teal-50 text-tropical-teal-700' : 'bg-ash-grey-100 text-ash-grey-600'}`}>
                {fundedPct}% funded
              </span>
            )}
            {trip.departureDate && (
              <span className="text-xs text-ash-grey-500">
                {new Date(trip.departureDate).toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' })}
                {d && ` · ${d} days`}
              </span>
            )}
            {daysLeft !== null && daysLeft > 0 && (
              <span className="text-xs font-medium text-tropical-teal-600">{daysLeft}d to go</span>
            )}
          </div>
          {showBookBy && (
            <div className={`mt-2 text-xs font-medium border rounded-lg px-2 py-1 inline-block ${bookByColor}`}>
              🗓 Book by {bookByDate.toLocaleDateString('en-GB', { day:'numeric', month:'short' })} — {daysToBookBy} days
            </div>
          )}
        </div>
        <div className="flex gap-2">
          <button onClick={onEdit} className="text-xs text-tropical-teal-600 hover:text-tropical-teal-700 px-2 py-1 rounded hover:bg-tropical-teal-50">Edit</button>
          <button onClick={onDelete} className="text-xs text-vibrant-coral-500 hover:text-vibrant-coral-700 px-2 py-1 rounded hover:bg-vibrant-coral-50">Delete</button>
        </div>
      </div>

      {/* Budget breakdown */}
      <div className="px-5 py-3">
        <div className="grid grid-cols-3 gap-3 mb-3 text-center">
          {[
            ['✈️ Flights',       trip.budget.flights],
            ['🏨 accommodation',  trip.budget.accommodation],
            ['🍜 On-ground',     trip.budget.onGround],
          ].map(([label, b]) => (
            <div key={label} className="bg-ash-grey-50 rounded-lg p-2">
              <div className="text-xs text-ash-grey-500 mb-0.5">{label}</div>
              <div className="text-sm font-semibold text-ash-grey-800">{fmt(b.budgeted)}</div>
              {b.actual !== null && (
                <div className={`text-xs font-medium ${b.actual > b.budgeted ? 'text-vibrant-coral-500' : 'text-soft-linen-600'}`}>
                  actual {fmt(b.actual)}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Total + progress */}
        <div className="flex justify-between text-sm font-semibold text-ash-grey-700 mb-1.5">
          <span>Total budget</span>
          <span className="text-tropical-teal-600">{fmt(total)}</span>
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
                  <div className="w-full bg-ash-grey-100 rounded-full h-2 mb-1">
                    <div className="bg-tropical-teal-500 h-2 rounded-full transition-all" style={{ width: `${pct}%` }} />
                  </div>
                  <div className="flex justify-between text-xs text-ash-grey-500">
                    <span>💰 Saved {fmt(saved)}</span>
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
            <div className="w-full bg-ash-grey-100 rounded-full h-2 mb-1">
              <div className="bg-tropical-teal-500 h-2 rounded-full transition-all" style={{ width: `${progress}%` }} />
            </div>
            <div className="flex justify-between text-xs text-ash-grey-500">
              <span>Spent {fmt(actual)}</span>
              <span>{fmt(total - actual)} {total >= actual ? 'under' : 'over'} budget</span>
            </div>
          </>
        )}

        {/* Savings context */}
        {trip.status !== 'completed' && monthlyContrib > 0 && (
          <div className="mt-2 pt-2 border-t border-ash-grey-100 text-xs text-ash-grey-500">
            <span>Saving {fmt(monthlyContrib)}/month from budget</span>
          </div>
        )}

        {/* Notes */}
        {trip.notes && (
          <p className="mt-3 pt-3 border-t border-ash-grey-100 text-xs text-ash-grey-500 leading-relaxed">{trip.notes}</p>
        )}
        {trip.itineraryUrl && (
          <a href={trip.itineraryUrl} target="_blank" rel="noopener noreferrer"
            className="mt-1 text-xs text-tropical-teal-500 hover:underline block">🔗 Itinerary / booking</a>
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
          <h2 className="text-lg font-bold text-ash-grey-800">✈️ Holiday Planner</h2>
          <p className="text-sm text-ash-grey-500 mt-0.5">
            Saving <span className="font-semibold text-tropical-teal-600">£{monthlyContrib}/month</span> from budget ·
            <span className="font-semibold text-ash-grey-700"> £{totalBudgeted.toLocaleString('en-GB')} total budgeted across {trips.length} trip{trips.length !== 1 ? 's' : ''}</span>
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <label className="cursor-pointer px-3 py-2 rounded-lg text-xs font-medium bg-tropical-teal-700 text-white hover:bg-tropical-teal-800">
            📥 Import
            <input type="file" accept=".json" className="hidden" onChange={handleFileChange} />
          </label>
          <button onClick={copyForClaude}
            className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${copyFlash ? 'bg-soft-linen-600 text-white' : 'bg-tropical-teal-600 text-white hover:bg-tropical-teal-700'}`}>
            {copyFlash ? '✓ Copied!' : '📋 Copy for Claude'}
          </button>
          <button onClick={() => setModal('add')}
            className="px-3 py-2 rounded-lg text-xs font-medium bg-soft-linen-600 text-white hover:bg-soft-linen-700">
            + Add Trip
          </button>
        </div>
      </div>

      {/* Trip cards */}
      {trips.length === 0 ? (
        <div className="bg-white rounded-xl border border-ash-grey-200 shadow-sm p-12 text-center text-ash-grey-400">
          <div className="text-4xl mb-3">✈️</div>
          <p className="text-sm">No trips yet — add one to get started</p>
          <button onClick={() => setModal('add')} className="mt-4 text-tropical-teal-600 text-sm hover:underline">+ Add your first trip</button>
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
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-vibrant-coral-600 text-white text-sm px-5 py-3 rounded-xl shadow-lg flex items-center gap-3 z-50">
          <span>⚠️ {importError}</span>
          <button onClick={() => setImportError(null)} className="font-bold text-lg">&times;</button>
        </div>
      )}

      {importPreview && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6">
            <h2 className="text-lg font-bold mb-2">📥 Import Holiday Data</h2>
            <p className="text-sm text-ash-grey-600 mb-4">This will replace your current trip list with <strong>{importPreview.trips?.length} trip(s)</strong>.</p>
            <div className="flex gap-3">
              <button onClick={() => setImportPreview(null)} className="flex-1 border border-ash-grey-300 text-ash-grey-700 px-4 py-2 rounded-lg text-sm">Cancel</button>
              <button onClick={confirmImport} className="flex-1 bg-tropical-teal-700 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-tropical-teal-800">Import</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

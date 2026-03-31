import { useState } from 'react'

const STATUSES = ['planned', 'booked', 'completed']
const STATUS_COLOURS = { planned: 'bg-amber-100 text-amber-700', booked: 'bg-green-100 text-green-700', completed: 'bg-ash-grey-100 text-ash-grey-600' }

const EMPTY_TRIP = {
  destination: '', status: 'planned',
  departureDate: '', returnDate: '',
  budget: {
    flights:       { budgeted: 0, actual: null },
    accommodation: { budgeted: 0, actual: null },
    onGround:      { budgeted: 0, actual: null }
  },
  savedAmount: 0,
  totalBudget: 0, notes: '', itineraryUrl: '', destinationOptions: []
}

export default function TripModal({ initial, onSave, onClose }) {
  const [trip, setTrip] = useState(initial || EMPTY_TRIP)
  const [error, setError] = useState('')

  const set = (key, val) => setTrip(t => ({ ...t, [key]: val }))
  const setBudget = (cat, field, val) => setTrip(t => ({
    ...t,
    budget: { ...t.budget, [cat]: { ...t.budget[cat], [field]: val === '' ? null : parseFloat(val) || 0 } }
  }))

  const total = (t) => Object.values(t.budget).reduce((s, b) => s + (b.budgeted || 0), 0)

  const handleSave = () => {
    if (!trip.destination.trim()) { setError('Destination required'); return }
    onSave({ ...trip, totalBudget: total(trip) })
  }


  return (
    <div className="fixed inset-0 bg-ash-grey-950/60 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 bg-white border-b border-ash-grey-100 px-6 py-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-ash-grey-800">{initial ? 'Edit Trip' : 'Add Trip'}</h2>
          <button onClick={onClose} className="text-ash-grey-400 hover:text-ash-grey-600 text-2xl leading-none">&times;</button>
        </div>

        <div className="p-6 space-y-5">
          {/* Destination + Status */}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-ash-grey-600 mb-1">Destination</label>
              <input type="text" value={trip.destination} onChange={e => set('destination', e.target.value)}
                className="w-full border border-ash-grey-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-tropical-teal-500"
                placeholder="e.g. Vietnam 🇻🇳" />
            </div>
            <div>
              <label className="block text-xs font-medium text-ash-grey-600 mb-1">Status</label>
              <select value={trip.status} onChange={e => set('status', e.target.value)}
                className="w-full border border-ash-grey-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-tropical-teal-500">
                {STATUSES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
              </select>
            </div>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-ash-grey-600 mb-1">Departure</label>
              <input type="date" value={trip.departureDate} onChange={e => set('departureDate', e.target.value)}
                className="w-full border border-ash-grey-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-tropical-teal-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-ash-grey-600 mb-1">Return</label>
              <input type="date" value={trip.returnDate} onChange={e => set('returnDate', e.target.value)}
                className="w-full border border-ash-grey-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-tropical-teal-500" />
            </div>
          </div>

          {/* Budget breakdown */}
          <div>
            <label className="block text-xs font-medium text-ash-grey-600 mb-2">Budget breakdown</label>
            <div className="border border-ash-grey-200 rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead><tr className="bg-ash-grey-50 text-xs text-ash-grey-500">
                  <th className="px-3 py-2 text-left">Category</th>
                  <th className="px-3 py-2 text-right">Budgeted £</th>
                  <th className="px-3 py-2 text-right">Actual £</th>
                </tr></thead>
                <tbody>
                  {[['flights','✈️ Flights'],['accommodation','🏨 Accommodation'],['onGround','🍜 On-ground']].map(([cat, label]) => (
                    <tr key={cat} className="border-t border-ash-grey-100">
                      <td className="px-3 py-2 text-ash-grey-700">{label}</td>
                      <td className="px-3 py-2">
                        <input type="number" min="0" value={trip.budget[cat].budgeted ?? ''}
                          onChange={e => setBudget(cat, 'budgeted', e.target.value)}
                          className="w-full text-right border border-ash-grey-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-tropical-teal-400" />
                      </td>
                      <td className="px-3 py-2">
                        <input type="number" min="0" value={trip.budget[cat].actual ?? ''}
                          onChange={e => setBudget(cat, 'actual', e.target.value)}
                          placeholder="—"
                          className="w-full text-right border border-ash-grey-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-tropical-teal-400" />
                      </td>
                    </tr>
                  ))}
                  <tr className="border-t-2 border-ash-grey-200 bg-ash-grey-50 font-semibold">
                    <td className="px-3 py-2 text-ash-grey-700">Total</td>
                    <td className="px-3 py-2 text-right text-tropical-teal-700">£{total(trip).toLocaleString('en-GB')}</td>
                    <td className="px-3 py-2 text-right text-ash-grey-500">
                      £{Object.values(trip.budget).reduce((s, b) => s + (b.actual || 0), 0).toLocaleString('en-GB')}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Amount already saved */}
          <div>
            <label className="block text-xs font-medium text-ash-grey-600 mb-1">Amount already saved (£)</label>
            <div className="relative">
              <span className="absolute left-3 top-2 text-ash-grey-400 text-sm">£</span>
              <input type="number" min="0" value={trip.savedAmount ?? 0}
                onChange={e => set('savedAmount', parseFloat(e.target.value) || 0)}
                className="w-full border border-ash-grey-300 rounded-lg pl-7 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-tropical-teal-500" />
            </div>
            <p className="text-xs text-ash-grey-400 mt-0.5">Money you've already set aside for this trip</p>
          </div>

          {/* Notes + URL */}
          <div>
            <label className="block text-xs font-medium text-ash-grey-600 mb-1">Notes</label>
            <textarea value={trip.notes} onChange={e => set('notes', e.target.value)} rows={2}
              className="w-full border border-ash-grey-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-tropical-teal-500"
              placeholder="Booking notes, reminders, itinerary details..." />
          </div>
          <div>
            <label className="block text-xs font-medium text-ash-grey-600 mb-1">Itinerary / booking link</label>
            <input type="url" value={trip.itineraryUrl} onChange={e => set('itineraryUrl', e.target.value)}
              className="w-full border border-ash-grey-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-tropical-teal-500"
              placeholder="https://..." />
          </div>

          {error && <p className="text-vibrant-coral-600 text-sm">{error}</p>}
        </div>

        <div className="sticky bottom-0 bg-white border-t border-ash-grey-100 px-6 py-4 flex gap-3">
          <button onClick={onClose} className="flex-1 border border-ash-grey-300 text-ash-grey-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-ash-grey-50">Cancel</button>
          <button onClick={handleSave} className="flex-1 bg-tropical-teal-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-tropical-teal-700">
            {initial ? 'Save Changes' : 'Add Trip'}
          </button>
        </div>
      </div>
    </div>
  )
}

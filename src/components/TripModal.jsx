import { useState } from 'react'

const STATUSES = ['planned', 'booked', 'completed']
const STATUS_COLOURS = { planned: 'bg-amber-100 text-amber-700', booked: 'bg-green-100 text-green-700', completed: 'bg-gray-100 text-gray-600' }

const EMPTY_TRIP = {
  destination: '', status: 'planned',
  departureDate: '', returnDate: '',
  budget: {
    flights:       { budgeted: 0, actual: null },
    accommodation: { budgeted: 0, actual: null },
    onGround:      { budgeted: 0, actual: null }
  },
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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-800">{initial ? 'Edit Trip' : 'Add Trip'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
        </div>

        <div className="p-6 space-y-5">
          {/* Destination + Status */}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Destination</label>
              <input type="text" value={trip.destination} onChange={e => set('destination', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g. Vietnam 🇻🇳" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
              <select value={trip.status} onChange={e => set('status', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                {STATUSES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
              </select>
            </div>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Departure</label>
              <input type="date" value={trip.departureDate} onChange={e => set('departureDate', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Return</label>
              <input type="date" value={trip.returnDate} onChange={e => set('returnDate', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>

          {/* Budget breakdown */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-2">Budget breakdown</label>
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead><tr className="bg-gray-50 text-xs text-gray-500">
                  <th className="px-3 py-2 text-left">Category</th>
                  <th className="px-3 py-2 text-right">Budgeted £</th>
                  <th className="px-3 py-2 text-right">Actual £</th>
                </tr></thead>
                <tbody>
                  {[['flights','✈️ Flights'],['accommodation','🏨 Accommodation'],['onGround','🍜 On-ground']].map(([cat, label]) => (
                    <tr key={cat} className="border-t border-gray-100">
                      <td className="px-3 py-2 text-gray-700">{label}</td>
                      <td className="px-3 py-2">
                        <input type="number" min="0" value={trip.budget[cat].budgeted ?? ''}
                          onChange={e => setBudget(cat, 'budgeted', e.target.value)}
                          className="w-full text-right border border-gray-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400" />
                      </td>
                      <td className="px-3 py-2">
                        <input type="number" min="0" value={trip.budget[cat].actual ?? ''}
                          onChange={e => setBudget(cat, 'actual', e.target.value)}
                          placeholder="—"
                          className="w-full text-right border border-gray-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400" />
                      </td>
                    </tr>
                  ))}
                  <tr className="border-t-2 border-gray-200 bg-gray-50 font-semibold">
                    <td className="px-3 py-2 text-gray-700">Total</td>
                    <td className="px-3 py-2 text-right text-blue-700">£{total(trip).toLocaleString('en-GB')}</td>
                    <td className="px-3 py-2 text-right text-gray-500">
                      £{Object.values(trip.budget).reduce((s, b) => s + (b.actual || 0), 0).toLocaleString('en-GB')}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Notes + URL */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
            <textarea value={trip.notes} onChange={e => set('notes', e.target.value)} rows={2}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Booking notes, reminders, itinerary details..." />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Itinerary / booking link</label>
            <input type="url" value={trip.itineraryUrl} onChange={e => set('itineraryUrl', e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="https://..." />
          </div>

          {error && <p className="text-red-600 text-sm">{error}</p>}
        </div>

        <div className="sticky bottom-0 bg-white border-t border-gray-100 px-6 py-4 flex gap-3">
          <button onClick={onClose} className="flex-1 border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50">Cancel</button>
          <button onClick={handleSave} className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">
            {initial ? 'Save Changes' : 'Add Trip'}
          </button>
        </div>
      </div>
    </div>
  )
}

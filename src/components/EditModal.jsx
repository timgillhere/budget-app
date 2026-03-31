import { useState, useEffect } from 'react'

export default function EditModal({ mode, initial, onSave, onClose }) {
  // mode: 'add-item' | 'edit-item' | 'add-group' | 'edit-group'
  const isGroup = mode === 'add-group' || mode === 'edit-group'

  const [name, setName] = useState(initial?.name || '')
  const [monthly, setMonthly] = useState(initial?.monthly?.toString() || '')
  const [notes, setNotes] = useState(initial?.notes || '')
  const [error, setError] = useState('')

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const handleSave = () => {
    if (!name.trim()) { setError('Name is required'); return }
    if (!isGroup) {
      const val = parseFloat(monthly)
      if (isNaN(val) || val < 0) { setError('Enter a valid amount (£)'); return }
      onSave({ name: name.trim(), monthly: val, notes: notes.trim() })
    } else {
      onSave({ name: name.trim() })
    }
  }

  const title = {
    'add-item': 'Add Line Item',
    'edit-item': 'Edit Line Item',
    'add-group': 'Add Group',
    'edit-group': 'Edit Group Name',
  }[mode]

  return (
    <div className="fixed inset-0 bg-ash-grey-950/60 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-ash-grey-800">{title}</h2>
          <button onClick={onClose} className="text-ash-grey-400 hover:text-ash-grey-600 text-2xl leading-none">&times;</button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-ash-grey-700 mb-1">
              {isGroup ? 'Group name' : 'Item name'}
            </label>
            <input
              autoFocus
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && isGroup) handleSave() }}
              className="w-full border border-ash-grey-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-tropical-teal-500"
              placeholder={isGroup ? 'e.g. Space 13: New Category' : 'e.g. Gym Membership'}
            />
          </div>

          {!isGroup && (
            <>
              <div>
                <label className="block text-sm font-medium text-ash-grey-700 mb-1">Monthly amount (£)</label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-ash-grey-500 text-sm">£</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={monthly}
                    onChange={e => setMonthly(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleSave() }}
                    className="w-full border border-ash-grey-300 rounded-lg pl-7 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-tropical-teal-500"
                    placeholder="0.00"
                  />
                </div>
                {monthly && !isNaN(parseFloat(monthly)) && (
                  <p className="text-xs text-ash-grey-500 mt-1">
                    Annual: £{(parseFloat(monthly) * 12).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-ash-grey-700 mb-1">Notes (optional)</label>
                <input
                  type="text"
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleSave() }}
                  className="w-full border border-ash-grey-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-tropical-teal-500"
                  placeholder="e.g. Increases to £66 in April"
                />
              </div>
            </>
          )}

          {error && <p className="text-vibrant-coral-600 text-sm">{error}</p>}
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 border border-ash-grey-300 text-ash-grey-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-ash-grey-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="flex-1 bg-tropical-teal-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-tropical-teal-700"
          >
            {mode.startsWith('add') ? 'Add' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}

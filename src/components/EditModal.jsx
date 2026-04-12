import { useState, useEffect } from 'react'
import { stripPrefix } from '../utils/budgetCalcs'

const GROUP_COLORS = [
  '#3b6aef', '#2E75B6', '#C55A11', '#7030A0',
  '#059669', '#dc2626', '#d97706', '#0891b2',
  '#7c3aed', '#db2777', '#65a30d', '#6b7280',
]

const SECTION_COLORS = [
  '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7',
  '#ec4899', '#ef4444', '#f97316', '#f59e0b',
  '#84cc16', '#22c55e', '#10b981', '#14b8a6',
  '#06b6d4', '#0ea5e9', '#64748b', '#94a3b8',
]

export default function EditModal({ mode, initial, onSave, onClose, onDelete }) {
  const isGroup = mode === 'add-group' || mode === 'edit-group'
  const isSection = mode === 'edit-section'

  const [name, setName] = useState(isGroup ? stripPrefix(initial?.name || '') : (initial?.name || ''))
  const [monthly, setMonthly] = useState(initial?.monthly?.toString() || '')
  const [notes, setNotes] = useState(initial?.notes || '')
  const [savingsType, setSavingsType] = useState(
    initial?.savingsType === 'longterm' ? 'annual' : (initial?.savingsType ?? (initial?.isSavings ? 'annual' : null))
  )
  const [currentBalance, setCurrentBalance] = useState(initial?.currentBalance?.toString() || '')
  const [color, setColor] = useState(initial?.color || '')
  const [error, setError] = useState('')

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const handleSave = () => {
    if (!name.trim()) { setError('Name is required'); return }
    if (isSection) {
      onSave({ name: name.trim(), color: color || null })
    } else if (!isGroup) {
      const val = parseFloat(monthly)
      if (isNaN(val) || val < 0) { setError('Enter a valid amount (£)'); return }
      onSave({ name: name.trim(), monthly: val, notes: notes.trim(), savingsType, isSavings: savingsType !== null })
    } else {
      let balanceVal = null
      if (currentBalance.trim() !== '') {
        balanceVal = parseFloat(currentBalance)
        if (isNaN(balanceVal) || balanceVal < 0) { setError('Enter a valid balance (£) or leave blank'); return }
      }
      onSave({ name: name.trim(), savingsType, isSavings: savingsType !== null, currentBalance: balanceVal, color: color || null })
    }
  }

  const title = {
    'add-item': 'Add Line Item',
    'edit-item': 'Edit Line Item',
    'add-group': 'Add Group',
    'edit-group': 'Edit Group',
    'edit-section': 'Edit Section',
  }[mode]

  const inputCls = "w-full bg-nb-800 text-slate-100 rounded-lg px-3 py-3 sm:py-2 text-base sm:text-sm placeholder-slate-600 neon-input"

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex sm:items-center sm:justify-center sm:p-4" onClick={onClose}>
      {/* Bottom sheet on mobile, centered dialog on sm+ */}
      <div
        className="sheet-enter sm:[animation:none] fixed sm:relative inset-x-0 bottom-0 sm:inset-auto bg-nb-750 rounded-t-2xl sm:rounded-xl border border-nb-600 shadow-2xl w-full sm:max-w-md max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Drag handle (mobile only) */}
        <div className="sm:hidden flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-nb-500" />
        </div>

        <div className="px-6 pt-4 sm:pt-6 pb-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-bold text-slate-100">{title}</h2>
            <button onClick={onClose} className="text-slate-500 hover:text-slate-200 text-2xl leading-none transition-colors">&times;</button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">
                {isSection ? 'Section name' : isGroup ? 'Group name' : 'Item name'}
              </label>
              <input
                autoFocus
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && (isGroup || isSection)) handleSave() }}
                className={inputCls}
                placeholder={isSection ? 'e.g. Starling Spaces' : isGroup ? 'e.g. Groceries' : 'e.g. Gym Membership'}
              />
            </div>

            {isSection && (
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-2">
                  Section colour
                </label>
                <div className="flex flex-wrap gap-2">
                  {SECTION_COLORS.map(c => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setColor(c)}
                      className={`w-7 h-7 rounded-full border-2 transition-all ${color === c ? 'border-white scale-110' : 'border-transparent hover:scale-105'}`}
                      style={{ backgroundColor: c }}
                      title={c}
                    />
                  ))}
                </div>
                {color && (
                  <div className="mt-3 h-2 rounded-full" style={{ backgroundColor: color }} />
                )}
              </div>
            )}

            {!isSection && (
              <div>
                <div className="text-sm font-medium text-slate-400 mb-2">Type</div>
                <div className="flex gap-1.5">
                  {[
                    { value: null,       label: 'Spending',       style: savingsType === null      ? 'bg-nb-700 border-nb-400 text-slate-200' : 'bg-nb-800 border-nb-600 text-slate-500 hover:border-nb-400' },
                    { value: 'annual',   label: 'Annual Fund',    style: savingsType === 'annual'   ? 'bg-amber-900/30 border-amber-600 text-amber-300' : 'bg-nb-800 border-nb-600 text-slate-500 hover:border-amber-800' },
                  ].map(opt => (
                    <button
                      key={String(opt.value)}
                      type="button"
                      onClick={() => setSavingsType(opt.value)}
                      className={`flex-1 px-2 py-2 rounded-lg border text-xs font-medium transition-colors ${opt.style}`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <div className="text-xs text-slate-600 mt-1.5">
                  {savingsType === null      && 'Counted as an expense'}
                  {savingsType === 'annual'  && 'Set aside for known annual costs — not counted in savings rate'}
                </div>
              </div>
            )}

            {isGroup && (
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-2">
                  Group colour <span className="text-xs font-normal text-slate-600">optional — defaults to section colour</span>
                </label>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setColor('')}
                    className={`w-7 h-7 rounded-full border-2 bg-nb-700 flex items-center justify-center transition-all ${!color ? 'border-white scale-110' : 'border-nb-500 hover:border-nb-400'}`}
                    title="Use section colour"
                  >
                    <span className="text-slate-400 text-xs leading-none">×</span>
                  </button>
                  {GROUP_COLORS.map(c => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setColor(c)}
                      className={`w-7 h-7 rounded-full border-2 transition-all ${color === c ? 'border-white scale-110' : 'border-transparent hover:scale-105'}`}
                      style={{ backgroundColor: c }}
                      title={c}
                    />
                  ))}
                </div>
              </div>
            )}

            {mode === 'edit-group' && (
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">
                  Current balance in pot (£)
                  <span className="ml-1.5 text-xs font-normal text-slate-600">optional</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-3 sm:top-2.5 text-slate-500 text-sm">£</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={currentBalance}
                    onChange={e => setCurrentBalance(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleSave() }}
                    className={`${inputCls} pl-7`}
                    placeholder="e.g. 450.00"
                  />
                </div>
                <p className="text-xs text-slate-600 mt-1">Money already sitting in this pot. Leave blank to hide.</p>
              </div>
            )}

            {!isGroup && !isSection && (
              <>
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1">Monthly amount (£)</label>
                  <div className="relative">
                    <span className="absolute left-3 top-3 sm:top-2.5 text-slate-500 text-sm">£</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={monthly}
                      onChange={e => setMonthly(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') handleSave() }}
                      className={`${inputCls} pl-7`}
                      placeholder="0.00"
                    />
                  </div>
                  {monthly && !isNaN(parseFloat(monthly)) && (
                    <p className="text-xs text-slate-500 mt-1">
                      Annual: £{(parseFloat(monthly) * 12).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1">Notes (optional)</label>
                  <input
                    type="text"
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleSave() }}
                    className={inputCls}
                    placeholder="e.g. Increases to £66 in April"
                  />
                </div>
              </>
            )}

            {error && <p className="text-red-400 text-sm">{error}</p>}
          </div>

          <div className="flex gap-3 mt-6">
            {onDelete && (
              <button
                onClick={onDelete}
                className="px-4 py-2.5 sm:py-2 min-h-11 sm:min-h-0 rounded-lg text-sm font-medium text-red-400 border border-red-900/60 hover:bg-red-900/20 transition-colors"
              >
                Delete
              </button>
            )}
            <button
              onClick={onClose}
              className="flex-1 border border-nb-500 text-slate-400 hover:text-slate-200 px-4 py-2.5 sm:py-2 min-h-11 sm:min-h-0 rounded-lg text-sm font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="flex-1 bg-neuro-600 hover:bg-neuro-500 text-white px-4 py-2.5 sm:py-2 min-h-11 sm:min-h-0 rounded-lg text-sm font-medium transition-colors"
            >
              {mode.startsWith('add') ? 'Add' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

import { useState } from 'react'
import { PencilSquareIcon, TrashIcon, PlusIcon, BuildingLibraryIcon, ChevronDownIcon, ChevronRightIcon } from '@heroicons/react/24/outline'
import ItemRow from './ItemRow'
import EditModal from './EditModal'
import { isSavingsGroup } from '../utils/budgetCalcs'

const fmt = (n) => `£${n.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

function Cols() {
  return (
    <colgroup>
      <col style={{ width: '55%' }} />
      <col style={{ width: '17%' }} />
      <col style={{ width: '17%' }} />
      <col style={{ width: '11%' }} />
    </colgroup>
  )
}

export default function BudgetSection({ section, onAddItem, onEditItem, onDeleteItem, onAddGroup, onEditGroup, onDeleteGroup }) {
  const [collapsed, setCollapsed] = useState(false)
  const [modal, setModal] = useState(null)

  const sectionTotal = section.groups.reduce((s, g) =>
    s + g.items.reduce((gs, i) => gs + i.monthly, 0), 0)

  const handleModalSave = (data) => {
    const { mode, groupId, item } = modal
    if (mode === 'add-item')   onAddItem(groupId, data)
    else if (mode === 'edit-item')  onEditItem(groupId, item.id, data)
    else if (mode === 'add-group')  onAddGroup({ name: data.name, isSavings: data.isSavings })
    else if (mode === 'edit-group') onEditGroup(groupId, { name: data.name, isSavings: data.isSavings, currentBalance: data.currentBalance })
    setModal(null)
  }

  return (
    <div
      className="bg-nb-750 rounded-xl overflow-hidden"
      style={{
        border: `1px solid ${section.color}40`,
        boxShadow: `0 0 30px ${section.color}18, 0 0 0 1px ${section.color}20`,
      }}
    >

      {/* Section header */}
      <div
        className="flex items-center justify-between px-4 py-3 cursor-pointer select-none"
        style={{ backgroundColor: section.color }}
        onClick={() => setCollapsed(c => !c)}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-white font-bold text-base truncate">{section.name}</span>
          <span className="text-white/80 text-sm font-medium flex-shrink-0">{fmt(sectionTotal)}/mo</span>
          <span className="text-white/60 text-xs flex-shrink-0 hidden sm:inline">({fmt(sectionTotal * 12)}/yr)</span>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0 ml-2">
          <button
            onClick={e => { e.stopPropagation(); setModal({ mode: 'add-group' }) }}
            className="text-white/80 hover:text-white text-xs border border-white/40 hover:border-white px-2 py-1 rounded transition-colors"
          >
            + Add Group
          </button>
          {collapsed ? <ChevronRightIcon className="w-4 h-4 text-white/80" /> : <ChevronDownIcon className="w-4 h-4 text-white/80" />}
        </div>
      </div>

      {!collapsed && (
        <div className="divide-y divide-nb-600">

          {section.groups.map(group => {
            const groupTotal = group.items.reduce((s, i) => s + i.monthly, 0)
            const groupIsSavings = isSavingsGroup(group)
            return (
              <div key={group.id}>

                {/* Group header */}
                <div className="flex items-center justify-between px-3 sm:px-5 py-2 gap-2 bg-nb-700">
                  <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                    <span className="text-sm font-semibold text-slate-200 truncate">{group.name}</span>
                    {groupIsSavings && (
                      <span className="inline-flex items-center gap-1 text-xs bg-emerald-900/40 text-emerald-400 border border-emerald-800/60 px-1.5 py-0.5 rounded-full leading-none flex-shrink-0">
                        <BuildingLibraryIcon className="w-3 h-3" />
                      </span>
                    )}
                    {group.currentBalance != null && (
                      <span className="text-xs bg-nb-600 text-cyan-400 border border-nb-500 px-1.5 py-0.5 rounded-full leading-none tabular-nums flex-shrink-0">
                        {fmt(group.currentBalance)}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <span className="text-sm font-semibold text-slate-400 tabular-nums neon-white mr-1">{fmt(groupTotal)}/mo</span>
                    <button
                      onClick={() => setModal({ mode: 'add-item', groupId: group.id })}
                      className="text-slate-500 hover:text-slate-200 border border-nb-500 hover:border-nb-400 inline-flex items-center justify-center min-w-11 min-h-11 sm:min-w-0 sm:min-h-0 sm:p-1.5 p-2 rounded transition-colors"
                    >
                      <PlusIcon className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setModal({ mode: 'edit-group', groupId: group.id, item: { name: group.name, isSavings: groupIsSavings, currentBalance: group.currentBalance } })}
                      className="text-slate-500 hover:text-neuro-400 inline-flex items-center justify-center min-w-11 min-h-11 sm:min-w-0 sm:min-h-0 sm:p-1.5 p-2 rounded transition-colors"
                    >
                      <PencilSquareIcon className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => {
                        if (group.items.length > 0 && !window.confirm(`Delete "${group.name}" and all ${group.items.length} item(s)?`)) return
                        onDeleteGroup(group.id)
                      }}
                      className="text-slate-500 hover:text-red-400 inline-flex items-center justify-center min-w-11 min-h-11 sm:min-w-0 sm:min-h-0 sm:p-1.5 p-2 rounded transition-colors"
                    >
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Items */}
                {group.items.length > 0 ? (
                  <>
                    {/* Mobile: tap-row-to-edit list */}
                    <ul className="sm:hidden divide-y divide-nb-700">
                      {group.items.map(item => (
                        <li key={item.id}>
                          <button
                            type="button"
                            onClick={() => setModal({ mode: 'edit-item', groupId: group.id, item })}
                            className="w-full flex items-center justify-between gap-3 px-4 py-3.5 min-h-[56px] text-left active:bg-nb-700 transition-colors border-l-2"
                            style={{ borderLeftColor: `${section.color}66` }}
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5">
                                <span className="text-[15px] text-slate-200 truncate">{item.name}</span>
                                {item.isSavings && !groupIsSavings && <BuildingLibraryIcon className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />}
                              </div>
                              <div className="text-xs text-slate-500 tabular-nums">{fmt(item.monthly * 12)}/yr</div>
                            </div>
                            <div className="flex items-center gap-1.5 flex-shrink-0">
                              <span className="text-base font-bold text-slate-100 tabular-nums neon-white">{fmt(item.monthly)}</span>
                              <ChevronRightIcon className="w-4 h-4 text-slate-600" />
                            </div>
                          </button>
                        </li>
                      ))}
                      <div className="flex items-center justify-between px-4 py-2 bg-nb-800 border-t border-nb-600">
                        <span className="text-xs font-semibold text-slate-500">Subtotal</span>
                        <span className="text-xs font-bold text-slate-300 tabular-nums">{fmt(groupTotal)}</span>
                      </div>
                    </ul>

                    {/* Desktop: full table */}
                    <div className="hidden sm:block overflow-x-auto">
                      <table className="w-full table-fixed" style={{ minWidth: '380px' }}>
                        <Cols />
                        <thead>
                          <tr className="text-xs text-slate-600 border-b border-nb-600">
                            <th className="px-4 py-1.5 text-left font-medium">Item</th>
                            <th className="px-4 py-1.5 text-right font-medium">Monthly</th>
                            <th className="px-4 py-1.5 text-right font-medium">Annual</th>
                            <th className="px-4 py-1.5"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {group.items.map(item => (
                            <ItemRow
                              key={item.id}
                              item={item}
                              groupIsSavings={groupIsSavings}
                              onEdit={(item) => setModal({ mode: 'edit-item', groupId: group.id, item })}
                              onDelete={(id) => onDeleteItem(group.id, id)}
                            />
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="border-t border-nb-600 bg-nb-800">
                            <td className="px-4 py-1.5 text-xs font-semibold text-slate-500">Subtotal</td>
                            <td className="px-4 py-1.5 text-xs font-bold text-slate-300 text-right tabular-nums">{fmt(groupTotal)}</td>
                            <td className="px-4 py-1.5 text-xs font-semibold text-slate-500 text-right tabular-nums">{fmt(groupTotal * 12)}</td>
                            <td></td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </>
                ) : (
                  <div className="px-5 py-3 text-sm text-slate-600 italic">
                    No items yet —{' '}
                    <button onClick={() => setModal({ mode: 'add-item', groupId: group.id })} className="text-neuro-400 hover:text-neuro-300 hover:underline transition-colors">
                      add one
                    </button>
                  </div>
                )}
              </div>
            )
          })}

          {/* Section total footer */}
          <div className="flex items-center justify-between px-4 py-2 bg-nb-800 border-t border-nb-600">
            <span className="text-sm font-bold text-slate-400">Section Total</span>
            <div className="flex items-center gap-3">
              <span className="text-sm font-bold text-slate-200 tabular-nums neon-white">{fmt(sectionTotal)}</span>
              <span className="text-sm text-slate-500 tabular-nums hidden sm:inline">{fmt(sectionTotal * 12)}/yr</span>
            </div>
          </div>

        </div>
      )}

      {modal && (
        <EditModal
          mode={modal.mode}
          initial={modal.item}
          onSave={handleModalSave}
          onClose={() => setModal(null)}
          onDelete={modal.mode === 'edit-item' ? () => { onDeleteItem(modal.groupId, modal.item.id); setModal(null) } : undefined}
        />
      )}
    </div>
  )
}

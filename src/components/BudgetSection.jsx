import { useState } from 'react'
import ItemRow from './ItemRow'
import EditModal from './EditModal'
import { isSavingsGroup } from '../utils/budgetCalcs'

const fmt = (n) => `£${n.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

// Shared colgroup — identical in every table so columns lock across groups
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
    <div className="bg-white rounded-xl shadow-sm border border-ash-grey-200 overflow-hidden">

      {/* Section header */}
      <div
        className="flex items-center justify-between px-5 py-3 cursor-pointer select-none"
        style={{ backgroundColor: section.color }}
        onClick={() => setCollapsed(c => !c)}
      >
        <div className="flex items-center gap-3">
          <span className="text-white font-bold text-base">{section.name}</span>
          <span className="text-white/80 text-sm font-medium">{fmt(sectionTotal)}/month</span>
          <span className="text-white/60 text-xs">({fmt(sectionTotal * 12)}/year)</span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={e => { e.stopPropagation(); setModal({ mode: 'add-group' }) }}
            className="text-white/80 hover:text-white text-xs border border-white/40 hover:border-white px-2 py-1 rounded"
          >
            + Add Group
          </button>
          <span className="text-white/80 text-lg">{collapsed ? '▶' : '▼'}</span>
        </div>
      </div>

      {!collapsed && (
        <div className="divide-y divide-ash-grey-100">

          {section.groups.map(group => {
            const groupTotal = group.items.reduce((s, i) => s + i.monthly, 0)
            return (
              <div key={group.id}>

                {/* Group header */}
                <div
                  className="flex items-center justify-between px-5 py-2"
                  style={{ backgroundColor: section.bgLight }}
                >
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-ash-grey-700">{group.name}</span>
                    {isSavingsGroup(group) && (
                      <span className="text-xs bg-soft-linen-100 text-soft-linen-700 border border-soft-linen-200 px-1.5 py-0.5 rounded-full leading-none">🏦 saving</span>
                    )}
                    {group.currentBalance != null && (
                      <span className="text-xs bg-tropical-teal-50 text-tropical-teal-700 border border-tropical-teal-200 px-1.5 py-0.5 rounded-full leading-none tabular-nums">
                        {fmt(group.currentBalance)} in pot
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold text-ash-grey-600 tabular-nums">{fmt(groupTotal)}/mo</span>
                    <button
                      onClick={() => setModal({ mode: 'add-item', groupId: group.id })}
                      className="text-xs text-ash-grey-500 hover:text-ash-grey-800 border border-ash-grey-300 hover:border-ash-grey-500 px-2 py-0.5 rounded"
                    >
                      + Item
                    </button>
                    <button
                      onClick={() => setModal({ mode: 'edit-group', groupId: group.id, item: { name: group.name, isSavings: isSavingsGroup(group), currentBalance: group.currentBalance } })}
                      className="text-xs text-ash-grey-400 hover:text-tropical-teal-600"
                    >
                      ✏️
                    </button>
                    <button
                      onClick={() => {
                        if (group.items.length > 0 && !window.confirm(`Delete "${group.name}" and all ${group.items.length} item(s)?`)) return
                        onDeleteGroup(group.id)
                      }}
                      className="text-xs text-ash-grey-400 hover:text-vibrant-coral-600"
                    >
                      🗑️
                    </button>
                  </div>
                </div>

                {/* Items */}
                {group.items.length > 0 ? (
                  <table className="w-full table-fixed">
                    <Cols />
                    <thead>
                      <tr className="text-xs text-ash-grey-400 border-b border-ash-grey-100">
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
                          groupIsSavings={isSavingsGroup(group)}
                          onEdit={(item) => setModal({ mode: 'edit-item', groupId: group.id, item })}
                          onDelete={(id) => onDeleteItem(group.id, id)}
                        />
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t border-ash-grey-100 bg-ash-grey-50">
                        <td className="px-4 py-1.5 text-xs font-semibold text-ash-grey-500">Subtotal</td>
                        <td className="px-4 py-1.5 text-xs font-bold text-ash-grey-700 text-right tabular-nums">{fmt(groupTotal)}</td>
                        <td className="px-4 py-1.5 text-xs font-semibold text-ash-grey-500 text-right tabular-nums">{fmt(groupTotal * 12)}</td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                ) : (
                  <div className="px-5 py-3 text-sm text-ash-grey-400 italic">
                    No items yet —{' '}
                    <button onClick={() => setModal({ mode: 'add-item', groupId: group.id })} className="text-tropical-teal-500 hover:underline">
                      add one
                    </button>
                  </div>
                )}
              </div>
            )
          })}

          {/* Section total footer — columns match table above */}
          <table className="w-full table-fixed bg-ash-grey-50 border-t border-ash-grey-200">
            <Cols />
            <tbody>
              <tr>
                <td className="px-4 py-2 text-sm font-bold text-ash-grey-700">Section Total</td>
                <td className="px-4 py-2 text-sm font-bold text-ash-grey-700 text-right tabular-nums">{fmt(sectionTotal)}</td>
                <td className="px-4 py-2 text-sm text-ash-grey-500 text-right tabular-nums">{fmt(sectionTotal * 12)}</td>
                <td></td>
              </tr>
            </tbody>
          </table>

        </div>
      )}

      {modal && (
        <EditModal
          mode={modal.mode}
          initial={modal.item}
          onSave={handleModalSave}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  )
}

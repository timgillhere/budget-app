import { useState, useMemo } from 'react'
import { ChevronDownIcon, ChevronRightIcon } from '@heroicons/react/24/outline'
import { isSavingsGroup, isAnnualFundGroup, stripPrefix, spentByGroupName } from '../utils/budgetCalcs'
import { useTransactions } from '../context/TransactionContext'

const fmt = (n) => `£${n.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const fmt0 = (n) => `£${Math.round(n).toLocaleString('en-GB')}`

// Plain-text kind label — clearer than an icon-only badge.
function kindLabel(groupIsSavings, groupSavingsType, item) {
  const annual = groupSavingsType === 'annual' || item?.savingsType === 'annual'
  const saving = groupIsSavings || item?.isSavings || item?.savingsType
  if (!saving) return null
  return annual
    ? { text: 'Annual fund', cls: 'text-amber-400 bg-amber-900/30 border-amber-700/40' }
    : { text: 'Savings', cls: 'text-emerald-400 bg-emerald-900/30 border-emerald-800/40' }
}

function Tag({ kind }) {
  if (!kind) return null
  return <span className={`text-[11px] leading-none px-1.5 py-1 rounded border flex-shrink-0 ${kind.cls}`}>{kind.text}</span>
}

function Amounts({ monthly, big }) {
  return (
    <div className="text-right flex-shrink-0">
      <div className={`tabular-nums font-semibold text-slate-100 ${big ? 'text-lg' : 'text-base'}`}>{fmt(monthly)}</div>
      <div className="text-xs text-slate-500 tabular-nums">{fmt0(monthly * 12)}/yr</div>
    </div>
  )
}

export default function BudgetSection({ section, totalIncome = 0 }) {
  const [collapsed, setCollapsed] = useState(false)

  const sectionTotal = section.groups.reduce((s, g) => s + g.items.reduce((gs, i) => gs + i.monthly, 0), 0)
  const share = totalIncome > 0 ? (sectionTotal / totalIncome) * 100 : 0

  // Actual spend per space (group name), from the active month's imported transactions.
  const { transactions } = useTransactions()
  const spentByGroup = useMemo(() => spentByGroupName(transactions), [transactions])

  return (
    <section
      className="bg-nb-750 rounded-xl overflow-hidden"
      style={{ border: `1px solid ${section.color}40`, boxShadow: `0 0 30px ${section.color}18` }}
    >
      <button
        type="button"
        onClick={() => setCollapsed(c => !c)}
        className="w-full text-left px-4 sm:px-5 py-3.5 flex items-center gap-3"
        style={{ backgroundColor: section.color }}
      >
        <div className="min-w-0 flex-1">
          <div className="text-white font-bold text-lg truncate">{section.name}</div>
          <div className="text-white/75 text-xs">
            {share > 0 && `${share.toFixed(0)}% of income · `}{fmt0(sectionTotal * 12)}/yr
          </div>
        </div>
        <div className="text-white font-bold text-xl tabular-nums flex-shrink-0">
          {fmt(sectionTotal)}<span className="text-white/70 text-sm font-medium">/mo</span>
        </div>
        {collapsed ? <ChevronRightIcon className="w-5 h-5 text-white/80 flex-shrink-0" /> : <ChevronDownIcon className="w-5 h-5 text-white/80 flex-shrink-0" />}
      </button>

      {!collapsed && (
        <ul className="divide-y divide-nb-600">
          {section.groups.map(group => {
            const groupTotal = group.items.reduce((s, i) => s + i.monthly, 0)
            const groupIsSavings = isSavingsGroup(group)
            const groupSavingsType = groupIsSavings ? (isAnnualFundGroup(group) ? 'annual' : 'longterm') : null
            const color = group.color || section.color
            const spent = spentByGroup[group.name] || 0
            const groupName = stripPrefix(group.name)
            const single = group.items.length === 1 ? group.items[0] : null
            const singleDiffers = single && single.name.trim().toLowerCase() !== groupName.trim().toLowerCase()
            const kind = kindLabel(groupIsSavings, groupSavingsType, single)
            const multi = group.items.length > 1

            return (
              <li key={group.id} className="px-4 sm:px-5 py-3.5 border-l-4" style={{ borderLeftColor: color }}>
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-base font-semibold text-slate-100">{groupName}</h3>
                      <Tag kind={kind} />
                    </div>
                    {singleDiffers && <div className="text-sm text-slate-400 mt-0.5">{single.name}</div>}
                    {single?.notes && <div className="text-xs text-slate-500 mt-1 leading-relaxed">{single.notes}</div>}
                    {spent > 0 && (
                      <div className="text-xs text-amber-400 mt-1 tabular-nums">{fmt(spent)} spent this month</div>
                    )}
                    {group.items.length === 0 && <div className="text-sm text-slate-600 italic mt-0.5">No items</div>}
                  </div>
                  {group.items.length > 0 && <Amounts monthly={groupTotal} big />}
                </div>

                {multi && (
                  <ul className="mt-2.5 ml-1 pl-3 border-l border-nb-600 space-y-2">
                    {group.items.map(item => {
                      const itemKind = kindLabel(groupIsSavings, groupSavingsType, item)
                      return (
                        <li key={item.id} className="flex items-start justify-between gap-4">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm text-slate-300">{item.name}</span>
                              <Tag kind={itemKind} />
                            </div>
                            {item.notes && <div className="text-xs text-slate-500 mt-0.5 leading-relaxed">{item.notes}</div>}
                          </div>
                          <div className="text-right flex-shrink-0">
                            <div className="text-sm tabular-nums text-slate-200">{fmt(item.monthly)}</div>
                            <div className="text-[11px] text-slate-600 tabular-nums">{fmt0(item.monthly * 12)}/yr</div>
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

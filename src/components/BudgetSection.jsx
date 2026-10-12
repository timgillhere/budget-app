import { useState } from 'react'
import { ChevronDownIcon, ChevronRightIcon, InformationCircleIcon } from '@heroicons/react/24/outline'
import { stripPrefix } from '../utils/budgetCalcs'

const fmt = (n) => `£${n.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

// The Current Account section is folded into the Income box on the Budget page.
export const isCurrentAccount = (section) => section.id === 'current' || /current account/i.test(section.name)

// Monthly figure; hovering (or tapping) shows the yearly total.
export function Monthly({ amount, className = '' }) {
  return (
    <span className="relative group/tip inline-block outline-none cursor-default" tabIndex={0}>
      <span className={`tabular-nums ${className}`}>{fmt(amount)}</span>
      <span className="pointer-events-none absolute top-full right-0 mt-1.5 whitespace-nowrap rounded-lg bg-nb-800 border border-nb-600 px-3 py-2 text-xs font-normal text-slate-200 shadow-xl opacity-0 group-hover/tip:opacity-100 group-focus/tip:opacity-100 transition-opacity duration-150 z-50">
        <span className="text-slate-400">Per year: </span>{fmt(amount * 12)}
      </span>
    </span>
  )
}

// Info icon next to a name; hovering (or tapping) shows its description.
export function NoteTip({ note }) {
  if (!note) return null
  return (
    <span className="relative group/tip inline-flex align-middle outline-none cursor-default" tabIndex={0} aria-label={note}>
      <InformationCircleIcon className="w-4 h-4 text-slate-500 group-hover/tip:text-slate-300 group-focus/tip:text-slate-300 transition-colors" />
      <span className="pointer-events-none absolute top-full left-0 mt-1.5 w-60 whitespace-normal rounded-lg bg-nb-800 border border-nb-600 px-3 py-2 text-xs font-normal text-slate-200 leading-relaxed shadow-xl opacity-0 group-hover/tip:opacity-100 group-focus/tip:opacity-100 transition-opacity duration-150 z-50">
        {note}
      </span>
    </span>
  )
}

// Every row is the same shape: name (+ optional note) on the left, monthly over yearly on the right.
function Row({ name, note, monthly, className = '', nameClass = '', amountClass = '' }) {
  return (
    <div className={`flex items-start justify-between gap-4 ${className}`}>
      <div className="min-w-0 flex-1">
        <div className={`${nameClass} flex items-center gap-1.5`}>
          <span>{name}</span>
          <NoteTip note={note} />
        </div>
      </div>
      <div className="text-right flex-shrink-0">
        <Monthly amount={monthly} className={amountClass} />
      </div>
    </div>
  )
}

// Group rows (group + indented items), shared by section cards and the Income box.
export function GroupRows({ section }) {
  return (
    <>
      {section.groups.map(group => {
        const groupTotal = group.items.reduce((s, i) => s + i.monthly, 0)
        return (
          <li key={group.id} className="px-4 sm:px-5 py-3.5 border-l-4" style={{ borderLeftColor: group.color || section.color }}>
            <Row
              name={stripPrefix(group.name)} monthly={groupTotal}
              nameClass="text-base font-semibold text-slate-100" amountClass="text-base font-semibold text-slate-100"
            />
            {group.items.length > 0 && (
              <ul className="mt-2.5 pl-3 border-l border-nb-600 space-y-2">
                {group.items.map(item => (
                  <li key={item.id}>
                    <Row
                      name={item.name} note={item.notes} monthly={item.monthly}
                      nameClass="text-sm text-slate-300" amountClass="text-sm text-slate-300"
                    />
                  </li>
                ))}
              </ul>
            )}
          </li>
        )
      })}
    </>
  )
}

export default function BudgetSection({ section }) {
  const [collapsed, setCollapsed] = useState(false)
  const sectionTotal = section.groups.reduce((s, g) => s + g.items.reduce((gs, i) => gs + i.monthly, 0), 0)

  return (
    <section
      className="bg-nb-750 rounded-xl"
      style={{ border: `1px solid ${section.color}40`, boxShadow: `0 0 30px ${section.color}18` }}
    >
      <button
        type="button"
        onClick={() => setCollapsed(c => !c)}
        className="w-full text-left px-4 sm:px-5 py-3.5 flex items-center gap-3 rounded-t-xl"
        style={{ backgroundColor: section.color }}
      >
        <div className="min-w-0 flex-1">
          <div className="text-white font-bold text-lg truncate">{section.name}</div>
        </div>
        <div className="text-right flex-shrink-0">
          <Monthly amount={sectionTotal} className="text-white font-bold text-lg" />
        </div>
        {collapsed ? <ChevronRightIcon className="w-5 h-5 text-white/80 flex-shrink-0" /> : <ChevronDownIcon className="w-5 h-5 text-white/80 flex-shrink-0" />}
      </button>

      {!collapsed && (
        <ul className="divide-y divide-nb-600">
          <GroupRows section={section} />
        </ul>
      )}
    </section>
  )
}

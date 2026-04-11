import { BuildingLibraryIcon, BanknotesIcon, ChevronUpIcon, ChevronDownIcon } from '@heroicons/react/24/outline'
const fmt = (n) => `£${n.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export default function ItemRow({ item, groupIsSavings, onEdit, onDelete, indent = false, small = false, onMoveUp, onMoveDown }) {
  const isSav = groupIsSavings || item.isSavings

  return (
    <tr className="group hover:bg-nb-700 transition-colors">
      <td className={`${indent ? 'pl-6 pr-4' : 'px-4'} py-2 ${small ? 'text-xs text-slate-400' : 'text-sm text-slate-400'}`} style={{ width: '55%' }}>
        <div className="relative inline-flex items-center gap-1.5 max-w-full">
          {isSav ? (
            <span className="inline-flex items-center text-xs bg-emerald-900/40 text-emerald-400 border border-emerald-800/60 px-1 py-0.5 rounded-full leading-none flex-shrink-0">
              <BuildingLibraryIcon className="w-3 h-3" />
            </span>
          ) : (
            <BanknotesIcon className="w-3.5 h-3.5 text-amber-500/70 flex-shrink-0" />
          )}
          <span className="truncate">{item.name}</span>
          {item.notes && (
            <span className="relative flex-shrink-0 group/tip">
              <span className="text-slate-600 hover:text-slate-400 cursor-default text-xs select-none">ℹ</span>
              <span className="
                pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-2
                bg-nb-800 border border-nb-600 text-slate-200 text-xs rounded-lg px-3 py-2 w-56 leading-relaxed z-50
                opacity-0 group-hover/tip:opacity-100 transition-opacity duration-150 whitespace-normal shadow-xl
              ">
                {item.notes}
                <span className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-nb-800" />
              </span>
            </span>
          )}
        </div>
      </td>
      <td className={`px-4 py-2 ${small ? 'text-xs text-slate-300' : 'text-sm text-slate-300'} text-right font-medium tabular-nums neon-white`} style={{ width: '17%' }}>
        {fmt(item.monthly)}
      </td>
      <td className={`px-4 py-2 ${small ? 'text-xs text-slate-500' : 'text-sm text-slate-500'} text-right tabular-nums`} style={{ width: '17%' }}>
        {fmt(item.monthly * 12)}
      </td>
      <td className="px-4 py-2 text-right" style={{ width: '11%' }}>
        <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {onMoveUp && (
            <button onClick={onMoveUp} className="text-slate-500 hover:text-slate-300 p-1 rounded hover:bg-nb-700 transition-colors" title="Move up">
              <ChevronUpIcon className="w-3 h-3" />
            </button>
          )}
          {onMoveDown && (
            <button onClick={onMoveDown} className="text-slate-500 hover:text-slate-300 p-1 rounded hover:bg-nb-700 transition-colors" title="Move down">
              <ChevronDownIcon className="w-3 h-3" />
            </button>
          )}
          <button
            onClick={() => onEdit(item)}
            className="text-xs text-neuro-400 hover:text-neuro-300 px-2 py-1 rounded hover:bg-nb-700 transition-colors"
          >
            Edit
          </button>
          <button
            onClick={() => onDelete(item.id)}
            className="text-xs text-red-500 hover:text-red-400 px-2 py-1 rounded hover:bg-nb-700 transition-colors"
          >
            Del
          </button>
        </div>
      </td>
    </tr>
  )
}

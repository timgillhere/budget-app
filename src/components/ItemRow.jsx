const fmt = (n) => `£${n.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export default function ItemRow({ item, groupIsSavings, onEdit, onDelete }) {
  return (
    <tr className="group hover:bg-ash-grey-50 transition-colors">
      {/* Name cell — tooltip on hover, never changes column width */}
      <td className="px-4 py-2 text-sm text-ash-grey-800" style={{ width: '55%' }}>
        <div className="relative inline-flex items-center gap-1.5 max-w-full">
          <span className="truncate">{item.name}</span>
          {item.isSavings && !groupIsSavings && (
            <span className="text-xs bg-soft-linen-100 text-soft-linen-700 border border-soft-linen-200 px-1 py-0.5 rounded-full leading-none flex-shrink-0">🏦</span>
          )}
          {item.notes && (
            <span className="relative flex-shrink-0 group/tip">
              <span className="text-ash-grey-300 hover:text-ash-grey-500 cursor-default text-xs select-none">ℹ</span>
              {/* Tooltip — absolutely positioned, never affects layout */}
              <span className="
                pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-2
                bg-ash-grey-800 text-white text-xs rounded-lg px-3 py-2 w-56 leading-relaxed z-50
                opacity-0 group-hover/tip:opacity-100 transition-opacity duration-150 whitespace-normal
                shadow-lg
              ">
                {item.notes}
                <span className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-ash-grey-800" />
              </span>
            </span>
          )}
        </div>
      </td>
      <td className="px-4 py-2 text-sm text-ash-grey-700 text-right font-medium tabular-nums" style={{ width: '17%' }}>
        {fmt(item.monthly)}
      </td>
      <td className="px-4 py-2 text-sm text-ash-grey-500 text-right tabular-nums" style={{ width: '17%' }}>
        {fmt(item.monthly * 12)}
      </td>
      {/* Actions — opacity only, zero layout impact */}
      <td className="px-4 py-2 text-right" style={{ width: '11%' }}>
        <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => onEdit(item)}
            className="text-xs text-tropical-teal-600 hover:text-tropical-teal-700 px-2 py-1 rounded hover:bg-tropical-teal-50"
          >
            Edit
          </button>
          <button
            onClick={() => { if (window.confirm(`Delete "${item.name}"?`)) onDelete(item.id) }}
            className="text-xs text-vibrant-coral-500 hover:text-vibrant-coral-700 px-2 py-1 rounded hover:bg-vibrant-coral-50"
          >
            Del
          </button>
        </div>
      </td>
    </tr>
  )
}

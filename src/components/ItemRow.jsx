const fmt = (n) => `£${n.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export default function ItemRow({ item, onEdit, onDelete }) {
  return (
    <tr className="group hover:bg-gray-50 transition-colors">
      {/* Name cell — tooltip on hover, never changes column width */}
      <td className="px-4 py-2 text-sm text-gray-800" style={{ width: '55%' }}>
        <div className="relative inline-flex items-center gap-1.5 max-w-full">
          <span className="truncate">{item.name}</span>
          {item.notes && (
            <span className="relative flex-shrink-0 group/tip">
              <span className="text-gray-300 hover:text-gray-500 cursor-default text-xs select-none">ℹ</span>
              {/* Tooltip — absolutely positioned, never affects layout */}
              <span className="
                pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-2
                bg-gray-800 text-white text-xs rounded-lg px-3 py-2 w-56 leading-relaxed z-50
                opacity-0 group-hover/tip:opacity-100 transition-opacity duration-150 whitespace-normal
                shadow-lg
              ">
                {item.notes}
                <span className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-gray-800" />
              </span>
            </span>
          )}
        </div>
      </td>
      <td className="px-4 py-2 text-sm text-gray-700 text-right font-medium tabular-nums" style={{ width: '17%' }}>
        {fmt(item.monthly)}
      </td>
      <td className="px-4 py-2 text-sm text-gray-500 text-right tabular-nums" style={{ width: '17%' }}>
        {fmt(item.monthly * 12)}
      </td>
      {/* Actions — opacity only, zero layout impact */}
      <td className="px-4 py-2 text-right" style={{ width: '11%' }}>
        <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => onEdit(item)}
            className="text-xs text-blue-600 hover:text-blue-800 px-2 py-1 rounded hover:bg-blue-50"
          >
            Edit
          </button>
          <button
            onClick={() => { if (window.confirm(`Delete "${item.name}"?`)) onDelete(item.id) }}
            className="text-xs text-red-500 hover:text-red-700 px-2 py-1 rounded hover:bg-red-50"
          >
            Del
          </button>
        </div>
      </td>
    </tr>
  )
}

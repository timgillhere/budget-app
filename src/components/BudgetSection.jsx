import { useState } from 'react'
import {
  PencilSquareIcon, TrashIcon, PlusIcon, BuildingLibraryIcon,
  ChevronDownIcon, ChevronRightIcon, Bars3Icon, BanknotesIcon, CalendarDaysIcon,
} from '@heroicons/react/24/outline'
import {
  DndContext, closestCenter, PointerSensor, TouchSensor, useSensor, useSensors,
} from '@dnd-kit/core'
import {
  SortableContext, verticalListSortingStrategy, useSortable, arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import ItemRow from './ItemRow'
import EditModal from './EditModal'
import { isSavingsGroup, isAnnualFundGroup, stripPrefix } from '../utils/budgetCalcs'

const fmt = (n) => `£${n.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

function Cols() {
  return (
    <colgroup>
      <col style={{ width: '46%' }} />
      <col style={{ width: '17%' }} />
      <col style={{ width: '17%' }} />
      <col style={{ width: '20%' }} />
    </colgroup>
  )
}

function NotesTooltip({ notes }) {
  return (
    <span className="relative flex-shrink-0 group/tip">
      <span className="text-slate-600 hover:text-slate-400 cursor-default text-xs select-none">ℹ</span>
      <span className="
        pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-2
        bg-nb-800 border border-nb-600 text-slate-200 text-xs rounded-lg px-3 py-2 w-56 leading-relaxed z-50
        opacity-0 group-hover/tip:opacity-100 transition-opacity duration-150 whitespace-normal shadow-xl
      ">
        {notes}
        <span className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-nb-800" />
      </span>
    </span>
  )
}

// Savings badge — amber for annual funds, emerald for long-term savings
function SavingsBadge({ type }) {
  if (type === 'annual') {
    return (
      <span className="inline-flex items-center gap-1 text-xs bg-amber-900/40 text-amber-400 border border-amber-700/60 px-1.5 py-0.5 rounded-full leading-none flex-shrink-0">
        <CalendarDaysIcon className="w-3 h-3" />
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs bg-emerald-900/40 text-emerald-400 border border-emerald-800/60 px-1.5 py-0.5 rounded-full leading-none flex-shrink-0">
      <BuildingLibraryIcon className="w-3 h-3" />
    </span>
  )
}

// Outgoing icon — banknotes
function OutgoingIcon({ size = 'sm' }) {
  return <BanknotesIcon className={`${size === 'sm' ? 'w-3.5 h-3.5' : 'w-3 h-3'} text-amber-500/70 flex-shrink-0`} />
}

// Sortable wrapper for desktop table groups — renders as <tbody>
function SortableTbody({ id, children }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  return (
    <tbody
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }}
      {...attributes}
      {...listeners}
    >
      {children}
    </tbody>
  )
}

// Sortable wrapper for mobile groups — renders as <div>
function SortableMobileGroup({ id, children }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }}
      {...attributes}
      {...listeners}
    >
      {children}
    </div>
  )
}

export default function BudgetSection({
  section, dragHandleListeners,
  onEditSection,
  onAddItem, onEditItem, onDeleteItem, onAddGroup, onEditGroup, onDeleteGroup, onReorderGroups, onReorderItems,
}) {
  const [collapsed, setCollapsed] = useState(false)
  const [modal, setModal] = useState(null)
  const [collapsedGroups, setCollapsedGroups] = useState(new Set())
  const [confirmDelete, setConfirmDelete] = useState(null)

  const sectionTotal = section.groups.reduce((s, g) =>
    s + g.items.reduce((gs, i) => gs + i.monthly, 0), 0)

  const displayName = (name) => stripPrefix(name)
  const effectiveGroupColor = (group) => group.color || section.color

  const toggleGroupCollapse = (groupId) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev)
      next.has(groupId) ? next.delete(groupId) : next.add(groupId)
      return next
    })
  }

  const handleModalSave = (data) => {
    const { mode, groupId, item } = modal
    if (mode === 'edit-section') onEditSection({ name: data.name, color: data.color })
    else if (mode === 'add-item')   onAddItem(groupId, data)
    else if (mode === 'edit-item')  onEditItem(groupId, item.id, data)
    else if (mode === 'add-group')  onAddGroup({ name: data.name, savingsType: data.savingsType, isSavings: data.isSavings, color: data.color })
    else if (mode === 'edit-group') onEditGroup(groupId, { name: data.name, savingsType: data.savingsType, isSavings: data.isSavings, currentBalance: data.currentBalance, color: data.color })
    setModal(null)
  }

  const groupSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
  )

  const handleGroupDragEnd = ({ active, over }) => {
    if (!over || active.id === over.id) return
    const oldIdx = section.groups.findIndex(g => g.id === active.id)
    const newIdx = section.groups.findIndex(g => g.id === over.id)
    onReorderGroups(arrayMove(section.groups, oldIdx, newIdx))
  }

  const groupIds = section.groups.map(g => g.id)

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
          {/* Section-level drag handle */}
          {dragHandleListeners && (
            <button
              onPointerDown={e => e.stopPropagation()}
              onClick={e => e.stopPropagation()}
              {...dragHandleListeners}
              className="text-white/50 hover:text-white/90 p-0.5 rounded cursor-grab active:cursor-grabbing transition-colors flex-shrink-0"
              title="Drag to reorder section"
            >
              <Bars3Icon className="w-4 h-4" />
            </button>
          )}
          <span className="text-white font-bold text-base truncate">{section.name}</span>
          <span className="text-white/80 text-sm font-medium flex-shrink-0">{fmt(sectionTotal)}/mo</span>
          <span className="text-white/60 text-xs flex-shrink-0 hidden sm:inline">({fmt(sectionTotal * 12)}/yr)</span>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0 ml-2">
          <button
            onPointerDown={e => e.stopPropagation()}
            onClick={e => { e.stopPropagation(); setModal({ mode: 'add-group' }) }}
            className="text-white/80 hover:text-white text-xs border border-white/40 hover:border-white px-2 py-1 rounded transition-colors"
          >
            + Add Group
          </button>
          <button
            onPointerDown={e => e.stopPropagation()}
            onClick={e => { e.stopPropagation(); setModal({ mode: 'edit-section', item: { name: section.name, color: section.color } }) }}
            className="text-white/60 hover:text-white/90 p-1 rounded transition-colors"
            title="Edit section"
          >
            <PencilSquareIcon className="w-4 h-4" />
          </button>
          {collapsed ? <ChevronRightIcon className="w-4 h-4 text-white/80" /> : <ChevronDownIcon className="w-4 h-4 text-white/80" />}
        </div>
      </div>

      {/* DndContext must wrap both mobile + desktop but be OUTSIDE any <table> */}
      {!collapsed && (
        <DndContext sensors={groupSensors} collisionDetection={closestCenter} onDragEnd={handleGroupDragEnd}>
          <div>

            {/* ── Mobile ── */}
            <div className="sm:hidden divide-y divide-nb-600">
              <SortableContext items={groupIds} strategy={verticalListSortingStrategy}>
                {section.groups.map(group => {
                  const groupTotal = group.items.reduce((s, i) => s + i.monthly, 0)
                  const groupIsSavings = isSavingsGroup(group)
                  const groupSavingsType = groupIsSavings ? (isAnnualFundGroup(group) ? 'annual' : 'longterm') : null
                  const isGroupCollapsed = collapsedGroups.has(group.id)
                  const groupColor = effectiveGroupColor(group)

                  if (group.items.length === 0) {
                    return (
                      <SortableMobileGroup key={group.id} id={group.id}>
                        <div className="flex items-center justify-between px-3 py-2 gap-2 bg-nb-700 border-l-4" style={{ borderLeftColor: groupColor }}>
                          <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                            <Bars3Icon className="w-3.5 h-3.5 text-slate-600 flex-shrink-0" />
                            <span className="text-sm font-semibold text-slate-200 truncate">{displayName(group.name)}</span>
                            {groupIsSavings ? <SavingsBadge type={groupSavingsType} /> : <OutgoingIcon />}
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <span className="text-sm text-slate-600 italic">No items —</span>
                            <button onPointerDown={e => e.stopPropagation()} onClick={() => setModal({ mode: 'add-item', groupId: group.id })} className="text-neuro-400 hover:text-neuro-300 text-sm hover:underline transition-colors">add one</button>
                            <button onPointerDown={e => e.stopPropagation()} onClick={() => setModal({ mode: 'edit-group', groupId: group.id, item: { name: group.name, savingsType: group.savingsType, isSavings: groupIsSavings, currentBalance: group.currentBalance, color: group.color } })} className="text-slate-500 hover:text-neuro-400 p-2 rounded transition-colors">
                              <PencilSquareIcon className="w-4 h-4" />
                            </button>
                            <button onPointerDown={e => e.stopPropagation()} onClick={() => setConfirmDelete({ type: 'group', groupId: group.id, label: displayName(group.name), itemCount: 0 })} className="text-slate-500 hover:text-red-400 p-2 rounded transition-colors">
                              <TrashIcon className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </SortableMobileGroup>
                    )
                  }

                  if (group.items.length === 1) {
                    const item = group.items[0]
                    const namesDiffer = item.name.trim().toLowerCase() !== displayName(group.name).trim().toLowerCase()
                    return (
                      <SortableMobileGroup key={group.id} id={group.id}>
                        <button
                          type="button"
                          onPointerDown={e => e.stopPropagation()}
                          onClick={() => setModal({ mode: 'edit-item', groupId: group.id, item })}
                          className="w-full flex items-center justify-between gap-3 px-4 py-3.5 min-h-[56px] text-left active:bg-nb-700 transition-colors border-l-2"
                          style={{ borderLeftColor: `${groupColor}66` }}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              {groupIsSavings ? (groupSavingsType === 'annual' ? <CalendarDaysIcon className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" /> : <BuildingLibraryIcon className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />) : <OutgoingIcon />}
                              <span className="text-[15px] text-slate-200 font-semibold truncate">{displayName(group.name)}</span>
                              {group.currentBalance != null && (
                                <span className="text-xs bg-nb-600 text-cyan-400 border border-nb-500 px-1.5 py-0.5 rounded-full tabular-nums flex-shrink-0">
                                  {fmt(group.currentBalance)}
                                </span>
                              )}
                            </div>
                            {namesDiffer && <div className="text-xs text-slate-500 truncate">{item.name}</div>}
                            <div className="text-xs text-slate-500 tabular-nums">{fmt(item.monthly * 12)}/yr</div>
                          </div>
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            <span className="text-base font-bold text-slate-100 tabular-nums neon-white">{fmt(item.monthly)}</span>
                            <ChevronRightIcon className="w-4 h-4 text-slate-600" />
                          </div>
                        </button>
                      </SortableMobileGroup>
                    )
                  }

                  // Multi-item group (mobile)
                  return (
                    <SortableMobileGroup key={group.id} id={group.id}>
                      <div>
                        {/* Group header — full row clickable to collapse */}
                        <div
                          className="flex items-center justify-between px-3 py-2 gap-2 bg-nb-700 border-l-4 cursor-pointer select-none"
                          style={{ borderLeftColor: groupColor }}
                          onClick={() => toggleGroupCollapse(group.id)}
                        >
                          <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                            <Bars3Icon className="w-3.5 h-3.5 text-slate-600 flex-shrink-0" />
                            <span className="text-sm font-semibold text-slate-200 truncate">{displayName(group.name)}</span>
                            {groupIsSavings ? <SavingsBadge type={groupSavingsType} /> : <OutgoingIcon />}
                            {group.currentBalance != null && (
                              <span className="text-xs bg-nb-600 text-cyan-400 border border-nb-500 px-1.5 py-0.5 rounded-full leading-none tabular-nums flex-shrink-0">
                                {fmt(group.currentBalance)}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <span className="text-sm font-semibold text-slate-400 tabular-nums neon-white mr-1">{fmt(groupTotal)}/mo</span>
                            {isGroupCollapsed ? <ChevronRightIcon className="w-4 h-4 text-slate-500" /> : <ChevronDownIcon className="w-4 h-4 text-slate-500" />}
                            <button onPointerDown={e => e.stopPropagation()} onClick={e => { e.stopPropagation(); setModal({ mode: 'add-item', groupId: group.id }) }} className="text-slate-500 hover:text-slate-200 border border-nb-500 hover:border-nb-400 inline-flex items-center justify-center min-w-11 min-h-11 p-2 rounded transition-colors">
                              <PlusIcon className="w-4 h-4" />
                            </button>
                            <button onPointerDown={e => e.stopPropagation()} onClick={e => { e.stopPropagation(); setModal({ mode: 'edit-group', groupId: group.id, item: { name: group.name, savingsType: group.savingsType, isSavings: groupIsSavings, currentBalance: group.currentBalance, color: group.color } }) }} className="text-slate-500 hover:text-neuro-400 inline-flex items-center justify-center min-w-11 min-h-11 p-2 rounded transition-colors">
                              <PencilSquareIcon className="w-4 h-4" />
                            </button>
                            <button onPointerDown={e => e.stopPropagation()} onClick={e => { e.stopPropagation(); setConfirmDelete({ type: 'group', groupId: group.id, label: displayName(group.name), itemCount: group.items.length }) }} className="text-slate-500 hover:text-red-400 inline-flex items-center justify-center min-w-11 min-h-11 p-2 rounded transition-colors">
                              <TrashIcon className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                        {!isGroupCollapsed && (
                          <ul className="divide-y divide-nb-700">
                            {group.items.map(item => (
                              <li key={item.id}>
                                <button
                                  type="button"
                                  onPointerDown={e => e.stopPropagation()}
                                  onClick={() => setModal({ mode: 'edit-item', groupId: group.id, item })}
                                  className="w-full flex items-center justify-between gap-3 px-4 py-3 min-h-[52px] text-left active:bg-nb-700 transition-colors border-l-2"
                                  style={{ borderLeftColor: `${groupColor}66` }}
                                >
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-1.5">
                                      {(groupIsSavings || item.isSavings || item.savingsType) ? (
                                        (groupSavingsType === 'annual' || item.savingsType === 'annual') ? (
                                          <CalendarDaysIcon className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                                        ) : (
                                          <BuildingLibraryIcon className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                                        )
                                      ) : (
                                        <OutgoingIcon />
                                      )}
                                      <span className="text-sm text-slate-300 truncate">{item.name}</span>
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
                            <div className="flex items-center justify-between px-4 py-2.5 bg-nb-800 border-t border-nb-600">
                              <span className="text-sm font-bold text-slate-400">Subtotal</span>
                              <div className="text-right">
                                <div className="text-sm font-bold text-slate-200 tabular-nums neon-white">{fmt(groupTotal)}</div>
                                <div className="text-xs text-slate-500 tabular-nums">{fmt(groupTotal * 12)}/yr</div>
                              </div>
                            </div>
                          </ul>
                        )}
                      </div>
                    </SortableMobileGroup>
                  )
                })}
              </SortableContext>

              {/* Mobile section total */}
              <div
                className="flex items-center justify-between px-4 py-3 bg-nb-800 border-t-2 border-nb-500 border-l-4"
                style={{ borderLeftColor: section.color }}
              >
                <span className="text-base font-bold" style={{ color: section.color }}>{section.name} Total</span>
                <div className="text-right">
                  <div className="text-base font-bold text-slate-100 tabular-nums neon-white">{fmt(sectionTotal)}</div>
                  <div className="text-xs text-slate-400 tabular-nums">{fmt(sectionTotal * 12)}/yr</div>
                </div>
              </div>
            </div>

            {/* ── Desktop ── */}
            <div className="hidden sm:block">
              <table className="w-full table-fixed">
                <Cols />

                <SortableContext items={groupIds} strategy={verticalListSortingStrategy}>
                  {section.groups.map(group => {
                    const groupTotal = group.items.reduce((s, i) => s + i.monthly, 0)
                    const groupIsSavings = isSavingsGroup(group)
                    const groupSavingsType = groupIsSavings ? (isAnnualFundGroup(group) ? 'annual' : 'longterm') : null
                    const isGroupCollapsed = collapsedGroups.has(group.id)
                    const groupColor = effectiveGroupColor(group)

                    // Path C: empty group
                    if (group.items.length === 0) {
                      return (
                        <SortableTbody key={group.id} id={group.id}>
                          <tr className="border-t border-nb-600 bg-nb-700">
                            <td colSpan={4} className="px-4 py-2 border-l-4" style={{ borderLeftColor: groupColor }}>
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                                  <Bars3Icon className="w-3.5 h-3.5 text-slate-600 flex-shrink-0" />
                                  <span className="text-sm font-semibold text-slate-200 truncate">{displayName(group.name)}</span>
                                  {groupIsSavings ? <SavingsBadge type={groupSavingsType} /> : <OutgoingIcon />}
                                </div>
                                <div className="flex items-center gap-2 flex-shrink-0">
                                  <span className="text-sm text-slate-600 italic">No items —</span>
                                  <button onPointerDown={e => e.stopPropagation()} onClick={() => setModal({ mode: 'add-item', groupId: group.id })} className="text-neuro-400 hover:text-neuro-300 text-sm hover:underline transition-colors">add one</button>
                                  <button onPointerDown={e => e.stopPropagation()} onClick={() => setModal({ mode: 'edit-group', groupId: group.id, item: { name: group.name, savingsType: group.savingsType, isSavings: groupIsSavings, currentBalance: group.currentBalance, color: group.color } })} className="text-slate-500 hover:text-neuro-400 p-1.5 rounded transition-colors">
                                    <PencilSquareIcon className="w-4 h-4" />
                                  </button>
                                  <button onPointerDown={e => e.stopPropagation()} onClick={() => setConfirmDelete({ type: 'group', groupId: group.id, label: displayName(group.name), itemCount: 0 })} className="text-slate-500 hover:text-red-400 p-1.5 rounded transition-colors">
                                    <TrashIcon className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>
                            </td>
                          </tr>
                        </SortableTbody>
                      )
                    }

                    // Path A: single-item group
                    if (group.items.length === 1) {
                      const item = group.items[0]
                      const namesDiffer = item.name.trim().toLowerCase() !== displayName(group.name).trim().toLowerCase()
                      return (
                        <SortableTbody key={group.id} id={group.id}>
                          <tr className="group/row hover:bg-nb-700 transition-colors border-t border-nb-600">
                            <td className="px-4 py-2.5">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                {/* Drag handle — visible on hover */}
                                <span className="opacity-0 group-hover/row:opacity-100 transition-opacity flex-shrink-0">
                                  <Bars3Icon className="w-3.5 h-3.5 text-slate-600" />
                                </span>
                                {groupIsSavings ? <SavingsBadge type={groupSavingsType} /> : <OutgoingIcon />}
                                <span className="text-sm font-semibold text-slate-200 truncate">{displayName(group.name)}</span>
                                {!namesDiffer && item.notes && <NotesTooltip notes={item.notes} />}
                                {group.currentBalance != null && (
                                  <span className="text-xs bg-nb-600 text-cyan-400 border border-nb-500 px-1.5 py-0.5 rounded-full tabular-nums flex-shrink-0">
                                    {fmt(group.currentBalance)}
                                  </span>
                                )}
                              </div>
                              {namesDiffer && (
                                <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
                                  <span className="truncate">{item.name}</span>
                                  {item.notes && <NotesTooltip notes={item.notes} />}
                                </div>
                              )}
                            </td>
                            <td className="px-4 py-2.5 text-sm text-slate-300 text-right font-medium tabular-nums neon-white">
                              {fmt(item.monthly)}
                            </td>
                            <td className="px-4 py-2.5 text-sm text-slate-500 text-right tabular-nums">
                              {fmt(item.monthly * 12)}
                            </td>
                            <td className="px-4 py-2.5 text-right">
                              <div className="flex justify-end gap-1 opacity-0 group-hover/row:opacity-100 transition-opacity">
                                <button onPointerDown={e => e.stopPropagation()} onClick={() => setModal({ mode: 'edit-item', groupId: group.id, item })} className="text-xs text-neuro-400 hover:text-neuro-300 px-2 py-1 rounded hover:bg-nb-700 transition-colors">Edit</button>
                                <button onPointerDown={e => e.stopPropagation()} onClick={() => setConfirmDelete({ type: 'item', groupId: group.id, itemId: item.id, label: item.name })} className="text-xs text-red-500 hover:text-red-400 px-2 py-1 rounded hover:bg-nb-700 transition-colors">Del</button>
                                <button onPointerDown={e => e.stopPropagation()} onClick={() => setModal({ mode: 'add-item', groupId: group.id })} className="text-slate-500 hover:text-slate-200 border border-nb-500 hover:border-nb-400 p-1 rounded transition-colors" title="Add item to group">
                                  <PlusIcon className="w-3.5 h-3.5" />
                                </button>
                                <button onPointerDown={e => e.stopPropagation()} onClick={() => setModal({ mode: 'edit-group', groupId: group.id, item: { name: group.name, savingsType: group.savingsType, isSavings: groupIsSavings, currentBalance: group.currentBalance, color: group.color } })} className="text-slate-500 hover:text-neuro-400 p-1 rounded transition-colors" title="Edit group">
                                  <PencilSquareIcon className="w-3.5 h-3.5" />
                                </button>
                                <button onPointerDown={e => e.stopPropagation()} onClick={() => setConfirmDelete({ type: 'group', groupId: group.id, label: displayName(group.name), itemCount: 1 })} className="text-slate-500 hover:text-red-400 p-1 rounded transition-colors" title="Delete group">
                                  <TrashIcon className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        </SortableTbody>
                      )
                    }

                    // Path B: multi-item group
                    return (
                      <SortableTbody key={group.id} id={group.id}>
                        {/* Group header — full row clickable for collapse */}
                        <tr
                          className="border-t border-nb-600 bg-nb-700 cursor-pointer select-none"
                          onClick={() => toggleGroupCollapse(group.id)}
                        >
                          <td colSpan={4} className="px-4 py-2 border-l-4" style={{ borderLeftColor: groupColor }}>
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                                <Bars3Icon className="w-3.5 h-3.5 text-slate-600 flex-shrink-0" />
                                <span className="text-sm font-semibold text-slate-200 truncate">{displayName(group.name)}</span>
                                {groupIsSavings ? <SavingsBadge type={groupSavingsType} /> : <OutgoingIcon />}
                                {group.currentBalance != null && (
                                  <span className="text-xs bg-nb-600 text-cyan-400 border border-nb-500 px-1.5 py-0.5 rounded-full leading-none tabular-nums flex-shrink-0">
                                    {fmt(group.currentBalance)}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-1 flex-shrink-0">
                                <span className="text-sm font-semibold text-slate-400 tabular-nums neon-white mr-1">{fmt(groupTotal)}/mo</span>
                                {isGroupCollapsed ? <ChevronRightIcon className="w-4 h-4 text-slate-500 flex-shrink-0" /> : <ChevronDownIcon className="w-4 h-4 text-slate-500 flex-shrink-0" />}
                                <button onPointerDown={e => e.stopPropagation()} onClick={e => { e.stopPropagation(); setModal({ mode: 'add-item', groupId: group.id }) }} className="text-slate-500 hover:text-slate-200 border border-nb-500 hover:border-nb-400 inline-flex items-center justify-center p-1.5 rounded transition-colors">
                                  <PlusIcon className="w-4 h-4" />
                                </button>
                                <button onPointerDown={e => e.stopPropagation()} onClick={e => { e.stopPropagation(); setModal({ mode: 'edit-group', groupId: group.id, item: { name: group.name, savingsType: group.savingsType, isSavings: groupIsSavings, currentBalance: group.currentBalance, color: group.color } }) }} className="text-slate-500 hover:text-neuro-400 inline-flex items-center justify-center p-1.5 rounded transition-colors">
                                  <PencilSquareIcon className="w-4 h-4" />
                                </button>
                                <button onPointerDown={e => e.stopPropagation()} onClick={e => { e.stopPropagation(); setConfirmDelete({ type: 'group', groupId: group.id, label: displayName(group.name), itemCount: group.items.length }) }} className="text-slate-500 hover:text-red-400 inline-flex items-center justify-center p-1.5 rounded transition-colors">
                                  <TrashIcon className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          </td>
                        </tr>
                        {!isGroupCollapsed && (
                          <>
                            {group.items.map((item, idx) => (
                              <ItemRow
                                key={item.id}
                                item={item}
                                groupIsSavings={groupIsSavings}
                                groupSavingsType={groupSavingsType}
                                indent={true}
                                small={true}
                                onEdit={(item) => setModal({ mode: 'edit-item', groupId: group.id, item })}
                                onDelete={(id) => setConfirmDelete({ type: 'item', groupId: group.id, itemId: id, label: item.name })}
                                onMoveUp={idx > 0 ? () => { const a = [...group.items]; [a[idx-1], a[idx]] = [a[idx], a[idx-1]]; onReorderItems(group.id, a) } : undefined}
                                onMoveDown={idx < group.items.length - 1 ? () => { const a = [...group.items]; [a[idx], a[idx+1]] = [a[idx+1], a[idx]]; onReorderItems(group.id, a) } : undefined}
                              />
                            ))}
                            <tr className="border-t border-nb-500 bg-nb-800">
                              <td className="px-4 py-1.5 text-sm font-bold text-slate-400">Subtotal</td>
                              <td className="px-4 py-1.5 text-sm font-bold text-slate-200 text-right tabular-nums neon-white">{fmt(groupTotal)}</td>
                              <td className="px-4 py-1.5 text-sm text-slate-500 text-right tabular-nums">{fmt(groupTotal * 12)}/yr</td>
                              <td></td>
                            </tr>
                          </>
                        )}
                      </SortableTbody>
                    )
                  })}
                </SortableContext>

                <tfoot>
                  <tr className="border-t-2 border-nb-500 bg-nb-800">
                    <td
                      className="px-4 py-2.5 text-base font-bold border-l-4"
                      style={{ borderLeftColor: section.color, color: section.color }}
                    >
                      {section.name} Total
                    </td>
                    <td className="px-4 py-2.5 text-base font-bold text-slate-100 text-right tabular-nums neon-white">{fmt(sectionTotal)}</td>
                    <td className="px-4 py-2.5 text-sm font-semibold text-slate-400 text-right tabular-nums">{fmt(sectionTotal * 12)}/yr</td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>

          </div>
        </DndContext>
      )}

      {/* Confirm delete modal */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={() => setConfirmDelete(null)}>
          <div className="bg-nb-750 rounded-xl border border-nb-600 shadow-2xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
            <h2 className="text-base font-bold text-slate-100 mb-2">
              Delete {confirmDelete.type === 'group' ? 'Group' : 'Item'}?
            </h2>
            <p className="text-sm text-slate-400 mb-5">
              {confirmDelete.type === 'group'
                ? `"${confirmDelete.label}"${confirmDelete.itemCount > 0 ? ` and all ${confirmDelete.itemCount} item(s)` : ''} will be permanently deleted.`
                : `"${confirmDelete.label}" will be permanently deleted.`}
            </p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDelete(null)} className="flex-1 border border-nb-500 text-slate-400 hover:text-slate-200 px-4 py-2.5 rounded-lg text-sm transition-colors">Cancel</button>
              <button
                onClick={() => {
                  if (confirmDelete.type === 'group') onDeleteGroup(confirmDelete.groupId)
                  else onDeleteItem(confirmDelete.groupId, confirmDelete.itemId)
                  setConfirmDelete(null)
                }}
                className="flex-1 bg-red-700 hover:bg-red-600 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors"
              >
                Delete
              </button>
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

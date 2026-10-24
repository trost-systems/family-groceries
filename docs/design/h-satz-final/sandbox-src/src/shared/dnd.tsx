import {
  DndContext,
  DragOverlay,
  MeasuringStrategy,
  MouseSensor,
  TouchSensor,
  closestCenter,
  pointerWithin,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragMoveEvent,
  type UniqueIdentifier,
  type DragStartEvent,
  type DragOverEvent,
} from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy, horizontalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { createContext, useContext, useRef, useState, type CSSProperties, type HTMLAttributes, type MouseEvent, type ReactNode } from 'react'
import type { Groceries } from './store'
import type { CategoryId, Item, StoreId } from './types'

/**
 * One gesture model for every direction:
 *   tap                         -> onTap (check off)
 *   press and hold (300 ms), release without moving -> onEdit
 *   press and hold, then move   -> drag (item to another category/store; store/category headers reorder)
 *   right-click (mouse)         -> onEdit
 * A quick swipe moves past the 8 px tolerance before the hold completes, so the list still scrolls on touch.
 */
export const HOLD_MS = 300
const TOLERANCE_PX = 8

type DragData =
  | { type: 'item'; item: Item }
  | { type: 'category'; storeId: StoreId; categoryId: CategoryId }
  | { type: 'store'; storeId: StoreId }
  /** an item row as a drop slot; only directions that use `useRowGesture` register these */
  | { type: 'row'; item: Item }

export type Edge = 'before' | 'after'

interface Over {
  id: UniqueIdentifier
  data: DragData
  /** which half of a row the pointer is in */
  edge?: Edge
}

const storeKey = (s: StoreId) => `store:${s}`
const categoryKey = (s: StoreId, c: CategoryId) => `cat:${s}:${c}`

interface DndState {
  active: DragData | null
  /** the row, category or store an item is currently hovering */
  over: Over | null
  onEdit: (id: string) => void
  clickSuppressedUntil: React.RefObject<number>
}

const Ctx = createContext<DndState | null>(null)

function useDndCtx(): DndState {
  const v = useContext(Ctx)
  if (!v) throw new Error('dnd hook outside <ListDnd>')
  return v
}

/** Exposes what is being dragged so directions can collapse sections while reordering. */
export function useDragState() {
  const { active, over } = useDndCtx()
  return { active, over: over?.data ?? null }
}

const collision: CollisionDetection = (args) => {
  const active = args.active.data.current as DragData | undefined
  if (!active) return []
  const of = (t: DragData['type']) =>
    args.droppableContainers.filter((c) => (c.data.current as DragData | undefined)?.type === t)
  if (active.type === 'item') {
    const rows = pointerWithin({ ...args, droppableContainers: of('row') })
    const rect = rows.length && args.pointerCoordinates ? args.droppableRects.get(rows[0].id) : undefined
    if (rect && args.pointerCoordinates) {
      const edge: Edge = args.pointerCoordinates.y < rect.top + rect.height / 2 ? 'before' : 'after'
      return [{ ...rows[0], data: { ...rows[0].data, edge } }]
    }
    const cats = pointerWithin({ ...args, droppableContainers: of('category') })
    if (cats.length) return cats
    return pointerWithin({ ...args, droppableContainers: of('store') })
  }
  if (active.type === 'category') {
    const sameStore = of('category').filter((c) => (c.data.current as DragData & { type: 'category' }).storeId === active.storeId)
    return closestCenter({ ...args, droppableContainers: sameStore })
  }
  return closestCenter({ ...args, droppableContainers: of('store') })
}

function edgeOf(e: DragOverEvent | DragMoveEvent | DragEndEvent): Edge | undefined {
  const hit = e.collisions?.[0]
  return hit && hit.id === e.over?.id ? (hit.data?.edge as Edge | undefined) : undefined
}

export function ListDnd({
  groceries,
  onEdit,
  renderItemOverlay,
  children,
}: {
  groceries: Groceries
  onEdit: (id: string) => void
  renderItemOverlay: (item: Item) => ReactNode
  children: ReactNode
}) {
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { delay: HOLD_MS, tolerance: TOLERANCE_PX } }),
    useSensor(TouchSensor, { activationConstraint: { delay: HOLD_MS, tolerance: TOLERANCE_PX } }),
  )
  const [active, setActive] = useState<DragData | null>(null)
  const [over, setOver] = useState<Over | null>(null)
  const clickSuppressedUntil = useRef(0)
  const { actions } = groceries

  const onDragStart = (e: DragStartEvent) => {
    setActive(e.active.data.current as DragData)
    navigator.vibrate?.(10)
  }
  // Move events keep a row's edge current while the hovered droppable stays the same.
  const track = (e: DragOverEvent | DragMoveEvent) => {
    const data = e.over?.data.current as DragData | undefined
    const edge = edgeOf(e)
    const id = e.over?.id
    setOver((prev) => (!data || id === undefined ? null : prev?.id === id && prev.edge === edge ? prev : { id, data, edge }))
  }
  const reset = () => {
    setActive(null)
    setOver(null)
    clickSuppressedUntil.current = Date.now() + 250
  }
  const onDragEnd = (e: DragEndEvent) => {
    reset()
    const a = e.active.data.current as DragData
    const o = e.over?.data.current as DragData | undefined
    const moved = Math.hypot(e.delta.x, e.delta.y) > TOLERANCE_PX
    if (a.type === 'item') {
      if (!moved) return onEdit(a.item.id)
      if (o?.type === 'row') {
        const edge = edgeOf(e)
        if (edge && o.item.id !== a.item.id) actions.place(a.item.id, o.item.id, edge)
      } else if (o?.type === 'category') actions.move(a.item.id, o.storeId, o.categoryId)
      else if (o?.type === 'store') actions.move(a.item.id, o.storeId, a.item.categoryId)
    } else if (a.type === 'category' && o?.type === 'category' && o.storeId === a.storeId) {
      actions.reorderCategories(a.storeId, a.categoryId, o.categoryId)
    } else if (a.type === 'store' && o?.type === 'store') {
      actions.reorderStores(a.storeId, o.storeId)
    }
  }

  return (
    <Ctx.Provider value={{ active, over, onEdit, clickSuppressedUntil }}>
      <DndContext
        sensors={sensors}
        collisionDetection={collision}
        measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
        // dnd-kit's default 20% edge zone scrolls the list away under a thumb aiming at a nearby category.
        autoScroll={{ threshold: { x: 0, y: 0.08 } }}
        onDragStart={onDragStart}
        onDragOver={track}
        onDragMove={track}
        onDragEnd={onDragEnd}
        onDragCancel={reset}
      >
        {children}
        <DragOverlay dropAnimation={null}>{active?.type === 'item' ? renderItemOverlay(active.item) : null}</DragOverlay>
      </DndContext>
    </Ctx.Provider>
  )
}

export function SortableStores({ ids, children, horizontal }: { ids: StoreId[]; children: ReactNode; horizontal?: boolean }) {
  return (
    <SortableContext items={ids.map(storeKey)} strategy={horizontal ? horizontalListSortingStrategy : verticalListSortingStrategy}>
      {children}
    </SortableContext>
  )
}

export function SortableCategories({ storeId, ids, children }: { storeId: StoreId; ids: CategoryId[]; children: ReactNode }) {
  return (
    <SortableContext items={ids.map((c) => categoryKey(storeId, c))} strategy={verticalListSortingStrategy}>
      {children}
    </SortableContext>
  )
}

/**
 * Spread `itemProps` on the item's root. It carries the drag listeners plus tap / right-click handling, and the
 * data-testid / data-checked attributes the e2e suite relies on.
 */
export function useItemGesture(item: Item, onTap: () => void) {
  const { onEdit, clickSuppressedUntil } = useDndCtx()
  const { setNodeRef, listeners, attributes, isDragging } = useDraggable({
    id: `item:${item.id}`,
    data: { type: 'item', item } satisfies DragData,
  })
  const itemProps: HTMLAttributes<HTMLElement> & { ref: (el: HTMLElement | null) => void; 'data-testid': string; 'data-checked': string; 'data-item-id': string } = {
    ref: setNodeRef,
    ...attributes,
    ...listeners,
    role: 'button',
    'aria-roledescription': undefined,
    'data-testid': 'item',
    'data-checked': String(item.checked),
    'data-item-id': item.id,
    onClick: () => {
      if (Date.now() < clickSuppressedUntil.current) return
      onTap()
    },
    onContextMenu: (e: MouseEvent) => {
      e.preventDefault()
      // Touch long-press also fires contextmenu; the hold-release path owns that case.
      if ((e.nativeEvent as PointerEvent).pointerType === 'touch') return
      onEdit(item.id)
    },
  }
  return { itemProps, isDragging }
}

/**
 * `useItemGesture` plus a drop slot on the same node, so another item can be placed right before or after this
 * row. `dropEdge` says where the insertion line goes while an item hovers it.
 */
export function useRowGesture(item: Item, onTap: () => void) {
  const { active, over } = useDndCtx()
  const { itemProps, isDragging } = useItemGesture(item, onTap)
  const { setNodeRef } = useDroppable({ id: `row:${item.id}`, data: { type: 'row', item } satisfies DragData })
  const dragRef = itemProps.ref
  const ref = (el: HTMLElement | null) => {
    dragRef(el)
    setNodeRef(el)
  }
  const hovered = active?.type === 'item' && active.item.id !== item.id && over?.data.type === 'row' && over.data.item.id === item.id
  return { itemProps: { ...itemProps, ref }, isDragging, dropEdge: hovered ? (over.edge ?? null) : null }
}

/** Wraps a header tap (e.g. collapse a store) so the click that ends a hold-drag on the same header is swallowed. */
export function useHeaderTap(onTap: () => void) {
  const { clickSuppressedUntil } = useDndCtx()
  return () => {
    if (Date.now() < clickSuppressedUntil.current) return
    onTap()
  }
}

function sortableStyle(transform: Parameters<typeof CSS.Transform.toString>[0], transition: string | undefined): CSSProperties {
  return { transform: CSS.Translate.toString(transform), transition }
}

/**
 * Category container: sortable within its store (drag its header via `handleProps`) and a drop target for items.
 * Spread `containerProps` on the element that wraps the category header and its items.
 */
export function useCategorySortable(storeId: StoreId, categoryId: CategoryId) {
  const { active, over } = useDndCtx()
  const s = useSortable({
    id: categoryKey(storeId, categoryId),
    data: { type: 'category', storeId, categoryId } satisfies DragData,
  })
  return {
    containerProps: {
      ref: s.setNodeRef,
      style: sortableStyle(s.transform, s.transition),
      'data-testid': 'category',
      'data-store-id': storeId,
      'data-category-id': categoryId,
    },
    handleProps: { ...s.attributes, ...s.listeners, 'data-testid': 'category-handle' },
    isDragging: s.isDragging,
    /** an item is hovering this category */
    isItemOver: active?.type === 'item' && over?.data.type === 'category' && over.data.storeId === storeId && over.data.categoryId === categoryId,
    /** a sibling category in this store is being reordered: render headers only */
    collapsed: active?.type === 'category' && active.storeId === storeId,
  }
}

/** Store section: sortable among stores (drag its header via `handleProps`), and a drop target for items (keeps category). */
export function useStoreSortable(storeId: StoreId) {
  const { active, over } = useDndCtx()
  const s = useSortable({ id: storeKey(storeId), data: { type: 'store', storeId } satisfies DragData })
  return {
    containerProps: {
      ref: s.setNodeRef,
      style: sortableStyle(s.transform, s.transition),
      'data-testid': 'store-section',
      'data-store-id': storeId,
    },
    handleProps: { ...s.attributes, ...s.listeners, 'data-testid': 'store-handle' },
    isDragging: s.isDragging,
    isItemOver: active?.type === 'item' && over?.data.type === 'store' && over.data.storeId === storeId,
    /** some store is being reordered: render headers only */
    collapsed: active?.type === 'store',
  }
}

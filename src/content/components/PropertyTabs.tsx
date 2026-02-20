import React, { useState, useRef, useEffect, useCallback } from 'react'
import { usePropertyList } from '../hooks/usePropertyList'

interface PropertyTabsProps {
    onSelect: (prop: string) => void
    onPin: (prop: string) => void
}

/**
 * Filterable property tab bar. Supports mouse-wheel horizontal scrolling.
 * Click selects a property; Alt/Ctrl+click or double-click pins it.
 */
export const PropertyTabs: React.FC<PropertyTabsProps> = ({
    onSelect,
    onPin,
}) => {
    const properties = usePropertyList()
    const [filter, setFilter] = useState('')
    const listRef = useRef<HTMLDivElement>(null)
    const filterTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const [debouncedFilter, setDebouncedFilter] = useState('')

    // Debounced filter input (60ms)
    const handleFilterChange = useCallback(
        (e: React.ChangeEvent<HTMLInputElement>) => {
            const value = e.target.value
            setFilter(value)
            if (filterTimerRef.current) clearTimeout(filterTimerRef.current)
            filterTimerRef.current = setTimeout(() => {
                setDebouncedFilter(value)
            }, 60)
        },
        [],
    )

    // Mouse-wheel horizontal scroll
    useEffect(() => {
        const el = listRef.current
        if (!el) return

        const handleWheel = (ev: WheelEvent) => {
            if (ev.deltaY === 0 && ev.deltaX === 0) return
            const delta =
                Math.abs(ev.deltaX) > Math.abs(ev.deltaY) ? ev.deltaX : ev.deltaY
            if (delta) {
                ev.preventDefault()
                el.scrollLeft += delta
            }
        }

        el.addEventListener('wheel', handleWheel, { passive: false })
        return () => el.removeEventListener('wheel', handleWheel)
    }, [])

    const filtered = properties.filter((p) =>
        p.toLowerCase().includes(debouncedFilter.toLowerCase()),
    )

    return (
        <div className="paff-tabs">
            <input
                type="text"
                className="paff-filter"
                placeholder="Filter properties..."
                value={filter}
                onChange={handleFilterChange}
            />
            <div className="paff-tabs-list" ref={listRef}>
                {filtered.map((p) => (
                    <button
                        key={p}
                        className="paff-tab"
                        onClick={(e) => {
                            if (e.altKey || e.ctrlKey) {
                                onPin(p)
                            } else {
                                onSelect(p)
                            }
                        }}
                        onDoubleClick={() => onPin(p)}
                    >
                        {p}
                    </button>
                ))}
            </div>
        </div>
    )
}

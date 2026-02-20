import React, { useRef, useEffect, useCallback } from 'react'
import type { Pin } from '../types'

interface PinBarProps {
    pins: Pin[]
    onSelect: (pin: Pin) => void
    onRemove: (pin: Pin) => void
    busy: boolean
}

/**
 * Horizontal bar of pinned properties. Supports mouse-wheel horizontal scrolling.
 */
export const PinBar: React.FC<PinBarProps> = ({
    pins,
    onSelect,
    onRemove,
    busy,
}) => {
    const listRef = useRef<HTMLDivElement>(null)

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

    const handleClick = useCallback(
        (pin: Pin) => {
            if (busy) return
            onSelect(pin)
        },
        [onSelect, busy],
    )

    if (pins.length === 0) return null

    return (
        <div className="paff-pins">
            <div className="paff-pins-list" ref={listRef}>
                {pins.map((pin, idx) => (
                    <div
                        key={`${pin.control}-${pin.prop}-${idx}`}
                        className="paff-pin"
                        role="button"
                        tabIndex={0}
                        title={`${pin.control}.${pin.prop}`}
                        onClick={() => handleClick(pin)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault()
                                handleClick(pin)
                            }
                        }}
                    >
                        <span>
                            {pin.control}.{pin.prop}
                        </span>
                        <button
                            type="button"
                            className="paff-pin-close"
                            aria-label={`Remove ${pin.control}.${pin.prop}`}
                            onClick={(e) => {
                                e.stopPropagation()
                                onRemove(pin)
                            }}
                        >
                            x
                        </button>
                    </div>
                ))}
            </div>
        </div>
    )
}

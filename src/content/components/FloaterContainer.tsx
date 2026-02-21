import React, { useState, useCallback, useEffect, useRef } from 'react'
import { Rnd } from 'react-rnd'
import { FloaterHeader } from './FloaterHeader'

interface FloaterContainerProps {
    /** Main content (formula bar area) */
    children: React.ReactNode
    /** Tabs/Pins rendered between header and body */
    toolbar?: React.ReactNode
    /** Overlay rendered on top of the body */
    overlay?: React.ReactNode
    onClose: () => void
    onMinimize: () => void
    minimized: boolean
    title: string
    isFormula?: boolean
}

const DEFAULT_WIDTH = 450
const DEFAULT_HEIGHT = 340
const SNAP_MARGIN = 8

export const FloaterContainer: React.FC<FloaterContainerProps> = ({
    children,
    toolbar,
    overlay,
    onClose,
    onMinimize,
    minimized,
    title,
    isFormula = false,
}) => {
    const [pos, setPos] = useState({ x: Math.max(0, window.innerWidth - DEFAULT_WIDTH - SNAP_MARGIN), y: 64 })
    const [size, setSize] = useState({ width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT })
    const rndRef = useRef<Rnd>(null)

    // ---------------------------------------------------------------
    // Snap shortcuts: Alt+Shift+Arrow
    // ---------------------------------------------------------------
    const handleSnap = useCallback(
        (e: KeyboardEvent) => {
            if (!e.altKey || !e.shiftKey) return
            const vw = window.innerWidth
            const vh = window.innerHeight

            switch (e.code) {
                case 'KeyA': // Left
                    e.preventDefault()
                    setPos({ x: SNAP_MARGIN, y: pos.y })
                    break
                case 'KeyD': // Right
                    e.preventDefault()
                    setPos({ x: vw - size.width - SNAP_MARGIN, y: pos.y })
                    break
                case 'KeyW': // Up
                    e.preventDefault()
                    setPos({ x: pos.x, y: SNAP_MARGIN })
                    break
                case 'KeyX': // Down (Changed from S to avoid conflict)
                    e.preventDefault()
                    setPos({ x: pos.x, y: vh - size.height - SNAP_MARGIN })
                    break
                default:
                    return
            }
        },
        [pos, size],
    )

    useEffect(() => {
        window.addEventListener('keydown', handleSnap, true)
        return () => window.removeEventListener('keydown', handleSnap, true)
    }, [handleSnap])

    return (
        <Rnd
            position={pos}
            size={size}
            onDragStop={(_e, d) => setPos({ x: d.x, y: d.y })}
            onResizeStop={(_e, _dir, ref, _delta, position) => {
                setSize({
                    width: ref.offsetWidth,
                    height: ref.offsetHeight,
                })
                setPos({ x: position.x, y: position.y })
            }}
            ref={rndRef}
            minWidth={360}
            minHeight={120}
            bounds="window"
            dragHandleClassName="paff-drag-handle"
            enableResizing={!minimized}
            disableDragging={false}
            className={`paff-floater${minimized ? ' paff-minimized' : ''}`}
            style={{
                zIndex: 2147483647,
                position: 'fixed',
                pointerEvents: 'auto',
            }}
            {...(isFormula ? { 'data-paff-formula': '1' } : {})}
        >
            <div
                className="paff-floater-inner"
                onKeyDown={(e) => {
                    // Prevent Tab key from bubbling up to Power Apps Studio which might steal focus
                    if (e.key === 'Tab') {
                        e.stopPropagation()
                    }
                }}
                style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}
            >
                <FloaterHeader
                    title={title}
                    minimized={minimized}
                    onMinimize={onMinimize}
                    onClose={onClose}
                />
                {!minimized && toolbar}
                <div
                    className="paff-floater-body"
                    style={{ display: minimized ? 'none' : undefined, flexGrow: 1 }}
                >
                    {children}
                    {overlay}
                </div>
            </div>
        </Rnd>
    )
}

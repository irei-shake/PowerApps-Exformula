import React, { useState, useCallback, useEffect, useRef } from 'react'
import { Rnd } from 'react-rnd'
import { FloaterHeader } from './FloaterHeader'
import { PowerAppsService } from '../services/PowerAppsService'

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
    footer?: React.ReactNode
}

const DEFAULT_WIDTH = 450
const DEFAULT_HEIGHT = 380
const SNAP_MARGIN = 8

const MIN_WIDTH = 360

function calcPropertyPanelSnap(rect: { x: number; y: number; width: number; height: number }) {
    const vw = window.innerWidth
    const w = Math.max(rect.width, MIN_WIDTH)
    // Place as far right as possible without going off-screen
    const x = Math.max(0, Math.min(rect.x, vw - w - SNAP_MARGIN))
    return { pos: { x, y: rect.y }, size: { width: w, height: rect.height } }
}

function getInitialPosAndSize() {
    const rect = PowerAppsService.getPropertyPanelRect()
    if (rect) {
        return calcPropertyPanelSnap(rect)
    }
    return {
        pos: { x: Math.max(0, window.innerWidth - DEFAULT_WIDTH - SNAP_MARGIN), y: 64 },
        size: { width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT },
    }
}

export const FloaterContainer: React.FC<FloaterContainerProps> = ({
    children,
    toolbar,
    overlay,
    onClose,
    onMinimize,
    minimized,
    title,
    isFormula = false,
    footer,
}) => {
    const [initial] = useState(getInitialPosAndSize)
    const [pos, setPos] = useState(initial.pos)
    const [size, setSize] = useState(initial.size)
    const rndRef = useRef<Rnd>(null)

    // ---------------------------------------------------------------
    // Snap shortcuts: Alt+Shift+Arrow
    // ---------------------------------------------------------------
    const handleSnap = useCallback(
        (e: KeyboardEvent) => {
            if (!e.altKey || !e.shiftKey) return
            const vw = window.innerWidth
            const vh = window.innerHeight

            // Get the actual rendered size from Rnd element
            const rndEl = rndRef.current?.resizableElement?.current
            const currentWidth = rndEl?.offsetWidth ?? size.width
            const currentHeight = rndEl?.offsetHeight ?? size.height

            switch (e.code) {
                case 'KeyA': // Left
                    e.preventDefault()
                    setPos(prev => ({ x: SNAP_MARGIN, y: prev.y }))
                    break
                case 'KeyD': // Right
                    e.preventDefault()
                    setPos(prev => ({ x: vw - currentWidth - SNAP_MARGIN, y: prev.y }))
                    break
                case 'KeyW': // Up
                    e.preventDefault()
                    setPos(prev => ({ x: prev.x, y: SNAP_MARGIN }))
                    break
                case 'KeyX': // Down (Changed from S to avoid conflict)
                    e.preventDefault()
                    setPos(prev => ({ x: prev.x, y: vh - currentHeight - SNAP_MARGIN }))
                    break
                case 'KeyC': // Snap to property panel position
                    e.preventDefault()
                    {
                        const rect = PowerAppsService.getPropertyPanelRect()
                        if (rect) {
                            const snap = calcPropertyPanelSnap(rect)
                            setPos(snap.pos)
                            setSize(snap.size)
                        }
                    }
                    break
                default:
                    return
            }
        },
        [size],
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
                    style={{ display: minimized ? 'none' : undefined }}
                >
                    <div className="paff-floater-body-host">
                        {children}
                    </div>
                    {overlay}
                </div>
                {!minimized && footer && (
                    <div className="paff-floater-footer" style={{ borderTop: '1px solid var(--paff-border)', flexShrink: 0 }}>
                        {footer}
                    </div>
                )}
            </div>

        </Rnd>
    )
}

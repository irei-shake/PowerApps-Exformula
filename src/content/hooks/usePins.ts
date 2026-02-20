import { useState, useEffect, useCallback, useRef } from 'react'
import type { Pin } from '../types'
import { StorageService } from '../services/StorageService'

/**
 * Manages pinned properties with storage persistence.
 * Supports controlId for tracking controls across renames.
 */
export function usePins() {
    const [pins, setPins] = useState<Pin[]>([])
    const [appId, setAppId] = useState<string>('')
    const isLoaded = useRef(false)

    // Resolve app ID and load pins on mount
    useEffect(() => {
        let cancelled = false
        StorageService.resolveAppId().then((id) => {
            if (cancelled) return
            setAppId(id)
            StorageService.getPins(id).then((loaded) => {
                if (cancelled) return
                setPins(loaded)
                // Mark as loaded after first fetch to enable saving
                isLoaded.current = true
            })
        })
        return () => {
            cancelled = true
        }
    }, [])

    // Save pins whenever they change (only after initial load)
    useEffect(() => {
        if (!appId || !isLoaded.current) return
        StorageService.savePins(appId, pins).catch((err) => {
            console.error('[Formula Floater] Failed to save pins:', err)
        })
    }, [appId, pins])

    const addPin = useCallback(
        (control: string, prop: string, controlId?: string) => {
            if (!control || !prop) return
            setPins((prev) => {
                if (prev.some((p) => p.control === control && p.prop === prop)) {
                    return prev
                }
                const pin: Pin = { control, prop }
                if (controlId) pin.controlId = controlId
                return [...prev, pin]
            })
        },
        [],
    )

    const removePin = useCallback(
        (pin: Pin) => {
            setPins((prev) =>
                prev.filter((p) => p.control !== pin.control || p.prop !== pin.prop),
            )
        },
        [],
    )

    /**
     * Update a pin's control name (e.g. after detecting a rename via controlId).
     */
    const updatePinControlName = useCallback(
        (pin: Pin, newControlName: string) => {
            setPins((prev) =>
                prev.map((p) => {
                    if (
                        p === pin ||
                        (p.controlId &&
                            p.controlId === pin.controlId &&
                            p.prop === pin.prop)
                    ) {
                        return { ...p, control: newControlName }
                    }
                    return p
                }),
            )
        },
        [],
    )

    return { pins, addPin, removePin, updatePinControlName }
}

import { useState, useEffect, useCallback } from 'react'
import type { Pin } from '../types'
import { StorageService } from '../services/StorageService'

/**
 * Manages pinned properties with storage persistence.
 * Supports controlId for tracking controls across renames.
 */
export function usePins() {
    const [pins, setPins] = useState<Pin[]>([])
    const [appId, setAppId] = useState<string>('')

    // Resolve app ID and load pins on mount
    useEffect(() => {
        let cancelled = false
        StorageService.resolveAppId().then((id) => {
            if (cancelled) return
            setAppId(id)
            StorageService.getPins(id).then((loaded) => {
                if (!cancelled) setPins(loaded)
            })
        })
        return () => {
            cancelled = true
        }
    }, [])

    const addPin = useCallback(
        (control: string, prop: string, controlId?: string) => {
            if (!control || !prop) return
            setPins((prev) => {
                if (prev.some((p) => p.control === control && p.prop === prop)) {
                    return prev
                }
                const pin: Pin = { control, prop }
                if (controlId) pin.controlId = controlId
                const next = [...prev, pin]
                if (appId) StorageService.savePins(appId, next)
                return next
            })
        },
        [appId],
    )

    const removePin = useCallback(
        (pin: Pin) => {
            setPins((prev) => {
                const next = prev.filter(
                    (p) => p.control !== pin.control || p.prop !== pin.prop,
                )
                if (appId) StorageService.savePins(appId, next)
                return next
            })
        },
        [appId],
    )

    /**
     * Update a pin's control name (e.g. after detecting a rename via controlId).
     */
    const updatePinControlName = useCallback(
        (pin: Pin, newControlName: string) => {
            setPins((prev) => {
                const next = prev.map((p) => {
                    if (p === pin || (p.controlId && p.controlId === pin.controlId && p.prop === pin.prop)) {
                        return { ...p, control: newControlName }
                    }
                    return p
                })
                if (appId) StorageService.savePins(appId, next)
                return next
            })
        },
        [appId],
    )

    return { pins, addPin, removePin, updatePinControlName }
}

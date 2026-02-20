import { useState, useCallback } from 'react'

/**
 * Manages the floater panel state: visibility, minimized state, and busy indicator.
 */
export function useFloaterState() {
    const [visible, setVisible] = useState(false)
    const [minimized, setMinimized] = useState(false)
    const [busy, setBusy] = useState(false)
    const [busyText, setBusyText] = useState('')

    const show = useCallback(() => setVisible(true), [])
    const hide = useCallback(() => {
        setVisible(false)
        setMinimized(false)
    }, [])

    const toggleMinimize = useCallback(
        () => setMinimized((prev) => !prev),
        [],
    )

    const startBusy = useCallback((text: string) => {
        setBusy(true)
        setBusyText(text)
    }, [])

    const stopBusy = useCallback(() => {
        setBusy(false)
        setBusyText('')
    }, [])

    return {
        visible,
        minimized,
        busy,
        busyText,
        show,
        hide,
        setVisible,
        toggleMinimize,
        startBusy,
        stopBusy,
    }
}

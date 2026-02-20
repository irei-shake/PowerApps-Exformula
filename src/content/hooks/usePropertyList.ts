import { useState, useEffect } from 'react'
import { PowerAppsService } from '../services/PowerAppsService'

/**
 * Provides a debounced, auto-updating property list from Power Apps Studio.
 */
export function usePropertyList() {
    const [properties, setProperties] = useState<string[]>([])

    useEffect(() => {
        const unsubscribe = PowerAppsService.subscribeProperties((props) => {
            setProperties(props)
        })
        return () => unsubscribe()
    }, [])

    return properties
}

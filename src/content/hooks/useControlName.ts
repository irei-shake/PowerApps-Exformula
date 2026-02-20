import { useState, useEffect } from 'react'
import { PowerAppsService } from '../services/PowerAppsService'

/**
 * Track the currently selected control name in Power Apps Studio
 * by observing multiple DOM elements.
 */
export function useControlName() {
    const [controlName, setControlName] = useState<string>('')

    useEffect(() => {
        let disposed = false

        const apply = () => {
            if (disposed) return
            const name = PowerAppsService.readCurrentControlName()
            if (name) {
                setControlName((prev) => (prev !== name ? name : prev))
            }
        }

        // Initial read
        apply()

        // Observe DOM changes that indicate control selection changes
        const observers: MutationObserver[] = []

        // 1) Tree view (control selection)
        try {
            const tree =
                document.querySelector('[role="tree"]') ?? document.body
            const moTree = new MutationObserver(apply)
            moTree.observe(tree, {
                subtree: true,
                attributes: true,
                attributeFilter: ['aria-selected', 'aria-label'],
                childList: true,
                characterData: true,
            })
            observers.push(moTree)
        } catch {
            /* ignore */
        }

        // 2) Control name header
        try {
            const nameNode = document.getElementById(
                'control-sidebar-header-control-name',
            )
            if (nameNode) {
                const moName = new MutationObserver(apply)
                moName.observe(nameNode, {
                    subtree: true,
                    attributes: true,
                    childList: true,
                    characterData: true,
                })
                observers.push(moName)
            }
        } catch {
            /* ignore */
        }

        // 3) Property combo box changes
        try {
            const combo = document.getElementById('powerapps-property-combo-box')
            if (combo) {
                const moProp = new MutationObserver(apply)
                moProp.observe(combo, {
                    subtree: true,
                    attributes: true,
                    childList: true,
                    characterData: true,
                })
                observers.push(moProp)
            }
        } catch {
            /* ignore */
        }

        // Also listen for clicks (control selection via mouse)
        window.addEventListener('click', apply, true)

        return () => {
            disposed = true
            observers.forEach((mo) => {
                try {
                    mo.disconnect()
                } catch {
                    /* ignore */
                }
            })
            window.removeEventListener('click', apply, true)
        }
    }, [])

    return controlName
}

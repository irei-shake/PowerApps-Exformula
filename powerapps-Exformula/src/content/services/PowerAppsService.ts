export class PowerAppsService {
    private static observer: MutationObserver | null = null
    private static callbacks: Set<(props: string[]) => void> = new Set()

    static async getProperties(): Promise<string[]> {
        // Try to get from Advanced tab first
        const adv = document.getElementById('appmagic-control-sidebar-advanced-tab-content')
        if (adv) {
            return this.extractFromAdvanced(adv)
        }
        // Fallback to combo box
        return this.extractFromCombo()
    }

    static subscribeProperties(callback: (props: string[]) => void): () => void {
        this.callbacks.add(callback)
        if (!this.observer) {
            this.startObserving()
        }
        // Initial fetch
        this.getProperties().then(props => callback(props))

        return () => {
            this.callbacks.delete(callback)
            if (this.callbacks.size === 0) {
                this.stopObserving()
            }
        }
    }

    private static startObserving() {
        // Observe the sidebar container or body for changes that might indicate property list updates
        const target = document.body
        this.observer = new MutationObserver(() => {
            this.getProperties().then(props => {
                this.notify(props)
            })
        })
        this.observer.observe(target, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style', 'aria-label'] })
    }

    private static stopObserving() {
        if (this.observer) {
            this.observer.disconnect()
            this.observer = null
        }
    }

    private static notify(props: string[]) {
        // Simple debounce or check if changed could be added here
        // For now, just notify
        if (props.length > 0) {
            this.callbacks.forEach(cb => cb(props))
        }
    }

    private static extractFromAdvanced(advEl: HTMLElement): string[] {
        const names = new Set<string>()
        // DetailsList rows
        const rows = advEl.querySelectorAll('[role="row"], [data-automationid^="DetailsRow"], .ms-DetailsRow')
        rows.forEach(row => {
            let text = ''
            const cell = row.querySelector('[role="gridcell"], [data-automationid^="DetailsRowCell"], .ms-DetailsRow-cell')
            if (cell) text = (cell.textContent || '').trim()
            if (!text) {
                const label = row.querySelector('label, [aria-label]')
                if (label) text = (label.getAttribute('aria-label') || label.textContent || '').trim()
            }
            if (text) names.add(text)
        })
        // Input labels
        const labels = advEl.querySelectorAll('label, [data-automationid*="PropertyName"], .property-name')
        labels.forEach(l => {
            const t = (l.getAttribute('aria-label') || l.textContent || '').trim()
            if (t) names.add(t)
        })
        return Array.from(names).sort()
    }

    private static async extractFromCombo(): Promise<string[]> {
        const combo = document.getElementById('powerapps-property-combo-box')
        if (!combo) return []

        // We don't want to click the combo box every time we observe a change, 
        // as that would be disruptive.
        // So for the combo box strategy, we might only be able to fetch when explicitly asked 
        // or we have to be very careful.
        // However, if the advanced tab is not present, we might have to rely on the user interacting 
        // or just return what we can find.

        // For stability, let's avoid auto-clicking the combo box in the background observer loop.
        // We only click it if we are sure we need to.
        // But for now, let's keep the manual extraction logic separate.

        // If we are in the observer loop, we might want to skip the combo box click 
        // unless we are sure it's safe.
        // For this implementation, let's just return empty if we can't find the advanced tab
        // to avoid UI interference, OR we can try to read the combo box if it's already open.

        return []
    }

    static async selectProperty(name: string) {
        const combo = document.getElementById('powerapps-property-combo-box')
        if (!combo) return

        this.safeClick(combo)
        const lb = await this.waitForListbox()
        if (!lb) return

        const opt = Array.from(lb.querySelectorAll('[role="option"], .ms-ComboBox-option, .ms-Dropdown-item'))
            .find(li => ((li.getAttribute('aria-label') || li.textContent || '').trim()) === name)

        if (opt) this.safeClick(opt as HTMLElement)
        this.escClose()
    }

    private static safeClick(el: HTMLElement) {
        try { el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })) } catch { }
        try { el.click() } catch { }
    }

    private static escClose() {
        try { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })) } catch { }
        try { document.dispatchEvent(new KeyboardEvent('keyup', { key: 'Escape', bubbles: true })) } catch { }
    }

    private static waitForListbox(timeout = 1000): Promise<HTMLElement | null> {
        return new Promise(resolve => {
            const start = performance.now()
            const tick = () => {
                const lb = document.querySelector('[role="listbox"], .ms-ComboBox-optionsContainer, .ms-Dropdown-callout')
                if (lb) return resolve(lb as HTMLElement)
                if (performance.now() - start > timeout) return resolve(null)
                requestAnimationFrame(tick)
            }
            tick()
        })
    }
}

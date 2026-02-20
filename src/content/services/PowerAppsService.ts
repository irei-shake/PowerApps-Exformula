/**
 * Interacts with Power Apps Studio's DOM to:
 * - Read property lists (from Advanced tab or combo box)
 * - Select properties programmatically
 * - Read and select controls
 */
export class PowerAppsService {
    private static observer: MutationObserver | null = null
    private static callbacks = new Set<(props: string[]) => void>()
    private static debounceTimer: ReturnType<typeof setTimeout> | null = null

    private static DEBOUNCE_MS = 120

    // -------------------------------------------------------------------
    // Property List
    // -------------------------------------------------------------------

    static async getProperties(): Promise<string[]> {
        const adv = document.getElementById(
            'appmagic-control-sidebar-advanced-tab-content',
        )
        if (adv) return this.extractFromAdvanced(adv)
        return this.extractFromCombo()
    }

    /**
     * Subscribe to property list changes. Uses a debounced MutationObserver
     * scoped to the Advanced tab when available, falling back to a broader scope.
     */
    static subscribeProperties(
        callback: (props: string[]) => void,
    ): () => void {
        this.callbacks.add(callback)

        if (!this.observer) {
            this.startObserving()
        }

        // Initial fetch
        this.getProperties().then((props) => callback(props))

        return () => {
            this.callbacks.delete(callback)
            if (this.callbacks.size === 0) {
                this.stopObserving()
            }
        }
    }

    private static startObserving() {
        // Prefer observing the Advanced panel (narrower scope = less overhead)
        const advPanel = document.getElementById(
            'appmagic-control-sidebar-advanced-tab-content',
        )
        const target = advPanel ?? document.body

        this.observer = new MutationObserver(() => {
            this.debouncedNotify()
        })

        this.observer.observe(target, {
            childList: true,
            subtree: true,
            characterData: true,
            // Only watch class/style/aria changes, not every attribute
            attributes: true,
            attributeFilter: ['class', 'style', 'aria-label', 'aria-selected'],
        })
    }

    private static stopObserving() {
        if (this.observer) {
            this.observer.disconnect()
            this.observer = null
        }
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer)
            this.debounceTimer = null
        }
    }

    private static debouncedNotify() {
        if (this.debounceTimer) clearTimeout(this.debounceTimer)
        this.debounceTimer = setTimeout(() => {
            this.getProperties().then((props) => {
                if (props.length > 0) {
                    this.callbacks.forEach((cb) => cb(props))
                }
            })
        }, this.DEBOUNCE_MS)
    }

    // -------------------------------------------------------------------
    // Property Extraction
    // -------------------------------------------------------------------

    private static extractFromAdvanced(advEl: HTMLElement): string[] {
        const names = new Set<string>()

        // DetailsList rows
        const rows = advEl.querySelectorAll(
            '[role="row"], [data-automationid^="DetailsRow"], .ms-DetailsRow',
        )
        rows.forEach((row) => {
            let text = ''
            const cell = row.querySelector(
                '[role="gridcell"], [data-automationid^="DetailsRowCell"], .ms-DetailsRow-cell',
            )
            if (cell) text = (cell.textContent || '').trim()
            if (!text) {
                const label = row.querySelector('label, [aria-label]')
                if (label)
                    text = (
                        label.getAttribute('aria-label') ||
                        label.textContent ||
                        ''
                    ).trim()
            }
            if (text) names.add(text)
        })

        // Input labels
        const labels = advEl.querySelectorAll(
            'label, [data-automationid*="PropertyName"], .property-name',
        )
        labels.forEach((l) => {
            const t = (
                l.getAttribute('aria-label') ||
                l.textContent ||
                ''
            ).trim()
            if (t) names.add(t)
        })

        return Array.from(names).sort()
    }

    private static async extractFromCombo(): Promise<string[]> {
        const combo = document.getElementById('powerapps-property-combo-box')
        if (!combo) return []

        // Only read options if the listbox is already open to avoid UI interference
        const existingLb = document.querySelector(
            '[role="listbox"], .ms-ComboBox-optionsContainer, .ms-Dropdown-callout',
        )
        if (existingLb) {
            const items = Array.from(
                existingLb.querySelectorAll(
                    '[role="option"], .ms-ComboBox-option, .ms-Dropdown-item',
                ),
            )
            const names = items
                .map((li) =>
                    (li.getAttribute('aria-label') || li.textContent || '').trim(),
                )
                .filter(Boolean)
            return Array.from(new Set(names))
        }

        return []
    }

    // -------------------------------------------------------------------
    // Property Selection
    // -------------------------------------------------------------------

    static async selectProperty(name: string): Promise<void> {
        const combo = document.getElementById('powerapps-property-combo-box')
        if (!combo) return

        this.safeClick(combo)
        const lb = await this.waitForListbox()
        if (!lb) return

        const opt = Array.from(
            lb.querySelectorAll(
                '[role="option"], .ms-ComboBox-option, .ms-Dropdown-item',
            ),
        ).find(
            (li) =>
                (
                    li.getAttribute('aria-label') ||
                    li.textContent ||
                    ''
                ).trim() === name,
        )

        if (opt) this.safeClick(opt as HTMLElement)
        this.escClose()
    }

    // -------------------------------------------------------------------
    // Control Name
    // -------------------------------------------------------------------

    /**
     * Read the currently selected control name from Power Apps Studio DOM.
     * Uses multiple strategies for robustness.
     */
    static readCurrentControlName(): string {
        // Strategy 1: Sidebar header
        try {
            const nameEl = document.getElementById(
                'control-sidebar-header-control-name',
            )
            const t = (
                nameEl?.textContent ||
                nameEl?.getAttribute('title') ||
                ''
            ).trim()
            if (t) return t
        } catch {
            /* continue */
        }

        // Strategy 2: Selected tree item
        try {
            const sel = document.querySelector(
                '[role="treeitem"][aria-selected="true"]',
            )
            if (sel) {
                const name = (
                    sel.getAttribute('aria-label') ||
                    sel.textContent ||
                    ''
                ).trim()
                if (name) return name
            }
        } catch {
            /* continue */
        }

        // Strategy 3: Data attributes
        try {
            const el = document.querySelector(
                '[data-control-name], [data-selected-control]',
            )
            const name = (
                el?.getAttribute('data-control-name') ||
                el?.getAttribute('data-selected-control') ||
                el?.textContent ||
                ''
            ).trim()
            if (name) return name
        } catch {
            /* continue */
        }

        return ''
    }

    // -------------------------------------------------------------------
    // Control Selection
    // -------------------------------------------------------------------

    /**
     * Select a control in the Power Apps tree view.
     * When controlId (data-fui-tree-item-value) is available, uses it as primary lookup.
     * Falls back to name search only when controlId is not provided.
     * Returns resolvedName if the actual name differs from the stored name.
     */
    static async selectControl(
        name: string,
        controlId?: string,
    ): Promise<{ success: boolean; resolvedName?: string }> {
        if (!name && !controlId) return { success: false }

        let target: HTMLElement | null = null

        if (controlId) {
            // -- Primary: search by controlId (stable across renames) --
            target = this.findTreeItemById(controlId)
            if (!target) {
                // Expand collapsed nodes and retry
                await this.expandTreeToReveal('')
                target = this.findTreeItemById(controlId)
            }
        }

        if (!target) {
            // -- Fallback: search by name --
            const lower = name.toLowerCase()
            target = this.findTreeItem(lower)
            if (!target) {
                const expanded = await this.expandTreeToReveal(lower)
                if (expanded) {
                    target = this.findTreeItem(lower)
                }
            }
        }

        if (!target) return { success: false }

        // Click the found element
        const actualName = (
            target.getAttribute('aria-label') || target.textContent || ''
        ).trim()
        this.safeClick(target)
        const actualLower = actualName.toLowerCase()
        const ok = await this.waitForControlSelected(actualLower)

        // Return resolvedName if the actual name differs from the stored name
        // Set resolvedName regardless of waitForControlSelected result,
        // since the click may have succeeded even if verification times out
        const result: { success: boolean; resolvedName?: string } = {
            success: ok || !!target,
        }
        if (actualName && actualName !== name) {
            result.resolvedName = actualName
        }
        return result
    }

    /**
     * Backward-compatible wrapper: select by name only.
     */
    static async selectControlByName(name: string): Promise<boolean> {
        const result = await this.selectControl(name)
        return result.success
    }

    /**
     * Get the data-fui-tree-item-value for the currently selected control.
     * This value is stable across renames and page reloads.
     */
    static getControlIdForSelected(): string | undefined {
        const sel = document.querySelector<HTMLElement>(
            '[role="treeitem"][aria-selected="true"]',
        )
        return sel?.getAttribute('data-fui-tree-item-value') ?? undefined
    }

    /**
     * Get the data-fui-tree-item-value for a control with the given name.
     */
    static getControlIdForName(name: string): string | undefined {
        const lower = name.toLowerCase()
        const item = this.findTreeItem(lower)
        return item?.getAttribute('data-fui-tree-item-value') ?? undefined
    }

    /**
     * Find a tree item by its data-fui-tree-item-value.
     */
    private static findTreeItemById(controlId: string): HTMLElement | null {
        return document.querySelector<HTMLElement>(
            `[role="treeitem"][data-fui-tree-item-value="${controlId}"]`,
        )
    }

    /**
     * Find a tree item element matching the given lowercase name.
     */
    private static findTreeItem(lower: string): HTMLElement | null {
        const items = Array.from(
            document.querySelectorAll<HTMLElement>('[role="treeitem"]'),
        )

        // Exact match on aria-label
        return (
            items.find(
                (el) =>
                    (el.getAttribute('aria-label') || '').trim().toLowerCase() ===
                    lower,
            ) ??
            // Exact match on text content
            items.find(
                (el) =>
                    (
                        el.getAttribute('aria-label') ||
                        el.textContent ||
                        ''
                    )
                        .trim()
                        .toLowerCase() === lower,
            ) ??
            // Partial match
            items.find((el) =>
                (el.getAttribute('aria-label') || el.textContent || '')
                    .trim()
                    .toLowerCase()
                    .includes(lower),
            ) ??
            null
        )
    }

    /**
     * Wait for the control with the given name to be selected in the tree.
     */
    private static waitForControlSelected(lower: string): Promise<boolean> {
        return this.waitFor(() => {
            const sel = document.querySelector(
                '[role="treeitem"][aria-selected="true"]',
            )
            const txt = (
                sel?.getAttribute('aria-label') ||
                sel?.textContent ||
                ''
            )
                .trim()
                .toLowerCase()
            return txt === lower
        }, 1500)
    }

    /**
     * Expand collapsed tree nodes to reveal the target control.
     * Iterates through all collapsed tree groups and expands them one by one,
     * checking after each expansion if the target has appeared.
     */
    private static async expandTreeToReveal(lower: string): Promise<boolean> {
        // Maximum number of expansions to prevent infinite loops
        const MAX_EXPANSIONS = 30
        let expansions = 0

        for (let pass = 0; pass < 3; pass++) {
            // Find all collapsed tree items (containers with children)
            const collapsed = Array.from(
                document.querySelectorAll<HTMLElement>(
                    '[role="treeitem"][aria-expanded="false"]',
                ),
            )

            if (collapsed.length === 0) break

            for (const node of collapsed) {
                if (expansions >= MAX_EXPANSIONS) return false

                // Expand this node by clicking its expand toggle
                const expanded = await this.expandTreeNode(node)
                if (!expanded) continue
                expansions++

                // Check if target is now visible
                if (this.findTreeItem(lower)) return true
            }
        }

        return this.findTreeItem(lower) !== null
    }

    /**
     * Expand a single collapsed tree node.
     * Finds the expand/collapse toggle and clicks it, then waits for children to appear.
     */
    private static async expandTreeNode(node: HTMLElement): Promise<boolean> {
        // Skip if already expanded
        if (node.getAttribute('aria-expanded') !== 'false') return true

        // Strategy 1: Find an expand button/icon within the tree item
        const toggleIcon = node.querySelector<HTMLElement>(
            '[class*="expand" i], [class*="chevron" i], [class*="toggle" i], [class*="arrow" i], ' +
            '[data-icon-name*="Chevron"], [data-icon-name*="expand"], ' +
            'i[class*="ChevronRight"], i[class*="ChevronDown"], ' +
            '.ms-Button--icon, [role="button"]',
        )

        if (toggleIcon) {
            this.safeClick(toggleIcon)
        } else {
            // Strategy 2: Double-click the tree item itself to toggle expand
            try {
                node.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))
            } catch {
                // Strategy 3: Click directly and hope for expansion
                this.safeClick(node)
            }
        }

        // Wait for the node to become expanded
        const expanded = await this.waitFor(() => {
            return node.getAttribute('aria-expanded') === 'true'
        }, 800)

        if (expanded) {
            // Small delay for child DOM to be fully rendered
            await new Promise((r) => setTimeout(r, 100))
        }

        return expanded
    }

    // -------------------------------------------------------------------
    // Utility
    // -------------------------------------------------------------------

    static safeClick(el: HTMLElement): void {
        try {
            el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
        } catch {
            /* ignore */
        }
        try {
            el.click()
        } catch {
            /* ignore */
        }
    }

    static escClose(): void {
        try {
            document.dispatchEvent(
                new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
            )
        } catch {
            /* ignore */
        }
        try {
            document.dispatchEvent(
                new KeyboardEvent('keyup', { key: 'Escape', bubbles: true }),
            )
        } catch {
            /* ignore */
        }
    }

    static waitForListbox(timeout = 1000): Promise<HTMLElement | null> {
        return new Promise((resolve) => {
            const start = performance.now()
            const tick = () => {
                const lb = document.querySelector(
                    '[role="listbox"], .ms-ComboBox-optionsContainer, .ms-Dropdown-callout',
                )
                if (lb) return resolve(lb as HTMLElement)
                if (performance.now() - start > timeout) return resolve(null)
                requestAnimationFrame(tick)
            }
            tick()
        })
    }

    /**
     * Wait for a predicate to become true (polling via requestAnimationFrame).
     */
    static waitFor(
        pred: () => boolean,
        timeout = 1000,
    ): Promise<boolean> {
        return new Promise((resolve) => {
            const start = performance.now()
            const tick = () => {
                try {
                    if (pred()) return resolve(true)
                } catch {
                    /* ignore */
                }
                if (performance.now() - start > timeout) return resolve(false)
                requestAnimationFrame(tick)
            }
            tick()
        })
    }
}

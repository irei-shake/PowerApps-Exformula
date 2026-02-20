/**
 * DOM manipulation service for detaching / restoring elements and
 * adjusting Power Apps layout when the formula bar is floating.
 */
export class DomService {
    private static placeholderMap = new Map<HTMLElement, HTMLElement>()
    private static observerMap = new Map<HTMLElement, MutationObserver>()
    private static sectionCleanupMap = new Map<HTMLElement, () => void>()

    // -------------------------------------------------------------------
    // Detachability checks
    // -------------------------------------------------------------------

    static isDetachable(el: HTMLElement): boolean {
        if (!el || el === document.documentElement || el === document.body)
            return false
        if (
            el.classList &&
            (el.classList.contains('paff-floater') || el.closest('.paff-floater'))
        )
            return false
        const role = el.getAttribute('role')
        if (role === 'banner' || role === 'navigation') return false
        return true
    }

    /**
     * Walk up the DOM to find a meaningful detach candidate.
     */
    static findCandidate(target: HTMLElement): HTMLElement {
        let el: HTMLElement | null = target
        const maxDepth = 12
        for (let i = 0; i < maxDepth && el; i++) {
            if (!this.isDetachable(el)) {
                el = el.parentElement
                continue
            }
            const cl = el.className ? el.className.toString() : ''
            if (
                cl.includes('monaco-editor') ||
                cl.includes('monaco') ||
                cl.includes('formula') ||
                cl.includes('text-area') ||
                cl.includes('editor') ||
                el.tagName === 'TEXTAREA' ||
                el.tagName === 'INPUT' ||
                el.getAttribute('contenteditable') === 'true' ||
                el.getAttribute('role') === 'textbox' ||
                el.getBoundingClientRect().height > 40
            ) {
                return el
            }
            el = el.parentElement
        }
        return target
    }

    // -------------------------------------------------------------------
    // Formula bar detection
    // -------------------------------------------------------------------

    /** Check if a given element is or contains the formula panel. */
    static isFormulaPanel(el: HTMLElement | null): boolean {
        if (!el) return false
        if (el.id === 'formulabar') return true
        if (el.querySelector?.('#formulabar')) return true
        const hasMonaco = el.querySelector?.(
            '.monaco-editor, [class*="monaco"]',
        )
        const hasCombo = el.querySelector?.('#powerapps-property-combo-box')
        const globalCombo = document.getElementById(
            'powerapps-property-combo-box',
        )
        return !!(hasMonaco && (hasCombo || globalCombo))
    }

    static findFormulaBar(): HTMLElement | null {
        const byId = document.getElementById('formulabar')
        if (byId && this.isElVisible(byId)) return byId

        const bySelector = document.querySelector('#formulabar') as HTMLElement | null
        if (bySelector && this.isElVisible(bySelector)) return bySelector

        // Heuristic: find largest visible Monaco editor
        return this.findByHeuristic()
    }

    /**
     * Score-based heuristic to find the formula bar when no explicit id exists.
     * Ported from legacy `tryAutoDetachFormula`.
     */
    private static findByHeuristic(): HTMLElement | null {
        const candidates = Array.from(
            document.querySelectorAll<HTMLElement>(
                '.monaco-editor, [class*="monaco"], [role="textbox"], textarea, input[type="text"]',
            ),
        )

        const scored = candidates
            .filter((el) => {
                if (el.closest('.paff-floater')) return false
                const cs = getComputedStyle(el)
                if (cs.display === 'none' || cs.visibility === 'hidden') return false
                const r = el.getBoundingClientRect()
                return (
                    r.width > 360 &&
                    r.height > 40 &&
                    r.bottom > 0 &&
                    r.right > 0 &&
                    r.left < window.innerWidth &&
                    r.top < window.innerHeight
                )
            })
            .map((el) => {
                const r = el.getBoundingClientRect()
                const cl = el.className ? el.className.toString() : ''
                let score = 0
                score += (window.innerHeight - r.top) / window.innerHeight
                score += Math.min(1, r.width / window.innerWidth)
                if (cl.includes('monaco')) score += 2
                const label =
                    el.getAttribute('aria-label') || el.getAttribute('placeholder') || ''
                if (/formula/i.test(label)) score += 3
                return { el, score }
            })

        scored.sort((a, b) => b.score - a.score)
        const best = scored[0]?.el
        if (!best) return null

        // Try to find a common container wrapping editor + combo
        return this.findFormulaContainer(best) ?? this.findCandidate(best)
    }

    /**
     * Walk up from editor element to find a container that wraps both the editor
     * and a combo box (likely the formula bar area).
     */
    private static findFormulaContainer(
        editorEl: HTMLElement,
    ): HTMLElement | null {
        const maxDepth = 8
        let p = editorEl.parentElement
        for (let i = 0; i < maxDepth && p; i++, p = p.parentElement) {
            const combo = p.querySelector(
                '[role="combobox"], [aria-haspopup="listbox"], select, .ms-Dropdown, .ms-ComboBox',
            )
            if (combo && !combo.contains(editorEl) && p.contains(editorEl)) {
                const r = p.getBoundingClientRect()
                if (r.width > 400 && r.height < 260) return p
            }
        }
        const sibCombo = editorEl.parentElement?.querySelector(
            '[role="combobox"], [aria-haspopup="listbox"], select, .ms-Dropdown, .ms-ComboBox',
        )
        if (sibCombo) return editorEl.parentElement
        return null
    }

    static isElVisible(el: HTMLElement): boolean {
        if (!el) return false
        const cs = getComputedStyle(el)
        if (cs.display === 'none' || cs.visibility === 'hidden') return false
        const r = el.getBoundingClientRect()
        return (
            r.width > 4 &&
            r.height > 4 &&
            r.bottom > 0 &&
            r.right > 0 &&
            r.left < window.innerWidth &&
            r.top < window.innerHeight
        )
    }

    // -------------------------------------------------------------------
    // Detach / Restore
    // -------------------------------------------------------------------

    static detach(target: HTMLElement): HTMLElement {
        if (this.placeholderMap.has(target)) return target

        const placeholder = document.createElement('div')
        placeholder.style.display = target.style.display || 'block'
        placeholder.style.width =
            target.style.width || `${target.getBoundingClientRect().width}px`
        placeholder.style.height = '0px'
        placeholder.dataset.paffPlaceholder = '1'

        if (target.parentElement) {
            target.parentElement.insertBefore(placeholder, target)
        }
        this.placeholderMap.set(target, placeholder)

        // Reset styles for floating
        target.style.width = '100%'
        target.style.maxWidth = 'none'
        target.style.boxSizing = 'border-box'
        target.style.height = 'auto'
        target.style.minHeight = '0'
        target.style.overflow = 'visible'

        // Mark formula detachment on documentElement
        if (this.isFormulaPanel(target)) {
            document.documentElement.classList.add('paff-detached-formula')
        }

        // Apply margin fix for Monaco editor
        this.applyMarginFix(target)
        // Hide Copilot button inside detached formula bar
        this.hideCopilotElements(target)

        const observer = new MutationObserver(() => {
            this.applyMarginFix(target)
            this.hideCopilotElements(target)
        })
        observer.observe(target, {
            subtree: true,
            childList: true,
            attributes: true,
        })
        this.observerMap.set(target, observer)

        return target
    }

    static restore(target: HTMLElement) {
        const placeholder = this.placeholderMap.get(target)

        // Cleanup mutation observer
        const observer = this.observerMap.get(target)
        if (observer) {
            observer.disconnect()
            this.observerMap.delete(target)
        }

        // Cleanup section auto-height
        const sectionCleanup = this.sectionCleanupMap.get(target)
        if (sectionCleanup) {
            sectionCleanup()
            this.sectionCleanupMap.delete(target)
        }

        if (placeholder?.parentElement) {
            placeholder.parentElement.insertBefore(target, placeholder)
            placeholder.remove()
            this.placeholderMap.delete(target)

            target.style.width = ''
            target.style.maxWidth = ''
            target.style.height = ''
            target.style.minHeight = ''
            target.style.overflow = ''
            target.style.boxSizing = ''

            this.removeMarginFix(target)
            this.restoreCopilotElements(target)
        }

        // Remove formula class if no more formula floaters
        if (!document.querySelector('.paff-floater[data-paff-formula="1"]')) {
            document.documentElement.classList.remove('paff-detached-formula')
        }
    }

    // -------------------------------------------------------------------
    // Section Auto-Height (ResizeObserver based)
    // -------------------------------------------------------------------

    /**
     * Automatically adjust the editor section height within the floater
     * so it fills all available vertical space.
     */
    static setupSectionAutoHeight(
        container: HTMLElement,
        floaterEl: HTMLElement,
    ): (() => void) | null {
        const fbRoot =
            container.id === 'formulabar'
                ? container
                : (container.querySelector('#formulabar') as HTMLElement) ?? container
        const editor = fbRoot.querySelector('#powerFxFormulaEditor')
        const section =
            (editor?.closest(
                'section, .Section, [data-role="Section"]',
            ) as HTMLElement) ??
            (fbRoot.querySelector(
                'section, .Section, [data-role="Section"]',
            ) as HTMLElement)

        if (!section) return null

        // Save original styles for restore
        const saved = {
            height: section.style.height,
            maxHeight: section.style.maxHeight,
            minHeight: section.style.minHeight,
            overflow: section.style.overflow,
            fbHeight: fbRoot.style.height,
        }

        try {
            fbRoot.style.setProperty('width', 'auto', 'important')
        } catch {
            /* ignore */
        }

        const apply = () => {
            const headerEl = floaterEl.querySelector(
                '.paff-floater-header',
            ) as HTMLElement | null
            const tabsEl = floaterEl.querySelector('.paff-tabs') as HTMLElement | null
            const pinsEl = floaterEl.querySelector('.paff-pins') as HTMLElement | null
            const panelH = floaterEl.getBoundingClientRect().height
            const headerH = headerEl?.getBoundingClientRect().height ?? 0
            const tabsH = tabsEl?.getBoundingClientRect().height ?? 0
            const pinsH = pinsEl?.getBoundingClientRect().height ?? 0
            const available = Math.max(
                0,
                Math.round(panelH - headerH - pinsH - tabsH),
            )

            // Sum heights of non-editor children
            let nonEditorSum = 0
            Array.from(fbRoot.children).forEach((ch) => {
                if (!ch) return
                if (editor && (ch === editor || ch.contains(editor))) return
                const r = (ch as HTMLElement).getBoundingClientRect()
                const cs = getComputedStyle(ch as HTMLElement)
                nonEditorSum += Math.max(
                    0,
                    Math.round(
                        r.height +
                        parseFloat(cs.marginTop || '0') +
                        parseFloat(cs.marginBottom || '0'),
                    ),
                )
            })

            const targetHeight = Math.max(0, available - nonEditorSum - 5)
            section.style.height = `${targetHeight}px`
            section.style.width = '100%'
            section.style.maxWidth = 'none'
            section.style.boxSizing = 'border-box'
            section.style.maxHeight = 'none'
            section.style.minHeight = '0px'
            section.style.overflow = 'auto'
        }

        apply()

        const roPanel = new ResizeObserver(() => apply())
        try {
            roPanel.observe(floaterEl)
        } catch {
            /* ignore */
        }

        const roFb = new ResizeObserver(() => apply())
        try {
            roFb.observe(fbRoot)
        } catch {
            /* ignore */
        }

        const wrapper = fbRoot.querySelector('#ufb-resizer-wrapper') as HTMLElement | null
        let roWrapper: ResizeObserver | null = null
        if (wrapper) {
            roWrapper = new ResizeObserver(() => apply())
            try {
                roWrapper.observe(wrapper)
            } catch {
                /* ignore */
            }
        }

        const onWinResize = () => apply()
        window.addEventListener('resize', onWinResize, true)

        const cleanup = () => {
            try {
                roPanel.disconnect()
            } catch {
                /* ignore */
            }
            try {
                roFb.disconnect()
            } catch {
                /* ignore */
            }
            try {
                roWrapper?.disconnect()
            } catch {
                /* ignore */
            }
            window.removeEventListener('resize', onWinResize, true)
            section.style.height = saved.height
            section.style.maxHeight = saved.maxHeight
            section.style.minHeight = saved.minHeight
            section.style.overflow = saved.overflow
            fbRoot.style.height = saved.fbHeight
        }

        this.sectionCleanupMap.set(container, cleanup)
        return cleanup
    }

    // -------------------------------------------------------------------
    // Monaco margin fix
    // -------------------------------------------------------------------

    private static applyMarginFix(target: HTMLElement) {
        try {
            const root = target.querySelector('.monaco-editor')
            const margin = root?.querySelector('.margin') as HTMLElement | null
            if (margin) {
                margin.style.setProperty('pointer-events', 'none', 'important')
                margin.style.setProperty('width', '0px', 'important')
            }
            const glyphs = target.querySelectorAll<HTMLElement>('.glyph-margin')
            glyphs.forEach((g) => {
                g.style.setProperty('display', 'none', 'important')
            })
        } catch {
            /* ignore */
        }
    }

    private static removeMarginFix(target: HTMLElement) {
        try {
            const margins = target.querySelectorAll<HTMLElement>('.margin')
            margins.forEach((m) => {
                m.style.removeProperty('pointer-events')
                m.style.removeProperty('width')
            })
            const glyphs = target.querySelectorAll<HTMLElement>('.glyph-margin')
            glyphs.forEach((g) => {
                g.style.removeProperty('display')
            })
        } catch {
            /* ignore */
        }
    }

    /**
     * Hide Copilot-related elements inside the detached formula bar.
     * Also collapses parent containers that become empty after hiding.
     */
    private static hideCopilotElements(target: HTMLElement) {
        try {
            const selectors = [
                '[class*="copilot" i]',
                '[id*="copilot" i]',
                '[aria-label*="Copilot"]',
                '[data-testid*="copilot" i]',
                '[data-automation-id*="copilot" i]',
            ]
            const query = selectors.join(', ')
            const elements = target.querySelectorAll<HTMLElement>(query)
            elements.forEach((el) => {
                if (el.dataset.paffHiddenCopilot === '1') return
                el.style.setProperty('display', 'none', 'important')
                el.style.setProperty('width', '0', 'important')
                el.style.setProperty('height', '0', 'important')
                el.style.setProperty('overflow', 'hidden', 'important')
                el.style.setProperty('padding', '0', 'important')
                el.style.setProperty('margin', '0', 'important')
                el.style.setProperty('min-width', '0', 'important')
                el.style.setProperty('flex', '0 0 0px', 'important')
                el.dataset.paffHiddenCopilot = '1'

                // Walk up and collapse ancestor containers if all children are hidden
                this.collapseEmptyAncestors(el, target)
            })
        } catch {
            /* ignore */
        }
    }

    /**
     * Walk up from a hidden element, collapsing ancestor containers
     * whose visible children are all hidden by this extension.
     */
    private static collapseEmptyAncestors(el: HTMLElement, boundary: HTMLElement) {
        let parent = el.parentElement
        // Walk up at most 3 levels
        for (let i = 0; i < 3 && parent && parent !== boundary; i++) {
            // Check if all children of this parent are either hidden or zero-sized
            const children = Array.from(parent.children) as HTMLElement[]
            const allHidden = children.every((child) => {
                if (child.dataset.paffHiddenCopilot === '1') return true
                if (child.dataset.paffCollapsedCopilot === '1') return true
                const cs = window.getComputedStyle(child)
                if (cs.display === 'none') return true
                const r = child.getBoundingClientRect()
                return r.width === 0 && r.height === 0
            })

            if (allHidden) {
                parent.style.setProperty('display', 'none', 'important')
                parent.style.setProperty('width', '0', 'important')
                parent.style.setProperty('min-width', '0', 'important')
                parent.style.setProperty('padding', '0', 'important')
                parent.style.setProperty('margin', '0', 'important')
                parent.style.setProperty('flex', '0 0 0px', 'important')
                parent.dataset.paffCollapsedCopilot = '1'
                parent = parent.parentElement
            } else {
                // Parent has visible children; remove any gap/padding if it's a flex container
                const cs = window.getComputedStyle(parent)
                if (cs.display === 'flex' || cs.display === 'inline-flex') {
                    parent.style.setProperty('gap', '0', 'important')
                }
                break
            }
        }
    }

    /**
     * Restore Copilot-related elements that were hidden during detach.
     */
    private static restoreCopilotElements(target: HTMLElement) {
        try {
            // Restore collapsed ancestors first
            const collapsed = target.querySelectorAll<HTMLElement>('[data-paff-collapsed-copilot="1"]')
            collapsed.forEach((el) => {
                el.style.removeProperty('display')
                el.style.removeProperty('width')
                el.style.removeProperty('min-width')
                el.style.removeProperty('padding')
                el.style.removeProperty('margin')
                el.style.removeProperty('flex')
                el.style.removeProperty('gap')
                delete el.dataset.paffCollapsedCopilot
            })

            // Then restore hidden elements
            const hidden = target.querySelectorAll<HTMLElement>('[data-paff-hidden-copilot="1"]')
            hidden.forEach((el) => {
                el.style.removeProperty('display')
                el.style.removeProperty('width')
                el.style.removeProperty('height')
                el.style.removeProperty('overflow')
                el.style.removeProperty('padding')
                el.style.removeProperty('margin')
                el.style.removeProperty('min-width')
                el.style.removeProperty('flex')
                delete el.dataset.paffHiddenCopilot
            })
        } catch {
            /* ignore */
        }
    }
}

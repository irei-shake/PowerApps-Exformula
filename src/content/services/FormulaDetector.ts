/**
 * Methods to discover and validate the Power Apps formula bar in the DOM.
 */
export class FormulaDetector {
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
}

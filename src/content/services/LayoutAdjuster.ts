/**
 * Handles internal layout adjustments for the Power Apps formula bar
 * when it is detached, including auto-height constraints, Monaco editor
 * margin fixes, and hiding unnecessary Copilot elements to save space.
 */
export class LayoutAdjuster {
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
            const footerEl = floaterEl.querySelector('.paff-floater-footer') as HTMLElement | null
            const panelH = floaterEl.getBoundingClientRect().height
            const headerH = headerEl?.getBoundingClientRect().height ?? 0
            const tabsH = tabsEl?.getBoundingClientRect().height ?? 0
            const pinsH = pinsEl?.getBoundingClientRect().height ?? 0
            const footerH = footerEl?.getBoundingClientRect().height ?? 0
            const available = Math.max(
                0,
                Math.round(panelH - headerH - pinsH - tabsH - footerH),
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
            section.style.overflow = 'visible'
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

        return cleanup
    }

    // -------------------------------------------------------------------
    // Monaco margin fix
    // -------------------------------------------------------------------

    static applyMarginFix(target: HTMLElement) {
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

    static removeMarginFix(target: HTMLElement) {
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

    // -------------------------------------------------------------------
    // Copilot elements hiding
    // -------------------------------------------------------------------

    /**
     * Hide Copilot-related elements inside the detached formula bar.
     */
    static hideCopilotElements(target: HTMLElement) {
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

    private static collapseEmptyAncestors(el: HTMLElement, boundary: HTMLElement) {
        let parent = el.parentElement
        // Walk up at most 3 levels
        for (let i = 0; i < 3 && parent && parent !== boundary; i++) {
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
    static restoreCopilotElements(target: HTMLElement) {
        try {
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

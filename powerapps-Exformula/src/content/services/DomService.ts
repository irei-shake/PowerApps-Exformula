export class DomService {
    private static placeholderMap = new Map<HTMLElement, HTMLElement>()
    private static observerMap = new Map<HTMLElement, MutationObserver>()

    static isDetachable(el: HTMLElement): boolean {
        if (!el || el === document.documentElement || el === document.body) return false
        if (el.classList && (el.classList.contains('paff-floater') || el.closest('.paff-floater'))) return false
        const role = el.getAttribute('role')
        if (role === 'banner' || role === 'navigation') return false
        return true
    }

    static findCandidate(target: HTMLElement): HTMLElement {
        let el: HTMLElement | null = target
        const maxDepth = 12
        for (let i = 0; i < maxDepth && el; i++) {
            if (!this.isDetachable(el)) {
                el = el.parentElement
                continue
            }
            // Heuristics
            const cl = el.className ? el.className.toString() : ''
            if (
                cl.includes('monaco-editor') ||
                cl.includes('monaco') ||
                cl.includes('formula') ||
                cl.includes('text-area') ||
                cl.includes('editor') ||
                el.tagName === 'TEXTAREA' ||
                el.tagName === 'INPUT' ||
                (el.getAttribute && (el.getAttribute('contenteditable') === 'true' || el.getAttribute('role') === 'textbox')) ||
                el.getBoundingClientRect().height > 40
            ) {
                return el
            }
            el = el.parentElement
        }
        return target
    }

    static findFormulaBar(): HTMLElement | null {
        const id = document.getElementById('formulabar')
        if (id) return id
        const q = document.querySelector('#formulabar')
        if (q) return q as HTMLElement

        // Fallback: look for monaco editor near property combo box
        const monaco = document.querySelector('.monaco-editor, [class*="monaco"]')
        const combo = document.querySelector('#powerapps-property-combo-box') || document.getElementById('powerapps-property-combo-box')

        if (monaco && combo) {
            // Try to find a container that wraps both or is the formula bar area
            return this.findCandidate(monaco as HTMLElement)
        }
        return null
    }

    static detach(target: HTMLElement): HTMLElement {
        if (this.placeholderMap.has(target)) return target // Already detached

        const placeholder = document.createElement('div')
        placeholder.style.display = target.style.display || 'block'
        placeholder.style.width = target.style.width || target.getBoundingClientRect().width + 'px'
        placeholder.style.height = '0px' // Collapse height
        placeholder.dataset.paffPlaceholder = '1'

        if (target.parentElement) {
            target.parentElement.insertBefore(placeholder, target)
        }

        this.placeholderMap.set(target, placeholder)

        // Reset styles for floating
        target.style.width = '100%'
        target.style.maxWidth = 'none'
        target.style.boxSizing = 'border-box'
        target.style.height = '100%' // Ensure it fills the container

        // Apply margin fix for Monaco editor
        this.applyMarginFix(target)

        // Observe for changes that might break the layout
        const observer = new MutationObserver(() => {
            this.applyMarginFix(target)
        })
        observer.observe(target, { subtree: true, childList: true, attributes: true })
        this.observerMap.set(target, observer)

        return target
    }

    static restore(target: HTMLElement) {
        const placeholder = this.placeholderMap.get(target)

        // Cleanup observer
        const observer = this.observerMap.get(target)
        if (observer) {
            observer.disconnect()
            this.observerMap.delete(target)
        }

        if (placeholder && placeholder.parentElement) {
            placeholder.parentElement.insertBefore(target, placeholder)
            placeholder.remove()
            this.placeholderMap.delete(target)

            // Restore styles (approximate)
            target.style.width = ''
            target.style.maxWidth = ''
            target.style.height = ''
            target.style.boxSizing = ''

            // Remove margin fix styles
            this.removeMarginFix(target)
        }
    }

    private static applyMarginFix(target: HTMLElement) {
        try {
            // Hide Monaco margin to save space
            const margins = target.querySelectorAll('.margin')
            margins.forEach(m => {
                (m as HTMLElement).style.setProperty('display', 'none', 'important')
            })
            // Hide glyph margin
            const glyphs = target.querySelectorAll('.glyph-margin')
            glyphs.forEach(g => {
                (g as HTMLElement).style.setProperty('display', 'none', 'important')
            })
        } catch { }
    }

    private static removeMarginFix(target: HTMLElement) {
        try {
            const margins = target.querySelectorAll('.margin')
            margins.forEach(m => {
                (m as HTMLElement).style.removeProperty('display')
            })
            const glyphs = target.querySelectorAll('.glyph-margin')
            glyphs.forEach(g => {
                (g as HTMLElement).style.removeProperty('display')
            })
        } catch { }
    }
}

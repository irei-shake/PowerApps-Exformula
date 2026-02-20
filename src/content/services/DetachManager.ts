import { LayoutAdjuster } from './LayoutAdjuster'
import { FormulaDetector } from './FormulaDetector'

/**
 * Handles the logic for detaching the formula bar from the main DOM
 * into a floating state, and restoring it back to its original location.
 */
export class DetachManager {
    private static placeholderMap = new Map<HTMLElement, HTMLElement>()
    private static observerMap = new Map<HTMLElement, MutationObserver>()

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
        if (FormulaDetector.isFormulaPanel(target)) {
            document.documentElement.classList.add('paff-detached-formula')
        }

        // Apply margin fix for Monaco editor
        LayoutAdjuster.applyMarginFix(target)
        // Hide Copilot button inside detached formula bar
        LayoutAdjuster.hideCopilotElements(target)

        const observer = new MutationObserver(() => {
            LayoutAdjuster.applyMarginFix(target)
            LayoutAdjuster.hideCopilotElements(target)
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

            LayoutAdjuster.removeMarginFix(target)
            LayoutAdjuster.restoreCopilotElements(target)
        }

        // Remove formula class if no more formula floaters
        if (!document.querySelector('.paff-floater[data-paff-formula="1"]')) {
            document.documentElement.classList.remove('paff-detached-formula')
        }
    }
}

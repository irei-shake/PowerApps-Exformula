import React, { useEffect, useRef, useCallback } from 'react'
import { FloaterContainer } from './components/FloaterContainer'
import { PinBar } from './components/PinBar'
import { PropertyTabs } from './components/PropertyTabs'
import { SnippetBar, type SnippetBarRef } from './components/SnippetBar'
import { BusyOverlay } from './components/BusyOverlay'
import { FormulaDetector } from './services/FormulaDetector'
import { DetachManager } from './services/DetachManager'
import { LayoutAdjuster } from './services/LayoutAdjuster'
import { PowerAppsService } from './services/PowerAppsService'
import { MessageService } from './services/MessageService'
import { useFloaterState } from './hooks/useFloaterState'
import { usePins } from './hooks/usePins'
import { useSnippets } from './hooks/useSnippets'
import { useControlName } from './hooks/useControlName'
import type { Pin } from './types'

export const App: React.FC = () => {
    const {
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
    } = useFloaterState()

    const { pins, addPin, removePin, updatePinControlName } = usePins()
    const { snippets, addSnippet, updateSnippet, removeSnippet } = useSnippets()
    const controlName = useControlName()
    const contentRef = useRef<HTMLDivElement>(null)
    const detachedRef = useRef<HTMLElement | null>(null)
    const floaterRef = useRef<HTMLDivElement>(null)
    const snippetBarRef = useRef<SnippetBarRef>(null)
    const sectionCleanupRef = useRef<(() => void) | null>(null)
    const originalParentRef = useRef<HTMLElement | null>(null)

    // ---------------------------------------------------------------
    // Detach / Restore logic
    // ---------------------------------------------------------------
    const doDetach = useCallback(() => {
        if (visible) {
            // Already visible: restore
            setVisible(false)
            return
        }
        const el = FormulaDetector.findFormulaBar()
        if (el) {
            originalParentRef.current = el.parentElement
            DetachManager.detach(el)
            detachedRef.current = el
            show()
        }
    }, [visible, show, setVisible])

    // Move detached element into/out of the floater body
    useEffect(() => {
        if (!visible) {
            // Restoring: move the element back, cleanup
            if (detachedRef.current) {
                if (sectionCleanupRef.current) {
                    sectionCleanupRef.current()
                    sectionCleanupRef.current = null
                }
                DetachManager.restore(detachedRef.current)
                detachedRef.current = null
                originalParentRef.current = null
            }
            return
        }

        // Visible: move the detached element into the floater body.
        // Use requestAnimationFrame to ensure the DOM refs are ready
        // (Rnd may defer its internal DOM setup).
        const moveElement = () => {
            const target = detachedRef.current
            const container = contentRef.current
            if (!target || !container) return

            // Avoid moving twice
            if (container.contains(target)) return

            container.appendChild(target)

            // Setup section auto-height after element is in the DOM
            requestAnimationFrame(() => {
                const floaterEl =
                    floaterRef.current?.querySelector('.paff-floater') as HTMLElement ??
                    floaterRef.current
                if (floaterEl && target) {
                    sectionCleanupRef.current = LayoutAdjuster.setupSectionAutoHeight(
                        target,
                        floaterEl,
                    )
                }
            })
        }

        // Try immediately, then retry on next frame to account for Rnd
        if (contentRef.current && detachedRef.current) {
            moveElement()
        } else {
            requestAnimationFrame(moveElement)
        }
    }, [visible])

    // ---------------------------------------------------------------
    // Keyboard shortcut (in-page)
    // ---------------------------------------------------------------
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Snippet insertion (Shift + Alt + 1~0)
            if (e.altKey && e.shiftKey) {
                const isDigit = e.code.startsWith('Digit')
                if (isDigit) {
                    const digit = parseInt(e.code.replace('Digit', ''), 10)
                    const index = digit === 0 ? 9 : digit - 1
                    e.preventDefault()

                    const snippet = snippets[index]
                    if (snippet) {
                        PowerAppsService.insertText(snippet.value)
                    } else {
                        snippetBarRef.current?.openNewSnippetFromSelection(index)
                    }
                    return
                }

                // Snap logic in FloaterContainer ...
                if (e.code === 'KeyF' || e.code === 'KeyB') {
                    e.preventDefault()
                    doDetach()
                    return
                }

                // Minimize/Expand toggle (Shift + Alt + M)
                if (e.code === 'KeyM') {
                    e.preventDefault()
                    toggleMinimize()
                    return
                }
            }
            // Ignore other keys like Tab to prevent focus trapping or unexpected behavior
        }
        window.addEventListener('keydown', handleKeyDown, true)
        return () => window.removeEventListener('keydown', handleKeyDown, true)
    }, [doDetach, snippets, toggleMinimize])

    // ---------------------------------------------------------------
    // Background message (toolbar click / chrome.commands)
    // ---------------------------------------------------------------
    useEffect(() => {
        return MessageService.onMessage((type) => {
            if (type === 'PAFF_TOGGLE' || type === 'PAFF_DETACH_FORMULA') {
                doDetach()
            }
        })
    }, [doDetach])

    // ---------------------------------------------------------------
    // Pin select handler (with busy overlay)
    // ---------------------------------------------------------------
    const handlePinSelect = useCallback(
        async (pin: Pin) => {
            if (busy) return
            startBusy(`Switching to ${pin.control}.${pin.prop}...`)
            try {
                const result = await PowerAppsService.selectControl(
                    pin.control,
                    pin.controlId,
                )
                // Control was renamed: auto-update pin
                if (result.resolvedName && result.resolvedName !== pin.control) {
                    updatePinControlName(pin, result.resolvedName)
                }
                // Wait for the sidebar to fully reflect the new control before selecting
                // the property. Without this, selectProperty() may operate on a stale or
                // mid-rebuild combobox when Monaco had focus and triggered a formula commit.
                await PowerAppsService.waitForSidebarReflectsControl(result.resolvedName ?? pin.control)
                await PowerAppsService.selectProperty(pin.prop)
                requestAnimationFrame(() => {
                    const editor = document.querySelector('.paff-floater-body-host .monaco-editor textarea, .paff-floater-body-host [role="textbox"]') as HTMLElement | null
                    if (editor) editor.focus()
                })
            } finally {
                stopBusy()
            }
        },
        [busy, startBusy, stopBusy, updatePinControlName],
    )

    // ---------------------------------------------------------------
    // Property select / pin handlers
    // ---------------------------------------------------------------
    const handlePropertySelect = useCallback(async (prop: string) => {
        await PowerAppsService.selectProperty(prop)
        // Focus the Monaco editor after property selection
        requestAnimationFrame(() => {
            const editor = document.querySelector('.paff-floater-body-host .monaco-editor textarea, .paff-floater-body-host [role="textbox"]') as HTMLElement | null
            if (editor) {
                editor.focus()
            }
        })
    }, [])

    const handlePropertyPin = useCallback(
        (prop: string) => {
            const control = controlName || PowerAppsService.readCurrentControlName() || 'Control'
            const controlId = PowerAppsService.getControlIdForName(control)
            addPin(control, prop, controlId)
        },
        [controlName, addPin],
    )

    const handleClose = useCallback(() => {
        hide()
    }, [hide])

    // ---------------------------------------------------------------
    // Render
    // ---------------------------------------------------------------
    if (!visible) return null

    const isFormula = detachedRef.current
        ? FormulaDetector.isFormulaPanel(detachedRef.current)
        : false

    const title = controlName || 'Formula Bar'

    const toolbarSlot = (
        <>
            <PinBar
                pins={pins}
                onSelect={handlePinSelect}
                onRemove={removePin}
                busy={busy}
            />
            <PropertyTabs
                onSelect={handlePropertySelect}
                onPin={handlePropertyPin}
            />
        </>
    )

    return (
        <div ref={floaterRef}>
            <FloaterContainer
                title={title}
                minimized={minimized}
                onMinimize={toggleMinimize}
                onClose={handleClose}
                isFormula={isFormula}
                toolbar={toolbarSlot}
                overlay={busy ? <BusyOverlay text={busyText} /> : undefined}
                footer={
                    <SnippetBar
                        ref={snippetBarRef}
                        snippets={snippets}
                        onInsert={(value) => PowerAppsService.insertText(value)}
                        onAdd={addSnippet}
                        onUpdate={updateSnippet}
                        onDelete={removeSnippet}
                    />
                }
            >
                <div
                    ref={contentRef}
                    className="paff-content-area"
                />
            </FloaterContainer>
        </div>
    )
}

export default App

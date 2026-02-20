import React, { useState, useEffect, useRef } from 'react'
import { FloaterContainer } from './components/FloaterContainer'
import { DomService } from './services/DomService'
import { PowerAppsService } from './services/PowerAppsService'
import { StorageService, type Pin } from './services/StorageService'
import { PropertyTabs } from './components/PropertyTabs'
import { PinBar } from './components/PinBar'

const App: React.FC = () => {
    const [visible, setVisible] = useState(false)
    const [minimized, setMinimized] = useState(false)
    const [detachedElement, setDetachedElement] = useState<HTMLElement | null>(null)
    const [pins, setPins] = useState<Pin[]>([])
    const [appId, setAppId] = useState<string>('')
    const contentRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        const id = StorageService.getAppId()
        setAppId(id)
        StorageService.getPins(id).then(setPins)
    }, [])

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Alt+Shift+F to toggle
            if (e.altKey && e.shiftKey && e.code === 'KeyF') {
                if (visible) {
                    setVisible(false)
                } else {
                    const el = DomService.findFormulaBar()
                    if (el) {
                        DomService.detach(el)
                        setDetachedElement(el)
                        setVisible(true)
                    }
                }
            }
        }
        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [visible])

    useEffect(() => {
        if (visible && detachedElement && contentRef.current) {
            contentRef.current.appendChild(detachedElement)
        } else if (!visible && detachedElement) {
            DomService.restore(detachedElement)
            setDetachedElement(null)
        }
    }, [visible, detachedElement])

    const handlePin = (prop: string) => {
        // TODO: Read actual control name
        const control = 'Control'
        const newPin = { control, prop }
        if (!pins.some(p => p.control === control && p.prop === prop)) {
            const newPins = [...pins, newPin]
            setPins(newPins)
            StorageService.savePins(appId, newPins)
        }
    }

    const handleUnpin = (pin: Pin) => {
        const newPins = pins.filter(p => p !== pin)
        setPins(newPins)
        StorageService.savePins(appId, newPins)
    }

    const handleSelect = (prop: string) => {
        PowerAppsService.selectProperty(prop)
    }

    if (!visible) return null

    return (
        <FloaterContainer
            title="Detached Formula Bar"
            minimized={minimized}
            onMinimize={() => setMinimized(!minimized)}
            onClose={() => setVisible(false)}
        >
            <PinBar
                pins={pins}
                onSelect={(pin) => handleSelect(pin.prop)}
                onRemove={handleUnpin}
            />
            <PropertyTabs
                onSelect={handleSelect}
                onPin={handlePin}
            />
            <div ref={contentRef} style={{ width: '100%', height: '100%' }} />
        </FloaterContainer>
    )
}

export default App

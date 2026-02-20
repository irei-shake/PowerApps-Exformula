import React from 'react'
import { Rnd } from 'react-rnd'
import { FloaterHeader } from './FloaterHeader'

interface FloaterContainerProps {
    children: React.ReactNode
    onClose: () => void
    onMinimize: () => void
    minimized: boolean
    title: string
}

export const FloaterContainer: React.FC<FloaterContainerProps> = ({
    children,
    onClose,
    onMinimize,
    minimized,
    title,
}) => {
    return (
        <Rnd
            default={{
                x: 100,
                y: 100,
                width: 400,
                height: 300,
            }}
            minWidth={300}
            minHeight={100}
            bounds="window"
            dragHandleClassName="paff-drag-handle"
            enableResizing={!minimized}
            disableDragging={false}
            style={{
                zIndex: 2147483647,
                position: 'fixed',
                display: 'flex',
                flexDirection: 'column',
                backgroundColor: '#121212ee',
                border: '1px solid #333',
                borderRadius: '8px',
                boxShadow: '0 8px 28px rgba(0,0,0,0.45)',
                pointerEvents: 'auto', // Enable interaction
            }}
        >
            <FloaterHeader
                title={title}
                minimized={minimized}
                onMinimize={onMinimize}
                onClose={onClose}
            />
            <div style={{ flex: 1, overflow: 'auto', display: minimized ? 'none' : 'block' }}>
                {children}
            </div>
        </Rnd>
    )
}

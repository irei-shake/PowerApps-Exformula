import React from 'react'

interface FloaterHeaderProps {
    title: string
    minimized: boolean
    onMinimize: () => void
    onClose: () => void
}

export const FloaterHeader: React.FC<FloaterHeaderProps> = ({
    title,
    minimized,
    onMinimize,
    onClose,
}) => {
    return (
        <div
            className="paff-drag-handle"
            style={{
                padding: '8px 10px',
                background: 'linear-gradient(0deg, #1e1e1e, #252525)',
                cursor: 'move',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                color: '#ddd',
                borderTopLeftRadius: '8px',
                borderTopRightRadius: '8px',
                userSelect: 'none',
            }}
        >
            <span style={{ fontSize: '12px', opacity: 0.8 }}>{title}</span>
            <div style={{ display: 'flex', gap: '6px' }}>
                <button
                    onClick={onMinimize}
                    style={{
                        font: 'inherit',
                        fontSize: '12px',
                        border: '1px solid #3a3a3a',
                        background: '#2a2a2a',
                        color: '#ddd',
                        padding: '3px 8px',
                        borderRadius: '6px',
                        cursor: 'pointer',
                    }}
                >
                    {minimized ? 'Expand' : 'Minimize'}
                </button>
                <button
                    onClick={onClose}
                    style={{
                        font: 'inherit',
                        fontSize: '12px',
                        border: '1px solid #3a3a3a',
                        background: '#2a2a2a',
                        color: '#ddd',
                        padding: '3px 8px',
                        borderRadius: '6px',
                        cursor: 'pointer',
                    }}
                >
                    Close
                </button>
            </div>
        </div>
    )
}

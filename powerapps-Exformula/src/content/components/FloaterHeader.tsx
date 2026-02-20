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
        <div className="paff-floater-header paff-drag-handle">
            <span className="paff-floater-title">{title}</span>
            <div className="paff-floater-actions">
                <button className="paff-button" onClick={onMinimize}>
                    {minimized ? 'Expand' : 'Minimize'}
                </button>
                <button className="paff-button" onClick={onClose}>
                    Close
                </button>
            </div>
        </div>
    )
}

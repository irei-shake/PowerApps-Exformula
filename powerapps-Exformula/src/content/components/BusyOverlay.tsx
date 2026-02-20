import React from 'react'

interface BusyOverlayProps {
    text: string
}

/**
 * Full-panel overlay shown while switching controls/properties.
 */
export const BusyOverlay: React.FC<BusyOverlayProps> = ({ text }) => {
    return (
        <div className="paff-loading">
            <div className="paff-loading-box">{text}</div>
        </div>
    )
}

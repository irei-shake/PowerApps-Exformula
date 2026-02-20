import React from 'react'
import type { Pin } from '../services/StorageService'

interface PinBarProps {
    pins: Pin[]
    onSelect: (pin: Pin) => void
    onRemove: (pin: Pin) => void
}

export const PinBar: React.FC<PinBarProps> = ({ pins, onSelect, onRemove }) => {
    if (pins.length === 0) return null

    return (
        <div style={{ display: 'flex', gap: '6px', padding: '6px 10px', background: '#161616', borderBottom: '1px solid #2a2a2a', overflowX: 'auto', scrollbarWidth: 'none' }}>
            {pins.map((pin, idx) => (
                <div
                    key={`${pin.control}-${pin.prop}-${idx}`}
                    style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '4px 8px',
                        borderRadius: '999px',
                        background: '#2a2d34',
                        color: '#e8eef6',
                        border: '1px solid #3a3f49',
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                        fontSize: '12px',
                    }}
                    onClick={() => onSelect(pin)}
                >
                    <span>{pin.control}.{pin.prop}</span>
                    <button
                        onClick={(e) => {
                            e.stopPropagation()
                            onRemove(pin)
                        }}
                        style={{
                            all: 'unset',
                            cursor: 'pointer',
                            width: '16px',
                            height: '16px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderRadius: '8px',
                            background: '#3a3f49',
                            color: '#e8eef6',
                        }}
                    >
                        ×
                    </button>
                </div>
            ))}
        </div>
    )
}

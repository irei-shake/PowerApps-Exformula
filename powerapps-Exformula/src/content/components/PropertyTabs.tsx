import React, { useState, useEffect } from 'react'
import { PowerAppsService } from '../services/PowerAppsService'

interface PropertyTabsProps {
    onSelect: (prop: string) => void
    onPin: (prop: string) => void
}

export const PropertyTabs: React.FC<PropertyTabsProps> = ({ onSelect, onPin }) => {
    const [properties, setProperties] = useState<string[]>([])
    const [filter, setFilter] = useState('')



    useEffect(() => {
        // Use subscription for real-time updates
        const unsubscribe = PowerAppsService.subscribeProperties((props) => {
            setProperties(props)
        })
        return () => unsubscribe()
    }, [])

    const filtered = properties.filter(p => p.toLowerCase().includes(filter.toLowerCase()))

    return (
        <div style={{ display: 'flex', flexDirection: 'column', background: '#191919', borderBottom: '1px solid #333' }}>
            <div style={{ padding: '6px 10px', display: 'flex', gap: '6px' }}>
                <input
                    type="text"
                    placeholder="Filter properties..."
                    value={filter}
                    onChange={e => setFilter(e.target.value)}
                    style={{
                        fontSize: '12px',
                        padding: '5px 8px',
                        borderRadius: '6px',
                        border: '1px solid #3a3a3a',
                        background: '#141414',
                        color: '#e6e6e6',
                        width: '180px',
                        outline: 'none',
                    }}
                />
                <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', scrollbarWidth: 'none', alignItems: 'center' }}>
                    {filtered.map(p => (
                        <button
                            key={p}
                            onClick={(e) => {
                                if (e.altKey || e.ctrlKey) {
                                    onPin(p)
                                } else {
                                    onSelect(p)
                                }
                            }}
                            onDoubleClick={() => onPin(p)}
                            style={{
                                fontSize: '12px',
                                padding: '4px 8px',
                                borderRadius: '6px',
                                border: '1px solid #2f2f2f',
                                background: '#232323',
                                color: '#dcdcdc',
                                cursor: 'pointer',
                                whiteSpace: 'nowrap',
                            }}
                        >
                            {p}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    )
}

import { useState, forwardRef, useImperativeHandle } from 'react'
import type { Snippet } from '../types'
import { SnippetEditor } from './SnippetEditor'
import { PowerAppsService } from '../services/PowerAppsService'

export interface SnippetBarRef {
    openNewSnippetFromSelection: (index: number) => void
}

interface SnippetBarProps {
    snippets: (Snippet | null)[]
    onInsert: (value: string) => void
    onAdd: (index: number, snippet: Snippet) => void
    onUpdate: (index: number, snippet: Snippet) => void
    onDelete: (index: number) => void
}

export const SnippetBar = forwardRef<SnippetBarRef, SnippetBarProps>(({
    snippets,
    onInsert,
    onAdd,
    onUpdate,
    onDelete
}, ref) => {
    // -1 means nothing is selected.
    const [selectedIndex, setSelectedIndex] = useState<number>(0)
    const [isEditing, setIsEditing] = useState(false)
    const [prefilledValue, setPrefilledValue] = useState<string>('')

    useImperativeHandle(ref, () => ({
        openNewSnippetFromSelection: (index: number) => {
            const selectedText = PowerAppsService.getSelectedText() || ''
            setSelectedIndex(index)
            setPrefilledValue(selectedText)
            setIsEditing(true)
        }
    }))

    const handleSlotClick = (index: number) => {
        setSelectedIndex(index)
        const snippet = snippets[index]
        if (snippet) {
            onInsert(snippet.value)
        }
    }

    const handleSave = (name: string, value: string) => {
        const existing = snippets[selectedIndex]
        if (existing) {
            onUpdate(selectedIndex, { ...existing, name, value })
        } else {
            onAdd(selectedIndex, { id: crypto.randomUUID(), name, value })
        }
        setIsEditing(false)
        setPrefilledValue('')
    }

    const handleDelete = () => {
        onDelete(selectedIndex)
    }

    const handleEditOrAdd = () => {
        if (!snippets[selectedIndex]) {
            setPrefilledValue('')
        }
        setIsEditing(true)
    }

    const activeSnippet = snippets[selectedIndex]

    return (
        <div className="paff-snippet-bar" style={{
            display: 'flex',
            alignItems: 'center',
            padding: '6px 8px',
            borderTop: '1px solid #e0e0e0',
            background: '#ffffff', // Light UI theme
            gap: '8px',
            overflowX: 'auto',
            color: '#333333'
        }}>
            {/* Slot Buttons */}
            <div
                style={{ display: 'flex', gap: '4px', overflowX: 'auto', scrollbarWidth: 'none' }}
                onWheel={(e) => {
                    e.currentTarget.scrollLeft += e.deltaY
                    e.preventDefault()
                }}
            >
                {snippets.map((snippet, i) => {
                    const isSelected = selectedIndex === i
                    return (
                        <button
                            key={`snippet-${i}`}
                            onClick={() => handleSlotClick(i)}
                            title={snippet ? `${snippet.name} (Shift+Alt+${i === 9 ? 0 : i + 1})` : `Empty Slot (Shift+Alt+${i === 9 ? 0 : i + 1})`}
                            style={{
                                padding: '4px 8px',
                                background: isSelected ? '#0078d4' : (snippet ? '#f3f2f1' : 'transparent'),
                                border: isSelected ? '1px solid #0078d4' : (snippet ? '1px solid #d1d1d1' : '1px dashed #d1d1d1'),
                                color: isSelected ? '#ffffff' : (snippet ? '#333333' : '#888888'),
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontSize: '12px',
                                minWidth: '32px',
                                maxWidth: '120px',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                textAlign: 'center',
                                transition: 'all 0.1s'
                            }}
                        >
                            {snippet ? snippet.name : (i === 9 ? '0' : String(i + 1))}
                        </button>
                    )
                })}
            </div>

            <div style={{ flex: 1 }} />

            {/* Action Buttons for selected slot */}
            {activeSnippet ? (
                <>
                    <button
                        onClick={handleEditOrAdd}
                        style={{
                            padding: '4px 8px',
                            background: '#ffffff',
                            border: '1px solid #c8c8c8',
                            color: '#333333',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '12px'
                        }}
                    >
                        Edit
                    </button>
                    <button
                        onClick={handleDelete}
                        style={{
                            padding: '4px 8px',
                            background: '#ffffff',
                            border: '1px solid #d13438',
                            color: '#d13438',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '12px'
                        }}
                    >
                        Delete
                    </button>
                </>
            ) : (
                <button
                    onClick={handleEditOrAdd}
                    style={{
                        padding: '4px 10px',
                        background: '#0078d4',
                        border: '1px solid #0078d4',
                        color: '#ffffff',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '12px'
                    }}
                >
                    Add
                </button>
            )}

            {/* Editor Modal */}
            {isEditing && (
                <SnippetEditor
                    snippet={activeSnippet || { id: '', name: '', value: prefilledValue }}
                    onSave={handleSave}
                    onCancel={() => { setIsEditing(false); setPrefilledValue('') }}
                />
            )}
        </div>
    )
})

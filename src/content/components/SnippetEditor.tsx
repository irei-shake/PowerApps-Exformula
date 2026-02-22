import React, { useState, useEffect, useRef } from 'react'
import type { Snippet } from '../types'

interface SnippetEditorProps {
    snippet: Snippet | null
    onSave: (name: string, value: string) => void
    onCancel: () => void
}

export const SnippetEditor: React.FC<SnippetEditorProps> = ({ snippet, onSave, onCancel }) => {
    const [name, setName] = useState(snippet ? snippet.name : '')
    const [value, setValue] = useState(snippet ? snippet.value : '')
    const nameRef = useRef<HTMLInputElement>(null)

    useEffect(() => {
        // Auto-focus on name field when opening
        nameRef.current?.focus()
    }, [])

    const handleSave = () => {
        if (!name.trim() || !value.trim()) return
        onSave(name.trim(), value.trim())
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        // Stop propagation so it doesn't trigger global shortcuts
        e.stopPropagation()
        if (e.key === 'Escape') {
            onCancel()
        }
    }

    return (
        <div
            className="paff-snippet-editor-modal"
            onKeyDown={handleKeyDown}
            onClick={onCancel}
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                backgroundColor: 'transparent', // No Backdrop
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 1000 // Ensure it covers the floater container content
            }}
        >
            <div
                className="paff-snippet-editor"
                onClick={e => e.stopPropagation()} // Prevent clicking modal from closing it
                style={{
                    backgroundColor: '#ffffff', // Light UI theme
                    border: '1px solid #d1d1d1',
                    borderRadius: '8px',
                    padding: '16px',
                    width: '300px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.2)'
                }}
            >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ margin: 0, fontSize: '14px', color: '#333333' }}>
                        {snippet && snippet.id ? 'Edit Snippet' : 'New Snippet'}
                    </h3>
                    <button onClick={onCancel} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#666666' }}>
                        ✕
                    </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '12px', color: '#666666' }}>Name</label>
                    <input
                        ref={nameRef}
                        type="text"
                        value={name}
                        onChange={e => setName(e.target.value)}
                        placeholder="e.g. Set Var"
                        style={{
                            padding: '6px',
                            background: '#ffffff',
                            border: '1px solid #c8c8c8',
                            color: '#333333',
                            borderRadius: '4px'
                        }}
                    />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '12px', color: '#666666' }}>Formula</label>
                    <textarea
                        value={value}
                        onChange={e => setValue(e.target.value)}
                        placeholder="Set(myVar, true)"
                        rows={5}
                        style={{
                            padding: '6px',
                            background: '#ffffff',
                            border: '1px solid #c8c8c8',
                            color: '#333333',
                            borderRadius: '4px',
                            resize: 'vertical',
                            fontFamily: 'Consolas, monospace'
                        }}
                    />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '8px' }}>
                    <button
                        onClick={onCancel}
                        style={{
                            color: '#333333',
                            background: '#ffffff',
                            border: '1px solid #c8c8c8',
                            padding: '4px 12px',
                            borderRadius: '4px',
                            cursor: 'pointer'
                        }}
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={!name.trim() || !value.trim()}
                        style={{
                            color: '#ffffff',
                            background: '#0078d4',
                            border: 'none',
                            padding: '4px 12px',
                            borderRadius: '4px',
                            cursor: (!name.trim() || !value.trim()) ? 'not-allowed' : 'pointer',
                            opacity: (!name.trim() || !value.trim()) ? 0.5 : 1
                        }}
                    >
                        Save
                    </button>
                </div>
            </div>
        </div>
    )
}

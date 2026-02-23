import { useState, useEffect, useCallback } from 'react'
import type { Snippet } from '../types'
import { StorageService } from '../services/StorageService'

const MAX_SNIPPETS = 10

export const useSnippets = () => {
    const [snippets, setSnippets] = useState<(Snippet | null)[]>(Array(MAX_SNIPPETS).fill(null))

    // Initialize from storage
    useEffect(() => {
        const init = async () => {
            const appId = await StorageService.resolveAppId()
            const data = await StorageService.getSnippets(appId)
            if (data && Array.isArray(data)) {
                // Ensure exactly 10 slots
                const loaded = Array(MAX_SNIPPETS).fill(null)

                if (data.length === 0) {
                    // Initialize with default snippets if no data exists
                    loaded[0] = { name: '左右中央 (X)', formula: '(Parent.Width - Self.Width) / 2' }
                    loaded[1] = { name: '上下中央 (Y)', formula: '(Parent.Height - Self.Height) / 2' }
                } else {
                    data.forEach((s: Snippet | null, i: number) => {
                        if (i < MAX_SNIPPETS) loaded[i] = s
                    })
                }
                setSnippets(loaded)
            }
        }
        init()
    }, [])

    const saveToStorage = useCallback(async (newSnippets: (Snippet | null)[]) => {
        const appId = await StorageService.resolveAppId()
        await StorageService.saveSnippets(appId, newSnippets)
    }, [])

    const addSnippet = useCallback((index: number, snippet: Snippet) => {
        setSnippets(prev => {
            const next = [...prev]
            next[index] = snippet
            saveToStorage(next)
            return next
        })
    }, [saveToStorage])

    const updateSnippet = useCallback((index: number, snippet: Snippet) => {
        setSnippets(prev => {
            const next = [...prev]
            next[index] = snippet
            saveToStorage(next)
            return next
        })
    }, [saveToStorage])

    const removeSnippet = useCallback((index: number) => {
        setSnippets(prev => {
            const next = [...prev]
            next[index] = null
            saveToStorage(next)
            return next
        })
    }, [saveToStorage])

    return {
        snippets,
        addSnippet,
        updateSnippet,
        removeSnippet
    }
}

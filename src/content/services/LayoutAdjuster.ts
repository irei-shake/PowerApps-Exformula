/**
 * Handles internal layout adjustments for the Power Apps formula bar
 * when it is detached, including auto-height constraints, Monaco editor
 * margin fixes, and hiding unnecessary Copilot elements to save space.
 */
export class LayoutAdjuster {
    // -------------------------------------------------------------------
    // Section Auto-Height (ResizeObserver based)
    // -------------------------------------------------------------------

    /**
     * Automatically adjust the editor section height within the floater
     * so it fills all available vertical space.
     */
    static setupSectionAutoHeight(
        container: HTMLElement,
        floaterEl: HTMLElement,
    ): (() => void) | null {
        const fbRoot =
            container.id === 'formulabar'
                ? container
                : (container.querySelector('#formulabar') as HTMLElement) ?? container
        const editor = fbRoot.querySelector('#powerFxFormulaEditor')
        const section =
            (editor?.closest(
                'section, .Section, [data-role="Section"]',
            ) as HTMLElement) ??
            (fbRoot.querySelector(
                'section, .Section, [data-role="Section"]',
            ) as HTMLElement)

        if (!section) return null

        // Save original styles for restore
        const saved = {
            height: section.style.height,
            maxHeight: section.style.maxHeight,
            minHeight: section.style.minHeight,
            overflow: section.style.overflow,
            fbHeight: fbRoot.style.height,
        }

        try {
            fbRoot.style.setProperty('width', 'auto', 'important')
        } catch {
            /* ignore */
        }

        const apply = () => {
            const headerEl = floaterEl.querySelector(
                '.paff-floater-header',
            ) as HTMLElement | null
            const tabsEl = floaterEl.querySelector('.paff-tabs') as HTMLElement | null
            const pinsEl = floaterEl.querySelector('.paff-pins') as HTMLElement | null
            const footerEl = floaterEl.querySelector('.paff-floater-footer') as HTMLElement | null
            const panelH = floaterEl.getBoundingClientRect().height
            const headerH = headerEl?.getBoundingClientRect().height ?? 0
            const tabsH = tabsEl?.getBoundingClientRect().height ?? 0
            const pinsH = pinsEl?.getBoundingClientRect().height ?? 0
            const footerH = footerEl?.getBoundingClientRect().height ?? 0
            const available = Math.max(
                0,
                Math.round(panelH - headerH - pinsH - tabsH - footerH),
            )

            // Sum heights of non-editor children
            let nonEditorSum = 0
            Array.from(fbRoot.children).forEach((ch) => {
                if (!ch) return
                if (editor && (ch === editor || ch.contains(editor))) return
                const r = (ch as HTMLElement).getBoundingClientRect()
                const cs = getComputedStyle(ch as HTMLElement)
                nonEditorSum += Math.max(
                    0,
                    Math.round(
                        r.height +
                        parseFloat(cs.marginTop || '0') +
                        parseFloat(cs.marginBottom || '0'),
                    ),
                )
            })

            const targetHeight = Math.max(0, available - nonEditorSum - 5)
            section.style.height = `${targetHeight}px`
            section.style.width = '100%'
            section.style.maxWidth = 'none'
            section.style.boxSizing = 'border-box'
            section.style.maxHeight = 'none'
            section.style.minHeight = '0px'
            section.style.overflow = 'visible'
        }

        apply()

        const roPanel = new ResizeObserver(() => apply())
        try {
            roPanel.observe(floaterEl)
        } catch {
            /* ignore */
        }

        const roFb = new ResizeObserver(() => apply())
        try {
            roFb.observe(fbRoot)
        } catch {
            /* ignore */
        }

        const wrapper = fbRoot.querySelector('#ufb-resizer-wrapper') as HTMLElement | null
        let roWrapper: ResizeObserver | null = null
        if (wrapper) {
            roWrapper = new ResizeObserver(() => apply())
            try {
                roWrapper.observe(wrapper)
            } catch {
                /* ignore */
            }
        }

        const onWinResize = () => apply()
        window.addEventListener('resize', onWinResize, true)

        const cleanup = () => {
            try {
                roPanel.disconnect()
            } catch {
                /* ignore */
            }
            try {
                roFb.disconnect()
            } catch {
                /* ignore */
            }
            try {
                roWrapper?.disconnect()
            } catch {
                /* ignore */
            }
            window.removeEventListener('resize', onWinResize, true)
            section.style.height = saved.height
            section.style.maxHeight = saved.maxHeight
            section.style.minHeight = saved.minHeight
            section.style.overflow = saved.overflow
            fbRoot.style.height = saved.fbHeight
        }

        return cleanup
    }

    // -------------------------------------------------------------------
    // Monaco margin fix
    // -------------------------------------------------------------------

    static applyMarginFix(target: HTMLElement) {
        try {
            // ユーザー要望による指定：role="code"の要素を left: -60px でシフトする
            // サジェスト領域はこの要素の「外側」にあるため切り取られず、
            // コードエディタ本体の左余白だけが隠される。
            const codeEl = target.querySelector('[role="code"]') as HTMLElement | null
            if (!codeEl) return

            const marginWidth = 60
            const shiftStr = String(marginWidth)

            if (codeEl.dataset.paffMarginShift !== shiftStr) {
                // [role="code"] は left: -60px のみ設定し幅はMonacoに任せる
                codeEl.style.removeProperty('margin-left')
                codeEl.style.removeProperty('width')
                codeEl.style.setProperty('left', `-${marginWidth}px`, 'important')

                // 左にはみ出した60px部分が白く見えないように、背景を透明化
                codeEl.style.setProperty('background-color', 'transparent', 'important')
                codeEl.dataset.paffMarginShift = shiftStr

                // 背景色指定を持つ内部要素も透過
                const bg = codeEl.querySelector('.monaco-editor-background') as HTMLElement | null
                if (bg) {
                    bg.style.setProperty('background-color', 'transparent', 'important')
                    bg.dataset.paffMarginShiftInner = '1'
                }

                // 左60pxにある行番号・マージン要素（はみ出し部分）を非表示
                const marginEl = codeEl.querySelector('.margin') as HTMLElement | null
                if (marginEl) {
                    marginEl.style.setProperty('display', 'none', 'important')
                    marginEl.dataset.paffMarginShiftInner = '1'
                }

                // 文字列がスクロールされた時にはみ出さないように、テキスト領域だけをクリップ
                // ※ ここにはサジェスト(suggest-widget)は含まれないため見切れない
                const scrollable = codeEl.querySelector('.monaco-scrollable-element') as HTMLElement | null
                if (scrollable) {
                    scrollable.style.setProperty('clip-path', `inset(-5000px -5000px -5000px 0px)`, 'important')
                    scrollable.dataset.paffMarginShiftInner = '1'
                }

                // 親要素（#formulabar）を広げてMonacoにW+60pxの幅を認識させ、
                // 右端の空白を埋めるよう正しく再配置させる
                const parent = codeEl.parentElement
                if (parent && parent.dataset.paffMarginClip !== '1') {
                    parent.style.setProperty('width', `calc(100% + ${marginWidth}px)`, 'important')
                    // 親の親にスクロールバーを出さないためのマイナスマージン
                    parent.style.setProperty('margin-right', `-${marginWidth}px`, 'important')

                    // !! サジェストを見切れさせる原因だった親のclip-pathを削除 !!
                    parent.style.removeProperty('clip-path')
                    parent.dataset.paffMarginClip = '1'

                    // MonacoのResizeObserverを確実に発火させるためにリサイズイベントを発行
                    setTimeout(() => {
                        window.dispatchEvent(new Event('resize'))
                    }, 50)
                }
            }
        } catch {
            /* ignore */
        }
    }

    static removeMarginFix(target: HTMLElement) {
        try {
            const codeEls = target.querySelectorAll<HTMLElement>('[role="code"][data-paff-margin-shift]')
            codeEls.forEach((el) => {
                el.style.removeProperty('left')
                el.style.removeProperty('width')
                el.style.removeProperty('background-color')
                delete el.dataset.paffMarginShift

                const parent = el.parentElement
                if (parent && parent.dataset.paffMarginClip === '1') {
                    parent.style.removeProperty('width')
                    parent.style.removeProperty('margin-right')
                    parent.style.removeProperty('clip-path')
                    delete parent.dataset.paffMarginClip
                }
            })

            const innerEls = target.querySelectorAll<HTMLElement>('[data-paff-margin-shift-inner]')
            innerEls.forEach((el) => {
                el.style.removeProperty('width')
                el.style.removeProperty('background-color')
                el.style.removeProperty('display')
                el.style.removeProperty('clip-path')
                delete el.dataset.paffMarginShiftInner
            })

            // クリーンアップ用
            const oldShifted = target.querySelectorAll<HTMLElement>('[data-paff-margin-shift]')
            oldShifted.forEach((el) => {
                el.style.removeProperty('margin-left')
                el.style.removeProperty('left')
                el.style.removeProperty('width')
                delete el.dataset.paffMarginShift
            })
            const oldClips = target.querySelectorAll<HTMLElement>('[data-paff-margin-clip]')
            oldClips.forEach((el) => {
                el.style.removeProperty('clip-path')
                delete el.dataset.paffMarginClip
            })

            const styleEl = document.getElementById('paff-suggest-fix-style')
            if (styleEl) styleEl.remove()
        } catch {
            /* ignore */
        }
    }

    // -------------------------------------------------------------------
    // Copilot elements hiding
    // -------------------------------------------------------------------

    /**
     * Hide Copilot-related elements inside the detached formula bar.
     */
    static hideCopilotElements(target: HTMLElement) {
        try {
            const selectors = [
                '[class*="copilot" i]',
                '[id*="copilot" i]',
                '[aria-label*="Copilot"]',
                '[data-testid*="copilot" i]',
                '[data-automation-id*="copilot" i]',
            ]
            const query = selectors.join(', ')
            const elements = target.querySelectorAll<HTMLElement>(query)
            elements.forEach((el) => {
                if (el.dataset.paffHiddenCopilot === '1') return
                el.style.setProperty('display', 'none', 'important')
                el.style.setProperty('width', '0', 'important')
                el.style.setProperty('height', '0', 'important')
                el.style.setProperty('overflow', 'hidden', 'important')
                el.style.setProperty('padding', '0', 'important')
                el.style.setProperty('margin', '0', 'important')
                el.style.setProperty('min-width', '0', 'important')
                el.style.setProperty('flex', '0 0 0px', 'important')
                el.dataset.paffHiddenCopilot = '1'

                // Walk up and collapse ancestor containers if all children are hidden
                this.collapseEmptyAncestors(el, target)
            })
        } catch {
            /* ignore */
        }
    }

    private static collapseEmptyAncestors(el: HTMLElement, boundary: HTMLElement) {
        let parent = el.parentElement
        // Walk up at most 3 levels
        for (let i = 0; i < 3 && parent && parent !== boundary; i++) {
            const children = Array.from(parent.children) as HTMLElement[]
            const allHidden = children.every((child) => {
                if (child.dataset.paffHiddenCopilot === '1') return true
                if (child.dataset.paffCollapsedCopilot === '1') return true
                const cs = window.getComputedStyle(child)
                if (cs.display === 'none') return true
                const r = child.getBoundingClientRect()
                return r.width === 0 && r.height === 0
            })

            if (allHidden) {
                parent.style.setProperty('display', 'none', 'important')
                parent.style.setProperty('width', '0', 'important')
                parent.style.setProperty('min-width', '0', 'important')
                parent.style.setProperty('padding', '0', 'important')
                parent.style.setProperty('margin', '0', 'important')
                parent.style.setProperty('flex', '0 0 0px', 'important')
                parent.dataset.paffCollapsedCopilot = '1'
                parent = parent.parentElement
            } else {
                const cs = window.getComputedStyle(parent)
                if (cs.display === 'flex' || cs.display === 'inline-flex') {
                    parent.style.setProperty('gap', '0', 'important')
                }
                break
            }
        }
    }

    /**
     * Restore Copilot-related elements that were hidden during detach.
     */
    static restoreCopilotElements(target: HTMLElement) {
        try {
            const collapsed = target.querySelectorAll<HTMLElement>('[data-paff-collapsed-copilot="1"]')
            collapsed.forEach((el) => {
                el.style.removeProperty('display')
                el.style.removeProperty('width')
                el.style.removeProperty('min-width')
                el.style.removeProperty('padding')
                el.style.removeProperty('margin')
                el.style.removeProperty('flex')
                el.style.removeProperty('gap')
                delete el.dataset.paffCollapsedCopilot
            })

            const hidden = target.querySelectorAll<HTMLElement>('[data-paff-hidden-copilot="1"]')
            hidden.forEach((el) => {
                el.style.removeProperty('display')
                el.style.removeProperty('width')
                el.style.removeProperty('height')
                el.style.removeProperty('overflow')
                el.style.removeProperty('padding')
                el.style.removeProperty('margin')
                el.style.removeProperty('min-width')
                el.style.removeProperty('flex')
                delete el.dataset.paffHiddenCopilot
            })
        } catch {
            /* ignore */
        }
    }
}

import React, { useEffect, useRef } from 'react'
import { EditorView, keymap } from '@codemirror/view'
import { EditorState, Compartment } from '@codemirror/state'
import { indentWithTab } from '@codemirror/commands'
import { basicSetup } from 'codemirror'
import { python } from '@codemirror/lang-python'
import { javascript } from '@codemirror/lang-javascript'
import { java } from '@codemirror/lang-java'
import { cpp } from '@codemirror/lang-cpp'
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { tags as t } from '@lezer/highlight'

// CodeMirror 6 replaces Monaco (which loaded ~5MB from a CDN at runtime and
// officially has no mobile support — the audit flagged both). ~300KB bundled,
// touch-friendly, offline once cached. Same obsidian palette as before.

const LANGS = {
  python: () => python(),
  javascript: () => javascript(),
  java: () => java(),
  cpp: () => cpp(),
}

const makeLang = (id) => (LANGS[id]?.() ?? LANGS.python())

// Obsidian syntax colors (matching the pre-existing Monaco theme tokens).
const obsidianHighlight = HighlightStyle.define([
  { tag: t.comment, color: '#7D8B9F' },
  { tag: [t.keyword, t.operatorKeyword, t.modifier], color: '#8B7CF6' },
  { tag: [t.string, t.special(t.string)], color: '#34D399' },
  { tag: [t.number, t.bool, t.null, t.atom], color: '#FBBF24' },
  { tag: [t.typeName, t.className, t.namespace], color: '#7DD3FC' },
  { tag: [t.function(t.variableName), t.function(t.propertyName)], color: '#E6EAF2' },
  { tag: t.operator, color: '#8B7CF6' },
  { tag: t.punctuation, color: '#94A3B8' },
  { tag: [t.meta, t.processingInstruction], color: '#94A3B8' },
])

const makeTheme = (fontSize, wrap) => [
  EditorView.theme({
    '&': { backgroundColor: '#07090E', color: '#E6EAF2', height: '100%' },
    '.cm-scroller': {
      fontFamily: "'JetBrains Mono', ui-monospace, monospace",
      lineHeight: '1.55',
      overflow: 'auto',
    },
    '.cm-content': { caretColor: '#10B981', padding: '12px 0' },
    '.cm-line': { padding: '0 10px' },
    '.cm-gutters': {
      backgroundColor: '#07090E',
      color: '#7D8B9F',
      border: 'none',
      borderRight: '1px solid #FFFFFF10',
    },
    '.cm-activeLine': { backgroundColor: '#0D111A' },
    '.cm-activeLineGutter': { backgroundColor: '#0D111A', color: '#8B94A7' },
    '.cm-selectionBackground, &.cm-focused .cm-selectionBackground': { backgroundColor: '#1E3A32' },
    '.cm-cursor, .cm-dropCursor': { borderLeftColor: '#10B981' },
    '.cm-panels': { backgroundColor: '#131A26', color: '#E6EAF2' },
    '.cm-tooltip': { backgroundColor: '#131A26', border: '1px solid #FFFFFF14' },
    '.cm-searchMatch': { backgroundColor: '#1E3A32', outline: '1px solid #10B98140' },
  }),
  wrap ? EditorView.lineWrapping : [],
]

// Controlled component contract mirrors the old Monaco usage:
// <CodeEditor value onChange language fontSize wordWrap />
export default function CodeEditor({
  value,
  onChange,
  language = 'python',
  fontSize = 13,
  wordWrap = false,
  readOnly = false,
  className = '',
}) {
  const hostRef = useRef(null)
  const viewRef = useRef(null)
  const langComp = useRef(new Compartment())
  const themeComp = useRef(new Compartment())
  const emitRef = useRef(value ?? '') // last value applied/emitted
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  // Create the view once. Props flow through reconfigure effects below so the
  // editor instance survives draft loads, language switches, and font changes.
  useEffect(() => {
    const view = new EditorView({
      parent: hostRef.current,
      state: EditorState.create({
        doc: value ?? '',
        extensions: [
          basicSetup,
          keymap.of([indentWithTab]),
          langComp.current.of(makeLang(language)),
          themeComp.current.of(makeTheme(fontSize, wordWrap)),
          syntaxHighlighting(obsidianHighlight),
          EditorState.readOnly.of(Boolean(readOnly)),
          EditorView.updateListener.of((u) => {
            if (u.docChanged) {
              const v = u.state.doc.toString()
              emitRef.current = v
              onChangeRef.current?.(v)
            }
          }),
        ],
      }),
    })
    viewRef.current = view
    return () => { view.destroy(); viewRef.current = null }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // External value changes (draft load, remote pull, reset button).
  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    const next = value ?? ''
    if (next !== emitRef.current) {
      emitRef.current = next
      view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: next } })
    }
  }, [value])

  // Language / font-size / wrap reconfiguration via compartments.
  useEffect(() => {
    viewRef.current?.dispatch({ effects: langComp.current.reconfigure(makeLang(language)) })
  }, [language])

  useEffect(() => {
    viewRef.current?.dispatch({ effects: themeComp.current.reconfigure(makeTheme(fontSize, wordWrap)) })
  }, [fontSize, wordWrap])

  return <div ref={hostRef} className={`h-full overflow-hidden ${className}`} />
}

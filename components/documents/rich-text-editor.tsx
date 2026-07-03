'use client'

import { useEffect } from 'react'

import Box from '@mui/material/Box'
import ButtonBase from '@mui/material/ButtonBase'
import Stack from '@mui/material/Stack'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import type { ChainedCommands } from '@tiptap/core'
import { Extension } from '@tiptap/core'
import { Color } from '@tiptap/extension-color'
import TextAlign from '@tiptap/extension-text-align'
import { TextStyle } from '@tiptap/extension-text-style'
import Underline from '@tiptap/extension-underline'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'

// ---- Custom font-size extension (no external package needed) ------------------
declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    fontSize: {
      setFontSize: (size: string) => ReturnType
      unsetFontSize: () => ReturnType
    }
  }
}

const FontSize = Extension.create({
  name: 'fontSize',
  addGlobalAttributes() {
    return [
      {
        types: ['textStyle'],
        attributes: {
          fontSize: {
            default: null,
            parseHTML: (el: HTMLElement) => el.style.fontSize || null,
            renderHTML: (attrs: Record<string, string | null>) => {
              if (!attrs.fontSize) return {}
              return { style: `font-size: ${attrs.fontSize}` }
            }
          }
        }
      }
    ]
  },
  addCommands() {
    return {
      setFontSize:
        (size: string) =>
        ({ chain }: { chain: () => ChainedCommands }) =>
          chain().setMark('textStyle', { fontSize: size }).run(),
      unsetFontSize:
        () =>
        ({ chain }: { chain: () => ChainedCommands }) =>
          chain().setMark('textStyle', { fontSize: null }).run()
    } as unknown as Record<string, unknown>
  }
})

const FONT_SIZES = [
  '8',
  '9',
  '10',
  '11',
  '12',
  '14',
  '16',
  '18',
  '20',
  '24',
  '28',
  '32',
  '36',
  '48'
]

// ---- design tokens matching the form builder dark theme
const C = {
  panel: '#171a21',
  panel2: '#1e2230',
  border: '#2c3140',
  input: '#10131a',
  text: '#e8eaf0',
  muted: '#9aa1b2',
  accent: '#6c9eff',
  accentText: '#0b1020'
}

interface Props {
  label: string
  html: string
  onChange: (html: string, plain: string) => void
  multiline?: boolean
  placeholder?: string
}

function ToolBtn({
  title,
  active,
  onClick,
  children
}: {
  title: string
  active?: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <Tooltip title={title} placement="top">
      <ButtonBase
        onMouseDown={e => {
          e.preventDefault() // prevent editor blur
          onClick()
        }}
        sx={{
          width: 26,
          height: 26,
          borderRadius: '4px',
          bgcolor: active ? C.accent : 'transparent',
          color: active ? C.accentText : C.muted,
          fontSize: 12,
          fontWeight: 700,
          border: active ? 'none' : `1px solid transparent`,
          '&:hover': { bgcolor: active ? C.accent : 'rgba(255,255,255,0.08)' }
        }}
      >
        {children}
      </ButtonBase>
    </Tooltip>
  )
}

export function RichTextEditor({
  label,
  html,
  onChange,
  multiline = false,
  placeholder = 'Enter text…'
}: Props) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      TextStyle,
      Color,
      FontSize,
      TextAlign.configure({ types: ['heading', 'paragraph'] })
    ],
    content: html || '',
    onUpdate({ editor: ed }) {
      const newHtml = ed.getHTML()
      const plain = ed.getText()
      onChange(newHtml, plain)
    },
    editorProps: {
      transformPastedHTML(pastedHtml) {
        // Strip inline color/background styles so pasted text is always visible
        return pastedHtml
          .replace(/\s*color\s*:[^;'"]+;?/gi, '')
          .replace(/\s*background(-color)?\s*:[^;'"]+;?/gi, '')
          .replace(/\s*font-family\s*:[^;'"]+;?/gi, '')
      },
      attributes: {
        style: [
          'outline:none',
          'min-height:' + (multiline ? '64px' : '24px'),
          'font-size:13px',
          'line-height:1.5',
          'color:' + C.text,
          'padding:4px 6px',
          'word-break:break-word'
        ].join(';')
      }
    }
  })

  // Sync external changes (e.g. template load) without cursor jump
  useEffect(() => {
    if (!editor) return
    if (editor.getHTML() !== html) {
      editor.commands.setContent(html || '', { emitUpdate: false })
    }
  }, [html, editor])

  if (!editor) return null

  const currentColor = editor.getAttributes('textStyle').color as
    string | undefined
  const currentFontSize =
    (editor.getAttributes('textStyle').fontSize as string | undefined)?.replace(
      'px',
      ''
    ) ?? ''

  return (
    <Box>
      <Typography sx={{ fontSize: 11, color: C.muted, mb: 0.5 }}>
        {label}
      </Typography>
      <Box
        sx={{
          border: `1px solid ${C.border}`,
          borderRadius: '6px',
          bgcolor: C.input,
          overflow: 'hidden'
        }}
      >
        {/* Toolbar */}
        <Stack
          direction="row"
          sx={{
            px: 0.75,
            py: 0.5,
            gap: 0.25,
            borderBottom: `1px solid ${C.border}`,
            flexWrap: 'wrap',
            alignItems: 'center'
          }}
        >
          <ToolBtn
            title="Bold"
            active={editor.isActive('bold')}
            onClick={() => editor.chain().focus().toggleBold().run()}
          >
            B
          </ToolBtn>
          <ToolBtn
            title="Italic"
            active={editor.isActive('italic')}
            onClick={() => editor.chain().focus().toggleItalic().run()}
          >
            <em>I</em>
          </ToolBtn>
          <ToolBtn
            title="Underline"
            active={editor.isActive('underline')}
            onClick={() => editor.chain().focus().toggleUnderline().run()}
          >
            <u>U</u>
          </ToolBtn>

          {/* separator */}
          <Box sx={{ width: '1px', height: 16, bgcolor: C.border, mx: 0.25 }} />

          {/* Font size */}
          <Tooltip title="Font size" placement="top">
            <Box
              component="select"
              value={currentFontSize}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
                const val = e.target.value
                if (val) {
                  editor.chain().focus().setFontSize(`${val}px`).run()
                } else {
                  editor.chain().focus().unsetFontSize().run()
                }
              }}
              onMouseDown={(e: React.MouseEvent) => e.stopPropagation()}
              sx={{
                height: 26,
                px: 0.5,
                bgcolor: C.input,
                color: C.text,
                border: `1px solid ${C.border}`,
                borderRadius: '4px',
                fontSize: 11,
                cursor: 'pointer',
                outline: 'none',
                minWidth: 44
              }}
            >
              <option value="">—</option>
              {FONT_SIZES.map(s => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Box>
          </Tooltip>

          {/* separator */}
          <Box sx={{ width: '1px', height: 16, bgcolor: C.border, mx: 0.25 }} />

          <ToolBtn
            title="Align left"
            active={editor.isActive({ textAlign: 'left' })}
            onClick={() => editor.chain().focus().setTextAlign('left').run()}
          >
            ≡
          </ToolBtn>
          <ToolBtn
            title="Align center"
            active={editor.isActive({ textAlign: 'center' })}
            onClick={() => editor.chain().focus().setTextAlign('center').run()}
          >
            ☰
          </ToolBtn>
          <ToolBtn
            title="Align right"
            active={editor.isActive({ textAlign: 'right' })}
            onClick={() => editor.chain().focus().setTextAlign('right').run()}
          >
            ≡
          </ToolBtn>

          {/* separator */}
          <Box sx={{ width: '1px', height: 16, bgcolor: C.border, mx: 0.25 }} />

          {/* Color picker */}
          <Tooltip title="Text color" placement="top">
            <Box
              component="label"
              sx={{
                position: 'relative',
                width: 26,
                height: 26,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <Box
                sx={{
                  width: 14,
                  height: 14,
                  borderRadius: '3px',
                  bgcolor: currentColor ?? C.text,
                  border: `1px solid ${C.border}`
                }}
              />
              <input
                type="color"
                value={currentColor ?? '#e8eaf0'}
                onChange={e =>
                  editor.chain().focus().setColor(e.target.value).run()
                }
                style={{
                  position: 'absolute',
                  opacity: 0,
                  width: '100%',
                  height: '100%',
                  cursor: 'pointer'
                }}
              />
            </Box>
          </Tooltip>

          <ToolBtn
            title="Clear formatting"
            active={false}
            onClick={() =>
              editor.chain().focus().unsetAllMarks().clearNodes().run()
            }
          >
            Tx
          </ToolBtn>
        </Stack>

        {/* Editor area */}
        <Box
          sx={{
            '& .tiptap': { color: C.text },
            '& .tiptap *': { color: 'inherit' },
            '& .tiptap p': { margin: 0 }
          }}
        >
          <EditorContent editor={editor} />
        </Box>
      </Box>
    </Box>
  )
}

/** Strip HTML tags to plain text (for PDF field naming / plain-text fallback). */
export function htmlToPlain(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim()
}

import { AiError } from './types'

const TEXT_EXTENSIONS = new Set(['md', 'markdown', 'txt'])

function extensionOf(filename: string): string {
  const dot = filename.lastIndexOf('.')
  return dot === -1 ? '' : filename.slice(dot + 1).toLowerCase()
}

/**
 * Extract plain text from an uploaded knowledge-base file.
 *
 * `.md` / `.markdown` / `.txt` are read verbatim (the chunker/embedder
 * already treat knowledge content as plain text, so Markdown syntax is
 * fine as-is). `.pdf` goes through pdf-parse's text extraction, which is
 * pure JS (no native bindings) — safe to run in a Vercel serverless
 * function.
 *
 * pdf-parse is a CommonJS module (listed in `serverExternalPackages`).
 * We use a dynamic `require()` inside the function body to guarantee
 * Node resolves it at call-time rather than at bundle-build time, which
 * prevents "ERR_REQUIRE_ESM" / "module not found" failures on Vercel.
 */
export async function extractTextFromFile(
  filename: string,
  buffer: Buffer,
): Promise<string> {
  const ext = extensionOf(filename)

  if (TEXT_EXTENSIONS.has(ext)) {
    return buffer.toString('utf-8')
  }

  if (ext === 'pdf') {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const pdfParseModule = require('pdf-parse') as typeof import('pdf-parse')
      // pdf-parse v2.x exports a named class PDFParse; v1.x exports a
      // default function. Support both shapes so an upgrade/downgrade
      // doesn't silently break.
      const { PDFParse } = pdfParseModule as unknown as {
        PDFParse: new (opts: { data: Buffer | Uint8Array }) => {
          getText(): Promise<{ text: string }>
          destroy(): Promise<void>
        }
      }

      const parser = new PDFParse({ data: buffer })
      try {
        const result = await parser.getText()
        return result.text ?? ''
      } finally {
        await parser.destroy()
      }
    } catch (err) {
      if (err instanceof AiError) throw err
      const message = err instanceof Error ? err.message : String(err)
      throw new AiError(`Could not read PDF: ${message}`, {
        code: 'pdf_parse_failed',
        status: 400,
      })
    }
  }

  throw new AiError(
    'Unsupported file type. Upload a .md, .txt or .pdf file.',
    { code: 'unsupported_file_type', status: 400 },
  )
}

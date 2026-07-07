import { PDFParse } from 'pdf-parse'
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
    const parser = new PDFParse({ data: buffer })
    try {
      const result = await parser.getText()
      return result.text
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      throw new AiError(`Could not read PDF: ${message}`, { code: 'pdf_parse_failed', status: 400 })
    } finally {
      await parser.destroy()
    }
  }

  throw new AiError(
    'Unsupported file type. Upload a .md or .pdf file.',
    { code: 'unsupported_file_type', status: 400 },
  )
}

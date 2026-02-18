import juice from 'juice'

export interface InlinerOptions {
  /** Enable CSS inlining (default: true). */
  enabled: boolean
  /** Enable Tailwind CSS compilation before inlining (default: false). */
  tailwind: boolean
}

/**
 * Process rendered HTML for email delivery:
 * 1. Optionally compile Tailwind classes to CSS
 * 2. Inline all <style> blocks into style="" attributes via juice
 */
export async function inlineCss(html: string, options: InlinerOptions): Promise<string> {
  if (!options.enabled) return html

  let processed = html

  if (options.tailwind) {
    processed = await compileTailwind(processed)
  }

  return juice(processed, {
    removeStyleTags: true,
    preserveMediaQueries: true,
    preserveFontFaces: true,
    preserveKeyFrames: true,
    applyWidthAttributes: true,
    applyHeightAttributes: true,
    applyAttributesTableElements: true,
  })
}

/**
 * Extract Tailwind utility classes from HTML and compile them to CSS,
 * then inject a <style> block for juice to inline.
 *
 * Uses dynamic import — silently skips if tailwindcss is not installed.
 */
async function compileTailwind(html: string): Promise<string> {
  try {
    // @ts-ignore: Tailwind is optional
    const { compile } = await import('tailwindcss')

    const compiler = await compile('@tailwind utilities;')
    const classes = extractClasses(html)

    if (classes.length === 0) return html

    const css = compiler.build(classes)
    if (!css) return html

    const insertPoint = html.indexOf('</head>')
    if (insertPoint !== -1) {
      return html.slice(0, insertPoint) + `<style>${css}</style>` + html.slice(insertPoint)
    }
    return `<style>${css}</style>` + html
  } catch {
    // tailwindcss not installed or API mismatch — skip silently
    return html
  }
}

/** Extract class names from HTML class="..." attributes. */
function extractClasses(html: string): string[] {
  const classRegex = /class\s*=\s*["']([^"']*)["']/gi
  const classes = new Set<string>()

  let match
  while ((match = classRegex.exec(html)) !== null) {
    for (const cls of match[1]!.split(/\s+/)) {
      const trimmed = cls.trim()
      if (trimmed) classes.add(trimmed)
    }
  }

  return [...classes]
}

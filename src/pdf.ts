import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import type { PuppeteerNode } from 'puppeteer'
import { yellow } from 'yoctocolors'
import type { Resume, Theme } from './types.js'

const mimeTypes: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
}

async function convertLocalImagesToBase64(html: string): Promise<string> {
  // Match src attributes with local file paths (absolute paths starting with /)
  const imgRegex =
    /(<img[^>]+src=["'])(\/?[^"']+\.(jpe?g|png|gif|webp|svg))(["'][^>]*>)/gi

  const matches = [...html.matchAll(imgRegex)]
  let result = html

  for (const match of matches) {
    const fullMatch = match[0]
    const prefix = match[1]
    const imagePath = match[2]
    const suffix = match[4]

    // Skip if any capture group is missing
    if (!fullMatch || !prefix || !imagePath || !suffix) {
      continue
    }

    // Skip URLs (http, https, data, etc.)
    if (imagePath.startsWith('http') || imagePath.startsWith('data:')) {
      continue
    }

    // Check if it's a local file path
    const absolutePath = path.isAbsolute(imagePath)
      ? imagePath
      : path.resolve(imagePath)

    if (existsSync(absolutePath)) {
      try {
        const imageBuffer = await readFile(absolutePath)
        const ext = path.extname(absolutePath).toLowerCase()
        const mimeType = mimeTypes[ext] || 'image/jpeg'
        const base64 = imageBuffer.toString('base64')
        const dataUrl = `data:${mimeType};base64,${base64}`

        result = result.replace(fullMatch, `${prefix}${dataUrl}${suffix}`)
      } catch {
        // If we can't read the file, leave the original path
      }
    }
  }

  return result
}

export const pdf = async (
  html: string,
  resume: Resume,
  themeModule: Theme,
  pptrModuleName = 'puppeteer',
) => {
  let puppeteer: PuppeteerNode

  try {
    puppeteer = await import(pptrModuleName)
  } catch {
    throw new Error(
      `Could not import ${yellow(pptrModuleName)} package. Is it installed?`,
    )
  }

  // Convert local image paths to base64 data URLs
  const processedHtml = await convertLocalImagesToBase64(html)

  const browser = await puppeteer.launch()
  const page = await browser.newPage()

  await page.setContent(processedHtml, { waitUntil: 'networkidle0' })
  const rendered = await page.pdf({
    ...themeModule.pdfRenderOptions,
    ...resume.meta?.pdfRenderOptions,
  })
  await browser.close()

  return rendered
}

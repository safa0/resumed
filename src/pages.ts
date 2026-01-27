import type { PuppeteerNode } from 'puppeteer'
import { yellow } from 'yoctocolors'

export interface PageCountResult {
  pages: number
  contentHeight: number
  pageHeight: number
  lastPageFill: number // 0-100% how full is the last page
  hasEmptyLastPage: boolean
  hasOrphanLastPage: boolean // < 30% content on page 3
  hasUnderfilled2ndPage: boolean // 2-page resume with < 90% on page 2
}

export async function getPageCount(
  html: string,
  format: 'A4' | 'Letter' = 'A4',
  pptrModuleName = 'puppeteer',
): Promise<PageCountResult> {
  let puppeteer: PuppeteerNode

  try {
    puppeteer = await import(pptrModuleName)
  } catch {
    throw new Error(
      `Could not import ${yellow(pptrModuleName)} package. Is it installed?`,
    )
  }

  // Page heights in mm: A4 = 297mm, Letter = 279.4mm (11in)
  // Convert to pixels at 96 DPI
  const pageHeightMm = format === 'A4' ? 297 : 279.4
  const pageHeightPx = (pageHeightMm / 25.4) * 96
  // 1cm top + 1cm bottom margins (CSS @page margins)
  const marginPx = (10 / 25.4) * 96 * 2
  const usableHeight = pageHeightPx - marginPx

  const browser = await puppeteer.launch()
  const page = await browser.newPage()

  // Set viewport to A4/Letter width for accurate content flow
  const pageWidthMm = format === 'A4' ? 210 : 215.9 // 8.5in for Letter
  const pageWidthPx = (pageWidthMm / 25.4) * 96
  await page.setViewport({
    width: Math.round(pageWidthPx),
    height: Math.round(pageHeightPx),
  })

  await page.setContent(html, { waitUntil: 'networkidle0' })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const contentHeight = await page.evaluate(
    () => (globalThis as any).document.documentElement.scrollHeight,
  )

  await browser.close()

  const pages = Math.ceil(contentHeight / usableHeight)
  const lastPageContent = contentHeight % usableHeight || usableHeight
  const lastPageFill =
    pages === 1
      ? (contentHeight / usableHeight) * 100
      : (lastPageContent / usableHeight) * 100

  return {
    pages,
    contentHeight: Math.round(contentHeight),
    pageHeight: Math.round(usableHeight),
    lastPageFill: Math.round(lastPageFill),
    hasEmptyLastPage: lastPageFill < 5, // < 5% is effectively empty
    hasOrphanLastPage: lastPageFill > 0 && lastPageFill < 30, // 5-30% is orphan on page 3
    hasUnderfilled2ndPage: pages === 2 && lastPageFill < 90, // 2-page resume must be 90%+ full
  }
}

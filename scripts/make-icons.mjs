// Иконки приложения из одного SVG-мотива: белая машина спереди на акцентном синем.
// Запуск: node scripts/make-icons.mjs  (нужен установленный Chromium для Playwright)
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { chromium } from '@playwright/test'

const ACCENT = '#2563EB' // --color-accent светлой темы
const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons')

/** Машина спереди в поле 512×512 (по высоте 150…404, поэтому сдвиг −21 к центру). Вырезы — цветом фона. */
function car(bg) {
  return `
  <g transform="translate(0 -21)">
    <path fill="#FFFFFF" d="M186 150h140c16 0 30 10 36 25l30 79h10c26 0 46 20 46 46v58c0 14-11 26-25 26h-6v26c0 12-10 22-22 22h-32c-12 0-22-10-22-22v-26H171v26c0 12-10 22-22 22h-32c-12 0-22-10-22-22v-26h-6c-14 0-25-12-25-26v-58c0-26 20-46 46-46h10l30-79c6-15 20-25 36-25z"/>
    <path fill="${bg}" d="M196 184h120c7 0 13 4 15 11l21 59H160l21-59c2-7 8-11 15-11z"/>
    <circle fill="${bg}" cx="150" cy="306" r="24"/>
    <circle fill="${bg}" cx="362" cy="306" r="24"/>
    <rect fill="${bg}" x="212" y="296" width="88" height="20" rx="10"/>
  </g>`
}

/**
 * @param {{ rounded: boolean, scale: number }} o rounded — скруглённый квадрат с прозрачными углами (purpose any),
 *   иначе квадрат во весь холст (maskable, apple-touch-icon); scale — размер мотива относительно холста.
 */
function svg({ rounded, scale }) {
  const offset = (512 - 512 * scale) / 2
  const bgShape = rounded
    ? `<rect width="512" height="512" rx="116" fill="${ACCENT}"/>`
    : `<rect width="512" height="512" fill="${ACCENT}"/>`
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">${bgShape}<g transform="translate(${offset} ${offset}) scale(${scale})">${car(ACCENT)}</g></svg>`
}

const TARGETS = [
  { file: 'icon-192.png', size: 192, rounded: true, scale: 0.86 },
  { file: 'icon-512.png', size: 512, rounded: true, scale: 0.86 },
  // Безопасная зона maskable — круг 80 %; мотив с полями 20 % с каждой стороны.
  { file: 'icon-maskable-512.png', size: 512, rounded: false, scale: 0.6 },
  // iOS скругляет сам; прозрачность не допускается.
  { file: 'apple-touch-icon.png', size: 180, rounded: false, scale: 0.78 },
]

mkdirSync(OUT, { recursive: true })
writeFileSync(join(OUT, 'icon.svg'), svg({ rounded: true, scale: 0.86 }) + '\n')

const browser = await chromium.launch()
const page = await browser.newPage({ deviceScaleFactor: 1 })
for (const t of TARGETS) {
  await page.setViewportSize({ width: t.size, height: t.size })
  const markup = svg(t).replace('<svg ', `<svg width="${t.size}" height="${t.size}" `)
  await page.setContent(`<html><body style="margin:0;background:transparent">${markup}</body></html>`)
  await page.screenshot({
    path: join(OUT, t.file),
    omitBackground: t.rounded,
    clip: { x: 0, y: 0, width: t.size, height: t.size },
  })
  process.stdout.write(`icons/${t.file} ${t.size}×${t.size}\n`)
}
await browser.close()

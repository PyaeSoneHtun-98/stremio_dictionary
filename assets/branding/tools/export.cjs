// Optional design tooling; sharp is not an application/runtime dependency.
const fs = require('node:fs/promises')
const path = require('node:path')
const sharp = require(process.env.SHARP_MODULE || 'sharp')

const root = path.resolve(__dirname, '..')
const inner = (svg) => svg.slice(svg.indexOf('>') + 1, svg.lastIndexOf('</svg>'))
  .replace(/<(title|desc)\b[^>]*>[\s\S]*?<\/\1>/g, '').trim()
const document = (width, height, title, body) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${title}">\n  <title>${title}</title>\n${body}\n</svg>\n`

async function main() {
  const mark = inner(await fs.readFile(path.join(root, 'subtitle-bridge-mark.svg'), 'utf8'))
  const wordmark = inner(await fs.readFile(path.join(root, 'source/wordmark-outlined.svg'), 'utf8'))
  const icon = document(256, 256, 'Subtitle Bridge app icon',
    `  <rect width="256" height="256" rx="56" fill="#181818"/>\n  <g transform="translate(0 16)">\n${mark}\n  </g>`)
  const logo = document(1024, 1024, 'Subtitle Bridge logo',
    `  <rect width="1024" height="1024" fill="#181818"/>\n  <g transform="translate(115.2 100) scale(3.1)">\n${mark}\n  </g>\n  <g transform="translate(62 750)">\n${wordmark}\n  </g>`)
  await fs.writeFile(path.join(root, 'subtitle-bridge-icon.svg'), icon)
  await fs.writeFile(path.join(root, 'subtitle-bridge-logo.svg'), logo)
  await fs.mkdir(path.join(root, 'exports'), { recursive: true })
  await sharp(Buffer.from(logo)).resize(1024, 1024).png().toFile(path.join(root, 'subtitle-bridge-logo.png'))
  await sharp(Buffer.from(icon)).resize(1024, 1024).png().toFile(path.join(root, 'subtitle-bridge-icon.png'))
  for (const size of [16, 24, 32, 48, 64, 128, 256]) {
    // Rasterize each size directly from SVG rather than scaling a small bitmap.
    await sharp(Buffer.from(icon)).resize(size, size).png()
      .toFile(path.join(root, `exports/icon-${size}.png`))
  }
  console.log('Exported vector logo/icon and PNG sizes 16–1024px.')
}

main().catch((error) => { console.error(error); process.exitCode = 1 })

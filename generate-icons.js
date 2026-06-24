import sharp from 'sharp'
import { mkdirSync } from 'fs'

mkdirSync('public/icons', { recursive: true })

const sizes = [192, 512]

for (const size of sizes) {
  await sharp('public/favicon.svg')
    .resize(size, size)
    .png()
    .toFile(`public/icons/icon-${size}x${size}.png`)
  console.log(`Generated public/icons/icon-${size}x${size}.png`)
}

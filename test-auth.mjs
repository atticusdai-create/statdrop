import { chromium } from 'playwright'

const SCRATCHPAD = '/private/tmp/claude-502/-Users-atticus-Desktop-statdrop/31405d5a-c1a3-4606-926d-d572a2f9bd33/scratchpad'

const browser = await chromium.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  args: ['--no-sandbox'],
})
const page = await browser.newPage()

// Landing page
await page.goto('http://localhost:5174')
await page.waitForSelector('text=StatDrop')
await page.screenshot({ path: `${SCRATCHPAD}/landing.png`, fullPage: false })
console.log('✓ Landing page')

// Nav should show Log In + Sign Up
const navText = await page.locator('nav').innerText()
console.log('Nav text:', navText.replace(/\n/g, ' | '))

// Login page
await page.goto('http://localhost:5174/login')
await page.waitForSelector('text=Welcome')
await page.screenshot({ path: `${SCRATCHPAD}/login.png`, fullPage: false })
console.log('✓ Login page')

// Signup page
await page.goto('http://localhost:5174/signup')
await page.waitForSelector('text=Create Account', { timeout: 5000 }).catch(() => page.waitForSelector('text=Create'))
await page.screenshot({ path: `${SCRATCHPAD}/signup.png`, fullPage: false })
console.log('✓ Signup page')

// Protected route - /log should redirect to /login
await page.goto('http://localhost:5174/log')
await page.waitForURL('**/login**', { timeout: 5000 })
console.log('✓ /log redirected to /login (ProtectedRoute works)')
await page.screenshot({ path: `${SCRATCHPAD}/protected-redirect.png`, fullPage: false })

// Protected route - /create should redirect to /login
await page.goto('http://localhost:5174/create')
await page.waitForURL('**/login**', { timeout: 5000 })
console.log('✓ /create redirected to /login (ProtectedRoute works)')

// Check console errors on landing
const errors = []
page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()) })
await page.goto('http://localhost:5174')
await page.waitForTimeout(2000)
if (errors.length) {
  console.log('Console errors:', errors)
} else {
  console.log('✓ No console errors on landing')
}

await browser.close()
console.log('All checks passed.')

// Dark-mode screenshots + toggle checks. Usage: node dark-shots.mjs <outDir> <playwrightDir> [base]
import { createRequire } from 'node:module';
const require = createRequire(process.argv[3] + '/package.json');
const { chromium } = require('playwright-core');
const OUT = process.argv[2];
const BASE = process.argv[4] || 'http://localhost:4100';
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: 'light' });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error' && !/picsum|fonts\.g|ERR_|Failed to load resource/.test(m.text())) errors.push('console: ' + m.text()); });
const step = async (name, fn) => { try { await fn(); console.log('ok  ', name); } catch (e) { console.log('FAIL', name, e.message.split('\n')[0]); errors.push(name); } };
const theme = () => page.evaluate(() => document.documentElement.dataset.theme);
const shot = async (n, full = false) => { await page.waitForTimeout(1200); await page.screenshot({ path: `${OUT}/${n}.png`, fullPage: full, timeout: 90000 }); };

await step('landing follows OS (light) then toggles to dark', async () => {
  await page.goto(BASE + '/'); await page.getByRole('heading', { name: /Find your people/ }).waitFor();
  if (await theme() !== 'light') throw new Error('expected light, got ' + await theme());
  await page.getByRole('button', { name: 'Switch to dark mode' }).click();
  if (await theme() !== 'dark') throw new Error('toggle did not switch');
  await shot('d-landing');
  await page.evaluate(() => window.scrollTo(0, 1500)); await shot('d-landing-2');
});
await step('choice persists across reloads (no flash: set before paint)', async () => {
  await page.reload();
  const early = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
  if (early !== 'dark') throw new Error('not dark after reload');
});
await step('login (dark)', async () => {
  await page.goto(BASE + '/login'); await page.getByText('Login to your account').waitFor(); await shot('d-login');
  await page.fill('input[type=email]', 'arjunm@cse.iitr.ac.in'); await page.fill('input[type=password]', 'password123');
  await page.getByRole('button', { name: 'Login', exact: true }).click(); await page.locator('article').first().waitFor();
});
for (const [path, n, wait] of [['/', 'd-home'], ['/culture', 'd-culture', '.fan-card'], ['/discover', 'd-discover', '.poster'], ['/personal', 'd-personal'], ['/u/riya.s', 'd-profile'], ['/post/1', 'd-post'], ['/activity/1', 'd-activity']]) {
  await step(n, async () => { await page.goto(BASE + path); if (wait) await page.locator(wait).first().waitFor(); await shot(n); });
}
await step('discover poster hover (dark)', async () => {
  await page.goto(BASE + '/discover'); const p = page.locator('.poster').nth(1); await p.waitFor(); const b = await p.boundingBox();
  await page.mouse.move(b.x + b.width * 0.7, b.y + b.height * 0.3); await shot('d-discover-hover');
});
await step('chats DM (dark)', async () => {
  await page.goto(BASE + '/chats'); await page.locator('.chat-item', { hasText: 'Riya Singh' }).click(); await page.locator('.bubble').first().waitFor(); await shot('d-chats');
});
await step('create post modal (dark)', async () => {
  await page.goto(BASE + '/'); await page.locator('article').first().waitFor(); await page.getByRole('button', { name: /Create Post/ }).click(); await page.getByRole('dialog').waitFor(); await shot('d-create');
  await page.keyboard.press('Escape');
});
await step('topbar toggle back to light', async () => {
  await page.getByRole('button', { name: 'Switch to light mode' }).click();
  if (await theme() !== 'light') throw new Error('did not switch back');
  await page.getByRole('button', { name: 'Switch to dark mode' }).click();
});
await step('mobile (dark)', async () => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const [path, n] of [['/', 'd-m-home'], ['/culture', 'd-m-culture']]) {
    await page.goto(BASE + path); await page.waitForTimeout(1500);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    if (overflow > 2) throw new Error(`overflow ${overflow} on ${path}`);
    await shot(n);
  }
});
console.log('ERRORS:', errors.length ? errors.join('\n') : 'none');
await browser.close();

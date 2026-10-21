import { createRequire } from 'node:module';
const require = createRequire(process.argv[3] + '/package.json');
const { chromium } = require('playwright-core');

const BASE = process.argv[4] || 'http://localhost:4100';
const OUT = process.argv[2];
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error' && !/fonts\.g|ERR_|Failed to load resource/.test(m.text())) errors.push('console: ' + m.text()); });
const step = async (name, fn) => { try { await fn(); console.log('ok  ', name); } catch (e) { console.log('FAIL', name, e.message.split('\n')[0]); errors.push(name); await page.screenshot({ path: `${OUT}/FAIL-${name.replace(/\W+/g, '_')}.png` }); } };
const scrollThrough = async () => {
  const h = await page.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y < h; y += 400) { await page.evaluate((v) => window.scrollTo(0, v), y); await page.waitForTimeout(120); }
  await page.waitForTimeout(1300);
};

await step('landing loads at / when logged out', async () => {
  await page.goto(BASE + '/');
  await page.getByRole('heading', { name: /Find your people/ }).waitFor();
  await page.locator('.lp-canvas.ready canvas').waitFor({ timeout: 45000 });
  await page.waitForTimeout(3500);
  await page.screenshot({ path: `${OUT}/l1-hero.png`, timeout: 90000 });
});
await step('drag spins globe', async () => {
  const box = await page.locator('.lp-canvas').boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down(); await page.mouse.move(box.x + box.width / 2 + 160, box.y + box.height / 2, { steps: 8 }); await page.mouse.up();
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${OUT}/l1b-hero-dragged.png` });
});
await step('sections + live stats', async () => {
  await scrollThrough();
  const students = await page.locator('.lp-stat-num').first().innerText();
  if (!(Number(students) >= 20)) throw new Error('students stat ' + students);
  if (await page.locator('.lp-review').count() < 6) throw new Error('reviews missing');
  await page.evaluate(() => window.scrollTo(0, 0)); await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/l2-full.png`, fullPage: true });
});
await step('section shots', async () => {
  for (const [id, n] of [['#aim', 'l3-aim'], ['#features', 'l4-features'], ['#impact', 'l5-impact'], ['#reviews', 'l6-reviews']]) {
    await page.locator(id).scrollIntoViewIfNeeded(); await page.evaluate((s) => document.querySelector(s).scrollIntoView({ behavior: 'instant' }), id);
    await page.waitForTimeout(700);
    if (id === '#features') { const t = page.locator('.t-feed'); const b = await t.boundingBox(); await page.mouse.move(b.x + b.width * 0.8, b.y + b.height * 0.25); await page.waitForTimeout(400); }
    await page.screenshot({ path: `${OUT}/${n}.png` });
  }
});
await step('create account CTA → signup, back home', async () => {
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.locator('.lp-nav').getByRole('link', { name: 'Create account' }).click();
  await page.waitForURL(/\/signup$/);
  await page.getByTitle('Back to home').click(); await page.waitForURL(BASE + '/');
  await page.getByRole('heading', { name: /Find your people/ }).waitFor();
});
await step('log in CTA → login → feed, logout → landing', async () => {
  await page.locator('.lp-hero').getByRole('link', { name: 'Log in' }).click(); await page.waitForURL(/\/login$/);
  await page.screenshot({ path: `${OUT}/l7-login.png` });
  await page.fill('input[type=email]', 'arjunm@cse.iitr.ac.in'); await page.fill('input[type=password]', 'password123');
  await page.getByRole('button', { name: 'Login', exact: true }).click(); await page.locator('article').first().waitFor();
  if (await page.locator('.lp').count()) throw new Error('landing shown while logged in');
  await page.getByRole('button', { name: 'Profile menu' }).click(); await page.getByRole('button', { name: /Log out/ }).click();
  await page.getByRole('heading', { name: /Find your people/ }).waitFor();
});
await step('deep link logged out → login', async () => {
  await page.goto(BASE + '/chats'); await page.waitForURL(/\/login$/);
});
await step('tablet', async () => {
  await page.setViewportSize({ width: 900, height: 1100 }); await page.goto(BASE + '/'); await page.locator('.lp-canvas.ready').waitFor({ timeout: 45000 }); await page.waitForTimeout(2500);
  await page.screenshot({ path: `${OUT}/l8-tablet.png` });
});
await step('mobile', async () => {
  await page.setViewportSize({ width: 390, height: 844 }); await page.goto(BASE + '/'); await page.locator('.lp-canvas.ready').waitFor({ timeout: 45000 }); await page.waitForTimeout(2500);
  await page.screenshot({ path: `${OUT}/l9-mobile.png` });
  await scrollThrough();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  if (overflow > 2) throw new Error('overflow ' + overflow);
  await page.evaluate(() => window.scrollTo(0, 0)); await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/l10-mobile-full.png`, fullPage: true });
});
console.log('ERRORS:', errors.length ? errors.join('\n') : 'none');
await browser.close();

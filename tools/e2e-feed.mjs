import { createRequire } from 'node:module';
const require = createRequire(process.argv[3] + '/package.json');
const { chromium } = require('playwright-core');

const BASE = 'http://localhost:4100';
const OUT = process.argv[2];
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error' && !/picsum|fonts\.g|ERR_|Failed to load resource/.test(m.text())) errors.push('console: ' + m.text()); });
const shot = async (n) => { await page.waitForTimeout(800); await page.screenshot({ path: `${OUT}/${n}.png` }); };
const step = async (name, fn) => { try { await fn(); console.log('ok  ', name); } catch (e) { console.log('FAIL', name, e.message.split('\n')[0]); errors.push(name); await page.screenshot({ path: `${OUT}/FAIL-${name.replace(/\W+/g, '_')}.png` }); } };

await step('login', async () => {
  await page.goto(BASE + '/login');
  await page.fill('input[type=email]', 'arjunm@cse.iitr.ac.in'); await page.fill('input[type=password]', 'password123');
  await page.getByRole('button', { name: 'Login', exact: true }).click(); await page.locator('article').first().waitFor();
});
await step('sidebar has no Personal', async () => {
  if (await page.locator('.sidebar').getByText('Personal').count()) throw new Error('Personal still in sidebar');
});
await step('for you', async () => { await shot('f1-foryou'); });
await step('trending', async () => { await page.getByRole('tab', { name: 'Trending' }).click(); await page.waitForTimeout(600); await shot('f2-trending'); });
await step('tech', async () => { await page.getByRole('tab', { name: 'Tech' }).click(); await page.getByText('systems-design-notes.pdf').waitFor(); await shot('f3-tech'); });
await step('culture tab', async () => { await page.getByRole('tab', { name: 'Culture' }).click(); await page.waitForTimeout(600); await shot('f6-culture'); });
await step('more menu', async () => {
  await page.getByRole('button', { name: /More/ }).click(); await page.getByRole('button', { name: 'Life@Campus' }).click();
  await page.locator('.poll-opt').first().waitFor(); await page.locator('.poll-opt').first().click(); await page.waitForTimeout(500); await shot('f7-poll');
});
await step('create post', async () => {
  await page.getByRole('button', { name: 'Create Post' }).click(); await page.getByRole('dialog').waitFor(); await shot('f4-create');
  await page.getByRole('dialog').getByRole('button', { name: 'Poll' }).click();
  await page.getByRole('dialog').locator('textarea').fill('Which mess has the best Sunday special?');
  await page.getByPlaceholder('Option 1').fill('Mess A'); await page.getByPlaceholder('Option 2').fill('Mess B');
  await page.getByRole('dialog').getByRole('button', { name: 'Life@Campus' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Post', exact: true }).click(); await page.getByText('Posted!').waitFor();
});
await step('post detail', async () => {
  await page.goto(BASE + '/post/1'); await page.getByText(/Comments \(/).waitFor(); await shot('f5-detail');
  await page.locator('.comment-actions').first().getByText('Reply').click();
  await page.getByPlaceholder('Write a reply…').fill('Same here!'); await page.keyboard.press('Enter');
  await page.locator('.replies', { hasText: 'Same here!' }).waitFor();
  await page.getByRole('button', { name: /Most Relevant/ }).click(); await page.getByRole('button', { name: 'Newest' }).click(); await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/f8-detail-full.png`, fullPage: true });
});
await step('mobile', async () => {
  await page.setViewportSize({ width: 390, height: 844 }); await page.goto(BASE + '/'); await page.locator('article').first().waitFor(); await shot('f9-mobile');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  if (overflow > 2) throw new Error('overflow ' + overflow);
});
console.log('ERRORS:', errors.length ? errors.join('\n') : 'none');
await browser.close();

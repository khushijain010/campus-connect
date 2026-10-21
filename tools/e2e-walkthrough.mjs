import { createRequire } from 'node:module';
const require = createRequire(process.argv[3] + '/package.json');
const { chromium } = require('playwright-core');

// Usage: node tools/e2e-walkthrough.mjs <shotsDir> <dirWithPlaywrightCore> [baseUrl]. Needs a freshly seeded DB (it registers kavya@ece.iitr.ac.in).
const BASE = process.argv[4] || 'http://localhost:4000';
const HOME = /Good (morning|afternoon|evening)|Up late/;
const OUT = process.argv[2];
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error' && !/picsum|fonts\.g|ERR_|Failed to load resource/.test(m.text())) errors.push('console: ' + m.text()); });
// Software WebGL (swiftshader) in headless Chrome can make screenshots slow, so allow extra time.
const shot = async (name) => { await page.waitForTimeout(700); await page.screenshot({ path: `${OUT}/${name}.png`, timeout: 90000 }); };
const step = async (name, fn) => {
  try { await fn(); console.log('ok  ', name); } catch (e) { const m = e.message.split('\n')[0]; console.log('FAIL', name, m); errors.push(name + ': ' + m); await page.screenshot({ path: `${OUT}/FAIL-${name.replace(/\W+/g, '_')}.png` }).catch(() => {}); }
};

await step('login page', async () => { await page.goto(BASE + '/login'); await page.getByText('Login to your account').waitFor(); await shot('01-login'); });
await step('bad email blocked', async () => {
  await page.fill('input[type=email]', 'me@gmail.com'); await page.fill('input[type=password]', 'whatever1');
  await page.getByRole('button', { name: 'Login', exact: true }).click(); await page.getByText(/Use your IITR email/).waitFor();
});
await step('onboarding 4 steps + register', async () => {
  await page.goto(BASE + '/signup');
  await page.getByPlaceholder('Enter your full name').fill('Kavya Menon');
  await page.getByPlaceholder('Enter a unique handle').fill('kavya.m');
  await page.getByPlaceholder('name@ece.iitr.ac.in').fill('kavya@ece.iitr.ac.in');
  await page.getByText("Looks like you're in ECE").waitFor(); // department detected from the email subdomain
  await page.getByPlaceholder('Create a password').fill('kavya12345');
  await shot('02-onboard-1');
  await page.getByRole('button', { name: /Next/ }).click();
  await page.getByText('Academic Information').waitFor();
  if (await page.locator('select').nth(0).inputValue() !== 'ECE') throw new Error('department not pre-selected from email');
  await page.locator('select').nth(1).selectOption('2nd');
  for (const t of ['DSP', 'ML', 'Python', 'MATLAB', 'Evening']) await page.getByRole('button', { name: t, exact: true }).first().click();
  await shot('03-onboard-2');
  await page.getByRole('button', { name: /Next/ }).click();
  await page.getByText('Select what interests you').waitFor();
  for (const t of ['Photography', 'Music', 'AI/ML', 'Research']) await page.getByRole('button', { name: t, exact: true }).first().click();
  await page.locator('textarea').fill('ECE sophomore who loves photography and Carnatic music.');
  await shot('04-onboard-3');
  await page.getByRole('button', { name: /Next/ }).click();
  await page.getByText('Share your cultural background').waitFor();
  await page.locator('select').selectOption('Kerala');
  for (const t of ['Malayalam', 'English', 'Japanese', 'Food', 'Festivals', 'Dosa', 'Onam', 'Classical']) await page.getByRole('button', { name: t, exact: true }).first().click();
  await shot('05-onboard-4');
  await page.getByRole('button', { name: 'Finish' }).click();
  await page.getByText('Profile created! Log in').waitFor();
  await page.fill('input[type=password]', 'kavya12345');
  await page.getByRole('button', { name: 'Login', exact: true }).click();
  await page.getByRole('heading', { name: HOME }).waitFor();
  await shot('06-new-user-home');
  await page.getByLabel('Profile menu').click(); await page.getByText('Log out').click();
  await page.getByRole('heading', { name: /Find your people/ }).waitFor(); // logout lands on the landing page
  await page.goto(BASE + '/login'); await page.getByText('Login to your account').waitFor();
});
await step('login demo user', async () => {
  await page.fill('input[type=email]', 'arjunm@cse.iitr.ac.in'); await page.fill('input[type=password]', 'password123');
  await page.getByRole('button', { name: 'Login', exact: true }).click(); await page.getByRole('heading', { name: HOME }).waitFor();
  await page.locator('article').first().waitFor(); await shot('07-home');
});
await step('upvote + trending tab', async () => {
  const btn = page.locator('article').first().getByTitle('Upvote'); const before = await btn.innerText(); await btn.click(); await page.waitForTimeout(400);
  if ((await btn.innerText()) === before) throw new Error('upvote count unchanged');
  await page.getByRole('tab', { name: 'Trending' }).click(); await page.waitForTimeout(500); await shot('08-trending');
});
await step('create post modal', async () => {
  await page.getByRole('button', { name: 'Create Post' }).click(); await page.getByRole('dialog').waitFor();
  await page.getByRole('dialog').getByRole('button', { name: 'Project' }).click();
  await page.getByRole('dialog').locator('textarea').fill('Building a campus air-quality monitor #IoT');
  await page.getByPlaceholder('Project title').fill('Air Quality Monitor');
  await shot('09-create-post');
  await page.getByRole('dialog').getByRole('button', { name: 'Post', exact: true }).click(); await page.getByText('Posted!').waitFor();
  await page.getByRole('tab', { name: 'For You' }).click();
  await page.getByText('Air Quality Monitor').first().waitFor();
});
await step('global search', async () => {
  await page.getByLabel('Search').fill('kerala'); await page.waitForTimeout(700); await shot('10-search-pop');
  await page.keyboard.press('Enter'); await page.getByRole('heading', { name: 'Search' }).waitFor(); await shot('11-search-page');
});
await step('profile + icebreaker', async () => {
  await page.goto(BASE + '/u/aiko.t'); await page.getByText('Cultural Icebreaker').waitFor(); await shot('12-profile');
});
await step('culture page', async () => {
  await page.goto(BASE + '/culture'); await page.locator('.card-title', { hasText: 'Step Outside Your Circle' }).waitFor(); await page.waitForTimeout(900); await shot('13-culture');
  await page.getByRole('button', { name: 'Find Buddy' }).click(); await page.getByText(/buddies to learn/).waitFor();
  await page.getByRole('button', { name: /Explore culture/i }).click();
  await page.locator('.fan-card').first().waitFor();
  await page.getByRole('heading', { name: 'Teach Me Something' }).waitFor();
  await page.getByRole('button', { name: /Scroll Cultural Exchange Events right/ }).click();
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${OUT}/14-culture-full.png`, fullPage: true });
});
await step('discover page + filters', async () => {
  await page.goto(BASE + '/discover'); await page.getByRole('heading', { name: 'Recommended For You' }).waitFor(); await page.getByText("People you'd connect with").waitFor(); await page.waitForTimeout(900); await shot('15-discover');
  await page.screenshot({ path: `${OUT}/16-discover-full.png`, fullPage: true });
  await page.locator('.poster', { hasText: 'Photography Club' }).waitFor({ state: 'attached' });
  const card = page.locator('#communities .poster').first(); await card.scrollIntoViewIfNeeded(); await card.hover();
  await card.getByRole('button', { name: /community/ }).waitFor(); // hover reveals the Join button
  await page.getByRole('button', { name: /Filters/ }).click(); await page.getByRole('button', { name: 'Evening', exact: true }).click();
  await page.getByRole('button', { name: 'Sports', exact: true }).first().click(); await page.getByText('Matching activities').waitFor(); await shot('17-discover-filtered');
});
await step('add event', async () => {
  await page.goto(BASE + '/discover'); await page.getByRole('button', { name: 'Add Event' }).click(); await page.getByRole('dialog').waitFor();
  await page.getByPlaceholder('e.g. Photography Walk').fill('Night Sky Photography');
  const d = new Date(Date.now() + 3 * 864e5);
  await page.locator('input[type=date]').fill(d.toISOString().slice(0, 10));
  await shot('18-add-event');
  await page.getByRole('button', { name: 'Create event' }).click(); await page.getByText(/Event created/).waitFor();
});
await step('personal + manage applications', async () => {
  await page.goto(BASE + '/personal'); await page.getByText('Your Events / Groups').waitFor(); await page.waitForTimeout(700); await shot('19-personal');
  await page.screenshot({ path: `${OUT}/20-personal-full.png`, fullPage: true });
  await page.locator('.list-row', { hasText: 'AI-based Traffic Detection' }).getByRole('button', { name: /Manage Applications/ }).click(); await page.getByRole('dialog').waitFor(); await page.waitForTimeout(500); await shot('21-manage');
  await page.getByRole('dialog').getByRole('button', { name: 'Accept' }).first().click(); await page.getByText(/Accepted — added/).waitFor();
  await page.keyboard.press('Escape');
});
await step('survey', async () => {
  await page.getByRole('button', { name: 'Submit Feedback' }).first().click(); await page.getByRole('dialog').waitFor();
  await page.getByLabel('5 star').click(); await page.getByRole('dialog').getByRole('button', { name: 'Yes' }).first().click();
  await page.getByRole('dialog').locator('textarea').fill('Really enjoyed meeting people from other departments!');
  await shot('22-survey');
  await page.getByRole('button', { name: 'Submit feedback', exact: true }).click(); await page.getByText(/Thanks/).waitFor();
});
await step('chats DM', async () => {
  await page.goto(BASE + '/chats'); await page.locator('.chat-item', { hasText: 'Riya Singh' }).click(); await page.getByPlaceholder('Type a message…').waitFor();
  await page.getByPlaceholder('Type a message…').fill('See you at the library at 4!'); await page.keyboard.press('Enter');
  await page.locator('.bubble', { hasText: 'See you at the library at 4!' }).waitFor(); await shot('23-chat-dm');
});
await step('chats community', async () => {
  await page.getByRole('tab', { name: 'Communities' }).click(); await page.locator('.chat-item', { hasText: 'Cultural Exchange' }).click();
  await page.locator('.bubble').first().waitFor(); await page.waitForTimeout(700); await shot('24-chat-community');
});
await step('chats groups', async () => {
  await page.getByRole('tab', { name: 'Groups' }).click(); await page.locator('.chat-item', { hasText: 'AI-based Traffic Detection' }).click();
  await page.locator('.bubble').first().waitFor(); await shot('25-chat-group');
});
await step('community + activity pages', async () => {
  await page.goto(BASE + '/community/16'); await page.getByText('Upcoming Events').waitFor(); await shot('26-community');
  await page.goto(BASE + '/activity/7'); await page.getByText('Organised by').waitFor(); await shot('27-activity');
});
await step('edit profile', async () => { await page.goto(BASE + '/personal/edit'); await page.getByText('Cultural Information').waitFor(); await shot('28-edit'); });
await step('mobile', async () => {
  await page.setViewportSize({ width: 390, height: 844 }); await page.goto(BASE + '/'); await page.locator('article').first().waitFor(); await shot('29-mobile-home');
  await page.goto(BASE + '/culture'); await page.locator('.card-title', { hasText: 'Step Outside Your Circle' }).waitFor(); await shot('30-mobile-culture');
  for (const path of ['/culture', '/discover', '/chats', '/personal', '/u/riya.s']) {
    if (path !== '/culture') { await page.goto(BASE + path); await page.waitForTimeout(1500); }
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    if (overflow > 2) throw new Error(`horizontal overflow ${overflow}px on ${path}`);
  }
});
console.log('\nERRORS:', errors.length ? '\n' + errors.join('\n') : 'none');
await browser.close();

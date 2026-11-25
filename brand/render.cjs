// Renders the X/Twitter brand assets from brand/src/*.html.
// Usage (repo root, after npm install): node brand/render.cjs
const path = require('node:path');
const { chromium } = require('playwright');
const src = (f) => 'file://' + path.join(__dirname, 'src', f);
const out = (f) => path.join(__dirname, f);
(async () => {
  const b = await chromium.launch();
  const shots = [
    ['avatar.html', 400, 400, 'x-profile-400.png', 1],
    ['avatar.html#dark', 400, 400, 'x-profile-dark-400.png', 1],
    ['avatar.html', 400, 400, 'x-profile-800.png', 2],
    ['header.html', 1500, 500, 'x-header-1500x500.png', 1],
    ['header.html', 1500, 500, 'x-header-3000x1000.png', 2],
  ];
  for (const [file, w, h, name, scale] of shots) {
    const p = await b.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: scale });
    await p.goto(src(file));
    await p.evaluate(() => document.fonts.ready);
    await p.waitForTimeout(150);
    await p.screenshot({ path: out(name), clip: { x: 0, y: 0, width: w, height: h } });
    await p.close();
    console.log('wrote', name);
  }
  await b.close();
})();

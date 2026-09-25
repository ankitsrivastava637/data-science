// Shared Playwright launcher. Uses the system/Playwright Chromium; GPU flags per spec.
import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';

export function chromiumPath() {
  const cands = [process.env.CHROMIUM_PATH, '/opt/pw-browsers/chromium', '/usr/bin/chromium', '/usr/bin/google-chrome', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'];
  for (const c of cands) if (c && existsSync(c)) return c;
  return undefined; // let playwright find its own
}

export async function launch({ software = process.env.REALITY_SWIFTSHADER === '1', offline = false } = {}) {
  const args = ['--ignore-gpu-blocklist', '--enable-gpu-rasterization', '--disable-renderer-backgrounding', '--disable-background-timer-throttling', '--autoplay-policy=no-user-gesture-required'];
  if (software) args.push('--use-angle=swiftshader', '--enable-unsafe-swiftshader');
  else args.push('--use-angle=default', '--enable-unsafe-swiftshader');
  const browser = await chromium.launch({ executablePath: chromiumPath(), args, headless: true });
  const context = await browser.newContext({ offline, deviceScaleFactor: 1 });
  return { browser, context };
}

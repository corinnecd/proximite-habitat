import { chromium } from "playwright";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
page.on("pageerror", err => console.log("PAGEERROR:", err.message));

await page.goto("http://localhost:3000/login", { waitUntil: "networkidle" });
await page.fill('input[type="email"]', "direction.generale@proximite-habitat.fr");
await page.fill('input[type="password"]', "TempScreenshot123!");
await page.click('button[type="submit"]');
await page.waitForTimeout(2500);
console.log("URL after login:", page.url());

await page.goto("http://localhost:3000/admin/succursales", { waitUntil: "networkidle" });
await page.waitForTimeout(1500);
console.log("URL:", page.url());
await page.screenshot({ path: "/tmp/succursales.png", fullPage: true });
console.log("Screenshot saved");
await browser.close();

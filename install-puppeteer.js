const puppeteer = require('puppeteer');

(async () => {
    console.log("📦 Installing Puppeteer Chrome...");
    await puppeteer.createBrowserFetcher().download('latest');
    console.log("✅ Puppeteer installed successfully!");
})();

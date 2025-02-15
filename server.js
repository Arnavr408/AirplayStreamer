const express = require('express');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const cors = require('cors');

puppeteer.use(StealthPlugin()); // Enable stealth mode

const app = express();
app.use(cors());

const PORT = process.env.PORT || 3000; // Use Render's dynamic port

// Puppeteer route
app.get('/extract-iframe', async (req, res) => {
    const targetURL = req.query.url;
    if (!targetURL) return res.status(400).json({ error: "No URL provided" });

    try {
        console.log(`🌍 Opening browser for: ${targetURL}`);
        const browser = await puppeteer.launch({
            headless: "new", // New stable headless mode
            executablePath: "/opt/render/.cache/puppeteer/chrome/linux-133.0.6943.98/chrome-linux64/chrome",
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });

        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36');

        console.log("🔍 Navigating...");
        await page.goto(targetURL, { waitUntil: 'domcontentloaded', timeout: 30000 });

        console.log("🔍 Extracting iframe...");
        const iframeSrc = await page.evaluate(() => {
            let iframe = document.querySelector("iframe") || document.querySelector("embed") || document.querySelector("video");
            return iframe ? iframe.src : null;
        });

        await browser.close();

        if (iframeSrc) {
            console.log("✅ Iframe found:", iframeSrc);
            res.json({ iframe: iframeSrc });
        } else {
            console.log("❌ No iframe found.");
            res.status(404).json({ error: "No iframe found on the page" });
        }

    } catch (error) {
        console.error("🚨 Error:", error.message);
        res.status(500).json({ error: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`✅ Server running on port ${PORT}`);
});

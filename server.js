const express = require('express');
const fs = require('fs');
const https = require('https');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const cors = require('cors');

puppeteer.use(StealthPlugin());

const app = express();

// ✅ CORS settings
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");

    if (req.headers['x-forwarded-proto'] !== 'https' && process.env.NODE_ENV === 'production') {
        return res.redirect(`https://${req.headers.host}${req.url}`);
    }

    if (req.method === "OPTIONS") return res.sendStatus(204);
    next();
});

const PORT = process.env.PORT || 3000;

app.get('/extract-iframe', async (req, res) => {
    const targetURL = req.query.url;
    if (!targetURL) return res.status(400).json({ error: "No URL provided" });

    try {
        console.log(`🌍 Opening browser for: ${targetURL}`);

  const browser = await puppeteer.launch({
    headless: true,
    executablePath: '/opt/render/project/.cache/puppeteer/chrome/linux-<version>/chrome-linux64/chrome',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });



        const page = await browser.newPage();

        // ✅ Use a Safari User-Agent to bypass Cloudflare blocks
        await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 13_4_1) AppleWebKit/537.36 (KHTML, like Gecko) Version/16.4 Safari/537.36');

        // ✅ Add Headers to mimic real Safari requests
        await page.setExtraHTTPHeaders({
            'Accept-Language': 'en-US,en;q=0.9',
            'DNT': '1', // Do Not Track
            'Upgrade-Insecure-Requests': '1'
        });

        // ✅ Bypass bot detection
        await page.evaluateOnNewDocument(() => {
            Object.defineProperty(navigator, 'webdriver', { get: () => false });
        });

        console.log("🔍 Navigating...");
        await page.goto(targetURL, { waitUntil: 'networkidle2', timeout: 60000 });

        console.log("🔍 Extracting iframe...");
        const iframeSrc = await page.evaluate(() => {
            return [...document.querySelectorAll("iframe, embed, video")].map(e => e.src).filter(src => src);
        });

        console.log("🔍 Found Iframes:", iframeSrc);

        await browser.close();

        if (iframeSrc.length > 0) {
            console.log("✅ Iframe found:", iframeSrc[0]);
            res.json({ iframe: iframeSrc[0] });
        } else {
            console.log("❌ No iframe found.");
            res.status(404).json({ error: "No iframe found on the page" });
        }

    } catch (error) {
        console.error("🚨 Error:", error.message);
        res.status(500).json({ error: error.message });
    }
});

// ✅ Enable HTTPS if certs exist
if (fs.existsSync('./cert.pem') && fs.existsSync('./key.pem')) {
    const httpsOptions = {
        key: fs.readFileSync('./key.pem'),
        cert: fs.readFileSync('./cert.pem')
    };

    https.createServer(httpsOptions, app).listen(3001, () => {
        console.log("✅ HTTPS Server running on port 3001");
    });
}

// ✅ Start normal HTTP server
app.listen(PORT, () => {
    console.log(`✅ HTTP Server running on port ${PORT}`);
});

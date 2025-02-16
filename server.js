const express = require('express');
const fs = require('fs');
const https = require('https');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const cors = require('cors');

puppeteer.use(StealthPlugin());

const app = express();

// ✅ Fix CORS and Force HTTPS
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
            headless: "new",
            executablePath: puppeteer.executablePath(),
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });

        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36');
        await page.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.9' });

        await page.evaluateOnNewDocument(() => {
            Object.defineProperty(navigator, 'webdriver', { get: () => false });
        });

        console.log("🔍 Navigating...");
        await page.goto(targetURL, { waitUntil: 'networkidle2', timeout: 60000 });

        // Debug: Print full page HTML
        const pageContent = await page.content();
        console.log("📄 Full Page HTML:\n", pageContent);

        console.log("🔍 Extracting iframe...");
        const iframeSrc = await page.evaluate(() => {
            function getAllIframes() {
                return [...document.querySelectorAll("iframe, embed, video")].map(e => e.src).filter(src => src);
            }

            return new Promise((resolve) => {
                const checkForIframe = () => {
                    const iframes = getAllIframes();
                    if (iframes.length > 0) {
                        resolve(iframes[0]);
                    } else {
                        setTimeout(checkForIframe, 1000);
                    }
                };
                checkForIframe();
            });
        });

        console.log("🔍 Found Iframes:", iframeSrc);

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

// ✅ Enable HTTPS
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

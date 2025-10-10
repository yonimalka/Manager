const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');
const handlebars = require('handlebars');
global.ReadableStream = require('web-streams-polyfill/ponyfill').ReadableStream;

// Register Handlebars helpers
handlebars.registerHelper('json', ctx => JSON.stringify(ctx, null, 2));
handlebars.registerHelper('calcTotal', i => i.qty * i.unitPrice);

// Load your Handlebars template
const tplSrc = fs.readFileSync(path.join('templates', 'quote.hbs'), 'utf8');
const template = handlebars.compile(tplSrc);

async function jsonToPdf(quoteObj) {
  try {
    // 1️⃣ Build HTML from Handlebars
    const html = template({
      ...quoteObj,
      // Include your logo URL or base64 if needed
      // logo: 'https://yourcdn.com/logo.png'
    });

    // 2️⃣ Save HTML (optional, for debugging)
    fs.writeFileSync(path.join(__dirname, 'Quote.html'), html);

    // 3️⃣ Launch Puppeteer with safe flags for Render
    const browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--single-process',
        '--no-zygote'
      ],
    });

    const page = await browser.newPage();

    // 4️⃣ Set content as data URL (keeps inline styles)
    const base64 = Buffer.from(html, 'utf8').toString('base64');
    const dataUrl = 'data:text/html;base64,' + base64;
    await page.goto(dataUrl, { waitUntil: 'networkidle0' });

    // 5️⃣ RTL / Hebrew support (optional, only if needed)
    await page.evaluate(() => {
      document.body.style.direction = 'rtl';
      document.body.style.fontFamily = 'Arial, Helvetica, sans-serif';
    });

    // 6️⃣ Optional: log rendered page size
    const dim = await page.evaluate(() => ({ w: document.body.scrollWidth, h: document.body.scrollHeight }));
    console.log('Rendered size (px):', dim);

    // 7️⃣ Generate PDF
    const pdfBuf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: 36, right: 36, bottom: 48, left: 36 },
    });

    // 8️⃣ Save PDF locally (optional)
    fs.writeFileSync(path.join(__dirname, 'lastQuote.pdf'), pdfBuf);
    console.log('PDF buffer length:', pdfBuf.length);

    await browser.close();
    return pdfBuf;

  } catch (err) {
    console.error('Quote generation error:', err);
    throw err;
  }
}

module.exports = { jsonToPdf };


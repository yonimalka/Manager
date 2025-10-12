const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer'); // full puppeteer
const handlebars = require('handlebars');
global.ReadableStream = require('web-streams-polyfill/ponyfill').ReadableStream;

// -------------------- Handlebars helpers --------------------
handlebars.registerHelper('json', ctx => JSON.stringify(ctx, null, 2));
handlebars.registerHelper('calcTotal', i => i.qty * i.unitPrice);

// -------------------- Load template --------------------
const tplSrc = fs.readFileSync(path.join('templates', 'quote.hbs'), 'utf8');
const template = handlebars.compile(tplSrc);

async function jsonToPdf(quoteObj) {
  try {
    // 1️⃣ Generate HTML
    const html = template({
      ...quoteObj,
      // logo: 'https://yourcdn.com/logo.png' // optional
    });

    // Optional: save HTML for debugging
    fs.writeFileSync(path.join(__dirname, 'Quote.html'), html);

    // 2️⃣ Launch Puppeteer (Render-safe)
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();

    // 3️⃣ Load HTML as data URL
    const base64 = Buffer.from(html, 'utf8').toString('base64');
    const dataUrl = 'data:text/html;base64,' + base64;
    await page.goto(dataUrl, { waitUntil: 'networkidle0' });

    // 4️⃣ Apply RTL / Hebrew styles
    await page.evaluate(() => {
      document.body.style.direction = 'rtl';
      document.body.style.fontFamily = 'Arial, Helvetica, sans-serif';
    });

    // 5️⃣ Log page size (optional)
    const dim = await page.evaluate(() => ({ w: document.body.scrollWidth, h: document.body.scrollHeight }));
    console.log('Rendered size (px):', dim);

    // 6️⃣ Generate PDF
    const pdfBuf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: 36, right: 36, bottom: 48, left: 36 }
    });

    // Optional: save PDF locally for debugging
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

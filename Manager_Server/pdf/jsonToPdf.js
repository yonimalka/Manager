const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core'); // if using puppeteer-core
const handlebars = require('handlebars');
global.ReadableStream = require('web-streams-polyfill/ponyfill').ReadableStream;

// Handlebars helpers
handlebars.registerHelper('json', ctx => JSON.stringify(ctx, null, 2));
handlebars.registerHelper('calcTotal', i => i.qty * i.unitPrice);

const tplSrc = fs.readFileSync(path.join('templates', 'quote.hbs'), 'utf8');
const template = handlebars.compile(tplSrc);

async function jsonToPdf(quoteObj) {
  try {
    const html = template({ ...quoteObj });
    fs.writeFileSync(path.join(__dirname, 'Quote.html'), html);

    // 🔑 Pass full path to Chromium installed by Puppeteer
    const chromiumPath = '/opt/render/.cache/puppeteer/chrome/linux-141.0.7390.76/chrome-linux64/chrome';

    const browser = await puppeteer.launch({
      headless: true,
      executablePath: chromiumPath,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();

    const base64 = Buffer.from(html, 'utf8').toString('base64');
    const dataUrl = 'data:text/html;base64,' + base64;
    await page.goto(dataUrl, { waitUntil: 'networkidle0' });

    await page.evaluate(() => {
      document.body.style.direction = 'rtl';
      document.body.style.fontFamily = 'Arial, Helvetica, sans-serif';
    });

    const dim = await page.evaluate(() => ({
      w: document.body.scrollWidth,
      h: document.body.scrollHeight
    }));
    console.log('Rendered size (px):', dim);

    const pdfBuf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: 36, right: 36, bottom: 48, left: 36 }
    });

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

const fs         = require('fs');
const path       = require('path');
const handlebars = require('handlebars');
const puppeteer  = require('puppeteer');
handlebars.registerHelper('json', ctx =>
  JSON.stringify(ctx, null, 2)
);
handlebars.registerHelper('calcTotal', i => i.qty * i.unitPrice);

const tplSrc   = fs.readFileSync(path.join('templates', 'quote.hbs'), 'utf8');
const template = handlebars.compile(tplSrc);

async function jsonToPdf(quoteObj) {
  /* 1 – build HTML --------------------------------- */
  const html = template({
    ...quoteObj,
    // logo: 'https://yourcdn.com/logo.png'   // use https URL or base64 image
  });
 const test = fs.writeFileSync('Quote.html', html);
  // console.log('Generated HTML:', html);
  /* 2 – embed HTML as data: URL -------------------- */
  const base64 = Buffer.from(html, 'utf8').toString('base64');
  const dataUrl = 'data:text/html;base64,' + base64;

  /* 3 – launch Chrome, wait for full render -------- */
  const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
  const page    = await browser.newPage();
  await page.goto(dataUrl, { waitUntil: 'networkidle0' });

  /* 4 – optional sanity: log page size */
  const dim = await page.evaluate(() => ({ w: document.body.scrollWidth, h: document.body.scrollHeight }));
  console.log('Rendered size (px):', dim);

  /* 5 – create PDF --------------------------------- */
  const pdfBuf = await page.pdf({
    format: 'A4',
    margin: { right: 36, bottom: 48, left: 36 },
    // scale: 2, 
    printBackground: true
  });
  fs.writeFileSync(path.join(__dirname, 'lastQuote.pdf'), pdfBuf);
  // await page.setViewport({ width: 1000, height: 1414, deviceScaleFactor: 2 });
  console.log('pdfBuf length:', pdfBuf.length);   // should be well > 0

  await browser.close();
  return pdfBuf;
}

module.exports = { jsonToPdf };

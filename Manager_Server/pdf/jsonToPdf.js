const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

async function jsonToPdf(quote) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margin: 40,
        info: {
          Title: `Quote - ${quote.header.client}`,
          Author: quote.header.company,
        },
      });

      const buffers = [];
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', reject);

      // === HEADER ===
      doc
        .fontSize(20)
        .fillColor('#2c3e50')
        .text(quote.header.company, { align: 'center' })
        .moveDown(0.3);

      doc
        .fontSize(10)
        .fillColor('#555')
        .text(`Quote No: ${quote.header.quoteNo}`, { align: 'center' })
        .text(`Date: ${quote.header.date}`, { align: 'center' })
        .text(`Phone: ${quote.header.phoneNumber || 'N/A'}`, { align: 'center' })
        .moveDown(1.5);

      // === CLIENT ===
      doc
        .fontSize(14)
        .fillColor('#000')
        .text(`Client: ${quote.header.client}`, { align: 'left' })
        .moveDown(0.5);

      // === PROJECT TITLE ===
      doc
        .fontSize(16)
        .fillColor('#1a5276')
        .text(quote.projectTitle, { align: 'left', underline: true })
        .moveDown(0.5);

      // === DETAILS ===
      if (quote.details) {
        doc
          .fontSize(12)
          .fillColor('#000')
          .text(quote.details, { align: 'justify' })
          .moveDown(1);
      }

      // === ITEMS TABLE ===
      if (quote.items && quote.items.length > 0) {
        doc
          .fontSize(14)
          .fillColor('#2e86c1')
          .text('Project Breakdown:', { underline: true })
          .moveDown(0.5);

        const tableTop = doc.y;
        const itemSpacing = 20;

        // table headers
        doc
          .fontSize(12)
          .fillColor('#000')
          .text('Description', 50, tableTop)
          .text('Qty', 300, tableTop)
          .text('Unit', 350, tableTop)
          .text('Unit Price', 420, tableTop)
          .text('Total', 510, tableTop);

        doc.moveDown(0.3);
        doc.moveTo(40, doc.y).lineTo(560, doc.y).strokeColor('#ccc').stroke();

        // table rows
        quote.items.forEach((item, i) => {
          const y = tableTop + (i + 1) * itemSpacing + 10;
          doc
            .fontSize(11)
            .fillColor('#000')
            .text(item.desc, 50, y)
            .text(item.qty, 300, y)
            .text(item.unit, 350, y)
            .text(item.unitPrice.toFixed(2), 420, y)
            .text((item.qty * item.unitPrice).toFixed(2), 510, y);
        });

        doc.moveDown(1);
      }

      // === TOTALS ===
      if (quote.totals) {
        const { sub, vat, grand } = quote.totals;
        doc
          .fontSize(13)
          .fillColor('#000')
          .text(`Subtotal: ${sub.toFixed(2)} ₪`, { align: 'right' })
          .text(`VAT (18%): ${vat.toFixed(2)} ₪`, { align: 'right' })
          .moveDown(0.2)
          .font('Helvetica-Bold')
          .text(`Grand Total: ${grand.toFixed(2)} ₪`, { align: 'right' })
          .font('Helvetica')
          .moveDown(1);
      }

      // === PAYMENT TERMS ===
      if (quote.paymentTerms) {
        doc
          .fontSize(12)
          .fillColor('#2e4053')
          .text(`Payment Terms: ${quote.paymentTerms}`, { align: 'left' })
          .moveDown(1);
      }

      // === FOOTER ===
      doc
        .fontSize(10)
        .fillColor('#aaa')
        .text(`Generated automatically by ${quote.header.company}`, {
          align: 'center',
          valign: 'bottom',
        });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

module.exports = { jsonToPdf };

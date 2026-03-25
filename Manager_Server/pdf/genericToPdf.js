const puppeteer = require("puppeteer");

/**
 * Generic PDF generator.
 * @param {{ title, subtitle, businessName, sections: Array<{ heading, content, table?: { headers, rows } }> }} data
 * @returns {Promise<Buffer>}
 */
async function genericToPdf({ title = "Report", subtitle = "", businessName = "", sections = [] }) {
  const date = new Date().toLocaleDateString("en-US", {
    year: "numeric", month: "long", day: "numeric",
  });

  const sectionsHtml = sections.map((sec) => {
    if (!sec) return "";
    let html = `<div class="section">`;
    if (sec.heading) html += `<h2 class="section-title">${esc(sec.heading)}</h2>`;
    if (sec.content) {
      html += `<p class="section-text">${esc(sec.content).replace(/\n/g, "<br/>")}</p>`;
    }

    if (sec.table?.headers?.length) {
      const rows = sec.table.rows || [];
      html += `
        <table>
          <thead>
            <tr>${sec.table.headers.map((h) => `<th>${esc(h)}</th>`).join("")}</tr>
          </thead>
          <tbody>
            ${rows.map((row, i) => `
              <tr class="${i % 2 === 1 ? "alt" : ""}">
                ${row.map((cell) => `<td>${esc(String(cell ?? ""))}</td>`).join("")}
              </tr>`).join("")}
          </tbody>
          ${rows.length > 2 ? `
          <tfoot>
            <tr>
              ${sec.table.headers.map((h, idx) => {
                if (idx === 0) return `<td class="total-label">TOTAL</td>`;
                const col = rows.map((r) => parseFloat(String(r[idx] || "0").replace(/,/g, "")) || 0);
                const allNum = col.every((v) => !isNaN(v));
                const sum = col.reduce((a, b) => a + b, 0);
                return allNum && sum !== 0
                  ? `<td class="total-val">${sum.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>`
                  : `<td></td>`;
              }).join("")}
            </tr>
          </tfoot>` : ""}
        </table>`;
    }

    html += `</div>`;
    return html;
  }).join("");

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <style>
    @page { size: A4; margin: 0; }
    * { margin:0; padding:0; box-sizing:border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif;
      background: #fff;
      color: #0F172A;
      padding: 48px 52px;
      font-size: 13px;
      line-height: 1.5;
    }

    /* ── Header ── */
    .doc-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 3px solid #1D4ED8;
      padding-bottom: 20px;
      margin-bottom: 36px;
    }
    .doc-header-left h1 {
      font-size: 26px;
      font-weight: 800;
      color: #0F172A;
      letter-spacing: -0.5px;
    }
    .doc-header-left .subtitle {
      font-size: 13px;
      color: #64748B;
      margin-top: 5px;
    }
    .doc-header-left .biz {
      font-size: 12px;
      color: #94A3B8;
      margin-top: 3px;
    }
    .doc-header-right {
      text-align: right;
    }
    .doc-header-right .date-badge {
      background: #EFF6FF;
      border: 1px solid #BFDBFE;
      border-radius: 8px;
      padding: 6px 14px;
      font-size: 12px;
      color: #1D4ED8;
      font-weight: 600;
    }

    /* ── Sections ── */
    .section { margin-bottom: 30px; }
    .section-title {
      font-size: 14px;
      font-weight: 700;
      color: #1D4ED8;
      border-bottom: 1.5px solid #BFDBFE;
      padding-bottom: 7px;
      margin-bottom: 14px;
      text-transform: uppercase;
      letter-spacing: 0.4px;
    }
    .section-text {
      font-size: 13px;
      color: #334155;
      line-height: 1.75;
      margin-bottom: 14px;
    }

    /* ── Table ── */
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 6px;
      font-size: 12px;
    }
    thead tr {
      background: #1D4ED8;
    }
    thead th {
      color: #fff;
      font-weight: 700;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      padding: 10px 12px;
      text-align: left;
    }
    tbody tr td {
      padding: 9px 12px;
      color: #1E293B;
      border-bottom: 1px solid #F1F5F9;
    }
    tbody tr.alt td { background: #F8FAFC; }
    tfoot tr td {
      padding: 10px 12px;
      background: #DBEAFE;
      font-weight: 700;
      font-size: 12px;
      color: #1E3A5F;
      border-top: 2px solid #1D4ED8;
    }
    td.total-label { color: #1E3A5F; }
    td.total-val { text-align: right; }

    /* ── Footer ── */
    .doc-footer {
      margin-top: 44px;
      padding-top: 14px;
      border-top: 1px solid #E2E8F0;
      display: flex;
      justify-content: space-between;
    }
    .doc-footer p { font-size: 10px; color: #94A3B8; }
  </style>
</head>
<body>
  <div class="doc-header">
    <div class="doc-header-left">
      <h1>${esc(title)}</h1>
      ${subtitle ? `<div class="subtitle">${esc(subtitle)}</div>` : ""}
      ${businessName ? `<div class="biz">${esc(businessName)}</div>` : ""}
    </div>
    <div class="doc-header-right">
      <div class="date-badge">${date}</div>
    </div>
  </div>

  ${sectionsHtml || "<p style='color:#94A3B8;font-style:italic'>No content available.</p>"}

  <div class="doc-footer">
    <p>Maggo — Business Management</p>
    <p>Generated by AI Assistant · ${date}</p>
  </div>
</body>
</html>`;

  const browser = await puppeteer.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--single-process",
      "--no-zygote",
    ],
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });
    const buf = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "0", right: "0", bottom: "0", left: "0" },
    });
    return buf;
  } finally {
    await browser.close();
  }
}

function esc(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

module.exports = { genericToPdf };

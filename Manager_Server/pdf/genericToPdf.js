const puppeteer = require("puppeteer");

/**
 * Professional finance-grade PDF generator.
 * @param {{ title, subtitle, businessName, sections: Array<{ heading, content, table?: { headers, rows } }> }} data
 * @returns {Promise<Buffer>}
 */
async function genericToPdf({ title = "Report", subtitle = "", businessName = "", sections = [] }) {
  const date = new Date().toLocaleDateString("en-US", {
    year: "numeric", month: "long", day: "numeric",
  });
  const year = new Date().getFullYear();

  // Detect KPI-style sections (single-row tables with 2–4 columns = summary cards)
  const kpiSection = sections.find(
    (s) => s.table?.rows?.length === 1 && s.table.headers.length >= 2 && s.table.headers.length <= 5
  );
  const mainSections = sections.filter((s) => s !== kpiSection);

  const kpiHtml = kpiSection
    ? `<div class="kpi-row">
        ${kpiSection.table.headers.map((h, i) => {
          const val = kpiSection.table.rows[0]?.[i] ?? "";
          const isNeg = String(val).includes("-") || String(val).startsWith("(");
          return `<div class="kpi-card">
            <div class="kpi-label">${esc(h)}</div>
            <div class="kpi-value ${isNeg ? "neg" : ""}">${esc(String(val))}</div>
          </div>`;
        }).join("")}
      </div>`
    : "";

  const sectionsHtml = mainSections.map((sec) => {
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
                ${row.map((cell, ci) => {
                  const s = String(cell ?? "");
                  const header = (sec.table.headers[ci] || "").toLowerCase();
                  const isNum = /^-?[\d,]+(\.\d+)?$/.test(s.trim());
                  const isCurr = isNum && /amount|price|value|total|paid|outstanding|cost|revenue|income|expense|profit|loss|balance|fee|salary/.test(header);
                  const isNeg = isCurr && (parseFloat(s.replace(/,/g, "")) < 0 || s.startsWith("("));
                  const isPos = isCurr && parseFloat(s.replace(/,/g, "")) > 0 && !isNeg;
                  let cls = "";
                  if (isNeg) cls = "num neg";
                  else if (isPos) cls = "num pos";
                  else if (isNum) cls = "num";
                  return `<td class="${cls}">${esc(s)}</td>`;
                }).join("")}
              </tr>`).join("")}
          </tbody>
          ${rows.length >= 2 ? `
          <tfoot>
            <tr>
              ${sec.table.headers.map((h, idx) => {
                if (idx === 0) return `<td class="total-label">TOTAL</td>`;
                const col = rows.map((r) => parseFloat(String(r[idx] || "0").replace(/[,()]/g, "")) || 0);
                const allNum = rows.every((r) => /^-?[\d,()]+(\.\d+)?$/.test(String(r[idx] ?? "").trim()));
                const sum = col.reduce((a, b) => a + b, 0);
                const isNeg = sum < 0;
                return allNum && sum !== 0
                  ? `<td class="total-val ${isNeg ? "neg" : "pos"}">${sum < 0 ? "(" : ""}${Math.abs(sum).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}${sum < 0 ? ")" : ""}</td>`
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
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
    @page { size: A4; margin: 0; }
    * { margin:0; padding:0; box-sizing:border-box; }

    body {
      font-family: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif;
      background: #fff;
      color: #0F172A;
      font-size: 12.5px;
      line-height: 1.55;
    }

    /* ── Cover band ── */
    .cover-band {
      background: linear-gradient(135deg, #0F2557 0%, #1D4ED8 100%);
      padding: 36px 52px 30px;
      color: #fff;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
    }
    .cover-title {
      font-size: 26px;
      font-weight: 800;
      letter-spacing: -0.5px;
      line-height: 1.1;
      color: #fff;
    }
    .cover-subtitle {
      font-size: 13px;
      color: rgba(255,255,255,0.75);
      margin-top: 5px;
    }
    .cover-biz {
      font-size: 11.5px;
      color: rgba(255,255,255,0.55);
      margin-top: 3px;
    }
    .cover-meta {
      text-align: right;
    }
    .cover-meta .date-chip {
      background: rgba(255,255,255,0.18);
      border: 1px solid rgba(255,255,255,0.3);
      border-radius: 6px;
      padding: 5px 13px;
      font-size: 11.5px;
      font-weight: 600;
      color: #fff;
    }
    .cover-meta .confidential {
      font-size: 9.5px;
      color: rgba(255,255,255,0.45);
      margin-top: 7px;
      text-transform: uppercase;
      letter-spacing: 0.8px;
    }

    /* ── Content wrapper ── */
    .content {
      padding: 28px 52px 48px;
    }

    /* ── KPI cards ── */
    .kpi-row {
      display: flex;
      gap: 14px;
      margin-bottom: 28px;
    }
    .kpi-card {
      flex: 1;
      background: #F0F6FF;
      border: 1px solid #BFDBFE;
      border-radius: 10px;
      padding: 14px 16px;
    }
    .kpi-label {
      font-size: 10px;
      font-weight: 600;
      color: #64748B;
      text-transform: uppercase;
      letter-spacing: 0.6px;
      margin-bottom: 5px;
    }
    .kpi-value {
      font-size: 19px;
      font-weight: 800;
      color: #0F2557;
      letter-spacing: -0.5px;
    }
    .kpi-value.neg { color: #DC2626; }

    /* ── Section ── */
    .section { margin-bottom: 28px; }
    .section-title {
      font-size: 11px;
      font-weight: 700;
      color: #1D4ED8;
      border-bottom: 1.5px solid #DBEAFE;
      padding-bottom: 6px;
      margin-bottom: 13px;
      text-transform: uppercase;
      letter-spacing: 0.7px;
    }
    .section-text {
      font-size: 12.5px;
      color: #334155;
      line-height: 1.8;
      margin-bottom: 13px;
    }

    /* ── Table ── */
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 4px;
      font-size: 11.5px;
    }
    thead tr { background: #0F2557; }
    thead th {
      color: #fff;
      font-weight: 700;
      font-size: 10.5px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      padding: 9px 12px;
      text-align: left;
    }
    thead th:not(:first-child) { text-align: right; }

    tbody tr td {
      padding: 8px 12px;
      color: #1E293B;
      border-bottom: 1px solid #F1F5F9;
      vertical-align: middle;
    }
    tbody tr td.num { text-align: right; font-variant-numeric: tabular-nums; }
    tbody tr td.neg { color: #DC2626; font-weight: 600; }
    tbody tr td.pos { color: #15803D; }
    tbody tr.alt td { background: #F8FAFC; }

    tfoot tr td {
      padding: 9px 12px;
      background: #EFF6FF;
      font-weight: 700;
      font-size: 11.5px;
      color: #0F2557;
      border-top: 2px solid #1D4ED8;
    }
    td.total-label { font-weight: 700; color: #0F2557; }
    td.total-val {
      text-align: right;
      font-variant-numeric: tabular-nums;
      font-weight: 800;
    }
    td.total-val.neg { color: #DC2626; }
    td.total-val.pos { color: #15803D; }

    /* ── Footer ── */
    .doc-footer {
      margin-top: 40px;
      padding: 12px 52px 18px;
      border-top: 1px solid #E2E8F0;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .doc-footer p { font-size: 9.5px; color: #94A3B8; }
    .doc-footer .brand { font-weight: 700; color: #64748B; font-size: 10px; }
  </style>
</head>
<body>
  <div class="cover-band">
    <div>
      <div class="cover-title">${esc(title)}</div>
      ${subtitle ? `<div class="cover-subtitle">${esc(subtitle)}</div>` : ""}
      ${businessName ? `<div class="cover-biz">${esc(businessName)}</div>` : ""}
    </div>
    <div class="cover-meta">
      <div class="date-chip">${date}</div>
      <div class="confidential">Confidential</div>
    </div>
  </div>

  <div class="content">
    ${kpiHtml}
    ${sectionsHtml || "<p style='color:#94A3B8;font-style:italic;padding:20px 0'>No content available.</p>"}
  </div>

  <div class="doc-footer">
    <p class="brand">Maggo · Business Management</p>
    <p>Generated by AI Financial Assistant · ${date} · Confidential</p>
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

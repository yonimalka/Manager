const ExcelJS = require("exceljs");

/**
 * Professional finance-grade Excel generator.
 * @param {{ title: string, sheets: Array<{ name: string, headers: string[], rows: any[][] }> }} data
 * @returns {Promise<Buffer>}
 */
async function genericToExcel({ title = "Report", sheets = [] }) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Maggo";
  workbook.created = new Date();
  workbook.properties.date1904 = false;

  const NAVY   = "FF0F2557";
  const BLUE   = "FF1D4ED8";
  const LBLUE  = "FFdbeafe";
  const XLIGHT = "FFF0F6FF";
  const WHITE  = "FFFFFFFF";
  const DARK   = "FF1E293B";
  const MID    = "FF475569";
  const LIGHT  = "FFF8FAFC";
  const BORDER = "FFE2E8F0";
  const GREEN  = "FF15803D";
  const RED    = "FFDC2626";
  const GBG    = "FFF0FDF4";
  const RBG    = "FFFEF2F2";

  const CURRENCY_KEYWORDS = /amount|price|value|total|paid|outstanding|cost|revenue|income|expense|profit|loss|balance|fee|salary|rate|budget|forecast/i;
  const DATE_KEYWORDS = /date|day|month|period|time/i;

  for (const sheetDef of sheets) {
    const sheet = workbook.addWorksheet(sheetDef.name || "Sheet", {
      pageSetup: {
        paperSize: 9,
        orientation: "landscape",
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: 0,
        margins: { left: 0.5, right: 0.5, top: 0.75, bottom: 0.75, header: 0.3, footer: 0.3 },
      },
      headerFooter: {
        oddFooter: `&L&8Maggo · Business Management&C&8${title} — ${sheetDef.name}&R&8Page &P of &N · Confidential`,
      },
    });

    const headers = sheetDef.headers || [];
    const rows = sheetDef.rows || [];
    const colCount = Math.max(headers.length, 1);

    // ── Row 1: Title band ──────────────────────────────────────────────────
    sheet.addRow([""]);
    const titleRow = sheet.getRow(1);
    titleRow.height = 40;
    sheet.mergeCells(1, 1, 1, colCount);
    const tc = titleRow.getCell(1);
    tc.value = `${title}  ·  ${sheetDef.name}`;
    tc.font = { bold: true, size: 16, color: { argb: WHITE }, name: "Calibri" };
    tc.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } };
    tc.alignment = { vertical: "middle", horizontal: "left", indent: 2 };

    // ── Row 2: Subtitle/date ───────────────────────────────────────────────
    sheet.addRow([""]);
    const dateRow = sheet.getRow(2);
    dateRow.height = 22;
    sheet.mergeCells(2, 1, 2, colCount);
    const dc = dateRow.getCell(1);
    dc.value = `Generated: ${new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}  ·  Confidential`;
    dc.font = { size: 10, color: { argb: MID }, italic: true, name: "Calibri" };
    dc.fill = { type: "pattern", pattern: "solid", fgColor: { argb: XLIGHT } };
    dc.alignment = { vertical: "middle", horizontal: "left", indent: 2 };

    // ── Row 3: Spacer ──────────────────────────────────────────────────────
    const spacer = sheet.addRow([""]);
    spacer.height = 8;
    sheet.mergeCells(3, 1, 3, colCount);
    spacer.getCell(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: XLIGHT } };

    // ── Row 4: Column headers ──────────────────────────────────────────────
    const headerRow = sheet.addRow(headers);
    headerRow.height = 32;
    headers.forEach((h, idx) => {
      const cell = headerRow.getCell(idx + 1);
      cell.value = h;
      cell.font = { bold: true, size: 11, color: { argb: WHITE }, name: "Calibri" };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BLUE } };
      cell.alignment = {
        vertical: "middle",
        horizontal: CURRENCY_KEYWORDS.test(h) ? "right" : "left",
        wrapText: false,
        indent: 1,
      };
      cell.border = {
        top:    { style: "thin",   color: { argb: NAVY } },
        bottom: { style: "medium", color: { argb: NAVY } },
        left:   { style: "thin",   color: { argb: NAVY } },
        right:  { style: "thin",   color: { argb: NAVY } },
      };
    });

    // ── Rows 5+: Data ──────────────────────────────────────────────────────
    rows.forEach((rowData, i) => {
      const row = sheet.addRow(rowData);
      row.height = 22;
      const isAlt = i % 2 === 1;

      headers.forEach((h, idx) => {
        const cell = row.getCell(idx + 1);
        const raw = rowData[idx];
        const isCurr = CURRENCY_KEYWORDS.test(h);
        const isDate = DATE_KEYWORDS.test(h);
        const rawStr = String(raw ?? "").trim();
        const numVal = parseFloat(rawStr.replace(/[,()]/g, ""));
        const isNum  = !isNaN(numVal) && rawStr !== "" && !isDate;
        const isNeg  = isCurr && isNum && numVal < 0;
        const isPos  = isCurr && isNum && numVal > 0;

        // Value
        if (isCurr && isNum) {
          cell.value = numVal;
          cell.numFmt = numVal < 0 ? '(#,##0.00)' : '#,##0.00';
        } else if (isNum && !isCurr) {
          cell.value = numVal;
          cell.numFmt = '#,##0.##';
        } else {
          cell.value = raw ?? "";
        }

        // Style
        cell.font = {
          size: 11,
          color: { argb: isNeg ? RED : DARK },
          name: "Calibri",
          bold: isNeg || isPos ? false : false,
        };
        cell.fill = {
          type: "pattern", pattern: "solid",
          fgColor: { argb: isNeg ? RBG : isPos ? (isAlt ? GBG : GBG) : (isAlt ? LIGHT : WHITE) },
        };
        cell.alignment = {
          horizontal: (isCurr || (isNum && !isDate)) ? "right" : "left",
          vertical: "middle",
          indent: 1,
        };
        cell.border = {
          top:    { style: "hair",  color: { argb: BORDER } },
          bottom: { style: "hair",  color: { argb: BORDER } },
          left:   { style: "thin",  color: { argb: BORDER } },
          right:  { style: "thin",  color: { argb: BORDER } },
        };
      });
    });

    // ── Totals row ─────────────────────────────────────────────────────────
    if (rows.length >= 2) {
      const totals = headers.map((h, idx) => {
        if (idx === 0) return "TOTAL";
        const col = rows.map((r) => parseFloat(String(r[idx] ?? "").replace(/[,()]/g, "")) || 0);
        const allNum = rows.every((r) => /^-?[\d,().]+$/.test(String(r[idx] ?? "").trim()));
        return allNum && col.some((v) => v !== 0) ? col.reduce((a, b) => a + b, 0) : "";
      });

      const totRow = sheet.addRow(totals);
      totRow.height = 28;
      headers.forEach((h, idx) => {
        const cell = totRow.getCell(idx + 1);
        const val = totals[idx];
        const isCurr = CURRENCY_KEYWORDS.test(h);
        const isNeg = typeof val === "number" && val < 0;

        if (typeof val === "number") {
          cell.numFmt = val < 0 ? '(#,##0.00)' : '#,##0.00';
        }

        cell.font = {
          bold: true, size: 11.5,
          color: { argb: isNeg ? RED : NAVY },
          name: "Calibri",
        };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: LBLUE } };
        cell.alignment = {
          horizontal: idx === 0 ? "left" : (typeof val === "number" ? "right" : "left"),
          vertical: "middle",
          indent: 1,
        };
        cell.border = {
          top:    { style: "medium", color: { argb: BLUE } },
          bottom: { style: "medium", color: { argb: BLUE } },
          left:   { style: "thin",   color: { argb: BORDER } },
          right:  { style: "thin",   color: { argb: BORDER } },
        };
      });
    }

    // ── Column widths ──────────────────────────────────────────────────────
    headers.forEach((h, idx) => {
      const col = sheet.getColumn(idx + 1);
      const allVals = [h, ...rows.map((r) => String(r[idx] ?? ""))];
      const maxLen = Math.max(...allVals.map((v) => String(v).length));
      col.width = Math.min(Math.max(maxLen + 6, 14), 48);
    });

    // ── Auto-filter on header row ──────────────────────────────────────────
    sheet.autoFilter = {
      from: { row: 4, column: 1 },
      to:   { row: 4, column: colCount },
    };

    // ── Freeze: title + date + spacer + header ─────────────────────────────
    sheet.views = [{ state: "frozen", ySplit: 4, xSplit: 0 }];

    // ── Tab color ─────────────────────────────────────────────────────────
    sheet.properties.tabColor = { argb: BLUE };
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return buffer;
}

module.exports = { genericToExcel };

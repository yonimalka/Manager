const ExcelJS = require("exceljs");

/**
 * Generic Excel generator.
 * @param {{ title: string, sheets: Array<{ name: string, headers: string[], rows: any[][] }> }} data
 * @returns {Promise<Buffer>}
 */
async function genericToExcel({ title = "Report", sheets = [] }) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Maggo";
  workbook.created = new Date();

  for (const sheetDef of sheets) {
    const sheet = workbook.addWorksheet(sheetDef.name || "Sheet", {
      pageSetup: { paperSize: 9, orientation: "landscape", fitToPage: true },
    });

    const headers = sheetDef.headers || [];
    const rows = sheetDef.rows || [];
    const colCount = Math.max(headers.length, 1);

    // ── Title row ──────────────────────────────────────────────────────────
    const titleRow = sheet.addRow([`${title} — ${sheetDef.name}`]);
    sheet.mergeCells(1, 1, 1, colCount);
    titleRow.height = 36;
    const titleCell = titleRow.getCell(1);
    titleCell.value = `${title}  ·  ${sheetDef.name}`;
    titleCell.font = { bold: true, size: 16, color: { argb: "FF1E3A5F" } };
    titleCell.alignment = { vertical: "middle", horizontal: "left" };
    titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF0F6FF" } };

    // ── Generated date row ─────────────────────────────────────────────────
    const dateRow = sheet.addRow([`Generated: ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}`]);
    sheet.mergeCells(2, 1, 2, colCount);
    dateRow.height = 20;
    const dateCell = dateRow.getCell(1);
    dateCell.font = { size: 10, color: { argb: "FF64748B" }, italic: true };
    dateCell.alignment = { vertical: "middle", horizontal: "left" };

    // blank spacer
    sheet.addRow([]);

    // ── Header row ─────────────────────────────────────────────────────────
    const headerRow = sheet.addRow(headers);
    headerRow.height = 30;
    headerRow.eachCell({ includeEmpty: true }, (cell, colNum) => {
      if (colNum > colCount) return;
      cell.value = headers[colNum - 1] || "";
      cell.font = { bold: true, size: 11, color: { argb: "FFFFFFFF" } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1D4ED8" } };
      cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
      cell.border = {
        top: { style: "thin", color: { argb: "FF1E40AF" } },
        bottom: { style: "medium", color: { argb: "FF1E40AF" } },
        left: { style: "thin", color: { argb: "FF1E40AF" } },
        right: { style: "thin", color: { argb: "FF1E40AF" } },
      };
    });

    // ── Data rows ──────────────────────────────────────────────────────────
    rows.forEach((rowData, i) => {
      const row = sheet.addRow(rowData);
      row.height = 22;
      const isAlt = i % 2 === 1;

      row.eachCell({ includeEmpty: true }, (cell, colNum) => {
        if (colNum > colCount) return;

        const raw = rowData[colNum - 1];
        const header = (headers[colNum - 1] || "").toLowerCase();
        const isNumber = typeof raw === "number" || (typeof raw === "string" && /^-?[\d,]+(\.\d+)?$/.test(raw.trim()));
        const isCurrency = isNumber && (header.includes("amount") || header.includes("price") || header.includes("value") || header.includes("total") || header.includes("paid") || header.includes("outstanding") || header.includes("cost"));

        if (isCurrency) {
          cell.numFmt = '#,##0.00';
          cell.value = typeof raw === "number" ? raw : parseFloat(String(raw).replace(/,/g, "")) || 0;
          cell.alignment = { horizontal: "right", vertical: "middle" };
        } else if (isNumber && !isCurrency) {
          cell.value = typeof raw === "number" ? raw : parseFloat(String(raw).replace(/,/g, "")) || 0;
          cell.alignment = { horizontal: "right", vertical: "middle" };
        } else {
          cell.alignment = { horizontal: "left", vertical: "middle" };
        }

        cell.font = { size: 11, color: { argb: "FF1E293B" } };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: isAlt ? "FFF8FAFC" : "FFFFFFFF" } };
        cell.border = {
          top: { style: "thin", color: { argb: "FFE2E8F0" } },
          bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
          left: { style: "thin", color: { argb: "FFE2E8F0" } },
          right: { style: "thin", color: { argb: "FFE2E8F0" } },
        };
      });
    });

    // ── Totals row (if last column looks like numbers) ─────────────────────
    if (rows.length > 1) {
      const totalsRow = sheet.addRow(
        headers.map((h, idx) => {
          if (idx === 0) return "TOTAL";
          const col = rows.map((r) => parseFloat(String(r[idx] || "0").replace(/,/g, "")) || 0);
          const allNumeric = col.every((v) => !isNaN(v));
          return allNumeric && col.some((v) => v !== 0) ? col.reduce((a, b) => a + b, 0) : "";
        })
      );
      totalsRow.height = 26;
      totalsRow.eachCell({ includeEmpty: true }, (cell, colNum) => {
        if (colNum > colCount) return;
        cell.font = { bold: true, size: 11, color: { argb: "FF1E3A5F" } };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFDBEAFE" } };
        cell.border = {
          top: { style: "medium", color: { argb: "FF1D4ED8" } },
          bottom: { style: "medium", color: { argb: "FF1D4ED8" } },
          left: { style: "thin", color: { argb: "FFE2E8F0" } },
          right: { style: "thin", color: { argb: "FFE2E8F0" } },
        };
        if (typeof cell.value === "number") {
          cell.numFmt = "#,##0.00";
          cell.alignment = { horizontal: "right", vertical: "middle" };
        } else {
          cell.alignment = { horizontal: "left", vertical: "middle" };
        }
      });
    }

    // ── Column widths ──────────────────────────────────────────────────────
    headers.forEach((header, colIdx) => {
      const col = sheet.getColumn(colIdx + 1);
      const allValues = [header, ...rows.map((r) => String(r[colIdx] ?? ""))];
      const maxLen = Math.max(...allValues.map((v) => String(v).length));
      col.width = Math.min(Math.max(maxLen + 6, 14), 45);
    });

    sheet.views = [{ state: "frozen", ySplit: 4 }]; // freeze header
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return buffer;
}

module.exports = { genericToExcel };

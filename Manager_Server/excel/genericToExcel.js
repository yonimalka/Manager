const ExcelJS = require("exceljs");

/**
 * Generic Excel generator.
 * @param {Object} data
 * @param {string} data.title  - Workbook title
 * @param {Array}  data.sheets - [{ name, headers: string[], rows: [][] }]
 * @returns {Buffer}
 */
async function genericToExcel({ title = "Report", sheets = [] }) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Maggo";
  workbook.created = new Date();

  const HEADER_FILL = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1D4ED8" } };
  const HEADER_FONT = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
  const ALT_FILL = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF0F6FF" } };
  const BORDER = { style: "thin", color: { argb: "FFD1D5DB" } };
  const BORDERS = { top: BORDER, left: BORDER, bottom: BORDER, right: BORDER };

  for (const sheetDef of sheets) {
    const sheet = workbook.addWorksheet(sheetDef.name || "Sheet");

    // Header row
    const headers = sheetDef.headers || [];
    const headerRow = sheet.addRow(headers);
    headerRow.eachCell((cell) => {
      cell.fill = HEADER_FILL;
      cell.font = HEADER_FONT;
      cell.alignment = { vertical: "middle", horizontal: "center" };
      cell.border = BORDERS;
    });
    headerRow.height = 24;

    // Data rows
    const rows = sheetDef.rows || [];
    rows.forEach((rowData, i) => {
      const row = sheet.addRow(rowData);
      if (i % 2 === 1) {
        row.eachCell((cell) => { cell.fill = ALT_FILL; });
      }
      row.eachCell((cell) => {
        cell.border = BORDERS;
        cell.alignment = { vertical: "middle" };
      });
    });

    // Auto-fit columns
    headers.forEach((_, colIdx) => {
      const col = sheet.getColumn(colIdx + 1);
      let maxLen = String(headers[colIdx] || "").length;
      rows.forEach((r) => {
        const val = String(r[colIdx] ?? "");
        if (val.length > maxLen) maxLen = val.length;
      });
      col.width = Math.min(Math.max(maxLen + 4, 12), 50);
    });
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return buffer;
}

module.exports = { genericToExcel };

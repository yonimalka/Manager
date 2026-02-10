import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import * as FileSystem from "expo-file-system";

/**
 * Generate a professional, business-compliant income receipt PDF
 * @param {Object} receipt - The receipt data
 * @param {Object} userDetails - Business/user information
 * @param {Object} options - PDF generation options
 */
export async function generateIncomeReceiptPDF(receipt, userDetails, options = {}) {
  try {
    const {
      currency = "USD",
      currencySymbol = "$",
      includeImage = true,
      includeFooter = true,
      colorScheme = "blue", // blue, green, purple, gray
    } = options;

    // Format date
    const date = new Date(receipt.date || receipt.createdAt);
    const formattedDate = date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    // Generate receipt number if not provided
    const receiptNumber = receipt.receiptNumber || `REC-${Date.now().toString().slice(-8)}`;

    // Color schemes
    const colors = {
      blue: { primary: "#2563EB", secondary: "#EFF6FF", text: "#1E40AF" },
      green: { primary: "#16a34a", secondary: "#F0FDF4", text: "#15803d" },
      purple: { primary: "#9333EA", secondary: "#FAF5FF", text: "#7C3AED" },
      gray: { primary: "#374151", secondary: "#F9FAFB", text: "#1F2937" },
    };

    const theme = colors[colorScheme] || colors.blue;

    const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }

          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Helvetica', Arial, sans-serif;
            background-color: #ffffff;
            color: #1a1a1a;
            line-height: 1.6;
            padding: 40px 20px;
          }

          .container {
            max-width: 800px;
            margin: 0 auto;
            background: #ffffff;
            border: 1px solid #e5e7eb;
            border-radius: 8px;
          }

          /* Header Section */
          .header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            padding: 32px;
            border-bottom: 3px solid ${theme.primary};
          }

          .logo-section {
            flex: 1;
          }

          .logo {
            max-height: 60px;
            max-width: 200px;
            margin-bottom: 12px;
          }

          .business-name {
            font-size: 20px;
            font-weight: 700;
            color: #111827;
            margin-bottom: 4px;
          }

          .business-info {
            flex: 1;
            text-align: right;
            font-size: 13px;
            color: #4b5563;
            line-height: 1.8;
          }

          .business-info strong {
            display: block;
            color: #111827;
            font-weight: 600;
            margin-bottom: 4px;
          }

          /* Title Section */
          .title-section {
            background: ${theme.secondary};
            padding: 24px 32px;
            border-bottom: 1px solid #e5e7eb;
          }

          .receipt-title {
            font-size: 32px;
            font-weight: 800;
            color: ${theme.text};
            margin-bottom: 4px;
          }

          .receipt-subtitle {
            font-size: 14px;
            color: #6b7280;
            font-weight: 500;
          }

          /* Info Grid */
          .info-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 16px;
            padding: 24px 32px;
            background: #fafafa;
            border-bottom: 1px solid #e5e7eb;
          }

          .info-box {
            background: #ffffff;
            padding: 16px;
            border-radius: 8px;
            border: 1px solid #e5e7eb;
          }

          .info-label {
            font-size: 11px;
            font-weight: 600;
            color: #6b7280;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-bottom: 4px;
          }

          .info-value {
            font-size: 15px;
            font-weight: 600;
            color: #111827;
          }

          /* Payer Information */
          .payer-section {
            padding: 24px 32px;
            border-bottom: 1px solid #e5e7eb;
          }

          .section-title {
            font-size: 14px;
            font-weight: 700;
            color: #111827;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-bottom: 12px;
            padding-bottom: 8px;
            border-bottom: 2px solid ${theme.primary};
            display: inline-block;
          }

          .payer-details {
            background: #f9fafb;
            padding: 16px;
            border-radius: 8px;
            margin-top: 8px;
          }

          .payer-details p {
            margin: 6px 0;
            font-size: 14px;
            color: #374151;
          }

          .payer-details strong {
            color: #111827;
            font-weight: 600;
            display: inline-block;
            min-width: 120px;
          }

          /* Payment Details Table */
          .payment-section {
            padding: 24px 32px;
          }

          table {
            width: 100%;
            border-collapse: separate;
            border-spacing: 0;
            margin-top: 16px;
          }

          thead {
            background: ${theme.primary};
          }

          th {
            text-align: left;
            padding: 14px 16px;
            color: #ffffff;
            font-weight: 600;
            font-size: 13px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }

          th:first-child {
            border-top-left-radius: 8px;
          }

          th:last-child {
            border-top-right-radius: 8px;
            text-align: right;
          }

          tbody tr {
            border-bottom: 1px solid #e5e7eb;
          }

          tbody tr:last-child {
            border-bottom: none;
          }

          td {
            padding: 16px;
            font-size: 14px;
            color: #374151;
          }

          td:last-child {
            text-align: right;
            font-weight: 600;
            color: #111827;
          }

          /* Total Section */
          .total-section {
            background: ${theme.secondary};
            padding: 20px 32px;
            border-top: 2px solid ${theme.primary};
            border-bottom: 1px solid #e5e7eb;
          }

          .total-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
          }

          .total-label {
            font-size: 18px;
            font-weight: 700;
            color: #111827;
          }

          .total-amount {
            font-size: 28px;
            font-weight: 800;
            color: ${theme.text};
          }

          /* Description Section */
          .description-section {
            padding: 24px 32px;
            border-bottom: 1px solid #e5e7eb;
          }

          .description-text {
            background: #f9fafb;
            padding: 16px;
            border-radius: 8px;
            border-left: 4px solid ${theme.primary};
            font-size: 14px;
            color: #374151;
            line-height: 1.8;
          }

          /* Receipt Image */
          .image-section {
            padding: 24px 32px;
            border-bottom: 1px solid #e5e7eb;
            text-align: center;
          }

          .receipt-image {
            max-width: 100%;
            height: auto;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
            margin-top: 12px;
          }

          /* Tax Information */
          .tax-section {
            padding: 20px 32px;
            background: #fffbeb;
            border-left: 4px solid #f59e0b;
            margin: 0 32px;
            border-radius: 8px;
          }

          .tax-notice {
            font-size: 12px;
            color: #92400e;
            line-height: 1.6;
          }

          .tax-notice strong {
            display: block;
            font-weight: 700;
            margin-bottom: 4px;
          }

          /* Footer */
          .footer {
            padding: 24px 32px;
            text-align: center;
            border-top: 1px solid #e5e7eb;
            background: #fafafa;
          }

          .footer-text {
            font-size: 12px;
            color: #6b7280;
            line-height: 1.8;
          }

          .footer-text strong {
            color: #111827;
            display: block;
            margin-bottom: 4px;
          }

          /* Watermark */
          .watermark {
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%) rotate(-45deg);
            font-size: 120px;
            font-weight: 900;
            color: rgba(0, 0, 0, 0.02);
            z-index: -1;
            pointer-events: none;
          }

          /* Print Styles */
          @media print {
            body {
              padding: 0;
            }

            .container {
              border: none;
              box-shadow: none;
            }
          }

          /* Utility Classes */
          .text-muted {
            color: #6b7280;
          }

          .text-success {
            color: #16a34a;
          }

          .badge {
            display: inline-block;
            padding: 4px 12px;
            border-radius: 12px;
            font-size: 11px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }

          .badge-paid {
            background: #dcfce7;
            color: #15803d;
          }
        </style>
      </head>

      <body>
        <div class="watermark">PAID</div>

        <div class="container">
          <!-- Header -->
          <div class="header">
            <div class="logo-section">
              ${userDetails.logo ? `<img src="${userDetails.logo}" alt="Logo" class="logo" />` : ""}
              <div class="business-name">${userDetails.businessName || userDetails.name || "Your Business"}</div>
            </div>
            <div class="business-info">
              <strong>From:</strong>
              ${userDetails.businessName || userDetails.name || ""}<br>
              ${userDetails.address || ""}<br>
              ${userDetails.email || ""}<br>
              ${userDetails.phone ? `Tel: ${userDetails.phone}` : ""}
              ${userDetails.taxId ? `<br>Tax ID: ${userDetails.taxId}` : ""}
            </div>
          </div>

          <!-- Title -->
          <div class="title-section">
            <div class="receipt-title">Income Receipt</div>
            <div class="receipt-subtitle">Official payment documentation</div>
          </div>

          <!-- Info Grid -->
          <div class="info-grid">
            <div class="info-box">
              <div class="info-label">Receipt Number</div>
              <div class="info-value">${receiptNumber}</div>
            </div>
            <div class="info-box">
              <div class="info-label">Date Issued</div>
              <div class="info-value">${formattedDate}</div>
            </div>
            <div class="info-box">
              <div class="info-label">Payment Method</div>
              <div class="info-value">${receipt.paymentMethod || "Not specified"}</div>
            </div>
            <div class="info-box">
              <div class="info-label">Status</div>
              <div class="info-value">
                <span class="badge badge-paid">Paid in Full</span>
              </div>
            </div>
          </div>

          <!-- Payer Information -->
          <div class="payer-section">
            <div class="section-title">Received From</div>
            <div class="payer-details">
              <p><strong>Name:</strong> ${receipt.payer || "N/A"}</p>
              ${receipt.payerAddress ? `<p><strong>Address:</strong> ${receipt.payerAddress}</p>` : ""}
              ${receipt.payerTaxId ? `<p><strong>Tax ID:</strong> ${receipt.payerTaxId}</p>` : ""}
              ${receipt.payerEmail ? `<p><strong>Email:</strong> ${receipt.payerEmail}</p>` : ""}
            </div>
          </div>

          <!-- Payment Details -->
          <div class="payment-section">
            <div class="section-title">Payment Details</div>
            <table>
              <thead>
                <tr>
                  <th>Description</th>
                  <th>Category</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>${receipt.description || receipt.notes || "Payment received"}</td>
                  <td>${receipt.category || "Income"}</td>
                  <td>${currencySymbol}${Number(receipt.amount).toLocaleString("en-US", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Total -->
          <div class="total-section">
            <div class="total-row">
              <div class="total-label">Total Amount Received</div>
              <div class="total-amount">${currencySymbol}${Number(receipt.amount).toLocaleString("en-US", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })} ${currency}</div>
            </div>
          </div>

          <!-- Description -->
          ${receipt.description ? `
          <div class="description-section">
            <div class="section-title">Additional Details</div>
            <div class="description-text">${receipt.description}</div>
          </div>
          ` : ""}

          <!-- Receipt Image -->
          ${includeImage && receipt.imageUrl ? `
          <div class="image-section">
            <div class="section-title">Supporting Document</div>
            <img src="${receipt.imageUrl}" alt="Receipt" class="receipt-image" />
          </div>
          ` : ""}

          <!-- Tax Notice -->
          <div style="padding: 24px 32px;">
            <div class="tax-section">
              <div class="tax-notice">
                <strong>📋 Tax Documentation Notice</strong>
                This receipt serves as official documentation of income received. Please retain this document for your tax records and accounting purposes. Consult with a tax professional regarding reporting requirements.
              </div>
            </div>
          </div>

          <!-- Footer -->
          ${includeFooter ? `
          <div class="footer">
            <div class="footer-text">
              <strong>Thank you for your payment</strong>
              This is an official receipt generated on ${new Date().toLocaleDateString("en-US", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}<br>
              ${userDetails.website ? `Website: ${userDetails.website}<br>` : ""}
              For questions about this receipt, please contact ${userDetails.email || "us"}
            </div>
          </div>
          ` : ""}
        </div>
      </body>
    </html>
    `;

    // Generate PDF
    const { uri } = await Print.printToFileAsync({
      html,
      base64: false,
    });

    // Share or save
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri, {
        mimeType: "application/pdf",
        dialogTitle: `Income Receipt - ${receiptNumber}`,
        UTI: "com.adobe.pdf",
      });
    } else {
      // Fallback: save to device
      const fileName = `Income_Receipt_${receiptNumber}_${Date.now()}.pdf`;
      const newPath = `${FileSystem.documentDirectory}${fileName}`;
      await FileSystem.moveAsync({
        from: uri,
        to: newPath,
      });
      console.log("PDF saved to:", newPath);
      return newPath;
    }

    return uri;
  } catch (error) {
    console.error("Error generating PDF:", error);
    throw new Error("Failed to generate receipt PDF: " + error.message);
  }
}

/**
 * Preview HTML before generating PDF (useful for debugging)
 */
export async function previewReceiptHTML(receipt, userDetails, options = {}) {
  // Returns the HTML string for preview/debugging
  // Implementation would be similar to above but return HTML instead of generating PDF
}

/**
 * Generate multiple receipts in batch
 */
export async function generateBatchReceiptPDFs(receipts, userDetails, options = {}) {
  try {
    const results = [];
    
    for (const receipt of receipts) {
      const uri = await generateIncomeReceiptPDF(receipt, userDetails, options);
      results.push({ receiptNumber: receipt.receiptNumber, uri, success: true });
    }
    
    return results;
  } catch (error) {
    console.error("Error in batch generation:", error);
    throw error;
  }
}

/**
 * Validate receipt data before PDF generation
 */
export function validateReceiptData(receipt, userDetails) {
  const errors = [];

  if (!receipt.amount || isNaN(receipt.amount) || receipt.amount <= 0) {
    errors.push("Valid amount is required");
  }

  if (!receipt.payer) {
    errors.push("Payer name is required");
  }

  if (!receipt.date && !receipt.createdAt) {
    errors.push("Receipt date is required");
  }

  if (!userDetails.businessName && !userDetails.name) {
    errors.push("Business name is required");
  }

  if (!userDetails.email) {
    errors.push("Business email is required");
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}
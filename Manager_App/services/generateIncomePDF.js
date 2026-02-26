import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import * as FileSystem from "expo-file-system";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { storage, auth } from "../components/firebase";

export async function generateIncomeReceiptPDF(receipt, userDetails, options = {}) {
  const {
    userId,
    projectId = "General",
    uploadToFirebase = true,
    allowSharing = false,
    onProgress = () => {},
  } = options;

  try {
    const {
      currency = "USD",
      currencySymbol = "$",
      includeImage = true,
      includeFooter = true,
      colorScheme = "blue",
    } = options;

    const subtotal = Number(receipt.subtotal ?? receipt.amount ?? 0);
    const tax = Number(receipt.tax ?? 0);
    const taxRate = Number(receipt.taxRate ?? 0);
    const total = Number(receipt.total ?? subtotal + tax);

    const date = new Date(receipt.date || receipt.createdAt);
    const formattedDate = date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
   
    const receiptNumber = receipt.receiptNumber || `REC-${Date.now().toString().slice(-8)}`;
    let logoSrc = null;

    if (userDetails.logo) {
      try {
        if (userDetails.logo.startsWith("file://")) {
          // Local file → convert to base64
          const base64 = await FileSystem.readAsStringAsync(
            userDetails.logo,
            { encoding: FileSystem.EncodingType.Base64 }
          );
          logoSrc = `data:image/png;base64,${base64}`;
        } else if (userDetails.logo.startsWith("http")) {
          // Remote file → use as-is
          logoSrc = userDetails.logo;
        }
      } catch (err) {
        console.log("Logo load failed:", err);
      }
    }
    const colors = {
      blue:   { primary: "#2563EB", secondary: "#EFF6FF", text: "#1E40AF" },
      green:  { primary: "#16a34a", secondary: "#F0FDF4", text: "#15803d" },
      purple: { primary: "#9333EA", secondary: "#FAF5FF", text: "#7C3AED" },
      gray:   { primary: "#374151", secondary: "#F9FAFB", text: "#1F2937" },
    };
    const theme = colors[colorScheme] || colors.blue;

    const fmt = (n) =>
      Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>Income Receipt</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  @page { size: A4; margin: 0; }
  html, body {
    width: 210mm;
    height: 297mm;
    font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
    background: white;
    font-size: 13px;
    color: #111827;
  }
  .container {
    width: 210mm;
    min-height: 297mm;
    background: white;
    display: flex;
    flex-direction: column;
  }

  /* HEADER */
  .header {
    background: linear-gradient(135deg, ${theme.primary} 0%, ${theme.text} 100%);
    color: white;
    padding: 20px 24px 16px;
    position: relative;
  }
  .header-top {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 12px;
  }
  .business-info { display: flex; align-items: center; gap: 12px; }
  .logo { width: 52px; height: 52px; border-radius: 8px; object-fit: contain; border: 2px solid rgba(255,255,255,0.3); }
  .business-name { font-size: 18px; font-weight: 700; margin-bottom: 2px; }
  .business-meta { font-size: 10px; opacity: 0.85; line-height: 1.5; }
  .header-right { text-align: right; }
  .receipt-title { font-size: 20px; font-weight: 800; letter-spacing: -0.5px; }
  .receipt-subtitle { font-size: 10px; opacity: 0.8; margin-top: 2px; }
  .paid-stamp {
    display: inline-block;
    border: 2.5px solid #4ADE80;
    color: #4ADE80;
    padding: 2px 10px;
    border-radius: 4px;
    font-size: 13px;
    font-weight: 800;
    letter-spacing: 2px;
    transform: rotate(-8deg);
    margin-top: 6px;
  }
  .meta-strip {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 8px;
    background: rgba(255,255,255,0.12);
    border-radius: 8px;
    padding: 10px 12px;
  }
  .meta-label { font-size: 9px; opacity: 0.7; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 2px; }
  .meta-value { font-size: 11px; font-weight: 600; }

  /* BODY */
  .body { padding: 16px 24px; display: flex; flex-direction: column; gap: 12px; flex: 1; }

  /* SECTION */
  .section {
    border: 1px solid #E5E7EB;
    border-radius: 8px;
    overflow: hidden;
  }
  .section-header {
    background: ${theme.secondary};
    padding: 7px 14px;
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.6px;
    color: ${theme.text};
    border-bottom: 1px solid #E5E7EB;
  }
  .section-body { padding: 10px 14px; }

  /* PAYER INFO */
  .info-grid { display: grid; grid-template-columns: auto 1fr; gap: 3px 16px; font-size: 11px; }
  .info-label { color: #6B7280; font-weight: 500; white-space: nowrap; }
  .info-value { color: #111827; }

  /* TABLE */
  table { width: 100%; border-collapse: collapse; font-size: 11px; }
  thead { background: ${theme.primary}; }
  thead th { color: white; padding: 7px 12px; text-align: left; font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.4px; }
  thead th:last-child { text-align: right; }
  tbody tr { border-bottom: 1px solid #F3F4F6; }
  tbody td { padding: 8px 12px; color: #374151; }
  tbody td:last-child { text-align: right; }
  .tax-row { background: #F9FAFB; }
  .tax-row td { padding: 6px 12px; color: #6B7280; font-size: 10px; }
  .tax-row td:last-child { text-align: right; }

  /* TOTAL */
  .total-box {
    background: ${theme.primary};
    border-radius: 8px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 18px;
    color: white;
  }
  .total-label { font-size: 13px; font-weight: 600; }
  .total-right { text-align: right; }
  .total-amount { font-size: 24px; font-weight: 800; }
  .total-currency { font-size: 10px; opacity: 0.75; }

  /* DESCRIPTION */
  .description-box {
    background: #F9FAFB;
    border-radius: 8px;
    padding: 10px 14px;
    font-size: 11px;
    color: #374151;
    line-height: 1.5;
  }
  .description-title { font-size: 10px; font-weight: 700; color: ${theme.text}; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; }

  /* SUPPORTING IMAGE */
  .image-box { border: 1px solid #E5E7EB; border-radius: 8px; overflow: hidden; }
  .image-box img { width: 100%; max-height: 160px; object-fit: contain; display: block; }

  /* NOTICE */
  .notice {
    background: #FFFBEB;
    border: 1px solid #FCD34D;
    border-radius: 8px;
    padding: 10px 14px;
    font-size: 10px;
    color: #92400E;
    line-height: 1.5;
  }
  .notice-title { font-weight: 700; margin-bottom: 3px; }

  /* FOOTER */
  .footer {
    background: #F9FAFB;
    border-top: 1px solid #E5E7EB;
    padding: 12px 24px;
    text-align: center;
    font-size: 10px;
    color: #6B7280;
    line-height: 1.6;
  }
  .footer a { color: ${theme.primary}; }
</style>
</head>
<body>
<div class="container">

  <!-- HEADER -->
  <div class="header">
    <div class="header-top">
      <div class="business-info">
        ${logoSrc ? `<img class="logo" src="${logoSrc}" />` : ""}
        <div>
          <div class="business-name">${userDetails.businessName || userDetails.name || "Your Business"}</div>
          <div class="business-meta">
            ${userDetails.address ? `${userDetails.address.street}<br/>${userDetails.address.state}<br/>${userDetails.address.country}<br/>${userDetails.address.zip}<br/>` : ""}
            ${userDetails.email ? `${userDetails.email}` : ""}
            ${userDetails.phone ? ` &bull; Tel: ${userDetails.phone}` : ""}
            ${userDetails.taxId ? `<br/>Tax ID: ${userDetails.taxId}` : ""}
          </div>
        </div>
      </div>
      <div class="header-right">
        <div class="receipt-title">Income Receipt</div>
        <div class="receipt-subtitle">Official payment documentation</div>
        <div class="paid-stamp">PAID</div>
      </div>
    </div>
    <div class="meta-strip">
      <div class="meta-item">
        <div class="meta-label">Receipt Number</div>
        <div class="meta-value">${receiptNumber}</div>
      </div>
      <div class="meta-item">
        <div class="meta-label">Date Issued</div>
        <div class="meta-value">${formattedDate}</div>
      </div>
      <div class="meta-item">
        <div class="meta-label">Payment Method</div>
        <div class="meta-value">${(receipt.paymentMethod || "cash")
          .replace("_", " ")
          .replace(/\b\w/g, (c) => c.toUpperCase())}</div>
      </div>
      <div class="meta-item">
        <div class="meta-label">Status</div>
        <div class="meta-value">Paid in Full</div>
      </div>
    </div>
  </div>

  <!-- BODY -->
  <div class="body">

    <!-- RECEIVED FROM -->
    <div class="section">
      <div class="section-header">Received From</div>
      <div class="section-body">
        <div class="info-grid">
          <span class="info-label">Name:</span>
          <span class="info-value">${receipt.payer || "N/A"}</span>
          ${receipt.payerAddress ? `
          <span class="info-label">Address:</span>
          <span class="info-value">${[receipt.payerAddress.street, receipt.payerAddress.state, receipt.payerAddress.zip].filter(Boolean).join(", ")}</span>
          ` : ""}
          ${receipt.payerEmail ? `
          <span class="info-label">Email:</span>
          <span class="info-value">${receipt.payerEmail}</span>
          ` : ""}
          ${receipt.payerTaxId ? `
          <span class="info-label">Tax ID:</span>
          <span class="info-value">${receipt.payerTaxId}</span>
          ` : ""}
        </div>
      </div>
    </div>

    <!-- PAYMENT DETAILS TABLE -->
    <div class="section">
      <div class="section-header">Payment Details</div>
      <table>
        <thead>
          <tr>
            <th>Category</th>
            <th>Description</th>
            <th>Amount</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>${receipt.category || "Income"}</td>
            <td>${receipt.description || receipt.notes || "Payment received"}</td>
            <td>${currencySymbol}${fmt(subtotal)}</td>
          </tr>
          ${taxRate > 0 ? `
          <tr class="tax-row">
            <td colspan="2">Sales Tax (${taxRate.toFixed(2)}%)</td>
            <td>${currencySymbol}${fmt(tax)}</td>
          </tr>
          ` : ""}
        </tbody>
      </table>
    </div>

    <!-- TOTAL -->
    <div class="total-box">
      <div class="total-label">Total Amount Received</div>
      <div class="total-right">
        <div class="total-amount">${currencySymbol}${fmt(total)}</div>
        <div class="total-currency">${currency}</div>
      </div>
    </div>

    <!-- ADDITIONAL DETAILS -->
    ${receipt.description ? `
    <div class="description-box">
      <div class="description-title">Additional Details</div>
      ${receipt.description}
    </div>
    ` : ""} 

    <!-- SUPPORTING IMAGE -->
    ${includeImage && receipt.imageUrl ? `
    <div class="section">
      <div class="section-header">Supporting Document</div>
      <div class="image-box">
        <img src="${receipt.imageUrl}" alt="Supporting document" />
      </div>
    </div>
    ` : ""}

    <!-- NOTICE -->
    <div class="notice">
      <div class="notice-title">📋 Tax Documentation Notice</div>
      This receipt serves as official documentation of income received. Please retain this document for your
      tax records and accounting purposes. Consult with a tax professional regarding reporting requirements.
    </div>

    <!-- SPACER pushes footer to bottom -->
    <div style="flex:1;"></div>

  </div>

  <!-- FOOTER -->
  ${includeFooter ? `
  <div class="footer">
    Thank you for your payment &bull;
    This is an official receipt generated on ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
    ${userDetails.website ? ` &bull; <a href="${userDetails.website}">${userDetails.website}</a>` : ""}
    &bull; For questions about this receipt, please contact ${userDetails.email || "us"}
  </div>
  ` : ""}

</div>
</body>
</html>`;

    // Generate PDF locally — A4 size (points: 595 × 842)
    const { uri } = await Print.printToFileAsync({ html, width: 595, height: 842 });

    // Share if requested
    if (allowSharing) {
      await Sharing.shareAsync(uri, {
        mimeType: "application/pdf",
        dialogTitle: "Share Receipt",
      });
    }

    // Upload to Firebase if requested
    let downloadURL = null;
    if (uploadToFirebase && userId) {
      if (!auth.currentUser) {
        await signInFirebase();
      }

      const blob = await (await fetch(uri)).blob();
      const fileRef = ref(
        storage,
        `users/${userId}/incomeReceipts/${projectId}/Receipt_${receipt.receiptNumber || Date.now()}.pdf`
      );
      const uploadTask = uploadBytesResumable(fileRef, blob);

      downloadURL = await new Promise((resolve, reject) => {
        uploadTask.on(
          "state_changed",
          (snapshot) => {
            const progress = snapshot.bytesTransferred / snapshot.totalBytes;
            onProgress(Math.round(progress * 100));
          },
          reject,
          async () => {
            const url = await getDownloadURL(fileRef);
            resolve(url);
          }
        );
      });
    }

    return { localUri: uri, downloadURL };
  } catch (error) {
    throw error;
  }
}
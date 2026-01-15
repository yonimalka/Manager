import * as Print from "expo-print";
import * as Sharing from "expo-sharing";

/**
 * Generate a modern, Google-style UK income receipt PDF
 * @param {Object} receipt - The receipt object
 */
export async function generateIncomeReceiptPDF(receipt) {
  const date = new Date(receipt.date);
  const formattedDate = `${date.getDate().toString().padStart(2, "0")}/${
    (date.getMonth() + 1).toString().padStart(2, "0")
  }/${date.getFullYear()}`;

  // Replace with your actual logo URL
  const logoUrl = "https://via.placeholder.com/200x60?text=Company+Logo";

  const html = `
  <html>
    <head>
      <style>
        body {
          font-family: 'Roboto', 'Helvetica', Arial, sans-serif;
          margin: 0;
          padding: 0;
          background-color: #f5f5f5;
        }

        .container {
          max-width: 800px;
          margin: 40px auto;
          background: #fff;
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 4px 20px rgba(0,0,0,0.1);
        }

        .header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 24px 32px;
          border-bottom: 1px solid #e0e0e0;
        }

        .logo img {
          max-height: 50px;
        }

        .company-info {
          text-align: right;
          font-size: 14px;
          color: #555;
        }

        .title {
          font-size: 28px;
          font-weight: 700;
          color: #1a202c;
          padding: 24px 32px 0 32px;
        }

        .info-boxes {
          display: flex;
          justify-content: space-between;
          padding: 16px 32px;
          gap: 12px;
          flex-wrap: wrap;
        }

        .box {
          background: #f9fafb;
          padding: 16px;
          border-radius: 10px;
          flex: 1 1 45%;
          font-size: 14px;
        }

        .box span {
          font-weight: 600;
          color: #1a202c;
        }

        table {
          width: 100%;
          border-collapse: collapse;
          margin: 16px 32px 0 32px;
        }

        th, td {
          text-align: left;
          padding: 14px;
        }

        th {
          background-color: #1a73e8;
          color: #fff;
          font-weight: 600;
          border-bottom: 2px solid #e0e0e0;
        }

        td {
          border-bottom: 1px solid #e0e0e0;
          font-size: 14px;
        }

        .total {
          text-align: right;
          padding: 16px 32px;
          font-size: 18px;
          font-weight: 700;
          color:rgb(51, 176, 97);
        }

        .notes {
          padding: 0 32px 16px 32px;
          font-style: italic;
          color: #555;
        }

        .receipt-image {
          max-width: 90%;
          display: block;
          margin: 24px auto;
          border-radius: 10px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        }

        .footer {
          text-align: center;
          padding: 24px 32px;
          font-size: 12px;
          color: #888;
          border-top: 1px solid #e0e0e0;
        }
      </style>
    </head>

    <body>
      <div class="container">
        <div class="header">
          <div class="logo">
            <img src="${logoUrl}" alt="Company Logo"/>
          </div>
          <div class="company-info">
            Your Company Name<br>
            123 Example Street, London, UK<br>
            info@company.com
          </div>
        </div>

        <div class="title">Income Receipt</div>

        <div class="info-boxes">
          <div class="box">
            <span>Receipt Number:</span> ${receipt.receiptNumber}
          </div>
          <div class="box">
            <span>Date:</span> ${formattedDate}
          </div>
          <div class="box">
            <span>For:</span> ${receipt.payer}
          </div>
          <div class="box">
            <span>Category:</span> ${receipt.category || "N/A"}
          </div>
          <div class="box">
            <span>Payment Method:</span> ${receipt.paymentMethod || "N/A"}
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>Description</th>
              <th>Amount (£)</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>${receipt.notes || "Payment received"}</td>
              <td>£${Number(receipt.amount).toLocaleString("en-GB", {minimumFractionDigits: 2})}</td>
            </tr>
          </tbody>
        </table>

        <div class="total">Total: £${Number(receipt.amount).toLocaleString("en-GB", {minimumFractionDigits: 2})}</div>

        ${receipt.imageUrl ? `<img class="receipt-image" src="${receipt.imageUrl}" />` : ""}

        <div class="notes">${receipt.notes || ""}</div>

        <div class="footer">
          Thank you for your payment.<br>
          Your Company Name | Company Address | Contact: info@company.com
        </div>
      </div>
    </body>
  </html>
  `;

  const { uri } = await Print.printToFileAsync({ html });
  await Sharing.shareAsync(uri, { mimeType: "application/pdf" });
};

import * as Print from "expo-print";
import * as Sharing from "expo-sharing";

export async function generateIncomeReceiptPDF(receipt) {
  const html = `
    <h2>Income Receipt</h2>
    <p><b>#</b> ${receipt.receiptNumber}</p>
    <p><b>Date:</b> ${new Date(receipt.date).toLocaleDateString()}</p>
    <p><b>From:</b> ${receipt.payer}</p>
    <p><b>Amount:</b> ${receipt.amount} ${receipt.currency}</p>
    <p>${receipt.notes || ""}</p>
  `;

  const { uri } = await Print.printToFileAsync({ html });
  await Sharing.shareAsync(uri);
}

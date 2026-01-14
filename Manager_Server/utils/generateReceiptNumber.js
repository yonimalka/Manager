function generateReceiptNumber() {
  const year = new Date().getFullYear();
  const rand = Math.floor(100000 + Math.random() * 900000);
  return `INC-${year}-${rand}`;
}

module.exports = generateReceiptNumber;
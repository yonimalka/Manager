export const formatCurrency = (amount, currency, locale) => {
  return new Intl.NumberFormat(locale || "en-US", {
    style: "currency",
    currency: currency || "USD",
  }).format(amount);
};
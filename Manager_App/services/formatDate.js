export function formatDate(date, locale = "en-US") {
  if (!date) return "";

  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "long",
  }).format(date);
}
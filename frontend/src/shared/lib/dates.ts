const PROJECT_DATE_FORMATTER = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

export function formatProjectDate(value: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [yearText, monthText, dayText] = value.split("-");
    return PROJECT_DATE_FORMATTER.format(
      new Date(Number(yearText), Number(monthText) - 1, Number(dayText)),
    );
  }
  return PROJECT_DATE_FORMATTER.format(new Date(value));
}

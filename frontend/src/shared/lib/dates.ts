const PROJECT_DATE_FORMATTER = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

const PROJECT_DATE_TIME_FORMATTER = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

const RELATIVE_TIME_FORMATTER = new Intl.RelativeTimeFormat("en-US", {
  numeric: "auto",
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

export function formatProjectDateTime(value: string): string {
  return PROJECT_DATE_TIME_FORMATTER.format(new Date(value));
}

export function formatRelativeProjectDate(value: string, now = new Date()): string {
  const date = new Date(value);
  const elapsedSeconds = Math.round((date.getTime() - now.getTime()) / 1000);
  const absSeconds = Math.abs(elapsedSeconds);

  if (absSeconds < 60) {
    return RELATIVE_TIME_FORMATTER.format(elapsedSeconds, "second");
  }
  if (absSeconds < 60 * 60) {
    return RELATIVE_TIME_FORMATTER.format(Math.round(elapsedSeconds / 60), "minute");
  }
  if (absSeconds < 60 * 60 * 24) {
    return RELATIVE_TIME_FORMATTER.format(Math.round(elapsedSeconds / (60 * 60)), "hour");
  }
  if (absSeconds < 60 * 60 * 24 * 30) {
    return RELATIVE_TIME_FORMATTER.format(Math.round(elapsedSeconds / (60 * 60 * 24)), "day");
  }
  return formatProjectDate(value);
}

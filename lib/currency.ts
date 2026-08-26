const exponentCache = new Map<string, number>();

export function isCurrencyCode(value: unknown): value is string {
  return typeof value === "string" && /^[A-Z]{3}$/u.test(value);
}

export function currencyExponent(currency: string) {
  if (!isCurrencyCode(currency)) return null;
  const cached = exponentCache.get(currency);
  if (cached !== undefined) return cached;

  let exponent = 2;
  try {
    const resolved = new Intl.NumberFormat("en", {
      style: "currency",
      currency,
    }).resolvedOptions().maximumFractionDigits;
    if (
      typeof resolved === "number" &&
      Number.isInteger(resolved) &&
      resolved >= 0 &&
      resolved <= 4
    ) {
      exponent = resolved;
    }
  } catch {
    // ISO-like codes unknown to this runtime use the common two-digit fallback.
  }

  exponentCache.set(currency, exponent);
  return exponent;
}

export function currencyName(currency: string, locale = "en") {
  if (!isCurrencyCode(currency)) return currency;
  try {
    return (
      new Intl.DisplayNames([locale], { type: "currency" }).of(currency) ??
      currency
    );
  } catch {
    return currency;
  }
}

export function currencySymbol(currency: string, locale = "en") {
  if (!isCurrencyCode(currency)) return currency;
  try {
    return (
      new Intl.NumberFormat(locale, {
        style: "currency",
        currency,
        currencyDisplay: "narrowSymbol",
      })
        .formatToParts(0)
        .find((part) => part.type === "currency")?.value ?? currency
    );
  } catch {
    return currency;
  }
}

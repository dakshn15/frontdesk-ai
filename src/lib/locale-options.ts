export type Option = { value: string; label: string };

let timeZones: Set<string> | undefined;
let currencies: Set<string> | undefined;

function allTimeZones(): Set<string> {
  timeZones ??= new Set([...Intl.supportedValuesOf("timeZone"), "UTC"]);
  return timeZones;
}

function allCurrencies(): Set<string> {
  currencies ??= new Set(Intl.supportedValuesOf("currency"));
  return currencies;
}

export function isValidTimeZone(timeZone: string): boolean {
  return allTimeZones().has(timeZone);
}

export function isValidCurrency(code: string): boolean {
  return allCurrencies().has(code);
}

export function timeZoneOptions(): Option[] {
  return [...allTimeZones()]
    .sort()
    .map((zone) => ({ value: zone, label: zone.replaceAll("_", " ") }));
}

// Where most FrontDesk AI businesses are expected to be, listed before the rest.
const COMMON_CURRENCIES = ["USD", "GBP", "EUR", "CAD", "AUD", "INR"];

export function currencyOptions(): Option[] {
  const names = new Intl.DisplayNames(["en"], { type: "currency" });
  const label = (code: string) => `${names.of(code) ?? code} (${code})`;
  const rest = [...allCurrencies()]
    .filter((code) => !COMMON_CURRENCIES.includes(code))
    .sort();
  return [...COMMON_CURRENCIES, ...rest].map((code) => ({
    value: code,
    label: label(code),
  }));
}

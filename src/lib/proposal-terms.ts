export type ProposalPriceMode = "hourly" | "fixed" | "negotiable";

export interface ProposalTerms {
  priceMode: ProposalPriceMode;
  hourlyRate: string | null;
  hourlyRateMax: string | null;
  fixedPriceMin: string | null;
  fixedPriceMax: string | null;
  hoursPerWeek: number;
  hoursPerWeekMax: number | null;
}

function amount(raw: FormDataEntryValue | null, label: string): number | null {
  const value = String(raw ?? "").trim();
  if (!value) return null;
  if (!/^\d+(?:\.\d{1,2})?$/.test(value)) throw new Error(`${label} must be a USD amount with up to two decimal places.`);
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) throw new Error(`${label} must be greater than zero.`);
  if (parsed >= 10_000_000_000) throw new Error(`${label} is too large.`);
  return parsed;
}

export function parseWeeklyHours(formData: FormData, limit = 80) {
  const minimumRaw = String(formData.get("hoursPerWeek") ?? "").trim();
  const maximumRaw = String(formData.get("hoursPerWeekMax") ?? "").trim();
  const minimum = Number(minimumRaw);
  const maximum = maximumRaw ? Number(maximumRaw) : null;
  if (!/^\d+$/.test(minimumRaw) || minimum < 1 || minimum > limit) {
    throw new Error(`Minimum hours per week must be between 1 and ${limit}.`);
  }
  if (maximumRaw && (!/^\d+$/.test(maximumRaw) || maximum! < minimum || maximum! > limit)) {
    throw new Error(`Maximum hours per week must be between ${minimum} and ${limit}.`);
  }
  return { hoursPerWeek: minimum, hoursPerWeekMax: maximum };
}

export function parseContractProposalTerms(
  formData: FormData,
  hourlyBounds: { minRate: number; maxRate: number },
): ProposalTerms {
  const priceMode = String(formData.get("priceMode") ?? "hourly");
  if (priceMode !== "hourly" && priceMode !== "fixed" && priceMode !== "negotiable") {
    throw new Error("Choose hourly, fixed project price, or negotiable terms.");
  }
  const hours = parseWeeklyHours(formData);
  const terms: ProposalTerms = {
    priceMode,
    hourlyRate: null,
    hourlyRateMax: null,
    fixedPriceMin: null,
    fixedPriceMax: null,
    ...hours,
  };
  if (priceMode === "negotiable") return terms;

  const hourly = priceMode === "hourly";
  const minimum = amount(formData.get(hourly ? "hourlyRate" : "fixedPriceMin"), hourly ? "Minimum hourly rate" : "Minimum project price");
  const maximum = amount(formData.get(hourly ? "hourlyRateMax" : "fixedPriceMax"), hourly ? "Maximum hourly rate" : "Maximum project price");
  if (minimum === null) throw new Error(`Enter a minimum ${hourly ? "hourly rate" : "project price"}.`);
  if (maximum !== null && maximum < minimum) throw new Error("Maximum price cannot be below the minimum.");
  if (hourly && (minimum < hourlyBounds.minRate || (maximum ?? minimum) > hourlyBounds.maxRate)) {
    throw new Error(`Hourly rates must be between $${hourlyBounds.minRate} and $${hourlyBounds.maxRate}/hr.`);
  }
  if (hourly) {
    terms.hourlyRate = minimum.toFixed(2);
    terms.hourlyRateMax = maximum?.toFixed(2) ?? null;
  } else {
    terms.fixedPriceMin = minimum.toFixed(2);
    terms.fixedPriceMax = maximum?.toFixed(2) ?? null;
  }
  return terms;
}

function usd(value: string | number): string {
  return `$${Number(value).toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
}

export function formatProposalPrice(terms: {
  priceMode?: ProposalPriceMode | null;
  hourlyRate?: string | null;
  hourlyRateMax?: string | null;
  fixedPriceMin?: string | null;
  fixedPriceMax?: string | null;
}): string {
  const mode = terms.priceMode ?? (terms.hourlyRate ? "hourly" : "negotiable");
  if (mode === "negotiable") return "Price negotiable";
  const hourly = mode === "hourly";
  const minimum = hourly ? terms.hourlyRate : terms.fixedPriceMin;
  const maximum = hourly ? terms.hourlyRateMax : terms.fixedPriceMax;
  if (!minimum) return "Price not stated";
  const suffix = hourly ? "/hr" : " total";
  if (maximum && Number(maximum) > Number(minimum)) return `${usd(minimum)}–${usd(maximum)}${suffix}`;
  if (maximum || maximum === undefined) return `${usd(minimum)}${suffix}`;
  return `From ${usd(minimum)}${suffix}`;
}

export function formatProposalHours(minimum: number, maximum: number | null | undefined): string {
  if (!minimum || minimum < 0) return "Hours not stated";
  if (maximum && maximum > minimum) return `${minimum}–${maximum} hrs/week`;
  if (maximum || maximum === undefined) return `${minimum} hrs/week`;
  return `At least ${minimum} hrs/week`;
}

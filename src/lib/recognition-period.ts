/**
 * Recognition period keys.
 *
 * Pulled out of the mock-data module so the visibility gate and the
 * recognition actions can share one definition without either of them
 * importing fixtures. Pure date maths — no data.
 */
export function periodKeyFor(
  date: Date,
  kind: "month" | "year",
): { key: string; label: string } {
  const year = date.getUTCFullYear();
  if (kind === "year") return { key: String(year), label: String(year) };
  const month = date.getUTCMonth(); // 0-indexed
  const months = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];
  const mm = String(month + 1).padStart(2, "0");
  return { key: `${year}-${mm}`, label: `${months[month]} ${year}` };
}

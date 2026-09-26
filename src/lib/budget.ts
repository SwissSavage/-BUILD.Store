/** Display an optional project budget without implying unpaid work. */
export function formatBudget(value: string | number | null | undefined): string {
  const amount = Number(value);
  return Number.isFinite(amount) && amount > 0
    ? `$${amount.toLocaleString("en-US")}`
    : "Undisclosed";
}

export const MAX_INSTALLMENT_COUNT = 120;

export function shiftInstallmentDate(startOn: string, monthOffset: number) {
  const [year, month, day] = startOn.split("-").map(Number);
  const absoluteMonth = year * 12 + (month - 1) + monthOffset;
  const targetYear = Math.floor(absoluteMonth / 12);
  const targetMonthIndex = ((absoluteMonth % 12) + 12) % 12;
  const lastDay = new Date(
    Date.UTC(targetYear, targetMonthIndex + 1, 0),
  ).getUTCDate();
  const targetDay = Math.min(day, lastDay);
  return `${String(targetYear).padStart(4, "0")}-${String(
    targetMonthIndex + 1,
  ).padStart(2, "0")}-${String(targetDay).padStart(2, "0")}`;
}

export function installmentPaymentMinor(
  totalMinor: number,
  count: number,
  index: number,
) {
  const each = Math.floor(totalMinor / count);
  return each + (index < totalMinor % count ? 1 : 0);
}

export function installmentRemainingMinor(
  totalMinor: number,
  count: number,
  paidThroughIndex: number,
) {
  const completed = Math.min(Math.max(paidThroughIndex + 1, 0), count);
  const each = Math.floor(totalMinor / count);
  const paid = each * completed + Math.min(totalMinor % count, completed);
  return Math.max(totalMinor - paid, 0);
}

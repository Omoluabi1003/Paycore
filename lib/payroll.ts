import { z } from "zod";
import Decimal from "decimal.js";

// Isolate financial precision and rounding from application-wide Decimal settings.
const Money = Decimal.clone({ precision: 40, rounding: Decimal.ROUND_HALF_UP });

export const MoneySchema = z.number().finite().nonnegative();

export const PayrollInputSchema = z.object({
  grossRevenue: MoneySchema,
  contractorRatePercent: z.number().min(0).max(100),
  factoringRatePercent: z.number().min(0).max(100).default(0),
  deductions: z.array(z.object({ label: z.string().min(1), amount: MoneySchema })).default([]),
  reimbursements: z.array(z.object({ label: z.string().min(1), amount: MoneySchema })).default([]),
});

export type PayrollInput = z.input<typeof PayrollInputSchema>;

const cents = (value: number) => {
  const exact = new Money(value).times(100).toDecimalPlaces(0);
  if (exact.abs().greaterThan(Number.MAX_SAFE_INTEGER)) throw new RangeError("Payroll amount exceeds the safe currency range.");
  return BigInt(exact.toFixed(0));
};
const dollars = (value: bigint) => {
  if (value > BigInt(Number.MAX_SAFE_INTEGER) || value < -BigInt(Number.MAX_SAFE_INTEGER)) throw new RangeError("Payroll amount exceeds the safe currency range.");
  return Number(value) / 100; // Presentation only; never reused for calculation.
};
// Legacy decimal-percent adapter retains sub-basis-point inputs for old exports.
// New contractor agreements accept integer basis points in settlements.ts.
const percentage = (amount: bigint, percent: number) => {
  const exact = new Money(percent);
  const scale = new Money(10).pow(exact.decimalPlaces());
  const numerator = BigInt(exact.times(scale).toFixed(0));
  const denominator = BigInt(scale.times(100).toFixed(0));
  return (amount * numerator * BigInt(2) + denominator) / (denominator * BigInt(2));
};

export function calculateSettlement(input: PayrollInput) {
  const data = PayrollInputSchema.parse(input);
  const gross = cents(data.grossRevenue);
  const contractorEarnings = percentage(gross, data.contractorRatePercent);
  const factoring = percentage(gross, data.factoringRatePercent);
  const deductions = data.deductions.reduce((sum, item) => sum + cents(item.amount), factoring);
  const reimbursements = data.reimbursements.reduce((sum, item) => sum + cents(item.amount), BigInt(0));
  const net = contractorEarnings - deductions + reimbursements;

  return {
    grossRevenue: dollars(gross),
    contractorEarnings: dollars(contractorEarnings),
    factoringCharge: dollars(factoring),
    totalDeductions: dollars(deductions),
    totalReimbursements: dollars(reimbursements),
    netPay: dollars(net),
    warnings: net < BigInt(0) ? ["Net pay is negative. Review deductions before approval."] : [],
  } as const;
}

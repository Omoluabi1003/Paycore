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

const cents = (value: number) => new Money(value).times(100).toDecimalPlaces(0);
const dollars = (value: Decimal) => {
  if (value.abs().greaterThan(Number.MAX_SAFE_INTEGER)) {
    throw new RangeError("Payroll amount exceeds the safe currency range.");
  }
  return value.dividedBy(100).toNumber();
};

export function calculateSettlement(input: PayrollInput) {
  const data = PayrollInputSchema.parse(input);
  const gross = cents(data.grossRevenue);
  const contractorEarnings = gross.times(data.contractorRatePercent).dividedBy(100).toDecimalPlaces(0);
  const factoring = gross.times(data.factoringRatePercent).dividedBy(100).toDecimalPlaces(0);
  const deductions = data.deductions.reduce((sum, item) => sum.plus(cents(item.amount)), factoring);
  const reimbursements = data.reimbursements.reduce((sum, item) => sum.plus(cents(item.amount)), new Money(0));
  const net = contractorEarnings.minus(deductions).plus(reimbursements);

  return {
    grossRevenue: dollars(gross),
    contractorEarnings: dollars(contractorEarnings),
    factoringCharge: dollars(factoring),
    totalDeductions: dollars(deductions),
    totalReimbursements: dollars(reimbursements),
    netPay: dollars(net),
    warnings: net.isNegative() ? ["Net pay is negative. Review deductions before approval."] : [],
  } as const;
}

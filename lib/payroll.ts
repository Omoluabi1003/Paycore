import { z } from "zod";

export const MoneySchema = z.number().finite().nonnegative();

export const PayrollInputSchema = z.object({
  grossRevenue: MoneySchema,
  contractorRatePercent: z.number().min(0).max(100),
  factoringRatePercent: z.number().min(0).max(100).default(0),
  deductions: z.array(z.object({ label: z.string().min(1), amount: MoneySchema })).default([]),
  reimbursements: z.array(z.object({ label: z.string().min(1), amount: MoneySchema })).default([]),
});

export type PayrollInput = z.input<typeof PayrollInputSchema>;

const cents = (value: number) => Math.round((value + Number.EPSILON) * 100);
const dollars = (value: number) => value / 100;

export function calculateSettlement(input: PayrollInput) {
  const data = PayrollInputSchema.parse(input);
  const gross = cents(data.grossRevenue);
  const contractorEarnings = Math.round(gross * (data.contractorRatePercent / 100));
  const factoring = Math.round(gross * (data.factoringRatePercent / 100));
  const deductions = data.deductions.reduce((sum, item) => sum + cents(item.amount), 0) + factoring;
  const reimbursements = data.reimbursements.reduce((sum, item) => sum + cents(item.amount), 0);
  const net = contractorEarnings - deductions + reimbursements;

  return {
    grossRevenue: dollars(gross),
    contractorEarnings: dollars(contractorEarnings),
    factoringCharge: dollars(factoring),
    totalDeductions: dollars(deductions),
    totalReimbursements: dollars(reimbursements),
    netPay: dollars(net),
    warnings: net < 0 ? ["Net pay is negative. Review deductions before approval."] : [],
  } as const;
}

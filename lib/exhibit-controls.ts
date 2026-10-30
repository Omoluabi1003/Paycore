export const presentationSteps = [
  { title: "Set the agreement", text: "Enter a contractor and their agreed pay terms. PayCore remembers this configuration for later payrolls.", action: "Open contractor setup" },
  { title: "Capture what happened", text: "Enter loads, described receipts and reimbursements. PayCore calculates earnings and deductions from the configured rules.", action: "Open payroll desk" },
  { title: "Resolve the exceptions", text: "Compare fuel totals and receipt references. Correct source entries with a reason, then watch readiness update.", action: "Open exception walkthrough" },
  { title: "Explain the settlement", text: "Follow each earning and deduction to net pay. Compare with the previous approved workspace when one exists.", action: "Show settlement explanation" },
  { title: "Let a person decide", text: "Complete the preparation checks and statement review. Only your explicit local approval freezes these workspace figures.", action: "Open approval review" },
  { title: "Show the contractor perspective", text: "Preview the selected contractor's statement, deductions, advance balance and approved-history totals.", action: "Show contractor preview" },
  { title: "Continue to the next payday", text: "After local approval, open the next period. Agreements and remaining advances carry forward; new activity starts blank.", action: "Continue to next payday" },
] as const;
export function demoDraftKeys(keys: string[], scope: string): string[] {
  const prefix = `paycore-demo-draft-v1:${encodeURIComponent(scope)}:`;
  return keys.filter(key => key.startsWith(prefix));
}

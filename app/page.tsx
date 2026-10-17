import Workspace from "./workspace";
import { calculateSettlement } from "../lib/payroll";
export default function Home() {
    const contractors = [
        { name: "Avery Mitchell", initials: "AM", reference: "PC-001", gross: 18450, rate: 72, deduction: 650, reimbursement: 120 },
        { name: "Jordan Ellis", initials: "JE", reference: "PC-002", gross: 15360, rate: 68, deduction: 420, reimbursement: 85 },
        { name: "Morgan Taylor", initials: "MT", reference: "PC-003", gross: 14450, rate: 70, deduction: 0, reimbursement: 0 },
    ].map((person) => ({ ...person, settlement: calculateSettlement({
            grossRevenue: person.gross, contractorRatePercent: person.rate, factoringRatePercent: 2.5,
            deductions: [{ label: "Sample advance", amount: person.deduction }],
            reimbursements: [{ label: "Sample reimbursement", amount: person.reimbursement }],
        }) }));
    return <Workspace contractors={contractors}/>;
}

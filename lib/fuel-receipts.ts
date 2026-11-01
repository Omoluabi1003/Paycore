import {TransactionSchema,parseDecimalEntry,safeCents} from "./settlements.ts";
import type {CalculationInput} from "./settlements.ts";
export function createFuelReceipt(input:CalculationInput,entry:{date:string;documentNumber:string;description:string;place:string;cityState:string;amount:string},context:{id:string;actor:string;at:string}){
 if(!['DRAFT','REVIEW'].includes(input.run.status))throw Error('Fuel receipts can only be added to an unapproved payroll.');
 if(!entry.place.trim()||!entry.cityState.trim())throw Error('Enter the place or store and city/state from the receipt.');
 const amountCents=parseDecimalEntry(entry.amount);if(amountCents<=0)throw Error('Enter a fuel receipt amount greater than zero.');
 const parsed=TransactionSchema.safeParse({id:`sample-entry-${context.id}`,companyId:input.run.companyId,contractorId:input.contractor.id,payPeriodId:input.run.payPeriodId,transactionType:'FUEL_DEDUCTION',referenceNumber:entry.documentNumber,transactionDate:entry.date,description:entry.description,place:entry.place,cityState:entry.cityState,amountCents,miles:0,source:'MANUAL',enteredBy:context.actor,createdAt:context.at});
 if(!parsed.success)throw Error('Check the receipt date, document number, description and location fields.');
 const transaction=parsed.data;
 if(transaction.transactionDate<input.run.start||transaction.transactionDate>input.run.end)throw Error('Choose a date within this pay period.');
 if(input.transactions.some(item=>item.id===transaction.id))throw Error('This receipt entry already exists.');
 return {...input,transactions:[...input.transactions,transaction]};
}
export function fuelReceiptTotal(input:CalculationInput){return safeCents(input.transactions.filter(tx=>tx.transactionType==='FUEL_DEDUCTION').reduce((total,tx)=>total+BigInt(tx.amountCents),BigInt(0)));}

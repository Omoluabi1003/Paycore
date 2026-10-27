export type ReminderStage="BEFORE_DUE"|"DUE_TODAY"|"OVERDUE_3"|"OVERDUE_7"|"OVERDUE_14";
export type ReminderEvent={invoiceId:string;stage:ReminderStage;scheduledFor:string;sentAt?:string;status:"PENDING"|"SENT"|"FAILED"|"SKIPPED";reason?:string};
export type ReminderCandidate={id:string;number:string;customer:string;customerEmail:string;dueOn:string;status:string;balanceCents:number};
const DAY=86_400_000;
const day=(value:string)=>Date.parse(`${value}T00:00:00Z`);
export const reminderSchedule=[
 {stage:"BEFORE_DUE" as const,offset:-3,label:"Friendly reminder"},
 {stage:"DUE_TODAY" as const,offset:0,label:"Payment due today"},
 {stage:"OVERDUE_3" as const,offset:3,label:"Payment overdue"},
 {stage:"OVERDUE_7" as const,offset:7,label:"Second reminder"},
 {stage:"OVERDUE_14" as const,offset:14,label:"Final reminder / operator review"},
];
export function reminderDate(dueOn:string,offset:number){return new Date(day(dueOn)+offset*DAY).toISOString().slice(0,10);}
export function dueReminderStages(invoice:ReminderCandidate,asOf:string,events:ReminderEvent[]=[]){
 if(!invoice.customerEmail||invoice.balanceCents<=0||["PAID","VOID","CANCELLED"].includes(invoice.status))return [];
 const sent=new Set(events.filter(e=>e.invoiceId===invoice.id&&e.status==="SENT").map(e=>e.stage));
 return reminderSchedule.filter(rule=>reminderDate(invoice.dueOn,rule.offset)<=asOf&&!sent.has(rule.stage));
}
export function reminderId(invoiceId:string,stage:ReminderStage){return `${invoiceId}:${stage}`;}
export function reminderSubject(stage:ReminderStage,invoiceNumber:string){
 if(stage==="BEFORE_DUE")return `Friendly reminder: invoice ${invoiceNumber}`;
 if(stage==="DUE_TODAY")return `Invoice ${invoiceNumber} is due today`;
 return `Payment reminder: invoice ${invoiceNumber}`;
}
export function reminderText(invoice:ReminderCandidate,stage:ReminderStage){
 const opening=stage==="BEFORE_DUE"?"This is a friendly reminder that":stage==="DUE_TODAY"?"This is a reminder that":"Our records show that";
 return `${opening} invoice ${invoice.number} has an outstanding balance and is due ${invoice.dueOn}. Please review the invoice and arrange payment. If payment has already been made, please disregard this reminder.\n\nThank you.`;
}

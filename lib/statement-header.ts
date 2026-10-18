import { z } from "zod";
const field = z.string().trim().max(120).default("");
const optionalDate = z.string().default("").refine(value => value === "" || /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0,10) === value, "Enter a valid invoice pay date.");
function validLogo(logo:{data:string;width:number;height:number}) {
 try { const bytes=Uint8Array.from(atob(logo.data.split(",")[1]),char=>char.charCodeAt(0));if(bytes[0]!==255||bytes[1]!==216||bytes.at(-2)!==255||bytes.at(-1)!==217)return false;
  let position=2;while(position+8<bytes.length){if(bytes[position++]!==255)return false;while(bytes[position]===255)position++;const marker=bytes[position++];if(marker===218||marker===217)return false;const length=(bytes[position]<<8)|bytes[position+1];if(length<2||position+length>bytes.length)return false;
   if([192,193,194].includes(marker))return bytes[position+2]===8&&bytes[position+7]===3&&((bytes[position+3]<<8)|bytes[position+4])===logo.height&&((bytes[position+5]<<8)|bytes[position+6])===logo.width;
   position+=length;
  }return false;
 }catch{return false;}
}
export const StatementHeaderSchema = z.object({ address: field, cityStateZip: field, email: z.union([z.literal(""), z.string().trim().email().max(120)]).default(""), phone: field, mcNumber: field, usdotNumber: field, payrollNumber: field, invoicePayDate: optionalDate, logo: z.object({ data: z.string().max(100000).regex(/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/), width: z.number().int().min(1).max(320), height: z.number().int().min(1).max(160) }).refine(validLogo,"Choose a valid, resized JPEG logo.").optional() });
export type StatementHeader = z.infer<typeof StatementHeaderSchema>;
export const emptyStatementHeader = (): StatementHeader => StatementHeaderSchema.parse({});
export const nextStatementHeader = (header?: StatementHeader): StatementHeader => ({...StatementHeaderSchema.parse(header ?? {}), payrollNumber:"", invoicePayDate:""});

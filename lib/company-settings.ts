import {z} from "zod";
import {StatementHeaderSchema,nextStatementHeader} from "./statement-header.ts";
import type {StatementHeader} from "./statement-header.ts";
export const companySettingsKey=(scope:string)=>`paycore-company-settings-v1:${encodeURIComponent(scope)}`;
const schema=z.object({version:z.literal(1),scope:z.string(),header:StatementHeaderSchema});
export const reusableCompanyHeader=(header:StatementHeader)=>nextStatementHeader(header);
export function encodeCompanySettings(scope:string,header:StatementHeader){return JSON.stringify(schema.parse({version:1,scope,header:reusableCompanyHeader(header)}));}
export function decodeCompanySettings(value:string,scope:string){if(value.length>120000)throw Error("Company settings exceed the supported size.");const saved=schema.parse(JSON.parse(value));if(saved.scope!==scope)throw Error("Company settings belong to another workspace.");return reusableCompanyHeader(saved.header);}
export function invoiceLetterhead(companyName:string,header:StatementHeader){companyName=header.legalName?.trim()||companyName;return {standardFooter:header.invoiceFooter?.trim()||((header.email||header.phone)?[`Invoice questions: ${companyName}`,header.email,header.phone].filter(Boolean).join(" | "):""),paymentInstructions:header.invoicePaymentInstructions??"",issuer:companyName,issuerAddress:[header.address,header.cityStateZip,header.mcNumber?`MC ${header.mcNumber}`:"",header.usdotNumber?`USDOT ${header.usdotNumber}`:"",header.email,header.phone].filter(Boolean).join(" | "),factoringName:header.factoringName??"",factoringAddress:header.factoringAddress??"",factoringContact:header.factoringContact??"",factoringEmail:header.factoringEmail??""};}

export const hasCompanyHeader=(header:StatementHeader)=>Boolean(header.legalName||header.address||header.cityStateZip||header.email||header.phone||header.mcNumber||header.usdotNumber||header.factoringName||header.factoringAddress||header.factoringContact||header.factoringEmail||header.invoicePaymentInstructions||header.invoiceFooter);

// A legacy draft can predate company settings. Do not erase its entered address
// or remittance details just because the reusable settings have not been set up.
export function applyInvoiceCompanyDefaults<T extends {issuer:string;issuerAddress:string;factoringName?:string;factoringAddress?:string;factoringContact?:string;factoringEmail?:string;paymentInstructions?:string;standardFooter?:string}>(invoice:T,companyName:string,header:StatementHeader):T{
 const defaults=invoiceLetterhead(companyName,header);
 const factoringConfigured=Boolean(header.factoringName||header.factoringAddress||header.factoringContact||header.factoringEmail);
 return {...invoice,...defaults,issuerAddress:defaults.issuerAddress||invoice.issuerAddress,standardFooter:header.invoiceFooter!==undefined?defaults.standardFooter:defaults.standardFooter||invoice.standardFooter,paymentInstructions:header.invoicePaymentInstructions===undefined?invoice.paymentInstructions:header.invoicePaymentInstructions,...(!factoringConfigured?{factoringName:invoice.factoringName,factoringAddress:invoice.factoringAddress,factoringContact:invoice.factoringContact,factoringEmail:invoice.factoringEmail}:{})};
}

export function companySetupIssues(header:StatementHeader){
 const missing:string[]=[];
 if(!header.address.trim())missing.push('company address');
 if(!header.cityStateZip.trim())missing.push('company city, state and ZIP');
 if(!header.email.trim()&&!header.phone.trim())missing.push('company email or phone');
 if(!header.factoringName?.trim())missing.push('factoring company name');
 if(!header.factoringAddress?.trim())missing.push('factoring company address');
 if(!header.factoringEmail?.trim())missing.push('authorized factoring invoice email');
 return missing;
}
export function importCompanySettings(value:string):StatementHeader{
 if(value.length>120000)throw Error('The company settings file is too large.');
 try{return z.object({version:z.literal(1),header:StatementHeaderSchema}).strict().parse(JSON.parse(value)).header;}
 catch{throw Error('Choose a valid PayCore company settings JSON file.');}
}

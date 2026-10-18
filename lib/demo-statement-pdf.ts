import { StatementHeaderSchema } from "./statement-header.ts";
import { statementBoldFont, statementBoldFontBase64 } from "./pdf-fonts/century-gothic-bold-italic.ts";
import { statementFont, statementFontBase64 } from "./pdf-fonts/tr-century-gothic-italic.ts";
import type { DemoApproval } from "./demo-payroll.ts";
import type { ApprovedSettlement } from "./settlements.ts";
import { safeCents, yearToDate } from "./settlements.ts";
import { workbookStatement } from "./workbook-statement.ts";

type Cell = string;
type Column = { label: string; width: number; right?: boolean };
type ReportRow = { cells: Cell[]; total?: boolean; highlight?: boolean };
const clean = (value: string) => value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^\x20-\x7e]/g, "?");
const escape = (value: string) => clean(value).replace(/[\\()]/g, "\\$&");
// Measure the actual embedded font, with space for italic overhang.
const width = (value: string, size: number, bold = false) => {
  const font = bold ? statementBoldFont : statementFont;
  return [...clean(value)].reduce((total, char) => total + (font.widths[char as keyof typeof font.widths] ?? 600) * size / 1000, 0);
};
function wrap(value: string, limit: number, size: number, bold = false): string[] {
  const lines: string[] = []; let line = "";
  for (const word of clean(value).split(/\s+/)) {
    if (line && width(`${line} ${word}`, size, bold) > limit) { lines.push(`${line} `); line = ""; }
    for (const char of `${line ? " " : ""}${word}`) { if (width(line + char, size, bold) > limit) { lines.push(line); line = ""; } line += char; }
  }
  if (line || !lines.length) lines.push(line);
  return lines;
}
const sum = (values: number[]) => safeCents(values.reduce((total, value) => total + BigInt(value), BigInt(0)));
/** All report amounts come from the frozen settlement and approved history. */
export function statementReport(state: DemoApproval, snapshot: ApprovedSettlement) {
  const history = [...(state.history ?? []), snapshot].filter(item => item.status === "APPROVED" && item.companyId === snapshot.companyId && item.contractorId === snapshot.contractorId && item.end.slice(0, 4) === snapshot.end.slice(0, 4) && item.end <= snapshot.end);
  const view = workbookStatement(snapshot);
  const historicalViews = history.map(item => workbookStatement(item));
  return {
    view, ytd: yearToDate(history, snapshot.companyId, snapshot.contractorId, snapshot.end),
    deductions: view.groups.map(group => ({ ...group, ytdCents: sum(historicalViews.map(item => item.groups.find(previous => previous.label === group.label)?.amountCents ?? 0)) })),
    earnings: [...new Set(history.flatMap(item => item.lines.filter(line => line.kind === "EARNING").map(line => line.category)))].map(category => ({ category, current: sum(snapshot.lines.filter(line => line.kind === "EARNING" && line.category === category).map(line => line.amountCents)), ytd: sum(history.flatMap(item => item.lines.filter(line => line.kind === "EARNING" && line.category === category).map(line => line.amountCents))) })),
  };
}

/** Excel-style Letter statement with the supplied TR Century Gothic Italic embedded. */
export function renderDemoPdf(state: DemoApproval, dollars: (cents: number) => string, contractorIds?: readonly string[]): Uint8Array {
  const header = StatementHeaderSchema.parse(state.statementHeader ?? {});
  const pages: string[][] = [];
  const text = (x: number, y: number, size: number, value: string, bold = false) => `q BT /${bold ? "F2" : "F1"} ${size} Tf 0 Tr ${x} ${y} Td (${escape(value)}) Tj ET Q`;
  const money = (value: number) => `$ ${dollars(value)}`;
  for (const [index, snapshot] of state.snapshots.entries()) {
    if(contractorIds&&!contractorIds.includes(snapshot.contractorId))continue;
    const { view, ytd, deductions, earnings } = statementReport(state, snapshot);
    const frozen = snapshot.calculationSnapshot, contractor = frozen.contractor;
    let content: string[] = [], y = 0;
    const rect = (x: number, top: number, w: number, height: number, color?: string) => {
      if (color) content.push(`${color} rg ${x} ${top - height} ${w} ${height} re f`);
      content.push(`0.18 0.22 0.25 RG 0.4 w ${x} ${top - height} ${w} ${height} re S 0 0 0 rg`);
    };
    function newPage() {
      content = []; pages.push(content);
      const companyLines = wrap(state.companyName, 143, 8, true);
      const companyInfo = [header.address, header.cityStateZip, header.email ? `Email: ${header.email}` : "", header.phone ? `Phone: ${header.phone}` : "", [header.mcNumber ? `MC ${header.mcNumber}` : "",header.usdotNumber ? `USDOT ${header.usdotNumber}` : ""].filter(Boolean).join(" | ")].filter(Boolean).flatMap(value=>wrap(value,143,5.5));
      const bannerHeight = Math.max(50,companyLines.length*10+companyInfo.length*7+9);
      rect(28,760,556,bannerHeight,"0.78 0.93 0.98");
      rect(28,760,153,bannerHeight,"0.86 0.95 0.82");
      companyLines.forEach((line,i)=>content.push(text(104.5-width(line,8,true)/2,748-i*10,8,line,true)));
      companyInfo.forEach((line,i)=>content.push(text(104.5-width(line,5.5)/2,748-companyLines.length*10-i*7,5.5,line)));
      content.push(text(236,735,13,"CONTRACTOR PAYROLL",true));
      // Existing PayCore vector mark; never reuse the private logo from the reference.
      content.push("q 0.4 0 0 -0.4 488 752 cm", "0.086 0.349 0.306 rg 19 0 m 45 0 l 55.49 0 64 8.51 64 19 c 64 45 l 64 55.49 55.49 64 45 64 c 19 64 l 8.51 64 0 55.49 0 45 c 0 19 l 0 8.51 8.51 0 19 0 c f", "0.965 0.973 0.941 rg 20 16 m 35 16 l 44 16 50 21.7 50 30 c 50 38.3 44 44 35 44 c 29 44 l 29 53 l 20 53 l h 29 25 m 29 35 l 35 35 l 38.9 35 41 33.2 41 30 c 41 26.8 38.9 25 35 25 c h f*", "0.706 0.831 0.639 rg 50 49 m 50 51.761 47.761 54 45 54 c 42.239 54 40 51.761 40 49 c 40 46.239 42.239 44 45 44 c 47.761 44 50 46.239 50 49 c f Q");
      content.push("0.086 0.349 0.306 rg", text(520, 733, 11, "PayCore", true), "0 0 0 rg");
      const identityTop=760-bannerHeight;
      const names=wrap(`CONTRACTOR NAME: ${contractor.displayName}`,544,6,true),identityHeight=names.length*8+3;
      rect(28,identityTop,556,identityHeight,"0.91 0.93 0.95");
      names.forEach((line,i)=>content.push(text(34,identityTop-8-i*8,6,line,true)));
      y=identityTop-identityHeight;
      const contactRows=[[`ID number: ${contractor.contractorNumber}`,`Pay begin date: ${snapshot.start}`],[`Address: ${contractor.address||"Not entered"}`,`Pay end date: ${snapshot.end}`],[`City, state: ${contractor.cityStateZip||"Not entered"}`,`Payroll #: ${header.payrollNumber||"Not entered"}`],[`Phone: ${contractor.phone||"Not entered"}`,`Invoice pay date: ${header.invoicePayDate||"Not entered"}`]];
      const contactTop=y;
      for(const [rowIndex,row] of contactRows.entries()){
        const cells=[wrap(row[0],164,5.5),wrap(row[1],202,5.5)],height=Math.max(...cells.map(cell=>cell.length))*7+3;
        if(rowIndex%2===0){content.push(`0.86 0.95 0.98 rg 28 ${y-height} 174 ${height} re f 372 ${y-height} 212 ${height} re f 0 0 0 rg`);}
        cells.forEach((lines,column)=>lines.forEach((line,i)=>content.push(text(column===0?33:377,y-7-i*7,5.5,line))));y-=height;
      }
      rect(28,contactTop,556,contactTop-y);rect(28,contactTop,174,contactTop-y);rect(372,contactTop,212,contactTop-y);
      y-=4;
      const metadata=`Pay period: ${snapshot.start} to ${snapshot.end} | Statement DEMO-${state.payrollRunId}-${index+1} | DEMO ${state.status} | ${state.paidAt?"Marked paid in demo; no funds moved":"Not marked paid"}`;
      for(const line of wrap(metadata,550,5.5)){content.push(text(28,y-7,5.5,line));y-=8;}y-=6;
    }
    function ensure(height: number) { if (y - height < 58) newPage(); }
    function note(value: string, bold = false) {
      const lines = wrap(value, 544, 7, bold);
      for (const line of lines) { ensure(11); content.push(text(32, y - 8, 7, line, bold)); y -= 11; }
    }
    function table(title:string,columns:Column[],rows:ReportRow[],x=28,minHeight=0){
      const w=columns.reduce((total,column)=>total+column.width,0),fontSize=6.2;
      const prepared=rows.map(row=>({row,lines:row.cells.map((cell,i)=>wrap(cell,columns[i].width-10,fontSize,row.total))}));
      const natural=23+prepared.reduce((total,{lines})=>total+Math.max(10,Math.max(...lines.map(item=>item.length))*8+2),0);
      const padding=Math.max(0,minHeight-natural);let segmentTop=0;
      const heading=(continued=false)=>{
        segmentTop=y;const label=`${title}${continued?" (continued)":""}`;
        rect(x,y,Math.min(w,width(label,6,true)+14),10,"0.91 0.93 0.95");content.push(text(x+5,y-7.5,6,label,true));y-=10;
        rect(x,y,w,13,"0.91 0.93 0.95");let left=x;
        columns.forEach(column=>{content.push(text(left+4,y-9,5.7,column.label,true));left+=column.width;});y-=13;
      };
      ensure(Math.max(48,Math.min(minHeight,220)));heading();
      for(const [rowIndex,{row,lines}] of prepared.entries()){
        if(rowIndex===prepared.length-1&&padding>0&&y-padding>78)y-=padding;
        const count=Math.max(1,...lines.map(item=>item.length));let offset=0;
        while(offset<count){
          if(y<78){rect(x,segmentTop,w,segmentTop-y);newPage();heading(true);}
          const available=Math.max(1,Math.floor((y-64)/8)),chunk=Math.min(count-offset,available),height=Math.max(10,chunk*8+2);
          if(row.total)rect(x,y,w,height,"0.91 0.93 0.95");
          if(row.highlight)rect(x+w-columns[columns.length-1].width,y,columns[columns.length-1].width,height,"0.86 0.95 0.82");
          let left=x;columns.forEach((column,i)=>{lines[i].slice(offset,offset+chunk).forEach((line,j)=>content.push(text(column.right?left+column.width-5-width(line,fontSize,row.total):left+4,y-8-j*8,fontSize,line,row.total)));left+=column.width;});y-=height;offset+=chunk;
        }
      }
      rect(x,segmentTop,w,segmentTop-y);y-=7;
    }
    newPage();
    const percentage=(value:number)=>`${dollars(value).replace(/\.00$/,"")}%`;
    const terms=snapshot.compensationRateBasisPoints===undefined?snapshot.compensationMethod.replaceAll("_"," "):`${percentage(snapshot.compensationRateBasisPoints)} of eligible revenue`;
    const sideTop=y,sidePage=pages.length;
    table("HOURS AND EARNINGS",[{label:"Description",width:160},{label:"Rate",width:36},{label:"Hours",width:32},{label:"Earnings",width:58,right:true},{label:"YTD earnings",width:58,right:true}],[
      ...earnings.map(item=>({cells:[item.category.replaceAll("_"," "),item.category===snapshot.compensationMethod&&snapshot.compensationRateBasisPoints!==undefined?percentage(snapshot.compensationRateBasisPoints):"-","-",money(item.current),money(item.ytd)]})),
      {cells:["TOTAL OF ALL EARNINGS","","",money(snapshot.grossEarningsCents),money(ytd.earningsCents)],total:true},
    ],28,100);
    const earningsEnd=y;if(pages.length===sidePage){rect(372,sideTop,212,40);y=sideTop-40;}
    table("PAYMENT DETAILS",[{label:"Method",width:72},{label:"Status",width:70},{label:"Amount",width:70,right:true}],[
      {cells:[contractor.paymentMethod.replaceAll("_"," "),state.paidAt?"Marked paid in demo":"Not marked paid","-"]},
      {cells:["Bank / account","Not configured","-"]},
      {cells:["Net settlement","No real transfer",money(snapshot.netSettlementCents)],total:true,highlight:true},
    ],372,60);
    if(pages.length===sidePage)y=Math.min(y,earningsEnd);
    const deductionTop=y,deductionPage=pages.length;
    table("DEDUCTIONS BY CATEGORY",[{label:"Description",width:172},{label:"Current",width:86,right:true},{label:"YTD",width:86,right:true}],[
      ...deductions.map(group=>({cells:[group.label,money(group.amountCents),money(group.ytdCents)]})),
      {cells:["TOTAL DEDUCTIONS",money(view.totalDeductionsCents),money(ytd.deductionsCents)],total:true},
    ],28,155);
    if(pages.length===deductionPage){rect(372,deductionTop,106,10,"0.91 0.93 0.95");rect(478,deductionTop,106,10,"0.91 0.93 0.95");rect(372,deductionTop-10,212,13,"0.91 0.93 0.95");rect(372,deductionTop-10,106,deductionTop-y-17);rect(478,deductionTop-10,106,deductionTop-y-17);}
    table("TOTALS",[{label:"Period",width:60},{label:"Total earnings",width:124,right:true},{label:"Deductions",width:124,right:true},{label:"Reimb. / adjustments",width:124,right:true},{label:"Net pay",width:124,right:true}],[
      {cells:["Current",money(snapshot.grossEarningsCents),money(view.totalDeductionsCents),money(sum([snapshot.reimbursementsCents,snapshot.adjustmentsCents])),money(snapshot.netSettlementCents)],total:true},
      {cells:["YTD",money(ytd.earningsCents),money(ytd.deductionsCents),"Included in YTD net",money(ytd.netCents)]},
    ]);
    const details: ReportRow[] = [
      ...view.deductionDetails.map(line => ({ cells: [line.date ?? "Configured", line.reference ? `Reference: ${line.reference}` : "Agreement", line.description, "-", "-", money(line.amountCents)] })),
      ...snapshot.lines.filter(line => line.kind === "REIMBURSEMENT" || line.kind === "ADJUSTMENT").map(line => { const tx = frozen.transactions.find(tx => line.sourceId === `transaction:${tx.id}`); return { cells: [tx?.transactionDate ?? snapshot.end, tx?.referenceNumber ?? "-", `${line.kind === "ADJUSTMENT" ? "Adjustment" : "Reimbursement"}: ${line.description}`, "-", "-", money(line.amountCents)] }; }),
    ];
    if(details.length)details.push({cells:["TOTALS","","Listed entries","","",money(sum([...view.deductionDetails.map(line=>line.amountCents),...snapshot.lines.filter(line=>line.kind==="REIMBURSEMENT"||line.kind==="ADJUSTMENT").map(line=>line.amountCents)]))],total:true});
    table("ADVANCES, DEDUCTIONS AND REIMBURSEMENT DETAILS",[{label:"Date",width:54},{label:"Document no.",width:85},{label:"Description",width:227},{label:"Place",width:64},{label:"City, state",width:56},{label:"Amount",width:70,right:true}],details.length?details:[{cells:["-","-","No deductions, reimbursements or adjustments.","-","-","-"]}],28,86);
    if (view.expectedFuelCents !== undefined) note(`Fuel source check: entered ${money(view.fuelDetailCents)} | expected ${money(view.expectedFuelCents)} | ${view.fuelMatches ? "Matched" : "Mismatch"}. Fuel is deducted once.`);
    const loadRows: ReportRow[] = frozen.loads.map(load => {
      const earning = snapshot.lines.filter(line => line.kind === "EARNING" && line.sourceId === `load:${load.id}`);
      const eligible = load.status === "ELIGIBLE";
      const applied=earning.length===1?frozen.compensationRules.find(rule=>rule.id===earning[0].ruleId):undefined;const rate=eligible&&applied?.method==="PERCENT_OF_ELIGIBLE_REVENUE"&&applied.rateBasisPoints!==undefined?percentage(applied.rateBasisPoints):"-";
      return { cells: [load.date, `${load.loadNumber}${load.proNumber !== load.loadNumber ? ` / ${load.proNumber}` : ""}`, `${load.origin} to ${load.destination}${eligible ? "" : " (Excluded)"}`, String(load.loadedMiles), String(load.emptyMiles), money(load.grossRevenueCents),rate, eligible && earning.length ? money(sum(earning.map(line => line.amountCents))) : eligible ? "See earnings" : "Excluded"] };
    });
    for (const tx of frozen.transactions.filter(tx => tx.transactionType === "LOAD_REVENUE")) {
      const earning = snapshot.lines.filter(line => line.kind === "EARNING" && line.sourceId === `transaction:${tx.id}`);
      loadRows.push({ cells: [tx.transactionDate, tx.referenceNumber, `${tx.description} | Entered miles: ${tx.miles}`, "-", "-", money(tx.amountCents),"-", earning.length ? money(sum(earning.map(line => line.amountCents))) : "See earnings"] });
    }
    if (loadRows.length) {
      const attributedEarnings = snapshot.lines.filter(line => line.kind === "EARNING" && line.sourceId && (frozen.loads.some(load => line.sourceId === `load:${load.id}`) || frozen.transactions.some(tx => tx.transactionType === "LOAD_REVENUE" && line.sourceId === `transaction:${tx.id}`)));
      loadRows.push({ cells: ["TOTALS", "", "Listed entries", String(sum(frozen.loads.map(load => load.loadedMiles))), String(sum(frozen.loads.map(load => load.emptyMiles))), money(sum([...frozen.loads.map(load => load.grossRevenueCents), ...frozen.transactions.filter(tx => tx.transactionType === "LOAD_REVENUE").map(tx => tx.amountCents)])), "", attributedEarnings.length ? money(sum(attributedEarnings.map(line => line.amountCents))) : "See earnings"], total: true });
    }
    table("LOAD DETAIL - LOADS AND ELIGIBLE REVENUE",[{label:"Date",width:50},{label:"Load / pro no.",width:95},{label:"Description / route",width:175},{label:"Loaded",width:35,right:true},{label:"Empty",width:35,right:true},{label:"Gross",width:60,right:true},{label:"Rate",width:36},{label:"Driver gross",width:70,right:true}],loadRows.length?loadRows:[{cells:["-","-","No loads in this period.","-","-","-","-","-"]}],28,80);
    note(`NET SETTLEMENT: USD ${dollars(snapshot.netSettlementCents)}`,true);
    note(`Agreed pay terms: ${terms}. Eligible revenue: ${money(snapshot.grossEligibleRevenueCents)}. Draft excluded from approved-history YTD.`);
    note(`Category totals are not additional charges. Demo YTD: earnings ${dollars(ytd.earningsCents)} / deductions ${dollars(ytd.deductionsCents)} / net ${dollars(ytd.netCents)}`);
    for (const rule of frozen.deductionRules.filter(rule => rule.remainingBalanceCents !== undefined)) {
      const deducted = sum(snapshot.lines.filter(line => line.kind === "DEDUCTION" && line.ruleId === rule.id).map(line => line.amountCents));
      note(`${rule.description}: Opening USD ${dollars(rule.remainingBalanceCents!)} | Deducted USD ${dollars(deducted)} | Remaining USD ${dollars(safeCents(BigInt(rule.remainingBalanceCents!) - BigInt(deducted)))}`);
    }

  }
  const fontObject = (font: typeof statementFont, descriptorId: number) => `<< /Type /Font /Subtype /TrueType /BaseFont /${font.postscriptName} /FirstChar 32 /LastChar 126 /Widths [${Array.from({ length: 95 }, (_, i) => font.widths[String.fromCharCode(i + 32) as keyof typeof font.widths]).join(" ")}] /Encoding /WinAnsiEncoding /FontDescriptor ${descriptorId} 0 R >>`;
  const objects = ["<< /Type /Catalog /Pages 2 0 R >>", `<< /Type /Pages /Count ${pages.length} /Kids [${pages.map((_, index) => `${5 + index * 2} 0 R`).join(" ")}] >>`, fontObject(statementFont, 5 + pages.length * 2), fontObject(statementBoldFont, 7 + pages.length * 2)];
  for (const [index, content] of pages.entries()) {
    wrap(`Approved in demo by ${state.actorName} at ${state.approvedAt}`,450,6).forEach((line,i)=>content.push(text(28,51-i*7,6,line)));
    content.push("0 0 0 rg", text(28, 34, 7, "Developed by ETL GIS Consulting LLC", true), text(493,34,7,"PayCore",true), text(28, 23, 6.5, "SIMULATION ONLY - no live payroll approval or real payment."), text(493, 23, 6.5, `Page ${index + 1} of ${pages.length}`));
    const stream = content.join("\n");
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${6 + index * 2} 0 R >>`, `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
  }
  for (const [font, base64] of [[statementFont, statementFontBase64], [statementBoldFont, statementBoldFontBase64]] as const) {
    const fontHex = [...atob(base64)].map(char => char.charCodeAt(0).toString(16).padStart(2, "0")).join("") + ">";
    objects.push(`<< /Type /FontDescriptor /FontName /${font.postscriptName} /Flags 96 /FontBBox [${font.bbox.join(" ")}] /ItalicAngle ${font.italicAngle} /Ascent ${font.ascent} /Descent ${font.descent} /CapHeight ${font.capHeight} /StemV 80 /FontFile2 ${objects.length + 2} 0 R >>`, `<< /Length ${fontHex.length} /Length1 ${font.byteLength} /Filter /ASCIIHexDecode >>\nstream\n${fontHex}\nendstream`);
  }
  let pdf = "%PDF-1.4\n"; const offsets = [0];
  objects.forEach((object, index) => { offsets.push(pdf.length); pdf += `${index + 1} 0 obj\n${object}\nendobj\n`; });
  const start = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map(offset => `${String(offset).padStart(10, "0")} 00000 n \n`).join("")}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${start}\n%%EOF\n`;
  return new TextEncoder().encode(pdf);
}

import {NextResponse} from "next/server";

export const dynamic="force-dynamic";

function authorized(request:Request){
 const secret=process.env.CRON_SECRET;
 if(!secret)return false;
 return request.headers.get("authorization")===`Bearer ${secret}`;
}

export async function GET(request:Request){
 if(!authorized(request))return NextResponse.json({ok:false,error:"Unauthorized"},{status:401});
 // Production sending intentionally fails closed until the authoritative invoice
 // repository and mail transport are configured. Never send from browser/demo state.
 const databaseConfigured=Boolean(process.env.DATABASE_URL);
 const mailConfigured=Boolean(process.env.PAYCORE_REMINDER_FROM&&process.env.PAYCORE_REMINDER_TRANSPORT);
 if(!databaseConfigured||!mailConfigured){
  return NextResponse.json({ok:true,mode:"safe-hold",databaseConfigured,mailConfigured,sent:0,message:"Reminder scheduler is active, but delivery remains held until the authoritative database and mail transport are configured."});
 }
 return NextResponse.json({ok:true,mode:"safe-hold",sent:0,message:"Delivery adapter must be explicitly implemented before reminders can leave PayCore."});
}

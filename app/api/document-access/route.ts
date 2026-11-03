// Fail closed until authenticated membership checks and private storage exist.
// This route accepts no private document data or browser-supplied profile claims.
export function GET(){return Response.json({privateImportEnabled:false,mode:'SAMPLE',message:'Private document import requires secure accounts and shared storage.'},{status:503,headers:{'Cache-Control':'no-store'}});}

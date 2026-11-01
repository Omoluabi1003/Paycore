/** Whole miles are stored separately; the displayed total is never an input. */
export function parseLoadMileage(loaded:string,empty:string){
 const parse=(value:string,label:string)=>{
  if(!/^\d+$/.test(value)||!Number.isSafeInteger(Number(value)))throw Error(`Enter whole, nonnegative ${label} miles within the supported range.`);
  return Number(value);
 };
 const loadedMiles=parse(loaded,'loaded'),emptyMiles=parse(empty,'empty');
 const total=BigInt(loadedMiles)+BigInt(emptyMiles);
 if(total>BigInt(Number.MAX_SAFE_INTEGER))throw Error('Total miles exceed the supported range.');
 return {loadedMiles,emptyMiles,totalMiles:Number(total)};
}

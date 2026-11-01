import test from 'node:test';
import assert from 'node:assert/strict';
import {parseLoadMileage} from '../lib/load-mileage.ts';
import {createDraftContractor,previewRun} from '../lib/draft-contractor.ts';
import {calculateContractorSettlement} from '../lib/settlements.ts';

test('loaded and empty miles remain distinct with an automatically calculated total',()=>{
 assert.deepEqual(parseLoadMileage('320','55'),{loadedMiles:320,emptyMiles:55,totalMiles:375});
 assert.deepEqual(parseLoadMileage('0','0'),{loadedMiles:0,emptyMiles:0,totalMiles:0});
 assert.equal(parseLoadMileage('0','55').totalMiles,55);
});
test('mileage entry rejects missing, negative, fractional and unsafe totals',()=>{
 for(const invalid of ['', '-1','1.5','1e3','NaN','9007199254740992']){
  assert.throws(()=>parseLoadMileage(invalid,'0'));assert.throws(()=>parseLoadMileage('0',invalid));
 }
 assert.throws(()=>parseLoadMileage(String(Number.MAX_SAFE_INTEGER),'1'),/Total miles/);
 assert.equal(parseLoadMileage(String(Number.MAX_SAFE_INTEGER),'0').totalMiles,Number.MAX_SAFE_INTEGER);
});
test('per-mile compensation includes entered loaded and empty miles exactly once',()=>{
 const input=createDraftContractor({name:'Synthetic Mileage Contractor',reference:'SYN-MILES',method:'PER_MILE',rate:'2.50',deduction:'0'},[],previewRun,'synthetic-miles','2026-10-05T12:00:00Z');
 const {loadedMiles,emptyMiles}=parseLoadMileage('100','25');
 input.loads.push({id:'synthetic-load',companyId:input.run.companyId,contractorId:input.contractor.id,loadNumber:'SYN-LOAD',proNumber:'SYN-LOAD',date:input.run.start,origin:'Synthetic Origin',destination:'Synthetic Destination',loadedMiles,emptyMiles,grossRevenueCents:100000,status:'ELIGIBLE'});
 const before=JSON.stringify(input),settlement=calculateContractorSettlement(input);
 assert.deepEqual(settlement.blockers,[]);assert.equal(settlement.grossEarningsCents,31250);assert.equal(settlement.netSettlementCents,31250);assert.equal(JSON.stringify(input),before);
});

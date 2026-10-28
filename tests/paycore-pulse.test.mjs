import test from "node:test";
import assert from "node:assert/strict";
import {buildPayCorePulse} from "../lib/paycore-pulse.ts";

const person=(overrides={})=>({id:"c1",name:"Alex Driver",reference:"DRV-1",status:"READY",issues:[],...overrides});

test("Pulse reports empty payroll safely",()=>{const pulse=buildPayCorePulse([]);assert.equal(pulse.state,"EMPTY");assert.equal(pulse.score,0);});
test("Pulse blocks payroll when a contractor has a blocker",()=>{const pulse=buildPayCorePulse([person({status:"BLOCKED",issues:[{code:"MISSING_RULE",message:"Compensation rule is missing.",blocking:true}]})]);assert.equal(pulse.state,"BLOCKED");assert.equal(pulse.blockers,1);assert.equal(pulse.actions[0].contractorId,"c1");});
test("Pulse requires review for unresolved warnings",()=>{const pulse=buildPayCorePulse([person({status:"REVIEW",issues:[{code:"CHECK_LOAD",message:"Confirm load source.",blocking:false}]})]);assert.equal(pulse.state,"ATTENTION");assert.equal(pulse.reviews,1);});
test("reviewed warnings do not remain in the action queue",()=>{const pulse=buildPayCorePulse([person({status:"APPROVED",issues:[{code:"CHECK_LOAD",message:"Confirm load source.",blocking:false,reason:"Verified against BOL"}]})]);assert.equal(pulse.state,"READY");assert.equal(pulse.actions.length,0);assert.equal(pulse.score,100);});

"use client";
import {useState} from "react";
import {parseLoadMileage} from "../lib/load-mileage";
export default function LoadMileageFields(){
 const [loaded,setLoaded]=useState('0'),[empty,setEmpty]=useState('0');
 let total:number|string='',error='';
 try{total=parseLoadMileage(loaded,empty).totalMiles;}catch(problem){error=problem instanceof Error?problem.message:'Check the miles entered.';}
 return <><label>Loaded miles<input name="loadedMiles" type="number" min="0" max={Number.MAX_SAFE_INTEGER} step="1" required value={loaded} onChange={event=>setLoaded(event.target.value)}/></label><label>Empty miles<input name="emptyMiles" type="number" min="0" max={Number.MAX_SAFE_INTEGER} step="1" required value={empty} onChange={event=>setEmpty(event.target.value)}/></label><label>Total miles<input readOnly value={total} placeholder="Calculated automatically"/></label>{error&&<p role="status">{error}</p>}</>;
}

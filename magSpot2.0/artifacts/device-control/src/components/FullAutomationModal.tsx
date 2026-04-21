import React, { useState, useRef, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import { X, Zap, RefreshCw, BarChart2, Clock, RotateCcw, Lock, LockOpen, Save, Scissors } from "lucide-react";
import { ACTIVITY_LIST, ACTIVITY_META, ActivityType } from "./PlatformLogos";
import { Device } from "@workspace/api-client-react";
import { useLang } from "../lib/lang";
import { loadSavedScheduleResult, mergeScheduleResultForScope, SavedScheduleResult, saveScheduleResult } from "@/lib/scheduleResults";
import { addDaysToDateKey, getTodayDateKey, useAppTimezone } from "@/lib/timezone";

const ACCENT = "#00d4e8";
const ACCENT_RGB = "0,212,232";

const ORIGINS = ["US","DE","GB","FR","IT","ES","CA","AU","NL","SE","CH","AT","PL","BR","MX","JP","KR","AR","TR","IN"];
const getOrigin = (id: number) => ORIGINS[id % ORIGINS.length];

type ScheduleAct = ActivityType | "sleep";
const ALL_ACTS: ScheduleAct[] = [...ACTIVITY_LIST, "sleep"];
const ACT_LABEL: Record<ScheduleAct, string> = {
  google_search:"Google", ytm_artist:"Artist", ytm_album:"Album",
  ytm_single:"Single", ytm_playlist:"Playlist", ytm_library:"Library",
  yt_shorts:"Shorts", tiktok:"TikTok", sleep:"Sleep",
};

const ACT_COLORS: Record<ScheduleAct, string> = {
  google_search: "rgba(59,130,246,.55)",
  ytm_artist:   "rgba(100,5,5,.80)",
  ytm_album:    "rgba(220,38,38,.62)",
  ytm_single:   "rgba(252,110,110,.58)",
  ytm_playlist: "rgba(22,163,74,.65)",
  ytm_library:  "rgba(134,239,172,.55)",
  yt_shorts:    "rgba(240,240,240,.45)",
  tiktok:       "rgba(12,12,12,.88)",
  sleep:        "rgba(120,100,220,.62)",
};
const ACT_TEXT: Record<ScheduleAct, string> = {
  google_search:"rgba(180,210,255,.9)", ytm_artist:"rgba(255,180,180,.9)",
  ytm_album:"rgba(255,200,200,.9)",     ytm_single:"rgba(80,10,10,.9)",
  ytm_playlist:"rgba(220,255,220,.9)", ytm_library:"rgba(10,50,20,.9)",
  yt_shorts:"rgba(20,20,20,.9)",       tiktok:"rgba(200,200,200,.9)",
  sleep:"rgba(220,210,255,.9)",
};

/* ─── Drag Scrubber ─── */
const HOUR_OPTS = Array.from({ length: 25 }, (_, i) => i);
const MIN_OPTS  = [0, 15, 30, 45];
const TOD_OPTS  = Array.from({ length: 24 }, (_, i) => i);
const padZ = (n: number) => String(n).padStart(2, "0");

function DragScrubber({ value, onChange, options, fmt=(v:number)=>String(v), width=28 }: {
  value:number; onChange:(v:number)=>void; options:number[]; fmt?:(v:number)=>string; width?:number;
}) {
  const drag = useRef<{startY:number;startIdx:number}|null>(null);
  const onMouseDown = useCallback((e:React.MouseEvent)=>{
    e.preventDefault();
    drag.current = {startY:e.clientY, startIdx:options.indexOf(value)};
    const onMove=(ev:MouseEvent)=>{
      if(!drag.current) return;
      const steps=Math.round((drag.current.startY-ev.clientY)/9);
      const idx=Math.max(0,Math.min(drag.current.startIdx+steps,options.length-1));
      onChange(options[idx]);
    };
    const onUp=()=>{ drag.current=null; document.removeEventListener("mousemove",onMove); document.removeEventListener("mouseup",onUp); };
    document.addEventListener("mousemove",onMove); document.addEventListener("mouseup",onUp);
  },[value,options,onChange]);
  return (
    <div onMouseDown={onMouseDown} style={{width,height:22,cursor:"ns-resize",userSelect:"none",flexShrink:0,
      display:"flex",alignItems:"center",justifyContent:"center",borderRadius:5,
      fontSize:12,fontFamily:"var(--app-font-mono)",fontWeight:700,color:"rgba(255,255,255,.9)",
      background:`rgba(${ACCENT_RGB},.1)`,border:`1px solid rgba(${ACCENT_RGB},.25)`}}>
      {fmt(value)}
    </div>
  );
}

const U=({children}:{children:React.ReactNode})=>(
  <span style={{fontSize:9,fontWeight:700,letterSpacing:".05em",color:"rgba(255,255,255,.28)",alignSelf:"center"}}>{children}</span>
);

function HMScrubber({h,m,onH,onM,hourOpts=HOUR_OPTS}:{h:number;m:number;onH:(v:number)=>void;onM:(v:number)=>void;hourOpts?:number[]}) {
  return (
    <div style={{display:"flex",alignItems:"center",gap:3}}>
      <DragScrubber value={h} onChange={onH} options={hourOpts} fmt={String} width={26}/>
      <U>h</U>
      <DragScrubber value={m} onChange={onM} options={MIN_OPTS} fmt={padZ} width={26}/>
      <U>m</U>
    </div>
  );
}

function TODScrubber({h,m,onH,onM}:{h:number;m:number;onH:(v:number)=>void;onM:(v:number)=>void}) {
  return (
    <div style={{display:"flex",alignItems:"center",gap:3}}>
      <DragScrubber value={h} onChange={onH} options={TOD_OPTS} fmt={padZ} width={24}/>
      <U>:</U>
      <DragScrubber value={m} onChange={onM} options={MIN_OPTS} fmt={padZ} width={24}/>
    </div>
  );
}

/* ─── Data Types ─── */
interface HM { h:number; m:number }
const hmVal=(hm:HM)=>hm.h+hm.m/60;
interface FixedRange { enabled:boolean; pct:number; startH:number; startM:number; endH:number; endM:number }
interface ActVar { minH:number; minM:number; maxH:number; maxM:number; range:FixedRange }
type Targets  = Record<ScheduleAct,HM>;
type Variance = Record<ScheduleAct,ActVar>;

const DEFAULT_TARGETS: Targets = {
  google_search:{h:0,m:30},yt_shorts:{h:1,m:0},ytm_playlist:{h:4,m:30},
  ytm_artist:{h:7,m:0},ytm_album:{h:3,m:0},ytm_single:{h:1,m:0},
  ytm_library:{h:1,m:0},tiktok:{h:1,m:0},sleep:{h:5,m:0},
};

function mkVar(tgt:HM):ActVar {
  const t=hmVal(tgt),mn=Math.max(0,t*.5),mx=t*1.8;
  const snapM=(v:number)=>[0,15,30,45].reduce((b,x)=>Math.abs(x-v)<Math.abs(b-v)?x:b,0);
  return {minH:Math.floor(mn),minM:snapM((mn%1)*60),maxH:Math.floor(mx),maxM:snapM((mx%1)*60),
    range:{enabled:false,pct:50,startH:0,startM:0,endH:7,endM:0}};
}
const DEFAULT_VAR:Variance=Object.fromEntries(ALL_ACTS.map(a=>[a,mkVar(DEFAULT_TARGETS[a])])) as Variance;
const ALL_ENABLED=new Set<ScheduleAct>(ALL_ACTS);

/* ─── Algorithm ─── */
// DAYS is now sourced from t.dayShort inside the component
type DayPlan = Record<ScheduleAct,number>;
type WeekPlan = Record<number,Record<number,DayPlan>>;
interface ContBlock{act:ScheduleAct;absStart:number;absEnd:number}
interface ExtPlan{perDay:WeekPlan;continuous:Record<number,ContBlock[]>;numDays:number}

function seededRand(seed:number){const x=Math.sin(seed+1)*10000;return x-Math.floor(x);}

function generateContinuousBlocks(
  di:number,numDays:number,targets:Targets,variance:Variance,
  enabled:Set<ScheduleAct>,fixedActs:Set<ScheduleAct>,minTaskMin:number,splitRatio:number
):ContBlock[]{
  const active=ALL_ACTS.filter(a=>enabled.has(a));
  if(!active.length) return [];
  const minBlockH=minTaskMin/60;

  const placed:ContBlock[]=[];

  for(let d=0;d<numDays;d++){
    const dayStart=d*24;

    // ── Step 1: Sample hours per act from variance range ──────────────────────
    const raw:Partial<Record<ScheduleAct,number>>={};
    active.forEach((act,ai)=>{
      const r=seededRand(di*791+d*113+ai*17);
      const v=variance[act];
      const mn=v.minH+v.minM/60, mx=v.maxH+v.maxM/60;
      const tgt=hmVal(targets[act]), lo=Math.max(mn,tgt*0.6), hi=Math.min(mx,tgt*1.6);
      raw[act]=lo+r*Math.max(0,hi-lo);
    });

    // ── Step 2: Normalize to 24h; drop acts below minBlockH; renormalize ──────
    const norm=(acts:ScheduleAct[],total:number)=>{
      const s=acts.reduce((a,k)=>a+(raw[k]??0),0);
      if(s>0.001) acts.forEach(k=>{raw[k]=(raw[k]??0)/s*total;});
    };
    norm(active,24);
    const tooSmall=active.filter(a=>(raw[a]??0)<minBlockH);
    if(tooSmall.length&&tooSmall.length<active.length){
      tooSmall.forEach(a=>{raw[a]=0;});
      norm(active.filter(a=>(raw[a]??0)>=minBlockH),24);
    }
    const dayActs=active.filter(a=>(raw[a]??0)>=minBlockH);

    // ── Step 3: Build segments (split unlocked, keep locked as 1 block) ───────
    interface Seg{act:ScheduleAct;hours:number}
    const segs:Seg[]=[];
    for(const act of dayActs){
      const h=raw[act]!;
      // Only split if lock open AND smaller piece ≥ minBlockH
      const lo=Math.min(splitRatio,100-splitRatio)/100;
      const canSplit=!fixedActs.has(act)&&h*lo>=minBlockH;
      if(canSplit){
        segs.push({act,hours:h*splitRatio/100});
        segs.push({act,hours:h*(100-splitRatio)/100});
      }else{
        segs.push({act,hours:h});
      }
    }

    // ── Step 4: Separate ranged (e.g. Sleep 00–06) from free segments ─────────
    const rangedSegs=segs.filter(s=>variance[s.act].range.enabled);
    const freeSegs  =segs.filter(s=>!variance[s.act].range.enabled);

    // ── Step 5: Place ranged segments in their time window ────────────────────
    const dayPlaced:ContBlock[]=[];
    const rangedFallback:Seg[]=[];
    for(const seg of rangedSegs){
      const rng=variance[seg.act].range;
      const ws=dayStart+rng.startH+rng.startM/60;
      const we=dayStart+rng.endH+rng.endM/60;
      const wl=we-ws;
      const inRange=seededRand(di*333+d*79+ALL_ACTS.indexOf(seg.act)*43)<rng.pct/100;
      if(inRange&&wl>=seg.hours){
        const r=seededRand(di*555+d*97+ALL_ACTS.indexOf(seg.act)*13);
        const s=ws+r*Math.max(0,wl-seg.hours);
        dayPlaced.push({act:seg.act,absStart:s,absEnd:s+seg.hours});
      }else{
        rangedFallback.push(seg);
      }
    }

    // ── Step 6: Shuffle free + ranged-fallback; then fix same-act adjacencies ──
    const free=[...freeSegs,...rangedFallback];
    for(let i=free.length-1;i>0;i--){
      const j=Math.floor(seededRand(di*104729+d*22877+i*7919)*(i+1));
      [free[i],free[j]]=[free[j],free[i]];
    }
    // Greedy pass: if free[i] has same act as free[i-1], swap with next different one
    for(let i=1;i<free.length;i++){
      if(free[i].act===free[i-1].act){
        const swapIdx=free.findIndex((s,k)=>k>i&&s.act!==free[i].act);
        if(swapIdx!==-1)[free[i],free[swapIdx]]=[free[swapIdx],free[i]];
      }
    }

    // ── Step 7: Sequential placement into slots between ranged blocks ─────────
    // Build time slots = 24h minus ranged placements
    dayPlaced.sort((a,b)=>a.absStart-b.absStart);
    const slots:{s:number;e:number}[]=[];
    let cur=dayStart;
    for(const pb of dayPlaced){
      if(pb.absStart>cur+0.001) slots.push({s:cur,e:pb.absStart});
      cur=Math.max(cur,pb.absEnd);
    }
    if(cur<dayStart+24) slots.push({s:cur,e:dayStart+24});

    // Place free segments back-to-back through the slots in shuffled order
    let si=0,sc=slots[0]?.s??dayStart+24;
    for(const seg of free){
      let rem=seg.hours;
      while(rem>0.001&&si<slots.length){
        const avail=slots[si].e-sc;
        if(avail<minBlockH){si++;sc=slots[si]?.s??dayStart+24;continue;}
        const take=Math.min(rem,avail);
        // If the leftover after this slot would be below minBlockH, drop it now
        const leftover=rem-take;
        const finalTake=(leftover>0.001&&leftover<minBlockH)?rem-leftover:take;
        const actualTake=Math.min(finalTake,avail);
        dayPlaced.push({act:seg.act,absStart:sc,absEnd:sc+actualTake});
        sc+=actualTake; rem-=actualTake;
        if(rem<minBlockH) rem=0; // drop sub-minimum tail
        if(sc>=slots[si].e-0.001){si++;sc=slots[si]?.s??dayStart+24;}
      }
    }

    placed.push(...dayPlaced);
  }
  return placed.sort((a,b)=>a.absStart-b.absStart);
}

/* Cross-midnight attribution: hours intersected with day boundary */
function extractDayHours(blocks:ContBlock[],day:number):DayPlan{
  const ds=day*24,de=ds+24;
  const h:Partial<DayPlan>={};ALL_ACTS.forEach(a=>h[a]=0);
  for(const b of blocks){
    const os=Math.max(b.absStart,ds),oe=Math.min(b.absEnd,de);
    if(oe>os) h[b.act]=(h[b.act]??0)+(oe-os);
  }
  return h as DayPlan;
}

/* Timeline blocks clipped to a single day's 0–24h window */
function extractDayTimeline(blocks:ContBlock[],day:number):TBlock[]{
  const ds=day*24,de=ds+24;
  return blocks
    .filter(b=>b.absEnd>ds&&b.absStart<de)
    .map(b=>({act:b.act,startH:Math.max(b.absStart,ds)-ds,endH:Math.min(b.absEnd,de)-ds}))
    .sort((a,b)=>a.startH-b.startH);
}

function generateExtPlan(
  devices:Device[],targets:Targets,variance:Variance,
  globalEnabled:Set<ScheduleAct>,deviceOverrides:Record<number,Set<ScheduleAct>>,
  numDays:number,fixedActs:Set<ScheduleAct>,minTaskMin:number,splitRatio:number
):ExtPlan{
  const perDay:WeekPlan={};const continuous:Record<number,ContBlock[]>={};
  [...devices].sort((a,b)=>a.id-b.id).forEach((dev,di)=>{
    const enabled=deviceOverrides[dev.id]??globalEnabled;
    const blocks=generateContinuousBlocks(di,numDays,targets,variance,enabled,fixedActs,minTaskMin,splitRatio);
    continuous[dev.id]=blocks;
    perDay[dev.id]={};
    for(let d=0;d<numDays;d++) perDay[dev.id][d]=extractDayHours(blocks,d);
  });
  return{perDay,continuous,numDays};
}

function weekAvg(plan:ExtPlan,id:number):DayPlan{
  const avg:Partial<DayPlan>={};
  ALL_ACTS.forEach(act=>{
    let s=0;for(let d=0;d<plan.numDays;d++)s+=plan.perDay[id]?.[d]?.[act]??0;
    avg[act]=s/Math.max(1,plan.numDays);
  });
  return avg as DayPlan;
}

/* ─── Timeline ─── */
interface TBlock{act:ScheduleAct;startH:number;endH:number}

function buildTimeline(dayPlan:DayPlan,deviceId:number,day:number,variance:Variance,enabled:Set<ScheduleAct>,fixedActs:Set<ScheduleAct>=new Set(ALL_ACTS)):TBlock[]{
  const acts=ALL_ACTS.filter(a=>enabled.has(a)&&(dayPlan[a]??0)>0.02).map(act=>({act,hours:dayPlan[act]??0}));
  const fixed=acts.filter(a=>variance[a.act].range.enabled);
  const freeBase=acts.filter(a=>!variance[a.act].range.enabled);
  // Expand: split non-fixed acts into two sub-blocks (each ≥30% of total)
  const expanded:{act:ScheduleAct;hours:number}[]=[];
  for(const item of freeBase){
    if(!fixedActs.has(item.act)&&item.hours>=0.5){
      const seed=deviceId*7919+day*431+ALL_ACTS.indexOf(item.act)*83;
      const frac=0.30+seededRand(seed)*0.40;
      expanded.push({act:item.act,hours:item.hours*frac});
      expanded.push({act:item.act,hours:item.hours*(1-frac)});
    } else {
      expanded.push(item);
    }
  }
  const shuffled=[...expanded];
  for(let i=shuffled.length-1;i>0;i--){
    const j=Math.floor(seededRand(deviceId*1337+day*97+i*23)*(i+1));
    [shuffled[i],shuffled[j]]=[shuffled[j],shuffled[i]];
  }
  const fixedPlaced:TBlock[]=fixed.map(({act,hours})=>{
    const rng=variance[act].range;
    const ws=rng.startH+rng.startM/60,we=rng.endH+rng.endM/60,wl=Math.max(0,we-ws);
    const r=seededRand(deviceId*555+day*77+ALL_ACTS.indexOf(act)*13);
    const inRange=seededRand(deviceId*9973+ALL_ACTS.indexOf(act)*3571)<rng.pct/100;
    let s=inRange&&wl>hours?ws+r*(wl-hours):r*(24-hours);
    s=Math.max(0,Math.min(s,24-hours));
    return {act,startH:s,endH:s+hours};
  }).sort((a,b)=>a.startH-b.startH);
  const gaps:{s:number;e:number}[]=[];let cur=0;
  for(const fb of fixedPlaced){if(fb.startH>cur+0.01)gaps.push({s:cur,e:fb.startH});cur=fb.endH;}
  if(cur<23.99)gaps.push({s:cur,e:24});
  const tl:TBlock[]=[];
  let gi=0,gc=gaps[0]?.s??0;
  for(const {act,hours} of shuffled){
    let rem=hours;
    while(rem>0.01&&gi<gaps.length){
      const gl=gaps[gi].e-gc,take=Math.min(rem,gl);
      tl.push({act,startH:gc,endH:gc+take});
      gc+=take;rem-=take;
      if(gc>=gaps[gi].e-0.001){gi++;gc=gaps[gi]?.s??24;}
    }
  }
  for(const fb of fixedPlaced)tl.push(fb);
  return tl.sort((a,b)=>a.startH-b.startH);
}

const fmtH=(h:number)=>h<.05?"—":h.toFixed(1)+"h";
function cellBg(act:ScheduleAct,h:number){
  const i=Math.min(h/10,1);
  return act==="sleep"?`rgba(120,100,220,${i*.45})`:`rgba(${ACCENT_RGB},${i*.38})`;
}

function Toggle({on,onToggle,size=28}:{on:boolean;onToggle:()=>void;size?:number}){
  return(
    <div onClick={onToggle} style={{width:size,height:size*.54,borderRadius:size*.27,flexShrink:0,cursor:"pointer",
      background:on?`rgba(${ACCENT_RGB},.7)`:"rgba(255,255,255,.1)",
      border:on?`1px solid rgba(${ACCENT_RGB},.8)`:"1px solid rgba(255,255,255,.15)",
      position:"relative",transition:"background .15s"}}>
      <div style={{position:"absolute",top:size*.08,left:on?size*.52:size*.08,
        width:size*.35,height:size*.35,borderRadius:"50%",background:"white",transition:"left .15s"}}/>
    </div>
  );
}

/* ─── Timeline Row ─── */
const LOGO_ACTS: ScheduleAct[] = ["tiktok","google_search","yt_shorts"];
function BlockContent({act,wp,height}:{act:ScheduleAct;wp:number;height:number}){
  if(height<14||wp<4) return null;
  const iconSz=Math.min(height-8,14);
  if(LOGO_ACTS.includes(act)){
    return(
      <span style={{display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,pointerEvents:"none"}}>
        {ACTIVITY_META[act as ActivityType].logo(iconSz)}
      </span>
    );
  }
  if(act==="sleep") return <span style={{fontSize:Math.min(iconSz,11),lineHeight:1}}>💤</span>;
  const label=ACT_LABEL[act];
  return(
    <span style={{fontSize:9,fontWeight:700,color:ACT_TEXT[act],
      whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",
      padding:"0 3px",lineHeight:1,pointerEvents:"none"}}>
      {wp>10?label:label.slice(0,3)}
    </span>
  );
}
function TimelineRow({blocks,height=24}:{blocks:TBlock[];height?:number}){
  return(
    <div style={{position:"relative",width:"100%",height,overflow:"hidden",borderRadius:4,background:"rgba(255,255,255,.04)"}}>
      {[6,12,18].map(h=>(
        <div key={h} style={{position:"absolute",left:`${h/24*100}%`,top:0,bottom:0,
          borderLeft:"1px solid rgba(255,255,255,.08)",zIndex:1,pointerEvents:"none"}}/>
      ))}
      {blocks.map((b,i)=>{
        const lp=b.startH/24*100,wp=(b.endH-b.startH)/24*100,hrs=b.endH-b.startH;
        return(
          <div key={i} title={`${ACT_LABEL[b.act]}: ${hrs.toFixed(1)}h`} style={{
            position:"absolute",left:`${lp}%`,width:`${wp}%`,top:0,bottom:0,
            background:ACT_COLORS[b.act],display:"flex",alignItems:"center",justifyContent:"center",overflow:"hidden"}}>
          </div>
        );
      })}
    </div>
  );
}

/* ─── Device Override Popup ─── */
function DeviceOverridePopup({
  deviceId, deviceIdx, globalEnabled, current, onSave, onClose, pos,
}:{
  deviceId:number; deviceIdx:number; globalEnabled:Set<ScheduleAct>;
  current:Set<ScheduleAct>|undefined; onSave:(s:Set<ScheduleAct>|undefined)=>void;
  onClose:()=>void; pos:{x:number;y:number};
}){
  const [sel,setSel]=useState<Set<ScheduleAct>>(()=>new Set(current??globalEnabled));
  const toggleAct=(act:ScheduleAct)=>setSel(prev=>{const n=new Set(prev);n.has(act)?n.delete(act):n.add(act);return n;});
  const isIdentical=(a:Set<ScheduleAct>,b:Set<ScheduleAct>)=>a.size===b.size&&[...a].every(x=>b.has(x));

  // Clamp to viewport
  const pw=192,ph=340;
  const left=Math.max(8,Math.min(pos.x,window.innerWidth-pw-8));
  const top =Math.max(8,Math.min(pos.y+4,window.innerHeight-ph-8));

  return createPortal(
    <>
      <div onMouseDown={onClose} style={{position:"fixed",inset:0,zIndex:200}}/>
      <div onMouseDown={e=>e.stopPropagation()} style={{
        position:"fixed",left,top,zIndex:201,width:pw,
        background:"rgba(12,14,26,.97)",border:"1px solid rgba(255,255,255,.12)",
        borderRadius:12,boxShadow:"0 20px 60px rgba(0,0,0,.7)",overflow:"hidden",
      }}>
        {/* Header */}
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",
          padding:"10px 12px 8px",borderBottom:"1px solid rgba(255,255,255,.07)"}}>
          <div>
            <div style={{fontSize:12,fontWeight:700,color:"white"}}>
              Device <span style={{color:ACCENT,fontFamily:"var(--app-font-mono)"}}>
                {String(deviceIdx+1).padStart(3,"0")}
              </span>
            </div>
            <div style={{fontSize:9,color:"rgba(255,255,255,.3)",marginTop:1}}>Activity override</div>
          </div>
          <button onClick={onClose} style={{width:22,height:22,display:"flex",alignItems:"center",
            justifyContent:"center",borderRadius:6,border:"none",background:"transparent",cursor:"pointer",
            color:"rgba(255,255,255,.4)"}}>
            <X style={{width:12,height:12}}/>
          </button>
        </div>
        {/* Activity list */}
        <div style={{padding:"6px 10px"}}>
          {ALL_ACTS.map(act=>{
            const globalOn=globalEnabled.has(act);
            const on=sel.has(act);
            return(
              <div key={act} onClick={()=>toggleAct(act)} style={{
                display:"flex",alignItems:"center",gap:8,padding:"5px 4px",
                borderRadius:6,cursor:"pointer",
                background:on?"rgba(255,255,255,.04)":"transparent",
                opacity:!globalOn&&on?.4:1,
              }}>
                <div style={{width:8,height:8,borderRadius:2,flexShrink:0,background:ACT_COLORS[act],
                  border:"1px solid rgba(255,255,255,.12)"}}/>
                <span style={{width:14,height:14,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                  {act==="sleep"?<span style={{fontSize:11}}>💤</span>:ACTIVITY_META[act as ActivityType].logo(12)}
                </span>
                <span style={{flex:1,fontSize:11,fontWeight:500,
                  color:on?"rgba(255,255,255,.8)":"rgba(255,255,255,.25)"}}>{ACT_LABEL[act]}</span>
                {/* checkbox */}
                <div style={{width:14,height:14,borderRadius:3,border:`1.5px solid ${on?ACCENT:"rgba(255,255,255,.2)"}`,
                  background:on?`rgba(${ACCENT_RGB},.2)`:"transparent",flexShrink:0,
                  display:"flex",alignItems:"center",justifyContent:"center"}}>
                  {on&&<div style={{width:7,height:7,borderRadius:1.5,background:ACCENT}}/>}
                </div>
              </div>
            );
          })}
        </div>
        {/* Footer */}
        <div style={{padding:"8px 10px 10px",borderTop:"1px solid rgba(255,255,255,.07)",
          display:"flex",gap:6}}>
          {current&&(
            <button onClick={()=>onSave(undefined)} style={{flex:1,height:30,borderRadius:8,border:"none",
              background:"rgba(255,255,255,.06)",color:"rgba(255,255,255,.4)",fontSize:11,fontWeight:600,
              cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:4}}>
              <RotateCcw style={{width:10,height:10}}/>Reset
            </button>
          )}
          <button onClick={()=>onSave(isIdentical(sel,globalEnabled)?undefined:new Set(sel))}
            style={{flex:2,height:30,borderRadius:8,border:`1px solid rgba(${ACCENT_RGB},.35)`,
              background:`rgba(${ACCENT_RGB},.13)`,color:ACCENT,fontSize:11,fontWeight:700,
              cursor:"pointer"}}>
            Save
          </button>
        </div>
      </div>
    </>,
    document.body
  );
}

/* ─── Main Modal ─── */
type ViewMode="hours"|"timeline";
interface CellKey{deviceId:number;day:number|"overview";act:ScheduleAct}
interface OverrideTarget{deviceId:number;deviceIdx:number;pos:{x:number;y:number}}
interface OverwritePreviewRow{
  deviceId:number;
  deviceNumber:number;
  currentIp:string;
  summaries:{dateKey:string;totalH:number;labels:string[]}[];
}
interface OverwritePrompt{
  incoming:SavedScheduleResult;
  existing:SavedScheduleResult;
  dates:string[];
  rows:OverwritePreviewRow[];
  totalDevices:number;
}

export function FullAutomationModal({
  onClose,
  devices,
  initialDateKeys,
  scopedSave = false,
  deviceNumberById = {},
  initialScheduleResult,
}:{
  onClose:()=>void;
  devices:Device[];
  initialDateKeys?:string[];
  scopedSave?:boolean;
  deviceNumberById?:Record<number,number>;
  initialScheduleResult?:SavedScheduleResult;
}){
  const { t } = useLang();
  const { timeZone } = useAppTimezone();
  const [targets,  setTargets]  = useState<Targets>(DEFAULT_TARGETS);
  const [variance, setVariance] = useState<Variance>(DEFAULT_VAR);
  const [globalEnabled, setGlobalEnabled] = useState<Set<ScheduleAct>>(()=>new Set(ALL_ACTS));
  const [fixedActs, setFixedActs] = useState<Set<ScheduleAct>>(()=>new Set(ALL_ACTS));
  const [minTaskMin, setMinTaskMin] = useState<number>(15);
  const [splitRatio, setSplitRatio] = useState<number>(60); // larger piece %
  const toggleFixed=(act:ScheduleAct)=>setFixedActs(prev=>{const n=new Set(prev);n.has(act)?n.delete(act):n.add(act);return n;});
  const [deviceOverrides, setDeviceOverrides] = useState<Record<number,Set<ScheduleAct>>>(()=>{
    try{
      const raw=localStorage.getItem("magspot_device_overrides");
      if(!raw) return {};
      const parsed=JSON.parse(raw) as Record<string,string[]>;
      return Object.fromEntries(Object.entries(parsed).map(([k,v])=>[Number(k),new Set(v as ScheduleAct[])]));
    }catch{return {};}
  });
  const [activeDay, setActiveDay] = useState<"overview"|number>("overview");
  const [plan, setPlan] = useState<ExtPlan|null>(null);
  const [planIsStale, setPlanIsStale] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("hours");
  const [editing, setEditing] = useState<CellKey|null>(null);
  const [editVal, setEditVal] = useState("");
  const [overrideTarget, setOverrideTarget] = useState<OverrideTarget|null>(null);
  const [overwritePrompt,setOverwritePrompt]=useState<OverwritePrompt|null>(null);
  const [noticeMessage,setNoticeMessage]=useState<string|null>(null);

  // Persist device overrides to localStorage
  useEffect(()=>{
    try{
      const serializable=Object.fromEntries(
        Object.entries(deviceOverrides).map(([k,v])=>[k,[...v]])
      );
      localStorage.setItem("magspot_device_overrides",JSON.stringify(serializable));
    }catch{}
  },[deviceOverrides]);

  const sorted=[...devices].sort((a,b)=>a.id-b.id);
  const STREAMING_ACTS: ScheduleAct[] = ["ytm_artist","ytm_album","ytm_single","ytm_playlist","ytm_library"];
  const totalH=ALL_ACTS.filter(a=>globalEnabled.has(a)).reduce((s,a)=>s+hmVal(targets[a]),0);
  const streamingH=STREAMING_ACTS.filter(a=>globalEnabled.has(a)).reduce((s,a)=>s+hmVal(targets[a]),0);
  const valid=Math.abs(totalH-24)<.05;

  const toggleGlobal=(act:ScheduleAct)=>setGlobalEnabled(prev=>{
    const n=new Set(prev);n.has(act)?n.delete(act):n.add(act);return n;
  });

  // Day selector — must be declared before handleGenerate (selectedDays used there)
  const DAYS=t.dayShort;
  const DAY_LABELS=t.dayLetters;
  const todayKey=getTodayDateKey(timeZone);
  const calDayKeys=Array.from({length:28},(_,i)=>addDaysToDateKey(todayKey,i));
  const isPastDateKey=(key:string)=>key<todayKey;
  const [selectedDays,setSelectedDays]=useState<Set<string>>(()=>{
    const initialKeys=initialDateKeys?.length ? initialDateKeys : calDayKeys.slice(0,7);
    const keys=initialKeys.filter(key=>key>=todayKey);
    return new Set(keys.length?keys:[todayKey]);
  });
  useEffect(()=>{
    setSelectedDays(prev=>{
      const keys=[...prev].filter(key=>key>=todayKey);
      return new Set(keys.length?keys:[todayKey]);
    });
  },[todayKey]);
  const toggleDay=(key:string)=>{
    if(isPastDateKey(key)) return;
    setSelectedDays(prev=>{const n=new Set(prev);n.has(key)?n.delete(key):n.add(key);return n;});
  };
  // Sorted list of selected Date objects (chronological = plan day index order)
  const sortedSelectedDateKeys=[...selectedDays].sort();
  const numPlanDays=plan?.numDays??sortedSelectedDateKeys.length;
  const tabDayIndices=Array.from({length:Math.min(numPlanDays,14)},(_,i)=>i);
  const tabLabel=(di:number)=>{
    const key=sortedSelectedDateKeys[di];
    if(!key) return `D${di+1}`;
    return `${key.slice(8,10)}.${key.slice(5,7)}`;
  };

  // Mark plan as stale when any config changes after it was generated
  useEffect(()=>{if(plan!==null) setPlanIsStale(true);},[targets,variance,globalEnabled,deviceOverrides,selectedDays,fixedActs,minTaskMin,splitRatio]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleGenerate=useCallback(()=>{
    const numDays=Math.max(1,selectedDays.size);
    setPlan(generateExtPlan(devices,targets,variance,globalEnabled,deviceOverrides,numDays,fixedActs,minTaskMin,splitRatio));
    setPlanIsStale(false);
    setEditing(null);
  },[devices,targets,variance,globalEnabled,deviceOverrides,selectedDays,fixedActs,minTaskMin,splitRatio]);

  function dateLabel(key:string){
    const d=new Date(`${key}T00:00:00`);
    return `${String(d.getDate()).padStart(2,"0")}.${String(d.getMonth()+1).padStart(2,"0")}`;
  }

  function summarizeExistingDay(existing:SavedScheduleResult,deviceId:number,key:string){
    const device=existing.devices.find(d=>d.deviceId===deviceId);
    const dayIndex=existing.dates.indexOf(key);
    const hours:Partial<Record<ScheduleAct,number>>={};
    if(!device||dayIndex<0) return {totalH:0,labels:[] as string[]};
    const dayStart=dayIndex*24,dayEnd=dayStart+24;
    for(const block of device.blocks){
      const os=Math.max(block.absStart,dayStart),oe=Math.min(block.absEnd,dayEnd);
      if(oe<=os) continue;
      const act=block.act as ScheduleAct;
      hours[act]=(hours[act]??0)+(oe-os);
    }
    const labels=ALL_ACTS
      .filter(act=>(hours[act]??0)>.05)
      .map(act=>`${ACT_LABEL[act]} ${(hours[act]??0).toFixed(1)}h`);
    return {totalH:Object.values(hours).reduce((sum,h)=>sum+(h??0),0),labels};
  }

  function buildOverwritePrompt(existing:SavedScheduleResult,incoming:SavedScheduleResult,deviceIds:number[],dates:string[]):OverwritePrompt{
    const deviceSet=new Set(deviceIds);
    const affected=existing.devices.filter(device=>deviceSet.has(device.deviceId));
    return {
      incoming,
      existing,
      dates,
      totalDevices:affected.length,
      rows:affected.slice(0,30).map(device=>({
        deviceId:device.deviceId,
        deviceNumber:deviceNumberById[device.deviceId]??device.deviceNumber,
        currentIp:device.currentIp,
        summaries:dates.map(key=>({dateKey:key,...summarizeExistingDay(existing,device.deviceId,key)})),
      })),
    };
  }

  function commitScheduleSave(existing:SavedScheduleResult|null,incoming:SavedScheduleResult){
    saveScheduleResult(scopedSave ? mergeScheduleResultForScope(existing,incoming,{deviceIds:incoming.devices.map(device=>device.deviceId),dateKeys:incoming.dates}) : incoming);
    setOverwritePrompt(null);
    onClose();
  }

  const handleSaveSchedule=useCallback(()=>{
    if(!plan||planIsStale) return;
    const dates=sortedSelectedDateKeys.slice(0,plan.numDays);
    if(dates.some(key=>isPastDateKey(key))){
      setNoticeMessage(t.tp_pastSaveBlocked);
      return;
    }
    const sortedDevices=[...devices].sort((a,b)=>a.id-b.id);
    const existing=scopedSave ? (initialScheduleResult ?? loadSavedScheduleResult()) : loadSavedScheduleResult();
    const incoming = {
      id:`schedule-${Date.now()}`,
      generatedAt:new Date().toISOString(),
      dates,
      devices:sortedDevices.map((device,index)=>({
        deviceId:device.id,
        deviceNumber:deviceNumberById[device.id]??index+1,
        currentIp:device.ip,
        blocks:plan.continuous[device.id]??[],
      })),
    };
    if(existing){
      const dateSet=new Set(dates);
      const deviceSet=new Set(sortedDevices.map(device=>device.id));
      const overlappingDates=existing.dates.filter(date=>dateSet.has(date));
      const overlappingDeviceIds=existing.devices.filter(device=>deviceSet.has(device.deviceId)).map(device=>device.deviceId);
      const mustConfirm=overlappingDates.length>0&&overlappingDeviceIds.length>0;
      if(scopedSave&&mustConfirm){
        setOverwritePrompt(buildOverwritePrompt(existing,incoming,overlappingDeviceIds,overlappingDates));
        return;
      }
      if(!scopedSave){
        setOverwritePrompt(buildOverwritePrompt(existing,incoming,sortedDevices.map(device=>device.id),dates));
        return;
      }
    }
    commitScheduleSave(existing,incoming);
  },[deviceNumberById,devices,initialScheduleResult,plan,planIsStale,scopedSave,sortedSelectedDateKeys,t]);

  const getData=(deviceId:number,day:"overview"|number):DayPlan=>{
    if(!plan) return {} as DayPlan;
    return day==="overview"?weekAvg(plan,deviceId):(plan.perDay[deviceId]?.[day]??{} as DayPlan);
  };
  const startEdit=(deviceId:number,act:ScheduleAct)=>{
    if(!plan||activeDay==="overview") return;
    setEditing({deviceId,day:activeDay,act});
    setEditVal(getData(deviceId,activeDay)[act]?.toFixed(1)??"0");
  };
  const commitEdit=()=>{
    if(!editing||!plan||editing.day==="overview"){setEditing(null);return;}
    const n=parseFloat(editVal);
    if(isNaN(n)||n<0){setEditing(null);return;}
    const{deviceId,day,act}=editing;
    setPlan(prev=>prev?{...prev,perDay:{...prev.perDay,[deviceId]:{...prev.perDay[deviceId],[day as number]:{...prev.perDay[deviceId][day as number],[act]:n}}}}:prev);
    setEditing(null);
  };
  const openOverride=(deviceId:number,deviceIdx:number,e:React.MouseEvent)=>{
    e.stopPropagation();
    const r=(e.currentTarget as HTMLElement).getBoundingClientRect();
    setOverrideTarget({deviceId,deviceIdx,pos:{x:r.left,y:r.bottom}});
  };
  const saveOverride=(deviceId:number,s:Set<ScheduleAct>|undefined)=>{
    setDeviceOverrides(prev=>{
      const n={...prev};
      if(s===undefined) delete n[deviceId];
      else n[deviceId]=s;
      return n;
    });
    setOverrideTarget(null);
  };

  const [showInfo,setShowInfo]=useState(false);

  const setT=(act:ScheduleAct,p:Partial<HM>)=>setTargets(prev=>({...prev,[act]:{...prev[act],...p}}));
  const setV=(act:ScheduleAct,p:Partial<ActVar>)=>setVariance(prev=>({...prev,[act]:{...prev[act],...p}}));
  const setVR=(act:ScheduleAct,p:Partial<FixedRange>)=>setVariance(prev=>({...prev,[act]:{...prev[act],range:{...prev[act].range,...p}}}));

  // Range TOD change → also sync maxH/maxM to the duration of the range
  const setVRtod=(act:ScheduleAct,p:Partial<FixedRange>)=>setVariance(prev=>{
    const cur=prev[act];
    const nr={...cur.range,...p};
    const durMin=Math.max(0,(nr.endH*60+nr.endM)-(nr.startH*60+nr.startM));
    return{...prev,[act]:{...cur,range:nr,maxH:Math.floor(durMin/60),maxM:durMin%60}};
  });

  const COL_NUM=54,COL_ORIG=60;
  const rowBg=(idx:number)=>idx%2===0?"rgba(255,255,255,.012)":"transparent";
  const stickyBg=(idx:number)=>idx%2===0?"rgba(10,13,24,.99)":"rgba(8,10,20,.99)";
  const hasOverride=(id:number)=>!!deviceOverrides[id];

  const thBase:React.CSSProperties={
    position:"sticky",top:0,zIndex:15,
    borderBottom:"1px solid rgba(255,255,255,.1)",
    background:"rgba(8,10,20,.99)",
    fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:".07em",color:"rgba(255,255,255,.3)",
  };

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center"
      style={{background:"rgba(0,0,0,.72)",backdropFilter:"blur(8px)"}}
      onMouseDown={e=>{if(e.target===e.currentTarget)onClose();}}>

      <div className="relative flex rounded-2xl overflow-hidden"
        style={{width:"96vw",height:"92vh",background:"rgba(8,10,20,.98)",
          border:"1px solid rgba(255,255,255,.09)",boxShadow:"0 40px 100px rgba(0,0,0,.8)"}}>

        {/* ══ LEFT CONFIG ══ */}
        <div style={{width:"clamp(420px, 33%, 560px)",flexShrink:0,borderRight:"1px solid rgba(255,255,255,.07)",
          display:"flex",flexDirection:"column",overflow:"hidden"}}>
          {/* Header */}
          <div style={{padding:"14px 18px 10px",borderBottom:"1px solid rgba(255,255,255,.07)",flexShrink:0,position:"relative"}}>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <Zap style={{width:15,height:15,color:ACCENT}}/>
              <span style={{fontSize:14,fontWeight:700,color:"white"}}>Task Planner</span>
              <button
                onClick={()=>setShowInfo(s=>!s)}
                title="How to use"
                style={{
                  width:16,height:16,borderRadius:"50%",border:"1px solid rgba(255,255,255,.25)",
                  background:showInfo?`rgba(${ACCENT_RGB},.18)`:"rgba(255,255,255,.06)",
                  color:showInfo?ACCENT:"rgba(255,255,255,.5)",
                  fontSize:10,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",
                  cursor:"pointer",flexShrink:0,lineHeight:1,
                }}
              >i</button>
            </div>

            {/* Intro */}
            <p style={{fontSize:10,color:"rgba(255,255,255,.38)",marginTop:4,lineHeight:1.55}}>
              {t.tp_intro}
            </p>

            {/* Day selector — scrollable, 28 days from today */}
            <div style={{display:"flex",gap:4,marginTop:8,overflowX:"auto",paddingBottom:2}}
              className="no-scrollbar">
              {calDayKeys.map((key)=>{
                const sel=selectedDays.has(key);
                const date=new Date(`${key}T00:00:00`);
                const label=DAY_LABELS[date.getDay()];
                const dd=key.slice(8,10);
                return(
                  <button key={key} onClick={()=>toggleDay(key)}
                    style={{
                      flexShrink:0,width:34,borderRadius:6,
                      border:`1px solid ${sel?ACCENT:"rgba(255,255,255,.1)"}`,
                      background:sel?`rgba(${ACCENT_RGB},.15)`:"transparent",
                      cursor:"pointer",padding:"4px 0",display:"flex",flexDirection:"column",alignItems:"center",gap:2,
                    }}>
                    <span style={{fontSize:9,fontWeight:700,color:sel?ACCENT:"rgba(255,255,255,.3)",lineHeight:1}}>{label}</span>
                    <span style={{fontSize:9,fontFamily:"var(--app-font-mono)",color:sel?ACCENT:"rgba(255,255,255,.2)",lineHeight:1}}>{dd}</span>
                  </button>
                );
              })}
            </div>

            {/* Info overlay */}
            {showInfo&&(
              <div style={{
                position:"absolute",top:"100%",left:0,right:0,zIndex:50,
                background:"rgba(8,10,22,.98)",border:"1px solid rgba(0,212,232,.25)",
                borderTop:"none",padding:"12px 16px 14px",
              }}>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
                  <span style={{fontSize:11,fontWeight:700,color:ACCENT,letterSpacing:".05em"}}>{t.tp_howItWorks}</span>
                  <button onClick={()=>setShowInfo(false)} style={{color:"rgba(255,255,255,.35)",background:"none",border:"none",cursor:"pointer",fontSize:14,lineHeight:1}}>×</button>
                </div>
                <div style={{fontSize:10,color:"rgba(255,255,255,.65)",lineHeight:1.7,display:"flex",flexDirection:"column",gap:6}}>
                  <div><span style={{color:"rgba(255,255,255,.9)",fontWeight:600}}>Targets (h/day)</span> — {t.tp_targetsDesc}</div>
                  <div style={{display:"flex",alignItems:"center",gap:5}}>
                    <Lock style={{width:10,height:10,color:"rgba(255,255,255,.8)",flexShrink:0}}/>
                    <span><span style={{color:"rgba(255,255,255,.9)",fontWeight:600}}>{t.tp_lock}</span> — {t.tp_lockDesc}</span>
                  </div>
                  <div><span style={{color:"rgba(255,255,255,.9)",fontWeight:600}}>Min — Max</span> — {t.tp_minMaxDesc}</div>
                  <div style={{padding:"6px 8px",borderRadius:5,border:"1px solid rgba(255,255,255,.1)",background:"rgba(255,255,255,.04)"}}>
                    <div style={{marginBottom:3}}><span style={{color:"rgba(255,255,255,.9)",fontWeight:600}}>{t.tp_range}</span> — {t.tp_rangeDesc}</div>
                    <div style={{fontSize:9,color:"rgba(255,255,255,.45)",borderTop:"1px solid rgba(255,255,255,.07)",paddingTop:4,marginTop:2}}>
                      {t.tp_noRangeNote}
                    </div>
                  </div>
                  <div><span style={{color:"rgba(255,255,255,.9)",fontWeight:600}}>{t.tp_ofDevicesLabel}</span> — {t.tp_ofDevicesDesc}</div>
                  <div style={{marginTop:2,padding:"6px 8px",background:"rgba(0,212,232,.07)",borderRadius:5,borderLeft:"2px solid rgba(0,212,232,.4)"}}>
                    <span style={{color:ACCENT,fontWeight:600}}>{t.tp_exampleLabel}</span>{" "}
                    {t.tp_exampleText.split("\n").map((line,i)=><span key={i}>{line}{i===0&&<br/>}</span>)}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Body */}
          <div style={{flex:1,overflowY:"auto",display:"flex",flexDirection:"column",padding:"10px 14px 0"}}>

            {/* ── Min. min/Task setting ── */}
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8,
              padding:"6px 8px",borderRadius:7,
              background:"rgba(255,255,255,.03)",border:"1px solid rgba(255,255,255,.07)"}}>
              <Clock style={{width:12,height:12,color:`rgba(${ACCENT_RGB},.6)`,flexShrink:0}}/>
              <span style={{fontSize:10,fontWeight:600,color:"rgba(255,255,255,.45)",flex:1,whiteSpace:"nowrap"}}>
                Min. min / Task
              </span>
              <div style={{display:"flex",gap:2}}>
                {[5,10,15,20,30,45,60].map(m=>{
                  const active=minTaskMin===m;
                  return(
                    <button key={m} onClick={()=>setMinTaskMin(m)} style={{
                      padding:"2px 5px",borderRadius:4,fontSize:9,fontWeight:700,
                      border:`1px solid ${active?`rgba(${ACCENT_RGB},.5)`:"rgba(255,255,255,.1)"}`,
                      background:active?`rgba(${ACCENT_RGB},.14)`:"transparent",
                      color:active?ACCENT:"rgba(255,255,255,.3)",cursor:"pointer",
                      fontFamily:"var(--app-font-mono)",lineHeight:1.6,
                    }}>{m}</button>
                  );
                })}
              </div>
            </div>

            {/* ── Split Ratio setting ── */}
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8,
              padding:"6px 8px",borderRadius:7,
              background:"rgba(255,255,255,.03)",border:"1px solid rgba(255,255,255,.07)"}}>
              <Scissors style={{width:12,height:12,color:`rgba(${ACCENT_RGB},.6)`,flexShrink:0}}/>
              <span style={{fontSize:10,fontWeight:600,color:"rgba(255,255,255,.45)",flex:1,whiteSpace:"nowrap"}}>
                Split Ratio
              </span>
              <div style={{display:"flex",gap:2}}>
                {[[55,45],[60,40],[65,35],[70,30],[75,25],[80,20]].map(([a,b])=>{
                  const active=splitRatio===a;
                  return(
                    <button key={a} onClick={()=>setSplitRatio(a)} style={{
                      padding:"2px 5px",borderRadius:4,fontSize:9,fontWeight:700,
                      border:`1px solid ${active?`rgba(${ACCENT_RGB},.5)`:"rgba(255,255,255,.1)"}`,
                      background:active?`rgba(${ACCENT_RGB},.14)`:"transparent",
                      color:active?ACCENT:"rgba(255,255,255,.3)",cursor:"pointer",
                      fontFamily:"var(--app-font-mono)",lineHeight:1.6,
                    }}>{a}/{b}</button>
                  );
                })}
              </div>
            </div>

            {/* ── Preview timeline ── */}
            {(()=>{
              const total24=ALL_ACTS.filter(a=>globalEnabled.has(a)).reduce((s,a)=>s+hmVal(targets[a]),0);
              if(total24<0.01) return null;
              const minBlockH=minTaskMin/60;
              const loFrac=Math.min(splitRatio,100-splitRatio)/100;
              const segs:{act:ScheduleAct;w:number}[]=[];
              for(const act of ALL_ACTS){
                if(!globalEnabled.has(act)) continue;
                const h=hmVal(targets[act]);
                const canSplit=!fixedActs.has(act)&&h*loFrac>=minBlockH;
                if(canSplit){
                  segs.push({act,w:h*splitRatio/100/total24*100});
                  segs.push({act,w:h*(100-splitRatio)/100/total24*100});
                }else{
                  segs.push({act,w:h/total24*100});
                }
              }
              return(
                <div style={{display:"flex",height:6,borderRadius:4,overflow:"hidden",
                  marginBottom:8,gap:1}}>
                  {segs.map((s,i)=>(
                    <div key={i} style={{
                      flex:`0 0 calc(${s.w}% - 1px)`,
                      background:ACT_COLORS[s.act],
                      borderRadius:i===0?3:i===segs.length-1?3:0,
                      opacity:.85,
                    }}/>
                  ))}
                </div>
              );
            })()}

            {/* TARGETS */}
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:5}}>
              <span style={{fontSize:9,fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",
                color:"rgba(255,255,255,.25)"}}>{t.tp_targetsHeader}</span>
              <Lock style={{width:10,height:10,color:"rgba(255,255,255,.25)",marginRight:2}}/>
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:0}}>
              {ALL_ACTS.map(act=>{
                const on=globalEnabled.has(act);
                return(
                  <div key={act} style={{display:"flex",alignItems:"center",gap:6,
                    borderBottom:"1px solid rgba(255,255,255,.04)",padding:"3px 2px",
                    opacity:on?1:.35}}>
                    {/* Global enable toggle */}
                    <div onClick={()=>toggleGlobal(act)} title={on?t.tp_disableGlobally:t.tp_enableGlobally}
                      style={{width:14,height:14,borderRadius:3,border:`1.5px solid ${on?ACCENT:"rgba(255,255,255,.2)"}`,
                        background:on?`rgba(${ACCENT_RGB},.2)`:"transparent",
                        display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",flexShrink:0}}>
                      {on&&<div style={{width:7,height:7,borderRadius:1.5,background:ACCENT}}/>}
                    </div>
                    <span style={{width:14,height:14,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                      {act==="sleep"?<span style={{fontSize:12}}>💤</span>:ACTIVITY_META[act as ActivityType].logo(13)}
                    </span>
                    <div style={{width:18,height:3,borderRadius:2,flexShrink:0,background:ACT_COLORS[act]}}/>
                    <span style={{flex:1,fontSize:11,fontWeight:500,color:"rgba(255,255,255,.65)"}}>{ACT_LABEL[act]}</span>
                    <HMScrubber h={targets[act].h} m={targets[act].m} onH={h=>setT(act,{h})} onM={m=>setT(act,{m})}/>
                    <button onClick={()=>toggleFixed(act)}
                      title={fixedActs.has(act)?t.tp_lockTitleLocked:t.tp_lockTitleOpen}
                      style={{width:16,height:16,borderRadius:3,flexShrink:0,cursor:"pointer",border:"none",
                        background:"transparent",display:"flex",alignItems:"center",justifyContent:"center",padding:0}}>
                      {fixedActs.has(act)
                        ?<Lock style={{width:11,height:11,color:"rgba(255,255,255,.7)"}}/>
                        :<LockOpen style={{width:11,height:11,color:"rgba(255,255,255,.22)"}}/>}
                    </button>
                  </div>
                );
              })}
            </div>
            {/* Total */}
            <div style={{marginTop:6,borderRadius:7,flexShrink:0,overflow:"hidden",
              background:valid?"rgba(34,197,94,.08)":"rgba(239,68,68,.08)",
              border:`1px solid ${valid?"rgba(34,197,94,.22)":"rgba(239,68,68,.28)"}`}}>
              {/* Main row */}
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",
                padding:"5px 10px"}}>
                <span style={{fontSize:9,fontWeight:700,textTransform:"uppercase",letterSpacing:".08em",
                  color:"rgba(255,255,255,.35)"}}>{t.tp_total}</span>
                <span style={{fontSize:12,fontFamily:"var(--app-font-mono)",fontWeight:800,
                  color:valid?"#22c55e":"#ef4444"}}>
                  {totalH.toFixed(2)}h / 24h
                </span>
              </div>
              {/* Streaming sub-row */}
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",
                padding:"4px 10px 5px",borderTop:`1px solid ${valid?"rgba(34,197,94,.12)":"rgba(239,68,68,.12)"}`}}>
                <div style={{display:"flex",alignItems:"center",gap:4}}>
                  <div style={{width:5,height:5,borderRadius:1,background:"rgba(220,38,38,.7)",flexShrink:0}}/>
                  <span style={{fontSize:9,fontWeight:600,letterSpacing:".06em",textTransform:"uppercase",
                    color:"rgba(255,255,255,.28)"}}>{t.tp_streaming}</span>
                </div>
                <span style={{fontSize:11,fontFamily:"var(--app-font-mono)",fontWeight:700,
                  color:"rgba(220,180,180,.75)"}}>
                  {streamingH.toFixed(1)}h
                </span>
              </div>
            </div>
            {/* VARIANCE */}
            <div style={{fontSize:9,fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",
              color:"rgba(255,255,255,.25)",marginTop:10,marginBottom:5}}>{t.tp_varianceHeader}</div>
            <div style={{display:"flex",flexDirection:"column",gap:0,paddingBottom:4}}>
              {ALL_ACTS.map(act=>{
                const v=variance[act];const on=globalEnabled.has(act);
                /* CSS-Grid: 17 columns, column-gap 3px
                   C1=38(icon/pct) C2=46(label) C3=1fr(left-space)
                   C4=22(min-lbl) C5=26(h1) C6=10(u1) C7=26(m1) C8=10(u2)
                   C9=14(sep) C10=22(max-lbl) C11=26(h2) C12=10(u3) C13=26(m2) C14=10(u4)
                   C15=1fr(right-space) C16=auto(range-lbl) C17=auto(toggle) */
                const GC="38px 46px 1fr 22px 26px 10px 26px 10px 14px 22px 26px 10px 26px 10px 1fr auto auto";
                const u=(txt:string,row:number,col:number)=>(
                  <span style={{gridColumn:col,gridRow:row,fontSize:9,fontWeight:700,letterSpacing:".05em",
                    color:"rgba(255,255,255,.28)",display:"flex",alignItems:"center",justifyContent:"center"}}>{txt}</span>
                );
                return(
                  <div key={act} style={{borderBottom:"1px solid rgba(255,255,255,.04)",opacity:on?1:.3,
                    display:"grid",gridTemplateColumns:GC,columnGap:"3px",rowGap:"2px",
                    padding:"4px 2px",alignItems:"center"}}>

                    {/* ── Row 1 ── */}
                    {/* C1: icon */}
                    <span style={{gridColumn:"1",gridRow:"1",display:"flex",alignItems:"center",justifyContent:"flex-start",height:14}}>
                      {act==="sleep"?<span style={{fontSize:11}}>💤</span>:ACTIVITY_META[act as ActivityType].logo(12)}
                    </span>
                    {/* C2: label */}
                    <span style={{gridColumn:"2",gridRow:"1",fontSize:10,fontWeight:500,color:"rgba(255,255,255,.55)",whiteSpace:"nowrap"}}>{ACT_LABEL[act]}</span>
                    {/* C3: 1fr left spacer — pushes fields to center */}
                    {/* C4: "Min" */}
                    <span style={{gridColumn:"4",gridRow:"1",fontSize:9,color:"rgba(255,255,255,.28)",textAlign:"right"}}>{t.tp_min}</span>
                    {/* C5: min h-scrubber */}
                    <div style={{gridColumn:"5",gridRow:"1"}}><DragScrubber value={v.minH} onChange={h=>setV(act,{minH:h})} options={HOUR_OPTS} fmt={String} width={26}/></div>
                    {/* C6: "h" */}
                    {u("h",1,6)}
                    {/* C7: min m-scrubber */}
                    <div style={{gridColumn:"7",gridRow:"1"}}><DragScrubber value={v.minM} onChange={m=>setV(act,{minM:m})} options={MIN_OPTS} fmt={padZ} width={26}/></div>
                    {/* C8: "m" */}
                    {u("m",1,8)}
                    {/* C9: separator */}
                    <span style={{gridColumn:"9",gridRow:"1",fontSize:10,color:"rgba(255,255,255,.15)",textAlign:"center"}}>—</span>
                    {/* C10: "Max" */}
                    <span style={{gridColumn:"10",gridRow:"1",fontSize:9,color:"rgba(255,255,255,.28)",textAlign:"right"}}>{t.tp_max}</span>
                    {/* C11: max h-scrubber */}
                    <div style={{gridColumn:"11",gridRow:"1"}}><DragScrubber value={v.maxH} onChange={h=>setV(act,{maxH:h})} options={HOUR_OPTS} fmt={String} width={26}/></div>
                    {/* C12: "h" */}
                    {u("h",1,12)}
                    {/* C13: max m-scrubber */}
                    <div style={{gridColumn:"13",gridRow:"1"}}><DragScrubber value={v.maxM} onChange={m=>setV(act,{maxM:m})} options={MIN_OPTS} fmt={padZ} width={26}/></div>
                    {/* C14: "m" */}
                    {u("m",1,14)}
                    {/* C15: 1fr right spacer — centers fields */}
                    {/* C16: Range label */}
                    <span style={{gridColumn:"16",gridRow:"1",fontSize:9,color:v.range.enabled?ACCENT:"rgba(255,255,255,.28)",whiteSpace:"nowrap"}}>{t.tp_range}</span>
                    {/* C17: Toggle */}
                    <div style={{gridColumn:"17",gridRow:"1"}}><Toggle on={v.range.enabled} onToggle={()=>setVR(act,{enabled:!v.range.enabled})}/></div>

                    {/* ── Row 2 (range only) ── */}
                    {v.range.enabled&&<>
                      {/* Row-2 tinted background */}
                      <div style={{gridColumn:"1/-1",gridRow:"2",background:`rgba(${ACCENT_RGB},.045)`,borderRadius:4,margin:"0 -2px"}}/>
                      {/* C3: pct% — right-aligned in left spacer, directly before "btw" */}
                      <div style={{gridColumn:"3",gridRow:"2",justifySelf:"end",position:"relative"}}><DragScrubber value={v.range.pct} onChange={pct=>setVR(act,{pct})}
                        options={Array.from({length:20},(_,i)=>(i+1)*5)} fmt={v=>v+"%"} width={38}/></div>
                      {/* C4: "btw" */}
                      <span style={{gridColumn:"4",gridRow:"2",fontSize:9,color:`rgba(${ACCENT_RGB},.6)`,textAlign:"right",position:"relative"}}>{t.tp_btw}</span>
                      {/* C5: start h-scrubber */}
                      <div style={{gridColumn:"5",gridRow:"2",position:"relative"}}><DragScrubber value={v.range.startH} onChange={h=>setVRtod(act,{startH:h})} options={TOD_OPTS} fmt={padZ} width={26}/></div>
                      {/* C6: ":" */}
                      <span style={{gridColumn:"6",gridRow:"2",fontSize:9,fontWeight:700,letterSpacing:".05em",color:`rgba(${ACCENT_RGB},.45)`,display:"flex",alignItems:"center",justifyContent:"center",position:"relative"}}>:</span>
                      {/* C7: start m-scrubber */}
                      <div style={{gridColumn:"7",gridRow:"2",position:"relative"}}><DragScrubber value={v.range.startM} onChange={m=>setVRtod(act,{startM:m})} options={MIN_OPTS} fmt={padZ} width={26}/></div>
                      {/* C8: empty */}
                      <span style={{gridColumn:"8",gridRow:"2",position:"relative"}}/>
                      {/* C9: "–" */}
                      <span style={{gridColumn:"9",gridRow:"2",fontSize:10,color:`rgba(${ACCENT_RGB},.3)`,textAlign:"center",position:"relative"}}>–</span>
                      {/* C10: empty */}
                      <span style={{gridColumn:"10",gridRow:"2",position:"relative"}}/>
                      {/* C11: end h-scrubber */}
                      <div style={{gridColumn:"11",gridRow:"2",position:"relative"}}><DragScrubber value={v.range.endH} onChange={h=>setVRtod(act,{endH:h})} options={TOD_OPTS} fmt={padZ} width={26}/></div>
                      {/* C12: ":" */}
                      <span style={{gridColumn:"12",gridRow:"2",fontSize:9,fontWeight:700,letterSpacing:".05em",color:`rgba(${ACCENT_RGB},.45)`,display:"flex",alignItems:"center",justifyContent:"center",position:"relative"}}>:</span>
                      {/* C13: end m-scrubber */}
                      <div style={{gridColumn:"13",gridRow:"2",position:"relative"}}><DragScrubber value={v.range.endM} onChange={m=>setVRtod(act,{endM:m})} options={MIN_OPTS} fmt={padZ} width={26}/></div>
                    </>}
                  </div>
                );
              })}
            </div>
          </div>
          {/* Generate + Save */}
          {(()=>{
            // Generate is active when: config is valid AND (no plan yet OR plan is stale)
            const needsGenerate=valid&&(plan===null||planIsStale);
            // Save is active when: plan exists AND not stale
            const canSave=plan!==null&&!planIsStale;
            return(
              <div style={{padding:"10px 14px",borderTop:"1px solid rgba(255,255,255,.07)",flexShrink:0,display:"flex",gap:6}}>
                {/* Generate button */}
                <button onClick={handleGenerate} disabled={!needsGenerate} style={{
                  flex:1,height:36,borderRadius:10,fontSize:12,fontWeight:700,
                  display:"flex",alignItems:"center",justifyContent:"center",gap:6,
                  background:needsGenerate?`rgba(${ACCENT_RGB},.15)`:"rgba(255,255,255,.03)",
                  border:`1px solid ${needsGenerate?`rgba(${ACCENT_RGB},.38)`:"rgba(255,255,255,.06)"}`,
                  color:needsGenerate?ACCENT:"rgba(255,255,255,.18)",
                  cursor:needsGenerate?"pointer":"default",
                  transition:"all .2s"}}>
                  <RefreshCw style={{width:13,height:13}}/>{t.tp_generateSchedule}
                </button>
                {/* Save button */}
                <button disabled={!canSave} onClick={handleSaveSchedule} style={{
                  flex:1,height:36,borderRadius:10,fontSize:12,fontWeight:700,
                  display:"flex",alignItems:"center",justifyContent:"center",gap:6,
                  background:canSave?`rgba(${ACCENT_RGB},.15)`:"rgba(255,255,255,.03)",
                  border:`1px solid ${canSave?`rgba(${ACCENT_RGB},.38)`:"rgba(255,255,255,.06)"}`,
                  color:canSave?ACCENT:"rgba(255,255,255,.18)",
                  cursor:canSave?"pointer":"default",
                  transition:"all .2s"}}>
                  <Save style={{width:13,height:13}}/>{t.tp_saveSchedule}
                </button>
              </div>
            );
          })()}
        </div>

        {/* ══ RIGHT PANEL ══ */}
        <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden",minWidth:0}}>

          {/* Top bar */}
          <div style={{height:56,display:"flex",alignItems:"stretch",
            borderBottom:"1px solid rgba(255,255,255,.07)",padding:"0 8px",gap:4}}>
            {(["overview",...tabDayIndices] as ("overview"|number)[])
              .filter(d => viewMode==="hours" || d!=="overview")
              .map((day,ti)=>{
              const label=day==="overview"?t.tp_overview:tabLabel(day as number);
              const active=activeDay===day;
              return(
                <button key={ti} onClick={()=>setActiveDay(day)} style={{
                  flex:1,border:"none",borderRadius:8,fontSize:12,fontWeight:600,cursor:"pointer",
                  background:active?`rgba(${ACCENT_RGB},.13)`:"transparent",
                  color:active?ACCENT:"rgba(255,255,255,.35)",
                  outline:active?`1px solid rgba(${ACCENT_RGB},.25)`:"none"}}>
                  {label}
                </button>
              );
            })}
            <div style={{display:"flex",alignItems:"center",gap:6,paddingLeft:8}}>
              <div style={{display:"flex",gap:2,background:"rgba(255,255,255,.06)",borderRadius:8,padding:"3px"}}>
                <button onClick={()=>setViewMode("hours")} style={{padding:"3px 10px",borderRadius:5,border:"none",
                  fontSize:11,fontWeight:600,cursor:"pointer",
                  background:viewMode==="hours"?"rgba(255,255,255,.12)":"transparent",
                  color:viewMode==="hours"?"white":"rgba(255,255,255,.3)"}}>
                  <BarChart2 style={{width:12,height:12,display:"inline",marginRight:4}}/>{t.tp_hours}
                </button>
                <button onClick={()=>{ setViewMode("timeline"); if(activeDay==="overview") setActiveDay(0); }}
                  style={{padding:"3px 10px",borderRadius:5,border:"none",
                  fontSize:11,fontWeight:600,cursor:"pointer",
                  background:viewMode==="timeline"?"rgba(255,255,255,.12)":"transparent",
                  color:viewMode==="timeline"?"white":"rgba(255,255,255,.3)"}}>
                  <Clock style={{width:12,height:12,display:"inline",marginRight:4}}/>{t.tp_timeline}
                </button>
              </div>
              {/* Override count badge */}
              {Object.keys(deviceOverrides).length>0&&(
                <span style={{fontSize:10,padding:"3px 8px",borderRadius:8,whiteSpace:"nowrap",
                  background:`rgba(${ACCENT_RGB},.1)`,color:ACCENT,
                  border:`1px solid rgba(${ACCENT_RGB},.25)`,fontFamily:"var(--app-font-mono)"}}>
                  {Object.keys(deviceOverrides).length} custom
                </span>
              )}
              {plan&&(
                <span style={{fontSize:10,padding:"3px 8px",borderRadius:8,whiteSpace:"nowrap",
                  background:"rgba(34,197,94,.1)",color:"#22c55e",
                  border:"1px solid rgba(34,197,94,.2)",fontFamily:"var(--app-font-mono)"}}>
                  ✓ {devices.length}
                </span>
              )}
              <button onClick={onClose} style={{width:28,height:28,display:"flex",alignItems:"center",
                justifyContent:"center",borderRadius:8,border:"none",background:"transparent",
                cursor:"pointer",color:"rgba(255,255,255,.4)"}}>
                <X style={{width:15,height:15}}/>
              </button>
            </div>
          </div>

          {/* Content */}
          {!plan?(
            <div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:12}}>
              <div style={{width:60,height:60,borderRadius:16,display:"flex",alignItems:"center",justifyContent:"center",
                background:"rgba(255,255,255,.03)",border:"1px solid rgba(255,255,255,.07)"}}>
                <Zap style={{width:26,height:26,color:"rgba(255,255,255,.1)"}}/>
              </div>
              <p style={{fontSize:13,fontWeight:500,color:"rgba(255,255,255,.28)"}}>{t.tp_noScheduleYet}</p>
              <p style={{fontSize:11,color:"rgba(255,255,255,.15)"}}>{t.tp_noScheduleYet}</p>
            </div>

          ):viewMode==="hours"?(
            /* ── HOURS TABLE ── */
            <div style={{flex:1,overflow:"auto"}}>
              <table style={{borderCollapse:"collapse",minWidth:"max-content",width:"100%"}}>
                <thead>
                  <tr>
                    <th style={{...thBase,position:"sticky",left:0,top:0,zIndex:25,
                      padding:"10px 8px",textAlign:"left",minWidth:COL_NUM,
                      borderRight:"1px solid rgba(255,255,255,.07)"}}>
                      #
                    </th>
                    <th style={{...thBase,position:"sticky",left:COL_NUM,top:0,zIndex:25,
                      padding:"10px 12px",textAlign:"left",minWidth:COL_ORIG,
                      borderRight:"1px solid rgba(255,255,255,.07)"}}>
                      Origin
                    </th>
                    {ALL_ACTS.map(act=>(
                      <th key={act} style={{...thBase,padding:"8px 6px",textAlign:"center",minWidth:64}}>
                        <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:3}}>
                          <div style={{width:7,height:7,borderRadius:2,background:ACT_COLORS[act],
                            border:"1px solid rgba(255,255,255,.15)"}}/>
                          {act==="sleep"?<span style={{fontSize:13}}>💤</span>:ACTIVITY_META[act as ActivityType].logo(13)}
                          <span>{ACT_LABEL[act]}</span>
                        </div>
                      </th>
                    ))}
                    <th style={{...thBase,padding:"10px 12px",textAlign:"center",minWidth:52}}>∑</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((device,idx)=>{
                    const data=getData(device.id,activeDay);
                    const total=ALL_ACTS.reduce((s,a)=>s+(data[a]??0),0);
                    const customized=hasOverride(device.id);
                    return(
                      <tr key={device.id} style={{background:rowBg(idx),borderBottom:"1px solid rgba(255,255,255,.04)"}}>
                        {/* # cell — click to open override popup */}
                        <td onClick={e=>openOverride(device.id,idx,e)}
                          style={{position:"sticky",left:0,zIndex:10,padding:"4px 8px",
                            background:customized?`rgba(${ACCENT_RGB},.08)`:stickyBg(idx),
                            borderRight:"1px solid rgba(255,255,255,.05)",minWidth:COL_NUM,
                            cursor:"pointer"}}>
                          <div style={{display:"flex",alignItems:"center",gap:4}}>
                            {customized&&<div style={{width:4,height:4,borderRadius:"50%",background:ACCENT,flexShrink:0}}/>}
                            <span style={{fontSize:11,fontFamily:"var(--app-font-mono)",fontWeight:700,
                              color:customized?ACCENT:"rgba(255,255,255,.55)"}}>
                              {String(idx+1).padStart(3,"0")}
                            </span>
                          </div>
                        </td>
                        <td style={{position:"sticky",left:COL_NUM,zIndex:10,padding:"4px 12px",
                          background:stickyBg(idx),borderRight:"1px solid rgba(255,255,255,.05)",minWidth:COL_ORIG}}>
                          <span style={{fontSize:10,fontFamily:"var(--app-font-mono)",fontWeight:600,
                            padding:"1px 6px",borderRadius:4,
                            background:"rgba(255,255,255,.07)",color:"rgba(255,255,255,.65)"}}>
                            {getOrigin(device.id)}
                          </span>
                        </td>
                        {ALL_ACTS.map(act=>{
                          const h=data[act]??0;
                          const isEdit=editing?.deviceId===device.id&&editing?.act===act&&editing?.day===activeDay;
                          return(
                            <td key={act} style={{padding:"3px 4px",textAlign:"center",
                              cursor:activeDay!=="overview"?"pointer":"default"}}
                              onClick={()=>startEdit(device.id,act)}>
                              {isEdit?(
                                <input autoFocus value={editVal}
                                  onChange={e=>setEditVal(e.target.value)}
                                  onBlur={commitEdit}
                                  onKeyDown={e=>{if(e.key==="Enter")commitEdit();if(e.key==="Escape")setEditing(null);}}
                                  style={{width:52,height:22,textAlign:"center",fontSize:11,outline:"none",
                                    borderRadius:5,color:"white",fontFamily:"var(--app-font-mono)",
                                    background:`rgba(${ACCENT_RGB},.18)`,border:`1px solid rgba(${ACCENT_RGB},.45)`}}/>
                              ):(
                                <span style={{display:"inline-block",padding:"2px 6px",borderRadius:5,
                                  fontSize:11,fontFamily:"var(--app-font-mono)",
                                  background:h>.05?cellBg(act,h):"transparent",
                                  color:h>.05?"rgba(255,255,255,.85)":"rgba(255,255,255,.13)",minWidth:42}}>
                                  {fmtH(h)}
                                </span>
                              )}
                            </td>
                          );
                        })}
                        <td style={{padding:"4px 12px",textAlign:"center"}}>
                          <span style={{fontSize:11,fontFamily:"var(--app-font-mono)",
                            color:Math.abs(total-24)<.5?"rgba(255,255,255,.3)":"#f59e0b"}}>
                            {total.toFixed(1)}h
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr style={{background:"rgba(255,255,255,.04)",borderTop:"1px solid rgba(255,255,255,.1)"}}>
                    <td style={{position:"sticky",left:0,zIndex:10,padding:"8px 12px",
                      background:"rgba(10,13,26,.99)",color:"rgba(255,255,255,.3)",
                      fontSize:10,fontWeight:700,textTransform:"uppercase",
                      borderRight:"1px solid rgba(255,255,255,.06)"}}>Avg</td>
                    <td style={{position:"sticky",left:COL_NUM,zIndex:10,padding:"8px 12px",
                      background:"rgba(10,13,26,.99)",borderRight:"1px solid rgba(255,255,255,.06)"}}/>
                    {ALL_ACTS.map(act=>{
                      const avg=sorted.length>0?sorted.reduce((s,d)=>s+(getData(d.id,activeDay)[act]??0),0)/sorted.length:0;
                      return(
                        <td key={act} style={{padding:"6px 4px",textAlign:"center"}}>
                          <span style={{fontSize:11,fontFamily:"var(--app-font-mono)",fontWeight:700,color:ACCENT}}>
                            {fmtH(avg)}
                          </span>
                        </td>
                      );
                    })}
                    <td style={{padding:"8px 12px",textAlign:"center"}}>
                      <span style={{fontSize:11,fontFamily:"var(--app-font-mono)",color:"rgba(255,255,255,.28)"}}>24.0h</span>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

          ):(
            /* ── TIMELINE VIEW ── */
            <div style={{display:"flex",flexDirection:"column",flex:1,overflow:"hidden"}}>
            {/* Legend */}
            <div style={{
              display:"flex",flexWrap:"wrap",gap:"6px 12px",
              padding:"8px 14px",
              borderBottom:"1px solid rgba(255,255,255,.07)",
              background:"rgba(255,255,255,.02)",flexShrink:0}}>
              {ALL_ACTS.map(act=>(
                <div key={act} style={{display:"flex",alignItems:"center",gap:6}}>
                  <div style={{
                    width:12,height:12,borderRadius:3,flexShrink:0,
                    background:ACT_COLORS[act],
                    border:"1px solid rgba(255,255,255,.18)"}}/>
                  <span style={{
                    fontSize:11,fontWeight:600,letterSpacing:".02em",
                    color:"rgba(255,255,255,.65)",whiteSpace:"nowrap"}}>
                    {ACT_LABEL[act]}
                  </span>
                </div>
              ))}
            </div>
            <div style={{flex:1,overflow:"auto"}}>
              <table style={{borderCollapse:"collapse",width:"100%"}}>
                <thead>
                  <tr>
                    <th style={{...thBase,position:"sticky",left:0,top:0,zIndex:25,
                      padding:"8px 8px",textAlign:"left",minWidth:COL_NUM,width:COL_NUM,
                      borderRight:"1px solid rgba(255,255,255,.07)"}}>
                      #
                    </th>
                    <th style={{...thBase,position:"sticky",left:COL_NUM,top:0,zIndex:25,
                      padding:"8px 12px",textAlign:"left",minWidth:COL_ORIG,width:COL_ORIG,
                      borderRight:"1px solid rgba(255,255,255,.07)"}}>
                      Origin
                    </th>
                    <th style={{...thBase,padding:"0",paddingBottom:0,position:"sticky",top:0,zIndex:15}}>
                      <div style={{position:"relative",width:"100%",height:42,paddingTop:6}}>
                        {[0,6,12,18,24].map(h=>(
                          <div key={h} style={{position:"absolute",left:`${h/24*100}%`,top:0,bottom:0,
                            display:"flex",flexDirection:"column",alignItems:"flex-start",
                            paddingLeft:h>0?3:3,paddingTop:6,
                            borderLeft:h>0?"1px solid rgba(255,255,255,.08)":"none"}}>
                            <span style={{fontSize:9,color:"rgba(255,255,255,.3)",
                              fontFamily:"var(--app-font-mono)",whiteSpace:"nowrap"}}>
                              {String(h).padStart(2,"0")}:00
                            </span>
                          </div>
                        ))}
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((device,idx)=>{
                    const devEnabled=deviceOverrides[device.id]??globalEnabled;
                    const customized=hasOverride(device.id);
                    const isOverview=activeDay==="overview";

                    // Overview: show all plan days; single day: show one
                    const contBlocks=plan?.continuous[device.id]??[];
                    const dayTimelines: {label:string; blocks:TBlock[]}[] = isOverview
                      ? tabDayIndices.map(di=>({
                          label: tabLabel(di),
                          blocks: plan ? extractDayTimeline(contBlocks,di) : [],
                        }))
                      : [{
                          label: tabLabel(activeDay as number),
                          blocks: plan ? extractDayTimeline(contBlocks,activeDay as number) : [],
                        }];

                    return(
                      <tr key={device.id} style={{background:rowBg(idx),borderBottom:"1px solid rgba(255,255,255,.04)"}}>
                        {/* # cell */}
                        <td onClick={e=>openOverride(device.id,idx,e)}
                          style={{position:"sticky",left:0,zIndex:10,
                            padding: isOverview ? "6px 8px" : "4px 8px",
                            background:customized?`rgba(${ACCENT_RGB},.08)`:stickyBg(idx),
                            borderRight:"1px solid rgba(255,255,255,.05)",minWidth:COL_NUM,width:COL_NUM,
                            cursor:"pointer", verticalAlign:"top"}}>
                          <div style={{display:"flex",alignItems:"center",gap:4,paddingTop:isOverview?2:0}}>
                            {customized&&<div style={{width:4,height:4,borderRadius:"50%",background:ACCENT,flexShrink:0}}/>}
                            <span style={{fontSize:11,fontFamily:"var(--app-font-mono)",fontWeight:700,
                              color:customized?ACCENT:"rgba(255,255,255,.55)"}}>
                              {String(idx+1).padStart(3,"0")}
                            </span>
                          </div>
                        </td>
                        {/* Origin cell */}
                        <td style={{position:"sticky",left:COL_NUM,zIndex:10,
                          padding: isOverview ? "6px 12px" : "4px 12px",
                          background:stickyBg(idx),borderRight:"1px solid rgba(255,255,255,.05)",
                          minWidth:COL_ORIG,width:COL_ORIG, verticalAlign:"top"}}>
                          <span style={{fontSize:10,fontFamily:"var(--app-font-mono)",fontWeight:600,
                            padding:"1px 6px",borderRadius:4,
                            background:"rgba(255,255,255,.07)",color:"rgba(255,255,255,.65)"}}>
                            {getOrigin(device.id)}
                          </span>
                        </td>
                        {/* Timeline cell */}
                        <td style={{padding: isOverview ? "4px 8px" : "4px 8px"}}>
                          {isOverview ? (
                            /* 7 mini-bars, one per day */
                            <div style={{display:"flex",flexDirection:"column",gap:2,padding:"2px 0"}}>
                              {dayTimelines.map(({label,blocks})=>(
                                <div key={label} style={{display:"flex",alignItems:"center",gap:5}}>
                                  <span style={{
                                    fontSize:8,fontFamily:"var(--app-font-mono)",fontWeight:700,
                                    color:"rgba(255,255,255,.22)",width:20,flexShrink:0,letterSpacing:".03em"
                                  }}>{label}</span>
                                  <div style={{flex:1}}>
                                    <TimelineRow blocks={blocks} height={9}/>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <TimelineRow blocks={dayTimelines[0].blocks} height={24}/>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            </div>
          )}
        </div>
      </div>

      {overwritePrompt&&(
        <div style={{position:"fixed",inset:0,zIndex:500,display:"flex",alignItems:"center",justifyContent:"center",
          background:"rgba(0,0,0,.45)",backdropFilter:"blur(3px)"}}
          onMouseDown={e=>e.stopPropagation()}>
          <div style={{width:"min(860px,92vw)",maxHeight:"82vh",display:"flex",flexDirection:"column",overflow:"hidden",
            borderRadius:16,background:"rgba(12,15,26,.98)",border:"1px solid rgba(255,255,255,.14)",
            boxShadow:"0 30px 90px rgba(0,0,0,.75)"}}>
            <div style={{padding:"16px 18px",borderBottom:"1px solid rgba(255,255,255,.08)",display:"flex",alignItems:"flex-start",gap:12}}>
              <div style={{width:34,height:34,borderRadius:10,display:"flex",alignItems:"center",justifyContent:"center",
                background:"rgba(245,158,11,.12)",border:"1px solid rgba(245,158,11,.3)",color:"#f59e0b",flexShrink:0}}>
                !
              </div>
              <div style={{minWidth:0}}>
                <div style={{fontSize:14,fontWeight:800,color:"white"}}>{t.tp_overwriteTitle}</div>
                <div style={{fontSize:11,lineHeight:1.5,color:"rgba(255,255,255,.46)",marginTop:3}}>
                  {t.tp_overwriteAffected(overwritePrompt.totalDevices, overwritePrompt.dates.length, overwritePrompt.dates.map(dateLabel).join(", "))}
                </div>
                <div style={{fontSize:11,lineHeight:1.5,color:"rgba(255,255,255,.32)",marginTop:4}}>
                  {t.tp_overwriteDescription}
                </div>
              </div>
            </div>

            <div style={{padding:"12px 14px",overflow:"auto"}}>
              <div style={{display:"grid",gridTemplateColumns:`92px 110px repeat(${overwritePrompt.dates.length}, minmax(150px, 1fr))`,
                minWidth:Math.max(520,260+overwritePrompt.dates.length*150),border:"1px solid rgba(255,255,255,.07)",borderRadius:10,overflow:"hidden"}}>
                <div style={{padding:"8px 10px",fontSize:10,fontWeight:800,color:"rgba(255,255,255,.34)",background:"rgba(255,255,255,.04)"}}>{t.tp_overwriteDeviceColumn}</div>
                <div style={{padding:"8px 10px",fontSize:10,fontWeight:800,color:"rgba(255,255,255,.34)",background:"rgba(255,255,255,.04)"}}>{t.tp_overwriteIpColumn}</div>
                {overwritePrompt.dates.map(key=>(
                  <div key={key} style={{padding:"8px 10px",fontSize:10,fontWeight:800,color:"rgba(255,255,255,.34)",background:"rgba(255,255,255,.04)"}}>
                    {dateLabel(key)}
                  </div>
                ))}
                {overwritePrompt.rows.map(row=>(
                  <React.Fragment key={row.deviceId}>
                    <div style={{padding:"9px 10px",fontSize:11,fontFamily:"var(--app-font-mono)",fontWeight:800,color:ACCENT,borderTop:"1px solid rgba(255,255,255,.055)"}}>
                      {row.deviceNumber}
                    </div>
                    <div style={{padding:"9px 10px",fontSize:10,fontFamily:"var(--app-font-mono)",color:"rgba(255,255,255,.45)",borderTop:"1px solid rgba(255,255,255,.055)"}}>
                      {row.currentIp}
                    </div>
                    {row.summaries.map(summary=>(
                      <div key={`${row.deviceId}-${summary.dateKey}`} style={{padding:"7px 10px",borderTop:"1px solid rgba(255,255,255,.055)",minHeight:42}}>
                        <div style={{fontSize:10,fontFamily:"var(--app-font-mono)",fontWeight:800,color:summary.totalH>0?"rgba(255,255,255,.72)":"rgba(255,255,255,.22)"}}>
                          {summary.totalH>0?`${summary.totalH.toFixed(1)}h`:t.tp_overwriteEmpty}
                        </div>
                        <div style={{fontSize:10,lineHeight:1.35,color:"rgba(255,255,255,.38)",marginTop:2}}>
                          {summary.labels.length>0?summary.labels.slice(0,4).join(" · "):t.tp_overwriteNoBlocks}
                          {summary.labels.length>4?` · +${summary.labels.length-4}`:""}
                        </div>
                      </div>
                    ))}
                  </React.Fragment>
                ))}
              </div>
              {overwritePrompt.totalDevices>overwritePrompt.rows.length&&(
                <div style={{fontSize:11,color:"rgba(255,255,255,.34)",marginTop:8}}>
                  {t.tp_overwriteMoreDevices(overwritePrompt.totalDevices-overwritePrompt.rows.length)}
                </div>
              )}
            </div>

            <div style={{padding:"12px 14px",borderTop:"1px solid rgba(255,255,255,.08)",display:"flex",justifyContent:"flex-end",gap:8}}>
              <button onClick={()=>setOverwritePrompt(null)} style={{height:34,padding:"0 14px",borderRadius:9,border:"1px solid rgba(255,255,255,.1)",
                background:"rgba(255,255,255,.05)",color:"rgba(255,255,255,.62)",fontSize:12,fontWeight:700,cursor:"pointer"}}>
                {t.cancel}
              </button>
              <button onClick={()=>commitScheduleSave(overwritePrompt.existing,overwritePrompt.incoming)}
                style={{height:34,padding:"0 14px",borderRadius:9,border:`1px solid rgba(${ACCENT_RGB},.35)`,
                background:`rgba(${ACCENT_RGB},.14)`,color:ACCENT,fontSize:12,fontWeight:800,cursor:"pointer"}}>
                {t.tp_overwriteConfirmButton}
              </button>
            </div>
          </div>
        </div>
      )}

      {noticeMessage&&(
        <div style={{position:"fixed",inset:0,zIndex:510,display:"flex",alignItems:"center",justifyContent:"center",
          background:"rgba(0,0,0,.42)",backdropFilter:"blur(4px)"}}>
          <div style={{width:"min(380px,92vw)",borderRadius:16,overflow:"hidden",background:"rgba(14,17,28,.98)",
            border:"1px solid rgba(255,255,255,.13)",boxShadow:"0 24px 70px rgba(0,0,0,.68)"}}>
            <div style={{padding:"16px 20px",fontSize:14,lineHeight:1.55,color:"rgba(255,255,255,.78)"}}>
              {noticeMessage}
            </div>
            <div style={{padding:"12px 16px",borderTop:"1px solid rgba(255,255,255,.08)",display:"flex",justifyContent:"flex-end"}}>
              <button onClick={()=>setNoticeMessage(null)} style={{height:34,padding:"0 16px",borderRadius:9,
                border:`1px solid rgba(${ACCENT_RGB},.32)`,background:`rgba(${ACCENT_RGB},.14)`,color:ACCENT,
                fontSize:12,fontWeight:800,cursor:"pointer"}}>
                {t.ok}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Override Popup */}
      {overrideTarget&&(
        <DeviceOverridePopup
          deviceId={overrideTarget.deviceId}
          deviceIdx={overrideTarget.deviceIdx}
          globalEnabled={globalEnabled}
          current={deviceOverrides[overrideTarget.deviceId]}
          onSave={s=>saveOverride(overrideTarget.deviceId,s)}
          onClose={()=>setOverrideTarget(null)}
          pos={overrideTarget.pos}
        />
      )}
    </div>,
    document.body
  );
}

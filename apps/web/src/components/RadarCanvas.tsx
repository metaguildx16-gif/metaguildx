import { useState, useRef, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";

type TreeNodeLike = {
  userId: number; packageLevel: number; parentId: number;
  leftChildId: number; rightChildId: number; depth: number;
  directReferrals: number; account: string;
};
type DisplayTreeNode = {
  node: TreeNodeLike | null; side: "ROOT" | "Left" | "Right";
  left: DisplayTreeNode | null; right: DisplayTreeNode | null;
};
export type TreeCanvasProps = {
  visualTree: DisplayTreeNode;
  selectedId: number | null;
  currentUserId: number | null;
  onNodeClick: (userId: number) => void;
  userDisplayNames?: Record<string, string>;
  treePreview?: TreeNodeLike[];
};

const CX=400,CY=400,CVW=800,CVH=800,MAX_RINGS=5;
const RING_R=[0,102,184,262,334,400] as const;
const NODE_R=[44,36,28,22,18,15] as const;
const TOUCH_R=[50,46,40,36,32,28] as const;
const GOLD="#C9A84C",CYAN="#38BDF8",BLUE="#4f6ef7",PURPLE="#a78bfa",GREEN="#2EC48F";
const AV_PAL=["#4f6ef7","#0ea5e9","#C9A84C","#2EC48F","#a78bfa","#f97316","#e11d48","#059669"];

function encodeId(id:number):string{
  const C="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let n=id+100000,s="";while(n>0){s=C[n%62]+s;n=Math.floor(n/62);}return s;
}
function nodeLabel(n:TreeNodeLike|null,names?:Record<string,string>):string{
  if(!n)return"Open Slot";
  const dn=n.account&&names?.[n.account.toLowerCase()];return dn||`#${encodeId(n.userId)}`;
}
function shortWallet(a?:string|null):string{return a?`${a.slice(0,6)}\u2026${a.slice(-4)}`:"Pending";}
function clamp(s:string,n:number):string{return s.length>n?s.slice(0,n-1)+"\u2026":s;}
function avColor(uid:number):string{return AV_PAL[uid%AV_PAL.length];}
function avLetter(lbl:string):string{return lbl.replace(/[^a-zA-Z0-9#]/g,"").slice(0,1).toUpperCase()||"?";}

function buildRadarLevels(rootId:number,nm:Map<number,TreeNodeLike>,maxRings:number):number[][]{
  const levels:number[][]=[[rootId]];let cur=[rootId];
  for(let ring=1;ring<=maxRings;ring++){
    const next:number[]=[];
    for(const id of cur){const n=id>0?nm.get(id):undefined;next.push(n?.leftChildId??0);next.push(n?.rightChildId??0);}
    levels.push(next);cur=next;if(next.every(id=>id===0))break;
  }
  return levels;
}
function slotPos(ring:number,slotIndex:number,totalSlots:number){
  if(ring===0)return{cx:CX,cy:CY};
  const angle=(2*Math.PI/totalSlots)*slotIndex-Math.PI/2;
  const r=RING_R[Math.min(ring,RING_R.length-1)];
  return{cx:CX+r*Math.cos(angle),cy:CY+r*Math.sin(angle)};
}
function ringLabelCfg(ring:number){
  return{showLabel:ring<=2,showWallet:ring===0,showPkg:ring<=1,showSide:ring<=1,
    labelMax:ring===0?13:ring===1?11:8,
    avFS:[20,16,13,10,8,7][Math.min(ring,5)],lblFS:[13,11,8,0,0,0][Math.min(ring,5)],
    walFS:[9,0,0,0,0,0][Math.min(ring,5)],pkgFS:[8,7,0,0,0,0][Math.min(ring,5)]};
}
function countSubtree(rootId:number,nm:Map<number,TreeNodeLike>):number{
  let count=0;const q=[rootId];const vis=new Set<number>();
  while(q.length>0){const id=q.shift()!;if(!id||id<=0||vis.has(id))continue;
    vis.add(id);const n=nm.get(id);if(!n)continue;count++;
    if(n.leftChildId>0)q.push(n.leftChildId);if(n.rightChildId>0)q.push(n.rightChildId);}
  return Math.max(0,count-1);
}

// ── Mobile mini-popup (V-Boost style) ─────────────────────────────
function RadarMiniPopup({node,sx,sy,names,onMakeCenter}:{
  node:TreeNodeLike; sx:number; sy:number;
  names?:Record<string,string>; onMakeCenter:()=>void;
}){
  const lbl=nodeLabel(node,names);
  const avL=avLetter(lbl);const avc=avColor(node.userId);
  const isActive=node.packageLevel>0;
  const PW=155,PH=115,M=8;
  const vw=typeof window!=="undefined"?window.innerWidth:375;
  const vh=typeof window!=="undefined"?window.innerHeight:812;
  let left=Math.max(M,Math.min(sx-PW/2,vw-PW-M));
  let top=sy-PH-20;
  if(top<M)top=sy+24;
  top=Math.max(M,Math.min(top,vh-PH-M));
  return(
    <div
      style={{
        position:"fixed",zIndex:9999,left,top,width:PW,
        background:"rgba(9,11,26,0.97)",
        border:"1px solid rgba(79,110,247,0.45)",
        borderRadius:12,padding:"10px 12px",
        boxShadow:"0 8px 32px rgba(0,0,0,0.75),0 0 0 1px rgba(79,110,247,0.10)",
        backdropFilter:"blur(16px)",WebkitBackdropFilter:"blur(16px)",
      }}
      onClick={e=>e.stopPropagation()}
    >
      {/* Avatar + name */}
      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:7}}>
        <div style={{
          width:32,height:32,borderRadius:"50%",flexShrink:0,
          background:`${avc}26`,border:`1.5px solid ${avc}55`,
          display:"flex",alignItems:"center",justifyContent:"center",
          fontSize:14,fontWeight:800,color:"#eef4ff",fontFamily:"Syne,sans-serif",
        }}>{avL}</div>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontSize:12,fontWeight:700,color:"#eef4ff",fontFamily:"Syne,sans-serif",
            overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}
          >{clamp(lbl,11)}</div>
          <div style={{fontSize:9,color:"#475569",marginTop:1}}>{`#${encodeId(node.userId)}`}</div>
        </div>
      </div>
      {/* Badges */}
      <div style={{display:"flex",gap:5,marginBottom:9}}>
        <span style={{fontSize:9,fontWeight:700,padding:"2px 8px",borderRadius:10,
          background:"rgba(201,168,76,0.16)",color:GOLD}}>Pkg {node.packageLevel}</span>
        <span style={{fontSize:9,fontWeight:700,padding:"2px 8px",borderRadius:10,
          background:isActive?"rgba(34,197,94,0.14)":"rgba(100,116,139,0.14)",
          color:isActive?GREEN:"#64748b"}}>{isActive?"\u25cf Active":"\u25cb Inactive"}</span>
      </div>
      {/* Make center button */}
      <button type="button" onClick={onMakeCenter} style={{
        width:"100%",padding:"6px 8px",borderRadius:8,cursor:"pointer",
        background:"rgba(79,110,247,0.22)",border:"1px solid rgba(79,110,247,0.40)",
        color:"#c5d4ff",fontSize:10,fontWeight:700,letterSpacing:"0.02em",
      }}>\u2605 Make Center</button>
    </div>
  );
}

// ── Desktop detail panel ───────────────────────────────────────────
function RadarDetailPanel({node,nodeMap,onMakeCenter,onViewUser,userDisplayNames,currentUserId}:{
  node:TreeNodeLike;nodeMap:Map<number,TreeNodeLike>;
  onMakeCenter:()=>void;onViewUser:(id:number)=>void;
  userDisplayNames?:Record<string,string>;currentUserId:number|null;
}){
  const lbl=nodeLabel(node,userDisplayNames);
  const avL=avLetter(lbl);const avc=avColor(node.userId);
  const isActive=node.packageLevel>0;const isSelf=node.userId===currentUserId;
  const parentNode=node.parentId>0?nodeMap.get(node.parentId)??null:null;
  const leftNode=node.leftChildId>0?nodeMap.get(node.leftChildId)??null:null;
  const rightNode=node.rightChildId>0?nodeMap.get(node.rightChildId)??null:null;
  const leftTeam=node.leftChildId>0?countSubtree(node.leftChildId,nodeMap):0;
  const rightTeam=node.rightChildId>0?countSubtree(node.rightChildId,nodeMap):0;
  const card:React.CSSProperties={background:"rgba(255,255,255,0.035)",
    border:"1px solid rgba(79,110,247,0.18)",borderRadius:12,padding:"10px 12px",marginBottom:8};
  const btn=(label:string,fn:()=>void,primary=false,disabled=false)=>(
    <button type="button" onClick={fn} disabled={disabled} style={{
      flex:1,padding:"7px 4px",borderRadius:9,fontSize:11,fontWeight:700,
      cursor:disabled?"not-allowed":"pointer",
      border:primary?"1px solid #4f6ef7":"1px solid rgba(79,110,247,0.22)",
      background:primary?"rgba(79,110,247,0.28)":"rgba(79,110,247,0.08)",
      color:disabled?"#374151":primary?"#c5d4ff":"#94a3b8",transition:"all 0.15s",
    }}>{label}</button>
  );
  return(
    <div style={{minWidth:180,maxWidth:260,width:"100%",display:"flex",flexDirection:"column",gap:6,padding:"10px 0 4px"}}>
      <div style={{...card,display:"flex",alignItems:"center",gap:12}}>
        <div style={{width:46,height:46,borderRadius:"50%",flexShrink:0,
          background:`${avc}28`,border:`2px solid ${avc}60`,
          display:"flex",alignItems:"center",justifyContent:"center",
          fontSize:18,fontWeight:800,color:"#eef4ff",fontFamily:"Syne,sans-serif"}}>{avL}</div>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontSize:13,fontWeight:700,color:"#eef4ff",fontFamily:"Syne,sans-serif",
            overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{clamp(lbl,16)}</div>
          <div style={{fontSize:10,color:"#64748b",marginTop:2,fontFamily:"ui-monospace,monospace"}}>{shortWallet(node.account)}</div>
          <div style={{display:"flex",gap:4,marginTop:4,flexWrap:"wrap"}}>
            <span style={{fontSize:9,fontWeight:700,padding:"2px 7px",borderRadius:10,
              background:"rgba(201,168,76,0.16)",color:GOLD}}>Pkg {node.packageLevel}</span>
            <span style={{fontSize:9,fontWeight:700,padding:"2px 7px",borderRadius:10,
              background:isActive?"rgba(34,197,94,0.14)":"rgba(100,116,139,0.14)",
              color:isActive?GREEN:"#64748b"}}>{isActive?"Active":"Inactive"}</span>
            {isSelf&&<span style={{fontSize:9,fontWeight:700,padding:"2px 7px",borderRadius:10,
              background:"rgba(201,168,76,0.20)",color:GOLD}}>You</span>}
          </div>
        </div>
      </div>
      <div style={{...card,padding:"8px 10px"}}>
        <div style={{fontSize:9,color:"#475569",fontWeight:600,letterSpacing:"0.06em",
          textTransform:"uppercase",marginBottom:6}}>Network Stats</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
          {[["Direct",node.directReferrals,CYAN],["Depth",node.depth,"#94a3b8"],
            ["Left Team",leftTeam>0?`${leftTeam}+`:"—",CYAN],
            ["Right Team",rightTeam>0?`${rightTeam}+`:"—",PURPLE]].map(([l,v,c])=>(
            <div key={l as string} style={{background:"rgba(79,110,247,0.07)",borderRadius:8,padding:"6px 8px"}}>
              <div style={{fontSize:9,color:"#64748b",fontWeight:600,letterSpacing:"0.06em",
                textTransform:"uppercase",marginBottom:2}}>{l}</div>
              <div style={{fontSize:13,fontWeight:700,color:c as string}}>{v}</div>
            </div>
          ))}
        </div>
      </div>
      <div style={{...card,padding:"8px 10px"}}>
        <div style={{fontSize:9,color:"#475569",fontWeight:600,letterSpacing:"0.06em",
          textTransform:"uppercase",marginBottom:6}}>Navigate</div>
        <div style={{display:"flex",gap:5,marginBottom:5}}>
          {btn("\u2605 Make Center",onMakeCenter,true)}
          {btn("\u2191 Parent",()=>parentNode&&onViewUser(parentNode.userId),false,!parentNode)}
        </div>
        <div style={{display:"flex",gap:5}}>
          {btn("\u2190 Left",()=>leftNode&&onViewUser(leftNode.userId),false,!leftNode)}
          {btn("Right \u2192",()=>rightNode&&onViewUser(rightNode.userId),false,!rightNode)}
        </div>
      </div>
      <div style={{fontSize:8,color:"#334155",textAlign:"center",padding:"0 4px"}}>Team counts from cached data</div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Main RadarCanvas
// ═══════════════════════════════════════════════════════════════════
export default function RadarCanvas({
  visualTree,selectedId,currentUserId,onNodeClick,userDisplayNames,treePreview
}:TreeCanvasProps){
  const svgRef=useRef<SVGSVGElement>(null);
  const drag=useRef({on:false,x:0,y:0});
  const pinch=useRef({on:false,d:0});
  const [tx,setTx]=useState({x:0,y:0,s:1});
  const [hov,setHov]=useState<number|null>(null);
  const [anim,setAnim]=useState(false);
  // Desktop: peeked node for side panel
  const [peeked,setPeeked]=useState<TreeNodeLike|null>(null);
  // Mobile: floating mini-popup
  const [popup,setPopup]=useState<{node:TreeNodeLike;sx:number;sy:number}|null>(null);
  const cs=(v:number)=>Math.min(Math.max(v,0.3),4);

  useEffect(()=>{setPeeked(null);setPopup(null);},[treePreview]);

  useEffect(()=>{
    const el=svgRef.current;if(!el)return;
    const wh=(e:WheelEvent)=>{e.preventDefault();setTx(t=>({...t,s:cs(t.s*(e.deltaY<0?1.12:0.9))}));};
    const tm=(e:TouchEvent)=>{if(e.touches.length>=2)e.preventDefault();};
    el.addEventListener("wheel",wh,{passive:false});
    el.addEventListener("touchmove",tm,{passive:false});
    return()=>{el.removeEventListener("wheel",wh);el.removeEventListener("touchmove",tm);};
  },[]);

  const mDown=useCallback((e:React.MouseEvent)=>{e.preventDefault();drag.current={on:true,x:e.clientX,y:e.clientY};},[]);
  const mMove=useCallback((e:React.MouseEvent)=>{
    if(!drag.current.on)return;
    setTx(t=>({...t,x:t.x+e.clientX-drag.current.x,y:t.y+e.clientY-drag.current.y}));
    drag.current.x=e.clientX;drag.current.y=e.clientY;
  },[]);
  const mUp=useCallback(()=>{drag.current.on=false;},[]);
  const td=(e:React.TouchEvent)=>Math.hypot(
    e.touches[0].clientX-e.touches[1].clientX,e.touches[0].clientY-e.touches[1].clientY);
  const tStart=useCallback((e:React.TouchEvent)=>{
    if(e.touches.length===1){drag.current={on:true,x:e.touches[0].clientX,y:e.touches[0].clientY};}
    else if(e.touches.length===2){drag.current.on=false;pinch.current={on:true,d:td(e)};}
  },[]);
  const tMove=useCallback((e:React.TouchEvent)=>{
    if(e.touches.length===1&&drag.current.on){
      setTx(t=>({...t,x:t.x+e.touches[0].clientX-drag.current.x,y:t.y+e.touches[0].clientY-drag.current.y}));
      drag.current.x=e.touches[0].clientX;drag.current.y=e.touches[0].clientY;
    }else if(e.touches.length===2&&pinch.current.on){
      const d=td(e);const r=d/(pinch.current.d||d);pinch.current.d=d;
      setTx(t=>({...t,s:cs(t.s*r)}));
    }
  },[]);
  const tEnd=useCallback(()=>{drag.current.on=false;pinch.current.on=false;},[]);
  const reset=useCallback(()=>{setAnim(true);setTx({x:0,y:0,s:1});setTimeout(()=>setAnim(false),320);},[]);

  // Node tap handler — mobile: mini popup | desktop: side panel
  const handleNodeTap=useCallback((e:React.MouseEvent,node:TreeNodeLike)=>{
    e.stopPropagation(); // prevent SVG's "close" click
    const isMob=typeof window!=="undefined"&&window.innerWidth<768;
    if(isMob){
      if(popup?.node.userId===node.userId){
        // Second tap same node → make center
        setPopup(null);
        onNodeClick(node.userId);
      }else{
        setPopup({node,sx:e.clientX,sy:e.clientY});
        setPeeked(null);
      }
    }else{
      setPopup(null);
      setPeeked(p=>p?.userId===node.userId?null:node);
    }
  },[popup,onNodeClick]);

  const handleMakeCenter=useCallback(()=>{
    if(peeked){onNodeClick(peeked.userId);setPeeked(null);}
    if(popup){onNodeClick(popup.node.userId);setPopup(null);}
  },[peeked,popup,onNodeClick]);

  const handleViewUser=useCallback((uid:number)=>{
    const n=nodeMap.get(uid);if(n)setPeeked(n);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);

  // Build nodeMap
  const nodeMap=new Map<number,TreeNodeLike>((treePreview??[]).map(n=>[n.userId,n]));
  const hasFullData=nodeMap.size>3;
  const rootId=hasFullData?(treePreview?.[0]?.userId??currentUserId??0):(visualTree.node?.userId??currentUserId??0);
  if(!hasFullData){
    const addNode=(b:DisplayTreeNode|null)=>{if(!b||!b.node)return;nodeMap.set(b.node.userId,b.node);addNode(b.left);addNode(b.right);};
    addNode(visualTree);
  }

  const levels:number[][]=hasFullData
    ?buildRadarLevels(rootId,nodeMap,MAX_RINGS)
    :[[visualTree.node?.userId??0],
      [visualTree.left?.node?.userId??0,visualTree.right?.node?.userId??0],
      [visualTree.left?.left?.node?.userId??0,visualTree.left?.right?.node?.userId??0,
       visualTree.right?.left?.node?.userId??0,visualTree.right?.right?.node?.userId??0]];

  type PNode={id:number;ring:number;slot:number;total:number;cx:number;cy:number;};
  const positioned:PNode[]=[];
  for(let ring=0;ring<levels.length;ring++){
    const lvl=levels[ring];
    for(let slot=0;slot<lvl.length;slot++){
      const{cx,cy}=slotPos(ring,slot,lvl.length);
      positioned.push({id:lvl[slot],ring,slot,total:lvl.length,cx,cy});
    }
  }
  const posLookup=new Map<string,{cx:number;cy:number}>();
  positioned.forEach(p=>posLookup.set(`${p.ring}:${p.slot}`,{cx:p.cx,cy:p.cy}));
  const activeRings=levels.length-1;
  const hasPeeked=peeked!==null;

  return(
    <>
      {/* Mobile popup via portal (avoids overflow:hidden clipping) */}
      {popup&&typeof document!=="undefined"&&createPortal(
        <>
          <div style={{position:"fixed",inset:0,zIndex:9998}}
            onClick={()=>setPopup(null)} onTouchEnd={()=>setPopup(null)}
          />
          <RadarMiniPopup
            node={popup.node} sx={popup.sx} sy={popup.sy}
            names={userDisplayNames}
            onMakeCenter={()=>{onNodeClick(popup.node.userId);setPopup(null);}}
          />
        </>,
        document.body
      )}

      <div style={{
        display:"flex",flexDirection:"row",alignItems:"flex-start",
        background:"radial-gradient(ellipse 70% 65% at 50% 50%,rgba(79,110,247,0.13),transparent 75%),#0c0c1e",
        borderRadius:18,overflow:"hidden",border:"1px solid rgba(79,110,247,0.18)",
      }}>
        {/* SVG radar */}
        <div style={{position:"relative",flex:"1 1 auto",minWidth:0,userSelect:"none",touchAction:"none"}}>
          {/* Controls */}
          <div style={{position:"absolute",top:10,right:10,zIndex:10,display:"flex",flexDirection:"column",gap:5}}>
            {([
              ["+",()=>setTx(t=>({...t,s:cs(t.s*1.25)}))],
              ["\u2212",()=>setTx(t=>({...t,s:cs(t.s*0.80)}))],
              ["\u229f",reset],
            ] as [string,()=>void][]).map(([lbl,fn])=>(
              <button key={lbl} type="button" onClick={fn} style={{
                width:30,height:30,border:"1px solid rgba(79,110,247,0.32)",borderRadius:8,
                background:"rgba(79,110,247,0.14)",color:"#b9c7ff",fontSize:14,fontWeight:700,
                cursor:"pointer",display:"grid",placeItems:"center",padding:0,
              }}>{lbl}</button>
            ))}
          </div>
          <div style={{position:"absolute",top:12,left:12,zIndex:10,fontSize:10,
            color:"rgba(79,110,247,0.55)",fontWeight:700,letterSpacing:"0.06em",
            fontFamily:"DM Sans,sans-serif"}}>{activeRings} Ring{activeRings!==1?"s":""}</div>
          <div style={{position:"absolute",bottom:7,left:"50%",transform:"translateX(-50%)",
            fontSize:9.5,color:"rgba(255,255,255,0.14)",letterSpacing:"0.09em",
            whiteSpace:"nowrap",pointerEvents:"none",zIndex:5,
          }}>Tap \u00b7 Tap again to center \u00b7 Drag \u00b7 Pinch</div>

          <svg ref={svgRef} viewBox={`0 0 ${CVW} ${CVH}`} width="100%"
            style={{display:"block",cursor:drag.current.on?"grabbing":"grab",minHeight:220}}
            onMouseDown={mDown} onMouseMove={mMove} onMouseUp={mUp} onMouseLeave={mUp}
            onTouchStart={tStart} onTouchMove={tMove} onTouchEnd={tEnd}
            onClick={()=>{setPeeked(null);}} // empty space click closes desktop panel
          >
            <defs>
              <radialGradient id="rcBg" cx="50%" cy="50%" r="55%">
                <stop offset="0%" stopColor="rgba(79,110,247,0.22)"/>
                <stop offset="100%" stopColor="rgba(10,10,26,0.97)"/>
              </radialGradient>
              <radialGradient id="rcCur" cx="50%" cy="50%" r="55%">
                <stop offset="0%" stopColor="rgba(46,196,143,0.35)"/>
                <stop offset="100%" stopColor="rgba(10,10,26,0.97)"/>
              </radialGradient>
              <filter id="rcGlow" x="-40%" y="-40%" width="180%" height="180%">
                <feGaussianBlur stdDeviation="5" result="b"/>
                <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
              </filter>
              <filter id="rcPeek" x="-40%" y="-40%" width="180%" height="180%">
                <feGaussianBlur stdDeviation="3.5" result="b"/>
                <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
              </filter>
              <filter id="rcShdw" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="0" dy="4" stdDeviation="6" floodColor="rgba(0,0,0,0.6)"/>
              </filter>
            </defs>

            <g transform={`translate(${tx.x},${tx.y}) scale(${tx.s})`}
               style={{transition:anim?"transform 0.32s cubic-bezier(0.4,0,0.2,1)":"none"}}>

              {Array.from({length:activeRings},(_,i)=>{
                const r=RING_R[i+1];if(!r)return null;
                const op=Math.max(0.14-i*0.022,0.04);
                return(
                  <g key={`rg${i}`}>
                    <circle cx={CX} cy={CY} r={r} fill="none"
                      stroke={`rgba(79,110,247,${op.toFixed(3)})`}
                      strokeWidth={1} strokeDasharray="5 5"/>
                    <text x={CX+r+6} y={CY+4} fontSize={8}
                      fill={`rgba(79,110,247,${Math.max(op*2,0.25).toFixed(2)})`}
                      style={{fontFamily:"DM Sans,sans-serif"}}>Ring {i+1}</text>
                  </g>
                );
              })}

              {positioned.filter(p=>p.ring===1).map(p=>(
                <line key={`sk${p.slot}`} x1={CX} y1={CY} x2={p.cx} y2={p.cy}
                  stroke="rgba(79,110,247,0.06)" strokeWidth={1}/>
              ))}

              {levels.slice(0,-1).map((lvl,ring)=>
                lvl.map((_,slot)=>{
                  const pp=posLookup.get(`${ring}:${slot}`);if(!pp)return null;
                  return([0,1].map(side=>{
                    const childSlot=slot*2+side;
                    const childId=levels[ring+1]?.[childSlot]??0;if(!childId)return null;
                    const cp=posLookup.get(`${ring+1}:${childSlot}`);if(!cp)return null;
                    const op=Math.max(0.35-ring*0.06,0.08);
                    return(
                      <line key={`ln${ring}${slot}${side}`}
                        x1={pp.cx} y1={pp.cy} x2={cp.cx} y2={cp.cy}
                        stroke={`rgba(79,110,247,${op.toFixed(2)})`}
                        strokeWidth={Math.max(1.6-ring*0.25,0.6)} strokeLinecap="round"/>
                    );
                  }));
                })
              )}

              {positioned.map(({id,ring,cx,cy})=>{
                const node=id>0?nodeMap.get(id)??null:null;
                const nr=NODE_R[Math.min(ring,NODE_R.length-1)];
                const thr=TOUCH_R[Math.min(ring,TOUCH_R.length-1)];
                const isRoot=ring===0;
                const isPeeked=node!==null&&peeked?.userId===node.userId;
                const isPopup=node!==null&&popup?.node.userId===node.userId;
                const isCur=node!==null&&currentUserId===node.userId;
                const isEmpty=id===0||(!node&&!isRoot);
                const isHov=node!==null&&hov===node.userId;
                const lbl=nodeLabel(node,userDisplayNames);
                const avL=avLetter(lbl);const avc=node?avColor(node.userId):"#1e1e38";
                const cfg=ringLabelCfg(ring);
                const bg=isRoot?"url(#rcBg)":isCur?"url(#rcCur)":"rgba(14,14,30,0.97)";
                const str=isRoot?GOLD:(isPeeked||isPopup)?BLUE:isCur?GREEN
                         :isEmpty?"rgba(79,110,247,0.15)":isHov?"rgba(79,110,247,0.45)":"rgba(79,110,247,0.28)";
                const strW=(isRoot||isPeeked||isPopup||isCur)?2:1;
                const avR=Math.round(nr*0.50);const avFS=cfg.avFS;
                const avOY=cfg.showLabel?Math.round(-nr*0.08):0;
                return(
                  <g key={`rn${ring}:${id}:${cx.toFixed(0)}`}
                    onClick={e=>{if(node&&!isRoot)handleNodeTap(e,node);}}
                    onMouseEnter={()=>{if(node)setHov(node.userId);}}
                    onMouseLeave={()=>setHov(null)}
                    style={{cursor:node?"pointer":"default",
                      transform:(isPeeked||isPopup)?`translate(${cx}px,${cy}px) scale(1.10) translate(${-cx}px,${-cy}px)`:"none",
                      transition:"transform 0.18s ease",
                    }}
                    filter={(isRoot||isPeeked||isPopup)?"url(#rcGlow)":"url(#rcShdw)"}
                  >
                    <circle cx={cx} cy={cy} r={thr} fill="transparent"/>
                    {isRoot&&<circle cx={cx} cy={cy} r={nr+8} fill="none"
                      stroke={GOLD} strokeWidth={0.9} strokeOpacity={0.28} strokeDasharray="7 4"/>}
                    {(isPeeked||isPopup)&&<>
                      <circle cx={cx} cy={cy} r={nr+7} fill="none"
                        stroke={BLUE} strokeWidth={1.2} strokeOpacity={0.50}/>
                      <circle cx={cx} cy={cy} r={nr+13} fill="none"
                        stroke={BLUE} strokeWidth={0.5} strokeOpacity={0.20} strokeDasharray="4 3"/>
                    </>}
                    <circle cx={cx} cy={cy} r={nr} fill={bg} stroke={str} strokeWidth={strW}
                      strokeDasharray={isEmpty?"4 3":undefined}/>
                    {node?(
                      <>
                        <circle cx={cx} cy={cy+avOY} r={avR} fill={avc} fillOpacity={0.20}/>
                        {avFS>0&&<text x={cx} y={cy+avOY+avFS*0.38}
                          textAnchor="middle" fontSize={avFS} fontWeight={800}
                          fill={(isPeeked||isPopup)?"#c5d4ff":isCur?"#a7f3d0":"#eef4ff"}
                          style={{fontFamily:"Syne,sans-serif"}}>{avL}</text>}
                        {cfg.showLabel&&cfg.lblFS>0&&<text x={cx} y={cy+Math.round(nr*0.55)}
                          textAnchor="middle" fontSize={cfg.lblFS} fontWeight={600}
                          fill="rgba(255,255,255,0.52)"
                          style={{fontFamily:"DM Sans,sans-serif"}}>{clamp(lbl,cfg.labelMax)}</text>}
                        {cfg.showWallet&&cfg.walFS>0&&<text x={cx} y={cy+Math.round(nr*0.80)}
                          textAnchor="middle" fontSize={cfg.walFS}
                          fill="rgba(255,255,255,0.30)"
                          style={{fontFamily:"ui-monospace,monospace"}}>{shortWallet(node.account)}</text>}
                        {cfg.showPkg&&cfg.pkgFS>0&&<>
                          <rect x={cx-13} y={cy+nr-12} width={26} height={13} rx={6.5} ry={6.5}
                            fill="rgba(201,168,76,0.18)"/>
                          <text x={cx} y={cy+nr-2} textAnchor="middle"
                            fontSize={cfg.pkgFS} fontWeight={700} fill={GOLD}
                            style={{fontFamily:"DM Sans,sans-serif"}}>P{node.packageLevel}</text>
                        </>}
                        {cfg.showSide&&ring>0&&<>
                          <circle cx={cx+Math.round(nr*0.72)} cy={cy-Math.round(nr*0.72)} r={9}
                            fill={`${ring%2===1?CYAN:PURPLE}20`}
                            stroke={`${ring%2===1?CYAN:PURPLE}50`} strokeWidth={0.8}/>
                          <text x={cx+Math.round(nr*0.72)} y={cy-Math.round(nr*0.72)+3.5}
                            textAnchor="middle" fontSize={7} fontWeight={800}
                            fill={ring%2===1?CYAN:PURPLE}
                            style={{fontFamily:"DM Sans,sans-serif"}}>{ring%2===1?"L":"R"}</text>
                        </>}
                      </>
                    ):(
                      !isEmpty&&<text x={cx} y={cy+avFS*0.38} textAnchor="middle"
                        fontSize={avFS} fontWeight={200} fill="rgba(255,255,255,0.18)">+</text>
                    )}
                  </g>
                );
              })}
            </g>
          </svg>
        </div>

        {/* Desktop side panel */}
        {hasPeeked&&(
          <div style={{width:220,flexShrink:0,padding:"12px 10px 10px 0"}}
            className="radar-side-panel">
            <RadarDetailPanel
              node={peeked!} nodeMap={nodeMap}
              onMakeCenter={handleMakeCenter} onViewUser={handleViewUser}
              userDisplayNames={userDisplayNames} currentUserId={currentUserId}
            />
          </div>
        )}
      </div>

      <style>{`
        .radar-side-panel{display:none!important;}
        @media(min-width:768px){.radar-side-panel{display:block!important;}}
      `}</style>
    </>
  );
}

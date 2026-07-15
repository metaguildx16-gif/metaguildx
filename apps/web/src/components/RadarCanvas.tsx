import { useState, useRef, useCallback, useEffect } from "react";

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
  visualTree: DisplayTreeNode; selectedId: number | null;
  currentUserId: number | null; onNodeClick: (userId: number) => void;
  userDisplayNames?: Record<string, string>;
};

const CX = 300, CY = 285, R1 = 128, R2 = 228, CVW = 600, CVH = 572;
const NR = [44, 35, 28] as const;
const GOLD="#C9A84C",CYAN="#38BDF8",BLUE="#4f6ef7",PURPLE="#a78bfa",GREEN="#2EC48F";
const AV_PAL = ["#4f6ef7","#0ea5e9","#C9A84C","#2EC48F","#a78bfa","#f97316","#e11d48","#059669"];

function encodeId(id: number): string {
  const C="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let n=id+100000, s="";
  while(n>0){s=C[n%62]+s;n=Math.floor(n/62);}
  return s;
}
function nodeLabel(node: TreeNodeLike|null, names?: Record<string,string>): string {
  if(!node) return "Open Slot";
  const dn = node.account && names?.[node.account.toLowerCase()];
  return dn || `#${encodeId(node.userId)}`;
}
function avLetter(lbl: string): string {
  return lbl.replace(/[^a-zA-Z0-9#]/g,"").slice(0,1).toUpperCase() || "?";
}
function avColor(userId: number): string { return AV_PAL[userId % AV_PAL.length]; }

type RadPos = { b: DisplayTreeNode; cx: number; cy: number; depth: number };
function calcPos(branch: DisplayTreeNode, d: number, a0: number, a1: number, out: RadPos[]) {
  const mid=(a0+a1)/2, r=d===0?0:d===1?R1:R2;
  const cx=d===0?CX:CX+r*Math.cos(mid), cy=d===0?CY:CY+r*Math.sin(mid);
  out.push({b:branch,cx,cy,depth:d});
  if(branch.left)  calcPos(branch.left,  d+1, a0,  mid, out);
  if(branch.right) calcPos(branch.right, d+1, mid, a1,  out);
}

export default function RadarCanvas({
  visualTree,selectedId,currentUserId,onNodeClick,userDisplayNames
}: TreeCanvasProps) {
  const svgRef=useRef<SVGSVGElement>(null);
  const drag=useRef({on:false,x:0,y:0});
  const pinch=useRef({on:false,d:0});
  const [tx,setTx]=useState({x:0,y:0,s:1});
  const [hov,setHov]=useState<number|null>(null);
  const [anim,setAnim]=useState(false);
  const cs=(v:number)=>Math.min(Math.max(v,0.3),4);

  useEffect(()=>{
    const el=svgRef.current; if(!el) return;
    const wheel=(e:WheelEvent)=>{e.preventDefault();setTx(t=>({...t,s:cs(t.s*(e.deltaY<0?1.12:0.9))}));};
    const tmove=(e:TouchEvent)=>{if(e.touches.length>=2)e.preventDefault();};
    el.addEventListener("wheel",wheel,{passive:false});
    el.addEventListener("touchmove",tmove,{passive:false});
    return()=>{el.removeEventListener("wheel",wheel);el.removeEventListener("touchmove",tmove);};
  },[]);

  const mDown=useCallback((e:React.MouseEvent)=>{e.preventDefault();drag.current={on:true,x:e.clientX,y:e.clientY};},[]);
  const mMove=useCallback((e:React.MouseEvent)=>{
    if(!drag.current.on)return;
    setTx(t=>({...t,x:t.x+e.clientX-drag.current.x,y:t.y+e.clientY-drag.current.y}));
    drag.current.x=e.clientX;drag.current.y=e.clientY;
  },[]);
  const mUp=useCallback(()=>{drag.current.on=false;},[]);
  const tdist=(e:React.TouchEvent)=>Math.hypot(
    e.touches[0].clientX-e.touches[1].clientX,
    e.touches[0].clientY-e.touches[1].clientY
  );
  const tStart=useCallback((e:React.TouchEvent)=>{
    if(e.touches.length===1){drag.current={on:true,x:e.touches[0].clientX,y:e.touches[0].clientY};}
    else if(e.touches.length===2){drag.current.on=false;pinch.current={on:true,d:tdist(e)};}
  },[]);
  const tMove=useCallback((e:React.TouchEvent)=>{
    if(e.touches.length===1&&drag.current.on){
      setTx(t=>({...t,x:t.x+e.touches[0].clientX-drag.current.x,y:t.y+e.touches[0].clientY-drag.current.y}));
      drag.current.x=e.touches[0].clientX;drag.current.y=e.touches[0].clientY;
    }else if(e.touches.length===2&&pinch.current.on){
      const d=tdist(e);const ratio=d/(pinch.current.d||d);
      pinch.current.d=d;setTx(t=>({...t,s:cs(t.s*ratio)}));
    }
  },[]);
  const tEnd=useCallback(()=>{drag.current.on=false;pinch.current.on=false;},[]);
  const reset=useCallback(()=>{setAnim(true);setTx({x:0,y:0,s:1});setTimeout(()=>setAnim(false),320);},[]);

  const pos:RadPos[]=[];
  // Sector PI/2 → 5PI/2: Left child → 180° (west), Right child → 0° (east)
  calcPos(visualTree,0,Math.PI/2,Math.PI*5/2,pos);
  const pm=new Map(pos.map(p=>[p.b,p]));

  const sideCfg={
    ROOT:{color:GOLD,lbl:"YOU",bw:26},
    Left:{color:CYAN,lbl:"L",bw:14},
    Right:{color:PURPLE,lbl:"R",bw:14},
  } as const;

  return(
    <div style={{
      position:"relative",width:"100%",userSelect:"none",touchAction:"none",
      background:"radial-gradient(ellipse 65% 60% at 50% 50%,rgba(79,110,247,0.11),transparent 72%),#0c0c1e",
      borderRadius:18,overflow:"hidden",border:"1px solid rgba(79,110,247,0.18)",
    }}>
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
      <div style={{
        position:"absolute",bottom:7,left:"50%",transform:"translateX(-50%)",
        fontSize:9.5,color:"rgba(255,255,255,0.18)",letterSpacing:"0.09em",
        whiteSpace:"nowrap",pointerEvents:"none",zIndex:5,
      }}>Drag \u00b7 Scroll \u00b7 Pinch to navigate</div>

      <svg ref={svgRef} viewBox={`0 0 ${CVW} ${CVH}`} width="100%"
        style={{display:"block",cursor:drag.current.on?"grabbing":"grab",minHeight:220}}
        onMouseDown={mDown} onMouseMove={mMove} onMouseUp={mUp} onMouseLeave={mUp}
        onTouchStart={tStart} onTouchMove={tMove} onTouchEnd={tEnd}
      >
        <defs>
          <radialGradient id="rcBg" cx="50%" cy="40%" r="60%">
            <stop offset="0%" stopColor="rgba(79,110,247,0.18)"/>
            <stop offset="100%" stopColor="rgba(10,10,26,0.97)"/>
          </radialGradient>
          <radialGradient id="rcSel" cx="50%" cy="40%" r="60%">
            <stop offset="0%" stopColor="rgba(79,110,247,0.38)"/>
            <stop offset="100%" stopColor="rgba(10,10,26,0.97)"/>
          </radialGradient>
          <radialGradient id="rcCur" cx="50%" cy="40%" r="60%">
            <stop offset="0%" stopColor="rgba(46,196,143,0.32)"/>
            <stop offset="100%" stopColor="rgba(10,10,26,0.97)"/>
          </radialGradient>
          <filter id="rcGlow" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="5" result="b"/>
            <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
          <filter id="rcShdw" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="6" floodColor="rgba(0,0,0,0.6)"/>
          </filter>
        </defs>

        <g transform={`translate(${tx.x},${tx.y}) scale(${tx.s})`}
           style={{transition:anim?"transform 0.32s cubic-bezier(0.4,0,0.2,1)":"none"}}>

          {/* Radar rings */}
          <circle cx={CX} cy={CY} r={R1} fill="none" stroke="rgba(79,110,247,0.11)" strokeWidth={1} strokeDasharray="5 4"/>
          <circle cx={CX} cy={CY} r={R2} fill="none" stroke="rgba(79,110,247,0.07)" strokeWidth={1} strokeDasharray="5 4"/>
          <text x={CX+R1+5} y={CY+4} fontSize={8} fill="rgba(79,110,247,0.35)"
            style={{fontFamily:"DM Sans,sans-serif"}}>Ring 1</text>
          <text x={CX+R2+5} y={CY+4} fontSize={8} fill="rgba(79,110,247,0.22)"
            style={{fontFamily:"DM Sans,sans-serif"}}>Ring 2</text>

          {/* Spoke guides */}
          {pos.filter(p=>p.depth>0).map(({cx,cy},i)=>(
            <line key={`sp${i}`} x1={CX} y1={CY} x2={cx} y2={cy}
              stroke="rgba(79,110,247,0.07)" strokeWidth={1}
            />
          ))}

          {/* Connection lines */}
          {pos.map(({b,cx,cy})=>(
            (["left","right"] as const).map(side=>{
              const child=b[side]; if(!child) return null;
              const cp=pm.get(child); if(!cp) return null;
              return(
                <line key={`ln${cx}${cy}${side}`}
                  x1={cx} y1={cy} x2={cp.cx} y2={cp.cy}
                  stroke="rgba(79,110,247,0.30)" strokeWidth={1.4} strokeLinecap="round"
                />
              );
            })
          ))}

          {/* Nodes */}
          {pos.map(({b,cx,cy,depth})=>{
            const{node,side}=b;
            const nr=NR[Math.min(depth,NR.length-1)];
            const thr=Math.max(nr,22);
            const isSel=node!==null&&selectedId===node.userId;
            const isCur=node!==null&&currentUserId===node.userId;
            const isEmpty=node===null;
            const isHov=node!==null&&hov===node.userId;
            const cfg=sideCfg[side]??sideCfg.Right;
            const lbl=nodeLabel(node,userDisplayNames);
            const avL=avLetter(lbl);
            const avc=node?avColor(node.userId):"#1e1e38";
            const bg=depth===0?"url(#rcBg)":isSel?"url(#rcSel)":isCur?"url(#rcCur)":"rgba(14,14,30,0.97)";
            const str=isSel?BLUE:isCur?GREEN:depth===0?GOLD:isEmpty?"rgba(79,110,247,0.16)":isHov?"rgba(79,110,247,0.55)":"rgba(79,110,247,0.28)";
            const strW=(isSel||isCur||depth===0)?2:1;
            const avR=Math.round(nr*0.50);
            const avFS=Math.round(nr*0.44);
            const idFS=Math.max(7,Math.round(nr*0.23));
            return(
              <g key={`rn${cx}${cy}`}
                onClick={()=>{if(node){setHov(null);onNodeClick(node.userId);}}}
                onMouseEnter={()=>{if(node)setHov(node.userId);}}
                onMouseLeave={()=>setHov(null)}
                style={{cursor:node?"pointer":"default"}}
                filter={(isSel||depth===0)?"url(#rcGlow)":"url(#rcShdw)"}
              >
                {/* Large touch target */}
                <circle cx={cx} cy={cy} r={thr} fill="transparent"/>

                {/* Selection ring */}
                {isSel&&<circle cx={cx} cy={cy} r={nr+5} fill="none" stroke={BLUE} strokeWidth={1} strokeOpacity={0.4}/>}

                {/* Gold pulse ring — root node */}
                {depth===0&&(
                  <circle cx={cx} cy={cy} r={nr+7} fill="none"
                    stroke={GOLD} strokeWidth={0.9} strokeOpacity={0.28} strokeDasharray="7 4"
                  />
                )}

                {/* Node body */}
                <circle cx={cx} cy={cy} r={nr}
                  fill={bg} stroke={str} strokeWidth={strW}
                  strokeDasharray={isEmpty?"4 3":undefined}
                />

                {node?(
                  <>
                    {/* Avatar circle */}
                    <circle cx={cx} cy={cy-Math.round(nr*0.10)} r={avR}
                      fill={avc} fillOpacity={0.20}
                    />
                    {/* Avatar letter */}
                    <text x={cx} y={cy-Math.round(nr*0.10)+Math.round(avFS*0.37)}
                      textAnchor="middle" fontSize={avFS} fontWeight={800}
                      fill={isSel?"#c5d4ff":isCur?"#a7f3d0":"#eef4ff"}
                      style={{fontFamily:"Syne,sans-serif"}}
                    >{avL}</text>
                    {/* ID label */}
                    <text x={cx} y={cy+Math.round(nr*0.54)}
                      textAnchor="middle" fontSize={idFS} fontWeight={600}
                      fill="rgba(255,255,255,0.50)"
                      style={{fontFamily:"DM Sans,sans-serif"}}
                    >{lbl.slice(0,9)}</text>
                    {/* Package badge */}
                    {depth>0&&(
                      <>
                        <rect x={cx-13} y={cy+nr-11} width={26} height={12} rx={6} ry={6}
                          fill="rgba(201,168,76,0.18)"
                        />
                        <text x={cx} y={cy+nr-2} textAnchor="middle"
                          fontSize={7} fontWeight={700} fill={GOLD}
                          style={{fontFamily:"DM Sans,sans-serif"}}
                        >P{node.packageLevel}</text>
                      </>
                    )}
                    {/* Side badge */}
                    {depth>0&&(
                      <>
                        <circle cx={cx+Math.round(nr*0.72)} cy={cy-Math.round(nr*0.72)} r={9}
                          fill={`${cfg.color}20`} stroke={`${cfg.color}50`} strokeWidth={0.8}
                        />
                        <text x={cx+Math.round(nr*0.72)} y={cy-Math.round(nr*0.72)+3.5}
                          textAnchor="middle" fontSize={7} fontWeight={800} fill={cfg.color}
                          style={{fontFamily:"DM Sans,sans-serif"}}
                        >{cfg.lbl}</text>
                      </>
                    )}
                  </>
                ):(
                  <text x={cx} y={cy+5} textAnchor="middle"
                    fontSize={Math.round(nr*0.52)} fontWeight={200}
                    fill="rgba(255,255,255,0.18)"
                  >+</text>
                )}
              </g>
            );
          })}
        </g>
      </svg>
    </div>
  );
}

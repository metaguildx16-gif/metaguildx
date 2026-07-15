import { useState, useRef, useCallback, useEffect } from "react";

// ── Types (mirrors TreePanel — no cross-import) ────────────────────
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
  treePreview?: TreeNodeLike[];    // full subtree — enables 5-ring radar
};

// ── Layout constants ───────────────────────────────────────────────
const CX = 400, CY = 400, CVW = 800, CVH = 800;
const MAX_RINGS = 5;
// Radial distance for each ring (SVG units)
const RING_R  = [0, 102, 184, 262, 334, 400] as const;
// Visual node radius per ring
const NODE_R  = [44,  36,  28,  22,  18,  15] as const;
// Touch-target radius (always >= 24px for mobile)
const TOUCH_R = [50,  46,  40,  36,  32,  28] as const;

// ── Brand palette ──────────────────────────────────────────────────
const GOLD="#C9A84C", CYAN="#38BDF8", BLUE="#4f6ef7";
const PURPLE="#a78bfa", GREEN="#2EC48F";
const AV_PAL=["#4f6ef7","#0ea5e9","#C9A84C","#2EC48F","#a78bfa","#f97316","#e11d48","#059669"];

// ── Helpers ────────────────────────────────────────────────────────
function encodeId(id: number): string {
  const C="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let n=id+100000,s=""; while(n>0){s=C[n%62]+s;n=Math.floor(n/62);} return s;
}
function nodeLabel(n: TreeNodeLike|null, names?: Record<string,string>): string {
  if(!n) return "Open Slot";
  const dn=n.account&&names?.[n.account.toLowerCase()]; return dn||`#${encodeId(n.userId)}`;
}
function shortWallet(a?:string|null):string{ return a?`${a.slice(0,6)}\u2026${a.slice(-4)}`:"Pending"; }
function clamp(s:string,n:number):string{ return s.length>n?s.slice(0,n-1)+"\u2026":s; }
function avColor(uid:number):string{ return AV_PAL[uid%AV_PAL.length]; }
function avLetter(lbl:string):string{ return lbl.replace(/[^a-zA-Z0-9#]/g,"").slice(0,1).toUpperCase()||"?"; }

// ── 5-Ring BFS (pure frontend — zero RPC calls) ────────────────────
// Architecture note: when Phase 2 parallel-fetch is added, replace
// nodeMap here with the deeper loadRadarTreeLevels() result.
function buildRadarLevels(
  rootId: number,
  nodeMap: Map<number, TreeNodeLike>,
  maxRings: number
): number[][] {
  const levels: number[][] = [[rootId]];
  let current = [rootId];
  for (let ring = 1; ring <= maxRings; ring++) {
    const next: number[] = [];
    for (const id of current) {
      const node = id > 0 ? nodeMap.get(id) : undefined;
      next.push(node?.leftChildId  ?? 0);
      next.push(node?.rightChildId ?? 0);
    }
    levels.push(next);
    current = next;
    if (next.every(id => id === 0)) break; // prune fully empty rings
  }
  return levels;
}

// ── Position for a slot in a ring ─────────────────────────────────
function slotPos(ring: number, slotIndex: number, totalSlots: number) {
  if (ring === 0) return { cx: CX, cy: CY };
  const angle = (2 * Math.PI / totalSlots) * slotIndex - Math.PI / 2;
  const r = RING_R[Math.min(ring, RING_R.length - 1)];
  return { cx: CX + r * Math.cos(angle), cy: CY + r * Math.sin(angle) };
}

// ── Label config per ring ──────────────────────────────────────────
function ringLabelCfg(ring: number) {
  return {
    showLabel:  ring <= 2,
    showWallet: ring === 0,
    showPkg:    ring <= 1,
    showSide:   ring <= 1,
    labelMax:   ring === 0 ? 13 : ring === 1 ? 11 : 8,
    avFS:       [20, 16, 13, 10, 8, 7][Math.min(ring, 5)],
    lblFS:      [13, 11,  8,  0, 0, 0][Math.min(ring, 5)],
    walFS:      [ 9,  0,  0,  0, 0, 0][Math.min(ring, 5)],
    pkgFS:      [ 8,  7,  0,  0, 0, 0][Math.min(ring, 5)],
  };
}

// ═══════════════════════════════════════════════════════════════════
// Main component
// ═══════════════════════════════════════════════════════════════════
export default function RadarCanvas({
  visualTree, selectedId, currentUserId, onNodeClick,
  userDisplayNames, treePreview
}: TreeCanvasProps) {
  const svgRef=useRef<SVGSVGElement>(null);
  const drag=useRef({on:false,x:0,y:0});
  const pinch=useRef({on:false,d:0});
  const [tx,setTx]=useState({x:0,y:0,s:1});
  const [hov,setHov]=useState<number|null>(null);
  const [anim,setAnim]=useState(false);
  const cs=(v:number)=>Math.min(Math.max(v,0.3),4);

  // Non-passive wheel + touchmove
  useEffect(()=>{
    const el=svgRef.current; if(!el)return;
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

  // ── Build radar data ────────────────────────────────────────────
  // Build nodeMap from treePreview (63 nodes, already in memory)
  const nodeMap = new Map<number,TreeNodeLike>((treePreview??[]).map(n=>[n.userId,n]));
  const hasFullData = nodeMap.size > 3;

  // Determine center node
  const rootId = hasFullData
    ? (treePreview?.[0]?.userId ?? currentUserId ?? 0)
    : (visualTree.node?.userId ?? currentUserId ?? 0);

  // BFS to build rings (zero RPC calls — uses existing nodeMap)
  const levels: number[][] = hasFullData
    ? buildRadarLevels(rootId, nodeMap, MAX_RINGS)
    : [
        [visualTree.node?.userId ?? 0],
        [visualTree.left?.node?.userId??0, visualTree.right?.node?.userId??0],
        [...[visualTree.left?.left?.node?.userId??0, visualTree.left?.right?.node?.userId??0,
             visualTree.right?.left?.node?.userId??0,visualTree.right?.right?.node?.userId??0]]
      ];

  // If not full data, supplement nodeMap from visualTree
  if(!hasFullData){
    const addNode=(b:DisplayTreeNode|null)=>{
      if(!b||!b.node)return;
      nodeMap.set(b.node.userId,b.node);
      addNode(b.left);addNode(b.right);
    };
    addNode(visualTree);
  }

  // Pre-compute all positions
  type PNode={id:number;ring:number;slot:number;total:number;cx:number;cy:number;};
  const positioned:PNode[]=[];
  for(let ring=0;ring<levels.length;ring++){
    const lvl=levels[ring];
    for(let slot=0;slot<lvl.length;slot++){
      const {cx,cy}=slotPos(ring,slot,lvl.length);
      positioned.push({id:lvl[slot],ring,slot,total:lvl.length,cx,cy});
    }
  }

  // Position lookup: ring:slot → cx,cy
  const posLookup=new Map<string,{cx:number;cy:number}>();
  positioned.forEach(p=>posLookup.set(`${p.ring}:${p.slot}`,{cx:p.cx,cy:p.cy}));

  const activeRings=levels.length-1;

  return(
    <div style={{
      position:"relative",width:"100%",userSelect:"none",touchAction:"none",
      background:"radial-gradient(ellipse 70% 65% at 50% 50%,rgba(79,110,247,0.13),transparent 75%),#0c0c1e",
      borderRadius:18,overflow:"hidden",border:"1px solid rgba(79,110,247,0.18)",
    }}>
      {/* Zoom controls */}
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

      {/* Ring count indicator */}
      <div style={{
        position:"absolute",top:12,left:12,zIndex:10,
        fontSize:10,color:"rgba(79,110,247,0.55)",fontWeight:700,
        letterSpacing:"0.06em",fontFamily:"DM Sans,sans-serif",
      }}>{activeRings} Ring{activeRings!==1?"s":""}</div>

      {/* Hint */}
      <div style={{
        position:"absolute",bottom:7,left:"50%",transform:"translateX(-50%)",
        fontSize:9.5,color:"rgba(255,255,255,0.16)",letterSpacing:"0.09em",
        whiteSpace:"nowrap",pointerEvents:"none",zIndex:5,
      }}>Drag \u00b7 Scroll \u00b7 Pinch to navigate</div>

      <svg ref={svgRef} viewBox={`0 0 ${CVW} ${CVH}`} width="100%"
        style={{display:"block",cursor:drag.current.on?"grabbing":"grab",minHeight:240}}
        onMouseDown={mDown} onMouseMove={mMove} onMouseUp={mUp} onMouseLeave={mUp}
        onTouchStart={tStart} onTouchMove={tMove} onTouchEnd={tEnd}
      >
        <defs>
          <radialGradient id="rcBg" cx="50%" cy="50%" r="55%">
            <stop offset="0%" stopColor="rgba(79,110,247,0.22)"/>
            <stop offset="100%" stopColor="rgba(10,10,26,0.97)"/>
          </radialGradient>
          <radialGradient id="rcSel" cx="50%" cy="50%" r="55%">
            <stop offset="0%" stopColor="rgba(79,110,247,0.42)"/>
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
          <filter id="rcShdw" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="6" floodColor="rgba(0,0,0,0.6)"/>
          </filter>
        </defs>

        <g transform={`translate(${tx.x},${tx.y}) scale(${tx.s})`}
           style={{transition:anim?"transform 0.32s cubic-bezier(0.4,0,0.2,1)":"none"}}>

          {/* Ring guides */}
          {Array.from({length:activeRings},(_,i)=>{
            const r=RING_R[i+1]; if(!r)return null;
            const op=0.14-i*0.022;
            return(
              <g key={`rg${i}`}>
                <circle cx={CX} cy={CY} r={r} fill="none"
                  stroke={`rgba(79,110,247,${Math.max(op,0.04).toFixed(3)})`}
                  strokeWidth={1} strokeDasharray="5 5"
                />
                <text x={CX+r+6} y={CY+4} fontSize={8}
                  fill={`rgba(79,110,247,${Math.max(op*2,0.25).toFixed(2)})`}
                  style={{fontFamily:"DM Sans,sans-serif"}}
                >Ring {i+1}</text>
              </g>
            );
          })}

          {/* Spoke guides (faint lines from center to ring-1 nodes) */}
          {positioned.filter(p=>p.ring===1).map(p=>(
            <line key={`sk${p.slot}`} x1={CX} y1={CY} x2={p.cx} y2={p.cy}
              stroke="rgba(79,110,247,0.06)" strokeWidth={1}
            />
          ))}

          {/* Connection lines (parent → children, filled children only) */}
          {levels.slice(0,-1).map((lvl,ring)=>
            lvl.map((parentId,slot)=>{
              const pp=posLookup.get(`${ring}:${slot}`); if(!pp) return null;
              return([0,1].map(side=>{
                const childSlot=slot*2+side;
                const childId=levels[ring+1]?.[childSlot]??0;
                if(!childId) return null;
                const cp=posLookup.get(`${ring+1}:${childSlot}`); if(!cp) return null;
                const op=Math.max(0.35-ring*0.06,0.08);
                return(
                  <line key={`ln${ring}${slot}${side}`}
                    x1={pp.cx} y1={pp.cy} x2={cp.cx} y2={cp.cy}
                    stroke={`rgba(79,110,247,${op.toFixed(2)})`}
                    strokeWidth={Math.max(1.6-ring*0.25,0.6)} strokeLinecap="round"
                  />
                );
              }));
            })
          )}

          {/* Nodes */}
          {positioned.map(({id,ring,cx,cy})=>{
            const node=id>0?nodeMap.get(id)??null:null;
            const nr=NODE_R[Math.min(ring,NODE_R.length-1)];
            const thr=TOUCH_R[Math.min(ring,TOUCH_R.length-1)];
            const isSel=node!==null&&selectedId===node.userId;
            const isCur=node!==null&&currentUserId===node.userId;
            const isRoot=ring===0;
            const isEmpty=id===0||(!node&&!isRoot);
            const isHov=node!==null&&hov===node.userId;
            const lbl=nodeLabel(node,userDisplayNames);
            const avL=avLetter(lbl);
            const avc=node?avColor(node.userId):"#1e1e38";
            const cfg=ringLabelCfg(ring);

            const bg=isRoot?"url(#rcBg)":isSel?"url(#rcSel)":isCur?"url(#rcCur)":"rgba(14,14,30,0.97)";
            const str=isRoot?GOLD:isSel?BLUE:isCur?GREEN
                      :isEmpty?"rgba(79,110,247,0.15)":isHov?"rgba(79,110,247,0.55)":"rgba(79,110,247,0.28)";
            const strW=(isRoot||isSel||isCur)?2:1;
            const avR=Math.round(nr*0.50);
            const avFS=cfg.avFS;
            const avOY=cfg.showLabel?Math.round(-nr*0.08):0;

            return(
              <g key={`rn${ring}:${id}:${cx.toFixed(0)}`}
                onClick={()=>{if(node){setHov(null);onNodeClick(node.userId);}}}
                onMouseEnter={()=>{if(node)setHov(node.userId);}}
                onMouseLeave={()=>setHov(null)}
                style={{cursor:node?"pointer":"default"}}
                filter={(isRoot||isSel)?"url(#rcGlow)":"url(#rcShdw)"}
              >
                {/* Touch target */}
                <circle cx={cx} cy={cy} r={thr} fill="transparent"/>

                {/* Root pulse ring */}
                {isRoot&&(
                  <circle cx={cx} cy={cy} r={nr+8} fill="none"
                    stroke={GOLD} strokeWidth={0.9} strokeOpacity={0.28} strokeDasharray="7 4"
                  />
                )}

                {/* Selection ring */}
                {isSel&&!isRoot&&(
                  <circle cx={cx} cy={cy} r={nr+5} fill="none"
                    stroke={BLUE} strokeWidth={0.9} strokeOpacity={0.40}
                  />
                )}

                {/* Node body */}
                <circle cx={cx} cy={cy} r={nr}
                  fill={bg} stroke={str} strokeWidth={strW}
                  strokeDasharray={isEmpty?"4 3":undefined}
                />

                {node?(
                  <>
                    {/* Avatar ring */}
                    <circle cx={cx} cy={cy+avOY} r={avR}
                      fill={avc} fillOpacity={0.20}
                    />
                    {/* Avatar letter */}
                    {avFS>0&&(
                      <text x={cx} y={cy+avOY+avFS*0.38}
                        textAnchor="middle" fontSize={avFS} fontWeight={800}
                        fill={isSel?"#c5d4ff":isCur?"#a7f3d0":"#eef4ff"}
                        style={{fontFamily:"Syne,sans-serif"}}
                      >{avL}</text>
                    )}
                    {/* Label */}
                    {cfg.showLabel&&cfg.lblFS>0&&(
                      <text x={cx} y={cy+Math.round(nr*0.55)}
                        textAnchor="middle" fontSize={cfg.lblFS} fontWeight={600}
                        fill="rgba(255,255,255,0.52)"
                        style={{fontFamily:"DM Sans,sans-serif"}}
                      >{clamp(lbl,cfg.labelMax)}</text>
                    )}
                    {/* Wallet */}
                    {cfg.showWallet&&cfg.walFS>0&&(
                      <text x={cx} y={cy+Math.round(nr*0.80)}
                        textAnchor="middle" fontSize={cfg.walFS}
                        fill="rgba(255,255,255,0.30)"
                        style={{fontFamily:"ui-monospace,monospace"}}
                      >{shortWallet(node.account)}</text>
                    )}
                    {/* Package badge */}
                    {cfg.showPkg&&cfg.pkgFS>0&&(
                      <>
                        <rect x={cx-13} y={cy+nr-12} width={26} height={13} rx={6.5} ry={6.5}
                          fill="rgba(201,168,76,0.18)"
                        />
                        <text x={cx} y={cy+nr-2} textAnchor="middle"
                          fontSize={cfg.pkgFS} fontWeight={700} fill={GOLD}
                          style={{fontFamily:"DM Sans,sans-serif"}}
                        >P{node.packageLevel}</text>
                      </>
                    )}
                    {/* L/R side badge */}
                    {cfg.showSide&&ring>0&&(
                      <>
                        <circle cx={cx+Math.round(nr*0.72)} cy={cy-Math.round(nr*0.72)} r={9}
                          fill={`${ring%2===1?CYAN:PURPLE}20`}
                          stroke={`${ring%2===1?CYAN:PURPLE}50`} strokeWidth={0.8}
                        />
                        <text x={cx+Math.round(nr*0.72)} y={cy-Math.round(nr*0.72)+3.5}
                          textAnchor="middle" fontSize={7} fontWeight={800}
                          fill={ring%2===1?CYAN:PURPLE}
                          style={{fontFamily:"DM Sans,sans-serif"}}
                        >{ring%2===1?"L":"R"}</text>
                      </>
                    )}
                  </>
                ):(
                  !isEmpty&&(
                    <text x={cx} y={cy+avFS*0.38} textAnchor="middle"
                      fontSize={avFS} fontWeight={200} fill="rgba(255,255,255,0.18)"
                    >+</text>
                  )
                )}
              </g>
            );
          })}
        </g>
      </svg>
    </div>
  );
}

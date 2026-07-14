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

const NW=130,NH=80,VG=66,PT=24,PB=28,CW=620,CH=PT+2*(NH+VG)+NH+PB;
const GOLD="#C9A84C",CYAN="#38BDF8",BLUE="#4f6ef7",PURPLE="#a78bfa",GREEN="#2EC48F";

function encodeId(id: number): string {
  const C="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let n=id+100000,s="";
  while(n>0){s=C[n%62]+s;n=Math.floor(n/62);}
  return s;
}
function nodeLabel(node:TreeNodeLike|null,names?:Record<string,string>):string{
  if(!node)return"Open Slot";
  const dn=node.account&&names?.[node.account.toLowerCase()];
  return dn||`#${encodeId(node.userId)}`;
}
function shortWallet(a?:string|null):string{
  return a?`${a.slice(0,6)}\u2026${a.slice(-4)}`:"Pending";
}
function clamp(s:string,n:number):string{
  return s.length>n?s.slice(0,n-1)+"\u2026":s;
}

type Pos={b:DisplayTreeNode;cx:number;cy:number};
function calcPos(branch:DisplayTreeNode,depth:number,l:number,r:number,out:Pos[]){
  const cx=(l+r)/2,cy=PT+depth*(NH+VG)+NH/2;
  out.push({b:branch,cx,cy});
  if(branch.left)calcPos(branch.left,depth+1,l,cx,out);
  if(branch.right)calcPos(branch.right,depth+1,cx,r,out);
}

export default function TreeCanvas({
  visualTree,selectedId,currentUserId,onNodeClick,userDisplayNames
}:TreeCanvasProps){
  const svgRef=useRef<SVGSVGElement>(null);
  const drag=useRef({on:false,x:0,y:0});
  const pinch=useRef({on:false,d:0});
  const [tx,setTx]=useState({x:0,y:0,s:1});
  const [hov,setHov]=useState<number|null>(null);
  const [anim,setAnim]=useState(false);
  const cs=(v:number)=>Math.min(Math.max(v,0.3),4);

  useEffect(()=>{
    const el=svgRef.current;if(!el)return;
    const wheel=(e:WheelEvent)=>{
      e.preventDefault();
      setTx(t=>({...t,s:cs(t.s*(e.deltaY<0?1.12:0.9))}));
    };
    const tmove=(e:TouchEvent)=>{if(e.touches.length>=2)e.preventDefault();};
    el.addEventListener("wheel",wheel,{passive:false});
    el.addEventListener("touchmove",tmove,{passive:false});
    return()=>{el.removeEventListener("wheel",wheel);el.removeEventListener("touchmove",tmove);};
  },[]);

  const mDown=useCallback((e:React.MouseEvent)=>{
    e.preventDefault();drag.current={on:true,x:e.clientX,y:e.clientY};
  },[]);
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

  const pos:Pos[]=[];
  calcPos(visualTree,0,0,CW,pos);
  const pm=new Map(pos.map(p=>[p.b,p]));
  const sideCfg={
    ROOT:{color:GOLD,lbl:"ROOT",bw:34},
    Left:{color:CYAN,lbl:"L",bw:18},
    Right:{color:PURPLE,lbl:"R",bw:18},
  } as const;

  return(
    <div style={{
      position:"relative",width:"100%",userSelect:"none",touchAction:"none",
      background:"radial-gradient(ellipse 80% 50% at 50% -10%,rgba(79,110,247,0.12),transparent 65%),#0c0c1e",
      borderRadius:18,overflow:"hidden",border:"1px solid rgba(79,110,247,0.18)",
    }}>
      <div style={{position:"absolute",top:10,right:10,zIndex:10,display:"flex",flexDirection:"column",gap:5}}>
        {([
          ["+",()=>setTx(t=>({...t,s:cs(t.s*1.25)}))],
          ["\u2212",()=>setTx(t=>({...t,s:cs(t.s*0.80)}))],
          ["\u229f",reset],
        ] as [string,()=>void][]).map(([lbl,fn])=>(
          <button key={lbl} type="button" onClick={fn} style={{
            width:30,height:30,border:"1px solid rgba(79,110,247,0.32)",
            borderRadius:8,background:"rgba(79,110,247,0.14)",
            color:"#b9c7ff",fontSize:14,fontWeight:700,
            cursor:"pointer",display:"grid",placeItems:"center",padding:0,
          }}>{lbl}</button>
        ))}
      </div>
      <div style={{
        position:"absolute",bottom:7,left:"50%",transform:"translateX(-50%)",
        fontSize:9.5,color:"rgba(255,255,255,0.18)",letterSpacing:"0.09em",
        whiteSpace:"nowrap",pointerEvents:"none",zIndex:5,
      }}>Drag &middot; Scroll &middot; Pinch to navigate</div>

      <svg ref={svgRef} viewBox={`0 0 ${CW} ${CH}`} width="100%"
        style={{display:"block",cursor:drag.current.on?"grabbing":"grab",minHeight:220}}
        onMouseDown={mDown} onMouseMove={mMove} onMouseUp={mUp} onMouseLeave={mUp}
        onTouchStart={tStart} onTouchMove={tMove} onTouchEnd={tEnd}
      >
        <defs>
          <linearGradient id="tcSel" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="rgba(79,110,247,0.30)"/>
            <stop offset="100%" stopColor="rgba(10,10,26,0.96)"/>
          </linearGradient>
          <linearGradient id="tcCur" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="rgba(46,196,143,0.26)"/>
            <stop offset="100%" stopColor="rgba(10,10,26,0.96)"/>
          </linearGradient>
          <linearGradient id="tcShim" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.07)"/>
            <stop offset="100%" stopColor="rgba(255,255,255,0.00)"/>
          </linearGradient>
          <filter id="tcGlow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="4" result="b"/>
            <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
          <filter id="tcShdw" x="-15%" y="-15%" width="130%" height="140%">
            <feDropShadow dx="0" dy="5" stdDeviation="7" floodColor="rgba(0,0,0,0.55)"/>
          </filter>
        </defs>

        <g transform={`translate(${tx.x},${tx.y}) scale(${tx.s})`}
           style={{transition:anim?"transform 0.32s cubic-bezier(0.4,0,0.2,1)":"none"}}>

          {pos.map(({b,cx,cy})=>{
            const botY=cy+NH/2;
            return(["left","right"] as const).map(side=>{
              const child=b[side];if(!child)return null;
              const cp=pm.get(child);if(!cp)return null;
              const topY=cp.cy-NH/2,mid=(botY+topY)/2;
              return(
                <path key={`c${cx}${cy}${side}`}
                  d={`M ${cx} ${botY} C ${cx} ${mid}, ${cp.cx} ${mid}, ${cp.cx} ${topY}`}
                  fill="none" stroke="rgba(79,110,247,0.28)" strokeWidth={1.4} strokeLinecap="round"
                />
              );
            });
          })}

          {pos.map(({b,cx,cy})=>{
            const{node,side}=b;
            const nx=cx-NW/2,ny=cy-NH/2;
            const isSel=node!==null&&selectedId===node.userId;
            const isCur=node!==null&&currentUserId===node.userId;
            const isEmpty=node===null;
            const isHov=node!==null&&hov===node.userId;
            const cfg=sideCfg[side]??sideCfg.Right;
            const bg=isSel?"url(#tcSel)":isCur?"url(#tcCur)":isEmpty?"rgba(9,9,22,0.92)":"rgba(16,16,32,0.95)";
            const str=isSel?BLUE:isCur?GREEN:isEmpty?"rgba(79,110,247,0.16)":isHov?"rgba(79,110,247,0.55)":"rgba(79,110,247,0.24)";
            const strW=(isSel||isCur)?1.8:1;
            const lbl=nodeLabel(node,userDisplayNames);
            return(
              <g key={`n${cx}${cy}`}
                onClick={()=>{if(node){setHov(null);onNodeClick(node.userId);}}}
                onMouseEnter={()=>{if(node)setHov(node.userId);}}
                onMouseLeave={()=>setHov(null)}
                style={{cursor:node?"pointer":"default"}}
                filter={isSel?"url(#tcGlow)":"url(#tcShdw)"}
              >
                {isSel&&(
                  <rect x={nx-3} y={ny-3} width={NW+6} height={NH+6} rx={17} ry={17}
                    fill="none" stroke={BLUE} strokeWidth={0.9} strokeOpacity={0.38}
                  />
                )}
                <rect x={nx} y={ny} width={NW} height={NH} rx={14} ry={14}
                  fill={bg} stroke={str} strokeWidth={strW}
                  strokeDasharray={isEmpty?"5 4":undefined}
                />
                {!isEmpty&&(
                  <rect x={nx} y={ny} width={NW} height={NH/2} rx={14} ry={14}
                    fill="url(#tcShim)" pointerEvents="none"
                  />
                )}
                <rect x={nx+NW-cfg.bw-8} y={ny+8} width={cfg.bw} height={15} rx={7.5} ry={7.5}
                  fill={`${cfg.color}1e`}
                />
                <text x={nx+NW-cfg.bw/2-8} y={ny+19.5} textAnchor="middle"
                  fontSize={7.5} fontWeight={800} fill={cfg.color}
                  style={{fontFamily:"DM Sans,sans-serif",letterSpacing:"0.04em"}}
                >{cfg.lbl}</text>
                {node?(
                  <>
                    <text x={nx+11} y={ny+26} fontSize={11.5} fontWeight={700}
                      fill={isSel?"#c5d4ff":"#eef4ff"} style={{fontFamily:"Syne,sans-serif"}}
                    >{clamp(lbl,13)}</text>
                    <text x={nx+11} y={ny+43} fontSize={8.8} fill="rgba(255,255,255,0.36)"
                      style={{fontFamily:"ui-monospace,monospace"}}
                    >{shortWallet(node.account)}</text>
                    <rect x={nx+11} y={ny+51} width={50} height={16} rx={8} ry={8}
                      fill="rgba(201,168,76,0.13)"
                    />
                    <text x={nx+36} y={ny+63} textAnchor="middle"
                      fontSize={8.5} fontWeight={700} fill={GOLD}
                      style={{fontFamily:"DM Sans,sans-serif"}}
                    >Pkg {node.packageLevel}</text>
                  </>
                ):(
                  <>
                    <text x={cx} y={ny+35} textAnchor="middle" fontSize={10.5} fontWeight={600}
                      fill="rgba(255,255,255,0.22)" style={{fontFamily:"DM Sans,sans-serif"}}
                    >Open Slot</text>
                    <text x={cx} y={ny+53} textAnchor="middle" fontSize={8.5}
                      fill="rgba(255,255,255,0.13)"
                    >Auto placement</text>
                  </>
                )}
              </g>
            );
          })}
        </g>
      </svg>
    </div>
  );
}

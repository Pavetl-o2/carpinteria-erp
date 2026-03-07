import React, { useState, useMemo, useRef, useEffect } from "react";
import { INVOICES, POS, ACTIVITY, EXTRACTED_ITEMS } from "./data.js";
import { useSupabaseData } from "./useSupabaseData.js";
import { BulkUploadModal, downloadTemplate } from "./BulkUpload.jsx";

// ─── STYLES & PRIMITIVES ───
const C = { bg:"#F7F5F2",card:"#FFF",sb:"#1C1917",sbH:"#292524",sbA:"#44403C",ac:"#B45309",acL:"#FEF3C7",tx:"#1C1917",txM:"#78716C",txL:"#A8A29E",txW:"#F5F5F4",bd:"#E7E5E4",ok:"#15803D",okBg:"#DCFCE7",warn:"#A16207",warnBg:"#FEF9C3",err:"#DC2626",errBg:"#FEE2E2",info:"#1D4ED8",infoBg:"#DBEAFE",pur:"#7C3AED",purBg:"#EDE9FE" };
const Ic=({d,size=18,...p})=><svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>{typeof d==="string"?<path d={d}/>:d}</svg>;
const fmt=n=>n!=null?`$${n.toLocaleString("es-MX")}`:"—";

const Badge=({children,v="default",pulse})=>{const s={default:{background:C.bd,color:C.tx},success:{background:C.okBg,color:C.ok},warning:{background:C.warnBg,color:C.warn},danger:{background:C.errBg,color:C.err},info:{background:C.infoBg,color:C.info},purple:{background:C.purBg,color:C.pur},accent:{background:C.acL,color:C.ac}};return <span style={{...s[v],padding:"2px 10px",borderRadius:9999,fontSize:12,fontWeight:600,letterSpacing:.3,whiteSpace:"nowrap",display:"inline-flex",alignItems:"center",gap:4}}>{pulse&&<span style={{width:6,height:6,borderRadius:"50%",background:"currentColor",animation:"pulse 1.5s infinite"}}/>}{children}</span>};
const SBadge=({s})=>{const m={draft:["Borrador","default"],pending_approval:["Pendiente","warning"],approved:["Aprobada","info"],in_progress:["En proceso","purple"],completed:["Completada","success"],rejected:["Rechazada","danger"],processing:["Procesando","warning"],awaiting_review:["En revisión","accent"],saved:["Guardada","success"],sent:["Enviada","info"],partially_received:["Parcial","accent"],received:["Recibida","success"],unpaid:["Sin pagar","danger"],paid:["Pagada","success"]};const[l,vr]=m[s]||[s,"default"];return <Badge v={vr} pulse={s==="processing"}>{l}</Badge>};
const PBadge=({p})=>{const m={low:["Baja","default"],medium:["Media","info"],high:["Alta","warning"],urgent:["Urgente","danger"]};const[l,v]=m[p]||[p,"default"];return <Badge v={v} pulse={p==="urgent"}>{l}</Badge>};
const Stars=({r})=><span style={{display:"inline-flex",gap:1,color:C.ac}}>{Array.from({length:5},(_,i)=><span key={i} style={{color:i<Math.floor(r)?C.ac:C.bd}}>★</span>)}<span style={{marginLeft:4,fontSize:12,color:C.txM}}>{r}</span></span>;
const Card=({children,style:sx,onClick})=><div onClick={onClick} style={{background:C.card,borderRadius:12,border:`1px solid ${C.bd}`,padding:20,cursor:onClick?"pointer":"default",transition:"box-shadow .2s",...sx}}>{children}</div>;
const Btn=({children,v="default",size="md",onClick,disabled,style:sx})=>{const b={border:"none",borderRadius:8,cursor:disabled?"not-allowed":"pointer",fontWeight:600,fontFamily:"inherit",display:"inline-flex",alignItems:"center",gap:6,transition:"all .15s",opacity:disabled?.5:1};const sz={sm:{padding:"6px 12px",fontSize:12},md:{padding:"9px 16px",fontSize:13},lg:{padding:"12px 24px",fontSize:14}};const vs={default:{background:C.card,color:C.tx,boxShadow:`inset 0 0 0 1px ${C.bd}`},primary:{background:C.ac,color:"#FFF"},success:{background:C.ok,color:"#FFF"},danger:{background:C.err,color:"#FFF"},ghost:{background:"transparent",color:C.txM}};return <button onClick={disabled?undefined:onClick} style={{...b,...sz[size],...vs[v],...sx}}>{children}</button>};
const Inp=({...p})=><input {...p} style={{width:"100%",padding:"9px 12px",borderRadius:8,border:`1px solid ${C.bd}`,fontSize:14,fontFamily:"inherit",boxSizing:"border-box",...p.style}}/>;
const Sel=({children,...p})=><select {...p} style={{width:"100%",padding:"9px 12px",borderRadius:8,border:`1px solid ${C.bd}`,fontSize:14,fontFamily:"inherit",boxSizing:"border-box",...p.style}}>{children}</select>;
const Search=({value,onChange,placeholder="Buscar..."})=><div style={{position:"relative",maxWidth:320,width:"100%"}}><div style={{position:"absolute",left:12,top:"50%",transform:"translateY(-50%)",color:C.txL}}>🔍</div><Inp value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} style={{paddingLeft:36}}/></div>;
const Label=({children})=><label style={{display:"block",fontSize:12,fontWeight:600,color:C.txM,marginBottom:4}}>{children}</label>;
const Loader=({error,onRetry})=>error?<div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:60,gap:16}}><div style={{fontSize:48}}>⚠️</div><div style={{fontSize:16,fontWeight:600,color:C.err}}>Error al cargar datos</div><div style={{fontSize:13,color:C.txM,textAlign:"center",maxWidth:400}}>{error}</div>{onRetry&&<Btn v="primary" onClick={onRetry}>Reintentar</Btn>}</div>:<div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:60,gap:16}}><div style={{width:40,height:40,border:`4px solid ${C.bd}`,borderTopColor:C.ac,borderRadius:"50%",animation:"spin 0.8s linear infinite"}}/><div style={{fontSize:14,color:C.txM}}>Cargando datos...</div><style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style></div>;
const StatCard=({icon,label,value,sub,color=C.ac})=><Card style={{display:"flex",gap:16,alignItems:"center"}}><div style={{width:48,height:48,borderRadius:12,background:`${color}15`,display:"flex",alignItems:"center",justifyContent:"center",color,fontSize:22,flexShrink:0}}>{icon}</div><div><div style={{fontSize:13,color:C.txM,marginBottom:2}}>{label}</div><div style={{fontSize:24,fontWeight:700,lineHeight:1.1}}>{value}</div>{sub&&<div style={{fontSize:12,color:C.txM,marginTop:2}}>{sub}</div>}</div></Card>;

const Tbl=({cols,data,onRow})=><div style={{overflowX:"auto",borderRadius:10,border:`1px solid ${C.bd}`,background:C.card}}><table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}><thead><tr style={{background:"#FAFAF9"}}>{cols.map(c=><th key={c.k} style={{padding:"10px 14px",textAlign:"left",fontWeight:600,color:C.txM,borderBottom:`1px solid ${C.bd}`,fontSize:12,textTransform:"uppercase",letterSpacing:.5,whiteSpace:"nowrap"}}>{c.l}</th>)}</tr></thead><tbody>{data.map((r,i)=><tr key={r.id||i} onClick={()=>onRow?.(r)} style={{cursor:onRow?"pointer":"default",borderBottom:i<data.length-1?`1px solid ${C.bd}`:"none"}} onMouseEnter={e=>{if(onRow)e.currentTarget.style.background="#FAFAF9"}} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>{cols.map(c=><td key={c.k} style={{padding:"11px 14px",whiteSpace:c.nw?"nowrap":"normal"}}>{c.r?c.r(r[c.k],r):r[c.k]}</td>)}</tr>)}</tbody></table></div>;

const Modal=({open,onClose,title,w=520,children})=>{if(!open)return null;return <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.5)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000}} onClick={onClose}><div onClick={e=>e.stopPropagation()} style={{background:C.card,borderRadius:16,padding:28,width:w,maxWidth:"95vw",maxHeight:"85vh",overflow:"auto"}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}><h3 style={{margin:0,fontSize:18,fontWeight:700}}>{title}</h3><button onClick={onClose} style={{background:"none",border:"none",cursor:"pointer",color:C.txM,fontSize:20}}>×</button></div>{children}</div></div>};

// ─── ITEM SEARCH COMBO (hybrid catalog/free-text) ───
const ItemCombo=({value,onChange,items:ITEMS=[]})=>{
  const[q,setQ]=useState(value?.name||"");
  const[open,setOpen]=useState(false);
  const ref=useRef(null);
  const res=q.length>=2?ITEMS.filter(i=>i.name.toLowerCase().includes(q.toLowerCase())||i.sku.toLowerCase().includes(q.toLowerCase())).slice(0,5):[];

  useEffect(()=>{const h=e=>{if(ref.current&&!ref.current.contains(e.target))setOpen(false)};document.addEventListener("mousedown",h);return()=>document.removeEventListener("mousedown",h)},[]);

  const pick=item=>{onChange({itemId:item.id,name:item.name,unit:item.unit,estCost:item.unitCost,type:"catalog"});setQ(item.name);setOpen(false)};
  const free=()=>{onChange({itemId:null,name:q,unit:"pza",estCost:null,type:"free_text"});setOpen(false)};

  const isCat=value?.type==="catalog";
  const isFree=value?.type==="free_text"&&q;

  return <div ref={ref} style={{position:"relative",width:"100%"}}>
    <div style={{position:"relative"}}>
      <Inp value={q} onChange={e=>{setQ(e.target.value);setOpen(true);if(e.target.value!==value?.name)onChange({itemId:null,name:e.target.value,unit:"pza",estCost:null,type:"free_text"})}} onFocus={()=>{if(q.length>=2)setOpen(true)}} placeholder="Buscar item en catálogo o escribir texto libre..." style={{paddingLeft:34,paddingRight:90,borderColor:isCat?C.ok:isFree?"#E8A030":C.bd,background:isCat?`${C.okBg}40`:"white"}}/>
      <span style={{position:"absolute",left:11,top:"50%",transform:"translateY(-50%)",fontSize:14}}>{isCat?"✅":isFree?"✏️":"🔍"}</span>
      {(isCat||isFree)&&<span style={{position:"absolute",right:10,top:"50%",transform:"translateY(-50%)",fontSize:10,fontWeight:700,color:isCat?C.ok:"#D97706"}}>{isCat?"CATÁLOGO":"TEXTO LIBRE"}</span>}
    </div>
    {open&&q.length>=2&&<div style={{position:"absolute",top:"100%",left:0,right:0,background:C.card,border:`1px solid ${C.bd}`,borderRadius:10,marginTop:4,boxShadow:"0 8px 24px rgba(0,0,0,.12)",zIndex:50,overflow:"hidden"}}>
      {res.length>0&&<div style={{padding:"6px 0"}}><div style={{padding:"6px 14px",fontSize:10,fontWeight:700,color:C.txL,textTransform:"uppercase",letterSpacing:.8}}>Coincidencias en catálogo</div>
        {res.map(item=><button key={item.id} onClick={()=>pick(item)} style={{width:"100%",padding:"9px 14px",display:"flex",alignItems:"center",gap:10,background:"none",border:"none",cursor:"pointer",fontFamily:"inherit",textAlign:"left",fontSize:13}} onMouseEnter={e=>e.currentTarget.style.background="#FAFAF9"} onMouseLeave={e=>e.currentTarget.style.background="none"}>
          <span style={{color:C.ok}}>✅</span><div style={{flex:1}}><div style={{fontWeight:600}}>{item.name}</div><div style={{fontSize:11,color:C.txM}}>{item.sku} · {item.unit} · {fmt(item.unitCost)} · Stock: {item.currentStock}</div></div>
        </button>)}</div>}
      <button onClick={free} style={{width:"100%",padding:"11px 14px",display:"flex",alignItems:"center",gap:10,background:"#FFFBEB",border:"none",borderTop:res.length?`1px solid ${C.bd}`:"none",cursor:"pointer",fontFamily:"inherit",textAlign:"left",fontSize:13}} onMouseEnter={e=>e.currentTarget.style.background="#FEF3C7"} onMouseLeave={e=>e.currentTarget.style.background="#FFFBEB"}>
        <span>✏️</span><div><div style={{fontWeight:600,color:C.warn}}>Usar como texto libre: "{q}"</div><div style={{fontSize:11,color:C.txM}}>No está en catálogo — el manager lo revisará al aprobar</div></div>
      </button>
    </div>}
  </div>
};

// ─── NEW REQUISITION ───
const NewReqPage=({onBack,items:ITEMS=[],categories:CATEGORIES=[]})=>{
  const[form,setForm]=useState({title:"",project:"",priority:"medium",neededBy:"",notes:""});
  const[lines,setLines]=useState([{id:1,item:null,qty:"",unit:"pza",notes:""}]);
  const nid=useRef(2);
  const addLine=()=>setLines([...lines,{id:nid.current++,item:null,qty:"",unit:"pza",notes:""}]);
  const rmLine=id=>{if(lines.length>1)setLines(lines.filter(l=>l.id!==id))};
  const upLine=(id,f,v)=>setLines(lines.map(l=>l.id===id?{...l,[f]:v}:l));
  const catC=lines.filter(l=>l.item?.type==="catalog").length;
  const freeC=lines.filter(l=>l.item?.type==="free_text"&&l.item?.name).length;
  const est=lines.reduce((s,l)=>{const c=l.item?.estCost||0;return s+c*(parseFloat(l.qty)||0)},0);
  const ok=form.title&&lines.some(l=>l.item?.name&&l.qty);

  return <div>
    <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:24}}><Btn onClick={onBack}>← Volver</Btn><h2 style={{margin:0,fontSize:18,fontWeight:700}}>Nueva Requisición</h2></div>
    <div style={{display:"grid",gridTemplateColumns:"1fr 320px",gap:20}}>
      <div>
        <Card style={{marginBottom:20}}>
          <h3 style={{fontSize:14,fontWeight:700,margin:"0 0 16px",color:C.txM,textTransform:"uppercase",letterSpacing:.5}}>Información General</h3>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
            <div><Label>Título *</Label><Inp value={form.title} onChange={e=>setForm({...form,title:e.target.value})} placeholder="ej: Material cocina López"/></div>
            <div><Label>Proyecto</Label><Inp value={form.project} onChange={e=>setForm({...form,project:e.target.value})} placeholder="ej: Cocina López"/></div>
            <div><Label>Prioridad</Label><Sel value={form.priority} onChange={e=>setForm({...form,priority:e.target.value})}><option value="low">🟢 Baja</option><option value="medium">🔵 Media</option><option value="high">🟠 Alta</option><option value="urgent">🔴 Urgente</option></Sel></div>
            <div><Label>Fecha límite</Label><Inp type="date" value={form.neededBy} onChange={e=>setForm({...form,neededBy:e.target.value})}/></div>
          </div>
        </Card>
        <Card>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
            <h3 style={{fontSize:14,fontWeight:700,margin:0,color:C.txM,textTransform:"uppercase",letterSpacing:.5}}>Materiales</h3>
            <Btn v="primary" size="sm" onClick={addLine}>+ Agregar</Btn>
          </div>
          <p style={{fontSize:12,color:C.txM,margin:"0 0 16px"}}>Busca en el catálogo o escribe texto libre si no existe. El manager revisará los items nuevos.</p>
          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            {lines.map((line,idx)=><div key={line.id} style={{display:"flex",gap:10,alignItems:"start",padding:14,borderRadius:10,border:`1px solid ${C.bd}`,background:line.item?.type==="free_text"&&line.item?.name?"#FFFDF5":"#FAFAF9"}}>
              <span style={{fontSize:12,fontWeight:700,color:C.txL,paddingTop:10,minWidth:20}}>{idx+1}</span>
              <div style={{flex:1,display:"flex",flexDirection:"column",gap:8}}>
                <ItemCombo value={line.item} onChange={item=>{upLine(line.id,"item",item);if(item.unit)upLine(line.id,"unit",item.unit)}} items={ITEMS}/>
                <div style={{display:"flex",gap:8}}>
                  <Inp type="number" value={line.qty} onChange={e=>upLine(line.id,"qty",e.target.value)} placeholder="Cant." style={{width:90,textAlign:"center"}}/>
                  <Sel value={line.unit} onChange={e=>upLine(line.id,"unit",e.target.value)} style={{width:90}}>{["pza","hoja","litro","kg","m","caja","par","rollo","galón"].map(u=><option key={u}>{u}</option>)}</Sel>
                  <Inp value={line.notes} onChange={e=>upLine(line.id,"notes",e.target.value)} placeholder="Notas (opcional)" style={{flex:1}}/>
                  <div style={{padding:"7px 0",fontSize:12,color:C.txM,whiteSpace:"nowrap",minWidth:70,textAlign:"right"}}>{line.item?.estCost?`~${fmt(line.item.estCost*(parseFloat(line.qty)||0))}`:""}</div>
                </div>
              </div>
              <button onClick={()=>rmLine(line.id)} style={{background:"none",border:"none",cursor:"pointer",color:C.txL,padding:"8px 4px",fontSize:18}}>×</button>
            </div>)}
          </div>
          <button onClick={addLine} style={{width:"100%",marginTop:12,background:"none",border:`2px dashed ${C.bd}`,borderRadius:10,padding:"12px",cursor:"pointer",color:C.txM,fontSize:13,fontFamily:"inherit"}} onMouseEnter={e=>e.currentTarget.style.borderColor=C.ac} onMouseLeave={e=>e.currentTarget.style.borderColor=C.bd}>+ Agregar otro material</button>
        </Card>
      </div>
      <div><Card style={{position:"sticky",top:20}}>
        <h3 style={{fontSize:14,fontWeight:700,margin:"0 0 16px",color:C.txM,textTransform:"uppercase",letterSpacing:.5}}>Resumen</h3>
        <div style={{display:"flex",flexDirection:"column",gap:12,marginBottom:20}}>
          <div style={{display:"flex",justifyContent:"space-between"}}><span style={{fontSize:13,color:C.txM}}>Del catálogo</span><Badge v="success">{catC}</Badge></div>
          <div style={{display:"flex",justifyContent:"space-between"}}><span style={{fontSize:13,color:C.txM}}>Texto libre</span><Badge v={freeC>0?"warning":"default"}>{freeC}</Badge></div>
          <div style={{borderTop:`1px solid ${C.bd}`,paddingTop:12,display:"flex",justifyContent:"space-between"}}><span style={{fontWeight:600,fontSize:13}}>Costo estimado</span><span style={{fontWeight:700,fontFamily:"monospace"}}>{est>0?fmt(est):"—"}</span></div>
        </div>
        {freeC>0&&<div style={{background:C.warnBg,borderRadius:8,padding:12,marginBottom:16,fontSize:12,color:C.warn,lineHeight:1.5}}><strong>✏️ {freeC} item{freeC>1?"s":""} no catalogado{freeC>1?"s":""}</strong><br/>Se enviarán para revisión del manager.</div>}
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          <Btn v="primary" size="lg" disabled={!ok} onClick={()=>{alert("✅ Requisición enviada para aprobación");onBack()}} style={{width:"100%",justifyContent:"center"}}>Enviar para Aprobación</Btn>
          <Btn size="lg" disabled={!ok} onClick={()=>{alert("💾 Borrador guardado");onBack()}} style={{width:"100%",justifyContent:"center"}}>Guardar Borrador</Btn>
        </div>
      </Card></div>
    </div>
  </div>
};

// ─── REQUISITION DETAIL (APPROVAL VIEW) ───
const ReqDetailPage=({req,onBack,items:ITEMS=[],categories:CATEGORIES=[]})=>{
  const[items,setItems]=useState(req.items.map(i=>({...i,action:null,linked:null})));
  const[linkM,setLinkM]=useState(null);
  const[catM,setCatM]=useState(null);
  const[rejM,setRejM]=useState(false);
  const[rejR,setRejR]=useState("");
  const freeI=items.filter(i=>i.type==="free_text");
  const unresolved=freeI.filter(i=>!i.action);
  const pending=req.status==="pending_approval";
  const act=(id,a,d={})=>setItems(items.map(i=>i.id===id?{...i,action:a,...d}:i));

  return <div>
    <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:24}}><Btn onClick={onBack}>← Volver</Btn><h2 style={{margin:0,fontSize:18,fontWeight:700}}>{req.number}</h2><SBadge s={req.status}/><PBadge p={req.priority}/></div>
    <div style={{display:"grid",gridTemplateColumns:"1fr 320px",gap:20}}>
      <div>
        <Card style={{marginBottom:20}}>
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:16}}>
            {[["Solicitante",req.requester],["Proyecto",req.project||"—"],["Fecha límite",req.neededBy],["Creada",req.createdAt]].map(([l,v])=><div key={l}><div style={{fontSize:11,color:C.txL,marginBottom:2}}>{l}</div><div style={{fontSize:14,fontWeight:600}}>{v}</div></div>)}
          </div>
        </Card>

        {pending&&freeI.length>0&&<div style={{background:"#FFFBEB",border:"1px solid #FCD34D",borderRadius:12,padding:16,marginBottom:20}}>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}><span style={{fontSize:20}}>✏️</span><strong style={{color:C.warn,fontSize:14}}>{freeI.length} item{freeI.length>1?"s":""} no catalogado{freeI.length>1?"s":""}</strong></div>
          <p style={{fontSize:13,color:"#92400E",margin:0,lineHeight:1.5}}>Para cada uno puedes: <strong>dar de alta</strong> en catálogo, <strong>vincular</strong> a un item existente, o <strong>dejar como texto libre</strong>.</p>
        </div>}

        <Card>
          <h3 style={{fontSize:14,fontWeight:700,margin:"0 0 16px",color:C.txM,textTransform:"uppercase",letterSpacing:.5}}>Materiales ({items.length})</h3>
          {items.map((item,idx)=><div key={item.id} style={{padding:"14px 0",borderBottom:idx<items.length-1?`1px solid ${C.bd}`:"none"}}>
            <div style={{display:"flex",alignItems:"start",gap:12}}>
              <div style={{width:28,height:28,borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,fontSize:13,fontWeight:700,...(item.type==="catalog"?{background:C.okBg,color:C.ok}:item.action==="cataloged"?{background:C.okBg,color:C.ok}:item.action==="linked"?{background:C.infoBg,color:C.info}:item.action==="free"?{background:C.warnBg,color:C.warn}:{background:"#FEF3C7",color:"#D97706"})}}>
                {item.type==="catalog"?"✓":item.action==="cataloged"?"✓":item.action==="linked"?"↗":item.action==="free"?"✎":"?"}
              </div>
              <div style={{flex:1}}>
                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4,flexWrap:"wrap"}}>
                  <span style={{fontWeight:600,fontSize:14}}>{item.name}</span>
                  {item.type==="catalog"&&<Badge v="success">Catálogo</Badge>}
                  {item.type==="free_text"&&!item.action&&<Badge v="warning">No catalogado</Badge>}
                  {item.action==="cataloged"&&<Badge v="success">✓ Dado de alta</Badge>}
                  {item.action==="linked"&&<Badge v="info">↗ Vinculado → {item.linked}</Badge>}
                  {item.action==="free"&&<Badge v="accent">Texto libre</Badge>}
                </div>
                <div style={{display:"flex",gap:16,fontSize:13,color:C.txM,flexWrap:"wrap",alignItems:"center"}}>
                  <span><strong>{item.qty}</strong> {item.unit}{item.qtyApproved!=null&&item.qtyApproved!==item.qtyRequested&&<span style={{fontSize:11,color:C.warn,marginLeft:6}}>(original: {item.qtyRequested})</span>}</span>
                  {item.estCost&&<span>~{fmt(item.estCost)} c/u</span>}
                  {item.estCost&&<span style={{fontWeight:600,color:C.tx}}>Subtotal: {fmt(item.estCost*item.qty)}</span>}
                  {!item.estCost&&<span style={{color:C.warn,fontStyle:"italic"}}>Costo por definir</span>}
                </div>
                {item.notes&&<div style={{fontSize:12,color:C.ac,marginTop:4,fontStyle:"italic"}}>💬 "{item.notes}"</div>}
              </div>
              {pending&&item.type==="free_text"&&!item.action&&<div style={{display:"flex",gap:6,flexShrink:0}}>
                <Btn size="sm" v="success" onClick={()=>setCatM(item)}>+ Alta</Btn>
                <Btn size="sm" onClick={()=>setLinkM(item)}>↗ Vincular</Btn>
                <Btn size="sm" v="ghost" onClick={()=>act(item.id,"free")}>Dejar libre</Btn>
              </div>}
              {pending&&item.action&&<Btn size="sm" v="ghost" onClick={()=>act(item.id,null,{linked:null,estCost:item.type==="free_text"?null:item.estCost})}>Deshacer</Btn>}
            </div>
          </div>)}
        </Card>
      </div>

      <div>{pending&&<Card style={{position:"sticky",top:20}}>
        <h3 style={{fontSize:14,fontWeight:700,margin:"0 0 16px",color:C.txM,textTransform:"uppercase",letterSpacing:.5}}>Aprobar</h3>
        <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:16}}>
          <div style={{display:"flex",justifyContent:"space-between",fontSize:13}}><span style={{color:C.txM}}>Catálogo</span><Badge v="success">{items.filter(i=>i.type==="catalog").length}</Badge></div>
          <div style={{display:"flex",justifyContent:"space-between",fontSize:13}}><span style={{color:C.txM}}>Texto libre</span><Badge v={freeI.length>0?"warning":"default"}>{freeI.length}</Badge></div>
          {unresolved.length>0&&<div style={{display:"flex",justifyContent:"space-between",fontSize:13}}><span style={{color:C.err,fontWeight:600}}>Sin resolver</span><Badge v="danger">{unresolved.length}</Badge></div>}
          <div style={{borderTop:`1px solid ${C.bd}`,paddingTop:10,display:"flex",justifyContent:"space-between",fontSize:13}}><span style={{fontWeight:600}}>Costo estimado</span><span style={{fontWeight:700,fontFamily:"monospace"}}>{fmt(req.estimatedCost)}</span></div>
        </div>
        {unresolved.length>0&&<div style={{background:C.warnBg,borderRadius:8,padding:10,marginBottom:16,fontSize:12,color:C.warn,lineHeight:1.5}}>⚠ Resuelve los {unresolved.length} items no catalogados antes de aprobar.</div>}
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          <Btn v="success" size="lg" disabled={unresolved.length>0} onClick={()=>{alert("✅ Requisición aprobada");onBack()}} style={{width:"100%",justifyContent:"center"}}>✓ Aprobar</Btn>
          <Btn v="danger" size="lg" onClick={()=>setRejM(true)} style={{width:"100%",justifyContent:"center"}}>✕ Rechazar</Btn>
          <Btn size="lg" onClick={()=>{alert("↩ Devuelta con comentarios");onBack()}} style={{width:"100%",justifyContent:"center"}}>↩ Devolver</Btn>
        </div>
      </Card>}
      {!pending&&<Card><h3 style={{fontSize:14,fontWeight:700,margin:"0 0 12px",color:C.txM}}>Estado</h3><p style={{fontSize:14}}>Esta requisición está <strong>{req.status==="approved"?"aprobada":req.status==="in_progress"?"en proceso":"completada"}</strong>.</p></Card>}
      </div>
    </div>

    <Modal open={!!linkM} onClose={()=>setLinkM(null)} title="Vincular a Item Existente" w={500}>
      {linkM&&<div>
        <div style={{background:"#FFFBEB",borderRadius:8,padding:12,marginBottom:16,fontSize:13}}><strong>Pedido:</strong> "{linkM.name}"{linkM.notes&&<div style={{marginTop:4,fontStyle:"italic",color:C.txM}}>Nota: "{linkM.notes}"</div>}</div>
        <p style={{fontSize:13,color:C.txM,marginBottom:12}}>Selecciona el item del catálogo:</p>
        <div style={{display:"flex",flexDirection:"column",gap:6,maxHeight:300,overflow:"auto"}}>
          {ITEMS.map(item=><button key={item.id} onClick={()=>{act(linkM.id,"linked",{linked:item.name,estCost:item.unitCost});setLinkM(null)}} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 12px",borderRadius:8,border:`1px solid ${C.bd}`,background:"white",cursor:"pointer",fontFamily:"inherit",textAlign:"left",width:"100%",fontSize:13}} onMouseEnter={e=>e.currentTarget.style.background="#FAFAF9"} onMouseLeave={e=>e.currentTarget.style.background="white"}>
            <span style={{color:C.ok}}>✅</span><div style={{flex:1}}><div style={{fontWeight:600}}>{item.name}</div><div style={{fontSize:11,color:C.txM}}>{item.sku} · {fmt(item.unitCost)}</div></div><span style={{fontSize:12,color:C.txM}}>Stock: {item.currentStock}</span>
          </button>)}
        </div>
      </div>}
    </Modal>

    <Modal open={!!catM} onClose={()=>setCatM(null)} title="Dar de Alta en Catálogo" w={480}>
      {catM&&<div>
        <div style={{background:"#FFFBEB",borderRadius:8,padding:12,marginBottom:16,fontSize:13}}><strong>Pedido:</strong> "{catM.name}"{catM.notes&&<div style={{marginTop:4,fontStyle:"italic",color:C.txM}}>Nota: "{catM.notes}"</div>}</div>
        <div style={{display:"flex",flexDirection:"column",gap:14}}>
          <div><Label>Nombre *</Label><Inp defaultValue={catM.name}/></div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <div><Label>SKU</Label><Inp placeholder="Auto-generado"/></div>
            <div><Label>Categoría</Label><Sel>{CATEGORIES.map(c=><option key={c.id}>{c.name}</option>)}</Sel></div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12}}>
            <div><Label>Unidad</Label><Sel defaultValue={catM.unit}>{["pza","hoja","litro","kg","m","caja","par","rollo"].map(u=><option key={u}>{u}</option>)}</Sel></div>
            <div><Label>Costo est.</Label><Inp type="number" placeholder="$0.00"/></div>
            <div><Label>Stock mín.</Label><Inp type="number" defaultValue={5}/></div>
          </div>
        </div>
        <div style={{display:"flex",gap:10,justifyContent:"flex-end",marginTop:20}}><Btn onClick={()=>setCatM(null)}>Cancelar</Btn><Btn v="success" onClick={()=>{act(catM.id,"cataloged");setCatM(null)}}>✓ Crear y Vincular</Btn></div>
      </div>}
    </Modal>

    <Modal open={rejM} onClose={()=>setRejM(false)} title="Rechazar Requisición" w={440}>
      <p style={{fontSize:13,color:C.txM,marginBottom:12}}>Razón del rechazo:</p>
      <textarea value={rejR} onChange={e=>setRejR(e.target.value)} placeholder="ej: Proyecto cancelado..." rows={4} style={{width:"100%",padding:"10px 12px",borderRadius:8,border:`1px solid ${C.bd}`,fontSize:14,fontFamily:"inherit",resize:"vertical",boxSizing:"border-box"}}/>
      <div style={{display:"flex",gap:10,justifyContent:"flex-end",marginTop:16}}><Btn onClick={()=>setRejM(false)}>Cancelar</Btn><Btn v="danger" disabled={!rejR.trim()} onClick={()=>{alert("❌ Rechazada");setRejM(false);onBack()}}>Rechazar</Btn></div>
    </Modal>
  </div>
};

// ─── PAGE: DASHBOARD ───
const Dashboard=({go,items:ITEMS=[],categories:CATEGORIES=[],requisitions:REQUISITIONS=[],withdrawals:WITHDRAWALS=[]})=>{
  const low=ITEMS.filter(i=>i.currentStock<=i.minStock&&i.currentStock>0);
  const zero=ITEMS.filter(i=>i.currentStock===0);
  const pend=REQUISITIONS.filter(r=>r.status==="pending_approval");
  const activeW=WITHDRAWALS.filter(w=>["requested","ready","dispatched"].includes(w.status));
  const val=ITEMS.reduce((s,i)=>s+i.currentStock*i.unitCost,0);
  const kc=[{k:"pending_approval",l:"Pendiente",c:"#F59E0B"},{k:"approved",l:"Aprobada",c:"#3B82F6"},{k:"in_progress",l:"En proceso",c:"#8B5CF6"},{k:"completed",l:"Completada",c:"#22C55E"}];
  return <div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:16,marginBottom:24}}>
      <StatCard icon="📦" label="Items en Catálogo" value={ITEMS.length} sub={`${zero.length} sin stock`}/>
      <StatCard icon="⚠️" label="Stock Bajo" value={low.length} sub="por debajo del mínimo" color={C.err}/>
      <StatCard icon="📋" label="Reqs. Pendientes" value={pend.length} sub="esperando aprobación" color={C.warn}/>
      <StatCard icon="💰" label="Valor Inventario" value={fmt(val)} sub={`${activeW.length} vales activos`} color={C.ok}/>
    </div>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20,marginBottom:24}}>
      <Card>
        <div style={{display:"flex",justifyContent:"space-between",marginBottom:16}}><h3 style={{fontSize:15,fontWeight:700,margin:0}}>Actividad Reciente</h3></div>
        {ACTIVITY.map((a,i)=><div key={a.id} style={{padding:"10px 0",borderBottom:i<ACTIVITY.length-1?`1px solid ${C.bd}`:"none",display:"flex",justifyContent:"space-between",alignItems:"center"}}><div style={{display:"flex",alignItems:"center",gap:10}}><div style={{width:8,height:8,borderRadius:"50%",flexShrink:0,background:a.type==="alert"?C.err:a.type==="inv"?C.info:a.type==="ok"?C.ok:a.type==="del"?C.pur:C.ac}}/><span style={{fontSize:13}}>{a.text}</span></div><span style={{fontSize:11,color:C.txL,whiteSpace:"nowrap",marginLeft:12}}>{a.time}</span></div>)}
      </Card>
      <Card>
        <div style={{display:"flex",justifyContent:"space-between",marginBottom:16}}><h3 style={{fontSize:15,fontWeight:700,margin:0}}>Requisiciones</h3><Btn v="ghost" size="sm" onClick={()=>go("requisitions")}>Ver tablero</Btn></div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10}}>
          {kc.map(col=>{const it=REQUISITIONS.filter(r=>r.status===col.k);return <div key={col.k} style={{background:"#FAFAF9",borderRadius:10,padding:12}}><div style={{display:"flex",alignItems:"center",gap:6,marginBottom:10}}><div style={{width:8,height:8,borderRadius:"50%",background:col.c}}/><span style={{fontSize:12,fontWeight:600,color:C.txM}}>{col.l}</span><span style={{fontSize:11,background:C.card,padding:"1px 6px",borderRadius:99,color:C.txM,marginLeft:"auto"}}>{it.length}</span></div>{it.slice(0,3).map(r=><div key={r.id} style={{background:C.card,borderRadius:8,padding:"8px 10px",marginBottom:6,border:`1px solid ${C.bd}`,fontSize:12}}><div style={{fontWeight:600,marginBottom:2}}>{r.number}</div><div style={{color:C.txM,fontSize:11}}>{r.title}</div></div>)}</div>})}
        </div>
      </Card>
    </div>
    <Card>
      <div style={{display:"flex",justifyContent:"space-between",marginBottom:16}}><h3 style={{fontSize:15,fontWeight:700,margin:0}}>Stock Bajo</h3></div>
      <Tbl cols={[{k:"sku",l:"SKU",nw:1,r:v=><span style={{fontFamily:"monospace",fontSize:12,color:C.ac}}>{v}</span>},{k:"name",l:"Item",r:v=><span style={{fontWeight:600}}>{v}</span>},{k:"category",l:"Categoría",r:v=><Badge>{v}</Badge>},{k:"currentStock",l:"Stock",r:(v,r)=><span style={{fontWeight:700,color:v<=r.minStock?C.err:C.tx}}>{v} {r.unit}</span>},{k:"minStock",l:"Mínimo",r:(v,r)=>`${v} ${r.unit}`}]} data={low}/>
    </Card>
  </div>
};

// ─── PAGE: INVENTORY ───
const Inventory=({items:ITEMS=[],categories:CATEGORIES=[],suppliers:SUPPLIERS=[],refetch})=>{
  const[s,setS]=useState("");const[cat,setCat]=useState("all");const[modal,setModal]=useState(false);const[bulkModal,setBulkModal]=useState(false);const[pg,setPg]=useState(0);const PG=30;
  const cats=[...new Set(ITEMS.map(i=>i.category))];
  const f=ITEMS.filter(i=>{const ms=!s||i.name.toLowerCase().includes(s.toLowerCase())||i.sku.toLowerCase().includes(s.toLowerCase())||i.supplier.toLowerCase().includes(s.toLowerCase());return ms&&(cat==="all"||i.category===cat)});
  const totalPg=Math.ceil(f.length/PG);const paged=f.slice(pg*PG,(pg+1)*PG);
  const lowStock=ITEMS.filter(i=>i.currentStock<=i.minStock).length;
  const zeroStock=ITEMS.filter(i=>i.currentStock===0).length;
  return <div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:14,marginBottom:20}}>
      <StatCard icon="📦" label="Total Artículos" value={ITEMS.length} color={C.ac}/>
      <StatCard icon="📂" label="Categorías" value={cats.length} color={C.info}/>
      <StatCard icon="⚠️" label="Stock Bajo" value={lowStock} color={C.warn}/>
      <StatCard icon="🔴" label="Sin Stock" value={zeroStock} color={C.err}/>
    </div>
    <div style={{display:"flex",justifyContent:"space-between",marginBottom:16}}><div style={{display:"flex",gap:12,flex:1}}><Search value={s} onChange={v=>{setS(v);setPg(0)}} placeholder="Buscar nombre, SKU o proveedor..."/><Sel value={cat} onChange={e=>{setCat(e.target.value);setPg(0)}} style={{width:200}}><option value="all">Todas las categorías</option>{cats.map(c=><option key={c} value={c}>{c} ({ITEMS.filter(i=>i.category===c).length})</option>)}</Sel></div><div style={{display:"flex",gap:8}}><Btn onClick={()=>setBulkModal(true)}>📤 Carga Masiva</Btn><Btn v="primary" onClick={()=>setModal(true)}>+ Nuevo Item</Btn></div></div>
    <div style={{fontSize:12,color:C.txM,marginBottom:8}}>{f.length} artículo{f.length!==1?"s":""} encontrado{f.length!==1?"s":""}</div>
    <Tbl cols={[{k:"sku",l:"SKU",nw:1,r:v=> <span style={{fontFamily:"monospace",fontSize:11,color:C.ac}}>{v}</span>},{k:"name",l:"Artículo",r:(v,r)=> <div><div style={{fontWeight:600,fontSize:13}}>{v}</div><div style={{fontSize:11,color:C.txL}}>{r.subcategory}</div></div>},{k:"category",l:"Categoría",r:v=> <Badge>{v}</Badge>},{k:"supplier",l:"Proveedor",r:v=> <span style={{fontSize:12}}>{v}</span>},{k:"currentStock",l:"Stock",r:(v,r)=> <div style={{display:"flex",alignItems:"center",gap:8}}><div style={{width:50,height:6,borderRadius:3,background:C.bd,overflow:"hidden"}}><div style={{width:`${Math.min(100,(v/Math.max(r.minStock*3,1))*100)}%`,height:"100%",borderRadius:3,background:v<=r.minStock?v===0?C.err:C.warn:C.ok}}/></div><span style={{fontWeight:600,color:v===0?C.err:v<=r.minStock?C.warn:C.tx}}>{v}</span><span style={{color:C.txM,fontSize:11}}>{r.unit}</span></div>},{k:"minStock",l:"Mín",nw:1,r:v=> <span style={{fontSize:12,color:C.txM}}>{v}</span>},{k:"unitCost",l:"Costo",nw:1,r:v=> <span style={{fontFamily:"monospace",fontSize:12}}>{fmt(v)}</span>},{k:"_",l:"Estado",r:(_,r)=>r.currentStock===0? <Badge v="danger">Sin stock</Badge>:r.currentStock<=r.minStock? <Badge v="warning">Bajo</Badge>: <Badge v="success">OK</Badge>}]} data={paged}/>
    {totalPg>1&&<div style={{display:"flex",justifyContent:"center",alignItems:"center",gap:8,marginTop:16}}><Btn size="sm" disabled={pg===0} onClick={()=>setPg(pg-1)}>← Anterior</Btn><span style={{fontSize:13,color:C.txM}}>Página {pg+1} de {totalPg}</span><Btn size="sm" disabled={pg>=totalPg-1} onClick={()=>setPg(pg+1)}>Siguiente →</Btn></div>}
    <Modal open={modal} onClose={()=>setModal(false)} title="Nuevo Item" w={480}>
      {["SKU","Nombre","Descripción"].map(l=> <div key={l} style={{marginBottom:14}}><Label>{l}</Label><Inp/></div>)}
      <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}><Btn onClick={()=>setModal(false)}>Cancelar</Btn><Btn v="primary" onClick={()=>setModal(false)}>Guardar</Btn></div>
    </Modal>
    <BulkUploadModal open={bulkModal} onClose={()=>setBulkModal(false)} onDone={refetch} categories={CATEGORIES} suppliers={SUPPLIERS}/>
  </div>
};

// ─── PAGE: INVOICES ───
const InvReview=({inv,onBack})=><div>
  <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:20}}><Btn onClick={onBack}>← Volver</Btn><h2 style={{margin:0,fontSize:18,fontWeight:700}}>Revision Factura</h2><SBadge s={inv.status}/></div>
  <Card style={{marginBottom:20}}><div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:14}}>{[["Proveedor",inv.supplier],["# Factura",inv.invoiceNum||"—"],["Fecha",inv.date],["Total",inv.total?fmt(inv.total):"—"],["AI",inv.confidence?Math.round(inv.confidence*100)+"%":"—"],["Items",EXTRACTED_ITEMS.length+" lineas"]].map(([l,v])=><div key={l}><div style={{fontSize:11,color:C.txL,marginBottom:2}}>{l}</div><div style={{fontSize:14,fontWeight:600}}>{v}</div></div>)}</div></Card>
  <Card>
    <h3 style={{fontSize:15,fontWeight:700,margin:"0 0 16px"}}>Items Extraidos</h3>
    <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}><thead><tr style={{background:"#FAFAF9"}}>{["#","AI","Match","Cant.","Precio","Total",""].map(h=><th key={h} style={{padding:"10px 12px",textAlign:"left",fontWeight:600,color:C.txM,borderBottom:`2px solid ${C.bd}`,fontSize:11,textTransform:"uppercase"}}>{h}</th>)}</tr></thead><tbody>
      {EXTRACTED_ITEMS.map((it,i)=><tr key={it.id} style={{borderBottom:`1px solid ${C.bd}`}}><td style={{padding:12,color:C.txM}}>{i+1}</td><td style={{padding:12,fontStyle:"italic",color:C.txM}}>{it.rawDesc}</td><td style={{padding:12}}>{it.st==="matched"?<span style={{color:C.ok}}>{"✅ "+it.match+" "+Math.round(it.conf*100)+"%"}</span>:it.st==="review"?<span style={{color:C.warn}}>{"⚠️ "+it.match}</span>:<Badge v="accent">+ Nuevo</Badge>}</td><td style={{padding:12}}>{it.qty} {it.unit}</td><td style={{padding:12,fontFamily:"monospace"}}>{fmt(it.price)}</td><td style={{padding:12,fontWeight:700,fontFamily:"monospace"}}>{fmt(it.total)}</td><td style={{padding:12}}><div style={{display:"flex",gap:4}}><button style={{width:28,height:28,borderRadius:6,border:"none",background:C.okBg,color:C.ok,cursor:"pointer"}}>✓</button><button style={{width:28,height:28,borderRadius:6,border:"none",background:C.errBg,color:C.err,cursor:"pointer"}}>×</button></div></td></tr>)}
    </tbody></table>
    <div style={{display:"flex",gap:10,marginTop:16}}><Btn v="success" onClick={onBack}>✓ Confirmar</Btn><Btn v="danger" onClick={onBack}>✕ Rechazar</Btn></div>
  </Card>
</div>;

const Invoices=()=>{const[sel,setSel]=useState(null);if(sel)return <InvReview inv={sel} onBack={()=>setSel(null)}/>;return <div>
  <div style={{display:"flex",justifyContent:"space-between",marginBottom:20}}><Search placeholder="Buscar factura..." value="" onChange={()=>{}}/><Btn v="primary">📤 Subir Factura</Btn></div>
  <Tbl cols={[{k:"date",l:"Fecha",nw:1},{k:"supplier",l:"Proveedor",r:v=><span style={{fontWeight:600}}>{v}</span>},{k:"invoiceNum",l:"# Factura",r:v=>v?<span style={{fontFamily:"monospace",fontSize:12}}>{v}</span>:<span style={{color:C.txL}}>—</span>},{k:"numItems",l:"Items"},{k:"total",l:"Total",nw:1,r:v=>v?<span style={{fontWeight:600}}>{fmt(v)}</span>:"—"},{k:"confidence",l:"AI",r:v=>v!=null?<div style={{display:"flex",alignItems:"center",gap:6}}><div style={{width:40,height:5,borderRadius:3,background:C.bd,overflow:"hidden"}}><div style={{width:`${v*100}%`,height:"100%",borderRadius:3,background:v>=.9?C.ok:C.warn}}/></div><span style={{fontSize:12,color:C.txM}}>{Math.round(v*100)}%</span></div>:"—"},{k:"status",l:"Estado",r:v=><SBadge s={v}/>},{k:"_",l:"",r:(_,r)=>r.status==="awaiting_review"?<Btn v="primary" size="sm" onClick={e=>{e.stopPropagation();setSel(r)}}>Revisar</Btn>:null}]} data={INVOICES} onRow={r=>r.status==="awaiting_review"&&setSel(r)}/>
</div>};

// ─── PAGE: REQUISITIONS (KANBAN) ───
const Reqs=({items:ITEMS=[],categories:CATEGORIES=[],requisitions:REQUISITIONS=[]})=>{
  const[det,setDet]=useState(null);const[newR,setNewR]=useState(false);
  if(newR)return <NewReqPage onBack={()=>setNewR(false)} items={ITEMS} categories={CATEGORIES}/>;
  if(det)return <ReqDetailPage req={det} onBack={()=>setDet(null)} items={ITEMS} categories={CATEGORIES}/>;
  const cols=[{k:"pending_approval",l:"Pendiente Aprobación",c:"#F59E0B",bg:"#FFFBEB"},{k:"approved",l:"Aprobada",c:"#3B82F6",bg:"#EFF6FF"},{k:"in_progress",l:"En Proceso",c:"#8B5CF6",bg:"#F5F3FF"},{k:"completed",l:"Completada",c:"#22C55E",bg:"#F0FDF4"}];
  return <div>
    <div style={{display:"flex",justifyContent:"space-between",marginBottom:20}}><Search placeholder="Buscar requisición..." value="" onChange={()=>{}}/><Btn v="primary" onClick={()=>setNewR(true)}>+ Nueva Requisición</Btn></div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:16,alignItems:"start"}}>
      {cols.map(col=>{const rs=REQUISITIONS.filter(r=>r.status===col.k);return <div key={col.k} style={{background:col.bg,borderRadius:14,padding:14,minHeight:400}}>
        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:14,paddingBottom:10,borderBottom:`2px solid ${col.c}30`}}><div style={{width:10,height:10,borderRadius:"50%",background:col.c}}/><span style={{fontSize:13,fontWeight:700}}>{col.l}</span><span style={{fontSize:12,background:`${col.c}20`,color:col.c,padding:"2px 8px",borderRadius:99,fontWeight:700,marginLeft:"auto"}}>{rs.length}</span></div>
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          {rs.map(r=>{const fc=r.items.filter(i=>i.type==="free_text").length;return <div key={r.id} onClick={()=>setDet(r)} style={{background:C.card,borderRadius:10,padding:14,border:`1px solid ${C.bd}`,cursor:"pointer",transition:"box-shadow .15s,transform .15s"}} onMouseEnter={e=>{e.currentTarget.style.boxShadow="0 4px 12px rgba(0,0,0,.08)";e.currentTarget.style.transform="translateY(-1px)"}} onMouseLeave={e=>{e.currentTarget.style.boxShadow="none";e.currentTarget.style.transform="none"}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}><span style={{fontSize:11,fontFamily:"monospace",color:C.ac,fontWeight:600}}>{r.number}</span><PBadge p={r.priority}/></div>
            <div style={{fontSize:13,fontWeight:600,marginBottom:4}}>{r.title}</div>
            <div style={{fontSize:12,color:C.txM,marginBottom:8}}>{r.project}</div>
            {fc>0&&<div style={{background:C.warnBg,borderRadius:6,padding:"4px 8px",marginBottom:8,fontSize:11,color:C.warn,fontWeight:600,display:"inline-block"}}>✏️ {fc} no catalogado{fc>1?"s":""}</div>}
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",paddingTop:8,borderTop:`1px solid ${C.bd}`}}>
              <div style={{display:"flex",alignItems:"center",gap:6}}><div style={{width:22,height:22,borderRadius:"50%",background:`${C.ac}20`,color:C.ac,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:700}}>{r.requester[0]}</div><span style={{fontSize:11,color:C.txM}}>{r.requester.split(" ")[0]}</span></div>
              <div style={{display:"flex",gap:10,fontSize:11,color:C.txM}}><span>{r.items.length} items</span><span style={{fontWeight:600}}>{fmt(r.estimatedCost)}</span></div>
            </div>
          </div>})}
        </div>
      </div>})}
    </div>
  </div>
};

// ─── PAGE: SUPPLIERS ───
const Suppl=({items:ITEMS=[],suppliers:SUPPLIERS=[]})=>{const[s,setS]=useState("");const f=SUPPLIERS.filter(x=>!s||x.company.toLowerCase().includes(s.toLowerCase()));return <div>
  <div style={{display:"flex",justifyContent:"space-between",marginBottom:20}}><Search value={s} onChange={setS} placeholder="Buscar proveedor..."/><Btn v="primary">+ Nuevo Proveedor</Btn></div>
  <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(320px,1fr))",gap:16}}>
    {f.map(sup=>{const itemCount=ITEMS.filter(i=>i.supplier===sup.company).length;const cats=[...new Set(ITEMS.filter(i=>i.supplier===sup.company).map(i=>i.category))];return <Card key={sup.id} style={{transition:"all .15s",cursor:"pointer"}} onMouseEnter={e=>{e.currentTarget.style.boxShadow="0 4px 16px rgba(0,0,0,.08)";e.currentTarget.style.transform="translateY(-2px)"}} onMouseLeave={e=>{e.currentTarget.style.boxShadow="none";e.currentTarget.style.transform="none"}}>
      <div style={{display:"flex",justifyContent:"space-between",marginBottom:12}}><div style={{fontSize:16,fontWeight:700}}>{sup.company}</div>{sup.active? <Badge v="success">Activo</Badge>: <Badge>Inactivo</Badge>}</div>
      <div style={{display:"flex",gap:8,marginBottom:12,flexWrap:"wrap"}}>{cats.map(c=> <Badge key={c} v="accent">{c}</Badge>)}</div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,fontSize:12}}>
        <div><span style={{color:C.txL}}>Artículos:</span><br/><span style={{fontWeight:600,fontSize:16}}>{itemCount}</span></div>
        <div><span style={{color:C.txL}}>Contacto:</span><br/>{sup.contact||<span style={{color:C.txL,fontStyle:"italic"}}>Sin registrar</span>}</div>
        <div><span style={{color:C.txL}}>Teléfono:</span><br/>{sup.phone||<span style={{color:C.txL,fontStyle:"italic"}}>—</span>}</div>
        <div><span style={{color:C.txL}}>Condiciones:</span><br/>{sup.payment||<span style={{color:C.txL,fontStyle:"italic"}}>—</span>}</div>
      </div>
    </Card>})}
  </div>
</div>};

// ─── PAGE: POs ───
const POPage=()=><div>
  <div style={{display:"flex",justifyContent:"space-between",marginBottom:20}}><Search placeholder="Buscar orden..." value="" onChange={()=>{}}/><Btn v="primary">+ Nueva Orden</Btn></div>
  <Tbl cols={[{k:"number",l:"# Orden",nw:1,r:v=><span style={{fontFamily:"monospace",fontSize:12,fontWeight:600,color:C.ac}}>{v}</span>},{k:"supplier",l:"Proveedor",r:v=><span style={{fontWeight:600}}>{v}</span>},{k:"date",l:"Fecha",nw:1},{k:"numItems",l:"Items",r:(v,r)=>`${r.received}/${v}`},{k:"total",l:"Total",nw:1,r:v=><span style={{fontWeight:600,fontFamily:"monospace"}}>{fmt(v)}</span>},{k:"status",l:"Entrega",r:v=><SBadge s={v}/>},{k:"payment",l:"Pago",r:v=><SBadge s={v}/>}]} data={POS}/></div>;

// ─── PAGE: WITHDRAWALS (VALES DE SALIDA) ───
const WBadge=({s})=>{const m={requested:["Solicitado","warning",true],ready:["Listo p/ entrega","info",false],dispatched:["Entregado","purple",false],received:["Confirmado","success",false],partial:["Parcial","accent",false],self_service:["Auto-servicio","default",false],rejected:["Rechazado","danger",false]};const[l,v,p]=m[s]||[s,"default",false];return <Badge v={v} pulse={p}>{l}</Badge>};

const WithdrawalDetail=({w,onBack})=>{
  const totalCost=w.items.reduce((s,i)=>(i.qtyDisp||i.qtyReq)*i.cost,0);
  const isPending=w.status==="requested",isReady=w.status==="ready",isDisp=w.status==="dispatched";
  const Bub=({from,text,time,bot,btns})=><div style={{display:"flex",justifyContent:bot?"flex-start":"flex-end",marginBottom:8}}><div style={{maxWidth:"85%",background:bot?"#F0F0F0":"#DCF8C6",borderRadius:bot?"4px 16px 16px 16px":"16px 4px 16px 16px",padding:"10px 14px"}}>{bot&&<div style={{fontSize:11,fontWeight:700,color:C.info,marginBottom:4}}>🤖 ERP Bot</div>}<div style={{fontSize:13,lineHeight:1.5,whiteSpace:"pre-wrap"}}>{text}</div>{btns&&<div style={{display:"flex",gap:6,marginTop:8,flexWrap:"wrap"}}>{btns.map((b,i)=><span key={i} style={{padding:"6px 12px",borderRadius:8,background:bot?"#E3E3E3":"#C5EBA0",fontSize:12,fontWeight:600}}>{b}</span>)}</div>}<div style={{fontSize:10,color:"#999",marginTop:4,textAlign:"right"}}>{time}{!bot&&" ✓✓"}</div></div></div>;
  const chatMsgs=()=>{
    const its=w.items.map(i=>`${i.qtyReq} ${i.unit} — ${i.name}`).join(", ");
    if(w.status==="requested")return <><Bub from="user" text={`Necesito ${its} para ${w.project}`} time={w.requestedAt}/><Bub bot text={`📤 Vale ${w.number} creado\n${w.items.map(i=>"• "+i.qtyReq+" × "+i.name).join("\n")}\nProyecto: ${w.project}\n${w.items.some(i=>i.stock<i.qtyReq)?"⚠️ Stock insuficiente":"✅ Stock disponible"}\nNotificando almacén...`} time={w.requestedAt}/><div style={{alignSelf:"center",background:"#FCF4CF",borderRadius:8,padding:"4px 12px",margin:"8px 0",fontSize:11,color:"#8B7F3F"}}>↓ Chat almacenista ↓</div><Bub bot text={`📦 Nueva solicitud ${w.number}\n${w.requestedBy} necesita:\n${w.items.map(i=>"• "+i.qtyReq+" "+i.unit+" — "+i.name+"\n  📍 "+i.loc+" | Stock: "+i.stock).join("\n")}\nProyecto: ${w.project}`} time={w.requestedAt} btns={["✅ Surtir","📦 Parcial","❌ Rechazar"]}/></>;
    if(w.status==="ready")return <><Bub text={`Necesito material para ${w.project}`} time={w.requestedAt}/><Bub bot text={`📤 Vale ${w.number} creado`} time={w.requestedAt}/><Bub bot text={`📦 Material listo — Don Beto surtió:\n${w.items.map(i=>(i.qtyDisp<i.qtyReq?"⚠️":"✅")+" "+i.qtyDisp+"/"+i.qtyReq+" "+i.unit+" — "+i.name).join("\n")}\nPasa a recoger.`} time="07:52"/></>;
    if(w.status==="dispatched")return <><Bub text={`Necesito material para ${w.project}`} time={w.requestedAt}/><Bub bot text={`✅ Don Beto surtió completo.`} time={w.dispatchedAt}/><Bub bot text={`🤝 Te entregaron:\n${w.items.map(i=>"• "+i.qtyDisp+" "+i.unit+" — "+i.name).join("\n")}\n\n¿Recibiste completo?`} time={w.dispatchedAt} btns={["✅ Sí","⚠️ Recibí menos","❌ No"]}/></>;
    if(w.status==="self_service")return <><Bub text={`Saqué ${w.items[0].qtyReq} ${w.items[0].unit} de ${w.items[0].name}. ${w.project}. Almacenista ausente.`} time={w.requestedAt}/><Bub bot text={`🔓 Vale auto-servicio ${w.number}\n${w.items[0].qtyReq} × ${w.items[0].name}\n📊 Stock descontado.\n🏷️ Sin verificación de almacén.`} time={w.requestedAt}/></>;
    return <><Bub text={`Necesito material para ${w.project}`} time={w.requestedAt}/><Bub bot text={w.status==="partial"?`⚠️ Surtido parcial: ${w.items[0].qtyDisp}/${w.items[0].qtyReq}`:"✅ Surtido completo."} time={w.dispatchedAt}/><Bub bot text="🤝 ¿Confirmas recepción?" time={w.dispatchedAt} btns={["✅ Sí"]}/><Bub text="✅ Sí, recibido" time={w.receivedAt}/><Bub bot text={`✅ ${w.number} cerrado. Stock actualizado.${w.status==="partial"?"\n📋 Requisición auto-generada.":""}`} time={w.receivedAt}/></>;
  };
  return <div>
    <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:24}}><Btn onClick={onBack}>← Volver</Btn><h2 style={{margin:0,fontSize:18,fontWeight:700}}>{w.number}</h2><WBadge s={w.status}/><span style={{fontSize:12,color:C.txM,marginLeft:4}}>{w.channel==="telegram"?"📱 Telegram":"💬 WhatsApp"}</span></div>
    <div style={{display:"grid",gridTemplateColumns:"1fr 380px",gap:20}}>
      <div>
        <Card style={{marginBottom:20}}><div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:16}}>{[["Solicitante",w.requestedBy],["Proyecto",w.project],["Solicitado",w.requestedAt],["Despachó",w.dispatchedBy||"Pendiente"]].map(([l,v])=><div key={l}><div style={{fontSize:11,color:C.txL,marginBottom:2}}>{l}</div><div style={{fontSize:14,fontWeight:600}}>{v}</div></div>)}</div>{w.notes&&<div style={{marginTop:12,padding:"8px 12px",background:"#FFFBEB",borderRadius:8,fontSize:13,color:C.warn}}>💬 {w.notes}</div>}</Card>
        <Card style={{marginBottom:20}}>
          <h3 style={{fontSize:14,fontWeight:700,margin:"0 0 16px",color:C.txM,textTransform:"uppercase",letterSpacing:.5}}>Materiales</h3>
          {w.items.map((item,idx)=><div key={item.id} style={{padding:"14px 0",borderBottom:idx<w.items.length-1?`1px solid ${C.bd}`:"none",display:"flex",alignItems:"center",gap:14}}>
            <div style={{width:40,height:40,borderRadius:10,background:"#F5F0EB",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}}>📦</div>
            <div style={{flex:1}}><div style={{fontWeight:600,fontSize:14,marginBottom:4}}>{item.name}</div><div style={{display:"flex",gap:16,fontSize:12,color:C.txM}}><span>📍 {item.loc}</span><span>Stock: {item.stock} {item.unit}</span><span>{fmt(item.cost)}/{item.unit}</span></div></div>
            <div style={{textAlign:"right"}}><div style={{display:"flex",alignItems:"center",gap:8}}><div style={{textAlign:"center"}}><div style={{fontSize:11,color:C.txL}}>Pedido</div><div style={{fontSize:18,fontWeight:700}}>{item.qtyReq}</div></div><span style={{color:C.txL}}>→</span><div style={{textAlign:"center"}}><div style={{fontSize:11,color:C.txL}}>Surtido</div><div style={{fontSize:18,fontWeight:700,color:item.qtyDisp!=null?(item.qtyDisp<item.qtyReq?C.warn:C.ok):C.txL}}>{item.qtyDisp!=null?item.qtyDisp:"—"}</div></div></div><div style={{fontSize:12,color:C.txM,marginTop:4}}>{item.unit} · ~{fmt((item.qtyDisp||item.qtyReq)*item.cost)}</div></div>
          </div>)}
          <div style={{marginTop:12,paddingTop:12,borderTop:`2px solid ${C.bd}`,display:"flex",justifyContent:"space-between"}}><span style={{fontWeight:700}}>Costo total estimado</span><span style={{fontWeight:700,fontFamily:"monospace",fontSize:16}}>{fmt(totalCost)}</span></div>
        </Card>
        <Card><h3 style={{fontSize:14,fontWeight:700,margin:"0 0 16px",color:C.txM,textTransform:"uppercase",letterSpacing:.5}}>Bitácora</h3>
          <div style={{position:"relative",paddingLeft:32}}><div style={{position:"absolute",left:11,top:8,bottom:8,width:2,background:C.bd}}/>
            {w.timeline.map((ev,i)=>{const tc={request:C.ac,dispatch:C.ok,handoff:C.pur,confirm:C.ok,waiting:C.warn,alert:C.err,partial:C.warn,system:C.info,self:C.warn,flag:"#F97316"};return <div key={i} style={{position:"relative",paddingBottom:i<w.timeline.length-1?20:0}}><div style={{position:"absolute",left:-25,width:24,height:24,borderRadius:"50%",background:C.card,border:`2px solid ${tc[ev.type]||C.bd}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12}}>{ev.icon}</div><div style={{paddingLeft:12}}><div style={{display:"flex",alignItems:"center",gap:8,marginBottom:2}}><span style={{fontSize:13,fontWeight:600}}>{ev.who}</span><span style={{fontSize:11,color:C.txL}}>{ev.t}</span></div><div style={{fontSize:13,color:C.txM,lineHeight:1.5}}>{ev.text}</div></div></div>})}
          </div>
        </Card>
      </div>
      <div>
        {(isPending||isReady||isDisp)&&<Card style={{marginBottom:20}}>
          <h3 style={{fontSize:14,fontWeight:700,margin:"0 0 16px",color:C.txM,textTransform:"uppercase",letterSpacing:.5}}>{isPending?"Acción Almacenista":isReady?"Pendiente Entrega":"Esperando Confirmación"}</h3>
          {isPending&&<div>
            <div style={{background:C.warnBg,borderRadius:8,padding:12,marginBottom:16,fontSize:13,color:C.warn}}>⏳ <strong>{w.requestedBy}</strong> espera este material.</div>
            {w.items.map(it=><div key={it.id} style={{marginBottom:12}}><div style={{fontSize:13,fontWeight:600,marginBottom:4}}>{it.name}</div><div style={{fontSize:12,color:C.txM}}>Pedido: {it.qtyReq} {it.unit} · <span style={{color:it.stock>=it.qtyReq?C.ok:C.err}}>Stock: {it.stock}</span></div>{it.stock<it.qtyReq&&<div style={{fontSize:12,color:C.err,marginTop:4}}>⚠️ Insuficiente. Max: {it.stock}</div>}<div style={{marginTop:6}}><Label>Despachar</Label><Inp type="number" defaultValue={Math.min(it.qtyReq,it.stock)} style={{width:100}}/></div></div>)}
            <div style={{display:"flex",flexDirection:"column",gap:8,marginTop:16}}><Btn v="success" size="lg" onClick={()=>alert("✅ Surtido")} style={{width:"100%",justifyContent:"center"}}>✅ Surtir</Btn><Btn v="danger" size="lg" onClick={()=>alert("❌ Rechazado")} style={{width:"100%",justifyContent:"center"}}>❌ Rechazar</Btn></div>
          </div>}
          {isReady&&<div><div style={{background:C.infoBg,borderRadius:8,padding:12,marginBottom:16,fontSize:13,color:C.info}}>📦 Listo. Entrega a <strong>{w.requestedBy}</strong>.</div><Btn v="primary" size="lg" onClick={()=>alert("🤝 Entregado")} style={{width:"100%",justifyContent:"center"}}>🤝 Marcar Entregado</Btn></div>}
          {isDisp&&<div><div style={{background:C.purBg,borderRadius:8,padding:12,marginBottom:16,fontSize:13,color:C.pur}}>⏳ Esperando confirmación de <strong>{w.requestedBy}</strong>. Auto-confirma en 2h.</div><Btn v="ghost" size="lg" onClick={()=>alert("📩 Recordatorio enviado")} style={{width:"100%",justifyContent:"center"}}>📩 Recordatorio</Btn></div>}
        </Card>}
        <Card style={{padding:0,overflow:"hidden"}}>
          <div style={{background:"#075E54",padding:"12px 16px",display:"flex",alignItems:"center",gap:10}}><div style={{width:32,height:32,borderRadius:"50%",background:"#128C7E",display:"flex",alignItems:"center",justifyContent:"center",color:"white",fontSize:14}}>🤖</div><div><div style={{fontSize:14,fontWeight:600,color:"white"}}>ERP Carpintería Bot</div><div style={{fontSize:11,color:"#D1D5DB"}}>Telegram</div></div></div>
          <div style={{background:"#ECE5DD",padding:16,minHeight:260,display:"flex",flexDirection:"column"}}>{chatMsgs()}</div>
        </Card>
      </div>
    </div>
  </div>
};

const Withdrawals=({withdrawals:WITHDRAWALS=[]})=>{
  const[det,setDet]=useState(null);
  if(det)return <WithdrawalDetail w={det} onBack={()=>setDet(null)}/>;
  const active=WITHDRAWALS.filter(w=>["requested","ready","dispatched"].includes(w.status));
  const history=WITHDRAWALS.filter(w=>!["requested","ready","dispatched"].includes(w.status));
  const pendC=WITHDRAWALS.filter(w=>w.status==="requested").length;
  const todayC=WITHDRAWALS.filter(w=>w.requestedAt&&!w.requestedAt.startsWith("Ayer")).length;
  const selfC=WITHDRAWALS.filter(w=>w.status==="self_service").length;
  const totalD=history.reduce((s,w)=>s+w.items.reduce((a,i)=>(i.qtyDisp||0)*i.cost,0),0);
  return <div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",gap:16,marginBottom:24}}>
      <StatCard icon="⏳" label="Esperando Despacho" value={pendC} sub="requieren atención" color={C.warn}/>
      <StatCard icon="📤" label="Vales Hoy" value={todayC} sub="solicitudes del día" color={C.info}/>
      <StatCard icon="🔓" label="Auto-servicio" value={selfC} sub="sin verificar" color={selfC>0?"#F97316":C.ok}/>
      <StatCard icon="💰" label="Salidas del Día" value={fmt(totalD)} sub="costo material" color={C.ac}/>
    </div>
    {active.length>0&&<div style={{marginBottom:24}}>
      <h3 style={{fontSize:15,fontWeight:700,margin:"0 0 14px"}}>🔴 Requieren Atención ({active.length})</h3>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(340px,1fr))",gap:14}}>
        {active.map(w=><Card key={w.id} onClick={()=>setDet(w)} style={{cursor:"pointer",borderLeft:`4px solid ${w.status==="requested"?C.warn:w.status==="ready"?C.info:C.pur}`,transition:"all .15s"}} onMouseEnter={e=>{e.currentTarget.style.boxShadow="0 4px 16px rgba(0,0,0,.1)";e.currentTarget.style.transform="translateY(-2px)"}} onMouseLeave={e=>{e.currentTarget.style.boxShadow="none";e.currentTarget.style.transform="none"}}>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:10}}><div><span style={{fontFamily:"monospace",fontSize:12,color:C.ac,fontWeight:600}}>{w.number}</span><span style={{fontSize:11,color:C.txL,marginLeft:8}}>{w.requestedAt}</span></div><WBadge s={w.status}/></div>
          <div style={{fontSize:14,fontWeight:600,marginBottom:4}}>{w.requestedBy} → {w.project}</div>
          <div style={{fontSize:12,color:C.txM,marginBottom:10}}>{w.items.map(i=>`${i.qtyReq} ${i.unit} ${i.name.split("(")[0].trim()}`).join(", ")}</div>
          {w.status==="requested"&&<div style={{display:"flex",gap:6}}><Btn v="success" size="sm" onClick={e=>{e.stopPropagation();alert("✅ Surtido")}}>✅ Surtir</Btn><Btn size="sm" onClick={e=>{e.stopPropagation();alert("📦 Parcial")}}>📦 Parcial</Btn><Btn v="danger" size="sm" onClick={e=>{e.stopPropagation();alert("❌")}}>❌</Btn></div>}
          {w.status==="ready"&&<Btn v="primary" size="sm" onClick={e=>{e.stopPropagation();alert("🤝 Entregado")}}>🤝 Entregar</Btn>}
          {w.status==="dispatched"&&<div style={{fontSize:12,color:C.pur}}>⏳ Esperando confirmación de {w.requestedBy.split(" ")[0]}...</div>}
        </Card>)}
      </div>
    </div>}
    <h3 style={{fontSize:15,fontWeight:700,margin:"0 0 14px"}}>📋 Historial</h3>
    <Tbl cols={[
      {k:"number",l:"# Vale",nw:1,r:v=><span style={{fontFamily:"monospace",fontSize:12,fontWeight:600,color:C.ac}}>{v}</span>},
      {k:"requestedBy",l:"Solicitante",r:v=><span style={{fontWeight:600}}>{v}</span>},
      {k:"project",l:"Proyecto"},
      {k:"_it",l:"Material",r:(_,r)=><span style={{fontSize:12}}>{r.items.map(i=>`${i.qtyDisp||i.qtyReq} ${i.name.split(" ").slice(0,2).join(" ")}`).join(", ")}</span>},
      {k:"_co",l:"Costo",nw:1,r:(_,r)=><span style={{fontFamily:"monospace",fontWeight:600}}>{fmt(r.items.reduce((s,i)=>(i.qtyDisp||i.qtyReq)*i.cost,0))}</span>},
      {k:"channel",l:"Canal",r:v=>v==="telegram"?"📱":"💬"},
      {k:"status",l:"Estado",r:v=><WBadge s={v}/>},
    ]} data={history} onRow={r=>setDet(r)}/>
  </div>
};

// ─── PAGE: REPORTS ───
const Reports=({items:ITEMS=[]})=>{
  const cv=useMemo(()=>{const m={};ITEMS.forEach(i=>{m[i.category]=(m[i.category]||0)+i.currentStock*i.unitCost});return Object.entries(m).sort((a,b)=>b[1]-a[1])},[ITEMS]);
  const mx=Math.max(...cv.map(([,v])=>v));
  return <div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:16,marginBottom:24}}>
      {[{t:"Valor Total",v:fmt(ITEMS.reduce((s,i)=>s+i.currentStock*i.unitCost,0)),c:C.ok},{t:"Órdenes Activas",v:POS.filter(p=>p.status!=="received").length,c:C.info},{t:"Gasto del Mes",v:fmt(POS.reduce((s,p)=>s+p.total,0)),c:C.ac}].map((s,i)=><Card key={i}><div style={{fontSize:12,color:C.txM,marginBottom:4}}>{s.t}</div><div style={{fontSize:28,fontWeight:700,color:s.c}}>{s.v}</div></Card>)}
    </div>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20}}>
      <Card><h3 style={{fontSize:15,fontWeight:700,margin:"0 0 18px"}}>Valor por Categoría</h3>{cv.map(([c,v])=><div key={c} style={{marginBottom:12}}><div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}><span style={{fontSize:13,fontWeight:600}}>{c}</span><span style={{fontSize:13,fontFamily:"monospace",color:C.txM}}>{fmt(v)}</span></div><div style={{width:"100%",height:20,borderRadius:6,background:"#F5F0EB",overflow:"hidden"}}><div style={{width:`${(v/mx)*100}%`,height:"100%",borderRadius:6,background:`linear-gradient(90deg,${C.ac},#D97706)`}}/></div></div>)}</Card>
      <Card><h3 style={{fontSize:15,fontWeight:700,margin:"0 0 18px"}}>Consumo Mensual</h3><div style={{display:"flex",alignItems:"flex-end",gap:12,height:200,paddingTop:20}}>{[{m:"Sep",v:18500},{m:"Oct",v:22300},{m:"Nov",v:19800},{m:"Dic",v:15200},{m:"Ene",v:24100},{m:"Feb",v:21000}].map((d,i)=><div key={d.m} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:6}}><span style={{fontSize:11,color:C.txM,fontFamily:"monospace"}}>{fmt(d.v)}</span><div style={{width:"100%",maxWidth:48,height:`${(d.v/24100)*160}px`,borderRadius:"6px 6px 0 0",background:i===5?`linear-gradient(180deg,${C.ac},#D97706)`:"linear-gradient(180deg,#D6D3D1,#E7E5E4)"}}/><span style={{fontSize:12,fontWeight:i===5?700:500,color:i===5?C.ac:C.txM}}>{d.m}</span></div>)}</div></Card>
    </div>
  </div>
};

// ─── APP ───
const _I={dashboard:"M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z",inventory:"M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z",invoices:[<rect key="r" x="3" y="3" width="18" height="18" rx="2"/>,<path key="p1" d="M3 9h18"/>,<path key="p2" d="M9 21V9"/>],requisitions:[<path key="p1" d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2"/>,<rect key="r" x="8" y="2" width="8" height="4" rx="1"/>],withdrawals:[<path key="p1" d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>,<path key="p2" d="M7 10l5 5 5-5"/>,<line key="l" x1="12" y1="15" x2="12" y2="3"/>],"purchase-orders":[<circle key="c1" cx="9" cy="21" r="1"/>,<circle key="c2" cx="20" cy="21" r="1"/>,<path key="p" d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6"/>],suppliers:[<path key="p1" d="M3 21h18"/>,<path key="p2" d="M9 8h1"/>,<path key="p3" d="M9 12h1"/>,<path key="p4" d="M9 16h1"/>,<path key="p5" d="M5 21V5a2 2 0 012-2h10a2 2 0 012 2v16"/>],reports:[<line key="l1" x1="18" y1="20" x2="18" y2="10"/>,<line key="l2" x1="12" y1="20" x2="12" y2="4"/>,<line key="l3" x1="6" y1="20" x2="6" y2="14"/>]};
const NAV=[{k:"dashboard",l:"Dashboard"},{k:"inventory",l:"Inventario"},{k:"invoices",l:"Facturas"},{k:"requisitions",l:"Requisiciones"},{k:"withdrawals",l:"Vales de Salida"},{k:"purchase-orders",l:"Órdenes de Compra"},{k:"suppliers",l:"Proveedores"},{k:"reports",l:"Reportes"}];
const TITLES={dashboard:"Dashboard",inventory:"Inventario",invoices:"Facturas",requisitions:"Requisiciones",withdrawals:"Vales de Salida","purchase-orders":"Órdenes de Compra",suppliers:"Proveedores",reports:"Reportes"};

export default function App(){
  const[page,setPage]=useState("dashboard");
  const[sb,setSb]=useState(true);
  const{items,categories,suppliers,requisitions,withdrawals,loading,error,refetch}=useSupabaseData();
  const d={items,categories,suppliers,requisitions,withdrawals};
  const render=()=>{if(loading)return <Loader/>;if(error)return <Loader error={error} onRetry={refetch}/>;switch(page){case"dashboard":return <Dashboard go={setPage} {...d}/>;case"inventory":return <Inventory items={items} categories={categories} suppliers={suppliers} refetch={refetch}/>;case"invoices":return <Invoices/>;case"requisitions":return <Reqs items={items} categories={categories} requisitions={requisitions}/>;case"withdrawals":return <Withdrawals withdrawals={withdrawals}/>;case"purchase-orders":return <POPage/>;case"suppliers":return <Suppl items={items} suppliers={suppliers}/>;case"reports":return <Reports items={items}/>;default:return <Dashboard go={setPage} {...d}/>}};
  return <div style={{display:"flex",height:"100vh",fontFamily:"'DM Sans','Segoe UI',system-ui,sans-serif",background:C.bg,color:C.tx}}>
    <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap');*{box-sizing:border-box;margin:0;padding:0}::-webkit-scrollbar{width:6px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:#D6D3D1;border-radius:3px}@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}input:focus,select:focus,textarea:focus{outline:none;border-color:${C.ac}!important;box-shadow:0 0 0 3px ${C.ac}20}`}</style>

    <aside style={{width:sb?240:64,background:C.sb,display:"flex",flexDirection:"column",transition:"width .2s",flexShrink:0,overflow:"hidden"}}>
      <div style={{padding:sb?"20px 20px 16px":"20px 14px 16px",borderBottom:"1px solid #292524",display:"flex",alignItems:"center",gap:12,cursor:"pointer"}} onClick={()=>setSb(!sb)}>
        <div style={{width:36,height:36,borderRadius:10,background:"linear-gradient(135deg,#B45309,#D97706)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><Ic d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" size={18} style={{color:"#FFF"}}/></div>
        {sb&&<div><div style={{fontSize:15,fontWeight:700,color:C.txW,whiteSpace:"nowrap"}}>Carpintería ERP</div><div style={{fontSize:11,color:"#78716C",whiteSpace:"nowrap"}}>Sistema de Inventario</div></div>}
      </div>
      <nav style={{flex:1,padding:"12px 8px",display:"flex",flexDirection:"column",gap:2}}>
        {NAV.map(n=><button key={n.k} onClick={()=>setPage(n.k)} style={{display:"flex",alignItems:"center",gap:12,padding:sb?"10px 14px":"10px 0",justifyContent:sb?"flex-start":"center",borderRadius:8,border:"none",cursor:"pointer",fontFamily:"inherit",fontSize:13,fontWeight:page===n.k?600:500,color:page===n.k?C.txW:"#A8A29E",background:page===n.k?C.sbA:"transparent",transition:"all .15s",width:"100%",whiteSpace:"nowrap"}} onMouseEnter={e=>{if(page!==n.k)e.currentTarget.style.background=C.sbH}} onMouseLeave={e=>{if(page!==n.k)e.currentTarget.style.background="transparent"}}><span style={{flexShrink:0,display:"inline-flex"}}><Ic d={_I[n.k]} size={18}/></span>{sb&&n.l}</button>)}
      </nav>
      {sb&&<div style={{padding:"14px 16px",borderTop:"1px solid #292524",display:"flex",alignItems:"center",gap:10}}><div style={{width:32,height:32,borderRadius:8,background:"#44403C",display:"flex",alignItems:"center",justifyContent:"center",color:"#D6D3D1",fontSize:13,fontWeight:700}}>P</div><div><div style={{fontSize:13,fontWeight:600,color:C.txW}}>Pavel</div><div style={{fontSize:11,color:"#78716C"}}>Admin</div></div></div>}
    </aside>

    <main style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>
      <header style={{padding:"14px 28px",background:C.card,borderBottom:`1px solid ${C.bd}`,display:"flex",justifyContent:"space-between",alignItems:"center",flexShrink:0}}>
        <h1 style={{fontSize:20,fontWeight:700,margin:0}}>{TITLES[page]}</h1>
        <div style={{display:"flex",alignItems:"center",gap:12}}><div style={{position:"relative",cursor:"pointer"}}><span style={{fontSize:18}}>🔔</span><span style={{position:"absolute",top:-6,right:-6,width:16,height:16,borderRadius:"50%",background:C.err,color:"#FFF",fontSize:10,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center"}}>3</span></div><div style={{width:1,height:24,background:C.bd}}/><span style={{fontSize:13,fontWeight:600}}>👤 Pavel</span></div>
      </header>
      <div style={{flex:1,overflow:"auto",padding:28}}>{render()}</div>
    </main>
  </div>
}

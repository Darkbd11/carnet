(function(){
"use strict";
const CATS={
  courses:{n:"Courses",c:"#2F9E6E",t:"out"}, logement:{n:"Logement",c:"#5B6CE0",t:"out"},
  transport:{n:"Transport",c:"#2B8FC2",t:"out"}, sorties:{n:"Restos & sorties",c:"#E0763A",t:"out"},
  shopping:{n:"Shopping",c:"#C64C8E",t:"out"}, sante:{n:"Santé",c:"#D2463B",t:"out"},
  abos:{n:"Abonnements",c:"#8A5BD6",t:"out"}, loisirs:{n:"Loisirs",c:"#C59A16",t:"out"},
  famille:{n:"Famille & cadeaux",c:"#3FA5A0",t:"out"}, autre:{n:"Autre",c:"#7A8A86",t:"out"},
  salaire:{n:"Salaire",c:"#1D8A57",t:"in"}, aides:{n:"Aides (CAF…)",c:"#2B8FC2",t:"in"}, extra:{n:"Autre rentrée",c:"#7A8A86",t:"in"}
};
const cat=k=>CATS[k]||CATS.autre;
const $=s=>document.querySelector(s);
const pad=n=>String(n).padStart(2,"0");
const now=()=>new Date();
const todayStr=()=>{const d=now();return d.getFullYear()+"-"+pad(d.getMonth()+1)+"-"+pad(d.getDate());};
const thisYm=()=>todayStr().slice(0,7);
const addMonth=(ym,k)=>{let y=+ym.slice(0,4),m=+ym.slice(5)+k;while(m>12){m-=12;y++}while(m<1){m+=12;y--}return y+"-"+pad(m);};
const daysIn=ym=>new Date(+ym.slice(0,4),+ym.slice(5),0).getDate();
const monthName=ym=>new Date(+ym.slice(0,4),+ym.slice(5)-1,1).toLocaleDateString("fr-FR",{month:"long"});
const monthLabel=ym=>new Date(+ym.slice(0,4),+ym.slice(5)-1,1).toLocaleDateString("fr-FR",{month:"long",year:"numeric"});
const EUR=new Intl.NumberFormat("fr-FR",{style:"currency",currency:"EUR"});
const EUR0=new Intl.NumberFormat("fr-FR",{style:"currency",currency:"EUR",maximumFractionDigits:0});
const fmt=n=>EUR.format(n);
const fmt0=n=>EUR0.format(n);
const esc=s=>String(s==null?"":s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const uid=()=>(window.crypto&&crypto.randomUUID)?crypto.randomUUID().replace(/-/g,"").slice(0,20):Date.now().toString(36)+Math.random().toString(36).slice(2,10);
const parseAmt=s=>{const v=parseFloat(String(s).replace(/\s/g,"").replace(",","."));return isFinite(v)?Math.round(v*100)/100:NaN;};
const sum=a=>a.reduce((s,x)=>s+(+x.amount||0),0);

const S={tx:[],profile:{recurring:[],budgets:{}},month:thisYm(),tab:"mois",filter:"all",ready:false};

/* ---------- storage ---------- */
// Tout est gardé dans le navigateur (localStorage), sur l'appareil.
// Sauvegarde / restauration via un fichier JSON (onglet Budgets).
const LKEY="carnet-argent-v1";
function loadLocal(){try{const d=JSON.parse(localStorage.getItem(LKEY)||"null");if(d){S.tx=Array.isArray(d.tx)?d.tx:[];S.profile=Object.assign({recurring:[],budgets:{}},d.profile||{});}}catch(e){}}
function saveLocal(){try{localStorage.setItem(LKEY,JSON.stringify({tx:S.tx,profile:S.profile}));}catch(e){toast("Impossible d'enregistrer : la mémoire du navigateur est pleine ou bloquée.");}}
const api={
  putTx(t){const i=S.tx.findIndex(x=>x.id===t.id);if(i>=0)S.tx[i]=t;else S.tx.push(t);saveLocal();render();},
  delTx(id){S.tx=S.tx.filter(x=>x.id!==id);saveLocal();render();},
  saveProfile(){saveLocal();render();}
};
function exportData(){
  const data={app:"carnet",version:1,exportedAt:new Date().toISOString(),tx:S.tx,profile:S.profile};
  const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:"application/json"}));
  const a=document.createElement("a");a.href=url;a.download="carnet-sauvegarde-"+todayStr()+".json";
  document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
  toast("Sauvegarde téléchargée");
}
function importData(file){
  const r=new FileReader();
  r.onload=()=>{
    let d;try{d=JSON.parse(r.result);}catch(e){toast("Ce fichier n'est pas une sauvegarde Carnet.");return;}
    if(!d||!Array.isArray(d.tx)||typeof d.profile!=="object"){toast("Ce fichier n'est pas une sauvegarde Carnet.");return;}
    if(!confirm("Remplacer les données de cet appareil par celles du fichier ("+d.tx.length+" opérations) ?"))return;
    S.tx=d.tx;S.profile=Object.assign({recurring:[],budgets:{}},d.profile);saveLocal();render();toast("Données importées");
  };
  r.readAsText(file);
}

/* ---------- maths ---------- */
function compute(ym){
  const txs=S.tx.filter(t=>t.date&&t.date.slice(0,7)===ym);
  const rec=(S.profile.recurring||[]).filter(r=>!r.since||r.since<=ym);
  const inTx=sum(txs.filter(t=>t.type==="in")), outTx=sum(txs.filter(t=>t.type==="out"));
  const inFix=sum(rec.filter(r=>r.type==="in")), outFix=sum(rec.filter(r=>r.type==="out"));
  const income=inTx+inFix, free=income-outFix, reste=free-outTx;
  const byCat={};txs.filter(t=>t.type==="out").forEach(t=>{byCat[t.cat]=(byCat[t.cat]||0)+(+t.amount||0);});
  const cur=ym===thisYm(), past=ym<thisYm(), dim=daysIn(ym);
  const day=now().getDate();
  const daysLeft=cur?dim-day+1:past?0:dim;
  const elapsed=cur?day/dim:past?1:0;
  return {txs,rec,inTx,outTx,inFix,outFix,income,free,reste,byCat,cur,past,dim,day,daysLeft,elapsed};
}
function pace(c){
  if(c.income<=0&&c.outFix<=0&&c.outTx<=0) return null;
  if(c.free<=0) return {cls:"bad",label:"Fixes trop lourds",frac:1,text:"Tes charges fixes dépassent ce qui rentre ce mois-ci. Regarde dans Budgets ce qui peut être réduit ou résilié."};
  const f=c.outTx/c.free;
  if(f>1) return {cls:"bad",label:"Budget dépassé",frac:1,text:"Tu as déjà dépensé plus que ton budget libre du mois, de "+fmt(c.outTx-c.free)+"."};
  if(!c.cur) return c.past?{cls:"ok",label:"Mois tenu",frac:f,text:"Tu as utilisé "+Math.round(f*100)+" % de ton budget libre."}:{cls:"ok",label:"À venir",frac:f,text:"Budget libre prévu : "+fmt(c.free)+" une fois tes fixes payés."};
  const gap=f-c.elapsed;
  const base="Tu as utilisé "+Math.round(f*100)+" % de ton budget libre, et "+Math.round(c.elapsed*100)+" % du mois est passé.";
  if(gap>0.12) return {cls:"warn",label:"Un peu trop vite",frac:f,text:base+" À ce rythme, tu finis le mois à court."};
  return {cls:"ok",label:"Dans les clous",frac:f,text:base};
}

/* ---------- render ---------- */
function money(n){
  const neg=n<0, a=Math.abs(n), e=Math.floor(a), c=Math.round((a-e)*100);
  return (neg?"−":"")+new Intl.NumberFormat("fr-FR").format(e)+'<span class="cents">,'+pad(c%100)+" €</span>";
}
function dayLabel(d){
  const t=todayStr(); const y=new Date(now().getTime()-864e5); const ys=y.getFullYear()+"-"+pad(y.getMonth()+1)+"-"+pad(y.getDate());
  if(d===t)return "Aujourd'hui"; if(d===ys)return "Hier";
  return new Date(+d.slice(0,4),+d.slice(5,7)-1,+d.slice(8,10)).toLocaleDateString("fr-FR",{weekday:"long",day:"numeric",month:"short"});
}
function opRow(t){
  const k=cat(t.cat); const ini=k.n.charAt(0);
  return '<button class="op" data-edit="'+esc(t.id)+'"><span class="ic" style="background:'+k.c+'">'+esc(ini)+'</span>'+
    '<span class="t"><b>'+esc(t.label||k.n)+(t.example?'<span class="tag">exemple</span>':'')+'</b><span>'+esc(k.n)+'</span></span>'+
    '<span class="m num'+(t.type==="in"?" in":"")+'">'+(t.type==="in"?"+":"−")+fmt(+t.amount).replace("-","")+'</span></button>';
}
function ledger(list){
  if(!list.length) return '<div class="ledger"><div class="empty">Aucune opération ici pour l\'instant.</div></div>';
  const by={}; list.forEach(t=>{(by[t.date]=by[t.date]||[]).push(t);});
  return Object.keys(by).sort().reverse().map(d=>'<div class="stack" style="gap:6px"><div class="day">'+esc(dayLabel(d))+'</div><div class="ledger">'+by[d].map(opRow).join("")+'</div></div>').join("");
}
function hasExample(){return S.tx.some(t=>t.example)||(S.profile.recurring||[]).some(r=>r.example);}
function exampleBanner(){return hasExample()?'<div class="banner"><span>Tu regardes des <b>données d\'exemple</b>.</span><button class="link" data-act="clearEx">Effacer l\'exemple</button></div>':"";}

function viewMois(){
  const c=compute(S.month), p=pace(c);
  const isEmpty=!S.tx.length&&!(S.profile.recurring||[]).length;
  let lbl,sub;
  if(c.cur){lbl="Reste à vivre jusqu'au "+c.dim+" "+monthName(S.month);
    sub=c.reste>0?"soit <b>"+fmt(c.reste/c.daysLeft)+" par jour</b> pendant "+c.daysLeft+" jour"+(c.daysLeft>1?"s":""):
      c.reste<0?"Tu es dans le rouge de <b>"+fmt(-c.reste)+"</b> sur ce mois":"Plus rien de disponible ce mois-ci";}
  else if(c.past){lbl="Bilan de "+monthName(S.month);sub=c.reste>=0?"Il t'est resté <b>"+fmt(c.reste)+"</b> à la fin du mois":"Tu as dépensé <b>"+fmt(-c.reste)+"</b> de plus que ce qui est rentré";}
  else{lbl="Prévu pour "+monthName(S.month);sub="Avec tes rentrées et charges fixes actuelles";}
  let h=exampleBanner();
  h+='<section class="cover" aria-label="Résumé du mois"><div class="lbl">'+esc(lbl)+'</div><div class="big num">'+(S.ready?money(c.reste):"…")+'</div><div class="sub">'+(S.ready?sub:"Chargement de ton carnet…")+'</div>'+
     '<div class="trio num"><div><div class="k">Rentrées</div><div class="v">'+fmt0(c.income)+'</div></div><div><div class="k">Charges fixes</div><div class="v">'+fmt0(c.outFix)+'</div></div><div><div class="k">Dépenses</div><div class="v">'+fmt0(c.outTx)+'</div></div></div></section>';
  if(S.ready&&isEmpty){
    h+='<section class="stack"><h2 class="sec-h">Pour commencer</h2><p class="hint">Note ce qui rentre et ce qui part chaque mois. Le carnet calcule ce qu\'il te reste vraiment pour vivre, jour par jour.</p>'+
      '<div class="start"><button data-act="addSalary"><b>Mon salaire</b><span>ou ce qui rentre chaque mois</span></button>'+
      '<button data-act="addRent"><b>Mon loyer</b><span>et les autres charges fixes</span></button>'+
      '<button data-act="addOp"><b>Une dépense</b><span>courses, essence, resto…</span></button>'+
      '<button data-act="addAide"><b>Mes aides</b><span>CAF, prime d\'activité…</span></button>'+
      '<button class="ex" data-act="example"><b>Essayer avec un exemple</b><span>Remplit le carnet avec un mois fictif, effaçable en un geste.</span></button></div></section>';
    return h;
  }
  if(p){
    const cls=p.cls, fw=Math.min(100,Math.max(0,p.frac*100));
    h+='<section class="card"><div class="row"><h2>Ton rythme de dépenses</h2><span class="pill '+cls+'">'+esc(p.label)+'</span></div>'+
      '<div class="gauge '+cls+'" role="img" aria-label="'+Math.round(p.frac*100)+' % du budget libre utilisé"><span class="fill" style="width:'+fw+'%"></span>'+
      (c.cur?'<span class="today" style="left:'+(c.elapsed*100)+'%" data-l="aujourd\'hui"></span>':"")+'</div>'+
      '<p class="hint">'+esc(p.text)+'</p></section>';
  }
  const cats=Object.keys(c.byCat).sort((a,b)=>c.byCat[b]-c.byCat[a]);
  if(cats.length){
    const max=Math.max.apply(null,cats.map(k=>c.byCat[k]));
    h+='<section class="card"><h2>Où part ton argent</h2><p class="hint" style="margin-top:-6px">Dépenses du mois, hors charges fixes</p><div class="bars">'+
      cats.slice(0,6).map(k=>{const b=S.profile.budgets&&S.profile.budgets[k];const v=c.byCat[k];
        return '<div class="bar"><span class="name"><span class="dot" style="background:'+cat(k).c+'"></span>'+esc(cat(k).n)+'</span><span class="amt num">'+fmt(v)+(b?' <small>/ '+fmt0(b)+'</small>':'')+'</span>'+
          '<span class="track"><i style="width:'+(v/max*100)+'%;background:'+cat(k).c+'"></i></span></div>';}).join("")+'</div></section>';
  }
  const recent=c.txs.slice().sort((a,b)=>(b.date+(b.ts||0))>(a.date+(a.ts||0))?1:-1).slice(0,5);
  h+='<section class="stack"><div class="row"><h2 class="sec-h">Dernières opérations</h2>'+(c.txs.length>5?'<button class="link" data-goto="ops">Tout voir</button>':'')+'</div>'+
     (recent.length?'<div class="ledger">'+recent.map(opRow).join("")+'</div>':'<div class="ledger"><div class="empty">Rien noté en '+esc(monthName(S.month))+'. Appuie sur Ajouter pour ta première dépense.</div></div>')+'</section>';
  return h;
}
function viewOps(){
  const c=compute(S.month);
  let list=c.txs; if(S.filter!=="all")list=list.filter(t=>t.type===S.filter);
  list=list.slice().sort((a,b)=>(a.ts||0)-(b.ts||0));
  const f=(k,l)=>'<button class="chip" data-filter="'+k+'" aria-pressed="'+(S.filter===k)+'">'+l+'</button>';
  let h=exampleBanner();
  h+='<div class="row"><h2 class="sec-h" style="text-transform:none">Opérations de '+esc(monthName(S.month))+'</h2></div>';
  h+='<div class="chips">'+f("all","Tout")+f("out","Dépenses")+f("in","Rentrées")+'</div>';
  if(c.rec.length) h+='<p class="hint">+ '+c.rec.length+' opération'+(c.rec.length>1?'s':'')+' fixe'+(c.rec.length>1?'s':'')+' comptée'+(c.rec.length>1?'s':'')+' chaque mois. <button class="link" data-goto="budgets">Voir les fixes</button></p>';
  h+=ledger(list);
  return h;
}
function viewBudgets(){
  const c=compute(S.month);
  const outCats=Object.keys(CATS).filter(k=>CATS[k].t==="out"&&k!=="logement");
  let h=exampleBanner();
  h+='<section class="card"><div class="row"><h2>Plafonds par catégorie</h2></div><p class="hint" style="margin-top:-6px">Touche une catégorie pour fixer combien tu t\'autorises par mois.</p><div class="bars">'+
    outCats.map(k=>{const b=+(S.profile.budgets||{})[k]||0, v=c.byCat[k]||0;
      let st="",col=cat(k).c,w=0;
      if(b){const f=v/b;w=Math.min(100,f*100);st=f>1?'<span class="pill bad">Dépassé</span>':f>.8?'<span class="pill warn">Bientôt atteint</span>':'';col=f>1?"var(--bad)":f>.8?"var(--warn)":"var(--ok)";}
      return '<div class="bar tap" role="button" tabindex="0" data-budget="'+k+'"><span class="name"><span class="dot" style="background:'+cat(k).c+'"></span>'+esc(cat(k).n)+' '+st+'</span>'+
        '<span class="amt num">'+fmt(v)+' <small>'+(b?'/ '+fmt0(b):'· sans plafond')+'</small></span>'+(b?'<span class="track"><i style="width:'+w+'%;background:'+col+'"></i></span>':'')+'</div>';}).join("")+'</div></section>';
  const rec=(S.profile.recurring||[]).slice().sort((a,b)=>(a.type===b.type?b.amount-a.amount:a.type==="in"?-1:1));
  h+='<section class="stack"><div class="row"><h2 class="sec-h">Fixes chaque mois</h2><button class="link" data-act="addFixed">+ Ajouter</button></div>'+
    '<p class="hint">Salaire, loyer, forfait, assurance, crédit… Ils sont comptés automatiquement tous les mois.</p>'+
    (rec.length?'<div class="ledger">'+rec.map(r=>{const k=cat(r.cat);return '<button class="op" data-fixed="'+esc(r.id)+'"><span class="ic" style="background:'+k.c+'">'+esc(k.n.charAt(0))+'</span><span class="t"><b>'+esc(r.label||k.n)+(r.example?'<span class="tag">exemple</span>':'')+'</b><span>'+esc(k.n)+' · chaque mois</span></span><span class="m num'+(r.type==="in"?" in":"")+'">'+(r.type==="in"?"+":"−")+fmt(+r.amount)+'</span></button>';}).join("")+'</div>'
      :'<div class="ledger"><div class="empty">Aucun fixe pour l\'instant.</div></div>')+
    (rec.length?'<div class="row" style="padding:0 2px"><span class="hint">Total fixe sortant</span><b class="num">'+fmt(sum(rec.filter(r=>r.type==="out")))+'</b></div>':'')+'</section>';
  h+='<section class="card"><h2>Sauvegarde</h2><p class="hint" style="margin-top:-6px">Tes données sont gardées sur cet appareil uniquement. Exporte-les de temps en temps, et importe le fichier sur un autre appareil pour les retrouver.</p>'+
    '<div class="actions"><button class="btn ghost" data-act="export">Exporter mes données</button><button class="btn ghost" data-act="import">Importer un fichier</button></div></section>';
  return h;
}
function render(){
  $("#mLabel").textContent=monthLabel(S.month);
  const v=S.tab==="ops"?viewOps():S.tab==="budgets"?viewBudgets():viewMois();
  $("#view").innerHTML=v;
  document.querySelectorAll(".nav button").forEach(b=>b.setAttribute("aria-current",b.dataset.tab===S.tab?"page":"false"));
  $("#storeNote").textContent="Tes données restent sur cet appareil. Pense à les sauvegarder de temps en temps (onglet Budgets).";
    "Tes données sont gardées dans ce navigateur, sur cet appareil.";
}

/* ---------- sheet ---------- */
let SH={mode:"tx",type:"out",cat:"courses",id:null,armed:false};
function drawCats(){
  $("#fCats").innerHTML=Object.keys(CATS).filter(k=>CATS[k].t===SH.type).map(k=>'<button type="button" class="chip" data-cat="'+k+'" aria-pressed="'+(SH.cat===k)+'"><span class="dot" style="display:inline-block;margin-right:6px;background:'+CATS[k].c+'"></span>'+esc(CATS[k].n)+'</button>').join("");
}
function setType(t){SH.type=t;document.querySelectorAll("#shType button").forEach(b=>b.setAttribute("aria-pressed",b.dataset.t===t));
  if(cat(SH.cat).t!==t)SH.cat=t==="in"?"salaire":"courses";drawCats();updOk();}
function updOk(){
  if(SH.mode==="budget"){$("#shOk").textContent="Enregistrer";return;}
  const w=SH.type==="in"?"la rentrée":"la dépense";
  $("#shOk").textContent=SH.id?"Enregistrer":(SH.mode==="fixed"?"Ajouter ce fixe":"Ajouter "+w);
}
function openSheet(o){
  SH=Object.assign({mode:"tx",type:"out",cat:"courses",id:null,armed:false},o);
  const isB=SH.mode==="budget";
  $("#shOp").hidden=isB;$("#shBudget").hidden=!isB;$("#shErr").hidden=true;
  $("#shDel").hidden=!(SH.id||(isB&&SH.has));$("#shDel").classList.remove("armed");
  $("#shDel").textContent=isB?"Retirer le plafond":"Supprimer";
  $("#fDateWrap").hidden=SH.mode!=="tx";
  if(isB){$("#shTitle").textContent=cat(SH.cat).n;$("#bHint").textContent="Combien tu t'autorises à dépenser en "+cat(SH.cat).n.toLowerCase()+" chaque mois ?";$("#bAmount").value=SH.has?String(SH.amount).replace(".",","):"";}
  else{
    $("#shTitle").textContent=SH.mode==="fixed"?(SH.id?"Modifier le fixe":"Nouveau fixe mensuel"):(SH.id?"Modifier l'opération":"Nouvelle opération");
    $("#fAmount").value=SH.amount!=null?String(SH.amount).replace(".",","):"";
    $("#fLabel").value=SH.label||"";$("#fDate").value=SH.date||(S.month===thisYm()?todayStr():S.month+"-01");
    setType(SH.type);
  }
  updOk();$("#veil").hidden=false;
  setTimeout(()=>{try{(isB?$("#bAmount"):$("#fAmount")).focus();}catch(e){}},60);
}
function closeSheet(){$("#veil").hidden=true;}
function showErr(m){const e=$("#shErr");e.textContent=m;e.hidden=false;}

$("#sheet").addEventListener("submit",ev=>{
  ev.preventDefault();
  if(SH.mode==="budget"){
    const a=parseAmt($("#bAmount").value);
    if(!(a>0)){showErr("Indique un montant supérieur à 0, par exemple 200.");return;}
    S.profile.budgets=Object.assign({},S.profile.budgets,{[SH.cat]:a});api.saveProfile();closeSheet();toast("Plafond enregistré");return;
  }
  const a=parseAmt($("#fAmount").value);
  if(!(a>0)){showErr("Indique un montant, par exemple 12,50.");return;}
  const label=$("#fLabel").value.trim().slice(0,60);
  if(SH.mode==="fixed"){
    const rec=(S.profile.recurring||[]).slice();
    const prev=rec.find(r=>r.id===SH.id);
    const r={id:SH.id||uid(),type:SH.type,cat:SH.cat,amount:a,label,since:prev?prev.since:thisYm()};
    if(prev&&prev.example)r.example=true;
    S.profile.recurring=prev?rec.map(x=>x.id===SH.id?r:x):rec.concat([r]);
    api.saveProfile();closeSheet();toast(prev?"Fixe modifié":"Fixe ajouté");return;
  }
  const date=$("#fDate").value||todayStr();
  const prev=S.tx.find(t=>t.id===SH.id);
  const t={id:SH.id||uid(),type:SH.type,cat:SH.cat,amount:a,label,date,ts:prev?prev.ts:Date.now()};
  if(prev&&prev.example)t.example=true;
  api.putTx(t);closeSheet();toast(prev?"Opération modifiée":(SH.type==="in"?"Rentrée ajoutée":"Dépense ajoutée"));
  if(date.slice(0,7)!==S.month){S.month=date.slice(0,7);render();}
});
$("#shDel").addEventListener("click",()=>{
  const b=$("#shDel");
  if(!SH.armed){SH.armed=true;b.classList.add("armed");b.textContent="Confirmer";return;}
  if(SH.mode==="budget"){const bd=Object.assign({},S.profile.budgets);delete bd[SH.cat];S.profile.budgets=bd;api.saveProfile();toast("Plafond retiré");}
  else if(SH.mode==="fixed"){S.profile.recurring=(S.profile.recurring||[]).filter(r=>r.id!==SH.id);api.saveProfile();toast("Fixe supprimé");}
  else{api.delTx(SH.id);toast("Opération supprimée");}
  closeSheet();
});
$("#shType").addEventListener("click",e=>{const b=e.target.closest("button[data-t]");if(b)setType(b.dataset.t);});
$("#fCats").addEventListener("click",e=>{const b=e.target.closest("[data-cat]");if(!b)return;SH.cat=b.dataset.cat;drawCats();});
$("#shClose").addEventListener("click",closeSheet);
$("#veil").addEventListener("click",e=>{if(e.target.id==="veil")closeSheet();});
document.addEventListener("keydown",e=>{if(e.key==="Escape"&&!$("#veil").hidden)closeSheet();});

/* ---------- example ---------- */
function loadExample(){
  const ym=thisYm(), pm=addMonth(ym,-1), today=now().getDate();
  const d=(m,day)=>m+"-"+pad(m===ym?Math.min(day,today):Math.min(day,daysIn(m)));
  const recs=[["in","salaire",1650,"Salaire"],["in","aides",186,"Prime d'activité"],["out","logement",640,"Loyer"],["out","transport",88.8,"Pass Navigo"],
    ["out","abos",15.99,"Forfait mobile"],["out","abos",29.99,"Box internet"],["out","logement",42,"Électricité"]];
  S.profile.recurring=(S.profile.recurring||[]).concat(recs.map(r=>({id:uid(),type:r[0],cat:r[1],amount:r[2],label:r[3],since:pm,example:true})));
  S.profile.budgets=Object.assign({courses:280,sorties:120,shopping:80},S.profile.budgets);
  const txs=[[ym,1,"courses",46.3,"Courses Lidl"],[ym,2,"sorties",9.5,"Kebab"],[ym,3,"transport",35,"Essence"],[ym,3,"courses",4.2,"Boulangerie"],
    [ym,4,"sorties",23.9,"Uber Eats"],[ym,5,"sante",7.8,"Pharmacie"],[ym,5,"shopping",34.99,"Baskets Décathlon"],[ym,5,"courses",18.65,"Carrefour City"],
    [pm,3,"courses",62.1,"Courses Leclerc"],[pm,7,"sorties",31,"Resto avec des amis"],[pm,12,"courses",54.4,"Courses Lidl"],[pm,15,"shopping",59,"Veste"],
    [pm,19,"loisirs",14,"Cinéma"],[pm,22,"courses",71.3,"Courses Auchan"],[pm,26,"famille",40,"Cadeau anniversaire"],[pm,28,"sorties",18.5,"McDo"]];
  const list=txs.map((x,i)=>({id:uid(),type:"out",cat:x[2],amount:x[3],label:x[4],date:d(x[0],x[1]),ts:Date.now()-((txs.length-i)*1000),example:true}));
  S.tx=S.tx.concat(list);saveLocal();render();
  toast("Exemple chargé");
}
function clearExample(){
  S.profile.recurring=(S.profile.recurring||[]).filter(r=>!r.example);
  const b=Object.assign({},S.profile.budgets);
  if(b.courses===280&&b.sorties===120&&b.shopping===80){delete b.courses;delete b.sorties;delete b.shopping;}
  S.profile.budgets=b;
  S.tx=S.tx.filter(t=>!t.example);saveLocal();render();
  toast("Exemple effacé");
}

/* ---------- events ---------- */
$("#view").addEventListener("click",e=>{
  const el=e.target.closest("[data-edit],[data-fixed],[data-budget],[data-act],[data-goto],[data-filter]");if(!el)return;
  if(el.dataset.edit){const t=S.tx.find(x=>x.id===el.dataset.edit);if(t)openSheet({mode:"tx",id:t.id,type:t.type,cat:t.cat,amount:t.amount,label:t.label,date:t.date});}
  else if(el.dataset.fixed){const r=(S.profile.recurring||[]).find(x=>x.id===el.dataset.fixed);if(r)openSheet({mode:"fixed",id:r.id,type:r.type,cat:r.cat,amount:r.amount,label:r.label});}
  else if(el.dataset.budget){const k=el.dataset.budget,b=(S.profile.budgets||{})[k];openSheet({mode:"budget",cat:k,has:!!b,amount:b});}
  else if(el.dataset.goto){S.tab=el.dataset.goto;render();scrollTo(0,0);}
  else if(el.dataset.filter){S.filter=el.dataset.filter;render();}
  else{const a=el.dataset.act;
    if(a==="addSalary")openSheet({mode:"fixed",type:"in",cat:"salaire",label:"Salaire"});
    else if(a==="addAide")openSheet({mode:"fixed",type:"in",cat:"aides",label:"CAF"});
    else if(a==="addRent")openSheet({mode:"fixed",type:"out",cat:"logement",label:"Loyer"});
    else if(a==="addFixed")openSheet({mode:"fixed",type:"out",cat:"abos"});
    else if(a==="addOp")openSheet({mode:"tx"});
    else if(a==="example")loadExample();
    else if(a==="clearEx")clearExample();
    else if(a==="export")exportData();
    else if(a==="import")$("#importFile").click();
  }
});
$("#view").addEventListener("keydown",e=>{if((e.key==="Enter"||e.key===" ")&&e.target.matches("[data-budget]")){e.preventDefault();e.target.click();}});
document.querySelector(".nav").addEventListener("click",e=>{const b=e.target.closest("[data-tab]");if(!b)return;S.tab=b.dataset.tab;render();scrollTo(0,0);});
$("#prevM").addEventListener("click",()=>{S.month=addMonth(S.month,-1);render();});
$("#nextM").addEventListener("click",()=>{S.month=addMonth(S.month,1);render();});
$("#fab").addEventListener("click",()=>openSheet({mode:"tx"}));
let tT;function toast(m){const t=$("#toast");t.textContent=m;t.hidden=false;clearTimeout(tT);tT=setTimeout(()=>{t.hidden=true;},2600);}

$("#importFile").addEventListener("change",e=>{const f=e.target.files&&e.target.files[0];if(f)importData(f);e.target.value="";});

loadLocal();S.ready=true;render();

// Appli installable + hors-ligne (seulement quand le site est servi en http/https)
if("serviceWorker" in navigator&&location.protocol.startsWith("http")){
  window.addEventListener("load",()=>navigator.serviceWorker.register("sw.js").catch(()=>{}));
}
})();

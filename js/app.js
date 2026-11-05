(function(){
"use strict";
// Refuse de s'afficher dans le cadre d'un autre site (anti-clickjacking : GitHub Pages ne permet pas d'envoyer l'en-tête adéquat).
if(window.top!==window.self){document.body.textContent="Carnet ne peut pas s'ouvrir dans le cadre d'un autre site.";return;}
const CATS={
  courses:{n:"Courses",c:"#2F9E6E",t:"out"}, logement:{n:"Logement",c:"#5B6CE0",t:"out"},
  transport:{n:"Transport",c:"#2B8FC2",t:"out"}, sorties:{n:"Restos & sorties",c:"#E0763A",t:"out"},
  shopping:{n:"Shopping",c:"#C64C8E",t:"out"}, sante:{n:"Santé",c:"#D2463B",t:"out"},
  abos:{n:"Abonnements",c:"#8A5BD6",t:"out"}, loisirs:{n:"Loisirs",c:"#C59A16",t:"out"},
  famille:{n:"Famille & cadeaux",c:"#3FA5A0",t:"out"}, autre:{n:"Autre",c:"#7A8A86",t:"out"},
  salaire:{n:"Salaire",c:"#1D8A57",t:"in"}, aides:{n:"Aides (CAF…)",c:"#2B8FC2",t:"in"}, extra:{n:"Autre rentrée",c:"#7A8A86",t:"in"}
};
const isCat=k=>typeof k==="string"&&Object.prototype.hasOwnProperty.call(CATS,k);
const cat=k=>isCat(k)?CATS[k]:CATS.autre;
const $=s=>document.querySelector(s);
const pad=n=>String(n).padStart(2,"0");
const now=()=>new Date();
const todayStr=()=>{const d=now();return d.getFullYear()+"-"+pad(d.getMonth()+1)+"-"+pad(d.getDate());};
const thisYm=()=>todayStr().slice(0,7);
const addMonth=(ym,k)=>{let y=+ym.slice(0,4),m=+ym.slice(5)+k;while(m>12){m-=12;y++}while(m<1){m+=12;y--}return y+"-"+pad(m);};
const daysIn=ym=>new Date(+ym.slice(0,4),+ym.slice(5),0).getDate();
const monthDate=ym=>new Date(+ym.slice(0,4),+ym.slice(5)-1,1);
const monthName=ym=>monthDate(ym).toLocaleDateString("fr-FR",{month:"long"});
const monthLabel=ym=>monthDate(ym).toLocaleDateString("fr-FR",{month:"long",year:"numeric"});
const EUR=new Intl.NumberFormat("fr-FR",{style:"currency",currency:"EUR"});
const EUR0=new Intl.NumberFormat("fr-FR",{style:"currency",currency:"EUR",maximumFractionDigits:0});
const fmt=n=>EUR.format(n);
const fmt0=n=>EUR0.format(n);
const esc=s=>String(s==null?"":s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const uid=()=>(window.crypto&&crypto.randomUUID)?crypto.randomUUID().replace(/-/g,"").slice(0,20):Date.now().toString(36)+Math.random().toString(36).slice(2,10);
const MAX_AMOUNT=1e9, MAX_ITEMS=50000, MAX_FILE=10*1024*1024;
const round2=v=>Math.round(v*100)/100;
// Accepte 12 / 12,5 / 12.50 / 1 234,56 / 1.234,56. Refuse le reste plutôt que de deviner.
const parseAmt=s=>{
  const t=String(s).replace(/\s/g,"");let v;
  if(/^\d+([.,]\d{1,2})?$/.test(t))v=parseFloat(t.replace(",","."));
  else if(/^\d{1,3}(\.\d{3})+(,\d{1,2})?$/.test(t))v=parseFloat(t.replace(/\./g,"").replace(",","."));
  else return NaN;
  return v<=MAX_AMOUNT?round2(v):NaN;
};
const sum=a=>a.reduce((s,x)=>s+(+x.amount||0),0);
const norm=s=>String(s).normalize("NFD").replace(/\p{M}/gu,"").toLowerCase();
const blankProfile=()=>({recurring:[],budgets:{},goals:[]});

const S={tx:[],profile:blankProfile(),month:thisYm(),tab:"mois",filter:"all",query:"",ready:false};

/* ---------- validation des données ---------- */
// Tout ce qui vient d'un fichier ou du stockage est considéré comme non fiable :
// on ne garde que des champs connus, du bon type, dans des limites raisonnables.
const validDate=v=>{
  if(typeof v!=="string"||!/^\d{4}-\d{2}-\d{2}$/.test(v))return false;
  const y=+v.slice(0,4),m=+v.slice(5,7),d=+v.slice(8,10);
  return y>=1900&&y<=2200&&m>=1&&m<=12&&d>=1&&d<=daysIn(v.slice(0,7));
};
const validYm=v=>typeof v==="string"&&/^\d{4}-(0[1-9]|1[0-2])$/.test(v);
const cleanAmt=v=>typeof v==="number"&&isFinite(v)&&v>0&&v<=MAX_AMOUNT?round2(v):null;
const cleanLabel=v=>typeof v==="string"?v.replace(/[\u0000-\u001f\u007f‪-‮⁦-⁩]/g,"").trim().slice(0,60):"";
function cleanData(d){
  const seen=new Set();let dropped=0;
  const id=v=>{let s=typeof v==="string"&&/^[\w-]{1,64}$/.test(v)?v:uid();while(seen.has(s))s=uid();seen.add(s);return s;};
  const base=o=>{
    if(!o||typeof o!=="object")return null;
    const type=o.type==="in"||o.type==="out"?o.type:null, amount=cleanAmt(o.amount);
    if(!type||amount===null)return null;
    const r={id:id(o.id),type,cat:isCat(o.cat)&&CATS[o.cat].t===type?o.cat:(type==="in"?"extra":"autre"),amount,label:cleanLabel(o.label)};
    if(o.example===true)r.example=true;
    return r;
  };
  const list=(a,f)=>{const out=[];(Array.isArray(a)?a.slice(0,MAX_ITEMS):[]).forEach(o=>{const r=f(o);if(r)out.push(r);else dropped++;});return out;};
  const src=d&&typeof d==="object"?d:{}, p=src.profile&&typeof src.profile==="object"?src.profile:{};
  const tx=list(src.tx,o=>{
    if(!o||!validDate(o.date))return null;
    const r=base(o);if(!r)return null;
    r.date=o.date;r.ts=typeof o.ts==="number"&&isFinite(o.ts)?o.ts:0;return r;
  });
  const recurring=list(p.recurring,o=>{const r=base(o);if(r&&o&&validYm(o.since))r.since=o.since;return r;});
  const goals=list(p.goals,o=>{
    const target=o&&cleanAmt(o.target);if(!target)return null;
    const saved=o.saved===0?0:cleanAmt(o.saved)||0;
    return {id:id(o.id),label:cleanLabel(o.label),target,saved};
  });
  const budgets={};
  if(p.budgets&&typeof p.budgets==="object")Object.keys(p.budgets).forEach(k=>{
    const a=cleanAmt(p.budgets[k]);if(isCat(k)&&CATS[k].t==="out"&&a!==null)budgets[k]=a;
  });
  return {tx,profile:{recurring,budgets,goals},dropped};
}
function applyData(d){const c=cleanData(d);S.tx=c.tx;S.profile=c.profile;return c.dropped;}

/* ---------- chiffrement ---------- */
// AES-256-GCM, clé dérivée du mot de passe avec PBKDF2-SHA256. Le mot de passe et la clé ne sont jamais stockés.
const canCrypto=!!(window.crypto&&crypto.subtle);
const KDF_ITER=600000, KDF_MIN=100000, KDF_MAX=5000000, MIN_PW=8;
const AAD=new TextEncoder().encode("carnet-v1");
const SEC={key:null,salt:null,iter:KDF_ITER,locked:false};
function toB64(buf){const b=new Uint8Array(buf);let s="";for(let i=0;i<b.length;i+=32768)s+=String.fromCharCode.apply(null,b.subarray(i,i+32768));return btoa(s);}
function fromB64(s){const r=atob(s),b=new Uint8Array(r.length);for(let i=0;i<r.length;i++)b[i]=r.charCodeAt(i);return b;}
const randomBytes=n=>crypto.getRandomValues(new Uint8Array(n));
async function deriveKey(pw,salt,iter){
  const base=await crypto.subtle.importKey("raw",new TextEncoder().encode(pw.normalize("NFKC")),"PBKDF2",false,["deriveKey"]);
  return crypto.subtle.deriveKey({name:"PBKDF2",hash:"SHA-256",salt,iterations:iter},base,{name:"AES-GCM",length:256},false,["encrypt","decrypt"]);
}
async function seal(json,key,salt,iter){
  const iv=randomBytes(12); // nouveau à chaque enregistrement
  const ct=await crypto.subtle.encrypt({name:"AES-GCM",iv,additionalData:AAD},key,new TextEncoder().encode(json));
  return {enc:"carnet",v:1,kdf:"PBKDF2-SHA256",iter,salt:toB64(salt),iv:toB64(iv),ct:toB64(ct)};
}
async function unseal(box,key){
  const pt=await crypto.subtle.decrypt({name:"AES-GCM",iv:fromB64(box.iv),additionalData:AAD},key,fromB64(box.ct));
  return JSON.parse(new TextDecoder().decode(pt));
}
// "iter" vient d'un fichier : on le borne, sinon un fichier piégé pourrait geler l'appli.
const isBox=b=>!!b&&typeof b==="object"&&b.enc==="carnet"&&b.v===1&&Number.isInteger(b.iter)&&b.iter>=KDF_MIN&&b.iter<=KDF_MAX&&
  typeof b.salt==="string"&&typeof b.iv==="string"&&typeof b.ct==="string";
const openBox=async(box,pw)=>{const salt=fromB64(box.salt),key=await deriveKey(pw,salt,box.iter);return {key,salt,data:await unseal(box,key)};};

/* ---------- storage ---------- */
// Tout est gardé dans le navigateur (localStorage), sur l'appareil, chiffré si le verrouillage est activé.
// Sauvegarde / restauration via un fichier (onglet Réglages).
const LKEY="carnet-argent-v1", THEME_KEY="carnet-theme";
const payload=()=>JSON.stringify({tx:S.tx,profile:S.profile});
function readBox(){try{const d=JSON.parse(localStorage.getItem(LKEY)||"null");return isBox(d)?d:null;}catch(e){return null;}}
function loadLocal(){
  let raw=null;try{raw=localStorage.getItem(LKEY);}catch(e){toast("Le stockage du navigateur est bloqué : rien ne pourra être enregistré.");return;}
  if(!raw)return;
  let d;try{d=JSON.parse(raw);}catch(e){
    // Illisible : on met de côté une copie plutôt que de l'écraser à la prochaine écriture.
    try{localStorage.setItem(LKEY+"-illisible",raw);}catch(e2){}
    try{localStorage.removeItem(LKEY);}catch(e2){}
    toast("Tes données enregistrées étaient illisibles. Restaure une sauvegarde si tu en as une.");return;
  }
  if(isBox(d)){SEC.locked=true;return;}
  applyData(d);
}
// Les écritures passent par une file : elles restent dans l'ordre, même chiffrées (donc asynchrones).
let saveQ=Promise.resolve(true);
function saveLocal(){
  if(SEC.locked)return saveQ; // jamais d'écriture quand les données ne sont pas chargées
  const json=payload(), key=SEC.key, salt=SEC.salt, iter=SEC.iter;
  saveQ=saveQ.then(async()=>{
    try{localStorage.setItem(LKEY,key?JSON.stringify(await seal(json,key,salt,iter)):json);return true;}
    catch(e){toast("Impossible d'enregistrer : la mémoire du navigateur est pleine ou bloquée.");return false;}
  });
  return saveQ;
}
const api={
  putTx(t){const i=S.tx.findIndex(x=>x.id===t.id);if(i>=0)S.tx[i]=t;else S.tx.push(t);saveLocal();render();},
  delTx(id){S.tx=S.tx.filter(x=>x.id!==id);saveLocal();render();},
  saveProfile(){saveLocal();render();}
};
function download(name,type,content){
  const url=URL.createObjectURL(new Blob([content],{type}));
  const a=document.createElement("a");a.href=url;a.download=name;
  document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
const clearWarning=()=>!SEC.key||confirm("Ce fichier ne sera pas chiffré : n'importe qui pourra le lire. Continuer ?");
function exportData(){
  if(!clearWarning())return;
  const data={app:"carnet",version:2,exportedAt:new Date().toISOString(),tx:S.tx,profile:S.profile};
  download("carnet-sauvegarde-"+todayStr()+".json","application/json",JSON.stringify(data,null,2));
  toast("Sauvegarde téléchargée");
}
async function exportEncrypted(pw){
  const salt=randomBytes(16),key=await deriveKey(pw,salt,KDF_ITER);
  const box=await seal(payload(),key,salt,KDF_ITER);
  download("carnet-sauvegarde-"+todayStr()+".chiffre.json","application/json",JSON.stringify(box));
  toast("Sauvegarde chiffrée téléchargée");
}
// Une cellule qui commence par = + - @ serait exécutée comme formule par Excel ou LibreOffice : on la neutralise.
function csvCell(v){
  let s=String(v);if(/^\s*[=+\-@]/.test(s))s="'"+s;
  return /[;"\r\n]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s;
}
function exportCsv(){
  if(!clearWarning())return;
  const rows=S.tx.slice().sort((a,b)=>a.date.localeCompare(b.date)||(a.ts-b.ts)).map(t=>
    [t.date,t.type==="in"?"Rentrée":"Dépense",cat(t.cat).n,t.label].map(csvCell).join(";")+";"+t.amount.toFixed(2).replace(".",","));
  download("carnet-operations-"+todayStr()+".csv","text/csv;charset=utf-8","﻿Date;Type;Catégorie;Libellé;Montant\r\n"+rows.join("\r\n")+"\r\n");
  toast("Fichier CSV téléchargé");
}
const notBackup="Ce fichier n'est pas une sauvegarde Carnet.";
async function replaceData(d){
  if(!d||!Array.isArray(d.tx)||!d.profile||typeof d.profile!=="object"){toast(notBackup);return;}
  if(d.tx.length>MAX_ITEMS){toast("Ce fichier contient trop d'opérations.");return;}
  if(!confirm("Remplacer les données de cet appareil par celles du fichier ("+d.tx.length+" opérations) ?"))return;
  const prevTx=S.tx, prevP=S.profile, dropped=applyData(d);
  if(!await saveLocal()){S.tx=prevTx;S.profile=prevP;render();return;}
  render();
  toast(dropped?"Données importées. "+dropped+" élément"+(dropped>1?"s invalides ignorés":" invalide ignoré")+".":"Données importées");
}
function importData(file){
  if(file.size>MAX_FILE){toast("Ce fichier est trop gros pour être une sauvegarde Carnet.");return;}
  const r=new FileReader();
  r.onerror=()=>toast("Impossible de lire ce fichier.");
  r.onload=()=>{
    let d;try{d=JSON.parse(r.result);}catch(e){toast(notBackup);return;}
    if(isBox(d)){
      if(!canCrypto){toast("Ce navigateur ne peut pas ouvrir de fichier chiffré ici. Passe par le site en https.");return;}
      openSheet({mode:"pass",action:"import",box:d});return;
    }
    replaceData(d);
  };
  r.readAsText(file);
}

/* ---------- verrouillage ---------- */
const LOCK_IDLE=5*60*1000, LOCK_HIDDEN=60*1000;
let lastAct=Date.now(), hiddenAt=0;
function showApp(){["#app","#nav","#fab"].forEach(s=>{$(s).hidden=false;});$("#lock").hidden=true;}
function resetLockForm(){
  $("#lockPw").value="";$("#lockErr").hidden=true;
  const r=$("#lockReset");r.textContent="Mot de passe oublié ?";r.dataset.armed="";
}
function lockNow(){
  closeSheet();
  SEC.key=null;SEC.salt=null;SEC.locked=true;
  S.tx=[];S.profile=blankProfile();S.query="";
  $("#view").textContent="";$("#toast").hidden=true;
  ["#app","#nav","#fab"].forEach(s=>{$(s).hidden=true;});
  resetLockForm();$("#lock").hidden=false;
  setTimeout(()=>{try{$("#lockPw").focus();}catch(e){}},60);
}
function idleCheck(){
  if(!SEC.key||SEC.locked)return;
  const t=Date.now();
  if(t-lastAct>LOCK_IDLE||(hiddenAt&&t-hiddenAt>LOCK_HIDDEN))lockNow();
}
["pointerdown","keydown"].forEach(ev=>document.addEventListener(ev,()=>{lastAct=Date.now();},{passive:true}));
document.addEventListener("visibilitychange",()=>{
  if(document.hidden)hiddenAt=Date.now();
  else{idleCheck();hiddenAt=0;}
});
setInterval(idleCheck,15000);
function setBusy(btn,on,label){btn.disabled=on;if(on){btn.dataset.txt=btn.textContent;btn.textContent="Patience…";}else btn.textContent=label||btn.dataset.txt;}

$("#lockForm").addEventListener("submit",async ev=>{
  ev.preventDefault();
  const err=$("#lockErr"), btn=$("#lockOk"), pw=$("#lockPw").value;
  err.hidden=true;
  if(!pw||btn.disabled)return;
  if(!canCrypto){err.textContent="Ce navigateur ne permet pas de déchiffrer ici. Ouvre Carnet par son adresse https.";err.hidden=false;return;}
  const box=readBox();
  if(!box){SEC.locked=false;loadLocal();showApp();render();return;}
  setBusy(btn,true);
  try{
    const o=await openBox(box,pw);
    SEC.key=o.key;SEC.salt=o.salt;SEC.iter=box.iter;SEC.locked=false;
    applyData(o.data);lastAct=Date.now();hiddenAt=0;
    resetLockForm();showApp();render();
  }catch(e){err.textContent="Mot de passe incorrect.";err.hidden=false;$("#lockPw").select();}
  setBusy(btn,false);
});
$("#lockReset").addEventListener("click",()=>{
  const r=$("#lockReset"), err=$("#lockErr");
  if(!r.dataset.armed){
    err.textContent="Sans mot de passe, personne ne peut récupérer tes données, pas même le développeur. Tu peux seulement tout effacer et repartir de zéro ou d'une sauvegarde.";
    err.hidden=false;r.textContent="Tout effacer définitivement";r.dataset.armed="1";return;
  }
  if(!confirm("Effacer définitivement toutes les données de Carnet sur cet appareil ?"))return;
  try{localStorage.removeItem(LKEY);}catch(e){}
  SEC.locked=false;SEC.key=null;SEC.salt=null;
  resetLockForm();showApp();render();toast("Données effacées");
});
// Un autre onglet a modifié les données : on se resynchronise pour ne pas les écraser avec un état périmé
// (et surtout pour ne jamais réécrire en clair ce qu'il vient de chiffrer).
window.addEventListener("storage",async e=>{
  if(e.key!==LKEY&&e.key!==null)return;
  let d=null;try{d=JSON.parse(localStorage.getItem(LKEY)||"null");}catch(err){return;}
  if(isBox(d)){
    if(SEC.key){try{const o=await unseal(d,SEC.key);applyData(o);render();return;}catch(err){}}
    if(!SEC.locked)lockNow();
    return;
  }
  SEC.key=null;SEC.salt=null;
  if(SEC.locked){SEC.locked=false;resetLockForm();showApp();}
  applyData(d);render();
});

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
// La CSP bloque les attributs style dans le HTML généré : les valeurs calculées passent par data-* puis par le CSSOM.
function applyStyles(root){
  root.querySelectorAll("[data-bg]").forEach(el=>{el.style.background=el.dataset.bg;});
  root.querySelectorAll("[data-w]").forEach(el=>{el.style.width=el.dataset.w+"%";});
  root.querySelectorAll("[data-h]").forEach(el=>{el.style.height=el.dataset.h+"%";});
  root.querySelectorAll("[data-left]").forEach(el=>{el.style.left=el.dataset.left+"%";});
  root.querySelectorAll("[data-rows]").forEach(el=>{el.style.gridTemplateRows=el.dataset.rows;});
}
function money(n){
  const cents=Math.round(Math.abs(n)*100), e=Math.floor(cents/100), c=cents%100;
  return (n<0&&cents>0?"−":"")+new Intl.NumberFormat("fr-FR").format(e)+'<span class="cents">,'+pad(c)+" €</span>";
}
function dayLabel(d){
  const t=todayStr(); const y=new Date(now().getTime()-864e5); const ys=y.getFullYear()+"-"+pad(y.getMonth()+1)+"-"+pad(y.getDate());
  if(d===t)return "Aujourd'hui"; if(d===ys)return "Hier";
  const o={weekday:"long",day:"numeric",month:"short"};if(d.slice(0,4)!==t.slice(0,4))o.year="numeric";
  return new Date(+d.slice(0,4),+d.slice(5,7)-1,+d.slice(8,10)).toLocaleDateString("fr-FR",o);
}
function opRow(t){
  const k=cat(t.cat); const ini=k.n.charAt(0);
  return '<button class="op" data-edit="'+esc(t.id)+'"><span class="ic" data-bg="'+k.c+'">'+esc(ini)+'</span>'+
    '<span class="t"><b>'+esc(t.label||k.n)+(t.example?'<span class="tag">exemple</span>':'')+'</b><span>'+esc(k.n)+'</span></span>'+
    '<span class="m num'+(t.type==="in"?" in":"")+'">'+(t.type==="in"?"+":"−")+fmt(+t.amount).replace("-","")+'</span></button>';
}
function ledger(list,emptyText){
  if(!list.length) return '<div class="ledger"><div class="empty">'+esc(emptyText||"Aucune opération ici pour l'instant.")+'</div></div>';
  const by={}; list.forEach(t=>{(by[t.date]=by[t.date]||[]).push(t);});
  return Object.keys(by).sort().reverse().map(d=>'<div class="stack gap6"><div class="day">'+esc(dayLabel(d))+'</div><div class="ledger">'+by[d].map(opRow).join("")+'</div></div>').join("");
}
function hasExample(){return S.tx.some(t=>t.example)||(S.profile.recurring||[]).some(r=>r.example);}
function exampleBanner(){return hasExample()?'<div class="banner"><span>Tu regardes des <b>données d\'exemple</b>.</span><button class="link" data-act="clearEx">Effacer l\'exemple</button></div>':"";}

function viewTrend(){
  const data=[];for(let i=5;i>=0;i--){const ym=addMonth(S.month,-i),c=compute(ym);data.push({ym,has:c.txs.length>0||c.rec.length>0,v:c.reste});}
  const real=data.filter(x=>x.has);
  if(real.length<2)return "";
  const up=Math.max(0,...real.map(x=>x.v)), down=Math.max(0,...real.map(x=>-x.v)), tot=up+down||1;
  const avg=real.reduce((s,x)=>s+x.v,0)/real.length;
  const rows=(up/tot*100)+"fr "+(down/tot*100)+"fr";
  return '<section class="card"><h2>Ce qu\'il te reste, mois par mois</h2><p class="hint pull">En moyenne '+esc(fmt0(avg))+' sur '+real.length+' mois. Touche un mois pour l\'ouvrir.</p><div class="trend">'+
    data.map(x=>{
      const short=monthDate(x.ym).toLocaleDateString("fr-FR",{month:"short"}), title=monthLabel(x.ym)+" : "+(x.has?fmt(x.v):"pas de données");
      const hUp=x.has&&x.v>0&&up?x.v/up*100:0, hDown=x.has&&x.v<0&&down?-x.v/down*100:0;
      return '<button data-month="'+x.ym+'" aria-current="'+(x.ym===S.month)+'" aria-label="'+esc(title)+'" title="'+esc(title)+'">'+
        '<span class="tv num">'+(x.has?esc(fmt0(x.v)):"–")+'</span>'+
        '<span class="plot" data-rows="'+rows+'"><span class="pos"><i data-h="'+hUp+'"></i></span><span class="neg"><i data-h="'+hDown+'"></i></span></span>'+
        '<span class="tm">'+esc(short)+'</span></button>';
    }).join("")+'</div></section>';
}
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
      '<div class="gauge '+cls+'" role="img" aria-label="'+Math.round(p.frac*100)+' % du budget libre utilisé"><span class="fill" data-w="'+fw+'"></span>'+
      (c.cur?'<span class="today" data-left="'+(c.elapsed*100)+'" data-l="aujourd\'hui"></span>':"")+'</div>'+
      '<p class="hint">'+esc(p.text)+'</p></section>';
  }
  const cats=Object.keys(c.byCat).sort((a,b)=>c.byCat[b]-c.byCat[a]);
  if(cats.length){
    const max=Math.max.apply(null,cats.map(k=>c.byCat[k]));
    h+='<section class="card"><h2>Où part ton argent</h2><p class="hint pull">Dépenses du mois, hors charges fixes</p><div class="bars">'+
      cats.slice(0,6).map(k=>{const b=S.profile.budgets&&S.profile.budgets[k];const v=c.byCat[k];
        return '<div class="bar"><span class="name"><span class="dot" data-bg="'+cat(k).c+'"></span>'+esc(cat(k).n)+'</span><span class="amt num">'+fmt(v)+(b?' <small>/ '+fmt0(b)+'</small>':'')+'</span>'+
          '<span class="track"><i data-w="'+(v/max*100)+'" data-bg="'+cat(k).c+'"></i></span></div>';}).join("")+'</div></section>';
  }
  h+=viewTrend();
  const recent=c.txs.slice().sort((a,b)=>b.date.localeCompare(a.date)||(b.ts-a.ts)).slice(0,5);
  h+='<section class="stack"><div class="row"><h2 class="sec-h">Dernières opérations</h2>'+(c.txs.length>5?'<button class="link" data-goto="ops">Tout voir</button>':'')+'</div>'+
     (recent.length?'<div class="ledger">'+recent.map(opRow).join("")+'</div>':'<div class="ledger"><div class="empty">Rien noté en '+esc(monthName(S.month))+'. Appuie sur Ajouter pour ta première dépense.</div></div>')+'</section>';
  return h;
}
function opsBody(){
  const q=norm(S.query.trim());
  const byType=l=>S.filter==="all"?l:l.filter(t=>t.type===S.filter);
  const byTs=l=>l.slice().sort((a,b)=>a.ts-b.ts);
  if(q){
    const list=byType(S.tx).filter(t=>norm(t.label+" "+cat(t.cat).n).includes(q));
    const sOut=sum(list.filter(t=>t.type==="out")), sIn=sum(list.filter(t=>t.type==="in"));
    const parts=[];if(sOut)parts.push(fmt(sOut)+" dépensés");if(sIn)parts.push(fmt(sIn)+" rentrés");
    return '<p class="hint">'+list.length+' résultat'+(list.length>1?'s':'')+' sur tous les mois'+(parts.length?' · '+esc(parts.join(", ")):'')+'</p>'+ledger(byTs(list),"Rien ne correspond à ta recherche.");
  }
  const c=compute(S.month);
  let h="";
  if(c.rec.length) h+='<p class="hint">+ '+c.rec.length+' opération'+(c.rec.length>1?'s':'')+' fixe'+(c.rec.length>1?'s':'')+' comptée'+(c.rec.length>1?'s':'')+' chaque mois. <button class="link" data-goto="budgets">Voir les fixes</button></p>';
  return h+ledger(byTs(byType(c.txs)));
}
function viewOps(){
  const f=(k,l)=>'<button class="chip" data-filter="'+k+'" aria-pressed="'+(S.filter===k)+'">'+l+'</button>';
  let h=exampleBanner();
  h+='<div class="row"><h2 class="sec-h plain">Opérations de '+esc(monthName(S.month))+'</h2></div>';
  h+='<input class="search" id="opsSearch" type="search" placeholder="Chercher dans tous les mois (libellé, catégorie)" aria-label="Chercher une opération" autocomplete="off" maxlength="60" value="'+esc(S.query)+'">';
  h+='<div class="chips">'+f("all","Tout")+f("out","Dépenses")+f("in","Rentrées")+'</div>';
  h+='<div class="stack gap18" id="opsList">'+opsBody()+'</div>';
  return h;
}
function viewBudgets(){
  const c=compute(S.month);
  const outCats=Object.keys(CATS).filter(k=>CATS[k].t==="out"&&k!=="logement");
  let h=exampleBanner();
  h+='<section class="card"><div class="row"><h2>Plafonds par catégorie</h2></div><p class="hint pull">Touche une catégorie pour fixer combien tu t\'autorises par mois.</p><div class="bars">'+
    outCats.map(k=>{const b=+(S.profile.budgets||{})[k]||0, v=c.byCat[k]||0;
      let st="",col=cat(k).c,w=0;
      if(b){const f=v/b;w=Math.min(100,f*100);st=f>1?'<span class="pill bad">Dépassé</span>':f>.8?'<span class="pill warn">Bientôt atteint</span>':'';col=f>1?"var(--bad)":f>.8?"var(--warn)":"var(--ok)";}
      return '<div class="bar tap" role="button" tabindex="0" data-budget="'+k+'"><span class="name"><span class="dot" data-bg="'+cat(k).c+'"></span>'+esc(cat(k).n)+' '+st+'</span>'+
        '<span class="amt num">'+fmt(v)+' <small>'+(b?'/ '+fmt0(b):'· sans plafond')+'</small></span>'+(b?'<span class="track"><i data-w="'+w+'" data-bg="'+col+'"></i></span>':'')+'</div>';}).join("")+'</div></section>';
  const goals=S.profile.goals||[];
  h+='<section class="card"><div class="row"><h2>Objectifs d\'épargne</h2><button class="link" data-act="addGoal">+ Ajouter</button></div>'+
    (goals.length?'<div class="bars">'+goals.map(g=>{const f=Math.min(1,g.saved/g.target),done=g.saved>=g.target;
      return '<div class="bar tap" role="button" tabindex="0" data-goal="'+esc(g.id)+'"><span class="name">'+esc(g.label||"Objectif")+(done?' <span class="pill ok">Atteint</span>':'')+'</span>'+
        '<span class="amt num">'+fmt(g.saved)+' <small>/ '+fmt0(g.target)+'</small></span><span class="track"><i data-w="'+(f*100)+'" data-bg="var(--accent)"></i></span></div>';}).join("")+'</div>'
      :'<p class="hint pull">Vacances, permis, matelas de sécurité… Note ce que tu vises et ce que tu as déjà mis de côté.</p>')+'</section>';
  const rec=(S.profile.recurring||[]).slice().sort((a,b)=>(a.type===b.type?b.amount-a.amount:a.type==="in"?-1:1));
  h+='<section class="stack"><div class="row"><h2 class="sec-h">Fixes chaque mois</h2><button class="link" data-act="addFixed">+ Ajouter</button></div>'+
    '<p class="hint">Salaire, loyer, forfait, assurance, crédit… Ils sont comptés automatiquement tous les mois.</p>'+
    (rec.length?'<div class="ledger">'+rec.map(r=>{const k=cat(r.cat);return '<button class="op" data-fixed="'+esc(r.id)+'"><span class="ic" data-bg="'+k.c+'">'+esc(k.n.charAt(0))+'</span><span class="t"><b>'+esc(r.label||k.n)+(r.example?'<span class="tag">exemple</span>':'')+'</b><span>'+esc(k.n)+' · chaque mois</span></span><span class="m num'+(r.type==="in"?" in":"")+'">'+(r.type==="in"?"+":"−")+fmt(+r.amount)+'</span></button>';}).join("")+'</div>'
      :'<div class="ledger"><div class="empty">Aucun fixe pour l\'instant.</div></div>')+
    (rec.length?'<div class="row tight"><span class="hint">Total fixe sortant</span><b class="num">'+fmt(sum(rec.filter(r=>r.type==="out")))+'</b></div>':'')+'</section>';
  return h;
}
function getTheme(){try{const t=localStorage.getItem(THEME_KEY);return t==="light"||t==="dark"?t:"auto";}catch(e){return "auto";}}
function setTheme(t){
  if(t==="light"||t==="dark")document.documentElement.setAttribute("data-theme",t);else document.documentElement.removeAttribute("data-theme");
  try{if(t==="auto")localStorage.removeItem(THEME_KEY);else localStorage.setItem(THEME_KEY,t);}catch(e){}
}
function viewReglages(){
  const on=!!SEC.key;
  let h='<section class="card"><h2>Verrouillage</h2>';
  if(!canCrypto)h+='<p class="hint pull">Le chiffrement n\'est pas disponible à cette adresse. Ouvre Carnet en https pour l\'activer.</p>';
  else if(on)h+='<p class="hint pull"><span class="state">Activé.</span> Tes données sont chiffrées sur cet appareil. Le carnet se verrouille après 5 minutes sans activité, ou 1 minute après avoir quitté l\'appli.</p>'+
    '<div class="actions"><button class="btn" data-act="lockNow">Verrouiller maintenant</button><button class="btn ghost" data-act="lockChange">Changer le mot de passe</button><button class="btn ghost" data-act="lockOff">Désactiver</button></div>';
  else h+='<p class="hint pull"><span class="state">Désactivé.</span> Tes données sont en clair dans ce navigateur : toute personne qui a accès à l\'appareil peut les lire. Un mot de passe les chiffre.</p>'+
    '<div class="actions"><button class="btn" data-act="lockSet">Protéger avec un mot de passe</button></div>';
  h+='</section>';
  h+='<section class="card"><h2>Sauvegarde</h2><p class="hint pull">Tes données sont gardées sur cet appareil uniquement. Exporte-les de temps en temps, et importe le fichier sur un autre appareil pour les retrouver. Choisis le fichier chiffré si tu le ranges sur un cloud ou l\'envoies par mail.</p>'+
    '<div class="actions">'+(canCrypto?'<button class="btn" data-act="exportEnc">Exporter (chiffré)</button>':'')+'<button class="btn ghost" data-act="export">Exporter (non chiffré)</button><button class="btn ghost" data-act="import">Importer un fichier</button></div></section>';
  h+='<section class="card"><h2>Tableur</h2><p class="hint pull">Récupère tes opérations dans un fichier CSV, à ouvrir avec Excel ou LibreOffice. Ce fichier n\'est pas chiffré et ne se réimporte pas dans Carnet.</p>'+
    '<div class="actions"><button class="btn ghost" data-act="csv">Exporter en CSV</button></div></section>';
  const th=getTheme(), tc=(k,l)=>'<button class="chip" data-themeset="'+k+'" aria-pressed="'+(th===k)+'">'+l+'</button>';
  h+='<section class="card"><h2>Apparence</h2><div class="chips">'+tc("auto","Comme l'appareil")+tc("light","Clair")+tc("dark","Sombre")+'</div></section>';
  return h;
}
function render(){
  if(SEC.locked)return;
  $("#mLabel").textContent=monthLabel(S.month);
  const v=S.tab==="ops"?viewOps():S.tab==="budgets"?viewBudgets():S.tab==="reglages"?viewReglages():viewMois();
  $("#view").innerHTML=v;
  applyStyles($("#view"));
  document.querySelectorAll(".nav button").forEach(b=>b.setAttribute("aria-current",b.dataset.tab===S.tab?"page":"false"));
  $("#storeNote").textContent=SEC.key?"Tes données sont chiffrées sur cet appareil. Pense à les sauvegarder de temps en temps (onglet Réglages).":"Tes données restent sur cet appareil. Pense à les sauvegarder de temps en temps (onglet Réglages).";
}

/* ---------- sheet ---------- */
const PASS={
  set:{title:"Protéger mon carnet",hint:"Choisis au moins "+MIN_PW+" caractères, idéalement une phrase facile à retenir pour toi et difficile à deviner. Attention : si tu l'oublies, tes données seront perdues, personne ne pourra les récupérer. Exporte d'abord une sauvegarde.",neo:1,ok:"Activer le verrouillage"},
  change:{title:"Changer le mot de passe",hint:"Au moins "+MIN_PW+" caractères.",cur:1,neo:1,ok:"Changer"},
  off:{title:"Désactiver le verrouillage",hint:"Tes données seront de nouveau enregistrées en clair dans ce navigateur.",cur:1,ok:"Désactiver"},
  export:{title:"Sauvegarde chiffrée",hint:"Ce mot de passe protège uniquement ce fichier, il te sera demandé pour l'importer. Si tu l'oublies, le fichier sera illisible. Au moins "+MIN_PW+" caractères.",neo:1,newLabel:"Mot de passe du fichier",ok:"Télécharger"},
  import:{title:"Fichier chiffré",hint:"Saisis le mot de passe choisi lors de l'export.",cur:1,curLabel:"Mot de passe du fichier",ok:"Ouvrir"}
};
let SH={mode:"tx",type:"out",cat:"courses",id:null,armed:false};
function drawCats(){
  const box=$("#fCats");
  box.innerHTML=Object.keys(CATS).filter(k=>CATS[k].t===SH.type).map(k=>'<button type="button" class="chip" data-cat="'+k+'" aria-pressed="'+(SH.cat===k)+'"><span class="dot inl" data-bg="'+CATS[k].c+'"></span>'+esc(CATS[k].n)+'</button>').join("");
  applyStyles(box);
}
function setType(t){SH.type=t;document.querySelectorAll("#shType button").forEach(b=>b.setAttribute("aria-pressed",b.dataset.t===t));
  if(cat(SH.cat).t!==t)SH.cat=t==="in"?"salaire":"courses";drawCats();updOk();}
function updOk(){
  if(SH.mode==="budget"){$("#shOk").textContent="Enregistrer";return;}
  if(SH.mode==="goal"){$("#shOk").textContent=SH.id?"Enregistrer":"Ajouter l'objectif";return;}
  if(SH.mode==="pass"){$("#shOk").textContent=PASS[SH.action].ok;return;}
  const w=SH.type==="in"?"la rentrée":"la dépense";
  $("#shOk").textContent=SH.id?"Enregistrer":(SH.mode==="fixed"?"Ajouter ce fixe":"Ajouter "+w);
}
const amtStr=v=>v!=null?String(v).replace(".",","):"";
function clearPass(){["#pCur","#pNew","#pNew2"].forEach(s=>{$(s).value="";});}
function openSheet(o){
  SH=Object.assign({mode:"tx",type:"out",cat:"courses",id:null,armed:false},o);
  const isB=SH.mode==="budget", isG=SH.mode==="goal", isP=SH.mode==="pass", isOp=!isB&&!isG&&!isP;
  $("#shOp").hidden=!isOp;$("#shBudget").hidden=!isB;$("#shGoal").hidden=!isG;$("#shPass").hidden=!isP;$("#shErr").hidden=true;
  $("#shDel").hidden=!(SH.id||(isB&&SH.has));$("#shDel").classList.remove("armed");
  $("#shDel").textContent=isB?"Retirer le plafond":"Supprimer";
  $("#fDateWrap").hidden=SH.mode!=="tx";
  let focus="#fAmount";
  if(isB){$("#shTitle").textContent=cat(SH.cat).n;$("#bHint").textContent="Combien tu t'autorises à dépenser en "+cat(SH.cat).n.toLowerCase()+" chaque mois ?";$("#bAmount").value=SH.has?amtStr(SH.amount):"";focus="#bAmount";}
  else if(isG){
    $("#shTitle").textContent=SH.id?"Modifier l'objectif":"Nouvel objectif";
    $("#gLabel").value=SH.label||"";$("#gTarget").value=amtStr(SH.target);$("#gSaved").value=SH.id?amtStr(SH.saved):"";focus="#gLabel";
  }
  else if(isP){
    const p=PASS[SH.action];clearPass();
    $("#shTitle").textContent=p.title;$("#pHint").textContent=p.hint;
    $("#pCurWrap").hidden=!p.cur;$("#pNewWrap").hidden=!p.neo;$("#pNew2Wrap").hidden=!p.neo;
    $("#pCurLabel").textContent=p.curLabel||"Mot de passe actuel";
    $("#pNewLabel").textContent=p.newLabel||"Nouveau mot de passe";
    focus=p.cur?"#pCur":"#pNew";
  }
  else{
    $("#shTitle").textContent=SH.mode==="fixed"?(SH.id?"Modifier le fixe":"Nouveau fixe mensuel"):(SH.id?"Modifier l'opération":"Nouvelle opération");
    $("#fAmount").value=amtStr(SH.amount);
    $("#fLabel").value=SH.label||"";$("#fDate").value=SH.date||(S.month===thisYm()?todayStr():S.month+"-01");
    setType(SH.type);
  }
  updOk();$("#veil").hidden=false;
  setTimeout(()=>{try{$(focus).focus();}catch(e){}},60);
}
function closeSheet(){$("#veil").hidden=true;clearPass();SH.box=null;}
function showErr(m){const e=$("#shErr");e.textContent=m;e.hidden=false;}
async function submitPass(){
  const p=PASS[SH.action], action=SH.action, box=SH.box, btn=$("#shOk");
  const cur=$("#pCur").value, neo=$("#pNew").value;
  if(btn.disabled)return;
  if(p.cur&&!cur){showErr("Saisis le mot de passe.");return;}
  if(p.neo){
    if(neo.length<MIN_PW){showErr("Il faut au moins "+MIN_PW+" caractères.");return;}
    if(neo!==$("#pNew2").value){showErr("Les deux mots de passe ne sont pas identiques.");return;}
  }
  $("#shErr").hidden=true;setBusy(btn,true);
  try{
    if(action==="import"){
      let d;try{d=(await openBox(box,cur)).data;}catch(e){showErr("Mot de passe incorrect, ou fichier abîmé.");return;}
      closeSheet();await replaceData(d);return;
    }
    if(action==="export"){await exportEncrypted(neo);closeSheet();return;}
    if(p.cur){
      await saveQ;
      const stored=readBox();let ok=false;
      if(stored){try{await openBox(stored,cur);ok=true;}catch(e){}}
      if(!ok){showErr("Mot de passe incorrect.");return;}
    }
    const prev={key:SEC.key,salt:SEC.salt,iter:SEC.iter};
    if(action==="off"){SEC.key=null;SEC.salt=null;}
    else{const salt=randomBytes(16);SEC.key=await deriveKey(neo,salt,KDF_ITER);SEC.salt=salt;SEC.iter=KDF_ITER;}
    if(!await saveLocal()){Object.assign(SEC,prev);return;}
    closeSheet();render();
    toast(action==="off"?"Verrouillage désactivé":action==="set"?"Carnet protégé par mot de passe":"Mot de passe changé");
  }catch(e){showErr("Le chiffrement a échoué. Rien n'a été modifié.");}
  finally{setBusy(btn,false,PASS[action].ok);}
}

$("#sheet").addEventListener("submit",ev=>{
  ev.preventDefault();
  if(SH.mode==="pass"){submitPass();return;}
  if(SH.mode==="budget"){
    const a=parseAmt($("#bAmount").value);
    if(!(a>0)){showErr("Indique un montant supérieur à 0, par exemple 200.");return;}
    S.profile.budgets=Object.assign({},S.profile.budgets,{[SH.cat]:a});api.saveProfile();closeSheet();toast("Plafond enregistré");return;
  }
  if(SH.mode==="goal"){
    const target=parseAmt($("#gTarget").value), rawSaved=$("#gSaved").value.trim(), saved=rawSaved?parseAmt(rawSaved):0;
    const label=cleanLabel($("#gLabel").value);
    if(!label){showErr("Donne un nom à ton objectif.");return;}
    if(!(target>0)){showErr("Indique le montant visé, par exemple 1000.");return;}
    if(!(saved>=0)){showErr("Le montant mis de côté n'est pas valide, par exemple 150,50.");return;}
    const list=(S.profile.goals||[]).slice(), g={id:SH.id||uid(),label,target,saved};
    S.profile.goals=SH.id?list.map(x=>x.id===SH.id?g:x):list.concat([g]);
    api.saveProfile();closeSheet();toast(SH.id?"Objectif modifié":"Objectif ajouté");return;
  }
  const a=parseAmt($("#fAmount").value);
  if(!(a>0)){showErr("Indique un montant valide, par exemple 12,50.");return;}
  const label=cleanLabel($("#fLabel").value);
  if(SH.mode==="fixed"){
    const rec=(S.profile.recurring||[]).slice();
    const prev=rec.find(r=>r.id===SH.id);
    const r={id:SH.id||uid(),type:SH.type,cat:SH.cat,amount:a,label,since:prev?prev.since:thisYm()};
    if(prev&&prev.example)r.example=true;
    S.profile.recurring=prev?rec.map(x=>x.id===SH.id?r:x):rec.concat([r]);
    api.saveProfile();closeSheet();toast(prev?"Fixe modifié":"Fixe ajouté");return;
  }
  const date=$("#fDate").value||todayStr();
  if(!validDate(date)){showErr("Cette date n'est pas valide.");return;}
  const prev=S.tx.find(t=>t.id===SH.id);
  const t={id:SH.id||uid(),type:SH.type,cat:SH.cat,amount:a,label,date,ts:prev?prev.ts:Date.now()};
  if(prev&&prev.example)t.example=true;
  const wasIn=SH.type==="in";
  api.putTx(t);closeSheet();toast(prev?"Opération modifiée":(wasIn?"Rentrée ajoutée":"Dépense ajoutée"));
  if(date.slice(0,7)!==S.month){S.month=date.slice(0,7);render();}
});
$("#shDel").addEventListener("click",()=>{
  const b=$("#shDel");
  if(!SH.armed){SH.armed=true;b.classList.add("armed");b.textContent="Confirmer";return;}
  if(SH.mode==="budget"){const bd=Object.assign({},S.profile.budgets);delete bd[SH.cat];S.profile.budgets=bd;api.saveProfile();toast("Plafond retiré");}
  else if(SH.mode==="fixed"){S.profile.recurring=(S.profile.recurring||[]).filter(r=>r.id!==SH.id);api.saveProfile();toast("Fixe supprimé");}
  else if(SH.mode==="goal"){S.profile.goals=(S.profile.goals||[]).filter(g=>g.id!==SH.id);api.saveProfile();toast("Objectif supprimé");}
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
  const el=e.target.closest("[data-edit],[data-fixed],[data-budget],[data-goal],[data-act],[data-goto],[data-filter],[data-month],[data-themeset]");if(!el)return;
  if(el.dataset.edit){const t=S.tx.find(x=>x.id===el.dataset.edit);if(t)openSheet({mode:"tx",id:t.id,type:t.type,cat:t.cat,amount:t.amount,label:t.label,date:t.date});}
  else if(el.dataset.fixed){const r=(S.profile.recurring||[]).find(x=>x.id===el.dataset.fixed);if(r)openSheet({mode:"fixed",id:r.id,type:r.type,cat:r.cat,amount:r.amount,label:r.label});}
  else if(el.dataset.budget){const k=el.dataset.budget,b=(S.profile.budgets||{})[k];openSheet({mode:"budget",cat:k,has:!!b,amount:b});}
  else if(el.dataset.goal){const g=(S.profile.goals||[]).find(x=>x.id===el.dataset.goal);if(g)openSheet({mode:"goal",id:g.id,label:g.label,target:g.target,saved:g.saved});}
  else if(el.dataset.goto){S.tab=el.dataset.goto;render();scrollTo(0,0);}
  else if(el.dataset.filter){S.filter=el.dataset.filter;render();}
  else if(el.dataset.month){S.month=el.dataset.month;render();}
  else if(el.dataset.themeset){setTheme(el.dataset.themeset);render();}
  else{const a=el.dataset.act;
    if(a==="addSalary")openSheet({mode:"fixed",type:"in",cat:"salaire",label:"Salaire"});
    else if(a==="addAide")openSheet({mode:"fixed",type:"in",cat:"aides",label:"CAF"});
    else if(a==="addRent")openSheet({mode:"fixed",type:"out",cat:"logement",label:"Loyer"});
    else if(a==="addFixed")openSheet({mode:"fixed",type:"out",cat:"abos"});
    else if(a==="addOp")openSheet({mode:"tx"});
    else if(a==="addGoal")openSheet({mode:"goal"});
    else if(a==="example")loadExample();
    else if(a==="clearEx")clearExample();
    else if(a==="export")exportData();
    else if(a==="exportEnc")openSheet({mode:"pass",action:"export"});
    else if(a==="csv")exportCsv();
    else if(a==="import")$("#importFile").click();
    else if(a==="lockNow")saveQ.then(lockNow);
    else if(a==="lockSet")openSheet({mode:"pass",action:"set"});
    else if(a==="lockChange")openSheet({mode:"pass",action:"change"});
    else if(a==="lockOff")openSheet({mode:"pass",action:"off"});
  }
});
$("#view").addEventListener("input",e=>{
  if(e.target.id!=="opsSearch")return;
  S.query=e.target.value;const box=$("#opsList");box.innerHTML=opsBody();applyStyles(box);
});
$("#view").addEventListener("keydown",e=>{if((e.key==="Enter"||e.key===" ")&&e.target.matches("[data-budget],[data-goal]")){e.preventDefault();e.target.click();}});
document.querySelector(".nav").addEventListener("click",e=>{const b=e.target.closest("[data-tab]");if(!b)return;S.tab=b.dataset.tab;render();scrollTo(0,0);});
$("#prevM").addEventListener("click",()=>{S.month=addMonth(S.month,-1);render();});
$("#nextM").addEventListener("click",()=>{S.month=addMonth(S.month,1);render();});
$("#fab").addEventListener("click",()=>openSheet({mode:"tx"}));
let tT;function toast(m){const t=$("#toast");t.textContent=m;t.hidden=false;clearTimeout(tT);tT=setTimeout(()=>{t.hidden=true;},2600);}

$("#importFile").addEventListener("change",e=>{const f=e.target.files&&e.target.files[0];if(f)importData(f);e.target.value="";});

setTheme(getTheme());
loadLocal();S.ready=true;
if(SEC.locked)lockNow();else{showApp();render();}

// Appli installable + hors-ligne (seulement quand le site est servi en http/https)
if("serviceWorker" in navigator&&location.protocol.startsWith("http")){
  window.addEventListener("load",()=>navigator.serviceWorker.register("sw.js").catch(()=>{}));
}
})();

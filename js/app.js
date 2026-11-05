(function(){
"use strict";
// Refuse de s'afficher dans le cadre d'un autre site (anti-clickjacking : GitHub Pages ne permet pas d'envoyer l'en-tête adéquat).
if(window.top!==window.self){document.body.textContent="Carnet ne peut pas s'ouvrir dans le cadre d'un autre site.";return;}
const CATS={
  courses:{n:"Courses",c:"#2F9E6E",t:"out"}, logement:{n:"Logement",c:"#5B6CE0",t:"out"},
  transport:{n:"Transport",c:"#2B8FC2",t:"out"}, sorties:{n:"Restos & sorties",c:"#E0763A",t:"out"},
  shopping:{n:"Shopping",c:"#C64C8E",t:"out"}, sante:{n:"Santé",c:"#D2463B",t:"out"},
  abos:{n:"Abonnements",c:"#8A5BD6",t:"out"}, loisirs:{n:"Loisirs",c:"#C59A16",t:"out"},
  famille:{n:"Famille & cadeaux",c:"#3FA5A0",t:"out"}, epargne:{n:"Épargne",c:"#2E7D8C",t:"out"}, autre:{n:"Autre",c:"#7A8A86",t:"out"},
  salaire:{n:"Salaire",c:"#1D8A57",t:"in"}, aides:{n:"Aides (CAF…)",c:"#2B8FC2",t:"in"}, retrait:{n:"Retrait d'épargne",c:"#2E7D8C",t:"in"}, extra:{n:"Autre rentrée",c:"#7A8A86",t:"in"}
};
// Ne peuvent pas être masquées : l'appli en a besoin.
const KEEP_CATS=["autre","extra","epargne","retrait"];
const CAT_COLORS=["#2F9E6E","#5B6CE0","#2B8FC2","#E0763A","#C64C8E","#D2463B","#8A5BD6","#C59A16","#3FA5A0","#2E7D8C","#7A8A86","#9A6B3F"];
// Mots-clés pour deviner la catégorie d'une dépense (du plus précis au plus général).
const KEYWORDS=[["uber eats","sorties"],["deliveroo","sorties"],["burger king","sorties"],["mcdo","sorties"],["mcdonalds","sorties"],["kfc","sorties"],["kebab","sorties"],["resto","sorties"],["restaurant","sorties"],["bar","sorties"],["cafe","sorties"],
  ["lidl","courses"],["aldi","courses"],["carrefour","courses"],["leclerc","courses"],["auchan","courses"],["intermarche","courses"],["monoprix","courses"],["franprix","courses"],["casino","courses"],["picard","courses"],["boulangerie","courses"],["courses","courses"],["super u","courses"],
  ["essence","transport"],["navigo","transport"],["sncf","transport"],["ratp","transport"],["uber","transport"],["peage","transport"],["parking","transport"],["totalenergies","transport"],
  ["pharmacie","sante"],["medecin","sante"],["docteur","sante"],["dentiste","sante"],["mutuelle","sante"],
  ["netflix","abos"],["spotify","abos"],["disney","abos"],["forfait","abos"],["box","abos"],["amazon prime","abos"],
  ["amazon","shopping"],["zara","shopping"],["decathlon","shopping"],["fnac","shopping"],["cinema","loisirs"],["concert","loisirs"],["cadeau","famille"],
  ["loyer","logement"],["edf","logement"],["engie","logement"],["electricite","logement"]];
const hasOwn=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
// CATS : les catégories de base. S.profile.cats : tes changements et tes catégories. CAT : le résultat des deux.
function buildCats(custom){
  const out={};Object.keys(CATS).forEach(k=>{out[k]=Object.assign({},CATS[k]);});
  Object.keys(custom||{}).forEach(k=>{if(hasOwn(CATS,k))Object.assign(out[k],custom[k]);else out[k]=Object.assign({},custom[k]);});
  return out;
}
let CAT=buildCats();
const isCat=k=>typeof k==="string"&&hasOwn(CAT,k);
const cat=k=>isCat(k)?CAT[k]:CAT.autre;
const catsOf=t=>Object.keys(CAT).filter(k=>CAT[k].t===t&&!CAT[k].hidden);
const firstCat=t=>catsOf(t)[0]||(t==="in"?"extra":"autre");
const refreshCats=()=>{CAT=buildCats(S.profile.cats);};
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
const blankProfile=()=>({recurring:[],budgets:{},goals:[],cats:{},deleted:{}});
// Montant d'un fixe pour un mois donné : les anciens montants restent dans hist.
const amountAt=(r,ym)=>{const h=r.hist&&r.hist.find(x=>ym<=x.until);return h?h.amount:r.amount;};
const monthsBetween=(a,b)=>(+b.slice(0,4)-+a.slice(0,4))*12+(+b.slice(5)-+a.slice(5));

const S={tx:[],profile:blankProfile(),month:thisYm(),tab:"mois",filter:"all",query:"",ready:false,backupHidden:false,catsOpen:false,undo:null,sync:null};

/* ---------- validation des données ---------- */
// Tout ce qui vient d'un fichier ou du stockage est considéré comme non fiable :
// on ne garde que des champs connus, du bon type, dans des limites raisonnables.
const validDate=v=>{
  if(typeof v!=="string"||!/^\d{4}-\d{2}-\d{2}$/.test(v))return false;
  const y=+v.slice(0,4),m=+v.slice(5,7),d=+v.slice(8,10);
  return y>=1900&&y<=2200&&m>=1&&m<=12&&d>=1&&d<=daysIn(v.slice(0,7));
};
const validYm=v=>typeof v==="string"&&/^\d{4}-(0[1-9]|1[0-2])$/.test(v);
const validStamp=v=>typeof v==="number"&&isFinite(v)&&v>0;
const cleanAmt=v=>typeof v==="number"&&isFinite(v)&&v>0&&v<=MAX_AMOUNT?round2(v):null;
const cleanLabel=v=>typeof v==="string"?v.replace(/[\u0000-\u001f\u007f‪-‮⁦-⁩]/g,"").trim().slice(0,60):"";
function cleanCats(src){
  const out={};if(!src||typeof src!=="object")return out;
  Object.keys(src).slice(0,200).forEach(k=>{
    const o=src[k];if(!o||typeof o!=="object")return;
    const name=cleanLabel(o.n).slice(0,30), color=typeof o.c==="string"&&/^#[0-9a-fA-F]{6}$/.test(o.c)?o.c:null;
    if(hasOwn(CATS,k)){
      const e={};if(name)e.n=name;if(color)e.c=color;if(o.hidden===true&&!KEEP_CATS.includes(k))e.hidden=true;
      if(Object.keys(e).length)out[k]=e;
    }else if(/^c_[a-z0-9]{1,32}$/.test(k)&&name&&color&&(o.t==="in"||o.t==="out"))out[k]={n:name,c:color,t:o.t};
  });
  return out;
}
function cleanData(d){
  const seen=new Set();let dropped=0;
  const src=d&&typeof d==="object"?d:{}, p=src.profile&&typeof src.profile==="object"?src.profile:{};
  const cats=cleanCats(p.cats), merged=buildCats(cats);
  const id=v=>{let s=typeof v==="string"&&/^[\w-]{1,64}$/.test(v)?v:uid();while(seen.has(s))s=uid();seen.add(s);return s;};
  const base=o=>{
    if(!o||typeof o!=="object")return null;
    const type=o.type==="in"||o.type==="out"?o.type:null, amount=cleanAmt(o.amount);
    if(!type||amount===null)return null;
    const r={id:id(o.id),type,cat:typeof o.cat==="string"&&hasOwn(merged,o.cat)&&merged[o.cat].t===type?o.cat:(type==="in"?"extra":"autre"),amount,label:cleanLabel(o.label)};
    if(o.example===true)r.example=true;
    if(validStamp(o.upd))r.upd=o.upd;
    return r;
  };
  const list=(a,f)=>{const out=[];(Array.isArray(a)?a.slice(0,MAX_ITEMS):[]).forEach(o=>{const r=f(o);if(r)out.push(r);else dropped++;});return out;};
  const goals=list(p.goals,o=>{
    const target=o&&cleanAmt(o.target);if(!target)return null;
    const saved=o.saved===0?0:cleanAmt(o.saved)||0;
    const g={id:id(o.id),label:cleanLabel(o.label),target,saved};
    if(validYm(o.date))g.date=o.date;
    if(validStamp(o.upd))g.upd=o.upd;
    return g;
  });
  const goalIds=new Set(goals.map(g=>g.id));
  const tx=list(src.tx,o=>{
    if(!o||!validDate(o.date))return null;
    const r=base(o);if(!r)return null;
    r.date=o.date;r.ts=typeof o.ts==="number"&&isFinite(o.ts)?o.ts:0;
    if(goalIds.has(o.goal))r.goal=o.goal;
    return r;
  });
  const recurring=list(p.recurring,o=>{
    const r=base(o);if(!r)return null;
    if(validYm(o.since))r.since=o.since;
    if(validYm(o.until))r.until=o.until;
    if(Number.isInteger(o.day)&&o.day>=1&&o.day<=31)r.day=o.day;
    if(Array.isArray(o.hist)){
      const h=o.hist.slice(0,240).filter(x=>x&&validYm(x.until)&&cleanAmt(x.amount)!==null).map(x=>({until:x.until,amount:cleanAmt(x.amount)})).sort((a,b)=>a.until.localeCompare(b.until));
      if(h.length)r.hist=h;
    }
    return r;
  });
  const budgets={};
  if(p.budgets&&typeof p.budgets==="object")Object.keys(p.budgets).forEach(k=>{
    const a=cleanAmt(p.budgets[k]);if(hasOwn(merged,k)&&merged[k].t==="out"&&a!==null)budgets[k]=a;
  });
  const deleted={};
  if(p.deleted&&typeof p.deleted==="object")Object.keys(p.deleted).slice(0,MAX_ITEMS).forEach(k=>{
    if(k!=="__proto__"&&/^[\w-]{1,64}$/.test(k)&&validStamp(p.deleted[k]))deleted[k]=p.deleted[k];
  });
  const profile={recurring,budgets,goals,cats,deleted};
  if(validDate(p.lastBackup))profile.lastBackup=p.lastBackup;
  if(validStamp(p.budgetsUpd))profile.budgetsUpd=p.budgetsUpd;
  if(validStamp(p.catsUpd))profile.catsUpd=p.catsUpd;
  return {tx,profile,dropped};
}
function applyData(d){const c=cleanData(d);S.tx=c.tx;S.profile=c.profile;refreshCats();return c.dropped;}

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
  syncStamp();
  // La config de synchro (avec le jeton) n'est enregistrée que chiffrée, et jamais dans les exports.
  const key=SEC.key, salt=SEC.salt, iter=SEC.iter;
  const json=key&&S.sync?JSON.stringify({tx:S.tx,profile:S.profile,sync:S.sync}):payload();
  saveQ=saveQ.then(async()=>{
    try{localStorage.setItem(LKEY,key?JSON.stringify(await seal(json,key,salt,iter)):json);return true;}
    catch(e){toast("Impossible d'enregistrer : la mémoire du navigateur est pleine ou bloquée.");return false;}
  });
  if(S.sync&&S.sync.dirty)syncSoon();
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
  S.profile.lastBackup=todayStr();
  const data={app:"carnet",version:3,exportedAt:new Date().toISOString(),tx:S.tx,profile:S.profile};
  download("carnet-sauvegarde-"+todayStr()+".json","application/json",JSON.stringify(data,null,2));
  api.saveProfile();
  toast("Sauvegarde téléchargée");
}
async function exportEncrypted(pw){
  S.profile.lastBackup=todayStr();
  const salt=randomBytes(16),key=await deriveKey(pw,salt,KDF_ITER);
  const box=await seal(payload(),key,salt,KDF_ITER);
  download("carnet-sauvegarde-"+todayStr()+".chiffre.json","application/json",JSON.stringify(box));
  api.saveProfile();
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
  if(!await saveLocal()){S.tx=prevTx;S.profile=prevP;refreshCats();render();return;}
  S.undo=null;render();
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

/* ---------- import d'un relevé bancaire (CSV) ---------- */
function csvDelimiter(text){
  const lines=text.split(/\r?\n/).filter(l=>l.trim()).slice(0,15);
  for(const d of [";","\t"])if(lines.filter(l=>l.includes(d)).length*2>=lines.length)return d;
  return ",";
}
function csvParse(text,d){
  const rows=[];let row=[],cell="",q=false;
  for(let i=0;i<text.length;i++){
    const c=text[i];
    if(q){if(c==='"'){if(text[i+1]==='"'){cell+='"';i++;}else q=false;}else cell+=c;}
    else if(c==='"'&&cell==="")q=true;
    else if(c===d){row.push(cell);cell="";}
    else if(c==="\n"||c==="\r"){
      if(c==="\r"&&text[i+1]==="\n")i++;
      row.push(cell);cell="";if(row.some(x=>x.trim()))rows.push(row);row=[];
      if(rows.length>MAX_ITEMS+100)break;
    }else cell+=c;
  }
  row.push(cell);if(row.some(x=>x.trim()))rows.push(row);
  return rows;
}
function bankDate(s){
  const t=String(s||"").trim().split(/[\sT]/)[0];let m,v=null;
  if((m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(t)))v=t;
  else if((m=/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4}|\d{2})$/.exec(t)))v=(m[3].length===2?"20"+m[3]:m[3])+"-"+pad(+m[2])+"-"+pad(+m[1]);
  return validDate(v)?v:null;
}
// Montant signé : -12,50 / 1 234,56 € / 1.234,56 / 1,234.56 / (12,50) / 12,50-
function bankAmount(s){
  let t=String(s||"").replace(/\s|€|EUR/g,"").replace(/[−–]/g,"-");if(!t)return null;
  let neg=false;
  if(/^\(.*\)$/.test(t)){neg=true;t=t.slice(1,-1);}
  if(/^[+\-]/.test(t)){neg=t[0]==="-";t=t.slice(1);}
  else if(/-$/.test(t)){neg=true;t=t.slice(0,-1);}
  if(!/^\d[\d.,]*$/.test(t))return null;
  const last=Math.max(t.lastIndexOf(","),t.lastIndexOf(".")), both=t.includes(",")&&t.includes(".");
  let v;
  if(last<0)v=t;
  else{
    const dec=t.length-last-1, once=t.indexOf(t[last])===last;
    v=both||(once&&dec<=2)?t.slice(0,last).replace(/[.,]/g,"")+"."+t.slice(last+1):t.replace(/[.,]/g,"");
  }
  const n=parseFloat(v);
  return isFinite(n)&&n<=MAX_AMOUNT?round2(neg?-n:n):null;
}
function csvDetect(rows){
  const isAmt=c=>!bankDate(c)&&bankAmount(c)!==null;
  const first=rows.findIndex(r=>r.length>=2&&r.some(c=>bankDate(c))&&r.some(isAmt));
  if(first<0)return null;
  const data=rows.slice(first).filter(r=>r.length>=2), cols=Math.max(...data.slice(0,50).map(r=>r.length));
  const prev=first>0?rows[first-1]:null, hasHead=!!prev&&prev.length>=2&&!prev.some(c=>bankDate(c)||isAmt(c));
  const names=[];for(let i=0;i<cols;i++)names.push(cleanLabel(hasHead&&prev[i]?prev[i]:"")||"Colonne "+(i+1));
  const find=re=>hasHead?names.findIndex(n=>re.test(norm(n))):-1;
  const sample=data.slice(0,30), score=f=>{const s=[];for(let i=0;i<cols;i++)s.push(sample.filter(r=>f(r[i])).length);return s;};
  let date=find(/date.*(op|compta)/);if(date<0)date=find(/date/);
  if(date<0){const s=score(c=>bankDate(c));date=s.indexOf(Math.max(...s));}
  let label=find(/libell|description|detail|intitul|motif|label|nature/);
  if(label<0){
    const len=[];for(let i=0;i<cols;i++)len.push(i===date?0:sample.reduce((t,r)=>t+(r[i]&&!isAmt(r[i])&&!bankDate(r[i])?r[i].length:0),0));
    label=len.indexOf(Math.max(...len));
  }
  const debit=find(/debit/), credit=find(/credit/);
  let amount=find(/montant|amount|somme/);
  if(amount<0&&debit<0&&credit<0){const s=score(isAmt);s[date]=-1;s[label]=-1;amount=s.indexOf(Math.max(...s));}
  return {rows:data,names,map:{date,label,amount,debit,credit}};
}
const txKey=(date,type,amount,label)=>date+"|"+type+"|"+amount.toFixed(2)+"|"+norm(label);
function csvAnalyse(){
  const c=SH.csv, m=c.map, skipFix=$("#csvSkipFix").checked, res={add:[],bad:0,dup:0,fixed:[]};
  const exist=new Map();S.tx.forEach(t=>{const k=txKey(t.date,t.type,t.amount,t.label);exist.set(k,(exist.get(k)||0)+1);});
  const fixAt={}, fixes=ym=>{
    if(!fixAt[ym]){
      const f=new Map();activeFixes(ym).forEach(r=>{const k=r.type+"|"+r.amount.toFixed(2);f.set(k,(f.get(k)||0)+1);});
      fixAt[ym]=f;
    }
    return fixAt[ym];
  };
  c.rows.forEach(r=>{
    const date=bankDate(r[m.date]);
    let a=null;
    if(m.amount>=0)a=bankAmount(r[m.amount]);
    else{
      const d=m.debit>=0?bankAmount(r[m.debit]):null, cr=m.credit>=0?bankAmount(r[m.credit]):null;
      if(d)a=-Math.abs(d);else if(cr)a=Math.abs(cr);
    }
    if(!date||!a){res.bad++;return;}
    const type=a<0?"out":"in", amount=Math.abs(a), label=cleanLabel(r[m.label]), k=txKey(date,type,amount,label);
    if(exist.get(k)>0){exist.set(k,exist.get(k)-1);res.dup++;return;}
    // Un fixe ne passe qu'une fois par mois : une seule ligne ignorée par fixe.
    const f=fixes(date.slice(0,7)), fk=type+"|"+amount.toFixed(2);
    if(skipFix&&f.get(fk)>0){f.set(fk,f.get(fk)-1);res.fixed.push(label||"Sans libellé");return;}
    res.add.push({date,type,amount,label});
  });
  return res;
}
function csvRefresh(){
  const r=csvAnalyse(), parts=[];
  if(r.dup)parts.push(r.dup+" déjà présente"+(r.dup>1?"s":""));
  if(r.bad)parts.push(r.bad+" illisible"+(r.bad>1?"s":""));
  const nf=r.fixed.length, ignored=nf?" Ignorée"+(nf>1?"s":"")+" car au montant d'un fixe : "+r.fixed.slice(0,5).join(", ")+(nf>5?" et "+(nf-5)+" autre"+(nf>6?"s":""):"")+".":"";
  $("#csvSummary").textContent=r.add.length+" opération"+(r.add.length>1?"s":"")+" à importer"+(parts.length?" · "+parts.join(" · "):"")+"."+ignored;
  $("#csvPreview").innerHTML=r.add.length?r.add.slice(0,5).map(x=>'<div class="line"><span class="w num">'+esc(x.date.slice(8)+"/"+x.date.slice(5,7))+'</span><span class="l">'+esc(x.label||"Sans libellé")+'</span><b class="num">'+(x.type==="in"?"+":"−")+esc(fmt(x.amount))+'</b></div>').join(""):'<div class="empty">Aucune opération à importer avec ces réglages.</div>';
  const ok=$("#shOk");ok.disabled=!r.add.length;ok.textContent=r.add.length?"Importer "+r.add.length+" opération"+(r.add.length>1?"s":""):"Rien à importer";
}
function csvFill(){
  const c=SH.csv, opts=(none)=>(none?'<option value="-1">—</option>':"")+c.names.map((n,i)=>'<option value="'+i+'">'+esc(n)+'</option>').join("");
  [["#csvDate","date",0],["#csvLabel","label",0],["#csvAmount","amount",1],["#csvDebit","debit",1],["#csvCredit","credit",1]].forEach(x=>{
    const el=$(x[0]);el.innerHTML=opts(x[2]);el.value=String(c.map[x[1]]);
  });
}
function csvCommit(){
  const r=csvAnalyse();
  if(!r.add.length)return;
  if(S.tx.length+r.add.length>MAX_ITEMS){showErr("Ton carnet deviendrait trop gros avec ce fichier.");return;}
  const stats=labelStats(), t0=Date.now();
  const list=r.add.map((x,i)=>({id:uid(),type:x.type,cat:guessCat(x.label,x.type,stats)||(x.type==="in"?"extra":"autre"),amount:x.amount,label:x.label,date:x.date,ts:t0+i}));
  const prev=S.tx;
  S.tx=S.tx.concat(list);
  saveLocal().then(ok=>{
    if(!ok){S.tx=prev;render();return;}
    S.undo=list.map(t=>t.id);
    S.month=list.reduce((m,t)=>t.date>m?t.date:m,"").slice(0,7);
    closeSheet();render();
    toast(list.length+" opération"+(list.length>1?"s importées":" importée")+". Tu peux annuler dans Réglages.");
  });
}
function importCsv(file){
  if(file.size>MAX_FILE){toast("Ce fichier est trop gros.");return;}
  const fr=new FileReader();
  fr.onerror=()=>toast("Impossible de lire ce fichier.");
  fr.onload=()=>{
    // Beaucoup de banques françaises exportent encore en Windows-1252, pas en UTF-8.
    let text;try{text=new TextDecoder("utf-8",{fatal:true}).decode(fr.result);}catch(e){text=new TextDecoder("windows-1252").decode(fr.result);}
    const found=csvDetect(csvParse(text,csvDelimiter(text)));
    if(!found){toast("Je ne reconnais pas de dates et de montants dans ce fichier.");return;}
    openSheet({mode:"csv",csv:found});
  };
  fr.readAsArrayBuffer(file);
}

/* ---------- synchro (dépôt GitHub privé) ---------- */
// Le dépôt ne reçoit qu'un fichier chiffré sur l'appareil, avec une clé qui n'en sort jamais.
// Chaque élément porte sa date de modification (upd), et les suppressions sont notées (profile.deleted) :
// à la fusion, le plus récent gagne, élément par élément.
const SYNC_API="https://api.github.com", SYNC_FILE="carnet.enc.json", SYNC_MIN_PW=12, SYNC_POLL=120000, SYNC_DEBOUNCE=4000, TOMB_KEEP=400*864e5;
const SY={base:null,key:null,timer:null,running:false,again:false,gen:0,edits:0,msg:"",err:false};
const syncE=code=>Object.assign(new Error(code),{code});
const SYNC_MSG={auth:"GitHub refuse ce jeton : il est incorrect ou expiré. Crée-en un nouveau.",forbidden:"Ce jeton n'a pas le droit d'écrire dans ce dépôt, ou GitHub limite les requêtes pour le moment.",repo:"Dépôt introuvable. Vérifie son nom, et que le jeton y a bien accès.",public:"Ce dépôt est public. Pour tes données, il doit être privé.",network:"Pas de connexion. Carnet réessaiera tout seul.",key:"Impossible de déchiffrer le fichier du dépôt : la phrase de synchro ne correspond pas. Rien n'a été modifié.",size:"Le fichier du dépôt est trop gros ou invalide. Rien n'a été modifié.",other:"GitHub a renvoyé une erreur. Carnet réessaiera tout seul."};
const syncMessage=e=>SYNC_MSG[e&&e.code]||SYNC_MSG.other;
function cleanSync(o){
  if(!o||typeof o!=="object"||!validRepo(o.repo)||!validToken(o.token)||typeof o.key!=="string"||typeof o.salt!=="string"||!Number.isInteger(o.iter))return null;
  return {repo:o.repo,token:o.token,key:o.key,salt:o.salt,iter:o.iter,sha:typeof o.sha==="string"?o.sha:null,dirty:o.dirty===true,at:validStamp(o.at)?o.at:0};
}
const validRepo=v=>typeof v==="string"&&/^[\w-][\w.-]{0,99}\/[\w-][\w.-]{0,99}$/.test(v);
const validToken=v=>typeof v==="string"&&/^[A-Za-z0-9_]{20,255}$/.test(v);
const normRepo=v=>String(v).trim().replace(/^https?:\/\/github\.com\//i,"").replace(/\.git$/i,"").replace(/\/+$/,"");
async function gh(cfg,path,opt,accept){
  try{
    return await fetch(SYNC_API+"/repos/"+cfg.repo+path,Object.assign({cache:"no-store",credentials:"omit",redirect:"error",
      headers:{Accept:accept||"application/vnd.github+json",Authorization:"Bearer "+cfg.token}},opt||{}));
  }catch(e){throw syncE("network");}
}
function ghStatus(res){
  if(res.status===401)throw syncE("auth");
  if(res.status===403||res.status===429)throw syncE("forbidden");
  if(res.status===404)throw syncE("repo");
  if(!res.ok)throw syncE("other");
}
async function ghRepo(cfg){
  const res=await gh(cfg,"");ghStatus(res);
  const j=await res.json();
  if(!j||j.private!==true)throw syncE("public");
}
async function ghGet(cfg){
  const res=await gh(cfg,"/contents/"+SYNC_FILE);
  if(res.status===404)return null;
  ghStatus(res);
  const j=await res.json();
  if(!j||typeof j.sha!=="string"||j.size>MAX_FILE)throw syncE("size");
  let text;
  if(j.encoding==="base64"&&j.content)text=new TextDecoder().decode(fromB64(j.content.replace(/\s/g,"")));
  else{const raw=await gh(cfg,"/contents/"+SYNC_FILE,null,"application/vnd.github.raw+json");ghStatus(raw);text=await raw.text();}
  let box;try{box=JSON.parse(text);}catch(e){throw syncE("size");}
  if(!isBox(box))throw syncE("size");
  return {sha:j.sha,box};
}
// Renvoie la nouvelle version, ou null si un autre appareil a écrit entre-temps.
async function ghPut(cfg,box,sha){
  const body={message:"Mise à jour chiffrée",content:toB64(new TextEncoder().encode(JSON.stringify(box)))};
  if(sha)body.sha=sha;
  const res=await gh(cfg,"/contents/"+SYNC_FILE,{method:"PUT",body:JSON.stringify(body)});
  if(res.status===409||res.status===422)return null;
  ghStatus(res);
  const j=await res.json();
  if(!j||!j.content||typeof j.content.sha!=="string")throw syncE("other");
  return j.content.sha;
}
async function deriveRaw(pw,salt,iter){
  const base=await crypto.subtle.importKey("raw",new TextEncoder().encode(pw.normalize("NFKC")),"PBKDF2",false,["deriveBits"]);
  return crypto.subtle.deriveBits({name:"PBKDF2",hash:"SHA-256",salt,iterations:iter},base,256);
}
const rawKey=raw=>crypto.subtle.importKey("raw",raw,{name:"AES-GCM"},false,["encrypt","decrypt"]);
async function syncKey(){if(!SY.key)SY.key=await rawKey(fromB64(S.sync.key));return SY.key;}
const itemJson=o=>{const c=Object.assign({},o);delete c.upd;return JSON.stringify(c);};
const syncLists=()=>[S.tx,S.profile.recurring||[],S.profile.goals||[]];
function syncSnapshot(){
  const items=new Map();
  syncLists().forEach(l=>l.forEach(o=>items.set(o.id,{j:itemJson(o),upd:o.upd})));
  SY.base={items,budgets:JSON.stringify(S.profile.budgets||{}),cats:JSON.stringify(S.profile.cats||{})};
}
// Compare à la dernière photo : ce qui a changé reçoit une date, ce qui a disparu est noté comme supprimé.
function syncStamp(){
  if(!S.sync||!SY.base)return;
  const t=Date.now(), seen=new Set(), b=SY.base;let changed=false;
  syncLists().forEach(l=>l.forEach(o=>{
    seen.add(o.id);
    const old=b.items.get(o.id), j=itemJson(o);
    if(!old||old.j!==j){o.upd=t;b.items.set(o.id,{j,upd:t});changed=true;}
    else if(old.upd!==undefined)o.upd=old.upd;
  }));
  const gone=[];b.items.forEach((v,id)=>{if(!seen.has(id))gone.push(id);});
  if(gone.length){
    const del=Object.assign({},S.profile.deleted);
    gone.forEach(id=>{if(id!=="__proto__")del[id]=t;b.items.delete(id);});
    S.profile.deleted=del;changed=true;
  }
  const bj=JSON.stringify(S.profile.budgets||{}), cj=JSON.stringify(S.profile.cats||{});
  if(bj!==b.budgets){b.budgets=bj;S.profile.budgetsUpd=t;changed=true;}
  if(cj!==b.cats){b.cats=cj;S.profile.catsUpd=t;changed=true;}
  if(changed){S.sync.dirty=true;SY.edits++;}
}
function syncMerge(a,b){
  const newer=(x,c)=>(x.upd||0)>(c.upd||0)||((x.upd||0)===(c.upd||0)&&JSON.stringify(x)>JSON.stringify(c));
  const cut=Date.now()-TOMB_KEEP, del={};
  [a.profile.deleted,b.profile.deleted].forEach(d=>Object.keys(d||{}).forEach(k=>{if(k!=="__proto__"&&d[k]>=cut&&(!hasOwn(del,k)||d[k]>del[k]))del[k]=d[k];}));
  const items=(la,lb)=>{
    const m=new Map();la.forEach(x=>m.set(x.id,x));
    lb.forEach(x=>{const c=m.get(x.id);if(!c||newer(x,c))m.set(x.id,x);});
    return Array.from(m.values()).filter(x=>!(hasOwn(del,x.id)&&del[x.id]>=(x.upd||0)));
  };
  const pa=a.profile, pb=b.profile, bFirst=(pb.budgetsUpd||0)>(pa.budgetsUpd||0), cFirst=(pb.catsUpd||0)>(pa.catsUpd||0);
  const profile={recurring:items(pa.recurring,pb.recurring),goals:items(pa.goals,pb.goals),
    budgets:bFirst?pb.budgets:pa.budgets,cats:cFirst?pb.cats:pa.cats,deleted:del};
  const bu=Math.max(pa.budgetsUpd||0,pb.budgetsUpd||0), cu=Math.max(pa.catsUpd||0,pb.catsUpd||0);
  if(bu)profile.budgetsUpd=bu;if(cu)profile.catsUpd=cu;
  const lb=[pa.lastBackup,pb.lastBackup].filter(Boolean).sort().pop();if(lb)profile.lastBackup=lb;
  return {tx:items(a.tx,b.tx),profile};
}
// Forme comparable d'un état, quel que soit l'ordre des éléments.
function syncCanon(st){
  const c=cleanData(st), byId=(x,y)=>x.id<y.id?-1:1, sorted=o=>Object.keys(o).sort().map(k=>[k,o[k]]);
  c.tx.sort(byId);c.profile.recurring.sort(byId);c.profile.goals.sort(byId);
  const p=c.profile;
  return JSON.stringify([c.tx,p.recurring,p.goals,sorted(p.budgets),sorted(p.cats),sorted(p.deleted),p.lastBackup||"",p.budgetsUpd||0,p.catsUpd||0]);
}
function syncState(msg,err){
  SY.msg=msg;SY.err=!!err;
  const el=$("#syncState");if(el)el.textContent=syncStateText();
}
function syncStateText(){
  if(SY.msg)return SY.msg;
  const at=S.sync&&S.sync.at;
  return at?"À jour. Dernier échange : "+new Date(at).toLocaleString("fr-FR",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"})+".":"En attente du premier échange.";
}
function syncRefreshView(){
  const box=$("#opsList");
  if(box&&document.activeElement===$("#opsSearch")){box.innerHTML=opsBody();applyStyles(box);}
  else render();
}
function syncSoon(){clearTimeout(SY.timer);SY.timer=setTimeout(syncRun,SYNC_DEBOUNCE);}
function syncReset(){clearTimeout(SY.timer);SY.gen++;SY.base=null;SY.key=null;SY.msg="";SY.err=false;SY.again=false;}
async function syncRun(){
  if(!S.sync||SEC.locked)return;
  if(SY.running){SY.again=true;return;}
  SY.running=true;
  const gen=SY.gen, cfg=S.sync, stale=()=>gen!==SY.gen||S.sync!==cfg;
  try{
    for(let attempt=0;attempt<4;attempt++){
      const remote=await ghGet(cfg);if(stale())return;
      if(remote&&remote.sha===cfg.sha&&!cfg.dirty){syncState("",false);return;}
      const key=await syncKey();
      let data=null;
      // Si le déchiffrement échoue, on s'arrête : surtout ne pas écraser le fichier du dépôt.
      if(remote){let o;try{o=await unseal(remote.box,key);}catch(e){throw syncE("key");}const c=cleanData(o);data={tx:c.tx,profile:c.profile};}
      if(stale())return;
      const cur={tx:S.tx,profile:S.profile}, merged=data?syncMerge(cur,data):cur, canon=syncCanon(merged);
      if(canon!==syncCanon(cur)){
        const c=cleanData(merged);S.tx=c.tx;S.profile=c.profile;refreshCats();syncSnapshot();syncRefreshView();
      }
      const edits=SY.edits;
      let sha=remote?remote.sha:null;
      if(!data||canon!==syncCanon(data)){
        const box=await seal(JSON.stringify({tx:S.tx,profile:S.profile}),key,fromB64(cfg.salt),cfg.iter);
        sha=await ghPut(cfg,box,sha);if(stale())return;
        if(!sha)continue; // un autre appareil vient d'écrire : on recommence avec sa version
      }
      cfg.sha=sha;cfg.at=Date.now();if(edits===SY.edits)cfg.dirty=false;
      SY.msg="";SY.err=false;
      saveLocal();syncState("",false);
      if(cfg.dirty)SY.again=true;
      return;
    }
    throw syncE("other");
  }catch(e){
    if(stale())return;
    if(e&&e.code==="network")syncState(SYNC_MSG.network,false);
    else{syncState(syncMessage(e),e&&!["other"].includes(e.code));if(S.tab==="mois")render();}
  }finally{
    SY.running=false;
    if(SY.again){SY.again=false;syncSoon();}
  }
}
function syncStart(){if(S.sync){syncSnapshot();syncRun();}}
async function submitSync(){
  const btn=$("#shOk"), tokenOnly=SH.action==="token";
  if(btn.disabled)return;
  const repo=tokenOnly?S.sync.repo:normRepo($("#sRepo").value), token=$("#sToken").value.trim(), pass=$("#sPass").value, label=btn.textContent;
  if(!validRepo(repo)){showErr("Indique le dépôt sous la forme pseudo/nom-du-depot.");return;}
  if(!validToken(token)){showErr("Ce jeton ne ressemble pas à un jeton GitHub. Copie-le en entier.");return;}
  if(!tokenOnly&&pass.length<SYNC_MIN_PW){showErr("Il faut au moins "+SYNC_MIN_PW+" caractères pour la phrase de synchro.");return;}
  $("#shErr").hidden=true;setBusy(btn,true);
  try{
    const cfg={repo,token};
    await ghRepo(cfg);
    if(tokenOnly){
      S.sync.token=token;SY.msg="";SY.err=false;await saveLocal();closeSheet();render();toast("Jeton mis à jour");syncRun();return;
    }
    const remote=await ghGet(cfg);
    let salt,iter,raw;
    if(remote){
      salt=fromB64(remote.box.salt);iter=remote.box.iter;raw=await deriveRaw(pass,salt,iter);
      try{await unseal(remote.box,await rawKey(raw));}catch(e){showErr("Cette phrase ne correspond pas à celle déjà utilisée pour ce dépôt.");return;}
    }else{
      const w=$("#sPass2Wrap");
      if(w.hidden){w.hidden=false;showErr("Ce dépôt est vide : c'est ton premier appareil. Répète ta phrase pour la confirmer. Il te la faudra sur tes autres appareils, et elle ne peut pas être récupérée.");return;}
      if($("#sPass2").value!==pass){showErr("Les deux phrases ne sont pas identiques.");return;}
      salt=randomBytes(16);iter=KDF_ITER;raw=await deriveRaw(pass,salt,iter);
    }
    S.sync={repo,token,key:toB64(raw),salt:toB64(salt),iter,sha:null,dirty:true,at:0};
    SY.key=null;SY.msg="";SY.err=false;syncSnapshot();
    if(!await saveLocal()){S.sync=null;syncReset();return;}
    closeSheet();render();toast("Synchro activée");syncRun();
  }catch(e){showErr(syncMessage(e));}
  finally{setBusy(btn,false,label);}
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
  syncReset();
  S.tx=[];S.profile=blankProfile();S.query="";S.undo=null;S.sync=null;refreshCats();
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
  else{idleCheck();hiddenAt=0;syncRun();}
});
setInterval(idleCheck,15000);
setInterval(()=>{if(!document.hidden)syncRun();},SYNC_POLL);
window.addEventListener("online",()=>syncRun());
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
    applyData(o.data);S.sync=cleanSync(o.data&&o.data.sync);lastAct=Date.now();hiddenAt=0;
    resetLockForm();showApp();render();syncStart();
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
    if(SEC.key){try{const o=await unseal(d,SEC.key);applyData(o);S.sync=cleanSync(o&&o.sync);SY.key=null;if(S.sync)syncSnapshot();render();return;}catch(err){}}
    if(!SEC.locked)lockNow();
    return;
  }
  SEC.key=null;SEC.salt=null;
  if(SEC.locked){SEC.locked=false;resetLockForm();showApp();}
  applyData(d);render();
});

/* ---------- maths ---------- */
// Les fixes qui comptent pour ce mois-là, avec le montant de l'époque.
function activeFixes(ym){
  return (S.profile.recurring||[]).filter(r=>(!r.since||r.since<=ym)&&(!r.until||ym<=r.until)).map(r=>Object.assign({},r,{amount:amountAt(r,ym)}));
}
function compute(ym){
  const txs=S.tx.filter(t=>t.date&&t.date.slice(0,7)===ym);
  const rec=activeFixes(ym);
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

function backupBanner(){
  if(S.backupHidden)return "";
  const real=S.tx.filter(t=>!t.example&&t.ts>0);
  if(!real.length)return "";
  const last=S.profile.lastBackup, ref=last?new Date(last+"T00:00:00").getTime():real.reduce((m,t)=>Math.min(m,t.ts),Infinity);
  if(Date.now()-ref<=30*864e5)return "";
  return '<div class="banner"><span>'+(last?'Ta dernière sauvegarde date de plus de 30 jours.':'Tu n\'as encore jamais sauvegardé tes données.')+'</span><span class="split"><button class="link" data-goto="reglages">Sauvegarder</button><button class="link" data-act="hideBackup">Plus tard</button></span></div>';
}
function viewUpcoming(c){
  if(!c.cur)return "";
  const dated=c.rec.filter(r=>r.day);
  if(!dated.length)return "";
  const due=r=>Math.min(r.day,c.dim);
  const next=dated.filter(r=>due(r)>=c.day).sort((a,b)=>due(a)-due(b));
  const left=sum(next.filter(r=>r.type==="out"));
  const hint=!next.length?"Tous tes fixes datés sont passés ce mois-ci.":left>0?fmt(left)+" de fixes restent à payer. Ils sont déjà déduits de ton reste à vivre.":"Aucun prélèvement à venir, seulement des rentrées.";
  return '<section class="card"><h2>À venir ce mois-ci</h2><p class="hint pull">'+esc(hint)+'</p>'+(next.length?'<div class="lines">'+next.map(r=>{
    const d=due(r);
    return '<div class="line"><span class="w num">'+(d===c.day?"aujourd'hui":"le "+d)+'</span><span class="l">'+esc(r.label||cat(r.cat).n)+'</span><b class="num">'+(r.type==="in"?"+":"−")+esc(fmt(r.amount))+'</b></div>';
  }).join("")+'</div>':'')+'</section>';
}
function viewCompare(c){
  if(!c.cur&&!c.past)return "";
  const limit=c.cur?c.day:32, pm=addMonth(S.month,-1);
  const spend=ym=>S.tx.filter(t=>t.type==="out"&&t.cat!=="epargne"&&t.date.slice(0,7)===ym&&+t.date.slice(8)<=limit);
  const a=spend(S.month), b=spend(pm);
  if(!a.length||!b.length)return "";
  const group=l=>{const o={};l.forEach(t=>{o[t.cat]=(o[t.cat]||0)+t.amount;});return o;};
  const ga=group(a), gb=group(b), keys=Array.from(new Set(Object.keys(ga).concat(Object.keys(gb))));
  const moves=keys.map(k=>({k,d:(ga[k]||0)-(gb[k]||0)})).filter(x=>Math.abs(x.d)>=1).sort((x,y)=>Math.abs(y.d)-Math.abs(x.d)).slice(0,3);
  const diff=sum(a)-sum(b), ref=c.cur?"que le mois dernier à la même date":"que le mois précédent";
  const head=Math.abs(diff)<1?"Autant de dépenses "+ref+".":"<b>"+esc(fmt0(Math.abs(diff)))+" de "+(diff>0?"plus":"moins")+"</b> dépensés "+esc(ref)+".";
  return '<section class="card"><h2>Ton bilan du mois</h2><p class="hint pull">'+head+'</p>'+(moves.length?'<div class="lines">'+moves.map(x=>
    '<div class="line"><span class="w '+(x.d>0?"delta-up":"delta-down")+'">'+(x.d>0?"▲ plus":"▼ moins")+'</span><span class="l">'+esc(cat(x.k).n)+'</span><b class="num">'+esc(fmt(Math.abs(x.d)))+'</b></div>').join("")+'</div>':'')+'</section>';
}
function goalTotal(g){return Math.max(0,round2(g.saved+S.tx.reduce((s,t)=>t.goal===g.id?s+(t.type==="out"?t.amount:-t.amount):s,0)));}
function goalHint(g,total){
  if(total>=g.target)return "Objectif atteint.";
  const left=g.target-total, base="Encore "+fmt(left);
  if(!g.date)return base+".";
  const n=monthsBetween(thisYm(),g.date)+1;
  if(n<=0)return base+". La date cible est dépassée.";
  return base+", soit "+fmt(Math.ceil(left/n*100)/100)+" par mois jusqu'à "+monthLabel(g.date)+".";
}
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
  let h=(S.sync&&SY.err?'<div class="banner"><span>Synchro en panne : '+esc(SY.msg)+'</span><button class="link" data-goto="reglages">Voir</button></div>':'')+backupBanner()+exampleBanner();
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
  h+=viewUpcoming(c);
  const cats=Object.keys(c.byCat).sort((a,b)=>c.byCat[b]-c.byCat[a]);
  if(cats.length){
    const max=Math.max.apply(null,cats.map(k=>c.byCat[k]));
    h+='<section class="card"><h2>Où part ton argent</h2><p class="hint pull">Dépenses du mois, hors charges fixes</p><div class="bars">'+
      cats.slice(0,6).map(k=>{const b=S.profile.budgets&&S.profile.budgets[k];const v=c.byCat[k];
        return '<div class="bar"><span class="name"><span class="dot" data-bg="'+cat(k).c+'"></span>'+esc(cat(k).n)+'</span><span class="amt num">'+fmt(v)+(b?' <small>/ '+fmt0(b)+'</small>':'')+'</span>'+
          '<span class="track"><i data-w="'+(v/max*100)+'" data-bg="'+cat(k).c+'"></i></span></div>';}).join("")+'</div></section>';
  }
  h+=viewCompare(c)+viewTrend();
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
  const outCats=catsOf("out").filter(k=>k!=="logement"&&k!=="epargne");
  let h=exampleBanner();
  h+='<section class="card"><div class="row"><h2>Plafonds par catégorie</h2></div><p class="hint pull">Touche une catégorie pour fixer combien tu t\'autorises par mois.</p><div class="bars">'+
    outCats.map(k=>{const b=+(S.profile.budgets||{})[k]||0, v=c.byCat[k]||0;
      let st="",col=cat(k).c,w=0;
      if(b){const f=v/b;w=Math.min(100,f*100);st=f>1?'<span class="pill bad">Dépassé</span>':f>.8?'<span class="pill warn">Bientôt atteint</span>':'';col=f>1?"var(--bad)":f>.8?"var(--warn)":"var(--ok)";}
      return '<div class="bar tap" role="button" tabindex="0" data-budget="'+k+'"><span class="name"><span class="dot" data-bg="'+cat(k).c+'"></span>'+esc(cat(k).n)+' '+st+'</span>'+
        '<span class="amt num">'+fmt(v)+' <small>'+(b?'/ '+fmt0(b):'· sans plafond')+'</small></span>'+(b?'<span class="track"><i data-w="'+w+'" data-bg="'+col+'"></i></span>':'')+'</div>';}).join("")+'</div></section>';
  const goals=S.profile.goals||[];
  h+='<section class="card"><div class="row"><h2>Objectifs d\'épargne</h2><button class="link" data-act="addGoal">+ Ajouter</button></div>'+
    (goals.length?'<div class="bars">'+goals.map(g=>{const total=goalTotal(g),f=Math.min(1,total/g.target),done=total>=g.target;
      return '<div class="goal"><div class="bar tap" role="button" tabindex="0" data-goal="'+esc(g.id)+'"><span class="name">'+esc(g.label||"Objectif")+(done?' <span class="pill ok">Atteint</span>':'')+'</span>'+
        '<span class="amt num">'+fmt(total)+' <small>/ '+fmt0(g.target)+'</small></span><span class="track"><i data-w="'+(f*100)+'" data-bg="var(--accent)"></i></span></div>'+
        '<p class="hint">'+esc(goalHint(g,total))+'</p><div class="split"><button class="link" data-move="'+esc(g.id)+'" data-dir="out">Verser</button>'+(total>0?'<button class="link" data-move="'+esc(g.id)+'" data-dir="in">Retirer</button>':'')+'</div></div>';}).join("")+'</div>'
      :'<p class="hint pull">Vacances, permis, matelas de sécurité… Chaque versement est déduit de ton reste à vivre.</p>')+'</section>';
  const all=(S.profile.recurring||[]).slice().sort((a,b)=>(a.type===b.type?b.amount-a.amount:a.type==="in"?-1:1));
  const rec=all.filter(r=>!r.until), stopped=all.filter(r=>r.until);
  h+='<section class="stack"><div class="row"><h2 class="sec-h">Fixes chaque mois</h2><button class="link" data-act="addFixed">+ Ajouter</button></div>'+
    '<p class="hint">Salaire, loyer, forfait, assurance, crédit… Ils sont comptés automatiquement tous les mois.</p>'+
    (rec.length?'<div class="ledger">'+rec.map(r=>{const k=cat(r.cat);return '<button class="op" data-fixed="'+esc(r.id)+'"><span class="ic" data-bg="'+k.c+'">'+esc(k.n.charAt(0))+'</span><span class="t"><b>'+esc(r.label||k.n)+(r.example?'<span class="tag">exemple</span>':'')+'</b><span>'+esc(k.n)+' · '+(r.day?'le '+r.day+' du mois':'chaque mois')+'</span></span><span class="m num'+(r.type==="in"?" in":"")+'">'+(r.type==="in"?"+":"−")+fmt(+r.amount)+'</span></button>';}).join("")+'</div>'
      :'<div class="ledger"><div class="empty">Aucun fixe pour l\'instant.</div></div>')+
    (rec.length?'<div class="row tight"><span class="hint">Total fixe sortant</span><b class="num">'+fmt(sum(rec.filter(r=>r.type==="out")))+'</b></div>':'')+
    (stopped.length?'<div class="day">Fixes arrêtés</div><div class="ledger">'+stopped.map(r=>{const k=cat(r.cat);return '<button class="op" data-fixed="'+esc(r.id)+'"><span class="ic" data-bg="'+k.c+'">'+esc(k.n.charAt(0))+'</span><span class="t"><b>'+esc(r.label||k.n)+'</b><span>Compté jusqu\'en '+esc(monthLabel(r.until))+'</span></span><span class="m num">'+fmt(+amountAt(r,r.until))+'</span></button>';}).join("")+'</div>':'')+'</section>';
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
  h+='<section class="card"><h2>Synchronisation</h2>';
  if(S.sync)h+='<p class="hint pull"><span class="state">Activée</span> avec <b>'+esc(S.sync.repo)+'</b>. Tes appareils échangent tout seuls un fichier chiffré sur ton appareil : GitHub ne peut pas le lire.</p><p class="hint" id="syncState" role="status">'+esc(syncStateText())+'</p>'+
    '<div class="actions"><button class="btn" data-act="syncNow">Synchroniser maintenant</button><button class="btn ghost" data-act="syncToken">Changer le jeton</button><button class="btn ghost" data-act="syncOff">Désactiver</button></div>';
  else if(!on)h+='<p class="hint pull">Retrouve ton carnet sur tous tes appareils, avec un dépôt GitHub privé. Active d\'abord le verrouillage ci-dessus : c\'est lui qui protège ton jeton GitHub sur cet appareil.</p>';
  else h+='<p class="hint pull">Retrouve ton carnet sur tous tes appareils, avec un dépôt GitHub privé. Tes données sont chiffrées avant l\'envoi : GitHub ne peut pas les lire.</p><div class="actions"><button class="btn" data-act="syncSetup">Configurer la synchro</button></div>';
  h+='</section>';
  const lb=S.profile.lastBackup;
  h+='<section class="card"><h2>Sauvegarde</h2><p class="hint pull"><span class="state">'+(lb?'Dernière sauvegarde : '+esc(lb.slice(8)+"/"+lb.slice(5,7)+"/"+lb.slice(0,4))+'.':'Aucune sauvegarde pour l\'instant.')+'</span> '+(S.sync?'Garde une copie même avec la synchro : une erreur ou une suppression se propage à tous tes appareils.':'Tes données sont gardées sur cet appareil uniquement. Exporte-les de temps en temps, et importe le fichier sur un autre appareil pour les retrouver.')+' Choisis le fichier chiffré si tu le ranges sur un cloud ou l\'envoies par mail.</p>'+
    '<div class="actions">'+(canCrypto?'<button class="btn" data-act="exportEnc">Exporter (chiffré)</button>':'')+'<button class="btn ghost" data-act="export">Exporter (non chiffré)</button><button class="btn ghost" data-act="import">Importer un fichier</button></div></section>';
  h+='<section class="card"><h2>Relevé bancaire</h2><p class="hint pull">Télécharge le relevé CSV sur le site de ta banque, puis importe-le ici. Les opérations déjà présentes ne sont pas ajoutées en double. Celles que tu as notées à la main avec un autre libellé ne peuvent pas être reconnues.</p>'+
    '<div class="actions"><button class="btn ghost" data-act="csvImport">Importer un relevé</button>'+(S.undo?'<button class="btn danger" data-act="undoImport">Annuler le dernier import ('+S.undo.length+')</button>':'')+'</div></section>';
  h+='<section class="card"><h2>Tableur</h2><p class="hint pull">Récupère tes opérations dans un fichier CSV, à ouvrir avec Excel ou LibreOffice. Ce fichier n\'est pas chiffré.</p>'+
    '<div class="actions"><button class="btn ghost" data-act="csv">Exporter en CSV</button></div></section>';
  const catKeys=Object.keys(CAT);
  h+='<section class="card"><div class="row"><h2>Catégories</h2><button class="link" data-act="addCat">+ Ajouter</button></div>'+
    '<details'+(S.catsOpen?' open':'')+'><summary>Renommer, changer la couleur ou masquer ('+catKeys.length+')</summary><div class="catlist">'+
    catKeys.map(k=>'<button class="catrow" data-catedit="'+esc(k)+'"><span class="dot" data-bg="'+esc(CAT[k].c)+'"></span><span>'+esc(CAT[k].n)+'</span><small>'+(CAT[k].hidden?'Masquée':CAT[k].t==="in"?'Rentrée':'Dépense')+'</small></button>').join("")+
    '</div></details></section>';
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
  $("#storeNote").textContent=S.sync?"Tes données sont chiffrées et synchronisées avec ton dépôt privé.":SEC.key?"Tes données sont chiffrées sur cet appareil. Pense à les sauvegarder de temps en temps (onglet Réglages).":"Tes données restent sur cet appareil. Pense à les sauvegarder de temps en temps (onglet Réglages).";
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
  box.innerHTML=Object.keys(CAT).filter(k=>CAT[k].t===SH.type&&(!CAT[k].hidden||k===SH.cat)).map(k=>'<button type="button" class="chip" data-cat="'+esc(k)+'" aria-pressed="'+(SH.cat===k)+'"><span class="dot inl" data-bg="'+esc(CAT[k].c)+'"></span>'+esc(CAT[k].n)+'</button>').join("");
  applyStyles(box);
}
function setType(t){SH.type=t;document.querySelectorAll("#shType button").forEach(b=>b.setAttribute("aria-pressed",b.dataset.t===t));
  if(cat(SH.cat).t!==t)SH.cat=firstCat(t);drawCats();drawSug();updOk();}
// Libellés déjà utilisés, pour proposer un ajout en un geste.
function labelStats(){
  const m=new Map();
  S.tx.forEach(t=>{
    if(!t.label||t.example||t.goal)return;
    const k=t.type+"|"+norm(t.label), e=m.get(k)||{label:t.label,cat:t.cat,type:t.type,n:0,ts:-1};
    e.n++;if(t.ts>=e.ts){e.ts=t.ts;e.cat=t.cat;e.label=t.label;}
    m.set(k,e);
  });
  return Array.from(m.values());
}
function guessCat(label,type,stats){
  const n=norm(label.trim());if(!n)return null;
  const usable=k=>isCat(k)&&CAT[k].t===type&&!CAT[k].hidden?k:null;
  const known=stats.find(e=>e.type===type&&norm(e.label)===n);
  if(known&&usable(known.cat))return known.cat;
  if(type!=="out")return null;
  const w=" "+n.replace(/[^a-z0-9]+/g," ")+" ", kw=KEYWORDS.find(x=>w.includes(" "+x[0]+" "));
  return kw?usable(kw[1]):null;
}
function drawSug(){
  const box=$("#fSug");
  if(SH.mode!=="tx"||SH.id){box.textContent="";box.hidden=true;return;}
  const q=norm($("#fLabel").value.trim());
  SH.sug=(SH.stats||[]).filter(e=>e.type===SH.type&&norm(e.label)!==q&&(!q||norm(e.label).includes(q))).sort((a,b)=>b.n-a.n||b.ts-a.ts).slice(0,4);
  box.innerHTML=SH.sug.map((e,i)=>'<button type="button" class="chip" data-sug="'+i+'">'+esc(e.label)+'</button>').join("");
  box.hidden=!SH.sug.length;
}
function drawColors(){
  const box=$("#cColors");
  box.innerHTML=CAT_COLORS.map(c=>'<button type="button" class="swatch" data-color="'+c+'" data-bg="'+c+'" aria-label="Couleur '+c+'" aria-pressed="'+(SH.color===c)+'"></button>').join("");
  applyStyles(box);
}
function setCatType(t){SH.type=t;document.querySelectorAll("#cType button").forEach(b=>b.setAttribute("aria-pressed",b.dataset.ct===t));}
function setMoveDir(d){
  SH.dir=d;document.querySelectorAll("#mDir button").forEach(b=>b.setAttribute("aria-pressed",b.dataset.m===d));
  $("#mHint").textContent=d==="out"?"Ce versement compte comme une dépense du mois : il baisse ton reste à vivre.":"Ce retrait compte comme une rentrée du mois : il augmente ton reste à vivre.";
  $("#shOk").textContent=d==="out"?"Verser":"Retirer";
}
const fixStoppable=r=>!!r&&!r.until&&!r.example&&(!r.since||r.since<thisYm());
function updOk(){
  if(SH.mode==="budget"){$("#shOk").textContent="Enregistrer";return;}
  if(SH.mode==="goal"){$("#shOk").textContent=SH.id?"Enregistrer":"Ajouter l'objectif";return;}
  if(SH.mode==="cat"){$("#shOk").textContent=SH.id?"Enregistrer":"Créer la catégorie";return;}
  if(SH.mode==="move"||SH.mode==="csv")return;
  if(SH.mode==="sync"){$("#shOk").textContent=SH.action==="token"?"Enregistrer":"Activer la synchro";return;}
  if(SH.mode==="pass"){$("#shOk").textContent=PASS[SH.action].ok;return;}
  const w=SH.type==="in"?"la rentrée":"la dépense";
  $("#shOk").textContent=SH.id?"Enregistrer":(SH.mode==="fixed"?"Ajouter ce fixe":"Ajouter "+w);
}
const amtStr=v=>v!=null?String(v).replace(".",","):"";
function clearPass(){["#pCur","#pNew","#pNew2"].forEach(s=>{$(s).value="";});}
function openSheet(o){
  SH=Object.assign({mode:"tx",type:"out",cat:firstCat("out"),id:null,armed:false,catTouched:false},o);
  const isB=SH.mode==="budget", isG=SH.mode==="goal", isP=SH.mode==="pass", isM=SH.mode==="move", isC=SH.mode==="cat", isCsv=SH.mode==="csv", isS=SH.mode==="sync", isOp=!isB&&!isG&&!isP&&!isM&&!isC&&!isCsv&&!isS;
  $("#shSync").hidden=!isS;
  $("#shOp").hidden=!isOp;$("#shBudget").hidden=!isB;$("#shGoal").hidden=!isG;$("#shPass").hidden=!isP;$("#shMove").hidden=!isM;$("#shCat").hidden=!isC;$("#shCsv").hidden=!isCsv;$("#shErr").hidden=true;
  $("#shDel").hidden=!(SH.id||(isB&&SH.has));$("#shDel").classList.remove("armed");
  $("#shDel").textContent=isB?"Retirer le plafond":"Supprimer";
  $("#shOk").hidden=false;$("#shOk").disabled=false;
  $("#fDateWrap").hidden=SH.mode!=="tx";$("#fDayWrap").hidden=SH.mode!=="fixed";
  let focus="#fAmount";
  if(isB){$("#shTitle").textContent=cat(SH.cat).n;$("#bHint").textContent="Combien tu t'autorises à dépenser en "+cat(SH.cat).n.toLowerCase()+" chaque mois ?";$("#bAmount").value=SH.has?amtStr(SH.amount):"";focus="#bAmount";}
  else if(isG){
    $("#shTitle").textContent=SH.id?"Modifier l'objectif":"Nouvel objectif";
    $("#gLabel").value=SH.label||"";$("#gTarget").value=amtStr(SH.target);$("#gSaved").value=SH.id?amtStr(SH.saved):"";$("#gDate").value=SH.date||"";focus="#gLabel";
  }
  else if(isM){
    const g=(S.profile.goals||[]).find(x=>x.id===SH.goal);
    $("#shTitle").textContent=g?g.label||"Objectif":"Objectif";$("#mAmount").value="";setMoveDir(SH.dir||"out");focus="#mAmount";
  }
  else if(isC){
    const k=SH.id, e=k?CAT[k]:null, builtin=!!k&&hasOwn(CATS,k);
    $("#shTitle").textContent=k?"Modifier la catégorie":"Nouvelle catégorie";
    $("#cType").hidden=!!k;$("#cName").value=e?e.n:"";
    SH.color=e?e.c:CAT_COLORS[0];drawColors();
    setCatType(e?e.t:(SH.type||"out"));
    $("#shDel").hidden=!k||(builtin&&(KEEP_CATS.includes(k)||!!e.hidden));
    $("#shDel").textContent=builtin?"Masquer":"Supprimer";
    const note=!k?"":builtin&&e.hidden?"Cette catégorie est masquée. Enregistre pour la réafficher.":builtin?"Masquer la retire des choix, tes opérations existantes la gardent.":"Si tu la supprimes, ses opérations passent dans « Autre ».";
    $("#cHint").textContent=note;$("#cHint").hidden=!note;
    focus="#cName";
  }
  else if(isS){
    const t=SH.action==="token";
    $("#shTitle").textContent=t?"Changer le jeton":"Configurer la synchro";
    $("#sHint").textContent=t?"Colle le nouveau jeton GitHub. Il a besoin d'accéder à ce seul dépôt, avec le droit « Contents » en lecture et écriture.":"Il te faut un dépôt GitHub privé et un jeton limité à ce dépôt, avec le droit « Contents » en lecture et écriture. La phrase de synchro chiffre tes données : choisis-en une d'au moins "+SYNC_MIN_PW+" caractères, la même sur tous tes appareils.";
    $("#sRepoWrap").hidden=t;$("#sPassWrap").hidden=t;$("#sPass2Wrap").hidden=true;
    $("#sRepo").value=t?S.sync.repo:"";$("#sToken").value="";$("#sPass").value="";$("#sPass2").value="";
    focus=t?"#sToken":"#sRepo";
  }
  else if(isCsv){
    $("#shTitle").textContent="Importer un relevé";$("#csvSkipFix").checked=true;
    csvFill();csvRefresh();focus="#csvDate";
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
    $("#fDay").value=SH.day||"";
    SH.stats=SH.mode==="tx"&&!SH.id?labelStats():[];
    setType(SH.type);
    const fx=$("#fFixHint");let note="";
    if(SH.mode==="fixed"&&SH.id){
      const r=(S.profile.recurring||[]).find(x=>x.id===SH.id);
      if(r&&r.until){
        note="Ce fixe ne compte plus depuis "+monthLabel(addMonth(r.until,1))+". Pour le reprendre, crée un nouveau fixe. Le supprimer le retire aussi des mois passés.";
        $("#shOk").hidden=true;$("#shDel").textContent="Supprimer définitivement";
      }else if(fixStoppable(r)){
        note="Un nouveau montant compte à partir de ce mois-ci, les mois passés ne changent pas. Arrêter ce fixe fonctionne pareil.";
        $("#shDel").textContent="Arrêter ce fixe";
      }
    }
    fx.textContent=note;fx.hidden=!note;
  }
  updOk();$("#veil").hidden=false;
  setTimeout(()=>{try{$(focus).focus();}catch(e){}},60);
}
function closeSheet(){$("#veil").hidden=true;clearPass();["#sToken","#sPass","#sPass2"].forEach(s=>{$(s).value="";});SH.box=null;SH.csv=null;SH.stats=null;}
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
  if(SH.mode==="sync"){submitSync();return;}
  if(SH.mode==="csv"){csvCommit();return;}
  if(SH.mode==="cat"){
    const name=cleanLabel($("#cName").value).slice(0,30);
    if(!name){showErr("Donne un nom à ta catégorie.");return;}
    const cats=Object.assign({},S.profile.cats), k=SH.id;
    if(k&&hasOwn(CATS,k))cats[k]={n:name,c:SH.color};
    else if(k)cats[k]={n:name,c:SH.color,t:CAT[k].t};
    else cats["c_"+uid()]={n:name,c:SH.color,t:SH.type};
    S.profile.cats=cats;S.catsOpen=true;refreshCats();api.saveProfile();closeSheet();toast(k?"Catégorie modifiée":"Catégorie créée");return;
  }
  if(SH.mode==="move"){
    const g=(S.profile.goals||[]).find(x=>x.id===SH.goal), a=parseAmt($("#mAmount").value);
    if(!g){closeSheet();return;}
    if(!(a>0)){showErr("Indique un montant valide, par exemple 50.");return;}
    if(SH.dir==="in"&&a>goalTotal(g)){showErr("Tu ne peux pas retirer plus que "+fmt(goalTotal(g))+".");return;}
    const isOut=SH.dir==="out";
    api.putTx({id:uid(),type:SH.dir,cat:isOut?"epargne":"retrait",amount:a,label:g.label,date:todayStr(),ts:Date.now(),goal:g.id});
    closeSheet();toast(fmt(a)+(isOut?" versés":" retirés"));return;
  }
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
    const dateRaw=$("#gDate").value.trim();
    if(dateRaw&&!validYm(dateRaw)){showErr("Indique la date cible sous la forme 2027-06.");return;}
    const list=(S.profile.goals||[]).slice(), g={id:SH.id||uid(),label,target,saved};
    if(dateRaw)g.date=dateRaw;
    S.profile.goals=SH.id?list.map(x=>x.id===SH.id?g:x):list.concat([g]);
    api.saveProfile();closeSheet();toast(SH.id?"Objectif modifié":"Objectif ajouté");return;
  }
  const a=parseAmt($("#fAmount").value);
  if(!(a>0)){showErr("Indique un montant valide, par exemple 12,50.");return;}
  const label=cleanLabel($("#fLabel").value);
  if(SH.mode==="fixed"){
    const rec=(S.profile.recurring||[]).slice();
    const prev=rec.find(r=>r.id===SH.id);
    const dayRaw=$("#fDay").value.trim(), day=dayRaw?+dayRaw:null;
    if(dayRaw&&(!Number.isInteger(day)||day<1||day>31)){showErr("Le jour doit être entre 1 et 31.");return;}
    const r={id:SH.id||uid(),type:SH.type,cat:SH.cat,amount:a,label,since:prev?prev.since:thisYm()};
    if(day)r.day=day;
    if(prev&&prev.example)r.example=true;
    if(prev&&prev.hist)r.hist=prev.hist.slice();
    // Le nouveau montant compte à partir de ce mois-ci : on garde l'ancien pour les mois passés.
    if(prev&&prev.amount!==a&&(!prev.since||prev.since<thisYm())){
      const u=addMonth(thisYm(),-1);r.hist=r.hist||[];
      if(!r.hist.some(h=>h.until===u))r.hist.push({until:u,amount:prev.amount});
    }
    S.profile.recurring=prev?rec.map(x=>x.id===SH.id?r:x):rec.concat([r]);
    api.saveProfile();closeSheet();toast(prev?"Fixe modifié":"Fixe ajouté");return;
  }
  const date=$("#fDate").value||todayStr();
  if(!validDate(date)){showErr("Cette date n'est pas valide.");return;}
  const prev=S.tx.find(t=>t.id===SH.id);
  const t={id:SH.id||uid(),type:SH.type,cat:SH.cat,amount:a,label,date,ts:prev?prev.ts:Date.now()};
  if(prev&&prev.example)t.example=true;
  if(prev&&prev.goal)t.goal=prev.goal;
  const wasIn=SH.type==="in";
  api.putTx(t);closeSheet();toast(prev?"Opération modifiée":(wasIn?"Rentrée ajoutée":"Dépense ajoutée"));
  if(date.slice(0,7)!==S.month){S.month=date.slice(0,7);render();}
});
$("#shDel").addEventListener("click",()=>{
  const b=$("#shDel");
  if(!SH.armed){SH.armed=true;b.classList.add("armed");b.textContent="Confirmer";return;}
  if(SH.mode==="budget"){const bd=Object.assign({},S.profile.budgets);delete bd[SH.cat];S.profile.budgets=bd;api.saveProfile();toast("Plafond retiré");}
  else if(SH.mode==="fixed"){
    const r=(S.profile.recurring||[]).find(x=>x.id===SH.id);
    if(fixStoppable(r)){
      const until=addMonth(thisYm(),-1);
      S.profile.recurring=S.profile.recurring.map(x=>x.id===SH.id?Object.assign({},x,{until}):x);
      api.saveProfile();toast("Fixe arrêté. Les mois passés ne changent pas.");
    }else{
      S.profile.recurring=(S.profile.recurring||[]).filter(x=>x.id!==SH.id);api.saveProfile();toast("Fixe supprimé");
    }
  }
  else if(SH.mode==="goal"){
    S.tx.forEach(t=>{if(t.goal===SH.id)delete t.goal;});
    S.profile.goals=(S.profile.goals||[]).filter(g=>g.id!==SH.id);api.saveProfile();toast("Objectif supprimé. Ses versements restent dans tes opérations.");
  }
  else if(SH.mode==="cat"){
    const k=SH.id, cats=Object.assign({},S.profile.cats);S.catsOpen=true;
    if(hasOwn(CATS,k)){cats[k]=Object.assign({},cats[k],{hidden:true});S.profile.cats=cats;refreshCats();api.saveProfile();toast("Catégorie masquée");}
    else{
      const fallback=CAT[k].t==="in"?"extra":"autre";
      S.tx=S.tx.map(t=>t.cat===k?Object.assign({},t,{cat:fallback}):t);
      S.profile.recurring=(S.profile.recurring||[]).map(r=>r.cat===k?Object.assign({},r,{cat:fallback}):r);
      const bd=Object.assign({},S.profile.budgets);delete bd[k];S.profile.budgets=bd;
      delete cats[k];S.profile.cats=cats;refreshCats();api.saveProfile();toast("Catégorie supprimée");
    }
  }
  else{api.delTx(SH.id);toast("Opération supprimée");}
  closeSheet();
});
$("#shType").addEventListener("click",e=>{const b=e.target.closest("button[data-t]");if(b)setType(b.dataset.t);});
$("#fCats").addEventListener("click",e=>{const b=e.target.closest("[data-cat]");if(!b)return;SH.cat=b.dataset.cat;SH.catTouched=true;drawCats();});
$("#fLabel").addEventListener("input",()=>{
  drawSug();
  if(SH.mode!=="tx"||SH.id||SH.catTouched)return;
  const g=guessCat($("#fLabel").value,SH.type,SH.stats||[]);
  if(g&&g!==SH.cat){SH.cat=g;drawCats();}
});
$("#fSug").addEventListener("click",e=>{
  const b=e.target.closest("[data-sug]");if(!b)return;
  const s=SH.sug[+b.dataset.sug];if(!s)return;
  $("#fLabel").value=s.label;if(isCat(s.cat)&&cat(s.cat).t===SH.type){SH.cat=s.cat;SH.catTouched=true;drawCats();}
  drawSug();$("#fAmount").focus();
});
$("#mDir").addEventListener("click",e=>{const b=e.target.closest("[data-m]");if(b)setMoveDir(b.dataset.m);});
$("#cType").addEventListener("click",e=>{const b=e.target.closest("[data-ct]");if(b)setCatType(b.dataset.ct);});
$("#cColors").addEventListener("click",e=>{const b=e.target.closest("[data-color]");if(!b)return;SH.color=b.dataset.color;drawColors();});
$("#shCsv").addEventListener("change",e=>{
  if(!SH.csv)return;
  if(e.target.dataset.k)SH.csv.map[e.target.dataset.k]=+e.target.value;
  csvRefresh();
});
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
  const el=e.target.closest("[data-edit],[data-fixed],[data-budget],[data-goal],[data-move],[data-catedit],[data-act],[data-goto],[data-filter],[data-month],[data-themeset]");if(!el)return;
  if(el.dataset.edit){const t=S.tx.find(x=>x.id===el.dataset.edit);if(t)openSheet({mode:"tx",id:t.id,type:t.type,cat:t.cat,amount:t.amount,label:t.label,date:t.date});}
  else if(el.dataset.fixed){const r=(S.profile.recurring||[]).find(x=>x.id===el.dataset.fixed);if(r)openSheet({mode:"fixed",id:r.id,type:r.type,cat:r.cat,amount:r.amount,label:r.label,day:r.day});}
  else if(el.dataset.budget){const k=el.dataset.budget,b=(S.profile.budgets||{})[k];openSheet({mode:"budget",cat:k,has:!!b,amount:b});}
  else if(el.dataset.goal){const g=(S.profile.goals||[]).find(x=>x.id===el.dataset.goal);if(g)openSheet({mode:"goal",id:g.id,label:g.label,target:g.target,saved:g.saved,date:g.date});}
  else if(el.dataset.move)openSheet({mode:"move",goal:el.dataset.move,dir:el.dataset.dir});
  else if(el.dataset.catedit){if(isCat(el.dataset.catedit))openSheet({mode:"cat",id:el.dataset.catedit});}
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
    else if(a==="csvImport")$("#csvFile").click();
    else if(a==="undoImport"){
      const ids=new Set(S.undo||[]), n=ids.size;
      S.tx=S.tx.filter(t=>!ids.has(t.id));S.undo=null;saveLocal();render();
      toast(n+" opération"+(n>1?"s retirées":" retirée"));
    }
    else if(a==="hideBackup"){S.backupHidden=true;render();}
    else if(a==="addCat")openSheet({mode:"cat",type:"out"});
    else if(a==="import")$("#importFile").click();
    else if(a==="lockNow")saveQ.then(lockNow);
    else if(a==="lockSet")openSheet({mode:"pass",action:"set"});
    else if(a==="lockChange")openSheet({mode:"pass",action:"change"});
    else if(a==="lockOff"){
      if(S.sync)toast("Désactive d'abord la synchro : ton jeton GitHub doit rester chiffré.");
      else openSheet({mode:"pass",action:"off"});
    }
    else if(a==="syncSetup")openSheet({mode:"sync",action:"setup"});
    else if(a==="syncToken")openSheet({mode:"sync",action:"token"});
    else if(a==="syncNow"){syncState("Synchronisation…",false);syncRun();}
    else if(a==="syncOff"){
      if(!confirm("Désactiver la synchro sur cet appareil ? Tes données y restent. Le fichier chiffré reste sur GitHub, et le jeton reste valable tant que tu ne le supprimes pas sur GitHub."))return;
      S.sync=null;syncReset();saveLocal();render();toast("Synchro désactivée");
    }
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
$("#csvFile").addEventListener("change",e=>{const f=e.target.files&&e.target.files[0];if(f)importCsv(f);e.target.value="";});

setTheme(getTheme());
loadLocal();S.ready=true;
if(SEC.locked)lockNow();else{showApp();render();}

// Appli installable + hors-ligne (seulement quand le site est servi en http/https)
if("serviceWorker" in navigator&&location.protocol.startsWith("http")){
  window.addEventListener("load",()=>navigator.serviceWorker.register("sw.js").catch(()=>{}));
}
})();

'use strict';
const KAT=['Übernachtung','Bewirtung','Parken/Maut','ÖPNV/Bahn','Material','Telefon/Internet','Sonstiges'];
const DEF={kmRate:0.30,vma8:14,vmaAnAb:14,vma24:28};
let db,S={...DEF},tab='uebersicht';
const $=s=>document.querySelector(s),eur=n=>(+n||0).toLocaleString('de-DE',{style:'currency',currency:'EUR'}),
num=v=>parseFloat(String(v).replace(',','.'))||0,esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])),
today=()=>new Date().toISOString().slice(0,10),fd=d=>d?d.split('-').reverse().join('.'):'';
function openDB(){return new Promise((ok,er)=>{const r=indexedDB.open('fahrtkosten',1);r.onupgradeneeded=()=>{const d=r.result;['fahrten','spesen','meta'].forEach(n=>d.createObjectStore(n,{keyPath:'id'}))};r.onsuccess=()=>ok(r.result);r.onerror=()=>er(r.error)})}
const tx=(s,m,f)=>new Promise((ok,er)=>{const t=db.transaction(s,m),q=f(t.objectStore(s));t.oncomplete=()=>ok(q&&q.result);t.onerror=()=>er(t.error)});
const all=s=>tx(s,'readonly',o=>o.getAll()),put=(s,v)=>tx(s,'readwrite',o=>o.put(v)),del=(s,id)=>tx(s,'readwrite',o=>o.delete(id)),clr=s=>tx(s,'readwrite',o=>o.clear());
const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,7);
const vmaVal=v=>({'8h':S.vma8,'anab':S.vmaAnAb,'24h':S.vma24}[v]||0);
const fBetrag=f=>f.km*(f.hinrueck?2:1)*S.kmRate;
const vat=s=>{const b=num(s.brutto),n=b/(1+s.ust/100);return{netto:n,ust:b-n}};
const deduct=s=>s.kat==='Bewirtung'?num(s.brutto)*0.7:num(s.brutto);
const DISC='<p class="hint">Hinweis: Keine Steuerberatung. Pauschalen/Sätze Stand 2026 (Kilometerpauschale 0,30 €/km, Verpflegungsmehraufwand 14 €/28 €) – bitte mit Steuerberater:in prüfen. Bewirtung: nur 70 % als Betriebsausgabe abziehbar; Vorsteuer i. d. R. voll.</p>';
async function loadS(){const m=await all('meta');const s=m.find(x=>x.id==='settings');if(s)S={...DEF,...s.v}}
function render(){document.querySelectorAll('nav button').forEach(b=>b.classList.toggle('on',b.dataset.t===tab));V[tab]()}
document.querySelectorAll('nav button').forEach(b=>b.onclick=()=>{tab=b.dataset.t;render();scrollTo(0,0)});
function fileToJpeg(file){return new Promise((ok,er)=>{const img=new Image();img.onload=()=>{const m=1400,k=Math.min(1,m/Math.max(img.width,img.height)),c=document.createElement('canvas');c.width=img.width*k;c.height=img.height*k;c.getContext('2d').drawImage(img,0,0,c.width,c.height);c.toBlob(b=>{URL.revokeObjectURL(img.src);ok(b)},'image/jpeg',0.7)};img.onerror=er;img.src=URL.createObjectURL(file)})}
const V={};
V.fahrten=async()=>{const L=(await all('fahrten')).sort((a,b)=>b.datum.localeCompare(a.datum));
$('#v').innerHTML=`<div class="card"><b>Neue Fahrt</b><form id="f"><div class="row"><div><label>Datum</label><input type="date" name="datum" value="${today()}" required></div><div><label>km (einfach)</label><input name="km" inputmode="decimal" required></div></div>
<label>Start</label><input name="start"><label>Ziel</label><input name="ziel"><label>Zweck / Kunde</label><input name="zweck">
<label class="chk"><input type="checkbox" name="hinrueck" checked> Hin- und Rückfahrt (km ×2)</label><label>Fahrzeug (Notiz)</label><input name="fz" value="${esc(localStorage.lastFz||'')}">
<label>Verpflegungsmehraufwand</label><select name="vma"><option value="">keiner</option><option value="8h">&gt;8 h abwesend (${eur(S.vma8)})</option><option value="anab">An-/Abreisetag (${eur(S.vmaAnAb)})</option><option value="24h">24 h abwesend (${eur(S.vma24)})</option></select>
<p class="sm" id="pv"></p><button>Speichern</button></form></div>
<div class="card"><b>Fahrten (${L.length})</b>${L.map(f=>`<div class="item"><div><b>${fd(f.datum)}</b> ${esc(f.start)} → ${esc(f.ziel)}<div class="sm">${esc(f.zweck)} · ${f.km} km${f.hinrueck?' ×2':''}${f.fz?' · '+esc(f.fz):''}${f.vma?' · VMA '+eur(vmaVal(f.vma)):''}</div></div><div><div class="amt">${eur(fBetrag(f)+vmaVal(f.vma))}</div><button class="del" data-id="${f.id}">Löschen</button></div></div>`).join('')||'<p class="sm">Noch keine Fahrten.</p>'}</div>`;
const fm=$('#f'),pv=()=>{const km=num(fm.km.value)*(fm.hinrueck.checked?2:1);$('#pv').textContent=`${km} km × ${eur(S.kmRate)} = ${eur(km*S.kmRate)}`+(fm.vma.value?` + VMA ${eur(vmaVal(fm.vma.value))}`:'')};fm.oninput=pv;pv();
fm.onsubmit=async e=>{e.preventDefault();const d=Object.fromEntries(new FormData(fm));localStorage.lastFz=d.fz;await put('fahrten',{id:uid(),datum:d.datum,start:d.start,ziel:d.ziel,zweck:d.zweck,km:num(d.km),hinrueck:fm.hinrueck.checked,fz:d.fz,vma:d.vma});render()};
document.querySelectorAll('.del').forEach(b=>b.onclick=async()=>{if(confirm('Fahrt löschen?')){await del('fahrten',b.dataset.id);render()}})};
V.spesen=async()=>{const L=(await all('spesen')).sort((a,b)=>b.datum.localeCompare(a.datum));
$('#v').innerHTML=`<div class="card"><b>Neuer Beleg</b><form id="f"><div class="row"><div><label>Datum</label><input type="date" name="datum" value="${today()}" required></div><div><label>Betrag brutto €</label><input name="brutto" inputmode="decimal" required></div></div>
<div class="row"><div><label>Kategorie</label><select name="kat">${KAT.map(k=>`<option>${k}</option>`).join('')}</select></div><div><label>USt.</label><select name="ust"><option value="19">19 %</option><option value="7">7 %</option><option value="0">0 %</option></select></div></div>
<p class="sm" id="pv"></p><label>Beschreibung</label><input name="beschr">
<div id="bew" class="hide"><label>Anlass</label><input name="anlass"><label>Teilnehmer</label><textarea name="teiln" rows="2"></textarea><p class="hint">Bewirtung: 70 % als Betriebsausgabe abziehbar.</p></div>
<label>Beleg-Foto</label><input type="file" name="foto" accept="image/*" capture="environment"><button>Speichern</button></form></div>
<div class="card"><b>Belege (${L.length})</b>${L.map(s=>`<div class="item">${s.foto?`<img class="th" data-id="${s.id}">`:''}<div style="flex:1"><b>${fd(s.datum)}</b> ${esc(s.kat)}<div class="sm">${esc(s.beschr)}${s.anlass?' · Anlass: '+esc(s.anlass):''}${s.teiln?' · Teiln.: '+esc(s.teiln):''}<br>netto ${eur(vat(s).netto)} + USt ${s.ust} % ${eur(vat(s).ust)}</div></div><div><div class="amt">${eur(s.brutto)}</div><button class="del" data-id="${s.id}">Löschen</button></div></div>`).join('')||'<p class="sm">Noch keine Belege.</p>'}</div>`;
const fm=$('#f'),pv=()=>{const v=vat({brutto:fm.brutto.value,ust:+fm.ust.value});$('#pv').textContent=`Netto ${eur(v.netto)} · USt ${eur(v.ust)}`;$('#bew').classList.toggle('hide',fm.kat.value!=='Bewirtung')};fm.oninput=pv;pv();
fm.onsubmit=async e=>{e.preventDefault();const d=Object.fromEntries(new FormData(fm)),f=fm.foto.files[0];let foto=null;if(f)foto=await fileToJpeg(f);
await put('spesen',{id:uid(),datum:d.datum,kat:d.kat,brutto:num(d.brutto),ust:+d.ust,beschr:d.beschr,anlass:d.kat==='Bewirtung'?d.anlass:'',teiln:d.kat==='Bewirtung'?d.teiln:'',foto});render()};
L.forEach(s=>{if(s.foto){const i=document.querySelector(`img[data-id="${s.id}"]`);i.src=URL.createObjectURL(s.foto);i.onclick=()=>open(i.src)}});
document.querySelectorAll('.del').forEach(b=>b.onclick=async()=>{if(confirm('Beleg löschen?')){await del('spesen',b.dataset.id);render()}})};
async function sums(from,to){const F=(await all('fahrten')).filter(f=>f.datum>=from&&f.datum<=to),Sp=(await all('spesen')).filter(s=>s.datum>=from&&s.datum<=to);
const t={'Fahrtkosten':0,'Verpflegungsmehraufwand':0};KAT.forEach(k=>t[k]=0);let km=0,ust=0,abz=0;
F.forEach(f=>{t.Fahrtkosten+=fBetrag(f);t.Verpflegungsmehraufwand+=vmaVal(f.vma);km+=f.km*(f.hinrueck?2:1)});
Sp.forEach(s=>{t[s.kat]+=num(s.brutto);ust+=vat(s).ust;abz+=deduct(s)-num(s.brutto)});
const g=Object.values(t).reduce((a,b)=>a+b,0);return{F,Sp,t,km,ust,g,abz:g+abz}}
function range(p,y,m){return p==='m'?[`${y}-${m}-01`,`${y}-${m}-31`]:[`${y}-01-01`,`${y}-12-31`]}
V.uebersicht=async()=>{const n=new Date(),y=sessionStorage.y||n.getFullYear(),m=sessionStorage.m||String(n.getMonth()+1).padStart(2,'0'),p=sessionStorage.p||'m';
const r=await sums(...range(p,y,m));
$('#v').innerHTML=`<div class="card"><div class="row"><select id="p"><option value="m">Monat</option><option value="y">Jahr</option></select><select id="m" ${p==='y'?'disabled':''}>${[...Array(12)].map((_,i)=>{const v=String(i+1).padStart(2,'0');return`<option value="${v}">${new Date(2026,i).toLocaleString('de-DE',{month:'long'})}</option>`}).join('')}</select><input id="y" type="number" value="${y}"></div></div>
<div class="card"><div class="sm">Summe (brutto)</div><div class="tot">${eur(r.g)}</div><div class="sm">${r.F.length} Fahrten · ${r.km} km · ${r.Sp.length} Belege · enth. USt ${eur(r.ust)}<br>Abziehbar (Bewirtung 70 %): ${eur(r.abz)}</div></div>
<div class="card"><table>${Object.entries(r.t).map(([k,v])=>`<tr><td>${k}</td><td class="r">${eur(v)}</td></tr>`).join('')}</table></div>${DISC}`;
$('#p').value=p;$('#m').value=m;$('#p').onchange=e=>{sessionStorage.p=e.target.value;render()};$('#m').onchange=e=>{sessionStorage.m=e.target.value;render()};$('#y').onchange=e=>{sessionStorage.y=e.target.value;render()}};
function dl(name,data,type){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([data],{type}));a.download=name;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},1000)}
const b64=b=>new Promise(ok=>{const r=new FileReader();r.onload=()=>ok(r.result);r.readAsDataURL(b)});
V.export=()=>{const y=new Date().getFullYear();
$('#v').innerHTML=`<div class="card"><b>Zeitraum</b><div class="row"><div><label>Von</label><input type="date" id="von" value="${y}-01-01"></div><div><label>Bis</label><input type="date" id="bis" value="${y}-12-31"></div></div>
<button id="csv">CSV exportieren</button> <button id="pr" class="sec">Bericht drucken / PDF</button><p class="hint">Im Druckdialog „Als PDF sichern“ wählen (iPhone: Teilen → Drucken → Aufziehen).</p></div>
<div class="card"><b>Datensicherung</b><br><button id="bk">JSON-Backup herunterladen</button><label>Backup wiederherstellen (ersetzt alle Daten)</label><input type="file" id="rs" accept="application/json,.json"></div>${DISC}`;
const per=()=>[$('#von').value,$('#bis').value];
$('#csv').onclick=async()=>{const r=await sums(...per()),q=v=>'"'+String(v??'').replace(/"/g,'""')+'"',d=n=>(+n).toFixed(2).replace('.',',');
const rows=[['Typ','Datum','Kategorie','Beschreibung/Zweck','Start','Ziel','km','Brutto','USt-Satz','Netto','USt','Abziehbar','Anlass','Teilnehmer','Fahrzeug']];
r.F.sort((a,b)=>a.datum.localeCompare(b.datum)).forEach(f=>{const km=f.km*(f.hinrueck?2:1);rows.push(['Fahrt',fd(f.datum),'Fahrtkosten',f.zweck,f.start,f.ziel,d(km),d(fBetrag(f)),'','','',d(fBetrag(f)),'','',f.fz]);if(f.vma)rows.push(['VMA',fd(f.datum),'Verpflegungsmehraufwand',{'8h':'>8 h','anab':'An-/Abreisetag','24h':'24 h'}[f.vma]+' '+(f.zweck||''),'','','',d(vmaVal(f.vma)),'','','',d(vmaVal(f.vma)),'','',''])});
r.Sp.sort((a,b)=>a.datum.localeCompare(b.datum)).forEach(s=>{const v=vat(s);rows.push(['Beleg',fd(s.datum),s.kat,s.beschr,'','','',d(s.brutto),s.ust+' %',d(v.netto),d(v.ust),d(deduct(s)),s.anlass,s.teiln,''])});
dl(`Fahrtkosten_${per().join('_')}.csv`,'\ufeff'+rows.map(x=>x.map(q).join(';')).join('\r\n'),'text/csv')};
$('#pr').onclick=async()=>{const [a,b]=per(),r=await sums(a,b);const imgs=await Promise.all(r.Sp.map(async s=>s.foto?b64(s.foto):''));
$('#print').innerHTML=`<h2>Reisekosten & Spesen ${fd(a)} – ${fd(b)}</h2><p>Michael Falkner · erstellt ${fd(today())} · Kilometersatz ${eur(S.kmRate)}/km</p>
<h3>Zusammenfassung</h3><table>${Object.entries(r.t).map(([k,v])=>`<tr><td>${k}</td><td class="r">${eur(v)}</td></tr>`).join('')}<tr><th>Summe</th><th class="r">${eur(r.g)}</th></tr><tr><td>davon abziehbar (Bewirtung 70 %)</td><td class="r">${eur(r.abz)}</td></tr><tr><td>enthaltene USt</td><td class="r">${eur(r.ust)}</td></tr></table>
<h3>Fahrten</h3><table><tr><th>Datum</th><th>Strecke</th><th>Zweck</th><th class="r">km</th><th class="r">Betrag</th><th class="r">VMA</th></tr>${r.F.sort((x,y)=>x.datum.localeCompare(y.datum)).map(f=>`<tr><td>${fd(f.datum)}</td><td>${esc(f.start)} → ${esc(f.ziel)}${f.hinrueck?' (H+R)':''}</td><td>${esc(f.zweck)}</td><td class="r">${f.km*(f.hinrueck?2:1)}</td><td class="r">${eur(fBetrag(f))}</td><td class="r">${f.vma?eur(vmaVal(f.vma)):''}</td></tr>`).join('')}</table>
<h3>Belege</h3><table><tr><th>Datum</th><th>Kategorie</th><th>Beschreibung</th><th class="r">Netto</th><th class="r">USt</th><th class="r">Brutto</th></tr>${r.Sp.map(s=>`<tr><td>${fd(s.datum)}</td><td>${s.kat}</td><td>${esc(s.beschr)}${s.anlass?'<br>Anlass: '+esc(s.anlass):''}${s.teiln?'<br>Teilnehmer: '+esc(s.teiln):''}</td><td class="r">${eur(vat(s).netto)}</td><td class="r">${s.ust} % ${eur(vat(s).ust)}</td><td class="r">${eur(s.brutto)}</td></tr>`).join('')}</table>
${imgs.some(x=>x)?'<h3>Belegfotos</h3>'+r.Sp.map((s,i)=>imgs[i]?`<div style="page-break-inside:avoid"><p>${fd(s.datum)} ${s.kat} ${eur(s.brutto)}</p><img src="${imgs[i]}" style="max-width:100%;max-height:600px"></div>`:'').join(''):''}${DISC}`;setTimeout(()=>print(),300)};
$('#bk').onclick=async()=>{const sp=await Promise.all((await all('spesen')).map(async s=>({...s,foto:s.foto?await b64(s.foto):null})));dl(`fahrtkosten-backup-${today()}.json`,JSON.stringify({app:'fahrtkosten',v:1,settings:S,fahrten:await all('fahrten'),spesen:sp}),'application/json')};
$('#rs').onchange=async e=>{try{const j=JSON.parse(await e.target.files[0].text());if(j.app!=='fahrtkosten')throw 0;if(!confirm('Alle aktuellen Daten ersetzen?'))return;
await clr('fahrten');await clr('spesen');for(const f of j.fahrten)await put('fahrten',f);for(const s of j.spesen)await put('spesen',{...s,foto:s.foto?await (await fetch(s.foto)).blob():null});S={...DEF,...j.settings};await put('meta',{id:'settings',v:S});alert('Wiederhergestellt.');render()}catch(x){alert('Ungültige Backup-Datei.')}}};
V.einst=()=>{$('#v').innerHTML=`<div class="card"><b>Sätze</b><form id="f"><label>Kilometersatz €/km</label><input name="kmRate" inputmode="decimal" value="${String(S.kmRate).replace('.',',')}">
<label>VMA &gt;8 h €</label><input name="vma8" inputmode="decimal" value="${S.vma8}"><label>VMA An-/Abreisetag €</label><input name="vmaAnAb" inputmode="decimal" value="${S.vmaAnAb}"><label>VMA 24 h €</label><input name="vma24" inputmode="decimal" value="${S.vma24}">
<button>Speichern</button> <button type="button" class="sec" id="rst">Standard 2026</button></form></div>
<div class="card"><p class="sm">Alle Daten liegen nur lokal auf diesem Gerät (IndexedDB). Bitte regelmäßig ein JSON-Backup erstellen. Zum Homescreen: Safari → Teilen → „Zum Home-Bildschirm“.</p></div>${DISC}`;
const fm=$('#f');fm.onsubmit=async e=>{e.preventDefault();for(const k in DEF)S[k]=num(fm[k].value);await put('meta',{id:'settings',v:S});alert('Gespeichert.')};
$('#rst').onclick=async()=>{S={...DEF};await put('meta',{id:'settings',v:S});render()}};
(async()=>{db=await openDB();await loadS();render();if('serviceWorker'in navigator)navigator.serviceWorker.register('sw.js')})();

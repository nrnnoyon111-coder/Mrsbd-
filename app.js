const $=(s,r=document)=>r.querySelector(s),esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
document.documentElement.dataset.theme=localStorage.mrs_theme||'dark';
function toggleTheme(){const t=document.documentElement.dataset.theme==='dark'?'light':'dark';document.documentElement.dataset.theme=t;localStorage.mrs_theme=t;window.redraw&&redraw()}
function toast(m,bad){const t=document.createElement('div');t.className='toast'+(bad?' bad':'');t.textContent=m;document.body.append(t);setTimeout(()=>t.remove(),3800)}
const money=n=>'৳'+Number(n||0).toLocaleString();
async function api(action,data){
  if(!CONFIG.API_URL)throw new Error('Set API_URL in config.js first.');
  const r=await fetch(CONFIG.API_URL,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({action,key:CONFIG.API_KEY,data:data||{}})});
  const j=await r.json();if(!j.ok)throw new Error(j.error);return j.data}
const SALE=['Paid','Due','Partial'],SRV=['Received','Checking','Processing','Completed','Delivered'];
const MODS={
 customers:{t:'Customers',one:'Customer',sh:'Customers',id:'Customer_ID',get:'getCustomers',add:'addCustomer',upd:'updateCustomer',cols:['Customer_ID','Customer_Name','Phone','Email','Address','Product_Name','Service_History','Created_Date'],form:['Customer_Name',['Phone','tel'],['Email','email'],'Address','Product_Name',['Service_History','area']]},
 sales:{t:'Sales',one:'Sale',sh:'Sales',id:'Sale_ID',cust:1,get:'getSales',add:'addSale',upd:'updateSale',cols:['Sale_ID','Customer_ID','Customer_Name','Product','Quantity','Price','Payment_Status','Sale_Date'],form:['Product',['Quantity','number'],['Price','number'],['Payment_Status','select',SALE]]},
 services:{t:'Services',one:'Service',sh:'Services',id:'Service_ID',cust:1,get:'getServices',add:'addService',upd:'updateService',cols:['Service_ID','Customer_ID','Customer_Name','Device','Problem_Details','Assigned_Person','Status','Date'],form:['Device',['Problem_Details','area'],'Assigned_Person',['Status','select',SRV]]},
 inventory:{t:'Inventory',one:'Product',sh:'Inventory',id:'Product_ID',get:'getInventory',add:'addInventory',upd:'updateInventory',cols:['Product_ID','Product_Name','Category','Quantity','Purchase_Price','Selling_Price','Stock_Status'],form:['Product_Name','Category',['Quantity','number'],['Purchase_Price','number'],['Selling_Price','number']]}
};
const BOLT='<svg viewBox="0 0 24 24" width="22" height="22"><path d="M13 2 4 14h6l-1 8 9-12h-6z" fill="#ffd21f"/></svg>';
function boot(page){
  if(!sessionStorage.mrs_auth)return location.replace('login.html');
  const nav=[['dashboard','Dashboard'],['customers','Customers'],['sales','Sales'],['services','Services'],['inventory','Inventory'],['reports','Reports']];
  document.body.innerHTML=`<aside class="side"><a class="brand" href="dashboard.html">${BOLT}<b>MRS FAST</b></a><nav>${nav.map(([k,l])=>`<a href="${k}.html" class="${k===page?'on':''}">${l}</a>`).join('')}<a href="#" id="set">Settings</a></nav></aside><div class="main"><header><h2>${nav.find(n=>n[0]===page)[1]}</h2><div class="hr"><button class="ic" id="bell">Alerts <i id="nb" hidden></i></button><button class="ic" id="th">Theme</button><span class="mut">${esc(CONFIG.ADMIN_NAME)}</span><button class="ic" id="out">Sign out</button></div></header><main id="view"></main></div>`;
  $('#th').onclick=toggleTheme;$('#out').onclick=()=>{sessionStorage.clear();location.href='login.html'};
  $('#set').onclick=e=>{e.preventDefault();toast(CONFIG.API_URL?'Connected to your Apps Script API. Edit config.js to change login or URL.':'API_URL is empty. Add it in config.js.',!CONFIG.API_URL)};
  $('#bell').onclick=async()=>{try{const d=await api('dashboardData');toast(d.lowItems.length?'Low stock: '+d.lowItems.join(', '):'No low-stock items.')}catch(e){toast(e.message,1)}};
  if(MODS[page])renderModule(page);else if(page==='reports')renderReports();else renderDashboard();
}
async function renderModule(k){
  const M=MODS[k];let rows=[];
  $('#view').innerHTML=`<div class="bar"><input id="q" placeholder="Search ${M.t.toLowerCase()}"><button class="btn" id="add">Add ${M.one.toLowerCase()}</button></div><div class="tw"><table><thead></thead><tbody></tbody></table></div>`;
  const draw=()=>{const q=$('#q').value.toLowerCase(),f=rows.filter(r=>!q||JSON.stringify(r).toLowerCase().includes(q));
    $('thead').innerHTML='<tr>'+M.cols.map(c=>`<th>${c.replace(/_/g,' ')}</th>`).join('')+'<th></th></tr>';
    $('tbody').innerHTML=f.length?f.map(r=>`<tr class="${/Low|Out/.test(r.Stock_Status||'')?'warn':''}">`+M.cols.map(c=>`<td>${/Status$/.test(c)?`<span class="pill s-${esc(r[c]).replace(/\W/g,'')}">${esc(r[c])}</span>`:esc(r[c])}</td>`).join('')+`<td class="act">${k==='customers'?`<button data-h="${r[M.id]}">History</button>`:''}<button data-e="${r[M.id]}">Edit</button><button data-d="${r[M.id]}">Delete</button></td></tr>`).join(''):`<tr><td colspan="${M.cols.length+1}" class="empty">No ${M.t.toLowerCase()} yet. Use “Add ${M.one.toLowerCase()}” to create the first record.</td></tr>`};
  const load=async()=>{try{rows=await api(M.get);draw()}catch(e){toast(e.message,1);draw()}};
  $('#q').oninput=draw;$('#add').onclick=async()=>{if(await openForm(k))load()};
  $('tbody').onclick=async e=>{const b=e.target.closest('button');if(!b)return;const g=b.dataset,find=id=>rows.find(r=>r[M.id]===id);
    if(g.e&&await openForm(k,find(g.e)))load();
    if(g.d&&confirm('Delete '+g.d+'? This cannot be undone.')){try{await api('deleteRecord',{sheet:M.sh,id:g.d});toast('Deleted '+g.d);load()}catch(x){toast(x.message,1)}}
    if(g.h)history_(find(g.h))};
  load();
}
async function history_(c){
  try{const[s,v]=await Promise.all([api('getSales'),api('getServices')]),m=r=>r.filter(x=>x.Customer_ID===c.Customer_ID);
    const d=document.createElement('dialog');d.innerHTML=`<div><h3>${esc(c.Customer_Name)} · ${c.Customer_ID}</h3><b>Sales</b>${m(s).map(x=>`<p>${esc(x.Sale_ID)} — ${esc(x.Product)} × ${x.Quantity} — ${money(x.Quantity*x.Price)} (${x.Payment_Status})</p>`).join('')||'<p class="mut">No sales yet.</p>'}<b>Services</b>${m(v).map(x=>`<p>${esc(x.Service_ID)} — ${esc(x.Device)} — ${x.Status}</p>`).join('')||'<p class="mut">No services yet.</p>'}<div class="row"><button class="btn">Close</button></div></div>`;
    document.body.append(d);d.showModal();d.querySelector('button').onclick=()=>{d.close();d.remove()}}catch(e){toast(e.message,1)}
}
async function openForm(k,rec){
  const M=MODS[k];let cs=[];
  if(M.cust){try{cs=await api('getCustomers')}catch(e){return toast(e.message,1)}if(!cs.length)return toast('Add a customer first.',1)}
  const d=document.createElement('dialog');
  d.innerHTML=`<form><h3>${rec?'Edit':'Add'} ${M.one.toLowerCase()}</h3>`+(M.cust?`<label>Customer<select name="Customer_ID">${cs.map(c=>`<option value="${c.Customer_ID}" data-n="${esc(c.Customer_Name)}">${c.Customer_ID} — ${esc(c.Customer_Name)}</option>`).join('')}</select></label>`:'')+M.form.map(f=>{const[n,t,o]=[].concat(f);return `<label>${n.replace(/_/g,' ')}${t==='select'?`<select name="${n}">${o.map(x=>`<option>${x}</option>`).join('')}</select>`:t==='area'?`<textarea name="${n}" rows="3"></textarea>`:`<input name="${n}" type="${t||'text'}" ${t==='number'?'step="any" min="0" required':''}>`}</label>`}).join('')+`<div class="row"><button type="button" class="ic" id="cx">Cancel</button><button class="btn">Save ${M.one.toLowerCase()}</button></div></form>`;
  document.body.append(d);const f=d.querySelector('form');
  if(rec)[...f.elements].forEach(el=>{if(el.name&&rec[el.name]!==undefined)el.value=rec[el.name]});
  d.showModal();
  return new Promise(res=>{const end=v=>{d.close();d.remove();res(v)};
    $('#cx',d).onclick=()=>end(false);
    f.onsubmit=async e=>{e.preventDefault();const data=Object.fromEntries(new FormData(f));
      if(M.cust)data.Customer_Name=f.Customer_ID.selectedOptions[0].dataset.n;
      if(rec)data[M.id]=rec[M.id];
      try{await api(rec?M.upd:M.add,data);toast('Saved '+M.one.toLowerCase());end(true)}catch(x){toast(x.message,1)}}})
}
async function renderReports(){
  $('#view').innerHTML='<p class="mut">Building reports…</p>';
  try{const r=await api('generateReports'),s=r.sales,box=(t,o)=>`<div class="glass card stat"><span>${t}</span><b>${money(o.revenue)}</b><span>${o.count} sales</span></div>`;
    $('#view').innerHTML=`<div class="bar"><span class="mut">Also saved to the “Reports” sheet in your Google Sheet.</span><span><a class="btn ghost" href="${esc(r.sheetUrl)}" target="_blank" rel="noopener">Open Google Sheet</a> <button class="btn" onclick="print()">Save as PDF</button></span></div><h3>Sales</h3><div class="grid">${box('Last 24 hours',s.daily)}${box('Last 7 days',s.weekly)}${box('Last 30 days',s.monthly)}</div><h3 style="margin-top:1.4rem">Services</h3><div class="grid"><div class="glass card stat"><span>Total</span><b>${r.services.total}</b></div><div class="glass card stat"><span>Pending</span><b>${r.services.pending}</b></div><div class="glass card stat"><span>Completed</span><b>${r.services.completed}</b></div></div>`}
  catch(e){$('#view').innerHTML='';toast(e.message,1)}
}

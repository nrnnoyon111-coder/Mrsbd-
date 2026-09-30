let DASH=null;
function chart(id,labels,vals,type){
  const c=document.getElementById(id),dp=devicePixelRatio||1,w=c.width=c.clientWidth*dp,h=c.height=c.clientHeight*dp,x=c.getContext('2d'),cs=getComputedStyle(document.documentElement),cy=cs.getPropertyValue('--cy'),mu=cs.getPropertyValue('--mut'),max=Math.max(1,...vals.map(Math.abs)),n=vals.length,pw=w/n,base=h-28*dp;
  x.clearRect(0,0,w,h);x.font=11*dp+'px sans-serif';x.fillStyle=mu;x.strokeStyle=cy;x.lineWidth=2*dp;
  const pts=vals.map((v,i)=>[pw*i+pw/2,base-(v/max)*(base-14*dp)]);
  labels.forEach((l,i)=>{x.textAlign='center';x.fillText(l,pw*i+pw/2,h-8*dp)});
  if(type==='line'){x.beginPath();pts.forEach((p,i)=>i?x.lineTo(...p):x.moveTo(...p));x.stroke();pts.forEach((p,i)=>{x.beginPath();x.arc(p[0],p[1],3.5*dp,0,7);x.fillStyle=cy;x.fill();x.fillStyle=mu;x.fillText(vals[i]+(id==='c3'?'%':''),p[0],p[1]-8*dp)})}
  else pts.forEach((p,i)=>{const g=x.createLinearGradient(0,p[1],0,base);g.addColorStop(0,cy);g.addColorStop(1,'#2f7bff');x.fillStyle=g;x.fillRect(p[0]-pw*.3,p[1],pw*.6,base-p[1]);x.fillStyle=mu;x.fillText(vals[i],p[0],p[1]-6*dp)})
}
function redraw(){if(!DASH)return;const d=DASH,m=d.monthly.values,gr=m.map((v,i)=>i&&m[i-1]?Math.round((v-m[i-1])/m[i-1]*100):0);
  chart('c1',d.daily.labels,d.daily.values,'bar');chart('c2',d.monthly.labels,m,'bar');chart('c3',d.monthly.labels,gr,'line');chart('c4',Object.keys(d.services),Object.values(d.services),'bar')}
async function renderDashboard(){
  const stat=(l,v)=>`<div class="glass card stat"><span>${l}</span><b>${v}</b></div>`;
  $('#view').innerHTML='<p class="mut">Loading dashboard…</p>';
  let d;try{d=await api('dashboardData')}catch(e){$('#view').innerHTML='<div class="glass card"><h3>Backend not connected</h3><p>'+esc(e.message)+' See README steps in Code.gs.</p></div>';return}
  DASH=d;$('#view').innerHTML=`<div class="grid">${stat('Total customers',d.customers)}${stat('Total sales',d.sales)}${stat('Total revenue',money(d.revenue))}${stat('Pending services',d.pending)}${stat('Completed services',d.completed)}${stat('Stock status',d.stock.low+' low / '+d.stock.total)}</div><div class="charts">${[['Daily sales (7 days)','c1'],['Monthly sales','c2'],['Growth vs previous month','c3'],['Service status','c4']].map(([t,i])=>`<div class="glass"><h3>${t}</h3><canvas class="ch" id="${i}"></canvas></div>`).join('')}</div>`;
  if(d.lowItems.length){$('#nb').hidden=false;$('#nb').textContent=d.lowItems.length}
  redraw();addEventListener('resize',redraw)}

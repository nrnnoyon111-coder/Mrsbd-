/**
 * MRS FAST SOLUTIONS – backend (Google Apps Script + Google Sheets)
 * SETUP: 1) Create a Google Sheet, open Extensions > Apps Script, paste this file.
 *        2) Project Settings > Script properties: add API_KEY (same value as config.js).
 *        3) Run setup() once (creates sheets + daily trigger, asks for permissions).
 *        4) Deploy > New deployment > Web app > Execute as: Me, Access: Anyone. Copy the /exec URL into config.js.
 */
var H={
  Customers:['Customer_ID','Customer_Name','Phone','Email','Address','Product_Name','Service_History','Created_Date'],
  Sales:['Sale_ID','Customer_ID','Customer_Name','Product','Quantity','Price','Payment_Status','Sale_Date'],
  Services:['Service_ID','Customer_ID','Customer_Name','Device','Problem_Details','Assigned_Person','Status','Date'],
  Inventory:['Product_ID','Product_Name','Category','Quantity','Purchase_Price','Selling_Price','Stock_Status'],
  Activity_Log:['Time','Action','Details']};
var PFX={Customers:'CUS',Sales:'SAL',Services:'SRV',Inventory:'PRD'};
var DATEF={Customers:'Created_Date',Sales:'Sale_Date',Services:'Date'};
var LOW_STOCK=5;

function ss_(){var id=PropertiesService.getScriptProperties().getProperty('SHEET_ID');return id?SpreadsheetApp.openById(id):SpreadsheetApp.getActiveSpreadsheet();}
function tz_(){return Session.getScriptTimeZone();}
function now_(){return Utilities.formatDate(new Date(),tz_(),'yyyy-MM-dd HH:mm');}
function log_(a,d){ss_().getSheetByName('Activity_Log').appendRow([now_(),a,d]);}
function json_(o){return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);}

function setup(){
  Object.keys(H).forEach(function(n){
    var s=ss_().getSheetByName(n)||ss_().insertSheet(n);
    if(s.getLastRow()===0){s.appendRow(H[n]);s.setFrozenRows(1);
      s.getRange(1,1,1,H[n].length).setFontWeight('bold').setBackground('#0a1224').setFontColor('#22e6ff');}
  });
  installTrigger();
}
function list_(n){
  var v=ss_().getSheetByName(n).getDataRange().getValues(),h=v.shift();
  return v.filter(function(r){return r[0]!=='';}).map(function(r){
    var o={};h.forEach(function(k,i){o[k]=r[i] instanceof Date?Utilities.formatDate(r[i],tz_(),'yyyy-MM-dd HH:mm'):r[i];});return o;});
}
function fix_(n,d){
  if(n==='Inventory'){var q=Number(d.Quantity)||0;d.Stock_Status=q<=0?'Out of Stock':(q<=LOW_STOCK?'Low Stock':'In Stock');}
}
function add_(n,d){
  var l=LockService.getScriptLock();l.waitLock(20000);
  try{
    var ids=list_(n).map(function(o){return parseInt(String(o[H[n][0]]).split('-')[1],10)||0;});
    var id=PFX[n]+'-'+('0000'+(Math.max.apply(null,ids.concat([0]))+1)).slice(-4);
    d[H[n][0]]=id;if(DATEF[n])d[DATEF[n]]=now_();fix_(n,d);
    ss_().getSheetByName(n).appendRow(H[n].map(function(k){return d[k]===undefined?'':d[k];}));
    log_('Add '+n,id);return d;
  }finally{l.releaseLock();}
}
function upd_(n,d){
  var l=LockService.getScriptLock();l.waitLock(20000);
  try{
    var s=ss_().getSheetByName(n),v=s.getDataRange().getValues(),h=v[0];
    for(var i=1;i<v.length;i++){if(v[i][0]===d[h[0]]){
      var o={};h.forEach(function(k,j){o[k]=(k in d)?d[k]:v[i][j];});fix_(n,o);
      s.getRange(i+1,1,1,h.length).setValues([h.map(function(k){return o[k];})]);
      log_('Update '+n,d[h[0]]);return o;}}
    throw new Error('Record not found');
  }finally{l.releaseLock();}
}
function deleteRecord(d){
  if(!PFX[d.sheet])throw new Error('Invalid sheet');
  var s=ss_().getSheetByName(d.sheet),v=s.getDataRange().getValues();
  for(var i=1;i<v.length;i++){if(v[i][0]===d.id){s.deleteRow(i+1);log_('Delete '+d.sheet,d.id);return true;}}
  throw new Error('Record not found');
}

function addCustomer(d){return add_('Customers',d);}   function getCustomers(){return list_('Customers');}   function updateCustomer(d){return upd_('Customers',d);}
function addSale(d){return add_('Sales',d);}           function getSales(){return list_('Sales');}           function updateSale(d){return upd_('Sales',d);}
function addService(d){return add_('Services',d);}     function getServices(){return list_('Services');}     function updateService(d){return upd_('Services',d);}
function addInventory(d){return add_('Inventory',d);}  function getInventory(){return list_('Inventory');}   function updateInventory(d){return upd_('Inventory',d);}

function series_(m,n,daily){
  var out={labels:[],values:[]},t=new Date();
  for(var i=n-1;i>=0;i--){var x=new Date(t);daily?x.setDate(t.getDate()-i):x.setMonth(t.getMonth()-i,1);
    var k=Utilities.formatDate(x,tz_(),daily?'yyyy-MM-dd':'yyyy-MM');out.labels.push(daily?k.slice(5):k.slice(2));out.values.push(m[k]||0);}
  return out;
}
function dashboardData(){
  var C=list_('Customers'),S=list_('Sales'),V=list_('Services'),I=list_('Inventory'),rev=0,day={},mon={};
  S.forEach(function(o){var t=o.Quantity*o.Price,dk=String(o.Sale_Date).slice(0,10),mk=dk.slice(0,7);rev+=t;day[dk]=(day[dk]||0)+t;mon[mk]=(mon[mk]||0)+t;});
  var sv={Received:0,Checking:0,Processing:0,Completed:0,Delivered:0};
  V.forEach(function(o){if(o.Status in sv)sv[o.Status]++;});
  var low=I.filter(function(o){return o.Stock_Status!=='In Stock';});
  return {customers:C.length,sales:S.length,revenue:rev,pending:sv.Received+sv.Checking+sv.Processing,completed:sv.Completed+sv.Delivered,
    services:sv,stock:{total:I.length,low:low.length},lowItems:low.map(function(o){return o.Product_Name+' ('+o.Quantity+')';}),
    daily:series_(day,7,true),monthly:series_(mon,6,false)};
}
function generateReports(){
  var S=list_('Sales'),V=list_('Services'),t=new Date(),
      r={sales:{daily:{count:0,revenue:0},weekly:{count:0,revenue:0},monthly:{count:0,revenue:0}},services:{total:V.length,pending:0,completed:0}};
  S.forEach(function(o){var age=(t-new Date(String(o.Sale_Date).replace(' ','T')))/864e5,amt=o.Quantity*o.Price;
    [['daily',1],['weekly',7],['monthly',30]].forEach(function(p){if(age<=p[1]){r.sales[p[0]].count++;r.sales[p[0]].revenue+=amt;}});});
  V.forEach(function(o){if(o.Status==='Completed'||o.Status==='Delivered')r.services.completed++;else r.services.pending++;});
  var s=ss_().getSheetByName('Reports')||ss_().insertSheet('Reports');s.clear();
  s.getRange(1,1,8,3).setValues([['Report','Count','Revenue'],['Sales – last 24h',r.sales.daily.count,r.sales.daily.revenue],['Sales – last 7 days',r.sales.weekly.count,r.sales.weekly.revenue],['Sales – last 30 days',r.sales.monthly.count,r.sales.monthly.revenue],['Services – total',r.services.total,''],['Services – pending',r.services.pending,''],['Services – completed',r.services.completed,''],['Updated',now_(),'']]);
  r.sheetUrl=ss_().getUrl();return r;
}

function dailyJob(){
  DriveApp.getFileById(ss_().getId()).makeCopy('MRS Backup '+Utilities.formatDate(new Date(),tz_(),'yyyy-MM-dd'));
  generateReports();log_('Daily job','Backup + reports updated');
}
function installTrigger(){
  ScriptApp.getProjectTriggers().forEach(function(t){if(t.getHandlerFunction()==='dailyJob')ScriptApp.deleteTrigger(t);});
  ScriptApp.newTrigger('dailyJob').timeBased().everyDays(1).atHour(1).create();
}

var ACTIONS={addCustomer:addCustomer,getCustomers:getCustomers,updateCustomer:updateCustomer,addSale:addSale,getSales:getSales,updateSale:updateSale,
  addService:addService,getServices:getServices,updateService:updateService,addInventory:addInventory,getInventory:getInventory,updateInventory:updateInventory,
  deleteRecord:deleteRecord,dashboardData:dashboardData,generateReports:generateReports};
function handle_(a,k,d){
  try{
    var key=PropertiesService.getScriptProperties().getProperty('API_KEY');
    if(!key||k!==key)throw new Error('Unauthorized: check API_KEY in config.js and script properties.');
    if(!ACTIONS[a])throw new Error('Unknown action');
    return json_({ok:true,data:ACTIONS[a](d||{})});
  }catch(e){return json_({ok:false,error:String(e.message||e)});}
}
function doGet(e){
  if(e.parameter&&e.parameter.action)return handle_(e.parameter.action,e.parameter.key,{});
  return HtmlService.createHtmlOutput('MRS FAST SOLUTIONS API is running.');
}
function doPost(e){var b=JSON.parse(e.postData.contents);return handle_(b.action,b.key,b.data);}

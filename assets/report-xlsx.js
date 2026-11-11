/* ProfitPilot offline XLSX writer: pure browser JS, no external services. */
(function(){
"use strict";
const te=new TextEncoder();
const xml=s=>String(s??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&apos;");
const col=n=>{let x="";for(n++;n;n=Math.floor((n-1)/26))x=String.fromCharCode(65+(n-1)%26)+x;return x};
const crcTable=Array.from({length:256},(_,n)=>{for(let k=0;k<8;k++)n=n&1?0xEDB88320^(n>>>1):n>>>1;return n>>>0});
function crc(bytes){let c=0xffffffff;for(const b of bytes)c=crcTable[(c^b)&255]^(c>>>8);return(c^0xffffffff)>>>0}
function u16(a,n){a.push(n&255,(n>>>8)&255)}
function u32(a,n){a.push(n&255,(n>>>8)&255,(n>>>16)&255,(n>>>24)&255)}
function zip(files){
 const chunks=[],central=[];let offset=0;
 for(const [name,content] of files){
  const nb=te.encode(name),b=te.encode(content),sum=crc(b),local=[];
  u32(local,0x04034b50);u16(local,20);u16(local,0);u16(local,0);u16(local,0);u16(local,0);
  u32(local,sum);u32(local,b.length);u32(local,b.length);u16(local,nb.length);u16(local,0);
  chunks.push(Uint8Array.from(local),nb,b);
  const h=[];u32(h,0x02014b50);u16(h,20);u16(h,20);u16(h,0);u16(h,0);u16(h,0);u16(h,0);
  u32(h,sum);u32(h,b.length);u32(h,b.length);u16(h,nb.length);u16(h,0);u16(h,0);u16(h,0);u16(h,0);u32(h,0);u32(h,offset);
  central.push(Uint8Array.from(h),nb);
  offset+=local.length+nb.length+b.length;
 }
 let centralSize=0;for(const v of central)centralSize+=v.length;
 const end=[];u32(end,0x06054b50);u16(end,0);u16(end,0);u16(end,files.length);u16(end,files.length);u32(end,centralSize);u32(end,offset);u16(end,0);
 return new Blob([...chunks,...central,Uint8Array.from(end)],{type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"});
}
const NUM=4,DATE=5,MONEY=6,HEAD=2,TITLE=1,SUB=3,TOTAL=7,PROFIT=8,LOSS=9;
function sheetXml(rows,widths,opts={}){
 let cells=[];
 for(let ri=0;ri<rows.length;ri++){
  const row=rows[ri]||[],arr=[];let hasValue=false;
  for(let ci=0;ci<row.length;ci++){
   let entry=row[ci];if(entry==null||entry==="")continue;hasValue=true;
   let val=entry,style=0,kind=null;
   if(typeof entry==="object"&&!Array.isArray(entry)){val=entry.v;style=entry.style||0;kind=entry.kind||null}
   let attr=' r="'+col(ci)+(ri+1)+'" s="'+style+'"';
   if(typeof val==="number"&&Number.isFinite(val))arr.push("<c"+attr+"><v>"+val+"</v></c>");
   else if(kind==="date"&&typeof val==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(val)){
    const [y,m,d]=val.split("-").map(Number),serial=(Date.UTC(y,m-1,d)-Date.UTC(1899,11,30))/86400000;
    arr.push("<c"+attr.replace(/ s="\d+"/,' s="'+DATE+'"')+"><v>"+serial+"</v></c>");
   }else arr.push("<c"+attr+' t="inlineStr"><is><t xml:space="preserve">'+xml(val)+'</t></is></c>');
  }
  if(hasValue)cells.push('<row r="'+(ri+1)+'"'+(ri===0?' ht="31" customHeight="1"':ri===1?' ht="23" customHeight="1"':'')+'>'+arr.join("")+"</row>");
 }
 const cols=widths.map((w,i)=>'<col min="'+(i+1)+'" max="'+(i+1)+'" width="'+Math.max(10,Math.min(52,w))+'" customWidth="1"/>').join("");
 const auto=opts.filter?'<autoFilter ref="A'+opts.filter+':'+col(widths.length-1)+rows.length+'"/>':"";
 const panes=opts.freeze?'<sheetViews><sheetView workbookViewId="0"><pane ySplit="'+opts.freeze+'" topLeftCell="A'+(opts.freeze+1)+'" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>':'<sheetViews><sheetView workbookViewId="0"/></sheetViews>';
 return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'+panes+'<sheetFormatPr defaultRowHeight="18"/><cols>'+cols+'</cols><sheetData>'+cells.join("")+'</sheetData>'+auto+'</worksheet>';
}
const styles='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="2"><numFmt numFmtId="164" formatCode="#,##0.00;[Red](#,##0.00)"/><numFmt numFmtId="165" formatCode="dd mmm yyyy"/></numFmts><fonts count="5"><font><sz val="11"/><name val="Aptos"/></font><font><b/><sz val="20"/><color rgb="FFFFFFFF"/><name val="Aptos Display"/></font><font><b/><color rgb="FFFFFFFF"/><name val="Aptos"/></font><font><b/><color rgb="FF0B6767"/><name val="Aptos"/></font><font><b/><sz val="14"/><color rgb="FF063A3A"/><name val="Aptos"/></font></fonts><fills count="5"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF007F7E"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFE5F6F3"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFECF3F4"/></patternFill></fill></fills><borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left/><right/><top/><bottom style="thin"><color rgb="FFD4E3E3"/></bottom><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="10"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/><xf numFmtId="0" fontId="2" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/><xf numFmtId="0" fontId="3" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"/><xf numFmtId="0" fontId="3" fillId="0" borderId="0" xfId="0" applyFont="1"/><xf numFmtId="165" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1"/><xf numFmtId="164" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1"/><xf numFmtId="164" fontId="2" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyNumberFormat="1"/><xf numFmtId="164" fontId="3" fillId="3" borderId="0" xfId="0" applyFont="1" applyFill="1" applyNumberFormat="1"/><xf numFmtId="164" fontId="0" fillId="4" borderId="0" xfId="0" applyFill="1" applyNumberFormat="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>';
const cell=(v,style)=>({v,style});const date=v=>({v,kind:"date",style:DATE});
function exportReport(args){
 const {scopeName,periodName,currency,details,income,expenses,profit,incomeCategories,expenseCategories,months,downloadName}=args;
 const summary=[
  [cell("PROFITPILOT  /  FINANCIAL REPORT",TITLE)],
  [cell("Cash-basis Profit & Loss · Powered by TryDesigns.co.uk",SUB)],
  [],[cell("Workspace",SUB),scopeName],[cell("Report period",SUB),periodName],[cell("Currency",SUB),currency+" (display only; no conversion)"],[],
  [cell("FINANCIAL SUMMARY",HEAD),cell("AMOUNT",HEAD)],
  ["Total income",cell(income,MONEY)],["Total expenses",cell(expenses,MONEY)],["NET CASH PROFIT / LOSS",cell(profit,TOTAL)],
  ["Profit margin",income?((profit/income)*100).toFixed(1)+"%":"Not available"],
  [],[cell("INCOME BY CATEGORY",HEAD),cell("AMOUNT",HEAD)],
  ...incomeCategories.map(c=>[c.name,cell(c.total,MONEY)]),[],
  [cell("EXPENSES BY CATEGORY",HEAD),cell("AMOUNT",HEAD)],
  ...expenseCategories.map(c=>[c.name,cell(c.total,MONEY)]),[],
  [cell("MONTHLY BREAKDOWN",HEAD),cell("INCOME",HEAD),cell("EXPENSES",HEAD),cell("NET",HEAD)],
  ...months.map(m=>[m.month,cell(m.income,MONEY),cell(m.expense,MONEY),cell(Math.round((m.income-m.expense)*100)/100,MONEY)]),[],
  ["Important: transfers, opening balances and invoice totals without a separately recorded income transaction are excluded."],
  ["This is an indicative management report, not formal audited accounts."]
 ];
 const tx=[ [cell("PROFITPILOT  /  TRANSACTION DETAILS",TITLE)], [cell("Filtered: "+scopeName+" · "+periodName,SUB)],
 [],["Date","Type","Amount","Currency","Workspace","Account","Transfer to","Category","Description / Notes","Tags","Included in P&L"].map(x=>cell(x,HEAD)),
 ...details.map(t=>[date(t.date),t.type,cell(Number(t.amount),MONEY),t.currency||currency,t.workspaceName,t.accountName,t.toAccountName,t.category||"",t.note||"",t.tags||"",t.excludedFromPL||t.type==="transfer"?"No":"Yes"])
 ];
 const files=[
  ["[Content_Types].xml",'<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>'],
  ["_rels/.rels",'<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'],
  ["xl/workbook.xml",'<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Profit &amp; Loss" sheetId="1" r:id="rId1"/><sheet name="Transactions" sheetId="2" r:id="rId2"/></sheets></workbook>'],
  ["xl/_rels/workbook.xml.rels",'<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>'],
  ["xl/styles.xml",styles],
  ["xl/worksheets/sheet1.xml",sheetXml(summary,[48,28,25,25],{freeze:2})],
  ["xl/worksheets/sheet2.xml",sheetXml(tx,[19,17,19,14,23,21,21,26,48,30,20],{freeze:4,filter:4})]
 ];
 const blob=zip(files),url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=downloadName||"ProfitPilot-Financial-Report.xlsx";document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);
}
window.ProfitPilotExcel={exportReport};
})();

const {app,BrowserWindow,ipcMain,shell,dialog}=require('electron');
const fs=require('fs'),path=require('path');
let mainWindow=null,backupTimer=null,lastBackupAt=0;
function createWindow(){
 mainWindow=new BrowserWindow({width:1320,height:850,minWidth:900,minHeight:600,backgroundColor:'#f5faf9',show:false,webPreferences:{preload:path.join(__dirname,'preload.js'),nodeIntegration:false,contextIsolation:true,sandbox:false}});
 mainWindow.once('ready-to-show',()=>{if(mainWindow&&!mainWindow.isDestroyed())mainWindow.show()});
 mainWindow.on('closed',()=>{mainWindow=null});
 mainWindow.webContents.setWindowOpenHandler(({url})=>{if(/^https?:\/\//i.test(url))shell.openExternal(url).catch(console.error);return{action:'deny'}});
 mainWindow.loadFile(path.join(__dirname,'index.html')).catch(e=>{console.error(e);dialog.showErrorBox('ProfitPilot cannot start',e.message)});
}
const dataFile=()=>path.join(app.getPath('userData'),'profitpilot-data.json');
const historyDir=()=>path.join(app.getPath('userData'),'recovery');
function readFinanceData(){const p=dataFile();return fs.existsSync(p)?fs.readFileSync(p,'utf8'):null}
function validate(raw){if(typeof raw!=='string'||Buffer.byteLength(raw,'utf8')>150*1024*1024)throw Error('Finance database exceeds 150 MB');let o;try{o=JSON.parse(raw)}catch{throw Error('Finance database is invalid JSON')}if(!o||!Array.isArray(o.transactions)||!Array.isArray(o.workspaces)||!Array.isArray(o.accounts))throw Error('Finance database is missing required records');return o}
function storeFinanceData(raw){validate(raw);const p=dataFile(),tmp=p+'.tmp',dir=historyDir();fs.mkdirSync(path.dirname(p),{recursive:true});try{if(fs.existsSync(p)){fs.mkdirSync(dir,{recursive:true});const d=new Date(fs.statSync(p).mtimeMs).toISOString().slice(0,10),file=path.join(dir,'profitpilot-'+d+'.json');if(!fs.existsSync(file))fs.copyFileSync(p,file);const copies=fs.readdirSync(dir).filter(n=>/^profitpilot-\d{4}-\d{2}-\d{2}\.json$/.test(n)).sort().reverse();for(const old of copies.slice(5))fs.unlinkSync(path.join(dir,old))}fs.writeFileSync(tmp,raw,{encoding:'utf8',mode:0o600});fs.renameSync(tmp,p);return{ok:true}}catch(e){try{if(fs.existsSync(tmp))fs.unlinkSync(tmp)}catch{}throw Error('Unable to save database: '+e.message)}}
const prefsFile=()=>path.join(app.getPath('userData'),'backup-settings.json');
const defaultFolder=()=>path.join(app.getPath('documents'),'ProfitPilot Backups');
function backupDir(){try{return JSON.parse(fs.readFileSync(prefsFile(),'utf8')).folder||defaultFolder()}catch{return defaultFolder()}}
function ensureDir(){const dir=backupDir();fs.mkdirSync(dir,{recursive:true});return dir}
const backupNamePattern=/^ProfitPilot-\d{4}-\d{2}-\d{2}T[0-9TZ-]+\.json$/;
function backupNow(){const raw=readFinanceData();if(!raw)throw Error('No records saved yet');validate(raw);const dir=ensureDir(),stamp=new Date().toISOString().replace(/[:.]/g,'-'),name='ProfitPilot-'+stamp+'.json',tmp=path.join(dir,'.'+name+'.tmp');fs.writeFileSync(tmp,raw,{mode:0o600});fs.renameSync(tmp,path.join(dir,name));lastBackupAt=Date.now();const files=fs.readdirSync(dir).filter(x=>backupNamePattern.test(x)).sort().reverse();for(const old of files.slice(40))try{fs.unlinkSync(path.join(dir,old))}catch{}return{name,folder:dir,date:new Date(lastBackupAt).toISOString()}}
let backupRunning=false;
async function backupNowAsync(){
 if(backupRunning)return null;backupRunning=true;
 try{
  const raw=await fs.promises.readFile(dataFile(),'utf8').catch(e=>{if(e.code==='ENOENT')return null;throw e});
  if(!raw)return null;
  const dir=backupDir();await fs.promises.mkdir(dir,{recursive:true});
  const stamp=new Date().toISOString().replace(/[:.]/g,'-');
  const name='ProfitPilot-'+stamp+'.json';
  const tmp=path.join(dir,'.'+name+'.tmp');
  await fs.promises.writeFile(tmp,raw,{mode:0o600});
  await fs.promises.rename(tmp,path.join(dir,name));
  lastBackupAt=Date.now();
  const files=(await fs.promises.readdir(dir)).filter(x=>backupNamePattern.test(x)).sort().reverse();
  for(const old of files.slice(40))await fs.promises.unlink(path.join(dir,old)).catch(()=>{});
  return{name,folder:dir,date:new Date(lastBackupAt).toISOString()}
 }finally{backupRunning=false}
}
function scheduleBackup(){
 if(backupTimer)clearTimeout(backupTimer);
 backupTimer=setTimeout(()=>{backupTimer=null;if(Date.now()-lastBackupAt>5*60*1000)backupNowAsync().catch(e=>console.error('Backup:',e))},5000)
}
function listBackups(){return fs.readdirSync(ensureDir()).filter(x=>backupNamePattern.test(x)).sort().reverse().slice(0,40).map(name=>({name,modified:fs.statSync(path.join(ensureDir(),name)).mtime.toISOString()}))}
function restoreBackup(name){if(!backupNamePattern.test(name||''))throw Error('Invalid backup name');const raw=fs.readFileSync(path.join(ensureDir(),name),'utf8');validate(raw);const old=readFinanceData();if(old){const dir=historyDir();fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,'before-restore-'+new Date().toISOString().replace(/[:.]/g,'-')+'.json'),old,{mode:0o600})}storeFinanceData(raw);lastBackupAt=0;scheduleBackup();return{ok:true}}
app.whenReady().then(()=>{
 ipcMain.handle('finance:save-async',async(_e,raw)=>{try{const p=dataFile(),tmp=p+'.async-tmp';await fs.promises.mkdir(path.dirname(p),{recursive:true});await fs.promises.writeFile(tmp,raw,{encoding:'utf8',mode:0o600});await fs.promises.rename(tmp,p);scheduleBackup();return{ok:true}}catch(err){return{ok:false,error:err.message}}});
 ipcMain.on('finance:read-sync',e=>{try{e.returnValue={ok:true,data:readFinanceData()}}catch(err){e.returnValue={ok:false,error:err.message}}});
 ipcMain.on('finance:save-sync',(e,raw)=>{try{e.returnValue=storeFinanceData(raw);scheduleBackup()}catch(err){e.returnValue={ok:false,error:err.message}}});
 ipcMain.handle('invoice:open-browser',async(_e,{html,number})=>{if(typeof html!=='string'||Buffer.byteLength(html)>5*1024*1024)throw Error('Invoice preview too large');const safe=String(number||'invoice').replace(/[^a-z0-9_-]/gi,'-').slice(0,72),dir=path.join(app.getPath('userData'),'invoice-previews');fs.mkdirSync(dir,{recursive:true});const file=path.join(dir,safe+'-'+Date.now()+'.html');fs.writeFileSync(file,html,{encoding:'utf8',mode:0o600});const error=await shell.openPath(file);if(error)throw Error(error);return{opened:true}});
 ipcMain.handle('backup:status',()=>({folder:backupDir(),history:listBackups(),lastBackupAt}));
 ipcMain.handle('backup:choose-folder',async()=>{const r=await dialog.showOpenDialog(mainWindow,{title:'Choose ProfitPilot backup folder',properties:['openDirectory','createDirectory']});if(r.canceled||!r.filePaths.length)return{cancelled:true};const folder=r.filePaths[0];fs.mkdirSync(folder,{recursive:true});fs.writeFileSync(prefsFile(),JSON.stringify({folder}),{mode:0o600});lastBackupAt=0;await backupNowAsync();return{folder}});
 ipcMain.handle('backup:now',()=>backupNowAsync());
 ipcMain.handle('backup:restore',(_e,name)=>restoreBackup(name));
 ipcMain.handle('backup:open-folder',async()=>{const error=await shell.openPath(ensureDir());if(error)throw Error(error);return{ok:true}});
 createWindow();setTimeout(async()=>{try{await backupNowAsync()}catch(e){console.error(e)}},2000);
 app.on('activate',()=>{if(BrowserWindow.getAllWindows().length===0)createWindow()});
});
app.on('before-quit',()=>{if(backupTimer)clearTimeout(backupTimer);backupNowAsync().catch(e=>console.error('Backup on exit:',e))});
app.on('window-all-closed',()=>{if(process.platform!=='darwin')app.quit()});
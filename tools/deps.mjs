#!/usr/bin/env node
/** Detect host render dependencies. The plugin must NOT bundle Chromium/ffmpeg. */
import fs from 'fs';
import { execFileSync } from 'child_process';
const platform = process.platform;

function exists(p) { try { return fs.existsSync(p); } catch { return false; } }
function which(cmd) { try { return execFileSync(platform === 'win32' ? 'where' : 'which', [cmd], { encoding: 'utf8', stdio: ['ignore','pipe','ignore'] }).trim().split(/\r?\n/)[0] || null; } catch { return null; } }

export function detectBrowser() {
  const mac = [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser'
  ];
  const win = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'
  ].filter(exists);
  if (platform === 'darwin') for (const p of mac) if (exists(p)) return {ok:true,path:p,kind:p.includes('Edge')?'edge':p.includes('Brave')?'brave':'chrome'};
  if (platform === 'win32') for (const p of win) return {ok:true,path:p,kind:p.toLowerCase().includes('edge')?'edge':'chrome'};
  for (const cmd of ['google-chrome','google-chrome-stable','chromium','chromium-browser','microsoft-edge']) { const p=which(cmd); if(p)return {ok:true,path:p,kind:cmd.includes('edge')?'edge':'chromium'}; }
  return {ok:false,path:null,kind:null};
}

export function detectFfmpeg() {
  const p = which('ffmpeg');
  if (p) return {ok:true,path:p};
  for (const p of ['/opt/homebrew/bin/ffmpeg','/usr/local/bin/ffmpeg','/usr/bin/ffmpeg']) if (exists(p)) return {ok:true,path:p};
  return {ok:false,path:null};
}

export function detectAll() { return {browser:detectBrowser(),ffmpeg:detectFfmpeg(),node:process.version,platform}; }
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop())) console.log(JSON.stringify(detectAll(),null,2));

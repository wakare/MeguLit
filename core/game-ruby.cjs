// SPDX-License-Identifier: GPL-3.0-or-later
'use strict';
// Readings the game itself prints as ruby (user, 2026-11-03: a kanji has too many readings to guess; the island's name
// is しま, not とう). Learned per work (game executable hash) so later lines without ruby read the same word the same way.
const fs=require('fs'),path=require('path');
const KANA=/[ぁ-ゟァ-ー]/,KANJI=/[\p{Script=Han}々〆]/u;
/* fork (wakare): a reading is kana only, with at least one real kana. ATRI marks emphasis with dots over the word, which came
   through as the "reading" ・・,1 (・ is inside ァ-ー) and was then printed over every 右 of the game. Bad entries already
   saved are dropped on load. */
const READING=/^[ぁ-ゖゝゞァ-ヺーヽヾ・]+$/,REAL_KANA=/[ぁ-ゖァ-ヺ]/;
const goodReading=r=>typeof r==='string'&&READING.test(r)&&REAL_KANA.test(r);
class GameRuby{
 constructor(folder){this.file=folder?path.join(folder,'game-ruby.json'):null;this.works={};
  try{const v=JSON.parse(fs.readFileSync(this.file,'utf8'));if(v&&v.version===1&&v.works&&typeof v.works==='object')this.works=v.works;}catch{}
  let dropped=false;for(const dict of Object.values(this.works))if(dict&&typeof dict==='object')for(const [k,r] of Object.entries(dict))if(!goodReading(r)){delete dict[k];dropped=true;}
  if(dropped)this.save();}
 // Returns the work's whole dictionary (base -> reading) after learning this line's pairs.
 learn(key,pairs){if(!/^[a-f0-9]{64}$/.test(String(key||'')))return {};const dict=this.works[key]||(this.works[key]={});let changed=false;
  for(const [base,reading] of Array.isArray(pairs)?pairs:[]){if(typeof base!=='string'||typeof reading!=='string'||!KANJI.test(base)||!KANA.test(reading)||!goodReading(reading)||base.length>80||reading.length>160)continue;
   if(dict[base]!==reading){dict[base]=reading;changed=true;}}
  const keys=Object.keys(dict);if(keys.length>3000)for(const k of keys.slice(0,keys.length-3000)){delete dict[k];changed=true;}
  if(changed)this.save();return dict;}
 dict(key){return this.works[String(key||'')]||{};}
 save(){if(!this.file)return;clearTimeout(this.timer);this.timer=setTimeout(()=>{try{fs.mkdirSync(path.dirname(this.file),{recursive:true});fs.writeFileSync(this.file+'.tmp',JSON.stringify({version:1,works:this.works}));fs.renameSync(this.file+'.tmp',this.file);}catch{}},500);this.timer.unref?.();}
}
module.exports={GameRuby};

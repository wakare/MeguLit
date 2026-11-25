'use strict';
/* fork (wakare): ATRI's emphasis dots came through as the reading ・・,1 and were printed over every 右. Only kana readings are
   learned, and bad ones already saved are dropped when the file is read. */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {GameRuby}=require('../core/game-ruby.cjs');
const KEY='1c9b98c9d1ef4eb9f07fb8083192dc7b6ca40ccc71534074f46bbb6860ae432a';
test('game ruby: emphasis dots and markup are not readings',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'megulit-ruby-'));
 try{
  const r=new GameRuby(dir);
  const dict=r.learn(KEY,[['右','・・,1'],['右足','・・'],['島','しま'],['移動','コピー'],['夏生','なつき・ゆう']]);
  assert.equal(dict['右'],undefined);assert.equal(dict['右足'],undefined);
  assert.equal(dict['島'],'しま');assert.equal(dict['移動'],'コピー');assert.equal(dict['夏生'],'なつき・ゆう');
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('game ruby: a bad reading saved earlier is dropped on load',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'megulit-ruby-'));
 try{
  fs.writeFileSync(path.join(dir,'game-ruby.json'),JSON.stringify({version:1,works:{[KEY]:{'移動':'コピー','右':'・・,1'}}}));
  const r=new GameRuby(dir);
  assert.deepEqual(r.dict(KEY),{'移動':'コピー'});
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});

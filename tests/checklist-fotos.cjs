const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const root=path.resolve(__dirname,'..');
for(const name of ['gestao','checklist','acessos']){
 const html=fs.readFileSync(path.join(root,'web',name+'.html'),'utf8');
 for(const match of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g))if(match[1].trim())new vm.Script('(async function(){'+match[1].replace(/^import .*;$/gm,'')+'})');
}
const html=fs.readFileSync(path.join(root,'web/checklist.html'),'utf8');
const code=html.slice(html.indexOf('function desenharItem('),html.indexOf('function telaItens('));
function element(tag,text){return{tag,text,children:[],append(...x){this.children.push(...x)},replaceChildren(...x){this.children=x},setAttribute(){},querySelectorAll(){return []}};}
function setup(item,fail=false){
 const requests=[],context={el:element,respostas:new Map(),pendentes:new Set(),pin:'fixture',execucao:'fixture',contarRespostas(){},semRede:e=>e.message,chamar:async body=>{requests.push(body);if(fail)throw Error('sem rede');return{id:1,evidencia_path:body.foto?'fixture.jpg':null}},FileReader:class{readAsDataURL(){this.result='data:image/png;base64,Zml4dHVyZQ==';this.onload()}}};
 vm.createContext(context);vm.runInContext(code,context);
 const box=context.desenharItem(item);
 const flatten=node=>[node,...node.children.flatMap(flatten)];
 return{context,requests,nodes:flatten(box)};
}
async function tick(){await new Promise(resolve=>setImmediate(resolve));}
(async()=>{
 const item={id:'fixture',texto:'Item',resposta:'conforme_nao_conforme',evidencia:'foto_se_nao_conforme',criticidade:'critica'};
 let s=setup(item);let photo=s.nodes.find(x=>x.type==='file');photo.files=[{}];await photo.onchange();await tick();assert.equal(s.requests.length,0,'foto não decide conformidade');
 s.nodes.find(x=>x.text==='Não conforme').onclick();await tick();assert.equal(s.requests[0].valor.conforme,false);assert(s.requests[0].foto);assert.equal(s.context.pendentes.size,0);
 s=setup(item);s.nodes.find(x=>x.text==='Não conforme').onclick();await tick();assert.equal(s.requests.length,0);assert.equal(s.context.pendentes.size,1,'aguarda foto');
 s=setup(item);s.nodes.find(x=>x.text==='Conforme').onclick();await tick();assert.equal(s.requests.length,1);assert.equal(s.context.pendentes.size,0);
 s=setup({...item,evidencia:'foto_obrigatoria'});s.nodes.find(x=>x.text==='Conforme').onclick();await tick();assert.equal(s.requests.length,0);
 s=setup(item,true);s.nodes.find(x=>x.text==='Conforme').onclick();await tick();assert.equal(s.context.respostas.size,0);assert.equal(s.context.pendentes.size,1,'falha não conta como gravado');
 console.log('OK: sintaxe das 3 telas; foto não responde; não conforme aguarda foto; foto obrigatória; conforme sem foto condicional; falha de rede permanece pendente. Sem API real.');
})().catch(e=>{console.error(e);process.exitCode=1});


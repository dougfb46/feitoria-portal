const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const root=path.resolve(__dirname,'..');
function bridge(name,totem=''){
 const html=fs.readFileSync(path.join(root,'web',name+'.html'),'utf8');
 const marker=name==='ponto'?'let identificacaoPortalRecebida':'let identificacaoRecebida';
 const end=name==='ponto'?html.indexOf('</script>',html.indexOf(marker)):html.indexOf('function telaItens(',html.indexOf(marker));
 const handlers={};let calls=0;
 const parent={postMessage(){}};
 const context={window:{parent,addEventListener:(type,fn)=>handlers[type]=fn},document:{addEventListener(){}},location:{origin:'https://fixture.invalid'},TOKEN:'unit',TOKEN_UNIDADE:'unit',TOKEN_TOTEM:totem,pin:'',entrar:()=>calls++,telaPin(){},Date};
 vm.createContext(context);vm.runInContext(html.slice(html.indexOf(marker),end),context);
 const event={origin:context.location.origin,source:parent,data:{tipo:'feitoria-identificar',unidade:'unit',pin:'1111'}};
 return{context,event,send:e=>handlers.message(e),calls:()=>calls};
}
for(const name of ['ponto','checklist']){
 const b=bridge(name);
 b.send({...b.event,origin:'https://other.invalid'});assert.equal(b.context.pin,'');
 b.send({...b.event,source:{}});assert.equal(b.context.pin,'');
 b.send({...b.event,data:{...b.event.data,unidade:'other'}});assert.equal(b.context.pin,'');
 b.send({...b.event,data:{...b.event.data,pin:'invalid'}});assert.equal(b.context.pin,'');
 b.send(b.event);assert.equal(b.context.pin,'1111');
 b.send({...b.event,data:{...b.event.data,pin:'2222'}});assert.equal(b.context.pin,'1111','identificação aceita apenas uma vez');
 if(name==='ponto')assert.equal(b.calls(),1,'abre consulta de ponto, não marca automaticamente');
}
const tablet=bridge('ponto','totem-fixture');tablet.send(tablet.event);assert.equal(tablet.calls(),0);assert.equal(tablet.context.pin,'');
const portal=fs.readFileSync(path.join(root,'web/portal.html'),'utf8');
assert(!/searchParams\.set\(["'](?:pin|nascimento|t)["']/.test(portal));
assert(!/localStorage\.setItem\([^\n]*(?:pin|nascimento)/.test(portal));
assert(portal.includes('if(sessao.registra_ponto)'));
assert(portal.includes('encerrarPortal'));
console.log('OK: origem/janela/unidade/PIN verificados; identificação única; totem mantém entrada própria; nenhum PIN/data de nascimento na URL ou no armazenamento.');

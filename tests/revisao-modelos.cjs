const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname,'..');
const dir = path.join(root,'modelos/revisados-v2');
const allowed = new Set(['titulo','subtitulo','paragrafo','lista','campos','espaco','assinatura']);
const fields = new Set(['empresa.razao_social','empresa.cnpj','empresa.endereco','empresa.cidade','empresa.estado','pessoa.nome','pessoa.cpf','contrato.funcao','contrato.cbo','contrato.admissao','contrato.local_prestacao','contrato.exame_admissional','pessoa.endereco','data.completa']);
const models = [];
for(let n=4;n<=26;n++) {
  const code=String(n).padStart(2,'0');
  const m=JSON.parse(fs.readFileSync(path.join(dir,code+'.json'),'utf8'));
  models.push(m);
  assert.equal(m.codigo,code);
  assert.equal(m.ativo,false);
  assert.equal(m.status_revisao,'minuta_nao_publicada');
  const original=fs.readFileSync(path.join(root,'modelos',code+'.json'));
  assert.equal(m.origem.sha256,crypto.createHash('sha256').update(original.toString('utf8').replace(/\r\n/g,'\n')).digest('hex'));
  for(const b of m.blocos) {
    assert(allowed.has(b.tipo),code+': bloco desconhecido');
    if(['titulo','subtitulo','paragrafo'].includes(b.tipo)) assert.equal(typeof b.texto,'string');
    if(b.tipo==='campos')for(const row of b.itens){assert.equal(typeof row.rotulo,'string');assert.equal(typeof row.valor,'string');}
    if(b.tipo==='assinatura'){assert.equal(typeof b.quem,'string');assert.equal(typeof b.nome,'string');}
  }
  const text=JSON.stringify(m.blocos);
  const markers=[...text.matchAll(/\[\[([^\]]+)\]\]/g)].map(x=>x[1]);
  assert.deepEqual([...new Set(markers)].sort(),[...m.campos_pendentes].sort());
  for(const match of text.matchAll(/\{\{([a-z_.]+)\}\}/g))assert(fields.has(match[1]),code+': campo não reconhecido '+match[1]);
  assert(!/rcassessoria|Goiânia|canteiro|argamassa|\[@gmail\]|2% \(dez/.test(text),code+': resíduo da versão anterior');
  if(['interno','comunicado','reserva'].includes(m.uso))assert(!m.blocos.some(b=>b.tipo==='assinatura'));
}
assert.equal(models.length,23);
const service=models.find(m=>m.codigo==='06');
assert(service.blocos.filter(b=>b.tipo==='assinatura').every(b=>!b.nome.includes('{{pessoa.nome}}')),'06 não pode usar a mesma pessoa como representante de ambas as partes');
const welcome=models.find(m=>m.codigo==='25');
assert(!JSON.stringify(welcome.blocos).includes('{{pessoa.cpf}}'),'Comunicado não pode divulgar CPF');
for(const code of ['14','15','16','21'])assert.equal(models.find(m=>m.codigo===code).uso,'reserva');
assert(JSON.stringify(models.find(m=>m.codigo==='05').blocos).includes('não adota banco de horas'));
console.log('OK: 23 modelos; originais preservados; blocos e marcadores compatíveis; partes da prestação separadas; comunicado sem CPF; modelos de reserva sem assinatura. Nenhuma emissão ou chamada real.');

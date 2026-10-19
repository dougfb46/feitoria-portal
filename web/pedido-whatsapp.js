/** Interpreta apenas linhas explícitas de quantidade/unidade/produto; o usuário revisa. */
export function interpretarPedido(texto){
 const unidades='kg|g|l|ml|un|und|unid|unidades?|cx|caixas?|pct|pacotes?|sacos?|barris|barril|fardos?|garrafas?|embalagens?';
 const inicio=new RegExp('^(\\d+(?:[.,]\\d+)?)\\s*('+unidades+')\\b\\s*(?:de\\s+)?(.+)$','i');
 const fim=new RegExp('^(.+?)\\s*[-–:]?\\s+(\\d+(?:[.,]\\d+)?)\\s*('+unidades+')$','i');
 const itens=[],nao_interpretadas=[];let fornecedor='';
 for(const original of String(texto??'').split(/\r?\n/)){
  const linha=original.trim().replace(/^[-•*]\s*/,'').replace(/\*$/,'');
  if(!linha)continue;
  const f=linha.match(/^fornecedor:\s*(.+)$/i);if(f){fornecedor=f[1];continue;}
  let m=linha.match(inicio),descricao,unidade,q;
  if(m){[,q,unidade,descricao]=m;}else if((m=linha.match(fim))){[,descricao,q,unidade]=m;}
  if(!m||/^\d+\.\d{3}$/.test(q)||Number(q.replace(',','.'))<=0){nao_interpretadas.push(original);continue;}
  itens.push({descricao:descricao.trim(),unidade,quantidade:q.replace(',','.'),preco_unitario:''});
 }
 return {itens,nao_interpretadas,fornecedor};
}

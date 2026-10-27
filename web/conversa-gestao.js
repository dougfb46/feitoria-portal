import {createClient} from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.0/+esm';
const SB='https://kujelbcbrcmkitzyswbh.supabase.co';
// Chave pública do portal. Segredos e acesso a dados permanecem no servidor.
const ANON='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt1amVsYmNicmNta2l0enlzd2JoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg2NDg0MzAsImV4cCI6MjEwNDIyNDQzMH0.uDwckXtywDBZGU_i4J8S9BdO2fUtRwXCOaLJbSiWzdQ';
const sb=createClient(SB,ANON),el=id=>document.getElementById(id),unit=new URLSearchParams(location.search).get('restaurant_id');
let ocupado=false,historico=[],geracao=0;
function status(texto,erro=false){el('status').textContent=texto;el('status').className=erro?'erro':'';}
async function call(acao,b={}){
 const {data,error}=await sb.auth.getSession();if(error||!data.session)throw Error('Entre novamente na gestão para consultar.');
 const r=await fetch(SB+'/functions/v1/assistente-compras',{method:'POST',headers:{'Content-Type':'application/json',apikey:ANON,Authorization:'Bearer '+data.session.access_token},body:JSON.stringify({acao,restaurant_id:unit,...b}),signal:AbortSignal.timeout(100000)});
 let d;try{d=await r.json();}catch{throw Error('O servidor não retornou uma resposta utilizável. Tente novamente.');}
 if(!r.ok)throw Error(d.erro??'Não foi possível consultar.');return d;
}
function mensagem(papel,texto){const a=document.createElement('article');a.className='mensagem '+(papel==='Você'?'usuario':'assistente');const p=document.createElement('p');p.className='papel';p.textContent=papel;const t=document.createElement('p');t.className='texto';t.textContent=texto;a.append(p,t);el('mensagens').append(a);return a;}
function fonteSegura(url){try{const u=new URL(url);return u.origin==='https://dougfb46.github.io'&&u.pathname.startsWith('/feitoria-portal/web/')?u.href:null;}catch{return null;}}
function fontes(a,d){
 const meta=document.createElement('p');meta.className='consulta';meta.textContent=d.empresa.unidade+' · CNPJ '+d.empresa.cnpj+' · '+d.plano.inicio+' a '+d.plano.fim+' · consulta '+new Date(d.consultado_em).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'});a.append(meta);
 const box=document.createElement('div');box.className='fontes';const h=document.createElement('strong');h.textContent='Fontes e cobertura';box.append(h);
 const nomes={disponivel:'Dados disponíveis',sem_base:'Sem base revisada para concluir',indisponivel:'Fonte indisponível',nao_conectada:'Fonte ainda não conectada'};
 for(const f of d.fontes??[]){const p=document.createElement('p'),url=fonteSegura(f.url),titulo=document.createElement(url?'a':'span');titulo.textContent='['+f.id+'] '+f.titulo;if(url){titulo.href=url;titulo.target='_blank';titulo.rel='noopener noreferrer';}p.append(titulo,document.createTextNode(' · '+(nomes[f.situacao]??'Conferir cobertura')));if(f.atualizado)p.append(document.createTextNode(' · atualizado em '+new Date(f.atualizado).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'})));if(f.pendencia){const aviso=document.createElement('span');aviso.className='aviso';aviso.textContent=' — '+f.pendencia;p.append(aviso);}box.append(p);}a.append(box);
}
function bloquear(v){ocupado=v;el('enviar').disabled=v;el('pergunta').disabled=v;document.querySelectorAll('[data-pergunta]').forEach(b=>b.disabled=v);}
function limpar(){geracao++;historico=[];el('mensagens').replaceChildren();el('boas-vindas').hidden=false;el('pergunta').value='';status('');}
el('limpar').onclick=limpar;
document.querySelectorAll('[data-pergunta]').forEach(b=>b.onclick=()=>{el('pergunta').value=b.dataset.pergunta;el('pergunta').focus();});
el('perguntar').onsubmit=async e=>{
 e.preventDefault();if(ocupado)return;const pergunta=el('pergunta').value.trim();if(pergunta.length<3)return;
 const atual=geracao;mensagem('Você',pergunta);el('boas-vindas').hidden=true;bloquear(true);status('Consultando as fontes da unidade…');
 try{const d=await call('conversar',{pergunta,historico,requisicao:crypto.randomUUID()});if(atual!==geracao)return;const a=mensagem('Feitoria',d.texto);fontes(a,d);historico=[...historico,pergunta.slice(0,1000)].slice(-3);el('pergunta').value='';status('Consulta concluída. Confira as fontes e as pendências abaixo da resposta.');a.scrollIntoView({behavior:'smooth',block:'start'});}
 catch(e){if(atual===geracao){mensagem('Feitoria',e.name==='TimeoutError'?'A consulta demorou mais que o esperado. Tente novamente.':e.message);status('A consulta não foi concluída.',true);}}
 finally{bloquear(false);el('pergunta').focus();}
};
sb.auth.onAuthStateChange(event=>{if(event==='SIGNED_OUT'){limpar();el('interface').hidden=true;el('limpar').disabled=true;status('Sessão encerrada. Entre novamente na gestão.',true);}});
async function iniciar(){try{if(!unit||!/^[0-9a-f-]{36}$/i.test(unit))throw Error('Abra esta conversa pela gestão e escolha a unidade.');const d=await call('painel');if(!d.dono)throw Error('Esta conversa é exclusiva do dono da unidade.');el('empresa').textContent=d.unidade+' · '+(d.empresa?.cnpj?'CNPJ '+d.empresa.cnpj:'CNPJ a conferir')+' · acesso do dono';el('interface').hidden=false;el('limpar').disabled=false;if(!d.gemini?.configurado){bloquear(true);status('A conversa aguarda configuração do Gemini no servidor.',true);}else status('Pronto para consultar.');}catch(e){status(e.message,true);}}
iniciar();

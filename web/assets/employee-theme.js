// Preferência visual local; não lê identidade, PIN ou dados da sessão.
(() => {
  const button=document.getElementById('employee-theme');
  function apply(theme){
    document.documentElement.dataset.theme=theme;
    button.setAttribute('aria-label',theme==='dark'?'Ativar tema claro':'Ativar tema escuro');
    button.setAttribute('aria-pressed',String(theme==='dark'));
  }
  let initial='light';
  try {initial=localStorage.getItem('feitoria-employee-theme')||'light'} catch {}
  apply(initial==='dark'?'dark':'light');
  button.addEventListener('click',()=>{
    const next=document.documentElement.dataset.theme==='dark'?'light':'dark';
    apply(next);
    try {localStorage.setItem('feitoria-employee-theme',next)} catch {}
  });
})();

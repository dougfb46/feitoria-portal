# Drive no portal

Na gestão, abra Documentos → Drive. A tela é exclusiva do dono.
Coloque PDFs de até 10 MB na pasta Portal — Para publicar. Buscar novos arquivos cria pendências.
Revisar pede colaborador ativo da unidade, tipo, título e opções de assinatura.
Antes de aprovar, confira o PDF na pasta do Drive. A aprovação valida versão e checksum e guarda cópia fixa no bucket privado.
Alteração no Drive cria outra pendência, preservando a cópia já publicada.
Dispensar exige motivo e fica no histórico; não apaga o arquivo original.

Backup: PDF e JSON de metadados/assinaturas, novos arquivos por versão, com leitura e comparação SHA256.
A pasta deve permanecer restrita ao proprietário; a função interrompe o backup se houver compartilhamento.
Falhas são registradas e tentadas novamente na próxima execução. Cópias verificadas não são substituídas.
Backup automático depende da autorização explícita do dono para exportar dados reais ao Drive.
Em 06/10/2026, o bloqueio está fechado no banco (backup_enabled=false), sem agendamento ativo.
Google Auth em modo Testando pode exigir reconectar após sete dias.

Código interno da função e migrations guardados localmente e publicados somente no Supabase.
A PR pública contém apenas a tela e este guia, sem segredos, documentos ou dados pessoais.

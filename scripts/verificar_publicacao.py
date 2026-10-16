"""Barreira de publicação; não substitui a revisão dos dados exibidos."""
import base64
import json
from pathlib import Path
import re
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
BLOCKED = re.compile(r'(^|/)(supabase|modelos|contratos|drive-integration-private|backups?|exports?)(/|$)|\.(pdf|docx?|xlsx?|csv|zip|sql|env)$|(^|/)\.env', re.I)
SECRETS = [
    re.compile(rb'tk_(?:live|test|mcp_live)_[A-Za-z0-9]{16,}'),
    re.compile(rb'GOCSPX-[A-Za-z0-9_-]{10,}'),
    re.compile(rb'(?:gh[pousr]_[A-Za-z0-9]{25,}|github_pat_[A-Za-z0-9_]{30,})'),
    re.compile(rb'-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----'),
    re.compile(rb'\b\d{3}\.\d{3}\.\d{3}-\d{2}\b'),
]
JWT = re.compile(rb'eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+')


def problemas(path, data, allowed):
    errors = []
    if path not in allowed or BLOCKED.search(path):
        errors.append('arquivo fora da publicação permitida')
    if path.startswith('docs/') and path != 'docs/diario.md':
        errors.append('documentação interna não pode ser publicada')
    if any(pattern.search(data) for pattern in SECRETS):
        errors.append('possível segredo ou CPF; revisar sem imprimir o valor')
    for match in JWT.findall(data):
        try:
            claims = json.loads(base64.urlsafe_b64decode(match.split(b'.')[1] + b'==='))
            if claims.get('role') != 'anon':
                errors.append('token com papel diferente da chave pública anon')
        except (ValueError, TypeError):
            errors.append('token não reconhecido')
    return errors


def main():
    allowed = set(json.loads((ROOT / 'publicacao-permitida.json').read_text(encoding='utf8')))
    tracked = subprocess.check_output(['git', '-c', f'safe.directory={ROOT.as_posix()}', '-C', str(ROOT), 'ls-files', '-z']).decode().split('\0')
    errors = []
    for name in filter(None, tracked):
        path = ROOT / name
        if path.is_symlink():
            errors.append(f'{name}: link simbólico não permitido')
            continue
        for reason in problemas(name, path.read_bytes(), allowed):
            errors.append(f'{name}: {reason}')
    if errors:
        print('\n'.join(errors))
        return 1
    print('Publicação conferida: somente arquivos permitidos, sem padrões bloqueados.')
    return 0


if __name__ == '__main__':
    sys.exit(main())

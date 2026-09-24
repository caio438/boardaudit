# Board de Auditorias VOLUM

Código-fonte do produto de auditorias, formalizações de reuniões e acompanhamento operacional da VOLUM, desenvolvido em Google Apps Script.

## Versão

- Produto: `4.21.0`
- Runtime: Google Apps Script V8
- Fuso horário: `America/Sao_Paulo`

## Estrutura

- `Code.gs`: núcleo da aplicação, configurações e integrações.
- `Index.html`: interface web do board.
- `AuditoriaV3.gs`: geração, análise e automação de auditorias.
- `TranscricaoAudioV4.gs`: fluxo de transcrição de áudios.
- `JornadaCliente.gs`: jornada operacional e entregas dos clientes.
- `PublicacaoCircle.gs` e `PublicacaoComunidade.gs`: prévia e publicação na comunidade.
- `IntegracaoAuditoriasComunidade.gs`: integração das auditorias com a comunidade.
- `ConsumoIA.gs`: controle e acompanhamento do consumo de IA.
- `ReparoBaseV3.gs`: rotinas de reparo, normalização e deduplicação da base.
- `appsscript.json`: manifesto e permissões do Apps Script.
- `check-project.mjs` e arquivos `test-*.mjs`: verificações locais do projeto.

## Configuração e implantação

1. Crie ou abra um projeto no Google Apps Script.
2. Envie os arquivos `.gs`, `Index.html` e `appsscript.json` para o projeto.
3. Cadastre credenciais e tokens somente nas Propriedades do Script ou na área de configurações da aplicação. Não grave segredos no código-fonte.
4. Autorize os escopos definidos em `appsscript.json`.
5. Publique como aplicativo da Web, executando como o usuário que fez a implantação e com acesso restrito ao domínio.

## Validação local

Com Node.js instalado, execute:

```bash
npm ci
npm test
```

## GitHub-only patch runner

O workflow `.github/workflows/apply-chatgpt-patch.yml` permite aplicar uma alteração preparada em uma Issue sem escrever direto na `main`.

A Issue precisa ser criada por `caio438` e conter um único patch unificado entre os marcadores:

```text
<!-- PATCH_START -->
```diff
diff --git a/arquivo b/arquivo
...
```
<!-- PATCH_END -->
```

Depois de revisar o conteúdo da Issue, comente exatamente:

```text
/apply-patch
```

O workflow:
- valida e aplica o patch em branch isolada;
- bloqueia mudanças em workflows, actions, secrets, credenciais e no próprio runner;
- executa `git apply --check`, `git diff --check`, `npm ci` e `npm test`;
- abre um Draft PR somente se tudo passar;
- nunca faz merge;
- nunca faz deploy.

Comentários de outros usuários, Issues criadas por outros usuários e comentários em PRs não acionam o runner.

## Integração segura com o Apps Script

- `.clasp.json` aponta para o projeto correto do Apps Script.
- `.claspignore` limita o envio aos arquivos `.gs`, `.html` e ao manifesto.
- Toda alteração enviada ao GitHub passa pela validação automática.
- O fluxo de produção não é automático: aceita somente a branch `main`, exige a confirmação `APROVAR DEPLOY` e usa o ambiente protegido `apps-script-production`.
- A autenticação do clasp deve existir apenas no secret `CLASPRC_JSON` do GitHub. Nunca grave o conteúdo de `.clasprc.json` no repositório.

Antes do primeiro deploy, configure o ambiente `apps-script-production` com revisores obrigatórios e cadastre o secret `CLASPRC_JSON`. Até isso acontecer, mantenha o workflow apenas como preparação e não o execute.

## Segurança

O repositório contém o código do produto, mas não deve receber tokens do RD Station, Gemini, Circle, Google ou qualquer outra credencial. Esses valores devem permanecer nas Propriedades do Script ou na configuração protegida da aplicação.

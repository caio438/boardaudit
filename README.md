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

## Comando de alteração a partir do chat

O repositório aceita um patch preparado pelo chat sem depender de uma sessão Codex ou de escrita direta na `main`:

1. O chat transforma a solicitação em um patch unificado e cria uma Issue, em nome de `caio438`, contendo exatamente um bloco entre `<!-- PATCH_START -->` e `<!-- PATCH_END -->`.
2. Após revisar a Issue, o proprietário comenta exatamente `/apply-patch`.
3. O workflow cria uma branch `chatgpt/issue-...`, valida e aplica o patch, executa `npm ci` e `npm test` e abre uma PR em modo draft.
4. Depois da revisão e dos checks da PR, o comando `/release-boardaudit` na própria PR executa a cadeia já protegida de merge, validação exata da `main` e release.

Formato da Issue:

````markdown
<!-- PATCH_START -->
```diff
diff --git a/arquivo b/arquivo
...
```
<!-- PATCH_END -->
````

O patch runner bloqueia alterações em workflows/actions, no próprio runner, em arquivos de credenciais/segredos e em caminhos fora do repositório. Ele nunca faz merge, deploy, auditoria real, publicação no RD nem restaura automações operacionais. A etapa de release continua separada e explícita.

## Integração segura com o Apps Script

- `.clasp.json` aponta para o projeto correto do Apps Script.
- `.claspignore` limita o envio aos arquivos `.gs`, `.html` e ao manifesto.
- Toda alteração enviada ao GitHub passa pela validação automática.
- O fluxo de produção não é automático: aceita somente a branch `main`, exige a confirmação `APROVAR DEPLOY` e usa o ambiente protegido `apps-script-production`.
- A autenticação do clasp deve existir apenas no secret `CLASPRC_JSON` do GitHub. Nunca grave o conteúdo de `.clasprc.json` no repositório.

Antes do primeiro deploy, configure o ambiente `apps-script-production` com revisores obrigatórios e cadastre o secret `CLASPRC_JSON`. Até isso acontecer, mantenha o workflow apenas como preparação e não o execute.

## Segurança

O repositório contém o código do produto, mas não deve receber tokens do RD Station, Gemini, Circle, Google ou qualquer outra credencial. Esses valores devem permanecer nas Propriedades do Script ou na configuração protegida da aplicação.

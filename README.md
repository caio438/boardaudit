# Board de Auditorias VOLUM

Código-fonte do produto de auditorias, formalizações de reuniões e acompanhamento operacional da VOLUM, desenvolvido em Google Apps Script.

## Versão

- Produto: `4.15.4`
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
- `check-project.mjs` e `test-closer.mjs`: verificações locais do projeto.

## Configuração e implantação

1. Crie ou abra um projeto no Google Apps Script.
2. Envie os arquivos `.gs`, `Index.html` e `appsscript.json` para o projeto.
3. Cadastre credenciais e tokens somente nas Propriedades do Script ou na área de configurações da aplicação. Não grave segredos no código-fonte.
4. Autorize os escopos definidos em `appsscript.json`.
5. Publique como aplicativo da Web, executando como o usuário que fez a implantação e com acesso restrito ao domínio.

## Validação local

Com Node.js instalado, execute:

```bash
node check-project.mjs
node test-closer.mjs
```

## Segurança

O repositório contém o código do produto, mas não deve receber tokens do RD Station, Gemini, Circle, Google ou qualquer outra credencial. Esses valores devem permanecer nas Propriedades do Script ou na configuração protegida da aplicação.

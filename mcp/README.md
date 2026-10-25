# VOLUM Sales Ops MCP — piloto privado, somente leitura

Servidor MCP independente do Apps Script, usando o SDK oficial v2 e transporte **stdio**.
Permite que um agente de IA consulte o histórico factual de uma negociação RD Station sem
gravar nada no CRM ou alterar o BoardAudit.

## Funcionalidade entregue

- `get_lead_history`: negociação, histórico cronológico, atividades tipadas,
  tarefas (criação e conclusão), entrada nas etapas e registros do board **se um
  snapshot confiável for explicitamente fornecido**. Paginação de resposta.
- `get_lead_evidence`: detalhe de evento por `evidenceId` retornado pela consulta
  anterior, com proveniência e texto sanitizado.
- `audit_sales_ops`: prioridades práticas da etapa, tarefa datada,
  acompanhamento de proposta e limites de inferência. Score global sempre `null`.
- `get_source_coverage`: completude por fonte, limites de paginação, registros
  sem vínculo e atribuição de papel não confirmada.

**Importante:** este piloto consulta o RD diretamente. Ele **não é** uma cópia
do painel Apps Script. Transcrições, anexos, agenda, WhatsApp e o board em
tempo real ainda não estão integrados. Se não houver evidência, o sistema
retorna “não verificável”, não “vendedor descumpriu”.

## Preparação local

Requer Node >=20.19 e uma credencial RD com acesso ao **cliente piloto**,
gerenciada fora do Git e nunca enviada por chat.

```bash
cd mcp
npm install --ignore-scripts
export VOLUM_MCP_CLIENT_KEY='wisetec'
export VOLUM_RD_TOKEN='(valor configurado no cofre local de credenciais)'
npm start
```

O processo serve JSON-RPC via stdin/stdout (MCP `stdio`). Configure seu
host MCP para executar `node /caminho/boardaudit/mcp/src/server.mjs` com
`VOLUM_MCP_CLIENT_KEY` e `VOLUM_RD_TOKEN` no **ambiente privado do host**.
Não configure essas credenciais em arquivos versionados.

**Não existe endpoint público neste piloto.** Para conectar ChatGPT web ou
uma widget remota via MCP será preciso infraestrutura hospedada com
Streamable HTTP, autenticação delegada/OAuth, permissões por cliente,
auditoria de acessos e limites globais de taxa. A extensão Chrome atual
continua usando a Web App privada Apps Script.

## Proveniência e privacidade

- Todas as consultas ao RD usam somente HTTP GET e um host fixo validado;
  redirecionamentos são bloqueados.
- Exige `clientKey` igual ao cliente explicitamente configurado no servidor.
  Cada token deve representar uma única conta RD autorizada.
- Filtra atividades e tarefas por ID de negociação, conta registros sem
  vínculo como lacuna e evita incorporar dados de outras negociações.
- Datas civis sem hora são preservadas sem inventar horário/transformá-las
  no dia anterior.
- Nome de SDR/closer **nunca é inferido** por etapa, assunto de tarefa ou
  presença de ligação. `VOLUM_MCP_ROLES_JSON` opcional pode conter mapa
  previamente **validado** de IDs de usuário para `SDR`/`CLOSER`.
- URLs, e-mails, documentos, telefones e padrões de segredos são sanitizados
  antes de retornar texto. Tokens não aparecem nas respostas.
- Armazenamento apenas em memória, com cache de 60 segundos por lead.
  Sem logs dos conteúdos da negociação e sem comandos de escrita.

## Conexão ao BoardAudit real pelo Google Sheets (opcional)

A partir da versão 0.2.0 o MCP lê os registros do BoardAudit diretamente
pela **API Google Sheets em modo leitura**, sem precisar baixar a planilha
inteira, sempre que as variáveis abaixo estiverem configuradas em um host
privado:

```bash
export VOLUM_MCP_CLIENT_KEY='wisetec'
export VOLUM_RD_TOKEN='(credencial RD armazenada no cofre do host)'
export VOLUM_BOARD_CLIENT_ID='(ID exato do cliente na planilha)'
export VOLUM_BOARD_SPREADSHEET_ID='(ID da planilha autorizada)'
export GOOGLE_APPLICATION_CREDENTIALS='/caminho/privado/service-account-readonly.json'
# Por padrão NÃO ler o conteúdo de transcrições.
export VOLUM_BOARD_TRANSCRIPT_EXCERPTS='NAO'
```

Compartilhe a planilha com o **e-mail de serviço apenas como Leitor**,
usando uma identidade de serviço específica para o MCP. Autorize exclusivamente
o escopo `https://www.googleapis.com/auth/spreadsheets.readonly`. Nunca
coloque o JSON de credenciais ou qualquer token no GitHub, ChatGPT ou ZIP.

O conector pesquisa somente os IDs de cliente e os links CRM das
interações. Depois, consulta os detalhes **apenas das linhas ligadas
simultaneamente ao cliente configurado e ao ID da negociação**.

Também faz reconciliação por `ID_INTERACAO` com as abas `TRANSCRICOES`
e `AUDITORIAS`, expondo apenas status, tipo, contagens e evidências
necessárias. O campo `FUNCAO` do board identifica o papel declarado
(SDR/Closer); não equivale a comprovação de fala, identidade biométrica
ou qualidade do pitch.

Para permitir **excertos** de no máximo 4 transcrições concluídas por
lead, até 4.000 caracteres cada, configure explicitamente
`VOLUM_BOARD_TRANSCRIPT_EXCERPTS=SIM`. O padrão é desabilitado. Conteúdo
parcial não deve ser avaliado como transcrição integral.

O conector é **somente leitura** e o servidor MCP permanece em transporte
privado stdio. Não há endpoint de dados público, não há publicação de
auditorias e não se altera nenhum registro.

**Status de implantação:** código e testes no repositório. A ligação em
tempo real depende de configurar credenciais ADC no host privado e dar
acesso de leitura à planilha. A inspeção feita pela conexão administrativa
nesta sessão não configura, por si só, acesso para o processo MCP.

## Snapshot do board (opcional, fora do repositório)

Para testes offline de chamadas, pode ser definido
`VOLUM_BOARD_SNAPSHOT_FILE=/caminho/privado/arquivo.json`. O arquivo
precisa pertencer ao mesmo cliente/negociação e nunca deve ser commitado.
Formato:

```json
{
  "clientKey": "wisetec",
  "dealId": "6acc888b98976f0023dc583f",
  "complete": false,
  "calls": [
    {
      "id": "evento-confirmado-01",
      "dealId": "6acc888b98976f0023dc583f",
      "at": "2026-10-21T15:30:00Z",
      "durationSeconds": 64,
      "userId": "",
      "taskId": "",
      "hasRecording": false
    }
  ]
}
```

Este modo de snapshot **não** integra o board automaticamente; só usa um arquivo
preparado e validado pela operação. Não usar arquivos sem origem confiável.

## Testes

```bash
node --test mcp/test/core.test.mjs
cd mcp && npm install --ignore-scripts && npm test
```

Inclui regressões de vínculo de lead, ausência de atribuição SDR, proposta
não comprovada, paginação parcial, fuso horário, sanitização e handshake do
protocolo. Os testes usam dados sintéticos, sem tokens reais.

## Plano de evolução

1. Comparar o histórico do RD retornado pelo MCP com o CRM real para um
   conjunto autorizado de negociações Wisetec.
2. Integrar board, transcrições, tldv, propostas e registros de canais com
   vínculos fortes e ownership de SDR/Closer, mantendo permissões por fonte.
3. Adicionar transporte remoto autenticado e homologar regras Sales Ops com
   evidências suficientes antes de classificar conformidade.

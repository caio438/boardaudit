# VOLUM Intelligence - extensão Chrome

Versão 0.3.2: cache persistente por negociação, conta autorizada e implantação privada do Apps Script.

## Atualizar instalação existente
1. Faça backup da URL privada configurada em **Opções da extensão**.
2. Baixe `dist/volum-intelligence-chrome-0.3.2.zip` e extraia para uma pasta local.
3. Abra `chrome://extensions`, ative **Modo do desenvolvedor**, desabilite uma instalação antiga da VOLUM que estiver ativa e escolha **Carregar sem compactação** usando a pasta extraída.
4. Abra **Opções** na nova instalação e informe a URL privada da widget já autorizada.
5. Atualize a aba da negociação do RD Station e abra **VOLUM · Auditar**.

Se estiver usando a mesma pasta de extensão descompactada, pode atualizar os arquivos e clicar em **Recarregar** na extensão em vez de instalar outra. Não mantenha duas instalações ativas em paralelo.

O cache comercial fica localmente no perfil do Chrome, expira em até 60 minutos e conserva no máximo 12 negociações por implantação (até 450 KB cada). O botão **Atualizar auditoria** invalida a entrada e consulta novamente o RD. A análise só é persistida com Histórico visual completo. Nem mensagens enviadas nem auditorias são publicadas automaticamente no CRM.

# Distribuição privada da VOLUM Intelligence

A extensão não é enviada à Chrome Web Store. O pacote fica privado como artefato do GitHub Actions por 90 dias.

## Fluxo

1. Atualize `extensions/volum-intelligence/manifest.json` com uma versão numérica maior.
2. Abra um PR. O workflow valida o Manifest V3, as permissões, o ZIP e os testes da extensão.
3. Após o merge, crie a tag `volum-extension-vX.Y.Z`, exatamente igual à versão do manifest.
4. Baixe o artefato privado `volum-intelligence-X.Y.Z-SHA` no GitHub Actions.
5. Para instalar internamente, extraia o ZIP, abra `chrome://extensions`, ative o Modo do desenvolvedor e use **Carregar sem compactação** na pasta extraída.

O backend privado permanece configurado por navegador, em Opções da extensão. O pacote não contém URL, credencial ou segredo do Apps Script.

## Rollback

Use o último ZIP validado ou restaure o código estável em uma nova versão de manifest. Cada artefato possui ZIP determinístico, metadata de release e SHA do commit para rastreabilidade.

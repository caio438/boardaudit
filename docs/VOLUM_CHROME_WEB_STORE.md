# Distribuição pela Chrome Web Store

A extensão é entregue como item **não listado**. O workflow nunca executa publicação pública.

## Antes da primeira publicação

1. Crie o item no [Painel do desenvolvedor da Chrome Web Store](https://chrome.google.com/webstore/developer/dashboard) e deixe a visibilidade como **Não listado**.
2. Preencha a listagem, a justificativa de permissões e a ficha de privacidade. A extensão usa somente `storage`, `tabs` e `https://crm.rdstation.com/*`; o endereço privado do Apps Script fica apenas no armazenamento local do navegador.
3. Ative a API Chrome Web Store em um projeto Google Cloud, configure OAuth e gere um refresh token com o escopo `https://www.googleapis.com/auth/chromewebstore`. A conta publicadora precisa de verificação em duas etapas.
4. Crie o ambiente protegido `chrome-web-store` no GitHub e adicione os secrets: `CHROME_WEB_STORE_CLIENT_ID`, `CHROME_WEB_STORE_CLIENT_SECRET`, `CHROME_WEB_STORE_REFRESH_TOKEN` e `CHROME_WEB_STORE_EXTENSION_ID`.
5. Defina os testadores confiáveis no painel da Store. Eles poderão instalar a versão de teste; o público não terá acesso.

## Fluxo

- PR, push de tag `volum-extension-vX.Y.Z` e execução manual com `none` criam e validam o ZIP.
- A versão da tag deve ser exatamente a versão de `extensions/volum-intelligence/manifest.json`.
- Somente uma execução manual, aprovada no ambiente `chrome-web-store`, com `trusted_testers` envia o ZIP e o publica para testadores confiáveis.
- Não há caminho de publicação pública neste repositório.

## Rollback

A Chrome Web Store não aceita reduzir o número da versão. Para reverter, restaure o código que funcionava em uma nova branch, aumente `manifest.json.version`, valide o workflow e envie essa nova versão apenas aos testadores confiáveis. Assim, a Store recebe uma versão maior com o código anterior, sem tornar a extensão pública.

/**
 * RECEBIMENTO DE AUDITORIAS — COMUNIDADE VOLUM
 * Este arquivo pertence ao projeto BASE COMUNIDADE VOLUM.
 */

const WEBHOOK_AUDITORIAS = Object.freeze({
  spreadsheetId: '1Qkg5lGRGSKjkssNO9kLE0hzzVRyMAzujqR9qeDS-Zk4',
  chaveToken: 'AUDITORIAS_WEBHOOK_TOKEN',
  chaveAutorEmail: 'AUDITORIAS_AUTOR_EMAIL',
  urlComunidade: 'https://script.google.com/a/macros/govolum.com/s/AKfycbwf2ktFJdtytbQrMZ7BTmnDPAzX4OK190bFPFOMd7rOzrwNC6oSSBb_3mx4OGnvY9g5/exec',
  abaControle: 'INTEGRACOES_AUDITORIAS'
});

function doPost(e) {
  try {
    const requisicao = JSON.parse(String(e && e.postData && e.postData.contents || '{}'));
    const acao = String(requisicao.acao || '').trim().toUpperCase();
    if (acao !== 'PUBLICAR_AUDITORIA') throw new Error('Ação de integração não reconhecida.');
    webhookValidarTokenAuditorias_(requisicao.token);
    return webhookRespostaJson_(webhookPublicarAuditoria_(requisicao.dados || {}));
  } catch (erro) {
    return webhookRespostaJson_({
      sucesso: false,
      mensagem: String(erro && erro.message || erro)
    });
  }
}

function webhookPublicarAuditoria_(dados) {
  const idOrigem = String(dados.idOrigem || '').trim();
  const titulo = String(dados.titulo || '').trim();
  const resumo = String(dados.resumo || '').trim();
  const conteudo = String(dados.conteudo || '').trim();
  const espacoRecebido = String(dados.espaco || '').trim();
  if (!idOrigem || !titulo || !conteudo || !espacoRecebido) {
    throw new Error('A publicação recebida está incompleta.');
  }
  if (conteudo.length > 500000) throw new Error('O conteúdo ultrapassa o limite permitido.');

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) throw new Error('Outra publicação está sendo processada.');
  try {
    const ss = SpreadsheetApp.openById(WEBHOOK_AUDITORIAS.spreadsheetId);
    const controle = webhookGarantirControle_(ss);
    const existente = webhookLocalizarControle_(controle, idOrigem);
    if (existente) {
      return {
        sucesso: true,
        jaPublicado: true,
        postId: existente.ID_POST,
        postUrl: existente.POST_URL || WEBHOOK_AUDITORIAS.urlComunidade,
        mensagem: 'Esta auditoria já estava publicada.'
      };
    }

    const espacos = webhookLerObjetos_(ss.getSheetByName('ESPACOS'));
    const chaveEspaco = webhookNormalizar_(espacoRecebido);
    const espaco = espacos.find(function(item) {
      return String(item.STATUS || '').toUpperCase() === 'ATIVO' && (
        String(item.ID_ESPACO || '') === espacoRecebido ||
        webhookNormalizar_(item.NOME) === chaveEspaco ||
        webhookNormalizar_(item.SLUG) === chaveEspaco
      );
    });
    if (!espaco) throw new Error('O espaço "' + espacoRecebido + '" não foi encontrado na Comunidade VOLUM.');

    const emailAutor = String(
      PropertiesService.getScriptProperties().getProperty(WEBHOOK_AUDITORIAS.chaveAutorEmail) || 'caio@govolum.com'
    ).trim().toLowerCase();
    const usuarios = webhookLerObjetos_(ss.getSheetByName('USUARIOS'));
    const autor = usuarios.find(function(item) {
      return String(item.EMAIL || '').trim().toLowerCase() === emailAutor &&
        String(item.STATUS || '').toUpperCase() === 'ATIVO';
    });
    if (!autor) throw new Error('O autor configurado para as auditorias não foi encontrado.');

    const abaPosts = ss.getSheetByName('POSTS');
    if (!abaPosts) throw new Error('A base de publicações da Comunidade VOLUM não foi encontrada.');
    const cabecalhos = webhookCabecalhos_(abaPosts);
    const agora = new Date();
    const idPost = 'PST-' + Utilities.getUuid();
    const capa = webhookSalvarCapaPublicacao_(dados.capa, idPost);
    const registro = {
      ID_POST: idPost,
      ID_ORGANIZACAO: espaco.ID_ORGANIZACAO,
      ID_ESPACO: espaco.ID_ESPACO,
      ID_AUTOR: autor.ID_USUARIO,
      TITULO: titulo,
      RESUMO: resumo,
      CONTEUDO: conteudo,
      IMAGEM_CAPA_URL: capa.url,
      TIPO_POST: 'AUDITORIA',
      STATUS: 'PUBLICADO',
      FIXADO: false,
      PERMITE_COMENTARIOS: dados.permiteComentarios !== false,
      PUBLICADO_EM: agora,
      CRIADO_EM: agora,
      ATUALIZADO_EM: agora,
      TOPICOS: String(dados.topicos || ''),
      AGENDADO_PARA: '',
      PUBLICADO_POR: autor.NOME,
      ULTIMA_EDICAO_POR: autor.NOME,
      TOTAL_CURTIDAS: 0,
      TOTAL_COMENTARIOS: 0,
      DRIVE_CAPA_ID: capa.id
    };
    abaPosts.appendRow(cabecalhos.map(function(cabecalho) {
      return Object.prototype.hasOwnProperty.call(registro, cabecalho) ? registro[cabecalho] : '';
    }));

    const postUrl = WEBHOOK_AUDITORIAS.urlComunidade;
    controle.aba.appendRow(controle.cabecalhos.map(function(cabecalho) {
      const linha = {
        ID_ORIGEM: idOrigem,
        ID_CLIENTE_ORIGEM: String(dados.idClienteOrigem || ''),
        ID_POST: idPost,
        ID_ESPACO: espaco.ID_ESPACO,
        POST_URL: postUrl,
        STATUS: 'PUBLICADA',
        CRIADO_EM: agora,
        ATUALIZADO_EM: agora
      };
      return linha[cabecalho] || '';
    }));

    return {
      sucesso: true,
      jaPublicado: false,
      postId: idPost,
      postUrl: postUrl,
      espaco: espaco.NOME,
      mensagem: 'Auditoria publicada na Comunidade VOLUM.'
    };
  } finally {
    lock.releaseLock();
  }
}

function webhookSalvarCapaPublicacao_(capa, idPost) {
  if (!capa || !String(capa.base64 || '').trim()) return { id: '', url: '' };
  const mimeType = String(capa.mimeType || '').trim().toLowerCase();
  if (['image/jpeg', 'image/png', 'image/webp'].indexOf(mimeType) < 0) {
    throw new Error('Formato de capa inválido. Use JPG, PNG ou WebP.');
  }
  const base64 = String(capa.base64 || '').replace(/^data:[^;]+;base64,/, '');
  const bytes = Utilities.base64Decode(base64);
  if (!bytes.length || bytes.length > 4 * 1024 * 1024) throw new Error('A capa deve ter no máximo 4 MB.');
  const extensao = mimeType === 'image/png' ? '.png' : mimeType === 'image/webp' ? '.webp' : '.jpg';
  const nome = String(capa.nome || 'capa').replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/\.[^.]+$/, '') || 'capa';
  const pasta = webhookPastaCapas_();
  const arquivo = pasta.createFile(Utilities.newBlob(bytes, mimeType, idPost + '-' + nome + extensao));
  arquivo.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return {
    id: arquivo.getId(),
    url: 'https://drive.google.com/thumbnail?id=' + encodeURIComponent(arquivo.getId()) + '&sz=w1600'
  };
}

function webhookPastaCapas_() {
  const props = PropertiesService.getScriptProperties();
  const idConfigurado = String(props.getProperty('AUDITORIAS_CAPAS_FOLDER_ID') || '').trim();
  if (idConfigurado) return DriveApp.getFolderById(idConfigurado);
  const nome = 'CAPAS_PUBLICACOES_COMUNIDADE';
  const existentes = DriveApp.getFoldersByName(nome);
  const pasta = existentes.hasNext() ? existentes.next() : DriveApp.createFolder(nome);
  props.setProperty('AUDITORIAS_CAPAS_FOLDER_ID', pasta.getId());
  return pasta;
}

function webhookValidarTokenAuditorias_(tokenRecebido) {
  const esperado = String(
    PropertiesService.getScriptProperties().getProperty(WEBHOOK_AUDITORIAS.chaveToken) || ''
  );
  const recebido = String(tokenRecebido || '');
  if (!esperado) throw new Error('O webhook de auditorias ainda não foi configurado.');
  const hashEsperado = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, esperado, Utilities.Charset.UTF_8);
  const hashRecebido = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, recebido, Utilities.Charset.UTF_8);
  if (hashEsperado.length !== hashRecebido.length) throw new Error('Token de integração inválido.');
  let diferenca = 0;
  for (let i = 0; i < hashEsperado.length; i += 1) diferenca |= hashEsperado[i] ^ hashRecebido[i];
  if (diferenca !== 0) throw new Error('Token de integração inválido.');
}

function webhookGarantirControle_(ss) {
  const cabecalhos = ['ID_ORIGEM','ID_CLIENTE_ORIGEM','ID_POST','ID_ESPACO','POST_URL','STATUS','CRIADO_EM','ATUALIZADO_EM'];
  let aba = ss.getSheetByName(WEBHOOK_AUDITORIAS.abaControle);
  if (!aba) aba = ss.insertSheet(WEBHOOK_AUDITORIAS.abaControle);
  if (aba.getLastRow() === 0) aba.getRange(1, 1, 1, cabecalhos.length).setValues([cabecalhos]);
  return { aba: aba, cabecalhos: webhookCabecalhos_(aba) };
}

function webhookLocalizarControle_(controle, idOrigem) {
  const objetos = webhookLerObjetos_(controle.aba);
  return objetos.find(function(item) {
    return String(item.ID_ORIGEM || '') === idOrigem && String(item.STATUS || '').toUpperCase() === 'PUBLICADA';
  }) || null;
}

function webhookCabecalhos_(aba) {
  const ultimaColuna = aba.getLastColumn();
  if (!ultimaColuna) return [];
  return aba.getRange(1, 1, 1, ultimaColuna).getValues()[0].map(function(valor) { return String(valor || '').trim(); });
}

function webhookLerObjetos_(aba) {
  if (!aba || aba.getLastRow() < 2) return [];
  const valores = aba.getDataRange().getValues();
  const cabecalhos = valores.shift().map(function(valor) { return String(valor || '').trim(); });
  return valores.map(function(linha) {
    const objeto = {};
    cabecalhos.forEach(function(cabecalho, indice) { objeto[cabecalho] = linha[indice]; });
    return objeto;
  });
}

function webhookNormalizar_(valor) {
  return String(valor || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
}

function webhookRespostaJson_(objeto) {
  return ContentService
    .createTextOutput(JSON.stringify(objeto))
    .setMimeType(ContentService.MimeType.JSON);
}

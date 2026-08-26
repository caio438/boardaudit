const APP = {
  nome: 'Board de Auditorias VOLUM',
  versao: '4.15.9',
  spreadsheetId: '1s1HWCfqEunoq-iToJMO9mWaZQoYd0FgdT3YqmYrUgck',
  timezone: 'America/Sao_Paulo',
  rdBaseUrl: 'https://crm.rdstation.com/api/v1',
  tldvBaseUrl: 'https://pasta.tldv.io/v1alpha1',
  tldvSyncHours: [6, 10, 12, 14, 16, 18, 20],
  rdTriggerHour: 6,
  rdPageLimit: 200,
  rdMaxPages: 100,
  rdBatchSize: 3,
  rdContinuationMinutes: 1,
  sheets: {
    configuracoes: 'CONFIGURACOES',
    clientes: 'CLIENTES',
    materiaisClientes: 'MATERIAIS_CLIENTES',
    metasClientes: 'METAS_CLIENTES',
    integracoesClientes: 'INTEGRACOES_CLIENTES',
    pitches: 'PITCHES',
    modelosAuditoria: 'MODELOS_AUDITORIA',
    interacoes: 'INTERACOES',
    transcricoes: 'TRANSCRICOES',
    auditorias: 'AUDITORIAS',
    formalizacoes: 'FORMALIZACOES_REUNIAO',
    identificadoresClientes: 'CLIENTE_IDENTIFICADORES',
    reunioesCalendario: 'REUNIOES_CALENDARIO',
    regrasEntregas: 'REGRAS_ENTREGAS_CLIENTE',
    entregasMensais: 'ENTREGAS_MENSAIS',
    diarioClientes: 'DIARIO_CLIENTE',
    otimizacoesClientes: 'OTIMIZACOES_CLIENTE',
    equipeClientes: 'EQUIPE_CLIENTE',
    resumoRd: 'RESUMO_TAREFAS_RD',
    logs: 'LOGS'
  }
};

/**
 * Catálogo oficial documentado no VOLUMBERG em 15/08/2026.
 * A sincronização é sempre aditiva: preserva IDs, materiais e integrações já
 * existentes no AUDIT e nunca inativa clientes que não estejam neste recorte.
 */
const CATALOGO_CLIENTES_VOLUMBERG = Object.freeze([
  { chave: 'c9_compacta_9', nome: 'C9 Compacta 9', aliases: ['C9'] },
  { chave: 'buffet_mais', nome: 'Buffet Mais' },
  { chave: 'gestao_festa', nome: 'Gestão Festa' },
  { chave: 'impostograma', nome: 'Impostograma' },
  { chave: 'rtm', nome: 'RTM' },
  { chave: 'wisetec', nome: 'Wisetec' },
  { chave: 'devyx', nome: 'Devyx' },
  { chave: 'sismaster_madeiras', nome: 'SisMaster Madeiras' },
  { chave: 'sismaster_calhas', nome: 'SisMaster Calhas' },
  { chave: 'bluertec', nome: 'Bluertec' },
  { chave: 'hello_sales', nome: 'Hello Sales' },
  { chave: 'gopliance', nome: 'Gopliance' },
  { chave: 'space_sistemas', nome: 'Space Sistemas' },
  { chave: 'pro_franchising', nome: 'Pro-Franchising', aliases: ['Pro Franchising'] },
  { chave: 'gestqual', nome: 'Gestqual' },
  { chave: 'date_a_home', nome: 'Date A Home' },
  { chave: 'delta_si', nome: 'Delta SI' },
  { chave: 'informaction', nome: 'InformAction' },
  { chave: 'hitecnet', nome: 'Hitecnet' },
  { chave: 'melius', nome: 'Melius' },
  { chave: 'ingee', nome: 'INGEE' },
  { chave: 'semeio_cbi', nome: 'Semeio/CBI', aliases: ['Semeio CBI'] },
  { chave: 'sinergia', nome: 'Sinergia' },
  { chave: 'o_guia_transportes', nome: 'O Guia Transportes', aliases: ['O Guia Digital'] },
  { chave: 'tecnosoft', nome: 'Tecnosoft' },
  { chave: 'siptalk', nome: 'SipTalk', aliases: ['Sip Talk'] },
  { chave: 'liberado_app', nome: 'Liberado App', aliases: ['Liberado', 'LiberadoApp', 'Equity'] },
  { chave: 'ausland', nome: 'Ausland' },
  { chave: 'alphaplanos', nome: 'AlphaPlanos', aliases: ['Alfa Planos', 'Alfaplanos'] },
  { chave: 'assine_mais', nome: 'Assine Mais' },
  { chave: 'manytalks', nome: 'ManyTalks', aliases: ['Many Talks'] },
  { chave: 'conac_flow', nome: 'Conac Flow', aliases: ['Conac'] },
  { chave: 'converta', nome: 'Converta', aliases: ['ConvertaApp', 'Converta App'] },
  { chave: 'assistpay', nome: 'AssistPay', fontePendente: true },
  { chave: 'omno', nome: 'OMNO' },
  { chave: 'mazola_epi', nome: 'Mazola EPI', aliases: ['Mazola', 'Mazzola', 'Mazzola EPI'] },
  { chave: 'nucont', nome: 'Nucont' }
]);

/**
 * Clientes e materiais informados diretamente pelo operador em 23/08/2026.
 * KoreOS ainda não consta no source-registry do VOLUMBERG, mas foi mantido
 * como cadastro complementar para que o diretório enviado não seja perdido.
 */
const CATALOGO_CLIENTES_COMPLEMENTARES = Object.freeze([
  { chave: 'koreos', nome: 'KoreOS', adicional: true }
]);

const CATALOGO_CLIENTES_AUDIT = Object.freeze(
  CATALOGO_CLIENTES_VOLUMBERG.concat(CATALOGO_CLIENTES_COMPLEMENTARES)
);

/** Carteira e equipe recebidas na planilha operacional de 23/08/2026. */
const OPERACAO_CLIENTES_VOLUMBERG = Object.freeze({
  assine_mais: { carteira: 'CAIO', gestores: 'Juliana/João', sdrs: '', closers: '' },
  assistpay: { carteira: 'THIAGO', gestores: '', sdrs: '', closers: '' },
  ausland: { carteira: 'THIAGO', gestores: 'Jaqueline', sdrs: 'Érica', closers: 'Fernanda' },
  bluertec: { carteira: 'CAIO', gestores: 'Carlos Lira/William Camargo/Daniel Yim', sdrs: 'Luciana Matos', closers: 'Luciana Matos/Carlos Lira' },
  buffet_mais: { carteira: 'CAIO', gestores: 'Juliana/João', sdrs: 'Larissa Borges', closers: 'Fabiana Fermino' },
  c9_compacta_9: { carteira: 'CAIO', gestores: 'Jaqueline Sideshalag', sdrs: 'Lucas Vilela', closers: 'Lucas Magno' },
  conac_flow: { carteira: 'THIAGO', gestores: '', sdrs: '', closers: '' },
  date_a_home: { carteira: 'CAIO', gestores: 'Cateno/João Abelha', sdrs: 'Fernanda/Fabiane', closers: 'Fernanda/João' },
  delta_si: { carteira: 'THIAGO', gestores: 'Wlad/Nino', sdrs: 'Henrique', closers: 'Wlad' },
  devyx: { carteira: 'CAIO', gestores: 'Leandro Oliveira', sdrs: 'Beatriz/Mateus', closers: 'Fernanda Santos' },
  gestao_festa: { carteira: 'THIAGO', gestores: 'Juliana/João', sdrs: 'Letícia', closers: 'Fabiana' },
  gestqual: { carteira: 'CAIO', gestores: 'Elias', sdrs: 'Lucas/Wesley', closers: 'Lucas/Wesley' },
  gopliance: { carteira: 'CAIO', gestores: 'Rafael', sdrs: 'Robô', closers: 'Rafael' },
  hello_sales: { carteira: 'THIAGO', gestores: 'Patricia Barizon', sdrs: 'Camila', closers: 'Patricia Barizon' },
  hitecnet: { carteira: 'CAIO', gestores: 'Rute/Jorge/Junior', sdrs: 'Elaine', closers: 'Fernanda' },
  impostograma: { carteira: 'CAIO', gestores: 'Bruno', sdrs: 'Geovana/Hedivânia', closers: 'Adriana/Silvia' },
  informaction: { carteira: 'THIAGO', gestores: 'Álvaro', sdrs: 'Denise', closers: '' },
  ingee: { carteira: 'CAIO', gestores: 'Juliana/Maíra/Jéssica', sdrs: 'Juliana/Maíra/Jéssica', closers: 'Juliana/Maíra/Jéssica' },
  koreos: { carteira: 'CAIO', gestores: 'Lucas', sdrs: 'Gabriel', closers: 'Lucas' },
  liberado_app: { carteira: 'CAIO', gestores: 'Jonas/Milton', sdrs: 'Karen/Nathalia', closers: 'Bruno/Max/Nathalia/Fernando' },
  manytalks: { carteira: 'THIAGO', gestores: '', sdrs: '', closers: '' },
  mazola_epi: { carteira: 'CAIO', gestores: '', sdrs: '', closers: '' },
  melius: { carteira: 'THIAGO', gestores: 'Rafael Nery', sdrs: 'Maria Lisboa', closers: 'Rafael Nery/Daniela' },
  nucont: { carteira: 'CAIO', gestores: 'Luís', sdrs: '', closers: '' },
  omno: { carteira: 'CAIO', gestores: '', sdrs: '', closers: '' },
  pro_franchising: { carteira: 'CAIO', gestores: 'Alexandre', sdrs: 'Wesley', closers: 'Alexandre' },
  rtm: { carteira: 'THIAGO', gestores: 'Ana Carolina', sdrs: 'Tiago', closers: '' },
  siptalk: { carteira: 'CAIO', gestores: 'Rodrigo', sdrs: 'Allanys', closers: 'Kleber/Bruno/Alexandre/Rodrigo' },
  sismaster_calhas: { carteira: 'THIAGO', gestores: 'Jesuíno', sdrs: 'Maria Eduarda', closers: 'Paulinho' },
  sismaster_madeiras: { carteira: 'THIAGO', gestores: 'Jesuíno', sdrs: 'Maria Eduarda', closers: 'Giovana' },
  space_sistemas: { carteira: 'THIAGO', gestores: 'Beatriz', sdrs: 'Jefferson', closers: 'Luis/Priscila' },
  tecnosoft: { carteira: 'CAIO', gestores: 'Rodrigo/Ricardo', sdrs: 'Mateus', closers: 'Luiz/Rodrigo Moreira' },
  wisetec: { carteira: 'THIAGO', gestores: 'Maria Fernanda', sdrs: 'Ezequiel', closers: 'Plinio' }
});

/**
 * Biblioteca inicial de materiais. Um cliente pode ter vários itens e a
 * função informa em qual trilha o material deve aparecer no front.
 */
const MATERIAIS_CATALOGO_VOLUMBERG = Object.freeze({
  c9_compacta_9: [
    { nome: 'Documentos SDR e Vendas', funcao: 'SDR', categoria: 'JORNADA', url: 'https://drive.google.com/drive/folders/1xaBbfdw9QgkZryGyibB0fx0kNhsGvre6' },
    { nome: 'Pitch Closer Inbound V1', funcao: 'CLOSER', categoria: 'PITCH', url: 'https://docs.google.com/document/d/1ImaM1Mt_CVS-5pQBZEx8AyWBdDg8-NGF6r5xI2QqbQI/edit' }
  ],
  buffet_mais: [
    { nome: 'Documentos de pré-vendas', funcao: 'SDR', categoria: 'JORNADA', url: 'https://drive.google.com/drive/folders/1fL5_1tW6bjOGyia-Ip3T0SdzNyI_vDay' },
    { nome: 'Jornada do Closer', funcao: 'CLOSER', categoria: 'JORNADA', url: 'https://drive.google.com/drive/folders/10WtJA1ljMDOvw82e_hsJp5YF-MG9bSsZ' },
    { nome: 'Pitch Closer Inbound V1', funcao: 'CLOSER', categoria: 'PITCH', url: 'https://docs.google.com/document/d/1NymHF5z5nvdzTyU1mWvNmdJCd_R3Vkxhr9nd-dyLm8g/edit' }
  ],
  gestao_festa: [
    { nome: 'Documentos de pré-vendas compartilhados', funcao: 'SDR', categoria: 'JORNADA', url: 'https://drive.google.com/drive/folders/1fL5_1tW6bjOGyia-Ip3T0SdzNyI_vDay' }
  ],
  impostograma: [
    { nome: 'Jornada SDR ITWORKS', funcao: 'SDR', categoria: 'JORNADA', url: 'https://drive.google.com/drive/folders/1G2rAHIvy5_KgyBXXALtyhSA0WnbGnEda' },
    { nome: 'Jornada Closer ITWORKS', funcao: 'CLOSER', categoria: 'JORNADA', url: 'https://drive.google.com/drive/folders/1Gn31iwbPKnjagTj0qhG1VybfbTsYTJ_w' }
  ],
  rtm: [{ nome: 'Jornada do SDR', funcao: 'SDR', categoria: 'JORNADA', url: 'https://drive.google.com/drive/folders/1U-1uFJ_pggE3G_twKqYgAp49MyVDIh1r' }],
  wisetec: [
    { nome: 'Jornada do SDR', funcao: 'SDR', categoria: 'JORNADA', url: 'https://drive.google.com/drive/folders/1L1tFpmO7apl6E90GJblKG5gjh4Hx2deS' },
    { nome: 'Jornada do Closer', funcao: 'CLOSER', categoria: 'JORNADA', url: 'https://drive.google.com/drive/folders/1fNMa4roO-_54pOQvhomWOeIwG7eumNfg' }
  ],
  devyx: [
    { nome: 'Pitch Closer Inbound V1', funcao: 'CLOSER', categoria: 'PITCH', url: 'https://docs.google.com/document/d/1UVwDMsWRmT2Xt0ohRbHwsCYnZavrthoFNY-SemBU9K8/edit' },
    { nome: 'Pitch de Qualificação SDR Inbound V2 - Zoug', funcao: 'SDR', categoria: 'PITCH', url: 'https://docs.google.com/document/d/1xdC_yQs7-cgnjKiiMlVAH3aHoMbXgG5d5H83lS-XgJw/edit' }
  ],
  sismaster_madeiras: [
    { nome: 'Jornada do SDR', funcao: 'SDR', categoria: 'JORNADA', url: 'https://drive.google.com/drive/folders/13KB00lCi6jpDgVtgPhoQUXyLmaXr3Kxn' },
    { nome: 'Jornada do Closer Madeiras', funcao: 'CLOSER', categoria: 'JORNADA', url: 'https://drive.google.com/drive/folders/1IY-JoXNVh41xsknlBidaMacQQoESUHCP' }
  ],
  sismaster_calhas: [
    { nome: 'Jornada do SDR', funcao: 'SDR', categoria: 'JORNADA', url: 'https://drive.google.com/drive/folders/13KB00lCi6jpDgVtgPhoQUXyLmaXr3Kxn' },
    { nome: 'Jornada do Closer Calhas', funcao: 'CLOSER', categoria: 'JORNADA', url: 'https://drive.google.com/drive/folders/1WHjCTFgGUvejLIdPpTi4H5nf_3CRIoKH', status: 'SEM_ACESSO' }
  ],
  bluertec: [
    { nome: 'Jornada do SDR', funcao: 'SDR', categoria: 'JORNADA', url: 'https://drive.google.com/drive/folders/1NYJcZLRhNN6jNbe98ZfzwDH2W0PuK8LV' },
    { nome: 'Jornada do Closer', funcao: 'CLOSER', categoria: 'JORNADA', url: 'https://drive.google.com/drive/folders/17xhz1fFSRY1PLHfFw20GBQ3F8d3NvLbY' }
  ],
  hello_sales: [
    { nome: 'Jornada do SDR', funcao: 'SDR', categoria: 'JORNADA', url: 'https://drive.google.com/drive/folders/1Ibhry55dYDxASkDX7Y2fKlAfM_UPSM-N' },
    { nome: 'Jornada do Closer', funcao: 'CLOSER', categoria: 'JORNADA', url: 'https://drive.google.com/drive/folders/1yIZSE3dEsIh-1wnM9QePyOXS9jdvBekJ' }
  ],
  gopliance: [
    { nome: 'Documentos de pré-vendas', funcao: 'SDR', categoria: 'JORNADA', url: 'https://drive.google.com/drive/folders/1NT7pWz-Lpn8L6uIFQfeuc8eCQ3Jeogx9' },
    { nome: 'Documentos Closer', funcao: 'CLOSER', categoria: 'JORNADA', url: 'https://drive.google.com/drive/folders/1ulWn_UrW-GyAAOfPzD-8vVsKoiu6yA54' }
  ],
  space_sistemas: [
    { nome: 'Jornada do SDR', funcao: 'SDR', categoria: 'JORNADA', url: 'https://drive.google.com/drive/folders/1bInwNbo1toe1m8c_hROMGqguYQ5mZEwg' },
    { nome: 'Jornada do Closer', funcao: 'CLOSER', categoria: 'JORNADA', url: 'https://drive.google.com/drive/folders/1UNVDbbAox98XWxIEC7NJQBceQNiwcvcP' }
  ],
  pro_franchising: [
    { nome: 'Jornada do SDR', funcao: 'SDR', categoria: 'JORNADA', url: 'https://drive.google.com/drive/folders/1AzMHCaVHtlb67JEsufCaLzD34eX2TWxu' },
    { nome: 'Jornada do Closer', funcao: 'CLOSER', categoria: 'JORNADA', url: 'https://drive.google.com/drive/folders/1Q9pzlF9VvvC7B4GBKfSEAk9SAfnvYIUV' }
  ],
  gestqual: [
    { nome: 'Jornada do SDR', funcao: 'SDR', categoria: 'JORNADA', url: 'https://drive.google.com/drive/folders/1nSAN2e8J5r8KkZPWjSNyTkkJAX6jIUnm' },
    { nome: 'Jornada do Closer', funcao: 'CLOSER', categoria: 'JORNADA', url: 'https://drive.google.com/drive/folders/1hsKug5syGkbJABmk528Xthp7N06rXqm5' }
  ],
  date_a_home: [{ nome: 'Jornada do SDR', funcao: 'SDR', categoria: 'JORNADA', url: 'https://drive.google.com/drive/folders/1tFSTqmYgUPFm1h-z_7ggdwIbBdjkk2WB' }],
  delta_si: [{ nome: 'Jornada do SDR', funcao: 'SDR', categoria: 'JORNADA', url: 'https://drive.google.com/drive/folders/1_33UehA-Hp1EbyQ7WjUaY7mKXjqG9clX' }],
  informaction: [
    { nome: 'Jornada do SDR', funcao: 'SDR', categoria: 'JORNADA', url: 'https://drive.google.com/drive/folders/13uL8YCDmVQ3fcw6h_YJzIizUcafNTc4T' },
    { nome: 'Jornada do Closer', funcao: 'CLOSER', categoria: 'JORNADA', url: 'https://drive.google.com/drive/folders/1Pw2wFmgFmLBzNfNJRRfisQFL5CmQNRcY' }
  ],
  hitecnet: [
    { nome: 'Jornada do SDR', funcao: 'SDR', categoria: 'JORNADA', url: 'https://drive.google.com/drive/folders/13DC5DD6QN3y2WZ0u7O7rowrJrmlxtiA_' },
    { nome: 'Jornada do Closer', funcao: 'CLOSER', categoria: 'JORNADA', url: 'https://drive.google.com/drive/folders/1tLroXDIkfWIWid_Acsa7p03fOq-MQuOZ' }
  ],
  melius: [
    { nome: 'Jornada do SDR', funcao: 'SDR', categoria: 'JORNADA', url: 'https://drive.google.com/drive/folders/1kMCHrzJMJKVnzBe3MPM95-jf7VlEsuc3' },
    { nome: 'Jornada do Closer', funcao: 'CLOSER', categoria: 'JORNADA', url: 'https://drive.google.com/drive/folders/1tiaW3vpifRN_RA0IcVSjTy7LFWINxthH' }
  ],
  ingee: [
    { nome: 'Procedimentos SDR', funcao: 'SDR', categoria: 'JORNADA', url: 'https://drive.google.com/drive/folders/1GTgkpQEE6P3DAHaMn1M3HCWv-FWAK311' },
    { nome: 'Procedimentos Closer', funcao: 'CLOSER', categoria: 'JORNADA', url: 'https://drive.google.com/drive/folders/11kzEOpsgHxSPcVBBtir_QGaDhm410ZIJ' }
  ],
  tecnosoft: [
    { nome: 'Jornada do SDR', funcao: 'SDR', categoria: 'JORNADA', url: 'https://drive.google.com/drive/folders/1JezzkU9Htms4icYRvw7ic86f4DsU0j0p' },
    { nome: 'Jornada do Closer', funcao: 'CLOSER', categoria: 'JORNADA', url: 'https://drive.google.com/drive/folders/1mMPKNmvW8oPw6pSR02kTXnzAquThD6La' }
  ],
  siptalk: [
    { nome: 'Jornada do SDR', funcao: 'SDR', categoria: 'JORNADA', url: 'https://drive.google.com/drive/folders/177-vAon2dxfD6d3oxJWjg7bg4UKsZ_LO' },
    { nome: 'Sales Ops / Closer', funcao: 'CLOSER', categoria: 'JORNADA', url: 'https://drive.google.com/drive/folders/13j4p6teEb_KctI-gv6OhgalU2IRje0Q5' }
  ],
  liberado_app: [
    { nome: 'Jornada do SDR', funcao: 'SDR', categoria: 'JORNADA', url: 'https://drive.google.com/drive/folders/1UDuYbGZrYgdYHFuMDoChp-gdRfKm47jZ' },
    { nome: 'Venda Perfeita / Closer', funcao: 'CLOSER', categoria: 'JORNADA', url: 'https://drive.google.com/drive/folders/19Z48nEYQ08guNCMqTyMWRAHN3dhWAaz9' }
  ],
  ausland: [
    { nome: 'Jornada do SDR', funcao: 'SDR', categoria: 'JORNADA', url: 'https://drive.google.com/drive/folders/1744aiGurCH25fOL4W93X7QRuX-hypmYk' },
    { nome: 'Jornada do Closer', funcao: 'CLOSER', categoria: 'JORNADA', url: 'https://drive.google.com/drive/folders/1EyobbUQDZ5PRU6OyGZaZrDicGaqkwH6d' }
  ],
  manytalks: [{ nome: 'Jornada do SDR', funcao: 'SDR', categoria: 'JORNADA', url: 'https://drive.google.com/drive/folders/1Vmb9VfsEXvBpJmseu8OaBGpDf5oxAMDX' }],
  conac_flow: [{ nome: 'Jornada do SDR', funcao: 'SDR', categoria: 'JORNADA', url: 'https://drive.google.com/drive/folders/1eAATpjynRb848R1vYFCvzZbv8Fzr_p0M' }],
  assistpay: [{ nome: 'Jornada do SDR', funcao: 'SDR', categoria: 'JORNADA', url: 'https://drive.google.com/drive/folders/10JqvZTCbO7rM8LRR0-nga5at2gppIghL' }],
  omno: [{ nome: 'Jornada do SDR Outbound', funcao: 'SDR', categoria: 'JORNADA', url: 'https://drive.google.com/drive/folders/1M8726ZT73slgCeA3O0aRI9cwXNCBbzKk' }],
  mazola_epi: [{ nome: 'Jornada do SDR', funcao: 'SDR', categoria: 'JORNADA', url: 'https://drive.google.com/drive/folders/1WbhSrlEHyLri2WsXVSgVViuN1Pkj5ttL' }],
  nucont: [{ nome: 'Jornada do SDR', funcao: 'SDR', categoria: 'JORNADA', url: 'https://drive.google.com/drive/folders/1y3bZDg8S5WRyDpl0G4fOayOHCSzrs2K0' }],
  koreos: [
    { nome: 'Jornada do SDR', funcao: 'SDR', categoria: 'JORNADA', url: 'https://drive.google.com/drive/folders/12J8Xt-aPkv3w15-nYh3mE6vnmGeWOCXy' },
    { nome: 'Jornada do Closer', funcao: 'CLOSER', categoria: 'JORNADA', url: 'https://drive.google.com/drive/folders/1ZO0eVyLIzcPWuTxPkHz0Xa8vs0P6QoHL' }
  ]
});

/**
 * FUNÇÃO GLOBAL PRINCIPAL.
 * Pode ser executada para instalar ou reparar a estrutura,
 * mas a rotina diária do RD é criada automaticamente pelo front
 * quando uma integração RD é salva.
 */
function EXECUTAR_SISTEMA() {
  criarEstruturaBanco_();
  const jornada = typeof INSTALAR_JORNADA_CLIENTE === 'function'
    ? INSTALAR_JORNADA_CLIENTE()
    : null;
  const diagnosticoBanco = validarEstruturaBanco_();

  return {
    sucesso: true,
    mensagem: 'Estrutura do sistema e áreas dos clientes instaladas. Nenhuma API externa foi consultada.',
    versao: APP.versao,
    banco: diagnosticoBanco,
    jornada: jornada
  };
}

function doGet(e) {
  const parametros = e && e.parameter ? e.parameter : {};

  if (String(parametros.debug || '') === '1') {
    return ContentService
      .createTextOutput(JSON.stringify(obterDiagnosticoSistema_(), null, 2))
      .setMimeType(ContentService.MimeType.JSON);
  }

  return HtmlService
    .createHtmlOutputFromFile('Index')
    .setTitle(APP.nome)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function VISUALIZAR_DADOS_SISTEMA() {
  return obterDiagnosticoSistema_();
}

function obterDiagnosticoSistema_() {
  const ss = abrirPlanilha_();
  const propriedades = PropertiesService.getScriptProperties().getProperties();

  const abas = ss.getSheets().map(aba => {
    const ultimaLinha = aba.getLastRow();
    const ultimaColuna = aba.getLastColumn();
    const cabecalhos = ultimaColuna > 0
      ? aba.getRange(1, 1, 1, ultimaColuna).getDisplayValues()[0]
      : [];

    return {
      nome: aba.getName(),
      linhasComDados: Math.max(0, ultimaLinha - 1),
      ultimaLinha: ultimaLinha,
      ultimaColuna: ultimaColuna,
      cabecalhos: cabecalhos.filter(valor => valor !== '')
    };
  });

  const configuracoes = lerObjetos_(APP.sheets.configuracoes).map(item => ({
    chave: item.CHAVE,
    valor: item.VALOR,
    atualizadoEm: serializarData_(item.ATUALIZADO_EM)
  }));

  const clientes = listarClientes().map(item => ({
    idCliente: item.idCliente,
    nomeCliente: item.nomeCliente,
    status: item.status,
    rdAtivo: item.rdAtivo,
    rdStatus: item.rdStatus,
    rdTokenConfigurado: item.rdConfigurado
  }));

  const acionadores = ScriptApp.getProjectTriggers().map(trigger => ({
    funcao: trigger.getHandlerFunction(),
    tipoEvento: String(trigger.getEventType()),
    origemEvento: String(trigger.getTriggerSource()),
    idUnico: trigger.getUniqueId()
  }));

  return {
    sistema: {
      nome: APP.nome,
      versao: APP.versao,
      spreadsheetId: APP.spreadsheetId,
      timezone: APP.timezone,
      geradoEm: serializarData_(new Date())
    },
    abas: abas,
    configuracoes: configuracoes,
    clientes: clientes,
    acionadores: acionadores,
    integracoesConfiguradas: {
      TLDV_API_KEY: Boolean(propriedades.TLDV_API_KEY),
      GEMINI_API_KEY: Boolean(propriedades.GEMINI_API_KEY),
      API4COM_API_KEY: Boolean(propriedades.API4COM_API_KEY),
      RD_TOKENS_CONFIGURADOS: clientes.filter(cliente => cliente.rdTokenConfigurado).length
    }
  };
}

function reformularBaseDados_() {
  const props = PropertiesService.getScriptProperties();
  if (props.getProperty('MIGRACAO_V2_CONCLUIDA') === 'SIM') {
    return { sucesso: true, ignorada: true, mensagem: 'A migração da versão 2.0.0 já foi executada.' };
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const antigos = lerObjetosSeExistir_(APP.sheets.pitches);
    criarAbasAusentes_();
    const oficiais = obterCabecalhosOficiais_();

    reformularAbaPreservandoDados_(APP.sheets.pitches, oficiais[APP.sheets.pitches]);
    reformularAbaPreservandoDados_(APP.sheets.auditorias, oficiais[APP.sheets.auditorias]);

    antigos.forEach((item, indice) => {
      if (!item.ID_PITCH) return;
      const jaExiste = localizarObjeto_(APP.sheets.pitches, 'ID_PITCH', item.ID_PITCH);
      const tipoAntigo = String(item.TIPO_AUDITORIA || '').toUpperCase();
      const tipo = tipoAntigo.indexOf('CLOSER') >= 0 ? 'CLOSER' : 'SDR';
      const agora = new Date();
      const convertido = {
        ID_PITCH: item.ID_PITCH,
        ID_CLIENTE: item.ID_CLIENTE || '',
        TIPO_PITCH: tipo,
        NOME_VERSAO: item.NOME_PITCH || ('Versão migrada ' + (indice + 1)),
        NUMERO_VERSAO: String(indice + 1),
        CONTEUDO_PITCH: item.CONTEUDO_PITCH || '',
        DATA_VIGENCIA_INICIO: '',
        DATA_VIGENCIA_FIM: '',
        PITCH_ATUAL: 'NAO',
        STATUS: item.STATUS || 'ATIVO',
        CRIADO_EM: item.CRIADO_EM || agora,
        ATUALIZADO_EM: agora
      };
      if (jaExiste) atualizarPorCampo_(APP.sheets.pitches, 'ID_PITCH', item.ID_PITCH, convertido);
      else adicionarObjeto_(APP.sheets.pitches, convertido);
    });

    props.setProperty('MIGRACAO_V2_CONCLUIDA', 'SIM');
    salvarConfiguracao_('APP_VERSAO', APP.versao);
    limparCachesDados_();
    registrarLog_('SISTEMA', 'MIGRACAO_V2', 'Migração de pitches versionados concluída.');
    return { sucesso: true, mensagem: 'Base atualizada para pitches versionados e auditorias com Google Docs.' };
  } finally {
    lock.releaseLock();
  }
}

function obterCabecalhosOficiais_() {
  const estruturas = {};

  estruturas[APP.sheets.configuracoes] = [
    'CHAVE', 'VALOR', 'ATUALIZADO_EM'
  ];

  estruturas[APP.sheets.clientes] = [
    'ID_CLIENTE', 'NOME_CLIENTE', 'TIPO_OPERACAO', 'PRODUTO_SERVICO',
    'REGRAS_CLIENTE', 'STATUS', 'CRIADO_EM', 'ATUALIZADO_EM',
    'CHAVE_VOLUMBERG', 'URL_MATERIAIS', 'URL_PASTA_GRAVACOES',
    'URL_PASTA_TRANSCRICOES', 'CARTEIRA_VOLUM', 'EXECUTOR_VOLUM'
  ];

  estruturas[APP.sheets.materiaisClientes] = [
    'ID_MATERIAL', 'ID_CLIENTE', 'CHAVE_VOLUMBERG', 'NOME_MATERIAL',
    'FUNCAO', 'CATEGORIA', 'TIPO_LINK', 'URL', 'STATUS', 'ORIGEM',
    'ORDEM', 'CRIADO_EM', 'ATUALIZADO_EM'
  ];

  estruturas[APP.sheets.metasClientes] = [
    'ID_META', 'ID_CLIENTE', 'PERIODO', 'ESCOPO', 'RESPONSAVEL',
    'META_RECEITA', 'META_VENDAS', 'META_REUNIOES', 'META_OPORTUNIDADES',
    'META_LIGACOES', 'META_PROPOSTAS', 'OBSERVACOES', 'STATUS',
    'CRIADO_EM', 'ATUALIZADO_EM'
  ];

  estruturas[APP.sheets.integracoesClientes] = [
    'ID_INTEGRACAO', 'ID_CLIENTE', 'TIPO_INTEGRACAO', 'ATIVO', 'STATUS',
    'ULTIMO_ERRO', 'ULTIMA_SINCRONIZACAO', 'CONFIG_JSON', 'CRIADO_EM',
    'ATUALIZADO_EM'
  ];

  estruturas[APP.sheets.pitches] = [
    'ID_PITCH', 'ID_CLIENTE', 'TIPO_PITCH', 'NOME_VERSAO',
    'NUMERO_VERSAO', 'CONTEUDO_PITCH', 'DATA_VIGENCIA_INICIO',
    'DATA_VIGENCIA_FIM', 'PITCH_ATUAL', 'STATUS', 'URL_DOCUMENTO',
    'CRIADO_EM', 'ATUALIZADO_EM'
  ];

  estruturas[APP.sheets.modelosAuditoria] = [
    'ID_MODELO', 'NOME_MODELO', 'ID_CLIENTE', 'TIPO_AUDITORIA',
    'PROMPT_AUDITORIA', 'CRITERIOS_JSON', 'VERSAO_MODELO', 'STATUS',
    'CRIADO_EM', 'ATUALIZADO_EM'
  ];

  estruturas[APP.sheets.interacoes] = [
    'ID_INTERACAO', 'FONTE', 'ID_EXTERNO', 'TIPO_INTERACAO', 'ID_CLIENTE',
    'VENDEDOR', 'LEAD', 'TITULO', 'DATA_INTERACAO', 'DURACAO_SEGUNDOS',
    'LINK_ORIGINAL', 'URL_GRAVACAO', 'STATUS_TRANSCRICAO',
    'STATUS_AUDITORIA', 'IMPORTADO_EM', 'ATUALIZADO_EM',
    'NOME_ARQUIVO_ORIGEM', 'EMPRESA_ARQUIVO', 'NUMERO_CHAMADA',
    'COLABORADOR', 'FUNCAO', 'OPORTUNIDADE', 'LINK_CRM', 'SCHEMA_VERSAO',
    'PARTICIPANTES_JSON', 'DESCRICAO_ORIGEM'
  ];

  estruturas[APP.sheets.transcricoes] = [
    'ID_TRANSCRICAO', 'ID_INTERACAO', 'FONTE', 'IDIOMA', 'CONTEUDO',
    'TAMANHO_CARACTERES', 'STATUS', 'ERRO', 'IMPORTADO_EM', 'ATUALIZADO_EM'
  ];

  estruturas[APP.sheets.auditorias] = [
    'ID_AUDITORIA', 'ID_INTERACAO', 'ID_TRANSCRICAO', 'ID_CLIENTE',
    'ID_PITCH', 'TIPO_AUDITORIA', 'NOME_PITCH_SNAPSHOT',
    'VERSAO_PITCH_SNAPSHOT', 'CONTEUDO_PITCH_SNAPSHOT',
    'PROMPT_SNAPSHOT', 'STATUS', 'RESULTADO_COMPLETO', 'SCORE',
    'SEMAFORO', 'ID_DOCUMENTO', 'LINK_DOCUMENTO', 'ERRO',
    'SOLICITADO_EM', 'CONCLUIDO_EM', 'ID_MODELO',
    'NOME_MODELO_SNAPSHOT', 'VERSAO_MODELO_SNAPSHOT',
    'CRITERIOS_SNAPSHOT_JSON', 'RESULTADO_JSON', 'SCORE_PERCENTUAL',
    'ITENS_AVALIADOS', 'ITENS_NA', 'DURACAO_PROCESSAMENTO_MS',
    'CIRCLE_STATUS', 'CIRCLE_POST_ID', 'CIRCLE_POST_URL',
    'CIRCLE_PUBLICADO_EM', 'CIRCLE_ERRO',
    'COMUNIDADE_STATUS', 'COMUNIDADE_POST_ID', 'COMUNIDADE_POST_URL',
    'COMUNIDADE_PUBLICADO_EM', 'COMUNIDADE_ERRO'
  ];

  estruturas[APP.sheets.formalizacoes] = [
    'ID_FORMALIZACAO', 'ID_INTERACAO', 'ID_TRANSCRICAO', 'ID_CLIENTE',
    'TITULO', 'TIPO_REUNIAO', 'DATA_REUNIAO', 'PARTICIPANTES_JSON', 'STATUS',
    'RESULTADO_JSON', 'ERRO', 'SOLICITADO_EM', 'ATUALIZADO_EM',
    'APROVADO_EM', 'CIRCLE_STATUS', 'CIRCLE_POST_ID', 'CIRCLE_POST_URL',
    'CIRCLE_PUBLICADO_EM', 'CIRCLE_ERRO', 'COMUNIDADE_STATUS',
    'COMUNIDADE_POST_ID', 'COMUNIDADE_POST_URL', 'COMUNIDADE_PUBLICADO_EM',
    'COMUNIDADE_ERRO'
  ];

  estruturas[APP.sheets.identificadoresClientes] = [
    'ID_IDENTIFICADOR', 'ID_CLIENTE', 'TIPO', 'VALOR', 'VALOR_NORMALIZADO',
    'PRIORIDADE', 'ATIVO', 'ORIGEM', 'CRIADO_EM', 'ATUALIZADO_EM'
  ];

  estruturas[APP.sheets.reunioesCalendario] = [
    'ID_REUNIAO', 'ID_CLIENTE', 'CALENDAR_ID', 'EVENTO_ID', 'TITULO',
    'TIPO_REUNIAO', 'INICIO', 'FIM', 'ORGANIZADOR', 'PARTICIPANTES_JSON',
    'MEET_URL', 'MEETING_CODE', 'CONFERENCE_RECORD', 'STATUS',
    'CONFIANCA_CLIENTE', 'MOTIVO_IDENTIFICACAO', 'GRAVACAO_URL',
    'TRANSCRICAO_URL', 'ID_INTERACAO', 'ID_TRANSCRICAO', 'ERRO_MEET',
    'ORIGEM', 'SINCRONIZADO_EM', 'ATUALIZADO_EM'
  ];

  estruturas[APP.sheets.regrasEntregas] = [
    'ID_REGRA', 'ID_CLIENTE', 'TIPO_ENTREGA', 'ESCOPO', 'NOME',
    'QUANTIDADE_MENSAL', 'DIA_LIMITE', 'OBRIGATORIA', 'ATIVA',
    'CRIADO_EM', 'ATUALIZADO_EM'
  ];

  estruturas[APP.sheets.entregasMensais] = [
    'ID_ENTREGA', 'ID_CLIENTE', 'PERIODO', 'ID_REGRA', 'TIPO_ENTREGA',
    'ESCOPO', 'NOME', 'ORDEM_MES', 'DATA_LIMITE', 'STATUS', 'ORIGEM',
    'ID_REUNIAO', 'ID_AUDITORIA', 'ID_FORMALIZACAO', 'LINK_DOCUMENTO',
    'LINK_CIRCLE', 'PUBLICADO_EM', 'RESPONSAVEL', 'OBSERVACOES',
    'CONCLUIDO_EM', 'CRIADO_EM', 'ATUALIZADO_EM'
  ];

  estruturas[APP.sheets.diarioClientes] = [
    'ID_REGISTRO', 'ID_CLIENTE', 'DATA_HORA', 'TITULO', 'DESCRICAO',
    'CATEGORIA', 'ESCOPO', 'ORIGEM', 'ID_ORIGEM', 'LINK_REFERENCIA',
    'AUTOR', 'LEVAR_PROXIMA_REUNIAO', 'STATUS', 'CRIADO_EM', 'ATUALIZADO_EM'
  ];

  estruturas[APP.sheets.otimizacoesClientes] = [
    'ID_OTIMIZACAO', 'ID_CLIENTE', 'ESCOPO', 'TITULO', 'PROBLEMA',
    'EVIDENCIA', 'HIPOTESE', 'ACAO', 'COMO_EXECUTAR', 'RESPONSAVEL',
    'PRIORIDADE', 'INDICADOR', 'LINHA_BASE', 'RESULTADO_ESPERADO',
    'DATA_INICIO', 'DATA_REVISAO', 'PRAZO', 'STATUS', 'RESULTADO_OBSERVADO',
    'DECISAO', 'ID_REGISTRO_DIARIO', 'ID_ORIGEM', 'CRIADO_EM', 'ATUALIZADO_EM'
  ];

  estruturas[APP.sheets.equipeClientes] = [
    'ID_MEMBRO', 'ID_CLIENTE', 'NOME', 'PAPEL', 'EMAIL', 'TELEFONE',
    'LIDER_ID', 'ATIVO', 'DATA_INICIO', 'DATA_FIM', 'OBSERVACOES',
    'CRIADO_EM', 'ATUALIZADO_EM'
  ];

  estruturas[APP.sheets.resumoRd] = [
    'CHAVE_UNICA', 'DATA_REFERENCIA', 'ID_CLIENTE', 'CLIENTE',
    'RESPONSAVEL_ID', 'RESPONSAVEL', 'TOTAL_TAREFAS', 'CONCLUIDAS',
    'PENDENTES', 'LIGACOES', 'EMAILS', 'WHATSAPP', 'REUNIOES',
    'VISITAS', 'TAREFAS', 'ALMOCOS', 'OUTROS', 'STATUS',
    'SINCRONIZADO_EM', 'ERRO'
  ];

  estruturas[APP.sheets.logs] = [
    'DATA_HORA', 'MODULO', 'ACAO', 'DETALHE'
  ];

  return estruturas;
}

function criarAbasAusentes_() {
  const ss = abrirPlanilha_();
  const estruturas = obterCabecalhosOficiais_();

  Object.keys(estruturas).forEach(nome => {
    let aba = ss.getSheetByName(nome);
    if (!aba) aba = ss.insertSheet(nome);

    const cabecalhos = estruturas[nome];
    if (aba.getMaxColumns() < cabecalhos.length) {
      aba.insertColumnsAfter(aba.getMaxColumns(), cabecalhos.length - aba.getMaxColumns());
    }

    if (aba.getLastRow() === 0 || aba.getRange(1, 1).getDisplayValue() === '') {
      aba.getRange(1, 1, 1, cabecalhos.length).setValues([cabecalhos]);
    } else {
      const existentes = aba
        .getRange(1, 1, 1, Math.max(aba.getLastColumn(), 1))
        .getDisplayValues()[0]
        .map(String);
      const repetidos = existentes.filter((item, indice) => item && existentes.indexOf(item) !== indice);
      if (repetidos.length) {
        throw new Error('Cabeçalhos duplicados na aba ' + nome + ': ' + [...new Set(repetidos)].join(', '));
      }
      const ausentes = cabecalhos.filter(cabecalho => !existentes.includes(cabecalho));
      if (ausentes.length) {
        const inicio = existentes.length + 1;
        if (aba.getMaxColumns() < existentes.length + ausentes.length) {
          aba.insertColumnsAfter(aba.getMaxColumns(), existentes.length + ausentes.length - aba.getMaxColumns());
        }
        aba.getRange(1, inicio, 1, ausentes.length).setValues([ausentes]);
      }
    }
    aba.setFrozenRows(1);
    const cabecalhosFinais = aba.getRange(1, 1, 1, aba.getLastColumn()).getDisplayValues()[0].map(String);
    ['SCHEMA_VERSAO', 'PARTICIPANTES_JSON'].forEach(campoTexto => {
      const indice = cabecalhosFinais.indexOf(campoTexto);
      if (indice >= 0 && aba.getMaxRows() > 1) {
        aba.getRange(2, indice + 1, aba.getMaxRows() - 1, 1).setNumberFormat('@');
      }
    });
  });
}

function validarEstruturaBanco_() {
  const ss = abrirPlanilha_();
  const oficiais = obterCabecalhosOficiais_();
  const chavesPrimarias = {};
  chavesPrimarias[APP.sheets.clientes] = 'ID_CLIENTE';
  chavesPrimarias[APP.sheets.integracoesClientes] = 'ID_INTEGRACAO';
  chavesPrimarias[APP.sheets.pitches] = 'ID_PITCH';
  chavesPrimarias[APP.sheets.modelosAuditoria] = 'ID_MODELO';
  chavesPrimarias[APP.sheets.interacoes] = 'ID_INTERACAO';
  chavesPrimarias[APP.sheets.transcricoes] = 'ID_TRANSCRICAO';
  chavesPrimarias[APP.sheets.auditorias] = 'ID_AUDITORIA';
  chavesPrimarias[APP.sheets.formalizacoes] = 'ID_FORMALIZACAO';
  chavesPrimarias[APP.sheets.identificadoresClientes] = 'ID_IDENTIFICADOR';
  chavesPrimarias[APP.sheets.reunioesCalendario] = 'ID_REUNIAO';
  chavesPrimarias[APP.sheets.regrasEntregas] = 'ID_REGRA';
  chavesPrimarias[APP.sheets.entregasMensais] = 'ID_ENTREGA';
  chavesPrimarias[APP.sheets.diarioClientes] = 'ID_REGISTRO';
  chavesPrimarias[APP.sheets.otimizacoesClientes] = 'ID_OTIMIZACAO';
  chavesPrimarias[APP.sheets.equipeClientes] = 'ID_MEMBRO';

  const erros = [];
  const avisos = [];
  const tabelas = {};

  Object.keys(oficiais).forEach(nome => {
    const aba = ss.getSheetByName(nome);
    if (!aba) {
      erros.push('Aba ausente: ' + nome);
      return;
    }
    const cabecalhos = aba.getRange(1, 1, 1, Math.max(aba.getLastColumn(), 1)).getDisplayValues()[0].map(String);
    const faltantes = oficiais[nome].filter(cabecalho => !cabecalhos.includes(cabecalho));
    const repetidos = cabecalhos.filter((item, indice) => item && cabecalhos.indexOf(item) !== indice);
    if (faltantes.length) erros.push(nome + ' sem colunas: ' + faltantes.join(', '));
    if (repetidos.length) erros.push(nome + ' com cabeçalhos duplicados: ' + [...new Set(repetidos)].join(', '));

    const registros = lerObjetos_(nome);
    const chave = chavesPrimarias[nome];
    if (chave) {
      const vistos = {};
      registros.forEach(item => {
        const id = String(item[chave] || '').trim();
        if (!id) avisos.push(nome + ' possui registro sem ' + chave + '.');
        else vistos[id] = (vistos[id] || 0) + 1;
      });
      Object.keys(vistos).filter(id => vistos[id] > 1).forEach(id =>
        erros.push(nome + ' possui chave primária duplicada: ' + id)
      );
    }
    tabelas[nome] = { registros: registros.length, colunas: cabecalhos.filter(Boolean).length };
  });

  const clientes = lerObjetos_(APP.sheets.clientes);
  const nomes = {};
  clientes.forEach(item => {
    const nome = normalizarTextoComparacao_(item.NOME_CLIENTE);
    if (nome) nomes[nome] = (nomes[nome] || 0) + 1;
  });
  Object.keys(nomes).filter(nome => nomes[nome] > 1).forEach(nome =>
    erros.push('CLIENTES possui nome normalizado duplicado: ' + nome)
  );

  const idsClientes = new Set(clientes.map(item => String(item.ID_CLIENTE || '').trim()).filter(Boolean));
  [APP.sheets.materiaisClientes, APP.sheets.metasClientes, APP.sheets.integracoesClientes,
    APP.sheets.pitches, APP.sheets.interacoes, APP.sheets.auditorias, APP.sheets.formalizacoes, APP.sheets.resumoRd,
    APP.sheets.identificadoresClientes, APP.sheets.reunioesCalendario, APP.sheets.regrasEntregas,
    APP.sheets.entregasMensais, APP.sheets.diarioClientes, APP.sheets.otimizacoesClientes,
    APP.sheets.equipeClientes]
    .forEach(nome => lerObjetos_(nome).forEach(item => {
      const idCliente = String(item.ID_CLIENTE || '').trim();
      if (idCliente && !idsClientes.has(idCliente)) {
        erros.push(nome + ' referencia cliente inexistente: ' + idCliente);
      }
    }));

  const paresIntegracao = {};
  lerObjetos_(APP.sheets.integracoesClientes).forEach(item => {
    const chave = String(item.ID_CLIENTE || '') + '|' + String(item.TIPO_INTEGRACAO || '').toUpperCase();
    if (chave !== '|') paresIntegracao[chave] = (paresIntegracao[chave] || 0) + 1;
  });
  Object.keys(paresIntegracao).filter(chave => paresIntegracao[chave] > 1).forEach(chave =>
    erros.push('INTEGRACOES_CLIENTES possui conexão duplicada para cliente e provedor: ' + chave)
  );

  const pitchesAtuais = {};
  lerObjetos_(APP.sheets.pitches).forEach(item => {
    if (!normalizarBooleano_(item.PITCH_ATUAL)) return;
    const chave = String(item.ID_CLIENTE || '') + '|' + String(item.TIPO_PITCH || '').toUpperCase();
    pitchesAtuais[chave] = (pitchesAtuais[chave] || 0) + 1;
  });
  Object.keys(pitchesAtuais).filter(chave => pitchesAtuais[chave] > 1).forEach(chave =>
    erros.push('PITCHES possui mais de uma versão atual para cliente e tipo: ' + chave)
  );

  const interacoesExternas = {};
  lerObjetos_(APP.sheets.interacoes).forEach(item => {
    const idExterno = String(item.ID_EXTERNO || '').trim();
    if (!idExterno) return;
    const chave = String(item.FONTE || '').toUpperCase() + '|' + idExterno;
    interacoesExternas[chave] = (interacoesExternas[chave] || 0) + 1;
  });
  Object.keys(interacoesExternas).filter(chave => interacoesExternas[chave] > 1).forEach(chave =>
    erros.push('INTERACOES possui origem e ID externo duplicados: ' + chave)
  );

  return {
    valido: erros.length === 0,
    versaoSchema: APP.versao,
    tabelas: tabelas,
    erros: erros,
    avisos: avisos,
    verificadoEm: new Date().toISOString()
  };
}

function reformularAbaPreservandoDados_(nomeAba, novosCabecalhos) {
  const ss = abrirPlanilha_();
  let aba = ss.getSheetByName(nomeAba);
  if (!aba) aba = ss.insertSheet(nomeAba);

  const dadosAntigos = lerObjetosSeExistir_(nomeAba);
  const linhas = dadosAntigos.map(item =>
    novosCabecalhos.map(cabecalho => item[cabecalho] !== undefined ? item[cabecalho] : '')
  );

  aba.clearContents();

  if (aba.getMaxColumns() < novosCabecalhos.length) {
    aba.insertColumnsAfter(aba.getMaxColumns(), novosCabecalhos.length - aba.getMaxColumns());
  }

  aba.getRange(1, 1, 1, novosCabecalhos.length).setValues([novosCabecalhos]);
  if (linhas.length) {
    aba.getRange(2, 1, linhas.length, novosCabecalhos.length).setValues(linhas);
  }

  if (aba.getMaxColumns() > novosCabecalhos.length) {
    aba.deleteColumns(novosCabecalhos.length + 1, aba.getMaxColumns() - novosCabecalhos.length);
  }

  aba.setFrozenRows(1);
  aba.getRange(1, 1, 1, novosCabecalhos.length)
    .setFontWeight('bold')
    .setHorizontalAlignment('center');
}

function migrarIntegracoesRdAntigas_(clientesAntigos, acoes) {
  const agora = new Date();
  let migradas = 0;

  clientesAntigos.forEach(cliente => {
    if (!cliente.ID_CLIENTE) return;

    const possuiDadosRd = normalizarBooleano_(cliente.RD_ATIVO) ||
      cliente.RD_STATUS || cliente.RD_ULTIMO_ERRO ||
      obterSegredo_('RD_TOKEN_' + cliente.ID_CLIENTE);

    if (!possuiDadosRd) return;

    const integracao = obterOuCriarIntegracaoCliente_(cliente.ID_CLIENTE, 'RD_STATION', {
      ATIVO: normalizarBooleano_(cliente.RD_ATIVO) ? 'SIM' : 'NAO',
      STATUS: cliente.RD_STATUS || 'CONFIGURADA',
      ULTIMO_ERRO: cliente.RD_ULTIMO_ERRO || '',
      ULTIMA_SINCRONIZACAO: cliente.RD_ULTIMA_SINCRONIZACAO || '',
      CONFIG_JSON: JSON.stringify({ modo: 'RESUMIDO_DIARIO' }),
      ATUALIZADO_EM: agora
    });

    const tokenAntigo = obterSegredo_('RD_TOKEN_' + cliente.ID_CLIENTE);
    if (tokenAntigo) {
      salvarSegredo_('INTEGRACAO_TOKEN_' + integracao.ID_INTEGRACAO, tokenAntigo);
      PropertiesService.getScriptProperties().deleteProperty('RD_TOKEN_' + cliente.ID_CLIENTE);
    }
    migradas++;
  });

  if (migradas) acoes.push(migradas + ' integração(ões) RD migrada(s).');
}

function migrarTranscricoesAntigas_(interacoesAntigas, acoes) {
  let migradas = 0;

  interacoesAntigas.forEach(interacao => {
    const conteudo = String(interacao.TRANSCRICAO || '').trim();
    if (!interacao.ID_INTERACAO || !conteudo) return;

    const existente = localizarObjeto_(APP.sheets.transcricoes, 'ID_INTERACAO', interacao.ID_INTERACAO);
    if (existente) return;

    adicionarObjeto_(APP.sheets.transcricoes, {
      ID_TRANSCRICAO: gerarId_('TRN'),
      ID_INTERACAO: interacao.ID_INTERACAO,
      FONTE: interacao.FONTE || '',
      IDIOMA: 'pt-BR',
      CONTEUDO: conteudo,
      TAMANHO_CARACTERES: conteudo.length,
      STATUS: 'DISPONIVEL',
      ERRO: '',
      IMPORTADO_EM: interacao.IMPORTADO_EM || new Date(),
      ATUALIZADO_EM: new Date()
    });
    migradas++;
  });

  if (migradas) acoes.push(migradas + ' transcrição(ões) migrada(s).');
}

function tratarAbasLegadas_(ss, nomes, acoes) {
  nomes.forEach(nome => {
    const aba = ss.getSheetByName(nome);
    if (!aba) return;

    const possuiDados = aba.getLastRow() > 1 ||
      String(aba.getRange('A1').getDisplayValue() || '').trim() !== '';

    if (!possuiDados && ss.getSheets().length > 1) {
      ss.deleteSheet(aba);
      acoes.push('Aba vazia ' + nome + ' excluída.');
      return;
    }

    let novoNome = 'LEGADO_' + nome.replace(/[^A-Za-z0-9_]/g, '_');
    let contador = 1;
    while (ss.getSheetByName(novoNome)) {
      novoNome = 'LEGADO_' + nome.replace(/[^A-Za-z0-9_]/g, '_') + '_' + contador++;
    }
    aba.setName(novoNome);
    acoes.push('Aba ' + nome + ' preservada como ' + novoNome + '.');
  });
}

function limparAcionadoresDuplicados_() {
  const agrupados = {};
  ScriptApp.getProjectTriggers().forEach(trigger => {
    const funcao = trigger.getHandlerFunction();
    if (!agrupados[funcao]) agrupados[funcao] = [];
    agrupados[funcao].push(trigger);
  });

  Object.keys(agrupados).forEach(funcao => {
    agrupados[funcao].slice(1).forEach(trigger => ScriptApp.deleteTrigger(trigger));
  });
}

/* =========================================================
   INSTALAÇÃO E BANCO
========================================================= */

function abrirPlanilha_() {
  return SpreadsheetApp.openById(APP.spreadsheetId);
}

function criarEstruturaBanco_() {
  criarAbasAusentes_();
  salvarConfiguracaoSeVazia_('APP_VERSAO', APP.versao);
  salvarConfiguracaoSeVazia_('RD_HORA_EXECUCAO', String(APP.rdTriggerHour));
}

/* =========================================================
   CACHE DE DADOS
========================================================= */

function obterCacheJson_(chave) {
  try {
    const texto = CacheService.getScriptCache().get(String(chave));
    if (!texto) return null;
    return JSON.parse(texto);
  } catch (erro) {
    registrarLog_('CACHE', 'ERRO_LEITURA', String(chave) + ': ' + erro.message);
    return null;
  }
}

function salvarCacheJson_(chave, valor, segundos) {
  try {
    const texto = JSON.stringify(valor);

    // O CacheService aceita valores limitados. Quando o conteúdo ultrapassar
    // esse limite, o sistema apenas segue sem cache, sem bloquear o front.
    if (texto.length > 90000) return false;

    CacheService.getScriptCache().put(
      String(chave),
      texto,
      Math.max(1, Number(segundos || 120))
    );

    return true;
  } catch (erro) {
    registrarLog_('CACHE', 'ERRO_GRAVACAO', String(chave) + ': ' + erro.message);
    return false;
  }
}

function limparCachesDados_() {
  try {
    CacheService.getScriptCache().removeAll([
      'CACHE_CLIENTES',
      'CACHE_PITCHES',
      'CACHE_REUNIOES',
      'CACHE_RESUMO_RD',
      'CACHE_DASHBOARD',
      'CACHE_AREA_CLIENTE'
    ]);
  } catch (erro) {
    registrarLog_('CACHE', 'ERRO_LIMPEZA', erro.message);
  }
}

function listarClientesCache_() {
  let dados = obterCacheJson_('CACHE_CLIENTES');
  if (dados) return dados;

  dados = listarClientes();
  salvarCacheJson_('CACHE_CLIENTES', dados, 180);
  return dados;
}

function listarPitchesCache_() {
  let dados = obterCacheJson_('CACHE_PITCHES');
  if (dados) return dados;

  dados = listarPitches();
  salvarCacheJson_('CACHE_PITCHES', dados, 180);
  return dados;
}

function listarReunioesCache_() {
  let dados = obterCacheJson_('CACHE_REUNIOES');
  if (dados) return dados;

  dados = listarReunioes_();
  salvarCacheJson_('CACHE_REUNIOES', dados, 120);
  return dados;
}

function listarResumoRdCache_() {
  let dados = obterCacheJson_('CACHE_RESUMO_RD');
  if (dados) return dados;

  dados = listarResumoRd_();
  salvarCacheJson_('CACHE_RESUMO_RD', dados, 120);
  return dados;
}

/* =========================================================
   FRONT
========================================================= */

function obterDadosIniciais() {
  // Inicialização mínima: não lê planilha, não verifica acionadores
  // e não consulta nenhuma API. O HTML abre imediatamente.
  return {
    app: {
      nome: APP.nome,
      versao: APP.versao
    }
  };
}

function carregarDadosClientes() {
  return {
    clientes: listarClientesCache_(),
    automacaoRd: obterStatusAutomacaoRd_()
  };
}

function carregarDadosPitches() {
  return { clientes: listarClientes(), pitches: listarPitches() };
}

function carregarDadosAuditorias(opcoes) {
  opcoes = opcoes || {};
  const clientes = listarClientesCache_();
  const interacoes = listarInteracoesComTranscricao_(clientes);
  const configuracoes = Array.isArray(opcoes.configuracoes)
    ? opcoes.configuracoes
    : lerObjetos_(APP.sheets.configuracoes);
  const mapaConfiguracoes = {};
  configuracoes.forEach(item => { mapaConfiguracoes[String(item.CHAVE || '')] = item.VALOR; });
  return {
    clientes: clientes,
    materiais: listarMateriaisClientes_(),
    metas: listarMetasClientes_(),
    formalizacoesResumo: typeof formalListarFront_ === 'function' ? formalListarFront_() : [],
    pitches: listarPitchesCache_(),
    interacoes: interacoes,
    auditorias: opcoes.omitirAuditorias ? [] : listarAuditorias_(),
    integracoesClientes: listarIntegracoesClientesBasico_(),
    catalogoVolumberg: obterResumoCatalogoVolumberg_(),
    configuracao: {
      promptSdr: mapaConfiguracoes.PROMPT_AUDITORIA_SDR || '',
      promptCloser: mapaConfiguracoes.PROMPT_AUDITORIA_CLOSER || '',
      pastaDriveId: mapaConfiguracoes.PASTA_AUDITORIAS_DRIVE_ID || '',
      geminiConfigurado: Boolean(obterSegredo_('GEMINI_API_KEY')),
      geminiModel: mapaConfiguracoes.GEMINI_MODEL || 'gemini-2.5-flash-lite'
    }
  };
}

function carregarDadosReunioes() {
  return {
    reunioes: listarReunioesCache_(),
    tldvConfigurado: Boolean(obterSegredo_('TLDV_API_KEY')),
    automacaoTldv: obterStatusAutomacaoTldv_()
  };
}

function carregarDadosResumoRd() {
  return {
    clientes: listarClientesCache_(),
    resumoRd: listarResumoRdCache_(),
    ligacoesRd: listarLigacoesRd_(),
    automacaoRd: obterStatusAutomacaoRd_(),
    automacaoLigacoes: typeof obterStatusAutomacaoLigacoesV3 === 'function'
      ? obterStatusAutomacaoLigacoesV3()
      : null
  };
}

function carregarDadosIntegracoes() {
  // Nesta tela a lista de clientes não pode depender de cache, acionadores,
  // credenciais ou do estado de outras integrações.
  const clientes = lerObjetos_(APP.sheets.clientes)
    .filter(item => item.ID_CLIENTE)
    .map(item => ({
      idCliente: item.ID_CLIENTE,
      nomeCliente: item.NOME_CLIENTE,
      status: item.STATUS || 'ATIVO'
    }))
    .sort((a, b) => String(a.nomeCliente).localeCompare(String(b.nomeCliente)));

  // A listagem da tela não consulta segredos. O cofre só é acessado ao testar
  // ou executar cada integração, evitando bloquear a interface.
  const integracoesClientes = listarIntegracoesClientesBasico_();

  let integracoesGerais = {
    tldvConfigurado: false,
    geminiConfigurado: false,
    api4comConfigurado: false,
    circleConfigurado: false,
    circleAuthorEmail: '',
    geminiModel: 'gemini-2.5-flash-lite'
  };
  const auditoria = { promptSdr: '', promptCloser: '', pastaDriveId: '' };

  return {
    integracoes: integracoesGerais,
    clientes: clientes,
    integracoesClientes: integracoesClientes,
    auditoria: auditoria
  };
}

/**
 * Leitura mínima e independente para o seletor da tela de integrações.
 * Não depende de cache, acionadores ou leitura de segredos.
 */
function carregarClientesParaIntegracoes() {
  return {
    clientes: lerObjetos_(APP.sheets.clientes)
      .filter(item => item.ID_CLIENTE)
      .map(item => ({
        idCliente: item.ID_CLIENTE,
        nomeCliente: item.NOME_CLIENTE,
        status: item.STATUS || 'ATIVO'
      }))
      .sort((a, b) => String(a.nomeCliente).localeCompare(String(b.nomeCliente)))
  };
}

function atualizarDashboard() {
  let dashboard = obterCacheJson_('CACHE_DASHBOARD');
  if (!dashboard) {
    dashboard = obterResumoDashboard_();
    salvarCacheJson_('CACHE_DASHBOARD', dashboard, 120);
  }

  return {
    dashboard: dashboard,
    automacaoRd: obterStatusAutomacaoRd_()
  };
}

function obterResumoDashboard_() {
  const interacoes = lerObjetos_(APP.sheets.interacoes);
  const auditorias = lerObjetos_(APP.sheets.auditorias);
  const resumoRd = lerObjetos_(APP.sheets.resumoRd);
  const clientes = listarClientes();

  const hoje = Utilities.formatDate(new Date(), APP.timezone, 'yyyy-MM-dd');
  const inicioMes = hoje.slice(0, 7);

  const tarefasMes = resumoRd
    .filter(item => String(item.DATA_REFERENCIA || '').slice(0, 7) === inicioMes)
    .reduce((soma, item) => soma + Number(item.TOTAL_TAREFAS || 0), 0);

  return {
    totalReunioes: interacoes.filter(item => item.FONTE === 'TLDV').length,
    totalLigacoes: interacoes.filter(item => item.FONTE === 'API4COM').length,
    auditoriasConcluidas: auditorias.filter(item => item.STATUS === 'CONCLUIDA').length,
    auditoriasPendentes: auditorias.filter(item => item.STATUS === 'PENDENTE').length,
    tarefasRdMes: tarefasMes,
    clientesRdAtivos: clientes.filter(item => item.rdAtivo && item.status === 'ATIVO').length
  };
}

/* =========================================================
   CLIENTES E RD POR CLIENTE
========================================================= */

function listarClientes(integracoesInformadas, materiaisInformados, clientesInformados) {
  const integracoes = Array.isArray(integracoesInformadas)
    ? integracoesInformadas
    : lerObjetos_(APP.sheets.integracoesClientes);
  const materiais = listarMateriaisClientes_(materiaisInformados);
  const mapaRd = {};

  integracoes
    .filter(item => item.TIPO_INTEGRACAO === 'RD_STATION')
    .forEach(item => { mapaRd[item.ID_CLIENTE] = item; });

  const clientesBase = Array.isArray(clientesInformados)
    ? clientesInformados
    : lerObjetos_(APP.sheets.clientes);

  return clientesBase
    .filter(item => item.ID_CLIENTE)
    .map(item => {
      const rd = mapaRd[item.ID_CLIENTE] || {};
      const integracoesCliente = integracoes.filter(integracao =>
        String(integracao.ID_CLIENTE) === String(item.ID_CLIENTE)
      );
      const materiaisCliente = materiais.filter(material =>
        String(material.idCliente) === String(item.ID_CLIENTE)
      );

      return {
        idCliente: item.ID_CLIENTE,
        nomeCliente: item.NOME_CLIENTE,
        chaveVolumberg: item.CHAVE_VOLUMBERG || '',
        carteiraVolum: item.CARTEIRA_VOLUM || '',
        executorVolum: item.EXECUTOR_VOLUM || '',
        urlMateriais: item.URL_MATERIAIS || '',
        urlPastaGravacoes: item.URL_PASTA_GRAVACOES || '',
        urlPastaTranscricoes: item.URL_PASTA_TRANSCRICOES || '',
        totalMateriais: materiaisCliente.length,
        materiaisSdr: materiaisCliente.filter(material => material.funcao === 'SDR').length,
        materiaisCloser: materiaisCliente.filter(material => material.funcao === 'CLOSER').length,
        materiaisPendentes: materiaisCliente.filter(material => material.status !== 'ATIVO').length,
        tipoOperacao: item.TIPO_OPERACAO,
        produtoServico: item.PRODUTO_SERVICO,
        regrasCliente: item.REGRAS_CLIENTE,
        rdAtivo: normalizarBooleano_(rd.ATIVO),
        rdConfigurado: Boolean(rd.ID_INTEGRACAO && obterSegredo_('INTEGRACAO_TOKEN_' + rd.ID_INTEGRACAO)),
        rdStatus: rd.STATUS || '',
        rdUltimoErro: rd.ULTIMO_ERRO || '',
        rdUltimaSincronizacao: serializarData_(rd.ULTIMA_SINCRONIZACAO),
        totalIntegracoes: integracoesCliente.length,
        integracoesAtivas: integracoesCliente.filter(integracao => normalizarBooleano_(integracao.ATIVO)).length,
        status: item.STATUS || 'ATIVO'
      };
    });
}

function salvarCliente(dados) {
  dados = dados || {};

  const nome = String(dados.nomeCliente || '').trim();
  if (!nome) throw new Error('Informe o nome do cliente.');

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const idInformado = String(dados.idCliente || '').trim();
    const nomeNormalizado = normalizarTextoComparacao_(nome);
    const clientes = lerObjetos_(APP.sheets.clientes);
    const existentePorId = idInformado
      ? clientes.find(item => String(item.ID_CLIENTE || '') === idInformado)
      : null;
    const existentePorNome = clientes.find(item =>
      normalizarTextoComparacao_(item.NOME_CLIENTE) === nomeNormalizado
    );
    if (existentePorId && existentePorNome && existentePorId.ID_CLIENTE !== existentePorNome.ID_CLIENTE) {
      throw new Error('Já existe outro cliente com esse nome. Edite o cadastro existente.');
    }

    const existente = existentePorId || existentePorNome || null;
    const id = existente ? String(existente.ID_CLIENTE) : gerarId_('CLI');
    const agora = new Date();
    const objeto = {
      ID_CLIENTE: id,
      NOME_CLIENTE: nome,
      TIPO_OPERACAO: String(dados.tipoOperacao || '').trim(),
      PRODUTO_SERVICO: String(dados.produtoServico || '').trim(),
      REGRAS_CLIENTE: String(dados.regrasCliente || '').trim(),
      STATUS: String(dados.status || 'ATIVO').trim(),
      CRIADO_EM: existente ? existente.CRIADO_EM : agora,
      ATUALIZADO_EM: agora,
      CHAVE_VOLUMBERG: existente ? String(existente.CHAVE_VOLUMBERG || '') : '',
      URL_MATERIAIS: String(dados.urlMateriais || (existente && existente.URL_MATERIAIS) || '').trim(),
      CARTEIRA_VOLUM: String(dados.carteiraVolum || (existente && existente.CARTEIRA_VOLUM) || '').trim().toUpperCase(),
      EXECUTOR_VOLUM: String(dados.executorVolum || (existente && existente.EXECUTOR_VOLUM) || '').trim()
    };

    if (existente) atualizarPorCampo_(APP.sheets.clientes, 'ID_CLIENTE', id, objeto);
    else adicionarObjeto_(APP.sheets.clientes, objeto);

    limparCachesDados_();
    registrarLog_('CLIENTES', 'SALVAR', 'Cliente salvo: ' + nome);
    return {
      sucesso: true,
      mensagem: existente ? 'Cliente atualizado com sucesso.' : 'Cliente salvo com sucesso.',
      idCliente: id,
      clientes: listarClientesCache_(),
      automacaoRd: obterStatusAutomacaoRd_()
    };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Cadastro rápido usado pela interface simplificada.
 * Cria o cliente e, quando informados, cria os pitches atuais SDR e Closer.
 * Não altera nem exclui versões antigas de outros clientes.
 */
function normalizarTextoComparacao_(valor) {
  return String(valor || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function localizarDuplicidadePitch_(pitches, idCliente, tipo, nomeVersao, conteudo, idIgnorar) {
  const nomeNormalizado = normalizarTextoComparacao_(nomeVersao);

  return (pitches || []).find(item => {
    if (String(item.ID_CLIENTE || '') !== String(idCliente || '')) return false;
    if (String(item.TIPO_PITCH || '').toUpperCase() !== String(tipo || '').toUpperCase()) return false;
    if (idIgnorar && String(item.ID_PITCH || '') === String(idIgnorar)) return false;

    return Boolean(
      nomeNormalizado &&
      normalizarTextoComparacao_(item.NOME_VERSAO) === nomeNormalizado
    );
  }) || null;
}

function salvarClienteComPitches(dados) {
  dados = dados || {};

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    criarEstruturaBanco_();

    const nomeCliente = String(dados.nomeCliente || '').trim();
    const pitchSdr = String(dados.pitchSdr || '').trim();
    const pitchCloser = String(dados.pitchCloser || '').trim();
    const nomeVersao = String(dados.nomeVersao || 'Pitch inicial').trim();

    if (!nomeCliente) throw new Error('Informe o nome do cliente.');

    const agora = new Date();
    const dataHoje = Utilities.formatDate(agora, APP.timezone, 'yyyy-MM-dd');
    const clientesExistentes = lerObjetos_(APP.sheets.clientes);
    const idSolicitado = String(dados.idCliente || '').trim();
    const clienteExistente = clientesExistentes.find(item =>
      idSolicitado
        ? String(item.ID_CLIENTE) === idSolicitado
        : String(item.NOME_CLIENTE || '').trim().toLowerCase() === nomeCliente.toLowerCase()
    );

    const idCliente = clienteExistente
      ? String(clienteExistente.ID_CLIENTE)
      : gerarId_('CLI');

    const objetoCliente = {
      ID_CLIENTE: idCliente,
      NOME_CLIENTE: nomeCliente,
      TIPO_OPERACAO: clienteExistente ? clienteExistente.TIPO_OPERACAO || '' : '',
      PRODUTO_SERVICO: clienteExistente ? clienteExistente.PRODUTO_SERVICO || '' : '',
      REGRAS_CLIENTE: clienteExistente ? clienteExistente.REGRAS_CLIENTE || '' : '',
      STATUS: 'ATIVO',
      CRIADO_EM: clienteExistente ? clienteExistente.CRIADO_EM : agora,
      ATUALIZADO_EM: agora
    };

    if (clienteExistente) {
      atualizarPorCampo_(APP.sheets.clientes, 'ID_CLIENTE', idCliente, objetoCliente);
    } else {
      adicionarObjeto_(APP.sheets.clientes, objetoCliente);
    }

    const pitchesExistentes = lerObjetos_(APP.sheets.pitches);

    const duplicidades = [];
    if (pitchSdr) {
      const duplicadoSdr = localizarDuplicidadePitch_(
        pitchesExistentes, idCliente, 'SDR', nomeVersao, pitchSdr, ''
      );
      if (duplicadoSdr) {
        duplicidades.push(
          'SDR: já existe a versão "' + duplicadoSdr.NOME_VERSAO + '" para este cliente.'
        );
      }
    }
    if (pitchCloser) {
      const duplicadoCloser = localizarDuplicidadePitch_(
        pitchesExistentes, idCliente, 'CLOSER', nomeVersao, pitchCloser, ''
      );
      if (duplicadoCloser) {
        duplicidades.push(
          'Closer: já existe a versão "' + duplicadoCloser.NOME_VERSAO + '" para este cliente.'
        );
      }
    }
    if (duplicidades.length) {
      throw new Error(
        'Pitch duplicado. ' + duplicidades.join(' ') +
        ' Use outro nome de versão antes de salvar.'
      );
    }

    function criarVersaoPitch_(tipo, conteudo) {
      if (!conteudo) return;

      const pitchesDoTipo = pitchesExistentes.filter(item =>
        String(item.ID_CLIENTE) === idCliente &&
        String(item.TIPO_PITCH || '').toUpperCase() === tipo
      );

      pitchesDoTipo.forEach(item => {
        if (normalizarBooleano_(item.PITCH_ATUAL)) {
          atualizarPorCampo_(APP.sheets.pitches, 'ID_PITCH', item.ID_PITCH, {
            PITCH_ATUAL: 'NAO',
            ATUALIZADO_EM: agora
          });
        }
      });

      const maiorVersao = pitchesDoTipo.reduce((maior, item) => {
        const numero = Number(item.NUMERO_VERSAO || 0);
        return numero > maior ? numero : maior;
      }, 0);

      adicionarObjeto_(APP.sheets.pitches, {
        ID_PITCH: gerarId_('PIT'),
        ID_CLIENTE: idCliente,
        TIPO_PITCH: tipo,
        NOME_VERSAO: nomeVersao,
        NUMERO_VERSAO: String(maiorVersao + 1),
        CONTEUDO_PITCH: conteudo,
        DATA_VIGENCIA_INICIO: dataHoje,
        DATA_VIGENCIA_FIM: '',
        PITCH_ATUAL: 'SIM',
        STATUS: 'ATIVO',
        CRIADO_EM: agora,
        ATUALIZADO_EM: agora
      });
    }

    criarVersaoPitch_('SDR', pitchSdr);
    criarVersaoPitch_('CLOSER', pitchCloser);

    limparCachesDados_();
    registrarLog_(
      'CLIENTES',
      clienteExistente ? 'ATUALIZAR_COM_PITCHES' : 'CRIAR_COM_PITCHES',
      'Cliente e pitches salvos: ' + nomeCliente
    );

    return {
      sucesso: true,
      mensagem: clienteExistente
        ? (pitchSdr || pitchCloser
            ? 'Cliente atualizado e novas versões dos pitches salvas.'
            : 'Cliente atualizado com sucesso.')
        : (pitchSdr || pitchCloser
            ? 'Cliente e pitches salvos com sucesso.'
            : 'Cliente salvo com sucesso.'),
      idCliente: idCliente,
      clientes: listarClientes(),
      pitches: listarPitches()
    };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Cadastro enxuto do painel principal.
 * Salva somente o cliente e retorna imediatamente o registro criado/atualizado.
 */
function salvarClientePainel(dados) {
  dados = dados || {};
  const nome = String(dados.nomeCliente || '').trim();
  if (!nome) throw new Error('Informe o nome do cliente.');

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) {
    throw new Error('Outro cadastro está sendo processado. Aguarde alguns segundos e tente novamente.');
  }

  try {
    const existentes = lerObjetos_(APP.sheets.clientes);
    const idInformado = String(dados.idCliente || '').trim();
    const nomeNormalizado = normalizarTextoComparacao_(nome);
    const existente = existentes.find(item =>
      idInformado
        ? String(item.ID_CLIENTE || '') === idInformado
        : normalizarTextoComparacao_(item.NOME_CLIENTE) === nomeNormalizado
    );

    const agora = new Date();
    const idCliente = existente ? String(existente.ID_CLIENTE) : gerarId_('CLI');
    const objeto = {
      ID_CLIENTE: idCliente,
      NOME_CLIENTE: nome,
      TIPO_OPERACAO: existente ? String(existente.TIPO_OPERACAO || '') : '',
      PRODUTO_SERVICO: existente ? String(existente.PRODUTO_SERVICO || '') : '',
      REGRAS_CLIENTE: existente ? String(existente.REGRAS_CLIENTE || '') : '',
      STATUS: 'ATIVO',
      CRIADO_EM: existente ? existente.CRIADO_EM : agora,
      ATUALIZADO_EM: agora,
      CHAVE_VOLUMBERG: existente ? String(existente.CHAVE_VOLUMBERG || '') : '',
      URL_MATERIAIS: existente ? String(existente.URL_MATERIAIS || '') : '',
      CARTEIRA_VOLUM: existente ? String(existente.CARTEIRA_VOLUM || '') : '',
      EXECUTOR_VOLUM: existente ? String(existente.EXECUTOR_VOLUM || '') : ''
    };

    if (existente) {
      atualizarPorCampo_(APP.sheets.clientes, 'ID_CLIENTE', idCliente, objeto);
    } else {
      adicionarObjeto_(APP.sheets.clientes, objeto);
    }

    SpreadsheetApp.flush();
    limparCachesDados_();
    registrarLog_('CLIENTES', existente ? 'ATUALIZAR_PAINEL' : 'CRIAR_PAINEL', 'Cliente salvo: ' + nome);

    return {
      sucesso: true,
      mensagem: existente ? 'Cliente atualizado com sucesso.' : 'Cliente cadastrado com sucesso.',
      cliente: {
        idCliente: idCliente,
        nomeCliente: nome,
        tipoOperacao: objeto.TIPO_OPERACAO,
        produtoServico: objeto.PRODUTO_SERVICO,
        regrasCliente: objeto.REGRAS_CLIENTE,
        chaveVolumberg: objeto.CHAVE_VOLUMBERG,
        urlMateriais: objeto.URL_MATERIAIS,
        status: 'ATIVO',
        totalIntegracoes: 0,
        integracoesAtivas: 0
      }
    };
  } finally {
    lock.releaseLock();
  }
}

function obterResumoCatalogoVolumberg_() {
  const clientes = lerObjetos_(APP.sheets.clientes).filter(item => item.ID_CLIENTE);
  const chaves = new Set(clientes.map(item => String(item.CHAVE_VOLUMBERG || '').trim()).filter(Boolean));
  const nomes = new Set(clientes.map(item => normalizarTextoComparacao_(item.NOME_CLIENTE)).filter(Boolean));
  const faltantes = CATALOGO_CLIENTES_AUDIT.filter(item => {
    if (chaves.has(item.chave)) return false;
    const opcoes = [item.nome].concat(item.aliases || []).map(normalizarTextoComparacao_);
    return !opcoes.some(nome => nomes.has(nome));
  });
  return {
    versao: '2026-08-15',
    total: CATALOGO_CLIENTES_AUDIT.length,
    cadastrados: CATALOGO_CLIENTES_AUDIT.length - faltantes.length,
    faltantes: faltantes.map(item => ({ chave: item.chave, nome: item.nome })),
    totalMateriaisCatalogo: Object.keys(MATERIAIS_CATALOGO_VOLUMBERG)
      .reduce((total, chave) => total + MATERIAIS_CATALOGO_VOLUMBERG[chave].length, 0),
    clientesComMateriais: Object.keys(MATERIAIS_CATALOGO_VOLUMBERG).length
  };
}

function sincronizarClientesVolumberg() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) throw new Error('Outra atualização está em andamento. Tente novamente em alguns segundos.');

  try {
    criarAbasAusentes_();
    const clientes = lerObjetos_(APP.sheets.clientes).filter(item => item.ID_CLIENTE);
    const idsUsados = new Set(clientes.map(item => String(item.ID_CLIENTE)));
    let criados = 0;
    let vinculados = 0;
    let preservados = 0;

    CATALOGO_CLIENTES_AUDIT.forEach(itemCatalogo => {
      let existente = clientes.find(item => String(item.CHAVE_VOLUMBERG || '') === itemCatalogo.chave);
      if (!existente) {
        const nomesAceitos = [itemCatalogo.nome]
          .concat(itemCatalogo.aliases || [])
          .map(normalizarTextoComparacao_);
        existente = clientes.find(item => nomesAceitos.includes(normalizarTextoComparacao_(item.NOME_CLIENTE)));
      }

      const agora = new Date();
      if (existente) {
        const operacao = OPERACAO_CLIENTES_VOLUMBERG[itemCatalogo.chave] || {};
        const materialPrincipal = (MATERIAIS_CATALOGO_VOLUMBERG[itemCatalogo.chave] || [])
          .find(material => material.funcao === 'SDR' && material.status !== 'SEM_ACESSO');
        const precisaVincular = String(existente.CHAVE_VOLUMBERG || '') !== itemCatalogo.chave ||
          String(existente.NOME_CLIENTE || '') !== itemCatalogo.nome ||
          String(existente.STATUS || 'ATIVO').toUpperCase() !== 'ATIVO' ||
          String(existente.CARTEIRA_VOLUM || '') !== String(operacao.carteira || '') ||
          (!String(existente.URL_MATERIAIS || '').trim() && Boolean(materialPrincipal));
        if (precisaVincular) {
          atualizarPorCampo_(APP.sheets.clientes, 'ID_CLIENTE', existente.ID_CLIENTE, {
            NOME_CLIENTE: itemCatalogo.nome,
            CHAVE_VOLUMBERG: itemCatalogo.chave,
            URL_MATERIAIS: String(existente.URL_MATERIAIS || '').trim() || (materialPrincipal ? materialPrincipal.url : ''),
            CARTEIRA_VOLUM: operacao.carteira || String(existente.CARTEIRA_VOLUM || ''),
            EXECUTOR_VOLUM: operacao.carteira === 'CAIO' ? 'Caio Cappelazzo' : (operacao.carteira === 'THIAGO' ? 'Thiago Custodio' : String(existente.EXECUTOR_VOLUM || '')),
            STATUS: 'ATIVO',
            ATUALIZADO_EM: agora
          });
          existente.NOME_CLIENTE = itemCatalogo.nome;
          existente.CHAVE_VOLUMBERG = itemCatalogo.chave;
          existente.STATUS = 'ATIVO';
          existente.ATUALIZADO_EM = agora;
          vinculados++;
        } else {
          preservados++;
        }
        return;
      }

      let idCliente = 'CLI_VOL_' + itemCatalogo.chave.toUpperCase();
      if (idsUsados.has(idCliente)) idCliente = gerarId_('CLI');
      idsUsados.add(idCliente);
      const novo = {
        ID_CLIENTE: idCliente,
        NOME_CLIENTE: itemCatalogo.nome,
        TIPO_OPERACAO: '',
        PRODUTO_SERVICO: '',
        REGRAS_CLIENTE: '',
        STATUS: 'ATIVO',
        CRIADO_EM: agora,
        ATUALIZADO_EM: agora,
        CHAVE_VOLUMBERG: itemCatalogo.chave,
        CARTEIRA_VOLUM: (OPERACAO_CLIENTES_VOLUMBERG[itemCatalogo.chave] || {}).carteira || '',
        EXECUTOR_VOLUM: ((OPERACAO_CLIENTES_VOLUMBERG[itemCatalogo.chave] || {}).carteira === 'CAIO' ? 'Caio Cappelazzo' : ((OPERACAO_CLIENTES_VOLUMBERG[itemCatalogo.chave] || {}).carteira === 'THIAGO' ? 'Thiago Custodio' : '')),
        URL_MATERIAIS: ((MATERIAIS_CATALOGO_VOLUMBERG[itemCatalogo.chave] || [])
          .find(material => material.funcao === 'SDR' && material.status !== 'SEM_ACESSO') || {}).url || ''
      };
      adicionarObjeto_(APP.sheets.clientes, novo);
      clientes.push(novo);
      criados++;
    });

    const materiaisSincronizados = sincronizarMateriaisCatalogoVolumberg_(clientes);
    const operacaoSincronizada = sincronizarOperacaoCatalogoVolumberg_(clientes);
    const comunidadeSincronizada = typeof sincronizarEspacosComunidadeClientes_ === 'function'
      ? sincronizarEspacosComunidadeClientes_(clientes)
      : { vinculados: 0, preservados: 0, naoEncontrados: 0, totalEspacos: 0, erro: 'Integração da Comunidade indisponível.' };

    SpreadsheetApp.flush();
    limparCachesDados_();
    registrarLog_('CLIENTES', 'SINCRONIZAR_ECOSSISTEMA', 'Criados: ' + criados + ' | VOLUMBERG: ' + vinculados + ' | materiais: ' + materiaisSincronizados.criados + ' | equipe: ' + operacaoSincronizada.membrosCriados + ' | Comunidade: ' + comunidadeSincronizada.vinculados);
    const resumoComunidade = comunidadeSincronizada.erro
      ? ' Comunidade não sincronizada: ' + comunidadeSincronizada.erro
      : ' Comunidade: ' + comunidadeSincronizada.vinculados + ' novo(s) vínculo(s), ' + comunidadeSincronizada.preservados + ' preservado(s).';
    return {
      sucesso: true,
      mensagem: 'Ecossistema sincronizado: ' + criados + ' cliente(s), ' + vinculados + ' vínculo(s) VOLUMBERG, ' + materiaisSincronizados.criados + ' material(is) e ' + operacaoSincronizada.membrosCriados + ' pessoa(s) adicionada(s).' + resumoComunidade,
      clientes: listarClientes(),
      materiais: listarMateriaisClientes_(),
      catalogoVolumberg: obterResumoCatalogoVolumberg_(),
      comunidade: comunidadeSincronizada,
      operacao: operacaoSincronizada
    };
  } finally {
    lock.releaseLock();
  }
}

function sincronizarOperacaoCatalogoVolumberg_(clientes) {
  const equipeExistente = lerObjetos_(APP.sheets.equipeClientes).filter(item => item.ID_MEMBRO);
  const chavesExistentes = new Set(equipeExistente.map(item => [
    String(item.ID_CLIENTE || ''),
    normalizarTextoComparacao_(item.NOME),
    String(item.PAPEL || '').toUpperCase()
  ].join('|')));
  const novos = [];
  const pendencias = [];
  const agora = new Date();
  const separarNomes = valor => String(valor || '')
    .split(/[\/\n,]+/)
    .map(nome => nome.replace(/\s+-\s+(?:inbound|outbound).*$/i, '').trim())
    .filter(nome => nome && nome !== '-' && nome !== '?');

  clientes.forEach(cliente => {
    const chave = String(cliente.CHAVE_VOLUMBERG || '');
    const operacao = OPERACAO_CLIENTES_VOLUMBERG[chave];
    if (!operacao) {
      if (chave) pendencias.push({ idCliente: cliente.ID_CLIENTE, cliente: cliente.NOME_CLIENTE, itens: ['carteira'] });
      return;
    }
    const papeis = [
      { papel: 'GESTOR', nomes: operacao.gestores },
      { papel: 'SDR', nomes: operacao.sdrs },
      { papel: 'CLOSER', nomes: operacao.closers },
      { papel: 'SALES_OPS', nomes: operacao.carteira === 'CAIO' ? 'Caio Cappelazzo' : 'Thiago Custodio' }
    ];
    papeis.forEach(grupo => separarNomes(grupo.nomes).forEach(nome => {
      const chaveMembro = [cliente.ID_CLIENTE, normalizarTextoComparacao_(nome), grupo.papel].join('|');
      if (chavesExistentes.has(chaveMembro)) return;
      chavesExistentes.add(chaveMembro);
      novos.push({
        ID_MEMBRO: gerarId_('MEM'), ID_CLIENTE: cliente.ID_CLIENTE, NOME: nome,
        PAPEL: grupo.papel, EMAIL: '', TELEFONE: '', LIDER_ID: '', ATIVO: 'SIM',
        DATA_INICIO: '', DATA_FIM: '', OBSERVACOES: 'Sincronizado da base operacional VOLUMBERG.',
        CRIADO_EM: agora, ATUALIZADO_EM: agora
      });
    }));
    const faltantes = [];
    if (!operacao.gestores) faltantes.push('gestor');
    if (!operacao.sdrs) faltantes.push('SDR');
    if (!operacao.closers) faltantes.push('Closer');
    if (faltantes.length) pendencias.push({ idCliente: cliente.ID_CLIENTE, cliente: cliente.NOME_CLIENTE, itens: faltantes });
  });

  if (novos.length) {
    const aba = abrirPlanilha_().getSheetByName(APP.sheets.equipeClientes);
    const cabecalhos = aba.getRange(1, 1, 1, aba.getLastColumn()).getDisplayValues()[0];
    const linhas = novos.map(item => cabecalhos.map(campo => item[campo] !== undefined ? item[campo] : ''));
    aba.getRange(aba.getLastRow() + 1, 1, linhas.length, cabecalhos.length).setValues(linhas);
  }
  return { membrosCriados: novos.length, pendencias: pendencias };
}

function sincronizarMateriaisCatalogoVolumberg_(clientes) {
  const existentes = lerObjetos_(APP.sheets.materiaisClientes).filter(item => item.ID_MATERIAL);
  let criados = 0;
  let preservados = 0;

  CATALOGO_CLIENTES_AUDIT.forEach(clienteCatalogo => {
    const cliente = clientes.find(item => String(item.CHAVE_VOLUMBERG || '') === clienteCatalogo.chave);
    if (!cliente) return;
    (MATERIAIS_CATALOGO_VOLUMBERG[clienteCatalogo.chave] || []).forEach((material, indice) => {
      const urlNormalizada = String(material.url || '').trim().replace(/[?#].*$/, '').replace(/\/$/, '');
      const existente = existentes.find(item =>
        String(item.ID_CLIENTE) === String(cliente.ID_CLIENTE) &&
        String(item.URL || '').trim().replace(/[?#].*$/, '').replace(/\/$/, '') === urlNormalizada
      );
      if (existente) {
        preservados++;
        return;
      }
      const agora = new Date();
      const objeto = {
        ID_MATERIAL: gerarId_('MAT'),
        ID_CLIENTE: cliente.ID_CLIENTE,
        CHAVE_VOLUMBERG: clienteCatalogo.chave,
        NOME_MATERIAL: material.nome,
        FUNCAO: String(material.funcao || 'GERAL').toUpperCase(),
        CATEGORIA: String(material.categoria || 'OUTRO').toUpperCase(),
        TIPO_LINK: /docs\.google\.com\/document/i.test(material.url) ? 'GOOGLE_DOCS' : 'PASTA_DRIVE',
        URL: material.url,
        STATUS: String(material.status || 'ATIVO').toUpperCase(),
        ORIGEM: 'CATALOGO_VOLUMBERG',
        ORDEM: indice + 1,
        CRIADO_EM: agora,
        ATUALIZADO_EM: agora
      };
      adicionarObjeto_(APP.sheets.materiaisClientes, objeto);
      existentes.push(objeto);
      criados++;
    });
  });
  return { criados: criados, preservados: preservados };
}

function listarMateriaisClientes_(itensInformados) {
  const itens = Array.isArray(itensInformados)
    ? itensInformados
    : lerObjetos_(APP.sheets.materiaisClientes);
  return itens
    .filter(item => item.ID_MATERIAL && String(item.STATUS || 'ATIVO').toUpperCase() !== 'INATIVO')
    .map(item => ({
      idMaterial: item.ID_MATERIAL,
      idCliente: item.ID_CLIENTE,
      chaveVolumberg: item.CHAVE_VOLUMBERG || '',
      nomeMaterial: item.NOME_MATERIAL || 'Material',
      funcao: String(item.FUNCAO || 'GERAL').toUpperCase(),
      categoria: String(item.CATEGORIA || 'OUTRO').toUpperCase(),
      tipoLink: item.TIPO_LINK || 'LINK',
      url: item.URL || '',
      status: String(item.STATUS || 'ATIVO').toUpperCase(),
      origem: item.ORIGEM || 'MANUAL',
      ordem: Number(item.ORDEM || 0)
    }))
    .sort((a, b) => a.idCliente === b.idCliente
      ? (a.ordem - b.ordem || a.nomeMaterial.localeCompare(b.nomeMaterial))
      : String(a.idCliente).localeCompare(String(b.idCliente)));
}

function listarMateriaisClientes() {
  return { materiais: listarMateriaisClientes_() };
}

function salvarMaterialCliente(dados) {
  dados = dados || {};
  const idCliente = String(dados.idCliente || '').trim();
  const cliente = localizarObjeto_(APP.sheets.clientes, 'ID_CLIENTE', idCliente);
  if (!cliente) throw new Error('Cliente não encontrado.');
  const nome = String(dados.nomeMaterial || '').trim();
  const url = String(dados.url || '').trim();
  const funcao = String(dados.funcao || 'GERAL').trim().toUpperCase();
  const categoria = String(dados.categoria || 'OUTRO').trim().toUpperCase();
  if (!nome) throw new Error('Informe o nome do material.');
  if (!/^https:\/\//i.test(url)) throw new Error('Informe um link HTTPS válido.');
  if (!['GERAL', 'SDR', 'CLOSER', 'PLANO', 'FORMALIZACAO'].includes(funcao)) {
    throw new Error('Selecione uma função válida para o material.');
  }
  const existentes = lerObjetos_(APP.sheets.materiaisClientes);
  const idMaterialInformado = String(dados.idMaterial || '').trim();
  const duplicado = existentes.find(item =>
    String(item.ID_CLIENTE) === idCliente &&
    String(item.URL || '').trim().replace(/[?#].*$/, '').replace(/\/$/, '') === url.replace(/[?#].*$/, '').replace(/\/$/, '') &&
    String(item.ID_MATERIAL) !== idMaterialInformado
  );
  if (duplicado) throw new Error('Este link já está cadastrado para o cliente.');
  const agora = new Date();
  const existente = idMaterialInformado
    ? existentes.find(item => String(item.ID_MATERIAL) === idMaterialInformado)
    : null;
  const objeto = {
    ID_MATERIAL: existente ? existente.ID_MATERIAL : gerarId_('MAT'),
    ID_CLIENTE: idCliente,
    CHAVE_VOLUMBERG: cliente.CHAVE_VOLUMBERG || '',
    NOME_MATERIAL: nome,
    FUNCAO: funcao,
    CATEGORIA: categoria,
    TIPO_LINK: /docs\.google\.com\/document/i.test(url) ? 'GOOGLE_DOCS' : (/drive\.google\.com\/drive\/folders/i.test(url) ? 'PASTA_DRIVE' : 'LINK'),
    URL: url,
    STATUS: 'ATIVO',
    ORIGEM: existente ? (existente.ORIGEM || 'MANUAL') : 'MANUAL',
    ORDEM: existente ? Number(existente.ORDEM || 0) : existentes.filter(item => String(item.ID_CLIENTE) === idCliente).length + 1,
    CRIADO_EM: existente ? existente.CRIADO_EM : agora,
    ATUALIZADO_EM: agora
  };
  if (existente) atualizarPorCampo_(APP.sheets.materiaisClientes, 'ID_MATERIAL', objeto.ID_MATERIAL, objeto);
  else adicionarObjeto_(APP.sheets.materiaisClientes, objeto);
  limparCachesDados_();
  return {
    sucesso: true,
    mensagem: existente ? 'Material atualizado.' : 'Material adicionado ao cliente.',
    materiais: listarMateriaisClientes_(),
    clientes: listarClientes()
  };
}

function listarMetasClientes_(itensInformados) {
  const itens = Array.isArray(itensInformados)
    ? itensInformados
    : lerObjetos_(APP.sheets.metasClientes);
  return itens
    .filter(item => item.ID_META && String(item.STATUS || 'ATIVA').toUpperCase() !== 'INATIVA')
    .map(item => ({
      idMeta: item.ID_META,
      idCliente: item.ID_CLIENTE,
      periodo: String(item.PERIODO || ''),
      escopo: String(item.ESCOPO || 'EQUIPE').toUpperCase(),
      responsavel: item.RESPONSAVEL || '',
      metaReceita: Number(item.META_RECEITA || 0),
      metaVendas: Number(item.META_VENDAS || 0),
      metaReunioes: Number(item.META_REUNIOES || 0),
      metaOportunidades: Number(item.META_OPORTUNIDADES || 0),
      metaLigacoes: Number(item.META_LIGACOES || 0),
      metaPropostas: Number(item.META_PROPOSTAS || 0),
      observacoes: item.OBSERVACOES || '',
      status: String(item.STATUS || 'ATIVA').toUpperCase()
    }))
    .sort((a, b) => String(b.periodo).localeCompare(String(a.periodo)) || String(a.escopo).localeCompare(String(b.escopo)));
}

function salvarMetaCliente(dados) {
  dados = dados || {};
  const idCliente = String(dados.idCliente || '').trim();
  const cliente = localizarObjeto_(APP.sheets.clientes, 'ID_CLIENTE', idCliente);
  if (!cliente) throw new Error('Cliente não encontrado.');
  const periodo = String(dados.periodo || '').trim();
  if (!/^\d{4}-\d{2}$/.test(periodo)) throw new Error('Informe o mês de referência da meta.');
  const escopo = String(dados.escopo || 'EQUIPE').trim().toUpperCase();
  if (!['EQUIPE', 'SDR', 'CLOSER'].includes(escopo)) throw new Error('Selecione um escopo válido.');
  const responsavel = String(dados.responsavel || '').trim();
  const agora = new Date();
  const existentes = lerObjetos_(APP.sheets.metasClientes);
  const idInformado = String(dados.idMeta || '').trim();
  let existente = idInformado ? existentes.find(item => String(item.ID_META) === idInformado) : null;
  if (!existente) {
    existente = existentes.find(item =>
      String(item.ID_CLIENTE) === idCliente &&
      String(item.PERIODO) === periodo &&
      String(item.ESCOPO || 'EQUIPE').toUpperCase() === escopo &&
      normalizarTextoComparacao_(item.RESPONSAVEL || '') === normalizarTextoComparacao_(responsavel)
    ) || null;
  }
  const numero = valor => Math.max(0, Number(valor || 0));
  const objeto = {
    ID_META: existente ? existente.ID_META : gerarId_('META'),
    ID_CLIENTE: idCliente,
    PERIODO: periodo,
    ESCOPO: escopo,
    RESPONSAVEL: responsavel,
    META_RECEITA: numero(dados.metaReceita),
    META_VENDAS: numero(dados.metaVendas),
    META_REUNIOES: numero(dados.metaReunioes),
    META_OPORTUNIDADES: numero(dados.metaOportunidades),
    META_LIGACOES: numero(dados.metaLigacoes),
    META_PROPOSTAS: numero(dados.metaPropostas),
    OBSERVACOES: String(dados.observacoes || '').trim(),
    STATUS: 'ATIVA',
    CRIADO_EM: existente ? existente.CRIADO_EM : agora,
    ATUALIZADO_EM: agora
  };
  if (existente) atualizarPorCampo_(APP.sheets.metasClientes, 'ID_META', objeto.ID_META, objeto);
  else adicionarObjeto_(APP.sheets.metasClientes, objeto);
  limparCachesDados_();
  return {
    sucesso: true,
    mensagem: existente ? 'Meta atualizada.' : 'Meta cadastrada.',
    metas: listarMetasClientes_()
  };
}

function salvarUrlMateriaisCliente(dados) {
  dados = dados || {};
  const idCliente = String(dados.idCliente || '').trim();
  const url = String(dados.urlMateriais || '').trim();
  const cliente = localizarObjeto_(APP.sheets.clientes, 'ID_CLIENTE', idCliente);
  if (!cliente) throw new Error('Cliente não encontrado.');
  if (url && !/^https:\/\//i.test(url)) throw new Error('Informe um link HTTPS válido para a pasta de materiais.');

  atualizarPorCampo_(APP.sheets.clientes, 'ID_CLIENTE', idCliente, {
    URL_MATERIAIS: url,
    ATUALIZADO_EM: new Date()
  });
  limparCachesDados_();
  return {
    sucesso: true,
    mensagem: url ? 'Pasta de materiais vinculada ao cliente.' : 'Link da pasta de materiais removido.',
    idCliente: idCliente,
    urlMateriais: url
  };
}

/**
 * Salva uma versão de pitch para um cliente já cadastrado.
 * O nome da versão não pode se repetir para o mesmo cliente e tipo.
 */
function salvarPitchPainel(dados) {
  dados = dados || {};
  garantirEstruturaPitches_();
  const idPitchInformado = String(dados.idPitch || '').trim();
  const idCliente = String(dados.idCliente || '').trim();
  const tipo = String(dados.tipoPitch || '').trim().toUpperCase();
  const nomeVersao = String(dados.nomeVersao || '').trim();
  const conteudo = String(dados.conteudoPitch || '').trim();
  const urlDocumento = String(dados.urlDocumento || '').trim();
  const marcarAtual = dados.pitchAtual !== false;

  if (!idCliente) throw new Error('Selecione um cliente cadastrado.');
  if (!localizarObjeto_(APP.sheets.clientes, 'ID_CLIENTE', idCliente)) {
    throw new Error('O cliente selecionado não existe na base. Cadastre o cliente primeiro.');
  }
  if (!['SDR', 'CLOSER', 'PLANO'].includes(tipo)) throw new Error('Selecione SDR, Closer ou Plano.');
  if (!nomeVersao) throw new Error('Informe o nome da versão do pitch.');
  if (!conteudo) throw new Error('Informe o conteúdo do pitch.');
  if (urlDocumento && !/^https:\/\//i.test(urlDocumento)) {
    throw new Error('Informe um link HTTPS válido para o documento do pitch.');
  }

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) {
    throw new Error('Outro pitch está sendo salvo. Aguarde alguns segundos e tente novamente.');
  }

  try {
    const pitches = lerObjetos_(APP.sheets.pitches);
    const existente = idPitchInformado
      ? pitches.find(item => String(item.ID_PITCH) === idPitchInformado)
      : null;
    if (idPitchInformado && !existente) throw new Error('A versão selecionada não foi encontrada. Atualize a página e tente novamente.');
    if (existente && String(existente.ID_CLIENTE) !== idCliente) {
      throw new Error('Esta versão pertence a outro cliente e não pode ser alterada aqui.');
    }

    const duplicado = localizarDuplicidadePitch_(pitches, idCliente, tipo, nomeVersao, conteudo, idPitchInformado);
    if (duplicado) {
      throw new Error('Já existe um pitch ' + tipo + ' com a versão "' + duplicado.NOME_VERSAO + '" para este cliente.');
    }

    const agora = new Date();
    const fimVersaoAnterior = Utilities.formatDate(
      new Date(agora.getFullYear(), agora.getMonth(), agora.getDate() - 1),
      APP.timezone,
      'yyyy-MM-dd'
    );
    if (marcarAtual) {
      pitches
        .filter(item => String(item.ID_CLIENTE) === idCliente && String(item.TIPO_PITCH || '').toUpperCase() === tipo)
        .forEach(item => {
          if (String(item.ID_PITCH) === idPitchInformado) return;
          if (normalizarBooleano_(item.PITCH_ATUAL)) {
            atualizarPorCampo_(APP.sheets.pitches, 'ID_PITCH', item.ID_PITCH, {
              PITCH_ATUAL: 'NAO',
              DATA_VIGENCIA_FIM: item.DATA_VIGENCIA_FIM || fimVersaoAnterior,
              ATUALIZADO_EM: agora
            });
          }
        });
    }

    const maiorVersao = pitches
      .filter(item => String(item.ID_CLIENTE) === idCliente && String(item.TIPO_PITCH || '').toUpperCase() === tipo)
      .reduce((maior, item) => Math.max(maior, Number(item.NUMERO_VERSAO || 0)), 0);

    const idPitch = existente ? existente.ID_PITCH : gerarId_('PIT');
    const dataHoje = Utilities.formatDate(agora, APP.timezone, 'yyyy-MM-dd');
    const objetoPitch = {
      ID_PITCH: idPitch,
      ID_CLIENTE: idCliente,
      TIPO_PITCH: tipo,
      NOME_VERSAO: nomeVersao,
      NUMERO_VERSAO: existente ? String(existente.NUMERO_VERSAO || '') : String(maiorVersao + 1),
      CONTEUDO_PITCH: conteudo,
      DATA_VIGENCIA_INICIO: existente ? existente.DATA_VIGENCIA_INICIO : dataHoje,
      DATA_VIGENCIA_FIM: marcarAtual ? '' : (existente ? existente.DATA_VIGENCIA_FIM : ''),
      PITCH_ATUAL: marcarAtual ? 'SIM' : 'NAO',
      STATUS: 'ATIVO',
      URL_DOCUMENTO: urlDocumento,
      CRIADO_EM: existente ? existente.CRIADO_EM : agora,
      ATUALIZADO_EM: agora
    };
    if (existente) atualizarPorCampo_(APP.sheets.pitches, 'ID_PITCH', idPitch, objetoPitch);
    else adicionarObjeto_(APP.sheets.pitches, objetoPitch);

    SpreadsheetApp.flush();
    limparCachesDados_();
    registrarLog_('PITCHES', existente ? 'EDITAR_PAINEL' : 'SALVAR_PAINEL', tipo + ' | ' + nomeVersao + ' | Cliente: ' + idCliente);

    return {
      sucesso: true,
      mensagem: existente ? 'Versão do pitch atualizada com sucesso.' : 'Pitch ' + tipo + ' salvo com sucesso.',
      pitch: {
        idPitch: idPitch,
        idCliente: idCliente,
        tipoPitch: tipo,
        nomeVersao: nomeVersao,
        numeroVersao: objetoPitch.NUMERO_VERSAO,
        conteudoPitch: conteudo,
        urlDocumento: urlDocumento,
        dataVigenciaInicio: dataHoje,
        dataVigenciaFim: '',
        pitchAtual: marcarAtual,
        status: 'ATIVO'
      },
      pitches: listarPitches()
    };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Exclui somente versões ainda não utilizadas por auditorias. A proteção
 * preserva o histórico e os snapshots das análises já concluídas.
 */
function excluirPitchPainel(idPitch) {
  garantirEstruturaPitches_();
  idPitch = String(idPitch || '').trim();
  if (!idPitch) throw new Error('Selecione uma versão para excluir.');

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) throw new Error('A base está sendo atualizada. Aguarde alguns segundos e tente novamente.');

  try {
    const pitch = localizarObjeto_(APP.sheets.pitches, 'ID_PITCH', idPitch);
    if (!pitch) throw new Error('A versão selecionada não foi encontrada.');

    const auditoriasVinculadas = lerObjetos_(APP.sheets.auditorias)
      .filter(item => String(item.ID_PITCH || '') === idPitch);
    if (auditoriasVinculadas.length) {
      throw new Error(
        'Esta versão já foi usada em ' + auditoriasVinculadas.length +
        ' auditoria(s) e não pode ser apagada, pois faz parte do histórico do cliente.'
      );
    }

    const aba = abrirPlanilha_().getSheetByName(APP.sheets.pitches);
    const dadosAba = aba.getDataRange().getValues();
    const indiceId = dadosAba[0].indexOf('ID_PITCH');
    const indiceLinha = dadosAba.findIndex((linha, indice) => indice > 0 && String(linha[indiceId]) === idPitch);
    if (indiceLinha < 1) throw new Error('Não foi possível localizar a linha da versão para exclusão.');
    aba.deleteRow(indiceLinha + 1);

    if (normalizarBooleano_(pitch.PITCH_ATUAL)) {
      const restantes = lerObjetos_(APP.sheets.pitches)
        .filter(item =>
          String(item.ID_CLIENTE || '') === String(pitch.ID_CLIENTE || '') &&
          String(item.TIPO_PITCH || '').toUpperCase() === String(pitch.TIPO_PITCH || '').toUpperCase() &&
          String(item.STATUS || 'ATIVO').toUpperCase() === 'ATIVO'
        )
        .sort((a, b) => Number(b.NUMERO_VERSAO || 0) - Number(a.NUMERO_VERSAO || 0));
      if (restantes.length) {
        atualizarPorCampo_(APP.sheets.pitches, 'ID_PITCH', restantes[0].ID_PITCH, {
          PITCH_ATUAL: 'SIM',
          DATA_VIGENCIA_FIM: '',
          ATUALIZADO_EM: new Date()
        });
      }
    }

    SpreadsheetApp.flush();
    limparCachesDados_();
    registrarLog_('PITCHES', 'EXCLUIR_PAINEL', String(pitch.TIPO_PITCH || '') + ' | ' + String(pitch.NOME_VERSAO || '') + ' | Cliente: ' + String(pitch.ID_CLIENTE || ''));
    return {
      sucesso: true,
      mensagem: 'Versão excluída com sucesso.',
      pitches: listarPitches()
    };
  } finally {
    lock.releaseLock();
  }
}

function obterClienteComPitches(idCliente) {
  const cliente = listarClientes().find(item => String(item.idCliente) === String(idCliente));
  if (!cliente) throw new Error('Cliente não encontrado.');

  const pitches = listarPitches().filter(item => String(item.idCliente) === String(idCliente));
  const pitchSdr = pitches.find(item => item.tipoPitch === 'SDR' && item.pitchAtual) ||
    pitches.find(item => item.tipoPitch === 'SDR') || null;
  const pitchCloser = pitches.find(item => item.tipoPitch === 'CLOSER' && item.pitchAtual) ||
    pitches.find(item => item.tipoPitch === 'CLOSER') || null;
  const pitchPlano = pitches.find(item => item.tipoPitch === 'PLANO' && item.pitchAtual) ||
    pitches.find(item => item.tipoPitch === 'PLANO') || null;

  return {
    cliente: cliente,
    pitchSdr: pitchSdr,
    pitchCloser: pitchCloser,
    pitchPlano: pitchPlano
  };
}

function listarIntegracoesClientes_() {
  return lerObjetos_(APP.sheets.integracoesClientes)
    .filter(item => item.ID_INTEGRACAO)
    .map(item => {
      let config = {};
      try { config = JSON.parse(item.CONFIG_JSON || '{}'); } catch (erro) {}

      return {
        idIntegracao: item.ID_INTEGRACAO,
        idCliente: item.ID_CLIENTE,
        tipoIntegracao: item.TIPO_INTEGRACAO,
        ativo: normalizarBooleano_(item.ATIVO),
        status: item.STATUS || 'NAO_CONFIGURADA',
        ultimoErro: item.ULTIMO_ERRO || '',
        ultimaSincronizacao: serializarData_(item.ULTIMA_SINCRONIZACAO),
        configurado: Boolean(obterSegredo_('INTEGRACAO_TOKEN_' + item.ID_INTEGRACAO)),
        config: config
      };
    });
}

function listarIntegracoesClientesBasico_() {
  return lerObjetos_(APP.sheets.integracoesClientes)
    .filter(item => item.ID_INTEGRACAO)
    .map(item => {
      let config = {};
      try { config = JSON.parse(item.CONFIG_JSON || '{}'); } catch (erro) {}
      return {
        idIntegracao: item.ID_INTEGRACAO,
        idCliente: item.ID_CLIENTE,
        tipoIntegracao: item.TIPO_INTEGRACAO,
        ativo: normalizarBooleano_(item.ATIVO),
        status: item.STATUS || 'NAO_CONFIGURADA',
        ultimoErro: item.ULTIMO_ERRO || '',
        ultimaSincronizacao: serializarData_(item.ULTIMA_SINCRONIZACAO),
        configurado: false,
        config: config
      };
    });
}

function salvarIntegracaoCliente(dados) {
  dados = dados || {};

  const idCliente = String(dados.idCliente || '').trim();
  const tipo = String(dados.tipoIntegracao || '').trim().toUpperCase();
  if (!idCliente) throw new Error('Selecione o cliente.');
  if (!tipo) throw new Error('Selecione o tipo de integração.');
  if (!localizarObjeto_(APP.sheets.clientes, 'ID_CLIENTE', idCliente)) {
    throw new Error('Cliente não encontrado.');
  }

  const config = dados.config && typeof dados.config === 'object' ? dados.config : {};
  const integracao = obterOuCriarIntegracaoCliente_(idCliente, tipo, {
    ATIVO: dados.ativo ? 'SIM' : 'NAO',
    CONFIG_JSON: JSON.stringify(config),
    STATUS: dados.ativo ? 'CONFIGURADA' : 'INATIVA',
    ULTIMO_ERRO: '',
    ATUALIZADO_EM: new Date()
  });

  const token = String(dados.token || '').trim();
  if (token) salvarSegredo_('INTEGRACAO_TOKEN_' + integracao.ID_INTEGRACAO, token);

  if (tipo === 'RD_STATION') reconciliarAcionadorRd_();
  limparCachesDados_();
  registrarLog_('INTEGRACOES_CLIENTES', 'SALVAR', tipo + ' | Cliente: ' + idCliente);

  const resposta = {
    sucesso: true,
    mensagem: 'Integração salva com sucesso.',
    clientes: carregarClientesParaIntegracoes().clientes,
    integracoesClientes: listarIntegracoesClientesBasico_()
  };

  if (tipo === 'RD_STATION') {
    try {
      resposta.integracoesClientes = listarIntegracoesClientes_();
    } catch (erro) {
      registrarLog_('INTEGRACOES_CLIENTES', 'ERRO_RETORNO_SALVAR', String(erro && erro.message || erro));
    }
  }

  if (tipo === 'RD_STATION') {
    try { resposta.automacaoRd = obterStatusAutomacaoRd_(); } catch (erro) {}
  }

  return resposta;
}

function testarIntegracaoCliente(dados) {
  dados = dados || {};
  const idCliente = String(dados.idCliente || '').trim();
  const tipo = String(dados.tipoIntegracao || '').trim().toUpperCase();
  const token = String(dados.token || '').trim();

  if (tipo === 'RD_STATION') {
    return testarRdCliente(idCliente, token);
  }

  const integracao = obterOuCriarIntegracaoCliente_(idCliente, tipo, {
    ATIVO: 'SIM',
    ATUALIZADO_EM: new Date()
  });

  if (tipo === 'CIRCLE') {
    if (dados.config && typeof dados.config === 'object') {
      integracao.CONFIG_JSON = JSON.stringify(dados.config);
      atualizarIntegracaoCliente_(integracao.ID_INTEGRACAO, {
        CONFIG_JSON: integracao.CONFIG_JSON
      });
    }
    return circleTestarIntegracaoCliente_(integracao);
  }

  let segredo = token;
  if (segredo) salvarSegredo_('INTEGRACAO_TOKEN_' + integracao.ID_INTEGRACAO, segredo);
  else segredo = obterSegredo_('INTEGRACAO_TOKEN_' + integracao.ID_INTEGRACAO);
  if (!segredo) throw new Error('Informe a chave ou token da integração.');

  try {
    if (tipo === 'TLDV') {
      requisicaoJson_('https://pasta.tldv.io/v1alpha1/meetings', {
        method: 'get',
        headers: { 'x-api-key': segredo, Accept: 'application/json' }
      });
    } else if (tipo === 'API4COM') {
      throw new Error('A API4COM ainda precisa do endpoint específico da sua conta para teste. A credencial foi preservada.');
    } else {
      throw new Error('Teste ainda não implementado para esta integração.');
    }

    atualizarIntegracaoCliente_(integracao.ID_INTEGRACAO, {
      STATUS: 'CONECTADO',
      ULTIMO_ERRO: '',
      ATUALIZADO_EM: new Date()
    });

    limparCachesDados_();
    return {
      sucesso: true,
      mensagem: tipo + ' conectado com sucesso.',
      integracoesClientes: listarIntegracoesClientes_()
    };
  } catch (erro) {
    atualizarIntegracaoCliente_(integracao.ID_INTEGRACAO, {
      STATUS: 'ERRO',
      ULTIMO_ERRO: erro.message,
      ATUALIZADO_EM: new Date()
    });
    limparCachesDados_();
    throw erro;
  }
}

function desativarIntegracaoCliente(idIntegracao) {
  const integracao = localizarObjeto_(APP.sheets.integracoesClientes, 'ID_INTEGRACAO', idIntegracao);
  if (!integracao) throw new Error('Integração não encontrada.');

  atualizarIntegracaoCliente_(idIntegracao, {
    ATIVO: 'NAO',
    STATUS: 'INATIVA',
    ULTIMO_ERRO: ''
  });

  if (integracao.TIPO_INTEGRACAO === 'RD_STATION') reconciliarAcionadorRd_();
  limparCachesDados_();

  return {
    sucesso: true,
    mensagem: 'Integração desativada.',
    clientes: listarClientesCache_(),
    integracoesClientes: listarIntegracoesClientes_(),
    automacaoRd: obterStatusAutomacaoRd_()
  };
}

function testarRdCliente(idCliente, tokenTemporario) {
  const cliente = localizarObjeto_(APP.sheets.clientes, 'ID_CLIENTE', idCliente);
  if (!cliente) throw new Error('Cliente não encontrado.');

  const integracao = obterOuCriarIntegracaoCliente_(idCliente, 'RD_STATION', {
    ATIVO: 'SIM',
    ATUALIZADO_EM: new Date()
  });

  let token = String(tokenTemporario || '').trim();
  if (token) salvarSegredo_('INTEGRACAO_TOKEN_' + integracao.ID_INTEGRACAO, token);
  else token = obterSegredo_('INTEGRACAO_TOKEN_' + integracao.ID_INTEGRACAO);

  if (!token) throw new Error('Informe o token do RD Station.');

  try {
    buscarPaginaTarefasRd_(token, { page: 1, limit: 1 });

    atualizarIntegracaoCliente_(integracao.ID_INTEGRACAO, {
      ATIVO: 'SIM',
      STATUS: 'CONECTADO',
      ULTIMO_ERRO: '',
      ATUALIZADO_EM: new Date()
    });

    reconciliarAcionadorRd_();
    limparCachesDados_();

    return {
      sucesso: true,
      mensagem: 'RD Station conectado com sucesso.',
      clientes: listarClientes(),
      automacaoRd: obterStatusAutomacaoRd_()
    };
  } catch (erro) {
    atualizarIntegracaoCliente_(integracao.ID_INTEGRACAO, {
      STATUS: 'ERRO',
      ULTIMO_ERRO: erro.message,
      ATUALIZADO_EM: new Date()
    });
    limparCachesDados_();
    throw erro;
  }
}

function obterIntegracaoCliente_(idCliente, tipoIntegracao) {
  return lerObjetos_(APP.sheets.integracoesClientes).find(item =>
    String(item.ID_CLIENTE) === String(idCliente) &&
    String(item.TIPO_INTEGRACAO) === String(tipoIntegracao)
  ) || null;
}

function obterOuCriarIntegracaoCliente_(idCliente, tipoIntegracao, alteracoes) {
  const existente = obterIntegracaoCliente_(idCliente, tipoIntegracao);
  const agora = new Date();

  if (existente) {
    atualizarIntegracaoCliente_(existente.ID_INTEGRACAO, alteracoes || {});
    return Object.assign({}, existente, alteracoes || {});
  }

  const objeto = Object.assign({
    ID_INTEGRACAO: gerarId_('INTG'),
    ID_CLIENTE: idCliente,
    TIPO_INTEGRACAO: tipoIntegracao,
    ATIVO: 'NAO',
    STATUS: 'NAO_CONFIGURADA',
    ULTIMO_ERRO: '',
    ULTIMA_SINCRONIZACAO: '',
    CONFIG_JSON: '{}',
    CRIADO_EM: agora,
    ATUALIZADO_EM: agora
  }, alteracoes || {});

  adicionarObjeto_(APP.sheets.integracoesClientes, objeto);
  return objeto;
}

function atualizarIntegracaoCliente_(idIntegracao, alteracoes) {
  return atualizarPorCampo_(
    APP.sheets.integracoesClientes,
    'ID_INTEGRACAO',
    idIntegracao,
    Object.assign({ ATUALIZADO_EM: new Date() }, alteracoes || {})
  );
}

/* =========================================================
   AUTOMAÇÃO DIÁRIA RD
========================================================= */

function reconciliarAcionadorRd_() {
  const nomeFuncao = 'SINCRONIZAR_RD_DIARIO';

  const clientesAtivos = listarClientes().filter(cliente =>
    cliente.status === 'ATIVO' &&
    cliente.rdAtivo &&
    cliente.rdConfigurado
  );

  const existentes = ScriptApp.getProjectTriggers()
    .filter(trigger => trigger.getHandlerFunction() === nomeFuncao);

  if (existentes.length > 1) {
    existentes.slice(1).forEach(trigger => ScriptApp.deleteTrigger(trigger));
  }

  if (!clientesAtivos.length) {
    existentes.forEach(trigger => ScriptApp.deleteTrigger(trigger));
    removerAcionadoresProcessamentoRd_();
    salvarConfiguracao_('RD_AUTOMACAO_ATIVA', 'NAO');
    salvarSegredo_('RD_AUTOMACAO_ATIVA', 'NAO');
    return false;
  }

  if (!existentes.length) {
    ScriptApp.newTrigger(nomeFuncao)
      .timeBased()
      .atHour(APP.rdTriggerHour)
      .everyDays(1)
      .inTimezone(APP.timezone)
      .create();

    registrarLog_(
      'RD',
      'CRIAR_ACIONADOR',
      'Acionador diário criado para aproximadamente ' + APP.rdTriggerHour + 'h.'
    );
  }

  salvarConfiguracao_('RD_AUTOMACAO_ATIVA', 'SIM');
  salvarSegredo_('RD_AUTOMACAO_ATIVA', 'SIM');
  return true;
}

/**
 * Acionador diário: cria uma fila do dia anterior e inicia o primeiro lote.
 * O processamento restante continua em acionadores curtos e independentes.
 */
function SINCRONIZAR_RD_DIARIO(evento) {
  if (!evento || !evento.triggerUid) {
    registrarLog_(
      'RD',
      'EXECUCAO_IGNORADA',
      'SINCRONIZAR_RD_DIARIO foi chamada sem acionador.'
    );

    return {
      sucesso: false,
      ignorada: true,
      mensagem: 'Execução ignorada. Esta função roda pelo acionador diário.'
    };
  }

  const ontem = new Date();
  ontem.setDate(ontem.getDate() - 1);
  const dataReferencia = Utilities.formatDate(ontem, APP.timezone, 'yyyy-MM-dd');

  criarFilaRd_(dataReferencia, dataReferencia, 'AUTOMATICO', '');
  return PROCESSAR_FILA_RD({ origemInterna: true });
}

/**
 * Botão do front: apenas cria a fila e devolve imediatamente.
 * Nenhuma chamada ao RD acontece durante a requisição do usuário.
 */
function sincronizarRdAgora() {
  const agora = new Date();
  const hoje = Utilities.formatDate(agora, APP.timezone, 'yyyy-MM-dd');
  const inicioMes = Utilities.formatDate(
    new Date(agora.getFullYear(), agora.getMonth(), 1),
    APP.timezone,
    'yyyy-MM-dd'
  );
  const fila = criarFilaRd_(inicioMes, hoje, 'MANUAL_MES_ATUAL_TODOS', '');
  agendarProcessamentoRd_();

  return {
    sucesso: true,
    enfileirada: true,
    mensagem: fila.totalClientes
      ? 'Atualização do mês adicionada à fila para ' + fila.totalClientes + ' cliente(s) RD. O processamento ocorrerá em segundo plano.'
      : 'Nenhum cliente RD ativo e configurado foi encontrado.',
    filaRd: resumirFilaRd_(fila),
    automacaoRd: obterStatusAutomacaoRd_()
  };
}

function reprocessarRdPeriodo(dataInicio, dataFim, idCliente) {
  validarDataIso_(dataInicio);
  validarDataIso_(dataFim);

  const fila = criarFilaRd_(
    dataInicio,
    dataFim,
    'REPROCESSAMENTO',
    idCliente || ''
  );

  agendarProcessamentoRd_();

  return {
    sucesso: true,
    enfileirada: true,
    mensagem: 'Reprocessamento adicionado à fila.',
    filaRd: resumirFilaRd_(fila),
    automacaoRd: obterStatusAutomacaoRd_()
  };
}

function criarFilaRd_(dataInicio, dataFim, origem, apenasIdCliente) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    const filaAtual = obterFilaRd_();
    if (filaAtual && ['PENDENTE', 'PROCESSANDO'].includes(filaAtual.status)) {
      throw new Error(
        'Já existe uma sincronização do RD em andamento. Aguarde a conclusão antes de iniciar outra.'
      );
    }

    const clientes = listarClientes()
      .filter(cliente =>
        cliente.status === 'ATIVO' &&
        cliente.rdAtivo &&
        cliente.rdConfigurado &&
        (!apenasIdCliente || cliente.idCliente === apenasIdCliente)
      )
      .map(cliente => ({
        idCliente: cliente.idCliente,
        nomeCliente: cliente.nomeCliente
      }));

    const agora = new Date().toISOString();
    const fila = {
      idFila: gerarId_('FILA_RD'),
      status: clientes.length ? 'PENDENTE' : 'CONCLUIDA',
      origem: origem,
      dataInicio: dataInicio,
      dataFim: dataFim,
      clientes: clientes,
      indiceAtual: 0,
      totalClientes: clientes.length,
      clientesProcessados: 0,
      clientesComErro: 0,
      linhasGravadas: 0,
      erros: [],
      criadaEm: agora,
      iniciadaEm: '',
      atualizadaEm: agora,
      concluidaEm: clientes.length ? '' : agora
    };

    salvarFilaRd_(fila);
    salvarSegredo_('RD_ULTIMA_ORIGEM', origem);
    salvarSegredo_('RD_FILA_STATUS', fila.status);

    registrarLog_(
      'RD',
      'CRIAR_FILA',
      'Fila ' + fila.idFila + ' criada com ' + clientes.length + ' cliente(s).'
    );

    return fila;
  } finally {
    lock.releaseLock();
  }
}

/**
 * Processa poucos clientes por execução para não atingir o limite do Apps Script.
 */
function PROCESSAR_FILA_RD(evento) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) {
    return { sucesso: false, mensagem: 'Outro lote do RD já está sendo processado.' };
  }

  try {
    garantirEstruturaLigacoesRd_();
    removerAcionadoresProcessamentoRd_();

    const fila = obterFilaRd_();
    if (!fila || !['PENDENTE', 'PROCESSANDO'].includes(fila.status)) {
      return {
        sucesso: true,
        concluida: true,
        mensagem: 'Não existe fila pendente do RD.'
      };
    }

    if (!fila.iniciadaEm) fila.iniciadaEm = new Date().toISOString();
    fila.status = 'PROCESSANDO';
    fila.atualizadaEm = new Date().toISOString();
    salvarFilaRd_(fila);

    const inicio = fila.indiceAtual;
    const fim = Math.min(inicio + APP.rdBatchSize, fila.totalClientes);

    for (let i = inicio; i < fim; i++) {
      const itemFila = fila.clientes[i];
      const cliente = listarClientes().find(
        item => item.idCliente === itemFila.idCliente
      );

      if (!cliente) {
        fila.clientesComErro++;
        fila.erros.push(itemFila.nomeCliente + ': cliente não encontrado.');
        fila.indiceAtual = i + 1;
        continue;
      }

      try {
        const resultado = consolidarTarefasRdCliente_(
          cliente,
          fila.dataInicio,
          fila.dataFim
        );

        fila.clientesProcessados++;
        fila.linhasGravadas += resultado.linhasGravadas;

        const integracaoRd = obterIntegracaoCliente_(cliente.idCliente, 'RD_STATION');
        if (integracaoRd) {
          atualizarIntegracaoCliente_(integracaoRd.ID_INTEGRACAO, {
            STATUS: 'CONECTADO',
            ULTIMO_ERRO: '',
            ULTIMA_SINCRONIZACAO: new Date()
          });
        }
      } catch (erro) {
        fila.clientesComErro++;
        fila.erros.push(cliente.nomeCliente + ': ' + erro.message);

        const integracaoRd = obterIntegracaoCliente_(cliente.idCliente, 'RD_STATION');
        if (integracaoRd) {
          atualizarIntegracaoCliente_(integracaoRd.ID_INTEGRACAO, {
            STATUS: 'ERRO',
            ULTIMO_ERRO: erro.message,
            ULTIMA_SINCRONIZACAO: new Date()
          });
        }

        registrarLog_(
          'RD',
          'ERRO_CLIENTE',
          cliente.nomeCliente + ': ' + erro.message
        );
      }

      fila.indiceAtual = i + 1;
      fila.atualizadaEm = new Date().toISOString();
      salvarFilaRd_(fila);
    }

    if (fila.indiceAtual >= fila.totalClientes) {
      finalizarFilaRd_(fila);

      return {
        sucesso: true,
        concluida: true,
        mensagem: 'Sincronização do RD concluída.',
        filaRd: resumirFilaRd_(fila)
      };
    }

    fila.status = 'PENDENTE';
    fila.atualizadaEm = new Date().toISOString();
    salvarFilaRd_(fila);
    agendarProcessamentoRd_();

    return {
      sucesso: true,
      concluida: false,
      mensagem: 'Lote processado. A fila continuará em segundo plano.',
      filaRd: resumirFilaRd_(fila)
    };
  } finally {
    lock.releaseLock();
  }
}

function garantirEstruturaLigacoesRd_() {
  const cache = CacheService.getScriptCache();
  if (cache.get('RD_LIGACOES_SCHEMA') === APP.versao) return;
  criarAbasAusentes_();
  cache.put('RD_LIGACOES_SCHEMA', APP.versao, 21600);
}

function finalizarFilaRd_(fila) {
  const agora = new Date();
  fila.status = fila.clientesComErro ? 'CONCLUIDA_COM_ERROS' : 'CONCLUIDA';
  fila.concluidaEm = agora.toISOString();
  fila.atualizadaEm = agora.toISOString();
  salvarFilaRd_(fila);

  const retorno = resumirFilaRd_(fila);
  salvarConfiguracao_('RD_ULTIMA_EXECUCAO', agora);
  salvarConfiguracao_('RD_ULTIMA_ORIGEM', fila.origem);
  salvarConfiguracao_('RD_ULTIMO_RESULTADO', JSON.stringify(retorno));

  salvarSegredo_('RD_ULTIMA_EXECUCAO', agora.toISOString());
  salvarSegredo_('RD_ULTIMA_ORIGEM', fila.origem);
  salvarSegredo_('RD_ULTIMO_RESULTADO', JSON.stringify(retorno));
  salvarSegredo_('RD_FILA_STATUS', fila.status);

  limparCachesDados_();

  registrarLog_(
    'RD',
    'FINALIZAR_FILA',
    'Fila ' + fila.idFila + ' concluída. Processados: ' +
      fila.clientesProcessados + '. Erros: ' + fila.clientesComErro + '.'
  );
}

function obterFilaRd_() {
  const texto = obterSegredo_('RD_FILA_JSON');
  if (!texto) return null;

  try {
    return JSON.parse(texto);
  } catch (erro) {
    return null;
  }
}

function salvarFilaRd_(fila) {
  salvarSegredo_('RD_FILA_JSON', JSON.stringify(fila));
  salvarSegredo_('RD_FILA_STATUS', fila.status || '');
}

function resumirFilaRd_(fila) {
  if (!fila) return null;

  return {
    idFila: fila.idFila || '',
    status: fila.status || '',
    origem: fila.origem || '',
    dataInicio: fila.dataInicio || '',
    dataFim: fila.dataFim || '',
    totalClientes: Number(fila.totalClientes || 0),
    clientesProcessados: Number(fila.clientesProcessados || 0),
    clientesComErro: Number(fila.clientesComErro || 0),
    linhasGravadas: Number(fila.linhasGravadas || 0),
    pendentes: Math.max(
      0,
      Number(fila.totalClientes || 0) - Number(fila.indiceAtual || 0)
    ),
    criadaEm: fila.criadaEm || '',
    iniciadaEm: fila.iniciadaEm || '',
    atualizadaEm: fila.atualizadaEm || '',
    concluidaEm: fila.concluidaEm || '',
    erros: (fila.erros || []).slice(-10)
  };
}

function agendarProcessamentoRd_() {
  const fila = obterFilaRd_();
  if (!fila || !['PENDENTE', 'PROCESSANDO'].includes(fila.status)) return false;

  const existentes = ScriptApp.getProjectTriggers()
    .filter(trigger => trigger.getHandlerFunction() === 'PROCESSAR_FILA_RD');

  if (existentes.length) return true;

  ScriptApp.newTrigger('PROCESSAR_FILA_RD')
    .timeBased()
    .after(APP.rdContinuationMinutes * 60 * 1000)
    .create();

  return true;
}

function removerAcionadoresProcessamentoRd_() {
  ScriptApp.getProjectTriggers()
    .filter(trigger => trigger.getHandlerFunction() === 'PROCESSAR_FILA_RD')
    .forEach(trigger => ScriptApp.deleteTrigger(trigger));
}

function consolidarTarefasRdCliente_(cliente, dataInicio, dataFim) {
  const integracao = obterIntegracaoCliente_(cliente.idCliente, 'RD_STATION');
  const token = integracao ? obterSegredo_('INTEGRACAO_TOKEN_' + integracao.ID_INTEGRACAO) : '';
  if (!token) throw new Error('Token do RD não encontrado.');

  const grupos = {};
  const ligacoesComGravacao = {};
  const tarefasComGravacao = [];
  let pagina = 1;
  let continuar = true;

  while (continuar && pagina <= APP.rdMaxPages) {
    const resposta = buscarPaginaTarefasRd_(token, {
      page: pagina,
      limit: APP.rdPageLimit,
      date_start: dataInicio,
      date_end: dataFim
    });

    const tarefas = extrairListaTarefasRd_(resposta);

    tarefas.forEach(tarefa => {
      if (tarefaLigacaoRdPossuiGravacao_(tarefa)) tarefasComGravacao.push(tarefa);
      const dataReferencia = extrairDataTarefaRd_(tarefa) || dataInicio;
      const responsaveis = extrairResponsaveisRd_(tarefa);

      const listaResponsaveis = responsaveis.length
        ? responsaveis
        : [{ id: 'SEM_RESPONSAVEL', nome: 'Sem responsável' }];

      listaResponsaveis.forEach(responsavel => {
        const chave =
          dataReferencia +
          '|' +
          cliente.idCliente +
          '|' +
          responsavel.id;

        if (!grupos[chave]) {
          grupos[chave] = criarGrupoResumoRd_(
            dataReferencia,
            cliente,
            responsavel
          );
        }

        acumularTarefaRd_(grupos[chave], tarefa);
      });
    });

    continuar = existeProximaPaginaRd_(
      resposta,
      pagina,
      tarefas.length,
      APP.rdPageLimit
    );

    pagina++;
  }

  if (pagina > APP.rdMaxPages && continuar) {
    throw new Error(
      'A consulta atingiu o limite de segurança de ' +
      APP.rdMaxPages +
      ' páginas.'
    );
  }

  const registros = Object.values(grupos);
  salvarLigacoesRdEmLote_(cliente, tarefasComGravacao).forEach(id => {
    ligacoesComGravacao[id] = true;
  });

  if (!registros.length) {
    const responsavel = {
      id: 'SEM_MOVIMENTO',
      nome: 'Sem movimento'
    };

    registros.push(
      criarGrupoResumoRd_(dataInicio, cliente, responsavel)
    );
  }

  registros.forEach(registro => {
    registro.STATUS = 'CONCLUIDO';
    registro.SINCRONIZADO_EM = new Date();
    registro.ERRO = '';

    salvarResumoRd_(registro);
  });

  return {
    linhasGravadas: registros.length,
    ligacoesComGravacao: Object.keys(ligacoesComGravacao).length
  };
}

function buscarPaginaTarefasRd_(token, parametros) {
  const query = Object.keys(parametros || {})
    .filter(chave => parametros[chave] !== '' && parametros[chave] !== null)
    .map(chave =>
      encodeURIComponent(chave) +
      '=' +
      encodeURIComponent(parametros[chave])
    )
    .join('&');

  const url =
    APP.rdBaseUrl +
    '/tasks?token=' +
    encodeURIComponent(token) +
    (query ? '&' + query : '');

  return requisicaoJson_(url, {
    method: 'get',
    headers: {
      Accept: 'application/json'
    }
  });
}

function extrairListaTarefasRd_(resposta) {
  if (Array.isArray(resposta)) return resposta;
  if (!resposta || typeof resposta !== 'object') return [];

  const candidatos = [
    resposta.tasks,
    resposta.data,
    resposta.results,
    resposta.items
  ];

  for (let i = 0; i < candidatos.length; i++) {
    if (Array.isArray(candidatos[i])) return candidatos[i];
  }

  return [];
}

function tarefaLigacaoRdPossuiGravacao_(tarefa) {
  if (!tarefa || String(tarefa.type || '').toLowerCase() !== 'call') return '';

  const concluida =
    tarefa.done === true ||
    String(tarefa.done).toLowerCase() === 'true' ||
    Boolean(tarefa.done_at || tarefa.done_date || tarefa.completed_at);
  return concluida && Boolean(extrairUrlGravacaoApi4comTarefa_(tarefa));
}

function criarRegistroLigacaoRd_(cliente, tarefa, existente) {
  const urlGravacao = extrairUrlGravacaoApi4comTarefa_(tarefa);
  if (!urlGravacao) return null;

  const idTarefa = String(tarefa.id || tarefa._id || tarefa.task_id || '').trim();
  if (!idTarefa) return null;
  const idExterno = 'RD_TASK_' + idTarefa;
  const responsavel = extrairResponsaveisRd_(tarefa)[0] || { nome: '' };
  const deal = tarefa.deal && typeof tarefa.deal === 'object' ? tarefa.deal : {};
  const idDeal = String(
    deal.id || deal._id || tarefa.deal_id || tarefa.dealId || ''
  ).trim();
  const oportunidade = String(
    deal.name || deal.nome || tarefa.deal_name || tarefa.opportunity_name || ''
  ).trim();
  const titulo = String(
    oportunidade || tarefa.subject || tarefa.title || 'Ligação concluída no RD'
  ).trim();
  const descricao = extrairDescricaoTarefaRd_(tarefa);
  const duracaoExtraida = extrairDuracaoLigacaoRd_(tarefa, descricao);
  const agora = new Date();
  return {
    ID_INTERACAO: existente ? existente.ID_INTERACAO : gerarId_('INT'),
    FONTE: 'API4COM',
    ID_EXTERNO: idExterno,
    TIPO_INTERACAO: 'LIGACAO',
    ID_CLIENTE: cliente.idCliente,
    VENDEDOR: responsavel.nome || '',
    LEAD: extrairLeadTarefaRd_(tarefa),
    TITULO: titulo,
    DATA_INTERACAO: extrairDataTarefaRd_(tarefa) || new Date(),
    DURACAO_SEGUNDOS: duracaoExtraida || (existente ? existente.DURACAO_SEGUNDOS : ''),
    LINK_ORIGINAL: String(tarefa.url || tarefa.task_url || '') || urlGravacao,
    URL_GRAVACAO: urlGravacao,
    STATUS_TRANSCRICAO: existente ? (existente.STATUS_TRANSCRICAO || 'PENDENTE') : 'PENDENTE',
    STATUS_AUDITORIA: existente ? (existente.STATUS_AUDITORIA || 'PENDENTE') : 'PENDENTE',
    IMPORTADO_EM: existente ? existente.IMPORTADO_EM : agora,
    ATUALIZADO_EM: agora,
    NOME_ARQUIVO_ORIGEM: urlGravacao.split('?')[0].split('/').pop() || 'gravacao.mp3',
    EMPRESA_ARQUIVO: oportunidade || '',
    NUMERO_CHAMADA: '',
    COLABORADOR: responsavel.nome || '',
    FUNCAO: 'SDR',
    OPORTUNIDADE: oportunidade,
    LINK_CRM: idDeal ? 'https://crm.rdstation.com/app/deals/' + encodeURIComponent(idDeal) + '?view=pipeline' : '',
    SCHEMA_VERSAO: APP.versao,
    PARTICIPANTES_JSON: existente ? (existente.PARTICIPANTES_JSON || '') : '',
    DESCRICAO_ORIGEM: descricao
  };
}

function salvarLigacoesRdEmLote_(cliente, tarefas) {
  if (!tarefas || !tarefas.length) return [];
  const aba = abrirPlanilha_().getSheetByName(APP.sheets.interacoes);
  if (!aba) throw new Error('Aba não encontrada: ' + APP.sheets.interacoes);
  const dados = aba.getDataRange().getValues();
  const cabecalhos = dados[0] || [];
  const indiceExterno = cabecalhos.indexOf('ID_EXTERNO');
  if (indiceExterno < 0) throw new Error('Campo ID_EXTERNO não encontrado em INTERACOES.');
  const existentes = {};
  dados.slice(1).forEach((linha, indice) => {
    const id = String(linha[indiceExterno] || '');
    if (!id) return;
    const objeto = {};
    cabecalhos.forEach((cabecalho, coluna) => { objeto[cabecalho] = linha[coluna]; });
    existentes[id] = { objeto: objeto, linha: indice + 2, valores: linha };
  });

  const novos = [];
  let houveAtualizacoes = false;
  const ids = [];
  const vistos = {};
  tarefas.forEach(tarefa => {
    const idTarefa = String(tarefa.id || tarefa._id || tarefa.task_id || '').trim();
    if (!idTarefa) return;
    const idExterno = 'RD_TASK_' + idTarefa;
    if (vistos[idExterno]) return;
    vistos[idExterno] = true;
    const atual = existentes[idExterno] || null;
    const registro = criarRegistroLigacaoRd_(cliente, tarefa, atual ? atual.objeto : null);
    if (!registro) return;
    ids.push(idExterno);
    const linha = cabecalhos.map((cabecalho, coluna) =>
      registro[cabecalho] !== undefined
        ? registro[cabecalho]
        : (atual ? atual.valores[coluna] : '')
    );
    if (atual) {
      dados[atual.linha - 1] = linha;
      houveAtualizacoes = true;
    } else novos.push(linha);
  });

  if (houveAtualizacoes && dados.length > 1) {
    aba.getRange(2, 1, dados.length - 1, cabecalhos.length).setValues(dados.slice(1));
  }
  if (novos.length) {
    const primeiraLinha = Math.max(aba.getLastRow() + 1, 2);
    aba.getRange(primeiraLinha, 1, novos.length, cabecalhos.length).setValues(novos);
  }
  return ids;
}

function extrairDescricaoTarefaRd_(tarefa) {
  const valores = [
    tarefa.notes,
    tarefa.note,
    tarefa.description,
    tarefa.descricao,
    tarefa.result,
    tarefa.subject
  ];
  return valores
    .filter(valor => valor !== undefined && valor !== null && String(valor).trim())
    .map(normalizarTextoNotaRd_)
    .filter(Boolean)
    .join('\n')
    .trim();
}

function normalizarTextoNotaRd_(valor) {
  if (valor === undefined || valor === null) return '';
  if (Array.isArray(valor)) return valor.map(normalizarTextoNotaRd_).filter(Boolean).join('\n');
  if (typeof valor !== 'object') return String(valor).trim();
  const preferenciais = ['text', 'texto', 'content', 'body', 'description', 'note', 'notes', 'value', 'markup'];
  const partesPreferenciais = preferenciais
    .filter(chave => valor[chave] !== undefined && valor[chave] !== null)
    .map(chave => normalizarTextoNotaRd_(valor[chave]))
    .filter(Boolean);
  if (partesPreferenciais.length) return partesPreferenciais.join('\n');
  return Object.keys(valor)
    .filter(chave => typeof valor[chave] === 'string')
    .map(chave => String(valor[chave]).trim())
    .filter(Boolean)
    .join('\n');
}

function extrairDuracaoLigacaoRd_(tarefa, descricao) {
  tarefa = tarefa || {};
  const resultado = tarefa.result && typeof tarefa.result === 'object' ? tarefa.result : {};
  const segundosDiretos = [
    tarefa.duration_seconds,
    tarefa.call_duration_seconds,
    tarefa.talk_time_seconds,
    resultado.duration_seconds,
    resultado.call_duration_seconds
  ];
  for (let i = 0; i < segundosDiretos.length; i++) {
    const segundos = Number(segundosDiretos[i]);
    if (isFinite(segundos) && segundos > 0) return Math.round(segundos);
  }
  const duracoesGenericas = [tarefa.duration, tarefa.call_duration, tarefa.talk_time, resultado.duration, resultado.call_duration];
  for (let i = 0; i < duracoesGenericas.length; i++) {
    const valor = duracoesGenericas[i];
    const peloTexto = extrairDuracaoTextoRd_(valor);
    if (peloTexto > 0) return peloTexto;
    const numero = Number(valor);
    if (isFinite(numero) && numero > 0) return Math.round(numero > 86400 ? numero / 1000 : numero);
  }
  return extrairDuracaoTextoRd_(descricao);
}

function extrairDuracaoTextoRd_(valor) {
  const texto = String(valor || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!texto) return 0;
  const chave = '(?:dura(?:ç|c)[aã]o(?: da (?:liga(?:ç|c)[aã]o|chamada))?|tempo(?: total)?(?: da (?:liga(?:ç|c)[aã]o|chamada))?|call duration|talk time)';
  let achou = texto.match(new RegExp(chave + '[^0-9]{0,30}(\\d{1,3}):(\\d{2}):(\\d{2})', 'i'));
  if (achou) return Number(achou[1]) * 3600 + Number(achou[2]) * 60 + Number(achou[3]);
  achou = texto.match(new RegExp(chave + '[^0-9]{0,30}(\\d{1,4}):(\\d{2})', 'i'));
  if (achou) return Number(achou[1]) * 60 + Number(achou[2]);
  achou = texto.match(new RegExp(chave + '[^0-9]{0,30}(?:(\\d+)\\s*(?:h|hora|horas))?\\s*(?:(\\d+)\\s*(?:m|min|minuto|minutos))?\\s*(?:(\\d+)\\s*(?:s|seg|segundo|segundos))', 'i'));
  if (achou) return Number(achou[1] || 0) * 3600 + Number(achou[2] || 0) * 60 + Number(achou[3] || 0);
  achou = texto.match(new RegExp(chave + '[^0-9]{0,30}(\\d+)\\s*(?:m|min|minuto|minutos)\\s*(?:e|,)?\\s*(\\d+)\\s*(?:s|seg|segundo|segundos)', 'i'));
  if (achou) return Number(achou[1]) * 60 + Number(achou[2]);
  achou = texto.match(new RegExp(chave + '[^0-9]{0,30}(\\d+)\\s*(?:s|seg|segundo|segundos)', 'i'));
  if (achou) return Number(achou[1]);
  return 0;
}

function REPROCESSAR_DURACOES_LIGACOES_RD() {
  const aba = abrirPlanilha_().getSheetByName(APP.sheets.interacoes);
  if (!aba || aba.getLastRow() < 2) return { sucesso: true, analisadas: 0, encontradas: 0, atualizadas: 0 };
  const dados = aba.getDataRange().getValues();
  const cabecalhos = dados[0] || [];
  const colunas = {
    externo: cabecalhos.indexOf('ID_EXTERNO'),
    descricao: cabecalhos.indexOf('DESCRICAO_ORIGEM'),
    duracao: cabecalhos.indexOf('DURACAO_SEGUNDOS')
  };
  if (colunas.externo < 0 || colunas.descricao < 0 || colunas.duracao < 0) throw new Error('A estrutura de INTERACOES não contém os campos necessários para reprocessar a duração.');
  let analisadas = 0;
  let encontradas = 0;
  let atualizadas = 0;
  const duracoes = dados.slice(1).map(linha => {
    const atual = Number(linha[colunas.duracao] || 0);
    if (String(linha[colunas.externo] || '').indexOf('RD_TASK_') !== 0) return [linha[colunas.duracao]];
    analisadas++;
    const extraida = extrairDuracaoTextoRd_(linha[colunas.descricao]);
    if (extraida > 0) {
      encontradas++;
      if (extraida !== atual) atualizadas++;
      return [extraida];
    }
    return [linha[colunas.duracao]];
  });
  aba.getRange(2, colunas.duracao + 1, duracoes.length, 1).setValues(duracoes);
  limparCachesDados_();
  registrarLog_('RD', 'REPROCESSAR_DURACOES', analisadas + ' analisadas, ' + encontradas + ' durações encontradas, ' + atualizadas + ' atualizadas.');
  return { sucesso: true, analisadas: analisadas, encontradas: encontradas, atualizadas: atualizadas };
}

function extrairUrlGravacaoApi4comTarefa_(tarefa) {
  const texto = [
    extrairDescricaoTarefaRd_(tarefa),
    tarefa.recording_url,
    tarefa.record_url,
    tarefa.audio_url,
    tarefa.url_gravacao
  ]
    .filter(Boolean)
    .map(String)
    .join('\n')
    .replace(/&amp;/gi, '&');
  const urls = texto.match(/https:\/\/[^\s<>"']+/gi) || [];
  const candidata = urls.find(url =>
    /(?:^|\.)api4com\.com\//i.test(url) && /\.mp3(?:[?#]|$)/i.test(url)
  );
  return candidata ? candidata.replace(/[),.;\]}]+$/g, '') : '';
}

function extrairLeadTarefaRd_(tarefa) {
  const contato = tarefa.contact && typeof tarefa.contact === 'object'
    ? tarefa.contact
    : ((tarefa.deal || {}).contact || {});
  return String(
    contato.name || contato.nome || tarefa.contact_name || tarefa.lead_name || ''
  ).trim();
}

function existeProximaPaginaRd_(resposta, paginaAtual, quantidade, limite) {
  if (!quantidade) return false;

  const paginacao =
    resposta.pagination ||
    resposta.paging ||
    resposta.meta ||
    {};

  const totalPaginas = Number(
    paginacao.total_pages ||
    paginacao.pages ||
    resposta.total_pages ||
    resposta.pages ||
    0
  );

  if (totalPaginas) return paginaAtual < totalPaginas;

  const proxima =
    paginacao.next_page ||
    paginacao.next ||
    resposta.next_page ||
    resposta.next;

  if (proxima !== undefined && proxima !== null) {
    return Boolean(proxima);
  }

  return quantidade >= limite;
}

function extrairResponsaveisRd_(tarefa) {
  const origem =
    tarefa.users ||
    tarefa.user ||
    tarefa.responsibles ||
    tarefa.responsible ||
    tarefa.user_id ||
    [];

  const lista = Array.isArray(origem) ? origem : [origem];

  return lista
    .filter(Boolean)
    .map(item => {
      if (typeof item === 'string' || typeof item === 'number') {
        return {
          id: String(item),
          nome: String(item)
        };
      }

      return {
        id: String(
          item.id ||
          item._id ||
          item.user_id ||
          item.email ||
          'SEM_ID'
        ),
        nome: String(
          item.name ||
          item.nome ||
          item.email ||
          item.id ||
          'Sem responsável'
        )
      };
    });
}

function extrairDataTarefaRd_(tarefa) {
  const valor =
    tarefa.done_date ||
    tarefa.date ||
    tarefa.task_date ||
    tarefa.created_at ||
    '';

  if (!valor) return '';

  const texto = String(valor).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(texto) ? texto : '';
}

function criarGrupoResumoRd_(dataReferencia, cliente, responsavel) {
  return {
    CHAVE_UNICA:
      dataReferencia +
      '|' +
      cliente.idCliente +
      '|' +
      responsavel.id,
    DATA_REFERENCIA: dataReferencia,
    ID_CLIENTE: cliente.idCliente,
    CLIENTE: cliente.nomeCliente,
    RESPONSAVEL_ID: responsavel.id,
    RESPONSAVEL: responsavel.nome,
    TOTAL_TAREFAS: 0,
    CONCLUIDAS: 0,
    PENDENTES: 0,
    LIGACOES: 0,
    EMAILS: 0,
    WHATSAPP: 0,
    REUNIOES: 0,
    VISITAS: 0,
    TAREFAS: 0,
    ALMOCOS: 0,
    OUTROS: 0,
    STATUS: 'PROCESSANDO',
    SINCRONIZADO_EM: '',
    ERRO: ''
  };
}

function acumularTarefaRd_(grupo, tarefa) {
  grupo.TOTAL_TAREFAS++;

  const concluida =
    tarefa.done === true ||
    String(tarefa.done).toLowerCase() === 'true' ||
    Boolean(tarefa.done_at || tarefa.done_date);

  if (concluida) {
    grupo.CONCLUIDAS++;
  } else {
    grupo.PENDENTES++;
  }

  const tipo = String(tarefa.type || '').toLowerCase();

  if (tipo === 'call') grupo.LIGACOES++;
  else if (tipo === 'email') grupo.EMAILS++;
  else if (tipo === 'whatsapp') grupo.WHATSAPP++;
  else if (tipo === 'meeting') grupo.REUNIOES++;
  else if (tipo === 'visit') grupo.VISITAS++;
  else if (tipo === 'task') grupo.TAREFAS++;
  else if (tipo === 'lunch') grupo.ALMOCOS++;
  else grupo.OUTROS++;
}

function salvarResumoRd_(registro) {
  const existente = localizarObjeto_(
    APP.sheets.resumoRd,
    'CHAVE_UNICA',
    registro.CHAVE_UNICA
  );

  if (existente) {
    atualizarPorCampo_(
      APP.sheets.resumoRd,
      'CHAVE_UNICA',
      registro.CHAVE_UNICA,
      registro
    );
  } else {
    adicionarObjeto_(APP.sheets.resumoRd, registro);
  }
}

function listarResumoRd_() {
  return lerObjetos_(APP.sheets.resumoRd)
    .filter(item => item.CHAVE_UNICA)
    .sort((a, b) =>
      String(b.DATA_REFERENCIA).localeCompare(String(a.DATA_REFERENCIA))
    )
    .slice(0, 5000)
    .map(item => ({
      chaveUnica: item.CHAVE_UNICA,
      dataReferencia: serializarDataSomenteDia_(item.DATA_REFERENCIA),
      idCliente: item.ID_CLIENTE,
      cliente: item.CLIENTE,
      responsavelId: item.RESPONSAVEL_ID,
      responsavel: item.RESPONSAVEL,
      totalTarefas: Number(item.TOTAL_TAREFAS || 0),
      concluidas: Number(item.CONCLUIDAS || 0),
      pendentes: Number(item.PENDENTES || 0),
      ligacoes: Number(item.LIGACOES || 0),
      emails: Number(item.EMAILS || 0),
      whatsapp: Number(item.WHATSAPP || 0),
      reunioes: Number(item.REUNIOES || 0),
      visitas: Number(item.VISITAS || 0),
      tarefas: Number(item.TAREFAS || 0),
      almocos: Number(item.ALMOCOS || 0),
      outros: Number(item.OUTROS || 0),
      status: item.STATUS,
      sincronizadoEm: serializarData_(item.SINCRONIZADO_EM),
      erro: item.ERRO || ''
    }));
}

function listarLigacoesRd_() {
  const transcricoes = {};
  lerObjetos_(APP.sheets.transcricoes).forEach(item => {
    if (item.ID_INTERACAO) transcricoes[String(item.ID_INTERACAO)] = item;
  });
  const auditorias = {};
  lerObjetos_(APP.sheets.auditorias).forEach(item => {
    if (item.ID_INTERACAO) auditorias[String(item.ID_INTERACAO)] = item;
  });
  const clientes = {};
  listarClientesCache_().forEach(item => {
    clientes[String(item.idCliente)] = item.nomeCliente || '';
  });

  return lerObjetos_(APP.sheets.interacoes)
    .filter(item =>
      String(item.ID_EXTERNO || '').indexOf('RD_TASK_') === 0 &&
      String(item.URL_GRAVACAO || '').trim()
    )
    .sort((a, b) => String(b.DATA_INTERACAO || '').localeCompare(String(a.DATA_INTERACAO || '')))
    .slice(0, 5000)
    .map(item => {
      const transcricao = transcricoes[String(item.ID_INTERACAO)] || {};
      const auditoria = auditorias[String(item.ID_INTERACAO)] || {};
      const transcrita = String(transcricao.STATUS || '').toUpperCase() === 'CONCLUIDA';
      return {
        idInteracao: item.ID_INTERACAO,
        idExterno: item.ID_EXTERNO,
        idCliente: item.ID_CLIENTE,
        cliente: clientes[String(item.ID_CLIENTE)] || '',
        dataInteracao: serializarData_(item.DATA_INTERACAO),
        responsavel: item.COLABORADOR || item.VENDEDOR || '',
        lead: item.LEAD || '',
        titulo: item.TITULO || 'Ligação concluída',
        oportunidade: item.OPORTUNIDADE || '',
        descricao: item.DESCRICAO_ORIGEM || '',
        duracaoSegundos: Number(item.DURACAO_SEGUNDOS || 0),
        urlGravacao: item.URL_GRAVACAO || '',
        linkCrm: item.LINK_CRM || '',
        statusTranscricao: transcrita ? 'CONCLUIDA' : (item.STATUS_TRANSCRICAO || 'PENDENTE'),
        statusAuditoria: auditoria.STATUS || item.STATUS_AUDITORIA || 'PENDENTE',
        idAuditoria: auditoria.ID_AUDITORIA || ''
      };
    });
}

function obterStatusAutomacaoRd_() {
  const ativa = obterSegredo_('RD_AUTOMACAO_ATIVA') === 'SIM';
  const fila = obterFilaRd_();

  return {
    ativa: ativa,
    horarioAproximado: String(APP.rdTriggerHour).padStart(2, '0') + ':00',
    ultimaExecucao: serializarData_(obterSegredo_('RD_ULTIMA_EXECUCAO')),
    ultimaOrigem: obterSegredo_('RD_ULTIMA_ORIGEM') || '',
    ultimoResultado: obterSegredo_('RD_ULTIMO_RESULTADO') || '',
    filaRd: resumirFilaRd_(fila)
  };
}

/* =========================================================
   TLDV E GEMINI - INTEGRAÇÕES GERAIS
========================================================= */

function obterStatusIntegracoesGerais_() {
  return {
    tldvConfigurado: Boolean(obterSegredo_('TLDV_API_KEY')),
    automacaoTldv: obterStatusAutomacaoTldv_(),
    geminiConfigurado: Boolean(obterSegredo_('GEMINI_API_KEY')),
    api4comConfigurado: Boolean(obterSegredo_('API4COM_API_KEY')),
    circleConfigurado: Boolean(obterSegredo_('CIRCLE_ADMIN_V2_TOKEN')),
    circleAuthorEmail: obterConfiguracao_('CIRCLE_AUTHOR_EMAIL') || '',
    geminiModel:
      obterConfiguracao_('GEMINI_MODEL') ||
      'gemini-2.5-flash-lite'
  };
}

function salvarIntegracoesGerais(dados) {
  dados = dados || {};

  salvarSegredoSeInformado_('TLDV_API_KEY', dados.tldvApiKey);
  salvarSegredoSeInformado_('GEMINI_API_KEY', dados.geminiApiKey);
  salvarSegredoSeInformado_('API4COM_API_KEY', dados.api4comApiKey);
  salvarSegredoSeInformado_('CIRCLE_ADMIN_V2_TOKEN', dados.circleApiToken);

  if (dados.circleAuthorEmail !== undefined) {
    salvarConfiguracao_('CIRCLE_AUTHOR_EMAIL', String(dados.circleAuthorEmail || '').trim());
  }

  if (dados.geminiModel !== undefined) {
    salvarConfiguracao_(
      'GEMINI_MODEL',
      String(dados.geminiModel || '').trim()
    );
  }

  if (obterSegredo_('TLDV_API_KEY')) {
    instalarAutomacaoTldv();
  }

  limparCachesDados_();

  return {
    sucesso: true,
    mensagem: 'Integrações salvas.',
    integracoes: obterStatusIntegracoesGerais_()
  };
}

function listarReunioes_() {
  const transcricoes = lerObjetos_(APP.sheets.transcricoes);
  const mapaTranscricoes = {};
  transcricoes.forEach(item => {
    if (item.ID_INTERACAO) mapaTranscricoes[item.ID_INTERACAO] = item;
  });

  return lerObjetos_(APP.sheets.interacoes)
    .filter(item => item.FONTE === 'TLDV')
    .sort((a, b) => new Date(b.DATA_INTERACAO || 0) - new Date(a.DATA_INTERACAO || 0))
    .slice(0, 500)
    .map(item => {
      const transcricao = mapaTranscricoes[item.ID_INTERACAO] || {};
      return {
        idInteracao: item.ID_INTERACAO,
        idExterno: item.ID_EXTERNO,
        titulo: item.TITULO,
        vendedor: item.VENDEDOR,
        dataInteracao: serializarData_(item.DATA_INTERACAO),
        duracaoSegundos: Number(item.DURACAO_SEGUNDOS || 0),
        linkOriginal: item.LINK_ORIGINAL,
        statusTranscricao: transcricao.STATUS || item.STATUS_TRANSCRICAO || 'PENDENTE',
        possuiTranscricao: Boolean(transcricao.CONTEUDO),
        statusAuditoria: item.STATUS_AUDITORIA
      };
    });
}


function testarConexaoTldv() {
  const apiKey = obterSegredo_('TLDV_API_KEY');
  if (!apiKey) throw new Error('Informe e salve a chave tl;dv em Integrações.');

  requisicaoJson_(APP.tldvBaseUrl + '/health', {
    method: 'get',
    headers: {
      'x-api-key': apiKey,
      'Accept': 'application/json'
    }
  });

  return {
    sucesso: true,
    mensagem: 'Conexão com o tl;dv validada com sucesso.'
  };
}

/**
 * Mantém sete acionadores diários do tl;dv, um para cada horário operacional.
 * A reinstalação é idempotente: acionadores antigos são removidos antes da
 * criação da agenda oficial, evitando sincronizações duplicadas.
 */
function instalarAutomacaoTldv() {
  const nomeFuncao = 'SINCRONIZAR_TLDV_AGENDADO';
  const horas = APP.tldvSyncHours.slice();

  ScriptApp.getProjectTriggers()
    .filter(trigger => trigger.getHandlerFunction() === nomeFuncao)
    .forEach(trigger => ScriptApp.deleteTrigger(trigger));

  horas.forEach(hora => {
    ScriptApp.newTrigger(nomeFuncao)
      .timeBased()
      .everyDays(1)
      .atHour(hora)
      .nearMinute(0)
      .inTimezone(APP.timezone)
      .create();
  });

  const horarios = horas.map(hora => String(hora).padStart(2, '0') + ':00');
  salvarConfiguracao_('TLDV_AUTOMACAO_ATIVA', 'SIM');
  salvarConfiguracao_('TLDV_AUTOMACAO_HORARIOS', horarios.join(', '));
  salvarConfiguracao_('TLDV_AUTOMACAO_ATUALIZADA_EM', new Date());
  registrarLog_('TLDV', 'CRIAR_ACIONADORES', 'Agenda automática: ' + horarios.join(', ') + '.');

  return {
    sucesso: true,
    mensagem: 'Sincronização automática do tl;dv configurada em 7 horários diários.',
    automacao: obterStatusAutomacaoTldv_()
  };
}

function obterStatusAutomacaoTldv_() {
  const nomeFuncao = 'SINCRONIZAR_TLDV_AGENDADO';
  let totalAcionadores = 0;

  try {
    totalAcionadores = ScriptApp.getProjectTriggers()
      .filter(trigger => trigger.getHandlerFunction() === nomeFuncao)
      .length;
  } catch (erro) {
    totalAcionadores = 0;
  }

  const horarios = APP.tldvSyncHours.map(hora =>
    String(hora).padStart(2, '0') + ':00'
  );

  return {
    ativa: totalAcionadores === horarios.length,
    totalAcionadores: totalAcionadores,
    horarios: horarios,
    timezone: APP.timezone,
    ultimaExecucao: serializarData_(obterConfiguracao_('TLDV_ULTIMA_EXECUCAO')),
    ultimoStatus: obterConfiguracao_('TLDV_ULTIMO_STATUS') || '',
    ultimoResultado: obterConfiguracao_('TLDV_ULTIMO_RESULTADO') || ''
  };
}

/**
 * Função executada pelos acionadores. A trava impede que dois horários se
 * sobreponham. A sincronização do catálogo é seguida pela importação gratuita
 * de até 10 transcrições pendentes diretamente do tl;dv.
 */
function SINCRONIZAR_TLDV_AGENDADO() {
  const trava = LockService.getScriptLock();
  if (!trava.tryLock(1000)) {
    registrarLog_('TLDV', 'SINCRONIZACAO_AGENDADA_IGNORADA', 'Outra sincronização já está em andamento.');
    return { sucesso: true, ignorada: true, mensagem: 'Outra sincronização já está em andamento.' };
  }

  try {
    salvarConfiguracao_('TLDV_ULTIMA_EXECUCAO', new Date());
    salvarConfiguracao_('TLDV_ULTIMO_STATUS', 'EXECUTANDO');

    const sincronizacao = sincronizarReunioesTldv();
    const pendentes = (sincronizacao.reunioes || [])
      .filter(item => !item.possuiTranscricao)
      .slice(0, 10)
      .map(item => item.idInteracao);

    let transcricoes = { importadas: 0, ignoradas: 0, erros: [] };
    if (pendentes.length) {
      transcricoes = importarTranscricoesTldv(pendentes);
    }

    const resumo = [
      'Reuniões novas: ' + Number(sincronizacao.novas || 0),
      'atualizadas: ' + Number(sincronizacao.atualizadas || 0),
      'transcrições importadas: ' + Number(transcricoes.importadas || 0),
      'pendências ainda indisponíveis: ' + Number((transcricoes.erros || []).length)
    ].join('; ');

    salvarConfiguracao_('TLDV_ULTIMO_STATUS', 'CONCLUIDA');
    salvarConfiguracao_('TLDV_ULTIMO_RESULTADO', resumo);
    registrarLog_('TLDV', 'SINCRONIZACAO_AGENDADA', resumo + '.');

    return {
      sucesso: true,
      sincronizacao: sincronizacao,
      transcricoes: transcricoes,
      mensagem: resumo
    };
  } catch (erro) {
    salvarConfiguracao_('TLDV_ULTIMO_STATUS', 'ERRO');
    salvarConfiguracao_('TLDV_ULTIMO_RESULTADO', String(erro && erro.message ? erro.message : erro));
    registrarLog_('TLDV', 'ERRO_SINCRONIZACAO_AGENDADA', String(erro && erro.message ? erro.message : erro));
    throw erro;
  } finally {
    trava.releaseLock();
  }
}

function sincronizarReunioesTldv() {
  const apiKey = obterSegredo_('TLDV_API_KEY');
  if (!apiKey) throw new Error('Informe e salve a chave tl;dv em Integrações.');

  const resposta = requisicaoJson_(APP.tldvBaseUrl + '/meetings', {
    method: 'get',
    headers: {
      'x-api-key': apiKey,
      'Accept': 'application/json'
    }
  });

  const reunioes = extrairReunioesTldv_(resposta);
  const interacoesTldv = lerObjetos_(APP.sheets.interacoes).filter(item =>
    String(item.FONTE || '').toUpperCase() === 'TLDV'
  );
  const mapaPorIdExterno = {};
  interacoesTldv.forEach(item => {
    const chave = String(item.ID_EXTERNO || '').trim();
    if (chave && !mapaPorIdExterno[chave]) mapaPorIdExterno[chave] = item;
  });
  let novas = 0;
  let atualizadas = 0;

  reunioes.forEach(reuniao => {
    const idExterno = String(reuniao.id || '').trim();
    if (!idExterno) return;

    const idInteracaoPadrao = 'TLDV_' + idExterno;
    const existente = mapaPorIdExterno[idExterno] || interacoesTldv.find(item =>
      String(item.ID_INTERACAO || '') === idInteracaoPadrao
    );
    const idInteracao = existente ? String(existente.ID_INTERACAO) : idInteracaoPadrao;
    const agora = new Date();
    const organizador = reuniao.organizer || {};

    const objeto = {
      ID_INTERACAO: idInteracao,
      FONTE: 'TLDV',
      ID_EXTERNO: idExterno,
      TIPO_INTERACAO: 'REUNIAO',
      ID_CLIENTE: existente ? existente.ID_CLIENTE : '',
      VENDEDOR: String(organizador.name || organizador.email || ''),
      LEAD: extrairConvidadosTldv_(reuniao),
      TITULO: String(reuniao.name || 'Reunião sem título'),
      DATA_INTERACAO: reuniao.happenedAt ? new Date(reuniao.happenedAt) : '',
      DURACAO_SEGUNDOS: Number(reuniao.duration || 0),
      LINK_ORIGINAL: String(reuniao.url || ''),
      URL_GRAVACAO: existente ? existente.URL_GRAVACAO : '',
      PARTICIPANTES_JSON: JSON.stringify(Array.isArray(reuniao.invitees) ? reuniao.invitees : []),
      STATUS_TRANSCRICAO: existente ? (existente.STATUS_TRANSCRICAO || 'PENDENTE') : 'PENDENTE',
      STATUS_AUDITORIA: existente ? (existente.STATUS_AUDITORIA || 'NAO_AUDITADA') : 'NAO_AUDITADA',
      IMPORTADO_EM: existente ? existente.IMPORTADO_EM : agora,
      ATUALIZADO_EM: agora
    };

    if (existente) {
      atualizarPorCampo_(APP.sheets.interacoes, 'ID_INTERACAO', idInteracao, objeto);
      atualizadas++;
    } else {
      adicionarObjeto_(APP.sheets.interacoes, objeto);
      mapaPorIdExterno[idExterno] = objeto;
      interacoesTldv.push(objeto);
      novas++;
    }
  });

  limparCachesDados_();
  registrarLog_('TLDV', 'SINCRONIZAR_REUNIOES', 'Novas: ' + novas + '. Atualizadas: ' + atualizadas + '.');

  return {
    sucesso: true,
    mensagem: reunioes.length + ' reunião(ões) recebida(s) do tl;dv.',
    novas: novas,
    atualizadas: atualizadas,
    reunioes: listarReunioes_()
  };
}

function importarTranscricoesTldv(idsInteracoes) {
  const apiKey = obterSegredo_('TLDV_API_KEY');
  if (!apiKey) throw new Error('Informe e salve a chave tl;dv em Integrações.');

  const ids = Array.isArray(idsInteracoes) ? idsInteracoes.filter(Boolean).slice(0, 10) : [];
  if (!ids.length) throw new Error('Selecione ao menos uma reunião.');

  const retorno = {
    sucesso: true,
    importadas: 0,
    ignoradas: 0,
    erros: []
  };

  ids.forEach(idInteracao => {
    const interacao = localizarObjeto_(APP.sheets.interacoes, 'ID_INTERACAO', idInteracao);
    if (!interacao || interacao.FONTE !== 'TLDV') {
      retorno.erros.push(idInteracao + ': reunião não encontrada.');
      return;
    }

    const existente = localizarObjeto_(APP.sheets.transcricoes, 'ID_INTERACAO', idInteracao);
    if (existente && existente.CONTEUDO && existente.STATUS === 'CONCLUIDA') {
      retorno.ignoradas++;
      return;
    }

    try {
      const resposta = requisicaoJson_(
        APP.tldvBaseUrl + '/meetings/' + encodeURIComponent(interacao.ID_EXTERNO) + '/transcript',
        {
          method: 'get',
          headers: {
            'x-api-key': apiKey,
            'Accept': 'application/json'
          }
        }
      );

      const conteudo = formatarTranscricaoTldv_(resposta);
      if (!conteudo) throw new Error('A API retornou uma transcrição vazia.');

      const agora = new Date();
      const objeto = {
        ID_TRANSCRICAO: existente ? existente.ID_TRANSCRICAO : gerarId_('TRA'),
        ID_INTERACAO: idInteracao,
        FONTE: 'TLDV',
        IDIOMA: '',
        CONTEUDO: conteudo,
        TAMANHO_CARACTERES: conteudo.length,
        STATUS: 'CONCLUIDA',
        ERRO: '',
        IMPORTADO_EM: existente ? existente.IMPORTADO_EM : agora,
        ATUALIZADO_EM: agora
      };

      if (existente) {
        atualizarPorCampo_(APP.sheets.transcricoes, 'ID_INTERACAO', idInteracao, objeto);
      } else {
        adicionarObjeto_(APP.sheets.transcricoes, objeto);
      }

      atualizarPorCampo_(APP.sheets.interacoes, 'ID_INTERACAO', idInteracao, {
        STATUS_TRANSCRICAO: 'CONCLUIDA',
        ATUALIZADO_EM: agora
      });

      retorno.importadas++;
    } catch (erro) {
      const agora = new Date();
      if (existente) {
        atualizarPorCampo_(APP.sheets.transcricoes, 'ID_INTERACAO', idInteracao, {
          STATUS: 'ERRO',
          ERRO: erro.message,
          ATUALIZADO_EM: agora
        });
      } else {
        adicionarObjeto_(APP.sheets.transcricoes, {
          ID_TRANSCRICAO: gerarId_('TRA'),
          ID_INTERACAO: idInteracao,
          FONTE: 'TLDV',
          IDIOMA: '',
          CONTEUDO: '',
          TAMANHO_CARACTERES: 0,
          STATUS: 'ERRO',
          ERRO: erro.message,
          IMPORTADO_EM: agora,
          ATUALIZADO_EM: agora
        });
      }

      atualizarPorCampo_(APP.sheets.interacoes, 'ID_INTERACAO', idInteracao, {
        STATUS_TRANSCRICAO: 'ERRO',
        ATUALIZADO_EM: agora
      });
      retorno.erros.push((interacao.TITULO || idInteracao) + ': ' + erro.message);
    }
  });

  limparCachesDados_();
  retorno.mensagem = 'Transcrições importadas: ' + retorno.importadas + '. Ignoradas: ' + retorno.ignoradas + '. Erros: ' + retorno.erros.length + '.';
  retorno.reunioes = listarReunioes_();
  registrarLog_('TLDV', 'IMPORTAR_TRANSCRICOES', retorno.mensagem);
  return retorno;
}

function extrairReunioesTldv_(resposta) {
  if (Array.isArray(resposta)) return resposta;
  if (!resposta || typeof resposta !== 'object') return [];
  if (Array.isArray(resposta.results)) return resposta.results;
  if (Array.isArray(resposta.data)) return resposta.data;
  if (Array.isArray(resposta.meetings)) return resposta.meetings;
  return [];
}

function extrairConvidadosTldv_(reuniao) {
  const convidados = Array.isArray(reuniao.invitees) ? reuniao.invitees : [];
  return convidados.map(item => item.name || item.email || '').filter(Boolean).join(', ');
}

function formatarTranscricaoTldv_(resposta) {
  const segmentos = resposta && Array.isArray(resposta.data) ? resposta.data : [];
  return segmentos.map(segmento => {
    const speaker = String(segmento.speaker || 'Participante').trim();
    const texto = String(segmento.text || '').trim();
    if (!texto) return '';
    return speaker + ': ' + texto;
  }).filter(Boolean).join('\n');
}

/* =========================================================
   PITCHES VERSIONADOS E AUDITORIAS
========================================================= */

function listarPitches(itensInformados) {
  if (!Array.isArray(itensInformados)) garantirEstruturaPitches_();
  const itens = Array.isArray(itensInformados)
    ? itensInformados
    : lerObjetos_(APP.sheets.pitches);
  return itens.filter(item => item.ID_PITCH).map(item => ({
    idPitch: item.ID_PITCH,
    idCliente: item.ID_CLIENTE,
    tipoPitch: item.TIPO_PITCH || 'SDR',
    nomeVersao: item.NOME_VERSAO || '',
    numeroVersao: item.NUMERO_VERSAO || '',
    conteudoPitch: item.CONTEUDO_PITCH || '',
    urlDocumento: item.URL_DOCUMENTO || '',
    dataVigenciaInicio: serializarData_(item.DATA_VIGENCIA_INICIO),
    dataVigenciaFim: serializarData_(item.DATA_VIGENCIA_FIM),
    pitchAtual: normalizarBooleano_(item.PITCH_ATUAL),
    status: item.STATUS || 'ATIVO'
  })).sort((a,b) => String(b.numeroVersao).localeCompare(String(a.numeroVersao), undefined, {numeric:true}));
}

function salvarPitch(dados) {
  dados = dados || {};
  garantirEstruturaPitches_();
  const idCliente = String(dados.idCliente || '').trim();
  const tipo = String(dados.tipoPitch || '').toUpperCase();
  const nome = String(dados.nomeVersao || '').trim();
  const conteudo = String(dados.conteudoPitch || '').trim();
  const urlDocumento = String(dados.urlDocumento || '').trim();
  if (!idCliente) throw new Error('Selecione o cliente.');
  if (!['SDR','CLOSER','PLANO'].includes(tipo)) throw new Error('O tipo deve ser SDR, CLOSER ou PLANO.');
  if (!nome) throw new Error('Informe o nome da versão.');
  if (!conteudo) throw new Error('Informe o conteúdo do pitch.');
  if (urlDocumento && !/^https:\/\//i.test(urlDocumento)) throw new Error('Informe um link HTTPS válido para o documento do pitch.');

  const id = String(dados.idPitch || gerarId_('PIT'));
  const existente = localizarObjeto_(APP.sheets.pitches, 'ID_PITCH', id);
  const atual = Boolean(dados.pitchAtual);
  const agora = new Date();
  const dataHoje = Utilities.formatDate(agora, APP.timezone, 'yyyy-MM-dd');
  const fimVersaoAnterior = Utilities.formatDate(
    new Date(agora.getFullYear(), agora.getMonth(), agora.getDate() - 1),
    APP.timezone,
    'yyyy-MM-dd'
  );
  const pitchesExistentes = lerObjetos_(APP.sheets.pitches);
  const duplicado = localizarDuplicidadePitch_(
    pitchesExistentes, idCliente, tipo, nome, conteudo, existente ? id : ''
  );

  if (duplicado) {
    throw new Error(
      'Já existe um pitch ' + tipo + ' com o nome de versão "' +
      duplicado.NOME_VERSAO + '" ou com o mesmo conteúdo para este cliente.'
    );
  }

  if (atual) {
    lerObjetos_(APP.sheets.pitches).filter(p => p.ID_CLIENTE === idCliente && p.TIPO_PITCH === tipo && p.ID_PITCH !== id)
      .forEach(p => atualizarPorCampo_(APP.sheets.pitches, 'ID_PITCH', p.ID_PITCH, {
        PITCH_ATUAL: 'NAO',
        DATA_VIGENCIA_FIM: p.DATA_VIGENCIA_FIM || fimVersaoAnterior,
        ATUALIZADO_EM: agora
      }));
  }

  const objeto = {
    ID_PITCH:id, ID_CLIENTE:idCliente, TIPO_PITCH:tipo, NOME_VERSAO:nome,
    NUMERO_VERSAO:String(dados.numeroVersao || ''), CONTEUDO_PITCH:conteudo,
    DATA_VIGENCIA_INICIO:dados.dataVigenciaInicio || (existente ? existente.DATA_VIGENCIA_INICIO : dataHoje), DATA_VIGENCIA_FIM:dados.dataVigenciaFim || '',
    PITCH_ATUAL:atual ? 'SIM' : 'NAO', STATUS:String(dados.status || 'ATIVO'), URL_DOCUMENTO:urlDocumento,
    CRIADO_EM:existente ? existente.CRIADO_EM : agora, ATUALIZADO_EM:agora
  };
  if (existente) atualizarPorCampo_(APP.sheets.pitches,'ID_PITCH',id,objeto); else adicionarObjeto_(APP.sheets.pitches,objeto);
  limparCachesDados_();
  return {sucesso:true,mensagem:'Versão do pitch salva.',pitches:listarPitches()};
}

function garantirEstruturaPitches_() {
  const cache = CacheService.getScriptCache();
  const chaveCache = 'SCHEMA_PITCHES_4_5_0';
  if (cache.get(chaveCache) === 'OK') return;

  const aba = abrirPlanilha_().getSheetByName(APP.sheets.pitches);
  if (!aba) {
    criarAbasAusentes_();
    cache.put(chaveCache, 'OK', 21600);
    return;
  }

  const existentes = aba.getRange(1, 1, 1, Math.max(aba.getLastColumn(), 1)).getDisplayValues()[0].map(String);
  const oficiais = obterCabecalhosOficiais_()[APP.sheets.pitches];
  const ausentes = oficiais.filter(campo => !existentes.includes(campo));
  if (ausentes.length) {
    const inicio = existentes.length + 1;
    if (aba.getMaxColumns() < existentes.length + ausentes.length) {
      aba.insertColumnsAfter(aba.getMaxColumns(), existentes.length + ausentes.length - aba.getMaxColumns());
    }
    aba.getRange(1, inicio, 1, ausentes.length).setValues([ausentes]);
  }
  cache.put(chaveCache, 'OK', 21600);
}

function salvarConfiguracaoAuditoria(dados) {
  dados=dados||{};
  salvarConfiguracao_('PROMPT_AUDITORIA_SDR', String(dados.promptSdr||''));
  salvarConfiguracao_('PROMPT_AUDITORIA_CLOSER', String(dados.promptCloser||''));
  salvarConfiguracao_('PASTA_AUDITORIAS_DRIVE_ID', String(dados.pastaDriveId||''));
  return {sucesso:true,mensagem:'Configurações de auditoria salvas.'};
}

function listarInteracoesComTranscricao_(clientesInformados) {
  const trans = lerObjetos_(APP.sheets.transcricoes);
  const clientes = Array.isArray(clientesInformados)
    ? clientesInformados
    : lerObjetos_(APP.sheets.clientes);
  const nomesClientes = {};
  clientes.forEach(cliente => {
    const id = cliente.idCliente || cliente.ID_CLIENTE || '';
    nomesClientes[String(id)] = cliente.nomeCliente || cliente.NOME_CLIENTE || '';
  });
  const mapa={}; trans.forEach(t=>{ if(t.ID_INTERACAO && t.STATUS==='CONCLUIDA') mapa[t.ID_INTERACAO]=t; });
  return lerObjetos_(APP.sheets.interacoes).filter(i=>mapa[i.ID_INTERACAO]).map(i=>({
    idInteracao:i.ID_INTERACAO, idTranscricao:mapa[i.ID_INTERACAO].ID_TRANSCRICAO,
    fonte:i.FONTE, tipoInteracao:i.TIPO_INTERACAO, idCliente:i.ID_CLIENTE||'',
    clienteVinculado: nomesClientes[String(i.ID_CLIENTE || '')] || '', funcao:i.FUNCAO||'',
    vendedor:i.VENDEDOR||'', lead:i.LEAD||'', titulo:i.TITULO||'',
    oportunidade:i.OPORTUNIDADE||'', empresaArquivo:i.EMPRESA_ARQUIVO||'',
    dataInteracao:serializarData_(i.DATA_INTERACAO),
    linkOriginal:i.LINK_ORIGINAL||'', urlGravacao:i.URL_GRAVACAO||''
  }));
}

function listarAuditorias_() {
  return lerObjetos_(APP.sheets.auditorias).filter(a=>a.ID_AUDITORIA).map(a=>({
    idAuditoria:a.ID_AUDITORIA,idCliente:a.ID_CLIENTE,idInteracao:a.ID_INTERACAO,idPitch:a.ID_PITCH,
    tipoAuditoria:a.TIPO_AUDITORIA,status:a.STATUS,score:a.SCORE,semaforo:a.SEMAFORO,
    resultadoCompleto:a.RESULTADO_COMPLETO||'',linkDocumento:a.LINK_DOCUMENTO||'',concluidoEm:serializarData_(a.CONCLUIDO_EM),erro:a.ERRO||''
  })).reverse();
}

function executarAuditoria(dados) {
  dados=dados||{};
  const cliente=localizarObjeto_(APP.sheets.clientes,'ID_CLIENTE',String(dados.idCliente||''));
  const pitch=localizarObjeto_(APP.sheets.pitches,'ID_PITCH',String(dados.idPitch||''));
  const interacao=localizarObjeto_(APP.sheets.interacoes,'ID_INTERACAO',String(dados.idInteracao||''));
  const transcricao=localizarObjeto_(APP.sheets.transcricoes,'ID_INTERACAO',String(dados.idInteracao||''));
  const tipo=String(dados.tipoAuditoria||'').toUpperCase();
  if(!cliente||!pitch||!interacao||!transcricao) throw new Error('Cliente, pitch ou transcrição não encontrados.');
  if(String(cliente.STATUS || 'ATIVO').toUpperCase() !== 'ATIVO') throw new Error('O cliente selecionado está inativo.');
  if(String(pitch.STATUS || 'ATIVO').toUpperCase() !== 'ATIVO') throw new Error('O pitch selecionado está inativo.');
  if(String(pitch.ID_CLIENTE) !== String(cliente.ID_CLIENTE) || String(pitch.TIPO_PITCH).toUpperCase() !== tipo) {
    throw new Error('O pitch selecionado não corresponde ao cliente e ao tipo da auditoria.');
  }
  if(String(transcricao.STATUS || '').toUpperCase() !== 'CONCLUIDA') {
    throw new Error('A transcrição selecionada ainda não está concluída.');
  }
  const fonteSolicitada = String(dados.fonte || '').toUpperCase();
  if (fonteSolicitada && String(interacao.FONTE || '').toUpperCase() !== fonteSolicitada) {
    throw new Error('A origem da interação não corresponde à origem selecionada.');
  }
  const promptBase=obterConfiguracao_('PROMPT_AUDITORIA_'+tipo);
  if(!promptBase) throw new Error('Cadastre o prompt padrão de '+tipo+'.');
  const chave=obterSegredo_('GEMINI_API_KEY'); if(!chave) throw new Error('Configure a chave Gemini.');
  const id=gerarId_('AUD'); const agora=new Date();
  adicionarObjeto_(APP.sheets.auditorias,{ID_AUDITORIA:id,ID_INTERACAO:interacao.ID_INTERACAO,ID_TRANSCRICAO:transcricao.ID_TRANSCRICAO,ID_CLIENTE:cliente.ID_CLIENTE,ID_PITCH:pitch.ID_PITCH,TIPO_AUDITORIA:tipo,NOME_PITCH_SNAPSHOT:pitch.NOME_VERSAO,VERSAO_PITCH_SNAPSHOT:pitch.NUMERO_VERSAO,CONTEUDO_PITCH_SNAPSHOT:pitch.CONTEUDO_PITCH,PROMPT_SNAPSHOT:promptBase,STATUS:'PROCESSANDO',RESULTADO_COMPLETO:'',SCORE:'',SEMAFORO:'',ID_DOCUMENTO:'',LINK_DOCUMENTO:'',ERRO:'',SOLICITADO_EM:agora,CONCLUIDO_EM:''});
  try {
    const prompt = promptBase+'\n\nREGRAS DO CLIENTE:\n'+String(cliente.REGRAS_CLIENTE||'')+'\n\nPITCH OFICIAL SELECIONADO:\n'+String(pitch.CONTEUDO_PITCH||'')+'\n\nTRANSCRIÇÃO A SER ANALISADA:\n'+String(transcricao.CONTEUDO||'')+'\n\nRetorne somente o relatório final estruturado.';
    const modelo=obterConfiguracao_('GEMINI_MODEL')||'gemini-2.5-flash-lite';
    const url='https://generativelanguage.googleapis.com/v1beta/models/'+encodeURIComponent(modelo)+':generateContent?key='+encodeURIComponent(chave);
    const resposta=requisicaoJson_(url,{method:'post',contentType:'application/json',payload:JSON.stringify({contents:[{parts:[{text:prompt}]}],generationConfig:{temperature:0.2}})});
    const resultado=((((resposta||{}).candidates||[])[0]||{}).content||{}).parts;
    const texto=Array.isArray(resultado)?resultado.map(p=>p.text||'').join('\n').trim():'';
    if(!texto) throw new Error('A IA não retornou conteúdo.');
    const doc=criarDocumentoAuditoria_(cliente,interacao,pitch,tipo,texto);
    atualizarPorCampo_(APP.sheets.auditorias,'ID_AUDITORIA',id,{STATUS:'CONCLUIDA',RESULTADO_COMPLETO:texto,ID_DOCUMENTO:doc.id,LINK_DOCUMENTO:doc.url,CONCLUIDO_EM:new Date(),ERRO:''});
    atualizarPorCampo_(APP.sheets.interacoes,'ID_INTERACAO',interacao.ID_INTERACAO,{STATUS_AUDITORIA:'CONCLUIDA',ATUALIZADO_EM:new Date()});
    limparCachesDados_();
    return {sucesso:true,mensagem:'Auditoria concluída e documento criado.',auditoria:localizarObjeto_(APP.sheets.auditorias,'ID_AUDITORIA',id),auditorias:listarAuditorias_()};
  } catch(e) {
    atualizarPorCampo_(APP.sheets.auditorias,'ID_AUDITORIA',id,{STATUS:'ERRO',ERRO:e.message,CONCLUIDO_EM:new Date()});
    throw e;
  }
}

function criarDocumentoAuditoria_(cliente,interacao,pitch,tipo,resultado) {
  const nome='AUDITORIA - '+cliente.NOME_CLIENTE+' - '+tipo+' - '+(interacao.TITULO||interacao.ID_INTERACAO);
  const doc=DocumentApp.create(nome); const body=doc.getBody();
  body.appendParagraph(nome).setHeading(DocumentApp.ParagraphHeading.HEADING1);
  body.appendParagraph('Cliente: '+cliente.NOME_CLIENTE);
  body.appendParagraph('Pitch: '+pitch.NOME_VERSAO+' | Versão: '+pitch.NUMERO_VERSAO);
  body.appendParagraph('Interação: '+(interacao.TITULO||''));
  body.appendHorizontalRule();
  resultado.split('\n').forEach(l=>body.appendParagraph(l));
  doc.saveAndClose();
  const pastaId=obterConfiguracao_('PASTA_AUDITORIAS_DRIVE_ID');
  if(pastaId){ const arq=DriveApp.getFileById(doc.getId()); DriveApp.getFolderById(pastaId).addFile(arq); DriveApp.getRootFolder().removeFile(arq); }
  return {id:doc.getId(),url:doc.getUrl()};
}

/* =========================================================
   UTILITÁRIOS
========================================================= */

function requisicaoJson_(url, opcoes) {
  const resposta = UrlFetchApp.fetch(
    url,
    Object.assign({ muteHttpExceptions: true }, opcoes || {})
  );

  const status = resposta.getResponseCode();
  const texto = resposta.getContentText();

  let json = {};
  if (texto) {
    try {
      json = JSON.parse(texto);
    } catch (erro) {
      if (status >= 200 && status < 300) return { texto: texto };
      throw new Error('HTTP ' + status + ': ' + texto.slice(0, 700));
    }
  }

  if (status < 200 || status >= 300) {
    const mensagem =
      json.error?.message ||
      json.message ||
      JSON.stringify(json).slice(0, 700) ||
      texto.slice(0, 700);

    throw new Error('HTTP ' + status + ': ' + mensagem);
  }

  return json;
}

function lerObjetosSeExistir_(nomeAba) {
  const aba = abrirPlanilha_().getSheetByName(nomeAba);
  if (!aba || aba.getLastRow() < 2 || aba.getLastColumn() < 1) return [];

  const valores = aba.getDataRange().getValues();
  const cabecalhos = valores[0];

  return valores.slice(1)
    .filter(linha => linha.some(valor => valor !== ''))
    .map(linha => {
      const objeto = {};
      cabecalhos.forEach((cabecalho, indice) => {
        if (cabecalho) objeto[cabecalho] = linha[indice];
      });
      return objeto;
    });
}

function lerObjetos_(nomeAba) {
  const aba = abrirPlanilha_().getSheetByName(nomeAba);
  if (!aba) return [];

  const valores = aba.getDataRange().getValues();
  if (valores.length < 2) return [];

  const cabecalhos = valores[0];

  return valores
    .slice(1)
    .filter(linha => linha.some(valor => valor !== ''))
    .map(linha => {
      const objeto = {};
      cabecalhos.forEach((cabecalho, indice) => {
        objeto[cabecalho] = linha[indice];
      });
      return objeto;
    });
}

function adicionarObjeto_(nomeAba, objeto) {
  const aba = abrirPlanilha_().getSheetByName(nomeAba);
  if (!aba) throw new Error('Aba não encontrada: ' + nomeAba);
  const cabecalhos = aba
    .getRange(1, 1, 1, aba.getLastColumn())
    .getValues()[0];

  const camposDesconhecidos = Object.keys(objeto || {}).filter(campo => !cabecalhos.includes(campo));
  if (camposDesconhecidos.length) {
    throw new Error('Campos fora do schema de ' + nomeAba + ': ' + camposDesconhecidos.join(', '));
  }

  const chaves = {};
  chaves[APP.sheets.clientes] = 'ID_CLIENTE';
  chaves[APP.sheets.materiaisClientes] = 'ID_MATERIAL';
  chaves[APP.sheets.metasClientes] = 'ID_META';
  chaves[APP.sheets.integracoesClientes] = 'ID_INTEGRACAO';
  chaves[APP.sheets.pitches] = 'ID_PITCH';
  chaves[APP.sheets.modelosAuditoria] = 'ID_MODELO';
  chaves[APP.sheets.interacoes] = 'ID_INTERACAO';
  chaves[APP.sheets.transcricoes] = 'ID_TRANSCRICAO';
  chaves[APP.sheets.auditorias] = 'ID_AUDITORIA';
  chaves[APP.sheets.formalizacoes] = 'ID_FORMALIZACAO';
  chaves[APP.sheets.identificadoresClientes] = 'ID_IDENTIFICADOR';
  chaves[APP.sheets.reunioesCalendario] = 'ID_REUNIAO';
  chaves[APP.sheets.regrasEntregas] = 'ID_REGRA';
  chaves[APP.sheets.entregasMensais] = 'ID_ENTREGA';
  chaves[APP.sheets.diarioClientes] = 'ID_REGISTRO';
  chaves[APP.sheets.otimizacoesClientes] = 'ID_OTIMIZACAO';
  chaves[APP.sheets.equipeClientes] = 'ID_MEMBRO';
  const chave = chaves[nomeAba];
  if (chave && String(objeto[chave] || '').trim()) {
    const duplicado = localizarObjeto_(nomeAba, chave, objeto[chave]);
    if (duplicado) throw new Error('Chave primária duplicada em ' + nomeAba + ': ' + objeto[chave]);
  }

  aba.appendRow(
    cabecalhos.map(cabecalho =>
      objeto[cabecalho] !== undefined
        ? objeto[cabecalho]
        : ''
    )
  );
}

function atualizarPorCampo_(nomeAba, campo, valor, alteracoes) {
  const aba = abrirPlanilha_().getSheetByName(nomeAba);
  if (!aba) throw new Error('Aba não encontrada: ' + nomeAba);
  const dados = aba.getDataRange().getValues();
  const cabecalhos = dados[0];
  const indiceCampo = cabecalhos.indexOf(campo);

  if (indiceCampo < 0) {
    throw new Error('Campo não encontrado: ' + campo);
  }

  const camposDesconhecidos = Object.keys(alteracoes || {}).filter(item => !cabecalhos.includes(item));
  if (camposDesconhecidos.length) {
    throw new Error('Campos fora do schema de ' + nomeAba + ': ' + camposDesconhecidos.join(', '));
  }

  for (let i = 1; i < dados.length; i++) {
    if (String(dados[i][indiceCampo]) === String(valor)) {
      const novaLinha = cabecalhos.map((cabecalho, indice) =>
        alteracoes[cabecalho] !== undefined
          ? alteracoes[cabecalho]
          : dados[i][indice]
      );

      aba.getRange(i + 1, 1, 1, novaLinha.length)
        .setValues([novaLinha]);

      return true;
    }
  }

  return false;
}

function localizarObjeto_(nomeAba, campo, valor) {
  return (
    lerObjetos_(nomeAba).find(
      item => String(item[campo]) === String(valor)
    ) || null
  );
}

function obterConfiguracao_(chave) {
  const item = localizarObjeto_(
    APP.sheets.configuracoes,
    'CHAVE',
    chave
  );

  return item ? item.VALOR : '';
}

function salvarConfiguracao_(chave, valor) {
  const existente = localizarObjeto_(
    APP.sheets.configuracoes,
    'CHAVE',
    chave
  );

  const objeto = {
    CHAVE: chave,
    VALOR: valor,
    ATUALIZADO_EM: new Date()
  };

  if (existente) {
    atualizarPorCampo_(
      APP.sheets.configuracoes,
      'CHAVE',
      chave,
      objeto
    );
  } else {
    adicionarObjeto_(APP.sheets.configuracoes, objeto);
  }
}

function salvarConfiguracaoSeVazia_(chave, valor) {
  if (obterConfiguracao_(chave) === '') {
    salvarConfiguracao_(chave, valor);
  }
}

function salvarSegredo_(chave, valor) {
  PropertiesService
    .getScriptProperties()
    .setProperty(chave, valor);
}

function salvarSegredoSeInformado_(chave, valor) {
  const texto = String(valor || '').trim();
  if (texto) salvarSegredo_(chave, texto);
}

function obterSegredo_(chave) {
  return (
    PropertiesService
      .getScriptProperties()
      .getProperty(chave) || ''
  );
}

function registrarLog_(modulo, acao, detalhe) {
  try {
    adicionarObjeto_(APP.sheets.logs, {
      DATA_HORA: new Date(),
      MODULO: modulo,
      ACAO: acao,
      DETALHE: detalhe
    });
  } catch (erro) {
    console.error(erro);
  }
}

function gerarId_(prefixo) {
  return (
    prefixo +
    '-' +
    Utilities.formatDate(new Date(), APP.timezone, 'yyyyMMddHHmmss') +
    '-' +
    Utilities.getUuid().slice(0, 8).toUpperCase()
  );
}

function serializarData_(valor) {
  if (!valor) return '';

  const data = valor instanceof Date ? valor : new Date(valor);
  if (isNaN(data.getTime())) return String(valor);

  return Utilities.formatDate(
    data,
    APP.timezone,
    "yyyy-MM-dd'T'HH:mm:ss"
  );
}

function serializarDataSomenteDia_(valor) {
  if (!valor) return '';

  if (
    typeof valor === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(valor)
  ) {
    return valor;
  }

  const data = valor instanceof Date ? valor : new Date(valor);
  if (isNaN(data.getTime())) return String(valor).slice(0, 10);

  return Utilities.formatDate(data, APP.timezone, 'yyyy-MM-dd');
}

function normalizarBooleano_(valor) {
  const texto = String(valor || '').toUpperCase();
  return valor === true || texto === 'SIM' || texto === 'TRUE';
}

function validarDataIso_(valor) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(valor || ''))) {
    throw new Error('Data inválida. Use YYYY-MM-DD.');
  }
}

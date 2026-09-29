import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('./RdAuditorias.gs', import.meta.url), 'utf8');
const context = vm.createContext({ console });
vm.runInContext(source + '\nthis.formatSdr = audRdTextoSdr_;', context);

const ctx = {
  a: {
    SCORE: 3.8,
    SCORE_PERCENTUAL: 76,
    LINK_DOCUMENTO: 'https://docs.google.com/open?id=auditoria-teste'
  },
  i: {
    TITULO: 'Sanisul Metais',
    COLABORADOR: 'SDR TECNOSOFT',
    URL_GRAVACAO: 'https://listener.example/audio.mp3'
  },
  sdr: { nome: 'SDR TECNOSOFT' },
  r: {
    pontuacao_calculada: { score_5: 3.8, score_percentual: 76 },
    criterios_avaliados: [
      { nome: 'Aderência ao Script de Pitch', pontuacao: 2.5, status: 'DESVIO_EXECUCAO', aplicavel: true },
      { nome: 'Análise de Conversação', pontuacao: 5, status: 'CONFORME', aplicavel: true },
      { nome: 'Qualidade das Perguntas', pontuacao: 5, status: 'CONFORME', aplicavel: true },
      { nome: 'Conclusão e Agendamento', pontuacao: 2.5, status: 'DESVIO_EXECUCAO', aplicavel: true }
    ],
    contexto_interacao: {
      classificacao: 'PRIMEIRO_CONTATO',
      objetivo_principal: 'Qualificar o lead, verificar o LMV e definir o próximo passo correto.',
      etapas_aplicaveis: [
        'Introdução',
        'Primeira Frase de Qualificação',
        'Pergunta de Segmento',
        'Validação de LMV',
        'Manejo de Objeções',
        'Valorização da Reunião',
        'Dupla Escolha de Horários',
        'Encerramento Profissional',
        'Introdução'
      ]
    },
    resumo_contato: {
      resumo_conversa: 'Contato inbound para qualificação e definição de continuidade.',
      motivacao_contato: 'Solicitação de demonstração do sistema pelo site.',
      necessidade_principal: 'Sistema de gestão compatível com o porte da distribuidora.',
      resultado_contato: 'Lead desqualificado por incompatibilidade de faixa de preço e orçamento.'
    },
    etapas_pitch: [
      {
        etapa: 'Primeira Frase de Qualificação',
        status: 'CONFORME',
        fato_transcricao: 'Você preencheu aqui que o seu faturamento é de 20 a 50 mil, certo?'
      },
      {
        etapa: 'Pergunta de Segmento',
        status: 'CONFORME',
        fato_transcricao: 'Qual é o segmento da sua distribuidora?'
      },
      {
        etapa: 'Introdução',
        status: 'DESVIO_EXECUCAO',
        desvio: 'O SDR não pediu três minutos antes de iniciar a qualificação.',
        fato_transcricao: 'Eu sou o Luiz aqui da Tecnosoft e vi que você solicitou uma demonstração.',
        regra_pitch: 'Oi [lead], aqui é o [SDR]. Sei que deve estar corrido, mas preciso de três minutos para fazer algumas perguntas.',
        correcao_pratica: 'Apresente-se e confirme se o lead dispõe de três minutos antes das perguntas.'
      },
      {
        etapa: 'Introdução',
        status: 'DESVIO_EXECUCAO',
        desvio: 'Item duplicado que não deve aparecer.'
      },
      {
        etapa: 'Valorização da Reunião',
        status: 'NAO_EXECUTADA',
        desvio: 'A reunião com o especialista não foi valorizada antes do encerramento.',
        fato_transcricao: 'Não evidenciado na fala do SDR.',
        regra_pitch: 'Explique que o especialista fará um diagnóstico gratuito da operação.',
        correcao_pratica: 'Explique em uma frase o valor do diagnóstico antes de propor agenda.'
      }
    ],
    perguntas_qualificacao: {
      corretas: [
        { pergunta: 'Sua empresa é de qual segmento?', resposta_lead: 'Distribuidora de material hidráulico.' },
        { pergunta: 'Sua empresa é de qual segmento?', resposta_lead: 'Resposta duplicada.' },
        { pergunta: 'Quantos funcionários você tem?', resposta_lead: 'Uma pessoa trabalha comigo.' }
      ],
      com_desvio: [],
      ausentes: []
    },
    proximos_passos: [
      {
        acao: 'Simular três ligações aplicando a introdução completa.',
        criterio_conclusao: 'Três simulações sem omitir o pedido de tempo.'
      }
    ]
  }
};

const preview = context.formatSdr(ctx);

assert.equal((preview.match(/AUDITORIA SDR —/g) || []).length, 1, 'O relatório foi duplicado por inteiro.');
assert.equal((preview.match(/^- Introdução$/gm) || []).length, 1, 'Etapa aplicável duplicada não foi removida.');
assert.equal((preview.match(/Sua empresa é de qual segmento\?/g) || []).length, 1, 'Pergunta duplicada não foi removida.');
assert.match(preview, /Etapas avaliadas:\n- Introdução\n- Primeira Frase de Qualificação\n- Pergunta de Segmento\n- Validação de LMV\n- Manejo de Objeções\n- Valorização da Reunião\n- Dupla Escolha de Horários\n- Encerramento Profissional/);
assert.doesNotMatch(preview, /Aplicável nesta ligação:.*…/);
assert.doesNotMatch(preview, /\| Pitch:|SE EU FOSSE O SDR|DESVIOS EM RELAÇÃO AO PITCH\/PROCESSO/);
assert.match(preview, /Aderência ao Script de Pitch: 2\.5\/5/);
assert.match(preview, /Média dos critérios aplicáveis: 3\.75\/5/);
assert.match(preview, /Evidência: "Eu sou o Luiz aqui da Tecnosoft/);
assert.match(preview, /Próxima ação: Apresente-se e confirme/);
assert.match(preview, /PLANO DE AÇÃO/);
assert.match(preview, /Gravação: https:\/\/listener\.example\/audio\.mp3/);
assert.match(preview, /Auditoria completa: https:\/\/docs\.google\.com\/open\?id=auditoria-teste/);
assert.ok(preview.length < 4000, 'Preview SDR voltou a ficar excessivamente longo para o CRM.');

console.log(preview);
console.log('\nPreview SDR compacto validado sem publicação no CRM.');

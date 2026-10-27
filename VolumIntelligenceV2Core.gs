/**
 * VOLUM Intelligence V2 — contrato central de dados.
 *
 * Este arquivo não acessa CRM nem conversa privada. Ele normaliza registros
 * autorizados do CRM para que os agentes analisem fatos, etapas e evidências.
 */

var VOLUM_V2_STATUS = Object.freeze({
  CUMPRIDO: 'CUMPRIDO',
  PARCIAL: 'PARCIAL',
  NAO_CUMPRIDO: 'NAO_CUMPRIDO',
  NAO_VERIFICAVEL: 'NAO_VERIFICAVEL',
  NAO_APLICAVEL: 'NAO_APLICAVEL',
  CONTRADITORIO: 'CONTRADITORIO'
});

var VOLUM_V2_EVIDENCIA = Object.freeze({
  COMPROVADO: 'COMPROVADO',
  INDICIO: 'INDICIO',
  NAO_COMPROVADO: 'NAO_COMPROVADO',
  AUSENTE: 'AUSENTE',
  CONTRADITORIO: 'CONTRADITORIO'
});

var VOLUM_V2_FASES = Object.freeze({
  LEAD: 'LEAD',
  CADENCIA: 'CADENCIA',
  CONEXAO: 'CONEXAO',
  AGENDA: 'AGENDA',
  REUNIAO: 'REUNIAO'
});

function volumV2Texto_(value) {
  return String(value == null ? '' : value).replace(/\\s+/g, ' ').trim();
}

function volumV2Id_(value) {
  return volumV2Texto_(value).toLowerCase();
}

function volumV2Array_(value) {
  return Array.isArray(value) ? value : [];
}

function volumV2Iso_(value) {
  if (!value) return '';
  var date = value instanceof Date ? value : new Date(value);
  return isNaN(date.getTime()) ? volumV2Texto_(value) : date.toISOString();
}

function VOLUM_V2_NORMALIZAR_CONFIG_(input) {
  var source = input || {};
  var pipelines = volumV2Array_(source.pipelines).map(function (pipeline) {
    return {
      id: volumV2Id_(pipeline.id || pipeline.pipelineId),
      name: volumV2Texto_(pipeline.name || pipeline.nome),
      active: pipeline.active !== false,
      stages: volumV2Array_(pipeline.stages || pipeline.etapas).map(function (stage, index) {
        return {
          id: volumV2Id_(stage.id || stage.stageId),
          name: volumV2Texto_(stage.name || stage.nome),
          order: Number(stage.order || stage.ordem || index + 1),
          volumPhase: volumV2Texto_(stage.volumPhase || stage.faseVOLUM || stage.phase).toUpperCase(),
          expectedRole: volumV2Texto_(stage.expectedRole || stage.papelEsperado).toUpperCase()
        };
      }).sort(function (a, b) { return a.order - b.order; })
    };
  });
  var users = volumV2Array_(source.users || source.usuarios).map(function (user) {
    return {
      id: volumV2Id_(user.id || user.userId),
      name: volumV2Texto_(user.name || user.nome),
      email: volumV2Texto_(user.email).toLowerCase(),
      role: volumV2Texto_(user.role || user.papel).toUpperCase(),
      team: volumV2Texto_(user.team || user.equipe),
      active: user.active !== false
    };
  });
  return {
    tenantId: volumV2Id_(source.tenantId || source.idCliente || source.cliente),
    crm: volumV2Texto_(source.crm || 'RD_STATION').toUpperCase(),
    pipelines: pipelines,
    users: users,
    version: volumV2Texto_(source.version || 'V2.0.0')
  };
}

function VOLUM_V2_MAPEAR_ETAPA_(config, pipelineId, stageId, stageName) {
  var wantedPipeline = volumV2Id_(pipelineId);
  var wantedStage = volumV2Id_(stageId);
  var name = volumV2Id_(stageName);
  var pipelines = volumV2Array_(config && config.pipelines);
  for (var p = 0; p < pipelines.length; p++) {
    if (wantedPipeline && pipelines[p].id !== wantedPipeline) continue;
    var stages = volumV2Array_(pipelines[p].stages);
    for (var s = 0; s < stages.length; s++) {
      var stage = stages[s];
      if ((wantedStage && stage.id === wantedStage) || (!wantedStage && name && volumV2Id_(stage.name) === name)) {
        return {
          found: true,
          pipelineId: pipelines[p].id,
          pipelineName: pipelines[p].name,
          stageId: stage.id,
          stageName: stage.name,
          order: stage.order,
          volumPhase: stage.volumPhase || '',
          expectedRole: stage.expectedRole || ''
        };
      }
    }
  }
  return {
    found: false,
    pipelineId: wantedPipeline,
    stageId: wantedStage,
    stageName: volumV2Texto_(stageName),
    volumPhase: '',
    expectedRole: ''
  };
}

function VOLUM_V2_NORMALIZAR_USUARIO_(user, config) {
  var normalized = user || {};
  var id = volumV2Id_(normalized.id || normalized.userId || normalized.ownerId);
  var users = volumV2Array_(config && config.users);
  for (var i = 0; i < users.length; i++) {
    if (id && users[i].id === id) return users[i];
  }
  return {
    id: id,
    name: volumV2Texto_(normalized.name || normalized.nome),
    email: volumV2Texto_(normalized.email).toLowerCase(),
    role: volumV2Texto_(normalized.role || normalized.papel).toUpperCase(),
    team: volumV2Texto_(normalized.team || normalized.equipe),
    active: normalized.active !== false,
    mapped: false
  };
}

function VOLUM_V2_NORMALIZAR_EVENTO_(event, context) {
  var item = event || {};
  var map = context && context.stageMap || {};
  var actor = context && context.userMap || {};
  var source = volumV2Texto_(item.source || item.fonte || 'CRM').toUpperCase();
  var type = volumV2Texto_(item.type || item.tipo || item.kind || 'UNKNOWN').toUpperCase();
  return {
    id: volumV2Texto_(item.id || item.eventId || item.externalId || [source, type, item.occurredAt || item.data].join(':')),
    dealId: volumV2Id_(item.dealId || item.negotiationId || context && context.dealId),
    occurredAt: volumV2Iso_(item.occurredAt || item.data || item.createdAt),
    type: type,
    source: source,
    sourceId: volumV2Texto_(item.sourceId || item.externalId || item.id),
    actorUserId: actor.id || volumV2Id_(item.actorUserId || item.ownerId || item.responsibleId),
    actorName: actor.name || volumV2Texto_(item.actorName || item.author || item.responsibleName),
    actorRole: actor.role || volumV2Texto_(item.actorRole || item.role).toUpperCase(),
    pipelineId: map.pipelineId || volumV2Id_(item.pipelineId),
    pipelineName: map.pipelineName || volumV2Texto_(item.pipelineName),
    stageId: map.stageId || volumV2Id_(item.stageId),
    stageName: map.stageName || volumV2Texto_(item.stageName),
    volumPhase: map.volumPhase || volumV2Texto_(item.volumPhase).toUpperCase(),
    evidence: {
      status: volumV2Texto_(item.evidenceStatus || item.statusEvidencia || VOLUM_V2_EVIDENCIA.INDICIO).toUpperCase(),
      source: source,
      sourceId: volumV2Texto_(item.sourceId || item.externalId || item.id),
      textAvailable: item.textAvailable === true || item.textoDisponivel === true
    },
    payload: item.payload || item.data || item
  };
}

function VOLUM_V2_CONSTRUIR_LINHA_TEMPO_(raw, configInput) {
  var rawData = raw || {};
  var config = VOLUM_V2_NORMALIZAR_CONFIG_(configInput || rawData.config || {});
  var deal = rawData.deal || rawData.negotiation || rawData.negociacao || {};
  var dealId = volumV2Id_(rawData.dealId || deal.id || deal.dealId);
  var pipelineId = volumV2Id_(rawData.pipelineId || deal.pipelineId);
  var stageMap = VOLUM_V2_MAPEAR_ETAPA_(
    config,
    pipelineId,
    deal.stageId || deal.etapaId,
    deal.stageName || deal.etapaNome
  );
  var owner = VOLUM_V2_NORMALIZAR_USUARIO_(
    rawData.owner || deal.owner || { id: deal.ownerId, name: deal.ownerName },
    config
  );
  var events = volumV2Array_(rawData.events || rawData.eventos || rawData.activities || rawData.atividades)
    .map(function (event) {
      var actor = VOLUM_V2_NORMALIZAR_USUARIO_({
        id: event.actorUserId || event.ownerId || event.responsibleId || event.autorId,
        name: event.actorName || event.author || event.autor,
        email: event.actorEmail
      }, config);
      return VOLUM_V2_NORMALIZAR_EVENTO_(event, {
        dealId: dealId,
        stageMap: VOLUM_V2_MAPEAR_ETAPA_(
          config,
          event.pipelineId || pipelineId,
          event.stageId || event.etapaId,
          event.stageName || event.etapaNome
        ),
        userMap: actor
      });
    })
    .filter(function (event) { return event.dealId === dealId || !event.dealId; })
    .sort(function (a, b) {
      return String(a.occurredAt).localeCompare(String(b.occurredAt)) || String(a.id).localeCompare(String(b.id));
    });
  return {
    schema: 'VOLUM_SALES_OPS_V2',
    version: config.version,
    tenantId: config.tenantId,
    crm: config.crm,
    deal: {
      id: dealId,
      name: volumV2Texto_(deal.name || deal.nome),
      pipelineId: stageMap.pipelineId || pipelineId,
      pipelineName: stageMap.pipelineName || volumV2Texto_(deal.pipelineName),
      currentStage: stageMap,
      owner: owner
    },
    users: config.users,
    pipelines: config.pipelines,
    events: events,
    coverage: rawData.coverage || {
      complete: false,
      missingSources: ['CONFIGURAR_COBERTURA'],
      authorizedSources: ['CRM']
    }
  };
}

/**
 * Adapta a leitura já existente do lead ao contrato canônico V2.
 * Não faz novas consultas, não altera o CRM e não acessa fontes privadas.
 */
function VOLUM_V2_SNAPSHOT_FROM_LEAD_(leitura, configInput) {
  var data = leitura || {};
  var deal = data.negociacao || {};
  var config = VOLUM_V2_NORMALIZAR_CONFIG_(configInput || {
    tenantId: data.idCliente || '',
    crm: 'RD_STATION',
    pipelines: [],
    users: []
  });
  var stageMap = VOLUM_V2_MAPEAR_ETAPA_(
    config,
    deal.pipelineId || '',
    deal.etapaAtualId || '',
    deal.etapaAtualNome || ''
  );
  var events = [];
  volumV2Array_(data.eventos).forEach(function (event) {
    var type = event.tipo || event.acao || 'UNKNOWN';
    events.push(VOLUM_V2_NORMALIZAR_EVENTO_({
      id: event.ref || event.id || '',
      dealId: data.dealId,
      type: type,
      occurredAt: event.data,
      source: event.fonte || 'CRM',
      sourceId: event.ref || event.id || '',
      stageId: event.etapaId || '',
      stageName: event.etapaNome || '',
      evidenceStatus: event.confianca || VOLUM_V2_EVIDENCIA.INDICIO,
      textAvailable: Boolean(event.textoDisponivel)
    }, {
      dealId: data.dealId,
      stageMap: VOLUM_V2_MAPEAR_ETAPA_(
        config,
        event.pipelineId || '',
        event.etapaId || '',
        event.etapaNome || ''
      ),
      userMap: VOLUM_V2_NORMALIZAR_USUARIO_({
        id: event.autorId || event.ownerId,
        name: event.autor || event.responsavel
      }, config)
    }));
  });
  var fontes = data.fontes || {};
  return {
    schema: 'VOLUM_SALES_OPS_V2',
    version: config.version,
    tenantId: config.tenantId,
    crm: config.crm,
    deal: {
      id: volumV2Id_(data.dealId),
      name: volumV2Texto_(deal.nome),
      pipelineId: stageMap.pipelineId || '',
      pipelineName: stageMap.pipelineName || '',
      currentStage: stageMap,
      owner: VOLUM_V2_NORMALIZAR_USUARIO_({
        id: deal.responsavelId || '',
        name: deal.responsavel
      }, config)
    },
    users: config.users,
    pipelines: config.pipelines,
    events: events.sort(function (a, b) {
      return String(a.occurredAt).localeCompare(String(b.occurredAt));
    }),
    coverage: {
      complete: fontes.atividades && fontes.atividades.completo === true &&
        fontes.tarefas && fontes.tarefas.completo === true,
      missingSources: Object.keys(fontes).filter(function (key) {
        return fontes[key] && fontes[key].completo === false;
      }),
      authorizedSources: ['CRM', 'BOARD_METADATA'],
      sourceSnapshot: fontes
    },
    legacy: {
      version: volumV2Texto_(data.versao),
      readOnly: data.modo === 'SOMENTE_LEITURA',
      agentResultsAvailable: Array.isArray(data.cerebros) && data.cerebros.length > 0
    }
  };
}

function volumV2PlanoStatus_(item) {
  var raw = volumV2Texto_(item && (item.status || item.resultado || item.estado)).toUpperCase();
  if (raw === 'CONFORME' || raw === 'CUMPRIDO' || raw === 'EVIDENCIADO') return VOLUM_V2_STATUS.CUMPRIDO;
  if (raw === 'PARCIAL' || raw === 'INDICIO' || raw === 'ATENCAO') return VOLUM_V2_STATUS.PARCIAL;
  if (raw === 'NAO_CONFORME' || raw === 'NAO_CUMPRIDO' || raw === 'DESVIO_EXECUCAO') return VOLUM_V2_STATUS.NAO_CUMPRIDO;
  if (raw === 'NAO_APLICAVEL') return VOLUM_V2_STATUS.NAO_APLICAVEL;
  if (raw === 'CONTRADITORIO') return VOLUM_V2_STATUS.CONTRADITORIO;
  return VOLUM_V2_STATUS.NAO_VERIFICAVEL;
}

function volumV2PlanoAgente_(item) {
  return volumV2Texto_(item && (item.agent || item.agente || item.ownerAgent)).toUpperCase();
}

function volumV2PlanoDestino_(agent) {
  if (['LEAD', 'CADENCIA', 'CONEXAO', 'AGENDA'].indexOf(agent) >= 0) return 'SDR';
  if (['REUNIAO', 'CLOSER', 'FOLLOW-UP', 'FOLLOW_UP', 'RECOVERY'].indexOf(agent) >= 0) return 'CLOSER';
  return '';
}

function volumV2PlanoItem_(item, agent, snapshot) {
  var status = volumV2PlanoStatus_(item);
  return {
    id: volumV2Texto_(item && (item.id || item.criterionId || item.criterio || item.title)),
    agent: agent,
    stage: volumV2Texto_(item && (item.stage || item.etapa || agent)).toUpperCase(),
    criterion: volumV2Texto_(item && (item.criterion || item.criterio || item.title || item.titulo)),
    status: status,
    conclusion: volumV2Texto_(item && (item.conclusion || item.detalhe || item.detail || item.resultado)),
    evidence: volumV2Texto_(item && (item.evidence || item.evidencia || item.fonte)),
    action: volumV2Texto_(item && (item.action || item.acao || item.recommendation || item.recomendacao)),
    responsible: volumV2Texto_(item && (item.responsible || item.responsavel || item.role)).toUpperCase(),
    applicable: status !== VOLUM_V2_STATUS.NAO_APLICAVEL,
    dealId: snapshot && snapshot.deal ? snapshot.deal.id : ''
  };
}

function VOLUM_V2_CONSOLIDAR_PLANO_(snapshot, agentResults) {
  var input = snapshot || {};
  var results = volumV2Array_(agentResults || input.agents || input.cerebros);
  var seen = {};
  var items = [];
  results.forEach(function (agentResult) {
    var agent = volumV2PlanoAgente_(agentResult);
    var rawItems = volumV2Array_(agentResult && (agentResult.items || agentResult.itens || agentResult.criteria || agentResult.criterios));
    rawItems.forEach(function (rawItem, index) {
      var item = volumV2PlanoItem_(rawItem, agent || 'UNKNOWN', input);
      if (!item.id) item.id = agent + ':' + index;
      if (!item.criterion) item.criterion = item.id;
      var key = item.agent + '|' + item.id;
      if (seen[key]) return;
      seen[key] = true;
      items.push(item);
    });
  });
  var sdr = items.filter(function (item) { return item.applicable && volumV2PlanoDestino_(item.agent) === 'SDR'; });
  var closer = items.filter(function (item) { return item.applicable && volumV2PlanoDestino_(item.agent) === 'CLOSER'; });
  var statusOf = function (list) {
    if (!list.length) return VOLUM_V2_STATUS.NAO_APLICAVEL;
    if (list.some(function (item) { return item.status === VOLUM_V2_STATUS.NAO_CUMPRIDO; })) return VOLUM_V2_STATUS.NAO_CUMPRIDO;
    if (list.some(function (item) { return item.status === VOLUM_V2_STATUS.PARCIAL || item.status === VOLUM_V2_STATUS.CONTRADITORIO; })) return VOLUM_V2_STATUS.PARCIAL;
    if (list.every(function (item) { return item.status === VOLUM_V2_STATUS.CUMPRIDO; })) return VOLUM_V2_STATUS.CUMPRIDO;
    return VOLUM_V2_STATUS.NAO_VERIFICAVEL;
  };
  var unresolved = function (list) {
    return list.filter(function (item) {
      return item.status === VOLUM_V2_STATUS.NAO_CUMPRIDO ||
        item.status === VOLUM_V2_STATUS.PARCIAL ||
        item.status === VOLUM_V2_STATUS.CONTRADITORIO;
    });
  };
  var events = volumV2Array_(input.events).map(function (event) {
    return {
      date: event.occurredAt || '',
      type: event.type || '',
      source: event.source || '',
      stage: event.volumPhase || event.stageName || '',
      actor: event.actorName || '',
      evidence: event.evidence && event.evidence.status || ''
    };
  });
  events.sort(function (a, b) { return String(a.date).localeCompare(String(b.date)); });
  return {
    schema: 'VOLUM_SALES_OPS_V2_PLAN',
    dealId: input.deal && input.deal.id || '',
    currentState: {
      phase: input.deal && input.deal.currentStage && input.deal.currentStage.volumPhase || '',
      stage: input.deal && input.deal.currentStage && input.deal.currentStage.stageName || '',
      owner: input.deal && input.deal.owner || {},
      lastEvent: events.length ? events[events.length - 1] : null
    },
    history: events,
    process: {
      status: statusOf(items),
      sdrStatus: statusOf(sdr),
      closerStatus: statusOf(closer),
      totalCriteria: items.length,
      applicableCriteria: sdr.length + closer.length,
      unresolvedCriteria: unresolved(items).length
    },
    planSdr: {
      status: statusOf(sdr),
      items: sdr,
      unresolved: unresolved(sdr)
    },
    planCloser: {
      status: statusOf(closer),
      items: closer,
      unresolved: unresolved(closer)
    },
    coverage: input.coverage || {},
    rule: 'Canvas/etapa define ocorrência; CRM/evidência define execução e registro; ausência não é falha automática.'
  };
}

function VOLUM_V2_AGREGAR_FUNIL_(snapshots) {
  var rows = volumV2Array_(snapshots);
  var byPhase = {};
  var byOwner = {};
  var macro = {
    schema: 'VOLUM_SALES_OPS_V2_FUNNEL',
    totalLeads: rows.length,
    leadsWithCompleteCoverage: 0,
    leadsWithoutNextStep: 0,
    sdr: { conformes: 0, parciais: 0, desvios: 0, naoVerificaveis: 0 },
    closer: { conformes: 0, parciais: 0, desvios: 0, naoAplicaveis: 0, naoVerificaveis: 0 },
    byPhase: byPhase,
    byOwner: byOwner,
    priorities: []
  };
  rows.forEach(function (row) {
    var plan = row.plan || row.plano || {};
    var phase = volumV2Texto_(row.currentPhase || row.phase ||
      plan.currentState && plan.currentState.phase || 'NAO_MAPEADA').toUpperCase();
    byPhase[phase] = (byPhase[phase] || 0) + 1;
    if (row.coverage && row.coverage.complete === true) macro.leadsWithCompleteCoverage++;
    var sdrStatus = volumV2Texto_(row.sdrStatus || plan.process && plan.process.sdrStatus).toUpperCase();
    var closerStatus = volumV2Texto_(row.closerStatus || plan.process && plan.process.closerStatus).toUpperCase();
    var sdrKey = sdrStatus === VOLUM_V2_STATUS.CUMPRIDO ? 'conformes' :
      sdrStatus === VOLUM_V2_STATUS.NAO_CUMPRIDO ? 'desvios' :
      sdrStatus === VOLUM_V2_STATUS.NAO_VERIFICAVEL ? 'naoVerificaveis' : 'parciais';
    macro.sdr[sdrKey]++;
    if (closerStatus === VOLUM_V2_STATUS.NAO_APLICAVEL) macro.closer.naoAplicaveis++;
    else {
      var closerKey = closerStatus === VOLUM_V2_STATUS.CUMPRIDO ? 'conformes' :
        closerStatus === VOLUM_V2_STATUS.NAO_CUMPRIDO ? 'desvios' :
        closerStatus === VOLUM_V2_STATUS.NAO_VERIFICAVEL ? 'naoVerificaveis' : 'parciais';
      macro.closer[closerKey]++;
    }
    var owner = row.owner || plan.currentState && plan.currentState.owner || {};
    var ownerId = volumV2Id_(owner.id || owner.userId || owner.name || 'SEM_RESPONSAVEL');
    byOwner[ownerId] = byOwner[ownerId] || { id: ownerId, name: owner.name || '', role: owner.role || '', leads: 0, unresolved: 0 };
    byOwner[ownerId].leads++;
    var unresolved = Number(row.unresolvedCriteria || plan.process && plan.process.unresolvedCriteria || 0);
    byOwner[ownerId].unresolved += unresolved;
    if (row.withoutNextStep === true || plan.withoutNextStep === true) macro.leadsWithoutNextStep++;
    if (unresolved > 0 || sdrStatus === VOLUM_V2_STATUS.NAO_CUMPRIDO || closerStatus === VOLUM_V2_STATUS.NAO_CUMPRIDO) {
      macro.priorities.push({
        dealId: row.dealId || plan.dealId || '',
        phase: phase,
        owner: owner.name || '',
        unresolved: unresolved,
        sdrStatus: sdrStatus,
        closerStatus: closerStatus
      });
    }
  });
  macro.priorities.sort(function (a, b) {
    return Number(b.unresolved) - Number(a.unresolved) || String(a.dealId).localeCompare(String(b.dealId));
  });
  return macro;
}

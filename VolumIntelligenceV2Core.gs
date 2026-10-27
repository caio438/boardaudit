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

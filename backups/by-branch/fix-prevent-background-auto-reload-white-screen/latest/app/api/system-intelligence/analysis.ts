export type IntelligenceSeverity = "critical" | "high" | "medium" | "info";
export type IntelligenceCategory =
  | "performance"
  | "data_quality"
  | "continuity"
  | "security"
  | "usage"
  | "architecture";

export type NavigationSignal = {
  label: string;
  count: number;
  share: number;
};

export type SystemSignals = {
  generatedAt: string;
  totalContacts: number;
  pendingContacts: number;
  newContacts7Days: number;
  newContacts30Days: number;
  activeUsers: number;
  blockedUsers: number;
  inactiveUsers30Days: number;
  leaders: number;
  auditEvents30Days: number;
  navigationEvents30Days: number;
  operationalEvents30Days: number;
  auditWindowTruncated: boolean;
  imports30Days: {
    runs: number;
    inserted: number;
    duplicates: number;
    invalid: number;
  };
  backup: {
    exists: boolean;
    createdAt: string | null;
    createdBy: string | null;
    itemCount: number;
    ageHours: number | null;
  };
  navigation: NavigationSignal[];
};

export type IntelligenceFinding = {
  id: string;
  category: IntelligenceCategory;
  severity: IntelligenceSeverity;
  confidence: "high" | "medium";
  title: string;
  summary: string;
  impact: string;
  recommendation: string;
  evidence: string[];
  actionHref?: string;
  actionLabel?: string;
};

const SEVERITY_ORDER: Record<IntelligenceSeverity, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  info: 1,
};

const SEVERITY_PENALTY: Record<IntelligenceSeverity, number> = {
  critical: 22,
  high: 12,
  medium: 6,
  info: 0,
};

function percent(part: number, total: number) {
  if (!total) return 0;
  return (part / total) * 100;
}

function formatPercent(value: number) {
  return `${value.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
}

function formatNumber(value: number) {
  return value.toLocaleString("pt-BR");
}

function healthLabel(score: number) {
  if (score >= 90) return "Saudável";
  if (score >= 75) return "Estável com oportunidades";
  if (score >= 60) return "Atenção recomendada";
  return "Intervenção recomendada";
}

export function analyzeSystemSignals(signals: SystemSignals) {
  const findings: IntelligenceFinding[] = [];
  const qualityRate = percent(signals.pendingContacts, signals.totalContacts);
  const importInput =
    signals.imports30Days.inserted +
    signals.imports30Days.duplicates +
    signals.imports30Days.invalid;
  const invalidImportRate = percent(signals.imports30Days.invalid, importInput);
  const duplicateImportRate = percent(signals.imports30Days.duplicates, importInput);
  const inactiveUserRate = percent(signals.inactiveUsers30Days, signals.activeUsers);
  const nonOperationalEvents = Math.max(
    0,
    signals.auditEvents30Days - signals.operationalEvents30Days,
  );
  const auditNoiseRate = percent(nonOperationalEvents, signals.auditEvents30Days);

  if (!signals.backup.exists) {
    findings.push({
      id: "backup-missing",
      category: "continuity",
      severity: "critical",
      confidence: "high",
      title: "Nenhum backup recente foi encontrado",
      summary:
        "A inteligência não encontrou uma fotografia recente da base na rotina de backups.",
      impact:
        "Uma falha operacional ou alteração acidental pode aumentar o tempo necessário para recuperação.",
      recommendation:
        "Verificar imediatamente a rotina automática e gerar uma cópia manual até confirmar a normalização.",
      evidence: ["Nenhum registro disponível em vf_backup_snapshots."],
      actionHref: "/sistema-completo",
      actionLabel: "Abrir backups",
    });
  } else if ((signals.backup.ageHours ?? 0) > 60) {
    findings.push({
      id: "backup-stale-critical",
      category: "continuity",
      severity: "critical",
      confidence: "high",
      title: "Backup está muito atrasado",
      summary: `O último backup tem aproximadamente ${Math.round(signals.backup.ageHours ?? 0)} horas.`,
      impact:
        "A janela de perda potencial de dados está maior do que a rotina diária prevista.",
      recommendation:
        "Validar a automação de backup e criar uma cópia manual antes de outras mudanças estruturais.",
      evidence: [
        `Último backup: ${signals.backup.createdAt ?? "sem data"}`,
        `Idade estimada: ${Math.round(signals.backup.ageHours ?? 0)} horas`,
      ],
      actionHref: "/sistema-completo",
      actionLabel: "Abrir backups",
    });
  } else if ((signals.backup.ageHours ?? 0) > 36) {
    findings.push({
      id: "backup-stale",
      category: "continuity",
      severity: "high",
      confidence: "high",
      title: "Backup diário precisa ser conferido",
      summary: `O último backup tem aproximadamente ${Math.round(signals.backup.ageHours ?? 0)} horas.`,
      impact:
        "A rotina automática pode estar atrasada ou ter perdido uma execução.",
      recommendation:
        "Conferir a Central de Backup e confirmar se a execução automática voltou ao ritmo diário.",
      evidence: [`Último backup: ${signals.backup.createdAt ?? "sem data"}`],
      actionHref: "/sistema-completo",
      actionLabel: "Conferir backups",
    });
  }

  if (signals.totalContacts > 0 && qualityRate >= 12) {
    findings.push({
      id: "quality-pressure-high",
      category: "data_quality",
      severity: "high",
      confidence: "high",
      title: "Pendências de qualidade estão pressionando a base",
      summary: `${formatPercent(qualityRate)} dos contatos possuem pelo menos uma pendência operacional monitorada.`,
      impact:
        "Filtros e consultas operacionais podem perder precisão.",
      recommendation:
        "Revisar a Central de Qualidade por categoria e reduzir primeiro as pendências com maior impacto operacional.",
      evidence: [
        `${formatNumber(signals.pendingContacts)} contatos com pendência`,
        `${formatNumber(signals.totalContacts)} contatos na base`,
      ],
      actionHref: "/pendencias-localizacao",
      actionLabel: "Abrir Central de Qualidade",
    });
  } else if (signals.totalContacts > 0 && qualityRate >= 5) {
    findings.push({
      id: "quality-pressure-medium",
      category: "data_quality",
      severity: "medium",
      confidence: "high",
      title: "Há espaço relevante para melhorar a qualidade da base",
      summary: `${formatPercent(qualityRate)} dos contatos ainda exigem revisão operacional.`,
      impact:
        "O volume ainda é administrável, mas tende a crescer se as correções não acompanharem novos cadastros.",
      recommendation:
        "Criar uma rotina de revisão semanal das categorias mais frequentes na Central de Qualidade.",
      evidence: [
        `${formatNumber(signals.pendingContacts)} contatos com pendência`,
        `${formatNumber(signals.newContacts7Days)} contatos adicionados nos últimos 7 dias`,
      ],
      actionHref: "/pendencias-localizacao",
      actionLabel: "Revisar pendências",
    });
  }

  if (importInput >= 100 && invalidImportRate >= 12) {
    findings.push({
      id: "imports-invalid-high",
      category: "data_quality",
      severity: "high",
      confidence: "high",
      title: "Importações recentes têm muitos registros inválidos",
      summary: `${formatPercent(invalidImportRate)} dos itens processados nas importações auditadas dos últimos 30 dias foram classificados como inválidos.`,
      impact:
        "A equipe perde tempo preparando arquivos que não conseguem entrar corretamente na base.",
      recommendation:
        "Revisar a origem dos arquivos e reforçar validações antes do envio para reduzir retrabalho.",
      evidence: [
        `${formatNumber(signals.imports30Days.invalid)} inválidos`,
        `${formatNumber(signals.imports30Days.runs)} importações registradas`,
      ],
      actionHref: "/importar-contatos",
      actionLabel: "Abrir importação",
    });
  } else if (importInput >= 100 && invalidImportRate >= 5) {
    findings.push({
      id: "imports-invalid-medium",
      category: "data_quality",
      severity: "medium",
      confidence: "high",
      title: "A qualidade dos arquivos de importação pode melhorar",
      summary: `${formatPercent(invalidImportRate)} dos itens processados recentemente foram inválidos.`,
      impact:
        "O processo funciona, mas existe retrabalho evitável antes da entrada dos dados.",
      recommendation:
        "Padronizar os arquivos de origem e acompanhar se a taxa de inválidos cai nas próximas importações.",
      evidence: [`${formatNumber(signals.imports30Days.invalid)} itens inválidos em 30 dias`],
      actionHref: "/importar-contatos",
      actionLabel: "Revisar importações",
    });
  }

  if (importInput >= 100 && duplicateImportRate >= 30) {
    findings.push({
      id: "imports-duplicates",
      category: "data_quality",
      severity: "medium",
      confidence: "high",
      title: "Muitos itens repetidos chegam pelas importações",
      summary: `${formatPercent(duplicateImportRate)} dos itens processados recentemente foram descartados como duplicados.`,
      impact:
        "O sistema protege a base, mas gasta processamento com arquivos que poderiam chegar mais limpos.",
      recommendation:
        "Identificar as fontes que mais repetem contatos e deduplicar os arquivos antes do envio.",
      evidence: [`${formatNumber(signals.imports30Days.duplicates)} duplicados descartados em 30 dias`],
      actionHref: "/importar-contatos",
      actionLabel: "Abrir importação",
    });
  }

  if (signals.activeUsers >= 8) {
    findings.push({
      id: "team-intelligence-query-fanout",
      category: "performance",
      severity: signals.activeUsers >= 16 ? "high" : "medium",
      confidence: "high",
      title: "A Inteligência da Equipe tende a ficar mais cara conforme a equipe cresce",
      summary:
        "A implementação atual calcula métricas com várias consultas por usuário. O processamento é em lotes, mas o número total de consultas cresce junto com a equipe.",
      impact:
        "Com mais usuários, o tempo de resposta e o consumo de banco podem aumentar mesmo sem crescimento proporcional de telas abertas.",
      recommendation:
        "Consolidar as métricas em uma consulta agregada/RPC e medir o tempo antes e depois da alteração.",
      evidence: [
        `${formatNumber(signals.activeUsers)} usuários ativos`,
        "Arquitetura atual: múltiplas consultas independentes para cada usuário monitorado",
      ],
      actionHref: "/inteligencia-equipe",
      actionLabel: "Abrir Inteligência da Equipe",
    });
  }

  if (
    signals.activeUsers >= 3 &&
    signals.inactiveUsers30Days > 0 &&
    inactiveUserRate >= 30
  ) {
    findings.push({
      id: "inactive-accesses",
      category: "security",
      severity: "medium",
      confidence: "medium",
      title: "Há acessos ativos sem utilização recente",
      summary: `${formatNumber(signals.inactiveUsers30Days)} contas ativas não registram uso recente na janela de 30 dias.`,
      impact:
        "Contas ociosas aumentam a superfície administrativa e dificultam distinguir equipe ativa de acessos antigos.",
      recommendation:
        "Revisar com o Master quais acessos ainda são necessários antes de bloquear qualquer conta.",
      evidence: [`${formatPercent(inactiveUserRate)} dos usuários ativos sem atividade recente`],
      actionHref: "/sistema-completo",
      actionLabel: "Revisar usuários",
    });
  }

  if (signals.auditEvents30Days >= 100 && auditNoiseRate >= 80) {
    findings.push({
      id: "audit-noise",
      category: "architecture",
      severity: "info",
      confidence: "high",
      title: "A auditoria mistura rastreabilidade com sinais de navegação",
      summary: `${formatPercent(auditNoiseRate)} dos eventos recentes são acessos ou navegação, e não ações operacionais.`,
      impact:
        "A leitura administrativa fica mais ruidosa e a futura telemetria de desempenho deve ser separada da auditoria de negócio.",
      recommendation:
        "Manter a auditoria para rastreabilidade e criar uma camada própria de telemetria técnica para latência, erros e Web Vitals.",
      evidence: [
        `${formatNumber(signals.auditEvents30Days)} eventos analisados`,
        `${formatNumber(signals.operationalEvents30Days)} eventos operacionais`,
      ],
    });
  }

  const lowUsage = signals.navigation
    .filter((item) => signals.navigationEvents30Days >= 30 && item.count <= 1)
    .slice(0, 4);
  if (lowUsage.length) {
    findings.push({
      id: "low-usage-areas",
      category: "usage",
      severity: "info",
      confidence: "medium",
      title: "Algumas áreas aparecem pouco na navegação auditada",
      summary:
        "Existem funcionalidades com uso muito baixo na auditoria disponível. Isso não prova que sejam desnecessárias, mas é um bom sinal para investigar consolidação ou reposicionamento.",
      impact:
        "Menus pouco utilizados aumentam complexidade visual e manutenção se não entregarem valor proporcional.",
      recommendation:
        "Comparar essas áreas com funcionalidades equivalentes antes de remover qualquer item. A inteligência deve recomendar, nunca excluir com base apenas nesse sinal.",
      evidence: lowUsage.map((item) => `${item.label}: ${item.count} navegação(ões) em 30 dias`),
    });
  }

  if (signals.auditWindowTruncated) {
    findings.push({
      id: "audit-window-truncated",
      category: "architecture",
      severity: "info",
      confidence: "high",
      title: "A janela de auditoria atingiu o limite de leitura da análise",
      summary:
        "Foram encontrados pelo menos 10.000 eventos nos últimos 30 dias e a leitura foi limitada para proteger o endpoint.",
      impact:
        "Percentuais baseados em auditoria continuam úteis como amostra recente, mas não representam toda a janela.",
      recommendation:
        "Na próxima evolução, mover agregações de auditoria para SQL/RPC em vez de transportar eventos individuais para a aplicação.",
      evidence: ["Limite atual da análise: 10.000 eventos por execução"],
    });
  }

  findings.sort(
    (left, right) =>
      SEVERITY_ORDER[right.severity] - SEVERITY_ORDER[left.severity] ||
      left.title.localeCompare(right.title, "pt-BR"),
  );

  const score = Math.max(
    35,
    100 - findings.reduce((sum, finding) => sum + SEVERITY_PENALTY[finding.severity], 0),
  );

  const priorities = {
    critical: findings.filter((item) => item.severity === "critical").length,
    high: findings.filter((item) => item.severity === "high").length,
    medium: findings.filter((item) => item.severity === "medium").length,
    info: findings.filter((item) => item.severity === "info").length,
  };

  return {
    engine: {
      name: "VOTO FORTE Neural",
      version: "0.2-observer",
      mode: "observer" as const,
      autonomyLevel: 1,
      autonomyLabel: "Recomendar, sem alterar produção",
      analysisCoverage: 68,
      limitations: [
        "Latência real de páginas e APIs ainda não possui telemetria histórica própria.",
        "A análise de uso depende dos eventos de navegação atualmente registrados na auditoria.",
        "Os diagnósticos ainda não são persistidos em um histórico diário dedicado.",
      ],
    },
    health: {
      score,
      label: healthLabel(score),
      priorities,
    },
    rates: {
      qualityPendingPercent: qualityRate,
      invalidImportPercent: invalidImportRate,
      duplicateImportPercent: duplicateImportRate,
      inactiveUserPercent: inactiveUserRate,
    },
    findings,
  };
}

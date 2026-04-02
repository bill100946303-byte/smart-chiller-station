import { marked } from 'marked'

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function deepClone(value) {
  return JSON.parse(JSON.stringify(value))
}

function moveGroupToFront(groups, id) {
  const index = groups.findIndex(group => group.id === id)
  if (index > 0) {
    const [group] = groups.splice(index, 1)
    groups.unshift(group)
  }
}

function prioritizePrompt(groups, groupId, promptText) {
  const group = groups.find(item => item.id === groupId)
  if (!group || !Array.isArray(group.prompts)) {
    return
  }
  const index = group.prompts.indexOf(promptText)
  if (index > 0) {
    const [prompt] = group.prompts.splice(index, 1)
    group.prompts.unshift(prompt)
  }
}

export function mapAssistantLocale(locale) {
  return String(locale || '').toLowerCase().startsWith('vi') ? 'vi-VN' : 'zh-CN'
}

export function buildUiCopy(locale) {
  if (String(locale || '').toLowerCase().startsWith('vi')) {
    return {
      floatLabel: 'AI',
      headerTitle: 'Tro ly tram',
      introTitle: 'Toi la tro ly tram cua ban',
      introBody: 'Toi hien ho tro tinh trang hien tai, giai thich canh bao, giai thich khuyen nghi va mot phan hoi dap van hanh.',
      quickPromptTitle: 'Cau hoi goi y',
      inputPlaceholder: 'Bat dau hoi dap',
      structuredMode: 'Che do tra loi theo du lieu tram',
      fallbackMode: 'Che do tra loi thong dung',
      sourcesLabel: 'Nguon trich dan',
      freshnessLabel: 'Do moi du lieu',
      sourceStatusLabel: 'Tinh trang chuoi du lieu',
      nextStepsLabel: 'Nen lam truoc',
      pageHintsLabel: 'Nen xem truoc',
      fresh: 'Moi',
      stale: 'Cu',
      unknown: 'Khong ro',
      ok: 'Binh thuong',
      partial: 'Mot phan kha dung',
      failed: 'Khong kha dung',
      requestFailed: 'Yeu cau that bai, vui long thu lai sau.',
      missingSite: 'Khong tim thay ngu canh tram hien tai, tam thoi chua the tra loi.',
      fallbackUnavailable: 'Che do tra loi thong dung tam thoi khong kha dung.'
    }
  }

  return {
    floatLabel: '助手',
    headerTitle: '站点助手',
    introTitle: '我是你的站点助手',
    introBody: '我现在支持当前状态、异常解释、建议解读和部分运维知识问答，快来向我提问吧。',
    quickPromptTitle: '推荐提问',
    inputPlaceholder: '开始聊天',
    structuredMode: '站点级回答',
    fallbackMode: '通用回答模式',
    sourcesLabel: '引用来源',
    freshnessLabel: '数据新鲜度',
    sourceStatusLabel: '链路状态',
    nextStepsLabel: '建议先做',
    pageHintsLabel: '建议先看',
    fresh: '新鲜',
    stale: '陈旧',
    unknown: '未知',
    ok: '正常',
    partial: '部分可用',
    failed: '不可用',
    requestFailed: '请求失败，请稍后重试。',
    missingSite: '当前站点上下文缺失，暂时无法回答。',
    fallbackUnavailable: '通用回答暂时不可用。'
  }
}

function getBaseQuickPromptGroups(locale) {
  if (String(locale || '').toLowerCase().startsWith('vi')) {
    return [
      {
        id: 'handle',
        title: 'Xu ly truoc',
        prompts: [
          'Hien tai viec gi can uu tien xu ly nhat?',
          'Canh bao nao dang can xem truoc?',
          'Hien tai co rui ro van hanh ro rang nao khong?',
          'Buoc tiep theo toi nen lam gi truoc?'
        ]
      },
      {
        id: 'inspect',
        title: 'Xem gi truoc',
        prompts: [
          'Neu chi kiem tra mot muc, nen xem thiet bi nao truoc?',
          'Hien tai thiet bi nao dang co dau hieu bat thuong?',
          'Tinh trang tram lanh hien tai the nao?',
          'Khuyen nghi hien tai co y nghia gi?'
        ]
      },
      {
        id: 'knowledge',
        title: 'Kien thuc van hanh',
        prompts: [
          'Chenh nhiet nuoc lanh thap thuong co nghia gi?',
          'Nguyen nhan COP tram thap thuong la gi?',
          'Chiller bat tat lien tuc thi kiem tra the nao?',
          'Dau hieu thap giai nhiet trao doi nhiet kem la gi?',
          'Ca truc dem nen uu tien theo doi chi so nao?'
        ]
      },
      {
        id: 'reliability',
        title: 'Co dang tin khong',
        prompts: [
          'Du lieu hien tai con moi khong?',
          'Ket luan nay co dang tin khong?'
        ]
      }
    ]
  }

  return [
    {
      id: 'handle',
      title: '先处理什么',
      prompts: [
        '现在最需要我处理的是什么？',
        '哪条异常最值得优先看？',
        '当前有没有明显运行风险？',
        '我下一步应该先做什么？'
      ]
    },
    {
      id: 'inspect',
      title: '先看什么',
      prompts: [
        '如果先检查一项，建议看哪台设备？',
        '现在有哪些设备状态异常？',
        '当前冷站运行状况如何？',
        '这条建议是什么意思？'
      ]
    },
    {
      id: 'knowledge',
      title: '运维知识',
      prompts: [
        '冷冻水温差偏低通常说明什么？',
        '站点 COP 偏低常见原因有哪些？',
        '主机频繁启停一般怎么排查？',
        '冷却塔换热变差通常有哪些征兆？',
        '夜间值班最该重点盯哪些指标？'
      ]
    },
    {
      id: 'reliability',
      title: '判断可靠吗',
      prompts: [
        '当前数据新鲜吗？',
        '这次判断可靠吗？'
      ]
    }
  ]
}

function isDegradedPayload(payload) {
  const kind = payload && payload.answer ? payload.answer.kind : ''
  const freshnessLabel = payload && payload.freshness ? payload.freshness.label : ''
  const overall = payload && payload.sourceStatus ? payload.sourceStatus.overall : ''
  return kind === 'reliability' || freshnessLabel === 'stale' || overall === 'partial' || overall === 'failed'
}

export function buildQuickPromptGroups(locale, payload) {
  const groups = deepClone(getBaseQuickPromptGroups(locale))
  const isVi = String(locale || '').toLowerCase().startsWith('vi')
  const kind = payload && payload.answer ? payload.answer.kind : ''

  if (isDegradedPayload(payload)) {
    moveGroupToFront(groups, 'reliability')
  } else if (kind === 'device') {
    moveGroupToFront(groups, 'inspect')
  }

  if (kind === 'recommendation') {
    prioritizePrompt(groups, 'inspect', isVi ? 'Khuyen nghi hien tai co y nghia gi?' : '这条建议是什么意思？')
    prioritizePrompt(groups, 'handle', isVi ? 'Buoc tiep theo toi nen lam gi truoc?' : '我下一步应该先做什么？')
  }

  if (kind === 'device') {
    prioritizePrompt(groups, 'inspect', isVi ? 'Neu chi kiem tra mot muc, nen xem thiet bi nao truoc?' : '如果先检查一项，建议看哪台设备？')
  }

  if (isDegradedPayload(payload)) {
    prioritizePrompt(groups, 'reliability', isVi ? 'Ket luan nay co dang tin khong?' : '这次判断可靠吗？')
  }

  return groups
}

function formatLocalizedTimestamp(value, locale) {
  if (!value) {
    return ''
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return ''
  }
  return date.toLocaleString(mapAssistantLocale(locale))
}

function formatFreshnessText(freshness, copy, locale) {
  if (!freshness || !freshness.label) {
    return copy.unknown
  }
  const labelMap = {
    fresh: copy.fresh,
    stale: copy.stale,
    unknown: copy.unknown
  }
  const baseLabel = labelMap[freshness.label] || copy.unknown
  const timestamp = formatLocalizedTimestamp(freshness.latestTimestamp, locale)
  return timestamp ? `${baseLabel} · ${timestamp}` : baseLabel
}

function formatSourceStatusText(sourceStatus, copy) {
  if (!sourceStatus || !sourceStatus.overall) {
    return copy.unknown
  }
  const labelMap = {
    ok: copy.ok,
    partial: copy.partial,
    failed: copy.failed
  }
  return labelMap[sourceStatus.overall] || sourceStatus.overall
}

export function isOperationsKnowledgeAnswer(payload) {
  const citations = Array.isArray(payload && payload.answer && payload.answer.citations)
    ? payload.answer.citations
    : []
  return citations.length > 0 && citations.every(item => item && item.sourceKey === 'operationsKnowledge')
}

function renderListSection(title, items) {
  if (!Array.isArray(items) || items.length === 0) {
    return ''
  }
  return `<p><strong>${escapeHtml(title)}</strong></p><ul>${items.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`
}

export function renderStructuredAnswer(payload, locale) {
  const copy = buildUiCopy(locale)
  const answer = payload && payload.answer ? payload.answer : {}
  const details = Array.isArray(answer.details) ? answer.details : []
  const nextSteps = Array.isArray(answer.nextSteps) ? answer.nextSteps : []
  const pageHints = Array.isArray(answer.pageHints) ? answer.pageHints : []
  const citations = Array.isArray(answer.citations) ? answer.citations : []
  const isKnowledgeAnswer = isOperationsKnowledgeAnswer(payload)
  const sections = [
    `<p><strong>${escapeHtml(copy.structuredMode)}</strong></p>`,
    `<p>${escapeHtml(answer.summary || copy.unknown)}</p>`
  ]

  if (details.length > 0) {
    sections.push(`<ul>${details.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`)
  }

  const nextStepsSection = renderListSection(copy.nextStepsLabel, nextSteps)
  if (nextStepsSection) {
    sections.push(nextStepsSection)
  }

  if (pageHints.length > 0) {
    sections.push(
      `<p><strong>${escapeHtml(copy.pageHintsLabel)}</strong>：${pageHints.map(item => escapeHtml(item)).join(' / ')}</p>`
    )
  }

  if (!isKnowledgeAnswer && citations.length > 0) {
    sections.push(
      `<p><strong>${escapeHtml(copy.sourcesLabel)}</strong>：${citations.map(item => escapeHtml(item.label || item.sourceKey || copy.unknown)).join(' / ')}</p>`
    )
  }

  if (!isKnowledgeAnswer) {
    sections.push(
      `<p><strong>${escapeHtml(copy.freshnessLabel)}</strong>：${escapeHtml(formatFreshnessText(payload && payload.freshness, copy, locale))}</p>`
    )
    sections.push(
      `<p><strong>${escapeHtml(copy.sourceStatusLabel)}</strong>：${escapeHtml(formatSourceStatusText(payload && payload.sourceStatus, copy))}</p>`
    )
  }

  return sections.join('')
}

export function renderFallbackAnswer(markdownText, locale) {
  const copy = buildUiCopy(locale)
  const parsedContent = marked
    .parse(String(markdownText || ''))
    .replace(/\n\n---\n\n/g, '\n')
    .replace(/<hr\s*\/?>/g, '')
  return `<p><strong>${escapeHtml(copy.fallbackMode)}</strong></p>${parsedContent}`
}

export function renderErrorAnswer(message, locale) {
  const copy = buildUiCopy(locale)
  return `<p><strong>${escapeHtml(copy.headerTitle)}</strong></p><p>${escapeHtml(message || copy.requestFailed)}</p>`
}

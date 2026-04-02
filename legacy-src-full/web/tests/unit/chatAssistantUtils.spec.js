import {
  buildQuickPromptGroups,
  renderStructuredAnswer
} from '@/views/systemhomepage/components/chatAssistantUtils'

describe('chatAssistantUtils', () => {
  test('keeps default quick prompt order when no payload context exists', () => {
    const groups = buildQuickPromptGroups('zh-CN')
    expect(groups[0].title).toBe('先处理什么')
    expect(groups[1].title).toBe('先看什么')
  })

  test('moves reliability group to front when latest payload is degraded', () => {
    const groups = buildQuickPromptGroups('zh-CN', {
      answer: { kind: 'status' },
      freshness: { label: 'stale' },
      sourceStatus: { overall: 'partial' }
    })
    expect(groups[0].title).toBe('判断可靠吗')
  })

  test('prioritizes recommendation follow-up prompts after recommendation answers', () => {
    const groups = buildQuickPromptGroups('zh-CN', {
      answer: { kind: 'recommendation' },
      freshness: { label: 'fresh' },
      sourceStatus: { overall: 'ok' }
    })
    const inspectGroup = groups.find(group => group.id === 'inspect')
    const handleGroup = groups.find(group => group.id === 'handle')

    expect(inspectGroup.prompts[0]).toBe('这条建议是什么意思？')
    expect(handleGroup.prompts[0]).toBe('我下一步应该先做什么？')
  })

  test('renders next steps and hides footer meta for operations knowledge answers', () => {
    const html = renderStructuredAnswer(
      {
        answer: {
          kind: 'knowledge',
          summary: '冷冻水温差偏低常见于流量偏大。',
          details: ['先判断是否真实低负荷。'],
          nextSteps: ['先核对负荷侧需求。'],
          pageHints: [],
          citations: [{ sourceKey: 'operationsKnowledge', label: '运维知识' }]
        },
        freshness: {
          label: 'unknown',
          latestTimestamp: null
        },
        sourceStatus: {
          overall: 'ok'
        }
      },
      'zh-CN'
    )

    expect(html).toContain('建议先做')
    expect(html).toContain('先核对负荷侧需求。')
    expect(html).not.toContain('引用来源')
    expect(html).not.toContain('数据新鲜度')
    expect(html).not.toContain('链路状态')
  })

  test('renders next steps, page hints, and footer meta for site answers', () => {
    const html = renderStructuredAnswer(
      {
        answer: {
          kind: 'status',
          summary: '当前站点现态可读。',
          details: ['总功率与温差已回传。'],
          nextSteps: ['先核对告警页面。'],
          pageHints: ['站点总览', '告警页面'],
          citations: [{ sourceKey: 'dashboardOverview', label: '站点总览' }]
        },
        freshness: {
          label: 'fresh',
          latestTimestamp: '2026-03-31T10:00:00.000Z'
        },
        sourceStatus: {
          overall: 'ok'
        }
      },
      'zh-CN'
    )

    expect(html).toContain('建议先做')
    expect(html).toContain('建议先看')
    expect(html).toContain('站点总览 / 告警页面')
    expect(html).toContain('引用来源')
    expect(html).toContain('数据新鲜度')
    expect(html).toContain('链路状态')
  })
})

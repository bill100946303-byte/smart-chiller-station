import request from '@/utils/request'

const ASSISTANT_TIMEOUT_MS = 10000
const DEFAULT_LOCAL_BFF_PORT = '8787'

function trimTrailingSlash(value) {
    return String(value || '').replace(/\/+$/, '')
}

function isLocalHost(hostname) {
    return hostname === '127.0.0.1' || hostname === 'localhost'
}

function resolveBffBaseUrl() {
    const explicitBaseUrl = trimTrailingSlash(process.env.VUE_APP_BFF_BASE_URL)
    if (explicitBaseUrl) {
        return explicitBaseUrl
    }

    if (typeof window !== 'undefined' && window.location) {
        if (isLocalHost(window.location.hostname)) {
            return `${window.location.protocol}//${window.location.hostname}:${DEFAULT_LOCAL_BFF_PORT}`
        }

        if (window.location.origin) {
            return trimTrailingSlash(window.location.origin)
        }
    }

    const legacyBaseUrl = trimTrailingSlash(process.env.VUE_APP_BASE_URL)
    if (!legacyBaseUrl) {
        return ''
    }

    if (legacyBaseUrl.startsWith('/')) {
        return ''
    }

    try {
        const parsed = new URL(legacyBaseUrl)
        if (isLocalHost(parsed.hostname)) {
            return `${parsed.protocol}//${parsed.hostname}:${DEFAULT_LOCAL_BFF_PORT}`
        }
    } catch (_error) {
        return legacyBaseUrl
    }

    return legacyBaseUrl
}

function buildAssistantUrl(siteId) {
    const path = `/bff/v1/sites/${encodeURIComponent(siteId)}/assistant/query`
    const baseUrl = resolveBffBaseUrl()
    return baseUrl ? `${baseUrl}${path}` : path
}

function createAssistantError(message, extras = {}) {
    const error = new Error(message)
    Object.assign(error, extras)
    return error
}

function normalizeHeaderValue(value) {
    const text = String(value == null ? '' : value).trim()
    return text || null
}

// 获取聊天名单
export function getChats(path, appid) {
    return request({
        url: `zsqy/lt/${path}/findLTuser`,
        method: 'get',
        params: {
            appid
        }
    })
}

// 发送消息
export function sendMsg(path, appid, useltid, contactid, msg) {
    return request({
        url: `zsqy/lt/${path}/chat`,
        method: 'get',
        params: {
            appid,
            useltid,
            contactid,
            msg
        }
    })
}

// 发送消息
export function deepseek(path, data) {
    return request({
        url: `api/ai/deepseek/${path}/chat`,
        method: 'get',
        params: data
    })
}

export async function queryAssistant(siteId, body) {
    const context = body && body.context ? body.context : {}
    const userId = normalizeHeaderValue(context.userId)
    const projectKey = normalizeHeaderValue(context.projectKey)
    const template = normalizeHeaderValue(context.template)
    const legacyBaseUrl = normalizeHeaderValue(context.legacyBaseUrl)

    const controller = typeof AbortController === 'function' ? new AbortController() : null
    const timeoutId = controller
        ? setTimeout(() => {
            controller.abort()
        }, ASSISTANT_TIMEOUT_MS)
        : null

    try {
        const response = await fetch(buildAssistantUrl(siteId), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                ...(userId ? { 'x-chiller-user-id': userId } : {}),
                ...(projectKey ? { 'x-chiller-project-key': projectKey } : {}),
                ...(template ? { 'x-chiller-project-template': template } : {}),
                ...(legacyBaseUrl ? { 'x-chiller-legacy-base-url': legacyBaseUrl } : {})
            },
            body: JSON.stringify(body),
            signal: controller ? controller.signal : undefined
        })

        const contentType = String(response.headers.get('content-type') || '').toLowerCase()
        const payload = contentType.includes('application/json')
            ? await response.json()
            : null

        if (!response.ok) {
            throw createAssistantError(
                payload && payload.error ? payload.error : `Assistant request failed with ${response.status}`,
                {
                    status: response.status,
                    code: payload && payload.code ? payload.code : null,
                    payload,
                    shouldFallback: response.status >= 500 || (payload && payload.code === 'UPSTREAM_UNAVAILABLE')
                }
            )
        }

        return payload
    } catch (error) {
        if (error && error.name === 'AbortError') {
            throw createAssistantError('Assistant request timed out', {
                code: 'TIMEOUT',
                shouldFallback: true
            })
        }

        if (error && typeof error.shouldFallback === 'boolean') {
            throw error
        }

        throw createAssistantError(
            error && error.message ? error.message : 'Assistant request failed',
            {
                code: 'NETWORK_ERROR',
                shouldFallback: true
            }
        )
    } finally {
        if (timeoutId) {
            clearTimeout(timeoutId)
        }
    }
}

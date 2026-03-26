import request from '@/utils/request'

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
import request from "@/utils/request"

// 查询能源类型
export function info(path) {
    return request({
        url: `zsqy/paramType/${path}/findObject`,
        method: 'get'
    })
}
// 新增
export function add(path, data) {
    return request({
        url: `zsqy/paramType/${path}/save`,
        method: 'post',
        data
    })
}

// 修改
export function update(path, data) {
    return request({
        url: `zsqy/paramType/${path}/update`,
        method: 'put',
        data
    })
}

// 删除
export function del(path, ids) {
    return request({
        url: `zsqy/paramType/${path}/delete`,
        method: 'delete',
        params: {
            ids
        }
    })
}
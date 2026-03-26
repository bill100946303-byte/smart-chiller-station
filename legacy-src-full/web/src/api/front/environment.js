import request from '@/utils/request'

// 获所有楼栋信息
export function buildinfoAll(path) {
    return request({
        url: `/zsqy/buildinfo/${path}/findAll`,
        method: 'get',
    })
}

//Integer buildingId,楼栋ID
//Integer CooledAir是否开冷气
export function condition(path, buildingId, CooledAir, monitoringSite) {
    return request({
        url: `/zsqy/condition/${path}/findObject`,
        method: 'get',
        params: {
            buildingId, CooledAir, monitoringSite
        }
    })
}

//设置温湿度限值

export function setvalue(path, data) {
    return request({
        url: `/zsqy/condition/${path}/update`,
        method: 'post',
        data: data
    })
}


// ---------------------------------------------------后台接口

//设置温湿度限值

export function addsave(path, data) {
    return request({
        url: `/zsqy/condition/${path}/save`,
        method: 'post',
        data: data
    })
}
export function deletecem(path, ids) {
    return request({
        url: `/zsqy/condition/${path}/delete`,
        method: 'delete',
        params: {
            ids
        }
    })
}
import request from '@/utils/request'

// 根据设备类型查询所有设备
export function findDevice(path, drtypeid) {
    return request({
        url: `zsqy/drinfo/${path}/findAllIsUser`,
        method: 'get',
        params: {
            drtypeid
        }
    })
}
// 给部门分配设备
export function addDevice(path, data) {
    return request({
        url: `zsqy/departmentdr/${path}/save`,
        method: 'put',
        data
    })
}
// 给部门移除设备
export function removeDevice(path, data) {
    return request({
        url: `zsqy/departmentdr/${path}/delete`,
        method: 'put',
        data
    })
}
// 查询部门对应的设备
export function searchdevice(path, departmentid) {
    return request({
        url: `zsqy/departmentdr/${path}/findObject`,
        method: 'get',
        params: {
            departmentid
        }
    })
}
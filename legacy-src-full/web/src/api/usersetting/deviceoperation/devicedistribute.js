import request from '@/utils/request'

// 查询所有人员
export function findPeople(path) {
    return request({
        url: `zsqy/appuser/${path}/findAll`,
        method: 'get'
    })
}
// 根据设备类型查询所有设备
export function findDevice(path, drtypeid) {
    return request({
        url: `zsqy/drinfo/${path}/findAll`,
        method: 'get',
        params: {
            drtypeid
        }
    })
}
// 给人员分配设备
export function addDevice(path, data) {
    return request({
        url: `zsqy/drinfo/${path}/updateUser`,
        method: 'put',
        data
    })
}
// 给人员移除设备
export function removeDevice(path, data) {
    return request({
        url: `zsqy/drinfo/${path}/removeUser`,
        method: 'put',
        data
    })
}
// 查询人员对应的设备
export function searchdevice(path, userid) {
    return request({
        url: `zsqy/drinfo/${path}/findAll`,
        method: 'get',
        params: {
            userid
        }
    })
}

// 查询所有报警类型
export function findAlarmType(path) {
    return request({
        url: `zsqy/alarmtype/${path}/findAll`,
        method: "get"
    })
}

// 查询用户分配报警级别
export function findUserAlarmType(path, userid) {
    return request({
        url: `zsqy/alarmtype/${path}/findUserAlarm`,
        method: 'get',
        params: {
            userid
        }
    })
}

// 给用户分配报警级别
export function addUserAlarmType(path, data) {
    return request({
        url: `zsqy/alarmtype/${path}/updateUserAlarm`,
        method: 'post',
        data
    })
}
import request from '@/utils/request'

// 查询所有模式任务
export function findAllModelTask(path, drtypeid) {
  return request({
    url: `zsqy/ms/rw/${path}/findMsRw`,
    method: 'get',
    params: {
      drtypeid
    }
  })
}

// 查询所有读写的变量
export function findAllWriteReg(path, pageCurrent, pageSize, regName, rw) {
  return request({
    url: `zsqy/reg/${path}/findRegByRegName`,
    method: 'get',
    params: {
      pageCurrent, 
      pageSize, 
      regName,
      rw
    }
  })
}

// 模式任务导入
export function inputModelTask(path, data) {
  return request({
    url: `zsqy/ms/rw/${path}/importRw`,
    method: 'post',
    data
  })
}
// 模式任务导出
export function outputModelTask(path, drtypeid) {
  return request({
    url: `zsqy/ms/rw/${path}/exportRw`,
    method: 'get',
    responseType: 'blob',
    params: {
      drtypeid
    }
  })
}

// 添加模式任务
export function addModelTask(path, data) {
  return request({
    url: `zsqy/ms/rw/${path}/insertMsRw`,
    method: 'post',
    data
  })
}

// 修改模式任务
export function updateModelTask(path, data) {
  return request({
    url: `zsqy/ms/rw/${path}/updateMsRw`,
    method: 'put',
    data
  })
}

// 删除模式任务
export function deleteModelTask(path, id) {
  return request({
    url: `zsqy/ms/rw/${path}/deleteMsRw`,
    method: 'delete',
    params: {
      id
    }
  })
}


// 分页查询模式动作
export function findModelAction(path, pageCurrent, pageSize, rwid) {
  return request({
    url: `zsqy/ms/dz/${path}/findMsDz`,
    method: 'get',
    params: {
      pageCurrent,
      pageSize,
      rwid
    }
  })
}

// 新增模式动作
export function addModelAction(path, data) {
  return request({
    url: `zsqy/ms/dz/${path}/insertMsDz`,
    method: 'post',
    data
  })
}

// 修改模式动作
export function updateModelAction(path, data) {
  return request({
    url: `zsqy/ms/dz/${path}/updateMsDz`,
    method: 'put',
    data
  })
}

// 删除模式动作
export function deleteModelAction(path, id) {
  return request({
    url: `zsqy/ms/dz/${path}/deleteMsDz`,
    method: 'delete',
    params: {
      id
    }
  })
}

// 分页查询模式变量
export function findModelReg(path, pageCurrent, pageSize, dzid) {
  return request({
    url: `zsqy/ms/jg/${path}/findMsJg`,
    method: 'get',
    params: {
      pageCurrent,
      pageSize,
      dzid
    }
  })
}

// 模式变量导入
export function inputModelReg(path, data) {
  return request({
    url: `zsqy/ms/jg/${path}/importJg`,
    method: 'post',
    data
  })
}
// 模式变量导出
export function outputModelReg(path, dzid) {
  return request({
    url: `zsqy/ms/jg/${path}/exportJg`,
    method: 'get',
    responseType: 'blob',
    params: {
      dzid
    }
  })
}

// 新增模式变量
export function addModelReg(path, data) {
  return request({
    url: `zsqy/ms/jg/${path}/insertMsJg`,
    method: 'post',
    data
  })
}

// 修改模式变量
export function updateModelReg(path, data) {
  return request({
    url: `zsqy/ms/jg/${path}/updateMsJg`,
    method: 'put',
    data
  })
}

// 删除模式变量
export function deleteModelReg(path, ids) {
  return request({
    url: `zsqy/ms/jg/${path}/deleteMsJg`,
    method: 'delete',
    params: {
      ids
    }
  })
}

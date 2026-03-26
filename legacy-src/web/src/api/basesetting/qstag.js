import request from "@/utils/request"

// 导出excel文件
export function outputExcel(path, tagname) {
  return request({
    url: `zsqy/qstag/${path}/export`,
    method: 'get',
    params: {
      tagname
    },
    responseType: 'blob'
  })
}
// 导入excel文件
export function inputExcel(path, data) {
  return request({
    url: `zsqy/qstag/${path}/import`,
    method: 'post',
    data
  })
}
// 导入ModbusTcp类型变量文件
export function inputExcelModbusTcp(path, data) {
  return request({
    url: `zsqy/qstag/${path}/importModbusTcp`,
    method: 'post',
    data
  })
}
// 查询所有设备地址
export function findAllDrAddr(path) {
  return request({
    url: `zsqy/dlldrinfo/${path}/findDlldrinfo`,
    method: 'get'
  })
}

// 根据设备id查寄存器类型
export function findAllDrllType(path, drid) {
  return request({
    url: `zsqy/dlldrinfo/${path}/findDrlltype`,
    method: 'get',
    params: {
      drid
    }
  })
}

// 查询变量寄存器
export function findQsTag(path, pageCurrent, pageSize, tagname) {
  return request({
    url: `zsqy/qstag/${path}/findObject`,
    method: 'get',
    params: {
      pageCurrent, 
      pageSize,
      tagname
    }
  })
}

// 新增变量寄存器
export function addQsTag(path, data) {
  return request({
    url: `zsqy/qstag/${path}/save`,
    method: 'post',
    data
  })
}

// 修改变量寄存器
export function updateQsTag(path, data) {
  return request({
    url: `zsqy/qstag/${path}/update`,
    method: 'put',
    data
  })
}

// 删除变量寄存器
export function deleteQsTag(path, ids) {
  return request({
    url: `zsqy/qstag/${path}/delete`,
    method: 'delete',
    params: {
      ids
    }
  })
}
// 新增公式
export function updateFormula(path, data) {
  return request({
    url: `/zsqy/qstag/${path}/updateFormula`,
    method: 'put',
    data
  })
}
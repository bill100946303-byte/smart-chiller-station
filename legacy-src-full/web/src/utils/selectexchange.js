// 把下拉框的字转id
export function valToId(object, data) {
  let obj = ""
  if (!isNaN(object) && object != null && object != "null") {
    return object
  } else if (object != "" && object != null && object != "null") {
    data.forEach(ele => {
      if (object == ele.value) {
        obj = ele.id
      }
    });
    return obj
  } else {
    return obj
  }
}
// 把下拉框的id转字
export function idToVal(id, data) {
  let obj = ""
  if (id != null && id != "null" && id !== "") {
    if (!isNaN(parseInt(id))) {
      data.forEach(ele => {
        if (parseInt(id) == ele.id) {
          obj = ele.value
        }
      })
      return obj
    } else {
      return id
    }
  } else {
    return obj
  }
}

// 把null转为""
export function nullToStr(item) {
  if (item === null || item === "null") {
    item = ""
    return item
  } else {
    return item
  }
}

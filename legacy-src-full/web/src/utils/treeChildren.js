// 把得到的子类加给父类
export function getChildren(id, data, treeData) {
  if (data != null && data != "" && data != []) {
    treeData.forEach(ele => {
      if (ele.id === id) {
        ele.children = data
      } else {
        ele.children.forEach(eleChild => {
          if (eleChild.id === id) {
            eleChild.children = data
          } else {
            eleChild.children.forEach(eleChild => {
              if (eleChild.id === id) {
                eleChild.children = data
              }
            })
          }
        })
      }
    })
    console.log(treeData)
  }
  return null
}

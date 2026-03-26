function isValue (value) {
  return value === 0 || !!value;
}
export function handlePost (object) {
  let obj = Object.assign({}, object);
  
  Object.keys(obj).forEach(item => {
    if (!isValue(obj[item])) {
      delete obj[item]
    }
  })
  return obj
}

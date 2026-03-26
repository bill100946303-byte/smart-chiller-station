let theme = {
  dark: {
    color: '#151a23',//主体颜色
    menuText: '#bfcbd9',//侧边栏字体颜色
    menuActiveText: '#000',//侧边栏文字激活颜色
    menuBg: '#151a23',//侧边栏背景颜色
    startbg: "#f4f23f",//侧边栏选中渐变
    endbg: '#84851c',//侧边栏选中渐变
    mainContanerBg: '#000',//主体内容背景颜色，
    contanterBg:'#151a23',
    textColor: '#fff',
    shadow:'#000'
  },
  blue: {
    color: '#1e2e53',
    menuText: '#bfcbd9',
    menuActiveText: '#000',
    menuBg: '#1e2e53',
    startbg: '#2542fe',
    endbg: '#3ca6ff',
    mainContanerBg: '#121f3d',//主体内容背景颜色，
    contanterBg:'#1a294b',
    textColor: '#fff',
    shadow:'#000'
  },
  green: {
    color: '#004a54',
    menuText: '#bfcbd9',
    menuActiveText: '#000',
    menuBg: '#004a54',
    startbg: '#34d3ea',
    endbg: '#2eb4c8',
    mainContanerBg: '#043339',//主体内容背景颜色，
    contanterBg:'#19626c',
    textColor: '#fff',
    shadow:'#000'
  },
  purple: {
    color: '#24274e',
    menuText: '#bfcbd9',
    menuActiveText: '#000',
    menuBg: '#24274e',
    startbg: '#365bdd',
    endbg: '#5d84dc',
    mainContanerBg: '#0F112F',//主体内容背景颜色，
    contanterBg:'#24274e',
    textColor: '#fff',
    shadow:'#000'
  },
  light: {
    color: '#fff',
    menuText: 'rgba(0, 0, 0, 0.85)',
    menuActiveText: '#f4f4f5',
    menuBg: '#fff',
    startbg: '#226fe3',
    endbg: '#17bbed',
    mainContanerBg: '#F2F6FC',//主体内容背景颜色，
    contanterBg:'#fff',
    textColor: '#000',
    shadow:'#eee'
  },
  darkblue: {
    color: '#f66',
    menuText: '#bfcbd9',
    menuActiveText: '#000',
    menuBg: '#1e2e53',
    startbg: '#2542fe',
    endbg: '#3ca6ff',
    mainContanerBg: '#121f3d',//主体内容背景颜色，
    contanterBg:'#1a294b',
    textColor: '#fff',
    shadow:'#000'
  },
}
function getcolor (flag) {
  let obj = {
    sideBarWidth: '210px'
  }

  let themecolor = theme[flag]

  return Object.assign(obj, themecolor)
}
export {
  theme,
  getcolor
}
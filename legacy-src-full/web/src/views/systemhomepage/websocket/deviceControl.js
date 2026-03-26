import store from '@/store'
// 判断设备有没有控制
export function getControl(){
    let info = {
        msgType: "insert",
        userId: this.userid,
        drId: this.structureDrid,
        isEnergy: false,
    };
    this.websocket.sendWS(JSON.stringify(info));
}

//弹窗后不同的菜单-》发送不同的websocket消息
const NavControl = {
    "基本参数":[
        {
            msgType: "insert",
            isEnergy: false,
        }
    ]
}
//根据命令发送消息
export function handelNavControl(name,info){
     
    let nav = NavControl[name];
    
    nav&&nav.forEach(item => {
       
      let sendMsg = Object.assign(info,item);
      store.getters.websocket.sendWS(JSON.stringify(sendMsg));
    });
}
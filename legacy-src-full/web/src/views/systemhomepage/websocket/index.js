import {handleWs} from './handler';
import store from '@/store'

// const wsurl = process.env.VUE_APP_WEBSOCKET;
//const wsurl = "ws://" + window.location.host + '/accesslog/ws/';
// const wsurl = 'ws://127.0.0.1:8098/accesslog/ws/';
// const wsurl = 'ws://8.130.52.195:8098/accesslog/ws/';
// const wsurl = "wss://"+'ln.szgreenenergy.com:8098'+'/accesslog/ws/';
const wsurl = process.env.VUE_APP_BASE_URL_websocket;
// const wsurl = 'ws://8.130.52.195:8098/accesslog/ws/';
// const wsurl = 'ws://120.79.76.75:8098/accesslog/ws/';// 当前线上
export class MySocket {
    constructor(userid, app) {
        this.websocket = null;
        this.url = wsurl + userid + '&' + app + '&' + store.getters.template;
    }
    init() {
        return new Promise((resolve, reject) => {
            this.websocket = new WebSocket(this.url);
            this.websocket.onmessage = this.onmessage.bind(this);
            this.websocket.onopen = this.onopen.bind(this);
            this.websocket.onclose = this.onclose.bind(this);
            this.websocket.onerror = this.onerror.bind(this);
            if (window.websocket) {
                window.websocket.close()
            }
            window.websocket = this.websocket
            resolve(this);//会将MySocket对象传给then()函数，即作为then()的参数。
        })
    }
    onopen() {
        //连接成功时触发
    }
    onmessage(evt) {
        if(evt.data !== 'pong'){
            // 从服务器接受到信息时的回调函数
            handleWs(evt.data);
        }
    }
    onclose(evt){
        /*console.log('websocket需要重新初始化!');
        this.init().then((websocket) => {
            store.commit("websocket/SET_WEBSOCKET", websocket);//这里的websocket就是new出来的MySocket对象本身
        });
        console.log('websocket重新初始化完成!');*/
    }
    onerror(evt){
    }
    sendWS(data) {
        // websocket 发送
        if(this.websocket.readyState != 1){
            this.init().then((websocket) => {
                store.commit("websocket/SET_WEBSOCKET", websocket);//这里的websocket就是new出来的MySocket对象本身
            });
        }
        if(this.websocket.readyState == 1){
            return new Promise((resolve, reject) => {
                this.websocket.send(data);
                resolve()
            })
        }
    }
    closeWs() {
        // 用于关闭websocket连接
        this.websocket.close()
        window.websocket = null;
    }

}

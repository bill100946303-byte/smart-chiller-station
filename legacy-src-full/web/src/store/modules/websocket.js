
import {getWebsocket,setWebsocket} from '@/utils/auth'
const state = {
    websocket: null
    // websocket: getWebsocket()
}

const mutations = {
    SET_WEBSOCKET: (state, info) => {
        state.websocket = info;
        setWebsocket(info)
    },
}

// 实现websocket的连接，需要携带参数token
const actions = {
    
}


export default {
    state,
    mutations,
    actions,
    namespaced: true,
}
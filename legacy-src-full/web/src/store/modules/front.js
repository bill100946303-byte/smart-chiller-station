import {getRunParamsCurve} from "@/api/front/home";

const state = {
    runlist: [],
    runlist2: [],
    subs: [],
    runleft: {
        冷冻水温差: 0,
        冷却水温差: 0,
        冷冻出水温度: 0,
        冷却回水温度: 0,
    },
    runleft2: {
        热水供水温度: 0,
        热水回水温度: 0,
        热水温差: 0,
    },
    navtop: {
        湿球温度: 0,
        室外温度: 0,
        室外湿度: 0,
        露点温度: 0
    },
    totalPower: {
        冷机总功率: 0,
        冷却塔总功率: 0,
        冷冻泵总功率: 0,
        冷却泵总功率: 0,
    },
    HotStationTotalPower: {
        热机实时总功率: 0,
        热水泵实时总功率: 0,
    },
    ontime: {
        实时总功率: 0,
        实时总冷量: 0,
    },
    coldStationCop: 0,
    thermalUnbalanceRate: 0,
    chillerCop: 0,
    chilledWaterPumpCop: 0,
    coolingTowerCop: 0,
    coolingWaterPumpCop: 0,
    baseInfo: [],
    baseInfo2: [],
    dianInfo: [],
    alarmData: {},
    clearAlarmSound: {},
    iframeSelection: "2D",

    ontimeRT: {
        实时总功率: 0,
        实时总冷量: 0,
    },
    ontimeHot: {
        热站实时总功率: 0,
        热站实时总热量: 0,
    },
    coldStationCopRT: 0,
    chillerCopRT: 0,
    chilledWaterPumpCopRT: 0,
    coolingWaterPumpCopRT: 0,
    coolingTowerCopRT: 0,

    coldStationCopHot: 0,
    chillerCopHot: 0,
    chilledWaterPumpCopHot: 0,
};
const mutations = {
    // 记录是2D还是3D
    SET_IFRAMESELECTION: (state, iframeSelection) => {
        state.iframeSelection = iframeSelection;
    },
    setsubs: (state, info) => {
        state.subs = info
    },
    SET_RUN: (state, info) => {
        if (info.length) {
            state.runlist = info.map(item => {
                switch (item.title) {
                    case "冷冻水温差":
                        item.paramType = 4;
                        break;
                    case "冷却水温差":
                        item.paramType = 5;
                        break;
                    case "冷冻出水温度":
                        item.paramType = 6;
                        break;
                    case "冷却回水温度":
                        item.paramType = 7;
                        break;
                }

                return item
            })
        }
    },
    SET_RUN2: (state, info) => {
        // state.runlist2 = info
        if (info.length) {
            state.runlist2 = info.map(item => {
                // console.log('item info',item,state.runlist2)
                switch (item.title) {
                    case "热水供水温度":
                        item.paramType = 164;
                        break;
                    case "热水回水温度":
                        item.paramType = 165;
                        break;
                    case "热水温差":
                        item.paramType = 166;
                        break;
                }
                return item
            })
        }
    },
    SET_RUNLEFT: (state, info) => {
        state.runleft = info;
    },
    SET_RUNLEFT2: (state, info) => {
        state.runleft2 = info;
    },
    SET_NAVTOP: (state, info) => {
        state.navtop = info;
    },
    SET_TOTALPOWER: (state, info) => {
        // console.log(info, "info00000000000");
        state.totalPower = info;
    },
    SET_HOTSTATIONTOTALPOWER: (state, info) => {
        // console.log(info, "info00000000000");
        state.HotStationTotalPower = info;
    },

    SET_ONTIME: (state, info) => {
        state.ontime = info;
    },
    SET_coldStationCop: (state, info) => {
        state.coldStationCop = info;
    },
    SET_thermalUnbalanceRate: (state, info) => {
        state.thermalUnbalanceRate = info;
    },
    SET_chillerCop: (state, info) => {
        state.chillerCop = info;
    },
    SET_chilledWaterPumpCop: (state, info) => {
        state.chilledWaterPumpCop = info;
    },
    SET_coolingTowerCop: (state, info) => {
        state.coolingTowerCop = info;
    },
    SET_coolingWaterPumpCop: (state, info) => {
        state.coolingWaterPumpCop = info;
    },
    SET_baseInfo: (state, info) => {
        state.baseInfo = info;
    },
    SET_baseInfo2: (state, info) => {
        state.baseInfo2 = info;
    },
    SET_dianInfo: (state, info) => {
        state.dianInfo = info;
    },
    SET_alarmData: (state, info) => {
        state.alarmData = info;
    },
    SET_clearAlarmSound: (state, info) => {
        state.clearAlarmSound = info;
    },

    SET_ONTIMERT: (state, info) => {
        state.ontimeRT = info;
    },
    SET_ONTIMEHOT: (state, info) => {
        state.ontimeHot = info;
    },
    SET_coldStationCopRT: (state, info) => {
        state.coldStationCopRT = info;
    },
    SET_COLDSTATIONCOPHOT: (state, info) => {
        state.coldStationCopHot = info;
    },
    SET_chillerCopRT: (state, info) => {
        state.chillerCopRT = info;
    },
    SET_CHILLERCOPHOT: (state, info) => {
        state.chillerCopHot = info;
    },
    SET_chilledWaterPumpCopRT: (state, info) => {
        state.chilledWaterPumpCopRT = info;
    },
    SET_CHILLEDWATERPUMPCOPHOT: (state, info) => {
        state.chilledWaterPumpCopHot = info;
    },
    SET_coolingWaterPumpCopRT: (state, info) => {
        state.coolingWaterPumpCopRT = info;
    },
    SET_coolingTowerCopRT: (state, info) => {
        state.coolingTowerCopRT = info;
    },
    clearWebSocket: (state) => {
        state.runlist = [];
        state.runleft = {
            冷冻水温差: 0,
            冷却水温差: 0,
            冷冻出水温度: 0,
            冷却回水温度: 0,
        };
        state.runleft2 = {
            热水供水温度: 0,
            热水回水温度: 0,
            热水温差: 0,
        };
        state.navtop = {
            湿球温度: 0,
            室外温度: 0,
            室外湿度: 0,
            露点温度: 0
        };
        state.totalPower = {
            冷机总功率: 0,
            冷却塔总功率: 0,
            冷冻泵总功率: 0,
            冷却泵总功率: 0,
        };

        state.HotStationTotalPower = {
            热机实时总功率: 0,
            热水泵实时总功率: 0,
        };
        state.ontime = {
            实时总功率: 0,
            实时总冷量: 0,
        };
        state.coldStationCop = 0;
        state.thermalUnbalanceRate = 0;
        state.chillerCop = 0;
        state.chilledWaterPumpCop = 0;
        state.coolingTowerCop = 0;
        state.coolingWaterPumpCop = 0;
        state.baseInfo = [];
        state.baseInfo2 = [];
        state.dianInfo = [];
        state.alarmData = {};
        state.clearAlarmSound = {};

        state.ontimeRT = {
            实时总功率: 0,
            实时总冷量: 0,
        };
        state.ontimeHot = {
            热站实时总功率: 0,
            热站实时总热量: 0,
        };
        state.coldStationCopRT = 0;
        state.coldStationCopHot = 0;
        state.chillerCopRT = 0;
        state.chillerCopHot = 0;
        state.chilledWaterPumpCopRT = 0;
        state.chilledWaterPumpCopHot = 0;
        state.coolingWaterPumpCopRT = 0;
        state.coolingTowerCopRT = 0;
    },
    clearCenter: (state) => {
        state.baseInfo = [];
        state.baseInfo2 = [];
        state.dianInfo = [];
        state.alarmData = {};
        state.clearAlarmSound = {}
    }
};
const actions = {};
export default {
    namespaced: true,
    state,
    mutations,
    actions,
};

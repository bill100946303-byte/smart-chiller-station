import store from "@/store";

let runleft, runleft2, navtop, ontime, baseInfo, baseInfo2, dianInfo, curvelist, curvelist2, runcoldStationCop,
    runthermalUnbalanceRate, runchillerCop, runchilledWaterPumpCop, runcoolingTowerCop, runcoolingWaterPumpCop,
    ontimeRT, ontimeHot, totalPower, HotStationTotalPower;
const runcode = [4, 5, 6, 7,];
const runcode2 = [164, 165, 166];
// const runcode = [
//   "chilledWaterTemperatureDifference",
//   "chilledOutWaterTemperatureDifference",
//   "coolingRturnWaterTemperature",
//   "coolingWaterTemperature",
// ];
const navcode = [1, 2, 3, 17];
// const navcode = ["DB1.DBD1592", "DB1.DBD1568", "DB1.DBD1572"];//1湿球温度,2室外湿度,3室外温度
const timecoede = [16, 9];
const timecoede2 = [169, 173];
// const timecoede = ["totalPower", "totalCoolingCapacity"];//16实时总功率,9实时总冷量
const rightcode = [10, 11, 12, 13, 14, 15]
// const rightcode = ['coldStationCop', 'thermalUnbalanceRate', 'chillerCop', 'chilledWaterPumpCop', 'coolingTowerCop', 'coolingWaterPumpCop'];//10冷站效率,11热不平衡率,12冷水机组COP,13冷冻水泵COP,14冷却塔COP,15冷却水泵COP
function getParams() {
    runleft = store.getters.runleft;
    runleft2 = store.getters.runleft2;
    navtop = store.getters.navtop;
    ontime = store.getters.ontime;
    baseInfo = store.getters.baseInfo;
    baseInfo2 = store.getters.baseInfo2;
    dianInfo = store.getters.dianInfo;
    curvelist = store.getters.runlist;
    curvelist2 = store.getters.runlist2;
    ontimeRT = store.getters.ontimeRT;
    ontimeHot = store.getters.ontimeHot;
    totalPower = store.getters.totalPower;
    HotStationTotalPower = store.getters.HotStationTotalPower;
}

function handleHome(webdata) {
    // if (store.getters.template == '1'){
    Object.keys(runleft).forEach((item, index) => {
        webdata.forEach(ele => {
            runcode.forEach(eles => {
                if (ele.paramType === eles && item === ele.paramName) {
                    runleft[item] = ele.tagvalue
                }
            })
        })
    });
    // }
    //  if (store.getters.template == '2'){
    Object.keys(runleft2).forEach((item, index) => {
        webdata.forEach(ele => {
            runcode2.forEach(eles => {
                if (ele.paramType === eles && item === ele.paramName) {
                    runleft2[item] = ele.tagvalue
                }
            })
        })
    });
    // }
    Object.keys(navtop).forEach((item, index) => {
        webdata.forEach(ele => {
            navcode.forEach(eles => {
                if (ele.paramType === eles && item === ele.paramName) {
                    navtop[item] = ele.tagvalue
                }
            })
        })
    });
    Object.keys(totalPower).forEach((item, index) => {
        webdata.forEach(ele => {
            if (item === ele.paramName) {
                totalPower[item] = ele.tagvalue
            }
        })
    });
    Object.keys(HotStationTotalPower).forEach((item, index) => {
        webdata.forEach(ele => {
            if (item === ele.paramName) {
                HotStationTotalPower[item] = ele.tagvalue
            }
        })
    });

    Object.keys(ontime).forEach((item, index) => {
        webdata.forEach(ele => {
            timecoede.forEach(eles => {
                if (ele.paramType === eles && item === ele.paramName) {
                    // ontime[item] = ele.tagvalue

                    ontime[item] = ele.tagvalue
                    ontimeRT[item] = ele.tagvalueRT
                }
            })
        })
    });
    Object.keys(ontimeHot).forEach((item, index) => {
        webdata.forEach(ele => {
            timecoede2.forEach(eles => {
                if (ele.paramType === eles && item === ele.paramName) {
                    ontimeHot[item] = ele.tagvalue
                    // ontimeRT[item] = ele.tagvalueRT
                }
            })
        })
    });
    webdata.forEach((element) => {
        if (element.paramType === 10) {
            store.commit("front/SET_coldStationCop", element.tagvalue);
            store.commit("front/SET_coldStationCopRT", element.tagvalueRT);

        } else if (element.paramType === 11) {
            store.commit("front/SET_thermalUnbalanceRate", element.tagvalue);

        } else if (element.paramType === 12) {
                store.commit("front/SET_chillerCop", element.tagvalue);
                store.commit("front/SET_chillerCopRT", element.tagvalueRT);

            } else if (element.paramType === 13) {
                store.commit("front/SET_chilledWaterPumpCop", element.tagvalue);
                store.commit("front/SET_chilledWaterPumpCopRT", element.tagvalueRT);

            } else if (element.paramType === 14) {
                store.commit("front/SET_coolingTowerCop", element.tagvalue);
                store.commit("front/SET_coolingTowerCopRT", element.tagvalueRT);

            } else if (element.paramType === 15) {
            store.commit("front/SET_coolingWaterPumpCop", element.tagvalue);
            store.commit("front/SET_coolingWaterPumpCopRT", element.tagvalueRT);

        } else if (element.paramType === 172) {
            store.commit("front/SET_COLDSTATIONCOPHOT", element.tagvalue);

        } else if (element.paramType === 171) {
            store.commit("front/SET_CHILLERCOPHOT", element.tagvalue);

        } else if (element.paramType === 174) {
            store.commit("front/SET_CHILLEDWATERPUMPCOPHOT", element.tagvalue);

        }
    });
    store.commit("front/SET_RUNLEFT", runleft);
    store.commit("front/SET_RUNLEFT2", runleft2);
    store.commit("front/SET_NAVTOP", navtop);
    store.commit("front/SET_TOTALPOWER", totalPower);
    store.commit("front/SET_HOTSTATIONTOTALPOWER", HotStationTotalPower);
    store.commit("front/SET_ONTIME", ontime);
    store.commit("front/SET_ONTIMERT", ontimeRT);
    store.commit("front/SET_ONTIMEHOT", ontimeHot);
}

function handleBase(webdata) {

    // store.commit("front/SET_baseInfo", webdata);
}
function handleBase2(webdata) {

    // store.commit("front/SET_baseInfo2", webdata);
}

function handleEnergy(webdata) {
    store.commit("front/SET_dianInfo", webdata);
}

function handleChange(webdata) {
    let outarr = [];
    let baseMap = new Map();
    let dianMap = new Map();
    webdata.forEach((item, index) => {
        console.log(item, "item.............");
        if (runcode.includes(item.tagName)) {
            outarr.push(item);
        } else if (runcode2.includes(item.tagName)) {
            outarr.push(item);
        } else if (navcode.includes(item.tagName)) {
            outarr.push(item);
        } else if (timecoede.includes(item.tagName)) {
            outarr.push(item);
        } else if (rightcode.includes(item.tagName)) {
            outarr.push(item);
        } else if (rightcode2.includes(item.tagName)) {
            outarr.push(item);
        }
        if (baseInfo.find((ele) => ele.tagName === item.tagName)) {
            baseMap.set(item.tagName, item.tagValue);
        }
        if (baseInfo2.find((ele) => ele.tagName === item.tagName)) {
            baseMap.set(item.tagName, item.tagValue);
        }
        if (dianInfo.find((ele) => ele.tagName === item.tagName)) {
            dianMap.set(item.tagName, item.tagValue);
        }
    });
    outarr.length && handleHome(outarr);
    if (baseInfo.length) {
        let newBase = baseInfo.map((item) => {
            if (baseMap.has(item.tagName)) {
                item.qstagvalue = baseMap.get(item.tagName);
            }
            return item;
        });
        store.commit("front/SET_baseInfo", newBase);
    }
    if (baseInfo2.length) {
        let newBase = baseInfo.map((item) => {
            if (baseMap.has(item.tagName)) {
                item.qstagvalue = baseMap.get(item.tagName);
            }
            return item;
        });
        store.commit("front/SET_baseInfo2", newBase);
    }

    if (dianInfo.length) {
        let newDian = dianInfo.map((item) => {
            if (dianMap.has(item.tagName)) {
                item.qstagvalue = baseMap.get(item.tagName);
            }
            return item;
        });
        store.commit("front/SET_dianInfo", newDian);
    }
}

function handleCurve(data) {
    console.log(data, "data22222222222222 ");
    // console.log('handleCurve', data)
    if (store.getters.template == '1')
        store.commit("front/SET_RUN", data);

    if (store.getters.template == '2')
        store.commit("front/SET_RUN2", data);
}
function alarmChange(webdata){
    store.commit("front/SET_alarmData", {message: webdata.message, play:webdata.play,repeatKey: webdata.repeatKey });
}

//首页右边数据变化
function handlecurverightDatachange(rightdata) {
    Object.keys(ontime).forEach((item, index) => {
        rightdata.forEach(ele => {
            timecoede.forEach(eles => {
                if (ele.paramType === eles && item === ele.paramName) {
                    ontime[item] = ele.tagvalue
                    ontimeRT[item] = ele.tagvalueRT
                }
            })
        })
    });
    Object.keys(ontimeHot).forEach((item, index) => {
        rightdata.forEach(ele => {
            timecoede2.forEach(eles => {
                // console.log('进来？',ontimeHot,item,ele,eles)
                if (ele.paramType === eles && item === ele.paramName) {
                    ontimeHot[item] = ele.tagvalue
                    // ontimeRT[item] = ele.tagvalueRT
                }
            })
        })
    });
    store.commit("front/SET_ONTIME", ontime);
    store.commit("front/SET_ONTIMERT", ontimeRT);
    store.commit("front/SET_ONTIMEHOT", ontimeHot);
    rightdata.forEach(item => {
        if (item.paramType === 10) {
            store.commit("front/SET_coldStationCop", item.tagvalue);
            store.commit("front/SET_coldStationCopRT", item.tagvalueRT);
        }
        if (item.paramType === 11) {
            store.commit("front/SET_thermalUnbalanceRate", item.tagvalue);
        }
        if (item.paramType === 12) {
            store.commit("front/SET_chillerCop", item.tagvalue);
                store.commit("front/SET_chillerCopRT", item.tagvalueRT);
            }
            if (item.paramType === 13) {
                store.commit("front/SET_chilledWaterPumpCop", item.tagvalue);
                store.commit("front/SET_chilledWaterPumpCopRT", item.tagvalueRT);
            }
        if (item.paramType === 14) {
            store.commit("front/SET_coolingTowerCop", item.tagvalue);
            store.commit("front/SET_coolingTowerCopRT", item.tagvalueRT);
        }
        if (item.paramType === 15) {
            store.commit("front/SET_coolingWaterPumpCop", item.tagvalue);
            store.commit("front/SET_coolingWaterPumpCopRT", item.tagvalueRT);
        }
        if (item.paramType === 172) {
            store.commit("front/SET_COLDSTATIONCOPHOT", item.tagvalue);
        }
        if (item.paramType === 171) {
            store.commit("front/SET_CHILLERCOPHOT", item.tagvalue);
        }
        if (item.paramType === 174) {
            store.commit("front/SET_CHILLEDWATERPUMPCOPHOT", item.tagvalue);
        }
    })
}

//每分钟首页曲线图变化
function handlecurvechange(data) {
    console.log(data, "data1111111111111111");
    data.forEach(item => {
        if (item.tagname === "chilledWaterTemperatureDifference") {
            let arr = (curvelist[0].curveData);
            arr.shift()
            arr.push({
                name: item.time,
                value: item.tagvalue
            })
        } else if (item.tagname === "chilledOutWaterTemperatureDifference") {
            let arr = curvelist[1].curveData
            arr.shift()
            arr.push({
                name: item.time,
                value: item.tagvalue
            })
        } else if (item.tagname === "coolingRturnWaterTemperature") {
            let arr = curvelist[2].curveData
            arr.shift()
            arr.push({
                name: item.time,
                value: item.tagvalue
            })
        } else if (item.tagname === "coolingWaterTemperature") {
            let arr = curvelist[3].curveData
            arr.shift()
            arr.push({
                name: item.time,
                value: item.tagvalue
            })
            // console.log('冷水',arr)
        } else if (item.tagname === "HotSupplyTemperature") {
            let arr = curvelist2[0].curveData
            arr.shift()
            arr.push({
                name: item.time,
                value: item.tagvalue
            })
            // console.log('热水',arr)
        } else if (item.tagname === "HotReturnTemperature") {
            let arr = curvelist2[1].curveData
            arr.shift()
            arr.push({
                name: item.time,
                value: item.tagvalue
            })
        } else if (item.tagname === "HotTemperatureDifference") {
            let arr = curvelist2[2].curveData
            arr.shift()
            arr.push({
                name: item.time,
                value: item.tagvalue
            })
        }
    })
}
export function handleWs(data) {
    getParams();
    if (data) {

        let webdata = JSON.parse(data);
        console.log("webdata", webdata.type, webdata);
        //获取首页左侧的水温差
        switch (webdata.type) {
            case "homePageData":
                handleHome(webdata.data);
                handleCurve(webdata.curve);
                break;
            case "clickBaseParamsPopup":
                console.log('clickBaseParamsPopup',webdata)
                handleBase(webdata.data);
                // if (webdata.data) {
                handleBase2(webdata.data2)
                // }
                break;
            case "clickEnergyDataPopup":
                handleEnergy(webdata.data);
                break;
            case "valueChange":
                handleChange(webdata.data);
                break;
            case "homePageCurveChange":
                console.log("数据来源：", webdata);
                handleHome(webdata.rightdata);
                handlecurvechange(webdata.data);
                handlecurverightDatachange(webdata.rightdata);
                break;
            case "clientOffLineNotice":// 发现网络离线报警
                console.log("离线通知：", webdata);
                alarmChange(webdata)
                break;
            case "clientAlarmNotice":// 设备故障、报警
                console.log("设备故障：", webdata);
                alarmChange(webdata)
                break;
            case "clearClientAlarmNotice":// 消除报警声音
                console.log("消除报警声音：", webdata);
                store.commit("front/SET_clearAlarmSound", {play: webdata.play, repeatKey: webdata.repeatKey});
                break;
            case "homePageHotCurveChange":// 热水
                console.log("热水：", webdata);
                handleHome(webdata.rightdata);
                handlecurvechange(webdata.data);
                handlecurverightDatachange(webdata.rightdata);
                break;
        }
    }
}

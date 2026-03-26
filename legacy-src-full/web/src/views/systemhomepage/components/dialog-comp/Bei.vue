<template>
  <div class="top">
    <div class="control-panel__hero">
      <div>
        <div class="control-panel__eyebrow">Control Center</div>
        <div class="control-panel__title">设备控制</div>
      </div>
      <div class="control-panel__meta">
        <span class="control-panel__chip">{{ controlList.length }} groups</span>
        <span class="control-panel__chip">{{ controlItemCount }} controls</span>
      </div>
    </div>
    <div class="write-box" v-if="false && readAndWriteParams.length">
      <!-- 一键启动-->
      <div class='control' v-if="name.controlName">
        <div class="title">{{ name.controlName }}:</div>
        <div v-for="(item, index) in controlReadAndWriteParams" :key="index" class="dataBtn">
          <el-button :type="item.tagValue" @click="controlClick(item)">
            {{ item.displayName }}
          </el-button>
        </div>
      </div>

      <!-- 一键开关机-->
      <div class='control' v-if="name.onekeyName">
        <div class="title">{{ name.onekeyName }}:</div>
        <div v-for="(item, index) in onekeyReadAndWriteParams" :key="index" class="dataBtn">
          <el-button :type="item.tagValue" @click="controlClick(item)">
            {{ item.displayName }}
          </el-button>
        </div>
      </div>

      <!-- 设备禁用 -->
      <div class="disable" v-if="name.disableName">
        <div class="title">{{ name.disableName }}:</div>
        <div v-for="(item, index) in disableReadAndWriteParams" :key="index" class="dataBtn">
          <el-button :type="item.tagValue" @click="controlClick(item)">{{
              item.displayName
            }}
          </el-button>
        </div>
      </div>

      <!-- 手动控制阀门 -->
      <div class="disable" v-if="name.valveName">
        <div class="title">{{ name.valveName }}:</div>
        <div v-for="(item, index) in valveReadAndWriteParams" :key="index" class="dataBtn">
          <el-button :type="item.tagValue" @click="controlClick(item)">{{
              item.displayName
            }}
          </el-button>
        </div>
      </div>

      <!-- 系统控制模式 -->
      <div class="systemControl" v-if="name.systemControlName">
        <div class="title">{{ name.systemControlName }}:</div>
        <div v-for="(item, index) in systemControlReadAndWriteParams" :key="index" class="dataBtn">
          <el-button :type="item.tagValue" @click="controlClick(item)">{{
              item.displayName
            }}
          </el-button>
        </div>
      </div>
      <div
          class="detail"
          v-for="(item, index) in readAndWriteParams"
          :key="index"
      >
        <div class="title">{{ item.name }}11:</div>
        <div class="right">

          <div v-if="item.isSelect">
            <p v-if="item.arr.length>3">
              <el-select
                  v-model="item.value"
                  placeholder="请选择"
                  @change="changeDisabled($event, item)"
              >
                <el-option
                    v-for="(item, index) in item.arr"
                    :label="item.value"
                    :value="item.value"
                    :key="index"
                ></el-option>
              </el-select>
            </p>

            <el-button
                v-else
                v-for="(item2, index) in item.arr"
                :key="index"
                @click="buttonSubmit(item,item2)"
                :type="item.value == item2.value?'success':''"
            >
              {{ item2.value }}
            </el-button>

            <!--            <el-button-->
            <!--                  type="primary"-->
            <!--                  class="btn"-->
            <!--                  @click="changeReg(item, index)"-->
            <!--                  :disabled="item.isOpen"-->
            <!--                  v-if="item.arr.length>3"-->
            <!--              >-->
            <!--                提交-->
            <!--            </el-button>-->
          </div>
          <div v-if="!item.isSelect">
            <el-input
                v-model="item.value"
                placeholder="请输入"
                  @input="getinputValue($event, item)"
            ></el-input>
          </div>
          <p class="gray-name" v-if="!item.regSub">
            {{ item.regUnits }}
          </p>

          <el-button
              v-if="!item.isSelect || item.arr.length > 3"
              type="primary"
              class="btn"
              @click="changeReg(item, index)"
              :disabled="item.isOpen"
          >
            {{$t('public.submit')}}
<!--            提交-->
          </el-button
          >
        </div>
      </div>
      <div class="status">
        <!-- <div class="btn" @click="open = !open">
          {{ open ? "关闭" : "开启" }}
        </div> -->
        <!-- <div class="btn" @click="changeReg">提交</div> -->
      </div>
    </div>
    <div class="write-box">
      <div v-for="(list, index) in controlList" :key="index">
        <h3>{{ list.groupName }}</h3>
        <div class="content">
          <div class="detail" v-for="(item, index) in list.data" :key="index">
            <div v-if="item.pageDisplay" class="if_pageDisplay">
              <div class="title">{{ item.pageDisplay.name }}:</div>
              <div class="right">
                <div v-if="item.pageDisplay.isSelect">
                  <p v-if="item.pageDisplay.arr.length>3">
                    <el-select
                        v-model="item.pageDisplay.value"
                        placeholder="请选择"
                        @change="changeDisabled($event, item)"
                    >
                      <el-option
                          v-for="(item2, index) in item.pageDisplay.arr"
                          :label="item2.value"
                          :value="item2.value"
                          :key="index"
                      ></el-option>
                    </el-select>
                  </p>

                  <el-button
                      v-else
                      v-for="(item2, index) in item.pageDisplay.arr"
                      :key="index"
                      @click="buttonSubmit(item.pageDisplay,item2)"
                      :type="item.pageDisplay.value == item2.value?'success':''"
                  >
                    {{ item2.value }}
                  </el-button>
                </div>
                <div v-if="!item.pageDisplay.isSelect">
                  <el-input
                      v-model="item.pageDisplay.value"
                      placeholder="请输入"
                      @input="getinputValue($event, item)"
                  ></el-input>
                </div>
                <p class="gray-name" v-if="item.pageDisplay.regUnits">
                  &nbsp;&nbsp;{{ item.pageDisplay.regUnits }}
                </p>

                <el-button
                    v-if="!item.pageDisplay.isSelect || item.pageDisplay.arr.length > 3"
                    type="primary"
                    class="btn"
                    @click="changeReg(item.pageDisplay, index)"
                    :disabled="item.pageDisplay.isOpen"
                >
                  <i class="al_element-icons al_icona-tijiaoshangchuantiqu"></i>
                  {{$t('public.submit')}}
<!--                  提交-->
                </el-button>
              </div>
            </div>
            <div v-else class="if_pageDisplay">
              <div class="title">{{ item.name }}:</div>
              <div class="right">
                <el-button
                    v-for="(item2, index) in item.arr"
                    :key="index"
                    @click="oneButtonControl(item2)"
                    :type="item2.tagValue"
                >
                  {{ item2.displayName }}
                </el-button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import {valToId} from "@/utils/selectexchange";

import {operationRegs} from "@/api/usersetting/devicemonitor/model1";
import {mapGetters} from "vuex";
import {getControl} from "@/utils/auth";

export default {
  props: ["drTypeId", "drId"],
  computed: {
    ...mapGetters(["baseInfo", 'baseInfo2', "path", "userid", "id", "subs", "logo"]),
    controlItemCount() {
      return this.controlList.reduce((total, group) => total + (group.data ? group.data.length : 0), 0);
    },
  },
  data() {
    return {
      control: getControl(),
      open: true,
      readAndWriteParams: [],
      controlReadAndWriteParams: [],// 手动控制
      disableReadAndWriteParams: [],// 禁用数据
      onekeyReadAndWriteParams: [],// 一键开机数据
      systemControlReadAndWriteParams: [],// 系统控制参数
      valveReadAndWriteParams: [],// 手动控制开关阀门
      name: {
        controlName: '',
        disableName: '',
        onekeyName: '',
        systemControlName: '',
        valveName: ''
      },
      controlList: [],
    };
  },
  watch: {
    // baseInfo: {
    //   handler(val) {

    //     if (val) {
    //       this.handleData_副本(val);
    //     }
    //   },
    //   deep: true,
    //   immediate: true,
    // },
    baseInfo2: {
      handler(val) {

        if (val) {
          this.handleData(JSON.parse(JSON.stringify(val)));
        }
      },
      deep: true,
      immediate: true,
    },

    // readAndWriteParams: {
    //   handler(val, newval) {
    //     console.log(val);
    //     console.log(newval);
    //   },
    //   deep: true,
    // },
  },
  created() {
    // console.log(this.control, "control");
  },
  methods: {
    oneButtonControl(val) {
      // console.log(val)
      this.changeReg({
        name: val.name,
        value: val.value,
        tagName: val.tagName
      })
    },
    buttonSubmit(item, item2) {
      item.value = item2.value
      this.changeReg(item)
    },
    controlClick(e) {
      this.changeReg(e)
    },
    // 禁用点击事件
    // disableReadAndWriteParamsClick(e) {
    //   this.changeReg(e)
    // },
    // 手动控制点击事件
    // controlReadAndWriteParamsClick(e) {
    //   // e.value = 1
    //   this.changeReg(e)
    //   // console.log(e)
    // },
    // 点击一键开关
    // onekeyReadAndWriteParamsClick(e) {
    //   this.changeReg(e)
    // },
    getinputValue(i, v) {
      v.pageDisplay.isOpen = false;
    },
    changeDisabled(val, item) {
      item.pageDisplay.isOpen = false;
    },
    handleData(data) {
      // this.readAndWriteParams = [];
      console.log("data", data)
      this.controlList = [];
      let temData = [];
      data.forEach(item => {
        let writearr = [];
        if (item.data.length > 0) {
          item.data.forEach(list => {
            if (list.regReadWrite === "2") {
              writearr.push(list)
            }
          })
          item.data = writearr;
          if (writearr.length > 0) {
            temData.push(item)
          }
        }
        // console.log("writearr", writearr)
      })
      // console.log("整理后的data", temData)
      let paramData = []
      for (let temDatum of temData) {
        let newDataArray = []
        let manualControl = {'name': '手动启停', 'arr': []};// 手动启停
        let manualValve = {'name': '手动阀门', 'arr': []}; // 手动阀门
        let oneButtonSwitch = {'name': '一键开关', 'arr': []};// 一键开关
        let onekeyStartAndStop = {'name': '一键启停', 'arr': []}; // 一键启停
        let systemControlMode = {'name': '系统控制模式', 'arr': []}; // 系统控制模式
        let PHEX = {'name': '板换一键启停', 'arr': []}; // 板换一键启停
        let PHEX_technology = {'name': '板换工艺一键启停', 'arr': []}; // 板换工艺一键启停
        let lowSpeedStart = {'name': '低速启停', 'arr': []}; // 冷却塔低速启停
        let highSpeedStarting = {'name': '高速启停', 'arr': []}; // 冷却塔高速启停
        let fullyAutomatic = {'name': '全自动启停', 'arr': []}; // 全自动启停

        temDatum.data.map((param) => {
          // if (param.regName.includes(param.drname)) {
          //   param.regName = param.regName.slice(
          //       -(param.regName.length - param.drname.length - 1)
          //   );
          // }
          if (param.drname === '冷机系统参数') {
            // console.log('111111')
            param.drname = ''
          } else {
            param.drname += '_'
          }
          // console.log('param',param)
          if (param.regSub) {
            let obj = {
              // name: param.drname + param.regName,
              // name: param.drnameCNEN + param.regNameCNEN,
              name: param.regNameCNEN,
              isSelect: true,
              arr: this.handleParam(param.regSub),
              value: this.handlevalue(param),
              regUnits: param.regUnits,
              tagName: param.tagName,
              isOpen: true,
              tagValue: param.tagValue
            };
            // console.log(obj, "obj");
            param.pageDisplay = obj
            // this.readAndWriteParams.push(obj);
          } else {
            let obj = {
              // name: param.drname + param.regName,
              // name:  param.drnameCNEN + param.regNameCNEN,
              name: param.regNameCNEN,
              isSelect: false,
              isOpen: true,
              value: param.qstagvalue,
              tagName: param.tagName,
              regUnits: param.regUnits,
            };
            // console.log(obj, "elseobj");
            param.pageDisplay = obj
            // this.readAndWriteParams.push(obj);
          }

          if (param.regName.includes('手动启动') || param.regName.includes('手动停止')) {
            param.btnType = ''
            if (param.regName.includes('手动停止')) {
              if (param.tagValue == 1) {
                param.btnType = 'danger'
              }
            } else if (param.regName.includes('手动启动')) {
              if (param.tagValue == 1) {
                param.btnType = 'success'
              }
            }
            let obj = {
              // displayName: param.regName.substr(param.regName.length - 2),
              displayName: param.regNameCNEN,
              // name: param.drname + param.regName,
              name: param.drnameCNEN + param.regNameCNEN,
              regId: param.regId,
              tagName: param.tagName,
              value: 1,
              btn: true,
              tagValue: param.btnType
            }
            console.log('手动', param)
            // manualControl.name = param.drnameCNEN + this.$t('dialog.manualControl')
            manualControl.name = this.$t('dialog.manualControl')
            manualControl.arr.push(obj)

          }
          else if (param.regName.includes('板换工艺一键启动') || param.regName.includes('板换工艺一键停止')) {
            // console.log('板换工艺一键启动', param)
            param.btnType = ''
            if (param.regName.includes('板换工艺一键启动')) {
              if (param.tagValue == 1) {
                param.btnType = 'danger'
              }
            } else if (param.regName.includes('板换工艺一键停止')) {
              if (param.tagValue == 1) {
                param.btnType = 'success'
              }
            }
            let obj = {
              // displayName: param.regName.substr(param.regName.length - 2),
              displayName: param.regNameCNEN,
              // name: param.drname + param.regName,
              name: param.drnameCNEN + param.regNameCNEN,
              regId: param.regId,
              tagName: param.tagName,
              value: 1,
              btn: true,
              tagValue: param.btnType
            }
            // PHEX_technology.name = param.drnameCNEN + this.$t('dialog.PHEX_technology')
            PHEX_technology.name = this.$t('dialog.PHEX_technology')
            PHEX_technology.arr.push(obj)
          }
          else if (param.regName.includes('板换一键启动') || param.regName.includes('板换一键停止')) {
            // console.log('板换一键启动', param)
            param.btnType = ''
            if (param.regName.includes('板换一键启动')) {
              if (param.tagValue == 1) {
                param.btnType = 'danger'
              }
            } else if (param.regName.includes('板换一键停止')) {
              if (param.tagValue == 1) {
                param.btnType = 'success'
              }
            }
            let obj = {
              // displayName: param.regName.substr(param.regName.length - 2),
              displayName: param.regNameCNEN,
              // name: param.drname + param.regName,
              name: param.drnameCNEN + param.regNameCNEN,
              regId: param.regId,
              tagName: param.tagName,
              value: 1,
              btn: true,
              tagValue: param.btnType
            }
            // PHEX.name = param.drnameCNEN + this.$t('dialog.PHEX')
            PHEX.name = this.$t('dialog.PHEX')
            PHEX.arr.push(obj)
          }
          else if (param.regName.includes('手动开阀') || param.regName.includes('手动关阀')) {
            // console.log('手动开阀', param)
            param.btnType = ''
            if (param.regName.includes('手动关阀')) {
              if (param.tagValue == 1) {
                param.btnType = 'danger'
              }
            } else if (param.regName.includes('手动开阀')) {
              if (param.tagValue == 1) {
                param.btnType = 'success'
              }
            }
            let obj = {
              // displayName: param.regName.substr(param.regName.length - 2),
              displayName: param.regNameCNEN,
              // name: param.drname + param.regName,
              name: param.drnameCNEN + param.regNameCNEN,
              regId: param.regId,
              tagName: param.tagName,
              value: 1,
              btn: true,
              tagValue: param.btnType
            }
            // manualValve.name = param.drnameCNEN + this.$t('dialog.manualValve')
            manualValve.name = this.$t('dialog.manualValve')
            manualValve.arr.push(obj)
          }
          else if (param.regName.includes('一键关机') || param.regName.includes('一键开机')) {
            // else if (false) {
            param.btnType = ''
            if (param.regName.includes('一键关机')) {
              if (param.tagValue == 1) {
                param.btnType = 'danger'
              }
            } else if (param.regName.includes('一键开机')) {
              if (param.tagValue == 1) {
                param.btnType = 'success'
              }
            }
            let obj = {
              // displayName: param.regName.substr(param.regName.length - 2),
              displayName: param.regNameCNEN,
              // name: param.drname + param.regName,
              name: param.drnameCNEN + param.regNameCNEN,
              regId: param.regId,
              tagName: param.tagName,
              value: 1,
              btn: true,
              tagValue: param.btnType
            }
            // oneButtonSwitch.name = param.drnameCNEN + this.$t('dialog.oneButtonSwitch')
            oneButtonSwitch.name = this.$t('dialog.oneButtonSwitch')
            oneButtonSwitch.arr.push(obj)
          }
          else if ((param.regName.startsWith('一键') && param.regName.includes('一键启动'))
              || (param.regName.startsWith('一键') && param.regName.includes('一键停止'))) {
            // console.log(param)
            param.btnType = ''
            if (param.regName.includes('一键停止')) {
              if (param.tagValue == 1) {
                param.btnType = 'danger'
              }
            } else if (param.regName.includes('一键启动')) {
              if (param.tagValue == 1) {
                param.btnType = 'success'
              }
            }
            let obj = {
              // displayName: param.regName.substr(param.regName.length - 2),
              displayName: param.regNameCNEN,
              // name: param.drname + param.regName,
              name: param.drnameCNEN + param.regNameCNEN,
              regId: param.regId,
              tagName: param.tagName,
              value: 1,
              btn: true,
              tagValue: param.btnType
            }
            // onekeyStartAndStop.name = param.drnameCNEN + this.$t('dialog.onekeyStartAndStop')
            onekeyStartAndStop.name = this.$t('dialog.onekeyStartAndStop')
            onekeyStartAndStop.arr.push(obj)
          } else if (param.regName.endsWith('全自动启动') || param.regName.endsWith('全自动停止')) {
            console.log('全自动启动', param.regName)
            param.btnType = ''
            if (param.regName.includes('全自动启动')) {
              if (param.tagValue == 1) {
                param.btnType = 'success'
              }
            } else if (param.regName.includes('全自动停止')) {
              if (param.tagValue == 1) {
                param.btnType = 'danger'
              }
            }
            let obj = {
              // displayName: param.regName.substr(param.regName.length - 2),
              displayName: param.regNameCNEN,
              // name: param.drname + param.regName,
              name: param.drnameCNEN + param.regNameCNEN,
              regId: param.regId,
              tagName: param.tagName,
              value: 1,
              btn: true,
              tagValue: param.btnType
            }
            // fullyAutomatic.name = param.drnameCNEN + this.$t('dialog.fullyAutomatic')
            fullyAutomatic.name = this.$t('dialog.fullyAutomatic')
            fullyAutomatic.arr.push(obj)
          } else if (param.regName.includes('低速启动') || param.regName.includes('低速停止')) {
            // console.log('板换一键启动', param)
            param.btnType = ''
            if (param.regName.includes('低速启动')) {
              if (param.tagValue == 1) {
                param.btnType = 'danger'
              }
            } else if (param.regName.includes('低速停止')) {
              if (param.tagValue == 1) {
                param.btnType = 'success'
              }
            }
            let obj = {
              // displayName: param.regName.substr(param.regName.length - 2),
              displayName: param.regNameCNEN,
              // name: param.drname + param.regName,
              name: param.drnameCNEN + param.regNameCNEN,
              regId: param.regId,
              tagName: param.tagName,
              value: 1,
              btn: true,
              tagValue: param.btnType
            }
            // lowSpeedStart.name = param.drnameCNEN + this.$t('dialog.lowSpeedStart')
            lowSpeedStart.name = this.$t('dialog.lowSpeedStart')
            lowSpeedStart.arr.push(obj)
          } else if (param.regName.includes('高速启动') || param.regName.includes('高速停止')) {
            // console.log('板换一键启动', param)
            param.btnType = ''
            if (param.regName.includes('高速启动')) {
              if (param.tagValue == 1) {
                param.btnType = 'danger'
              }
            } else if (param.regName.includes('高速停止')) {
              if (param.tagValue == 1) {
                param.btnType = 'success'
              }
            }
            let obj = {
              // displayName: param.regName.substr(param.regName.length - 2),
              displayName: param.regNameCNEN,
              // name: param.drname + param.regName,
              name: param.drnameCNEN + param.regNameCNEN,
              regId: param.regId,
              tagName: param.tagName,
              value: 1,
              btn: true,
              tagValue: param.btnType
            }
            // highSpeedStarting.name = param.drnameCNEN + this.$t('dialog.highSpeedStarting')
            highSpeedStarting.name = this.$t('dialog.highSpeedStarting')
            highSpeedStarting.arr.push(obj)
          } else if (param.regName.includes('系统控制模式')) {
            // console.log('param', param)
            // let name = param.drname + "_" + param.regName, regId = param.regId, tagName = param.tagName,
            //     tagValue = 'primary'
            let name = param.drnameCNEN + "_" + param.regNameCNEN, regId = param.regId, tagName = param.tagName,
                tagValue = 'primary'
            let obj = {
              displayName: this.$t('dialog.manualMode'),
              value: 0,
              name,
              regId,
              tagName,
              tagValue
            }
            let obj1 = {
              displayName: this.$t('dialog.unitMode'),
              value: 1,
              name,
              regId,
              tagName,
              tagValue
            }
            let obj2 = {
              displayName: this.$t('dialog.fullyAutomaticMode'),
              value: 2,
              name,
              regId,
              tagName,
              tagValue
            }
            // console.log('系统控制模式', param)
            if (param.tagValue == '0' || param.tagValue == '0.0') {
              obj.tagValue = 'success'
            } else if (param.tagValue == '1' || param.tagValue == '1.0') {
              obj1.tagValue = 'success'
            } else if (param.tagValue == '2' || param.tagValue == '2.0') {
              obj2.tagValue = 'success'
            }
            // systemControlMode.name = param.drnameCNEN + this.$t('dialog.systemControlMode')
            systemControlMode.name = this.$t('dialog.systemControlMode')
            systemControlMode.arr.push(obj)
            systemControlMode.arr.push(obj1)
            systemControlMode.arr.push(obj2)
          } else {
            newDataArray.push(param)
          }
        })

        if (manualControl.arr.length > 0)
          newDataArray.push(manualControl)

        if (manualValve.arr.length > 0)
          newDataArray.push(manualValve)

        if (oneButtonSwitch.arr.length > 0)
          newDataArray.push(oneButtonSwitch)

        if (onekeyStartAndStop.arr.length > 0)
          newDataArray.push(onekeyStartAndStop)

        if (fullyAutomatic.arr.length > 0)
          newDataArray.push(fullyAutomatic)

        if (systemControlMode.arr.length > 0)
          newDataArray.push(systemControlMode)

        if (PHEX.arr.length > 0)
          newDataArray.push(PHEX)

        if (PHEX_technology.arr.length > 0)
          newDataArray.push(PHEX_technology)

        if (lowSpeedStart.arr.length > 0)
          newDataArray.push(lowSpeedStart)

        if (highSpeedStarting.arr.length > 0)
          newDataArray.push(highSpeedStarting)

        temDatum.data = newDataArray
        paramData.push(temDatum)
        // console.log(newDataArray)
        // console.log('onekeyStartAndStop', onekeyStartAndStop)
      }
      this.controlList = paramData
      console.log('最终数据', this.controlList)
    },

    handleData_副本(data) {
      return // 这个是之前的代码
      // console.log(data, "设备控制");
      this.readAndWriteParams = [];
      let writearr = [];
      data.forEach((item) => {
        if (item.regReadWrite === "2") {

          writearr.push(item);
        }
      });
      writearr.forEach((param) => {
        if (param.regName.includes(param.drname)) {
          param.regName = param.regName.slice(
              -(param.regName.length - param.drname.length - 1)
          );
        }
        if (param.regSub) {
          let obj = {
            name: param.drname + "_" + param.regName,
            isSelect: true,
            arr: this.handleParam(param.regSub),
            value: this.handlevalue(param),
            regUnits: param.regUnits,
            tagName: param.tagName,
            isOpen: true,
            tagValue: param.tagValue
          };
          // console.log(obj, "obj");
          this.readAndWriteParams.push(obj);
        } else {
          let obj = {
            name: param.drname + "_" + param.regName,
            isSelect: false,
            isOpen: true,
            value: param.qstagvalue,
            tagName: param.tagName,
          };
          // console.log(obj, "elseobj");
          this.readAndWriteParams.push(obj);
        }

        // console.log( "param",param);
        if (param.regName.includes('手动启动') || param.regName.includes('手动停止')) {
          param.btnType = ''
          if (param.regName.includes('手动停止')) {
            if (param.tagValue == 1) {
              param.btnType = 'danger'
            }
          } else if (param.regName.includes('手动启动')) {
            if (param.tagValue == 1) {
              param.btnType = 'success'
            }
          }
          let obj = {
            displayName: param.regName.substr(param.regName.length - 2),
            name: param.drname + "_" + param.regName,
            regId: param.regId,
            tagName: param.tagName,
            value: 1,
            btn: true,
            tagValue: param.btnType
          }
          this.name.controlName = param.drname + '_手动控制'
          // console.log('手动',obj)
          // console.log('手动param',param.regName.substr(param.regName.length-2))
          this.controlReadAndWriteParams.push(obj)
        } else if (param.regName.includes('手动开阀') || param.regName.includes('手动关阀')) {
          param.btnType = ''
          if (param.regName.includes('手动关阀')) {
            if (param.tagValue == 1) {
              param.btnType = 'danger'
            }
          } else if (param.regName.includes('手动开阀')) {
            if (param.tagValue == 1) {
              param.btnType = 'success'
            }
          }
          let obj = {
            displayName: param.regName.substr(param.regName.length - 2),
            name: param.drname + "_" + param.regName,
            regId: param.regId,
            tagName: param.tagName,
            value: 1,
            btn: true,
            tagValue: param.btnType
          }
          this.name.valveName = param.drname + '_手动控制阀门'
          // console.log('手动',obj)
          // console.log('手动param',param.regName.substr(param.regName.length-2))
          this.valveReadAndWriteParams.push(obj)
        } else if (param.regName.includes('设备禁用')) {
          // console.log('param', param)
          let obj = {
            displayName: param.regName.substr(param.regName.length - 2),
            name: param.drname + "_" + param.regName,
            regId: param.regId,
            tagName: param.tagName,
            value: 1,
          }
          let obj2 = {
            displayName: '投用',
            name: param.drname + "_" + param.regName,
            regId: param.regId,
            tagName: param.tagName,
            value: 0,
          }
          if (param.tagValue == '1') {
            obj.tagValue = 'danger'
            obj2.tagValue = ''
          } else if (param.tagValue == '0') {
            obj.tagValue = ''
            obj2.tagValue = 'success'
          }
          this.name.disableName = param.drname + "_" + param.regName
          this.disableReadAndWriteParams.push(obj2)
          this.disableReadAndWriteParams.push(obj)
          // console.log('param', this.disableReadAndWriteParams)

        } else if (param.regName.includes('一键关机') || param.regName.includes('一键开机')) {
          // console.log('1111',param)
          param.btnType = ''
          if (param.regName.includes('一键关机')) {
            if (param.tagValue == 1) {
              param.btnType = 'danger'
            }
          } else if (param.regName.includes('一键开机')) {
            if (param.tagValue == 1) {
              param.btnType = 'success'
            }
          }
          let obj = {
            displayName: param.regName.substr(param.regName.length - 2),
            name: param.drname + "_" + param.regName,
            regId: param.regId,
            tagName: param.tagName,
            value: 1,
            btn: true,
            tagValue: param.btnType
          }
          this.name.onekeyName = param.drname + '_一键开关'
          // console.log('一键开机', obj)
          // console.log('手动param',param.regName.substr(param.regName.length-2))
          this.onekeyReadAndWriteParams.push(obj)

        } else if (param.regName.includes('系统控制模式')) {
          // console.log('param', param)
          let name = param.drname + "_" + param.regName, regId = param.regId, tagName = param.tagName,
              tagValue = 'primary'

          let obj = {
            displayName: '手动模式',
            value: 0,
            name,
            regId,
            tagName,
            tagValue
          }
          let obj1 = {
            displayName: '机组模式',
            value: 1,
            name,
            regId,
            tagName,
            tagValue
          }
          let obj2 = {
            displayName: '全自动模式',
            value: 2,
            name,
            regId,
            tagName,
            tagValue
          }
          console.log('系统控制模式', param)
          if (param.tagValue == '0' || param.tagValue == '0.0') {
            obj.tagValue = 'success'
          } else if (param.tagValue == '1' || param.tagValue == '1.0') {
            obj1.tagValue = 'success'
          } else if (param.tagValue == '2' || param.tagValue == '2.0') {
            obj2.tagValue = 'success'
          }
          this.name.systemControlName = param.regName
          console.log('系统控制模式', this.name.systemControlName)
          this.systemControlReadAndWriteParams.push(obj)
          this.systemControlReadAndWriteParams.push(obj1)
          this.systemControlReadAndWriteParams.push(obj2)
        }

        for (let i = 0; i < this.readAndWriteParams.length; i++) {
          if (this.readAndWriteParams[i].name.includes('手动启动') ||
              this.readAndWriteParams[i].name.includes('设备禁用') ||
              this.readAndWriteParams[i].name.includes('手动停止') ||
              this.readAndWriteParams[i].name.includes('一键开机') ||
              this.readAndWriteParams[i].name.includes('一键关机') ||
              this.readAndWriteParams[i].name.includes('系统控制模式') ||
              this.readAndWriteParams[i].name.includes('手动开阀') ||
              this.readAndWriteParams[i].name.includes('手动关阀')
          ) {
            // console.log('nam饿', this.readAndWriteParams[i])
            this.readAndWriteParams.splice(i, 1)
          }
        }
      });
    },
    handlevalue(param) {
      // console.log(param,"qstag");
      let value;
      this.subs.forEach((sub) => {
        // console.log(sub,"sub");
        if (
            param.regSub &&
            param.regSub == sub.subid &&
            sub.valueType == "1" &&
            param.qstagvalue == sub.value
        ) {
          value = sub.text;
        } else if (
            param.regSub &&
            param.regSub == sub.subid &&
            sub.valueType == "2" &&
            sub.andOr == "1" &&
            param.qstagvalue >= sub.valueMin &&
            param.qstagvalue <= sub.valueMax
        ) {
          value = param.qstagvalue;
        } else if (
            param.regSub &&
            param.regSub == sub.subid &&
            sub.valueType == "2" &&
            sub.andOr == "2" &&
            (param.qstagvalue < sub.valueMin || param.qstagvalue > sub.valueMax)
        ) {
          value = param.qstagvalue;
        }
      });
      // console.log(value,"value");
      return value;
    },
    handleParam(subid) {
      let arr = [];
      this.subs.forEach((ele) => {
        if (ele.subid === parseInt(subid)) {
          let obj = {
            id: ele.value,
            value: ele.text,
          };
          arr.push(obj);
        }
      });
      return arr;
    },
    // 改变读写参数的数值
    changeReg(item, index) {
      //  control: 1 可控
      //  control: 0 不可控
      // console.log(this.control, "control");
      console.log('logo', this.logo)
      console.log('item', item)
      let message = '您确定要修改  “' + item.name + '”  的值为  “' + item.value + '“  吗?'
      let title = '提示：' + this.logo.applogotext
      this.$confirm(message, title, {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        // type: 'warning'
      }).then(() => {
        // if (this.control == 1) {
          let msg = [];
          if (item.tagName != null && item.tagName != "") {
            msg.push(item.name + "|" + valToId(item.value, item.arr) + "|" + item.tagName);
          } else {
            this.$message.warning("该变量没有绑定寄存器，无法控制");
          }
          // console.log(msg)
          // console.log(item)
          if (msg.length != 0) {
            let info = {
              userId: this.userid,
              appId: this.id,
              drTypeId: this.drTypeId,
              drId: this.drId,
              msg: msg.join(","),
            };
            console.log(info)
            operationRegs(this.path, info)
                .then((res) => {
                  if (res.status === 20000) {
                    // console.log(this.path, info)
                    this.$message.success("修改成功！");
                  }
                })
                .catch(console.log);
          }
        // } else {
        //   this.$message.warning("无权限!");
        // }
      }).catch(() => {
      })
    },

    getvalue(item) {
      if (item.isSelect) {
        return item.arr.find((ele) => ele.value == item.value).id;
      } else {
        return item.value;
      }
    },
  },
};
</script>

<style lang="scss" scoped>
.top {
  display: flex;
  flex-direction: column;
  gap: 18px;
  color: rgba(236, 245, 252, 0.92);
}

.control-panel__hero {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding: 18px 20px;
  border-radius: 20px;
  border: 1px solid rgba(124, 202, 255, 0.12);
  background: linear-gradient(180deg, rgba(12, 26, 41, 0.96) 0%, rgba(9, 20, 33, 0.92) 100%);
}

.control-panel__eyebrow {
  font-size: 11px;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: rgba(181, 212, 231, 0.68);
}

.control-panel__title {
  margin-top: 6px;
  font-size: 22px;
  font-weight: 600;
  color: rgba(246, 250, 255, 0.98);
}

.control-panel__meta {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
}

.control-panel__chip {
  display: inline-flex;
  align-items: center;
  padding: 7px 12px;
  border-radius: 999px;
  border: 1px solid rgba(124, 202, 255, 0.12);
  background: rgba(255, 255, 255, 0.05);
  color: rgba(196, 220, 239, 0.74);
  font-size: 12px;
}

.write-box {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.write-box > div {
  padding: 18px;
  border-radius: 20px;
  border: 1px solid rgba(124, 202, 255, 0.12);
  background: linear-gradient(180deg, rgba(12, 26, 41, 0.96) 0%, rgba(9, 20, 33, 0.92) 100%);
}

.write-box h3 {
  margin: 0 0 14px;
  padding: 0;
  font-size: 18px;
  font-weight: 600;
  color: rgba(246, 250, 255, 0.98);
}

.write-box .content {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px 18px;
  padding: 0;
  margin: 0;
  color: rgba(236, 245, 252, 0.92);
}

.write-box .detail {
  min-width: 0;
  margin: 0;
  padding: 16px;
  border-radius: 16px;
  border: 1px solid rgba(124, 202, 255, 0.1);
  background: linear-gradient(180deg, rgba(22, 50, 75, 0.5) 0%, rgba(12, 28, 44, 0.9) 100%);
}

.write-box .if_pageDisplay {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 12px;
}

.write-box .title {
  margin-right: 0;
  font-size: 14px;
  line-height: 1.5;
  color: rgba(214, 230, 242, 0.82);
}

.write-box .right {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
}

.write-box .gray-name {
  display: inline-flex;
  align-items: center;
  color: rgba(188, 216, 232, 0.74);
  font-size: 12px;
}

.write-box .btn {
  margin: 0;
}

.write-box ::v-deep .el-button {
  min-height: 38px;
  border-radius: 12px;
}

.write-box ::v-deep .el-button:not(.el-button--primary) {
  background: rgba(255, 255, 255, 0.05);
  border-color: rgba(124, 202, 255, 0.12);
  color: rgba(236, 245, 252, 0.9);
}

.write-box ::v-deep .el-button--success {
  background: linear-gradient(135deg, #29c7a2 0%, #18b88d 100%);
  border-color: transparent;
  color: #fff;
}

.write-box ::v-deep .el-button--danger {
  background: linear-gradient(135deg, #ff7f8e 0%, #ef5d74 100%);
  border-color: transparent;
  color: #fff;
}

.write-box ::v-deep .el-input__inner,
.write-box ::v-deep .el-select .el-input__inner {
  min-width: 120px;
  height: 38px;
  text-align: center;
  border-radius: 12px;
  border: 1px solid rgba(124, 202, 255, 0.16) !important;
  background: rgba(5, 17, 29, 0.92) !important;
  color: rgba(236, 245, 252, 0.94) !important;
}

@media (max-width: 1280px) {
  .control-panel__hero {
    flex-direction: column;
  }

  .write-box .content {
    grid-template-columns: 1fr;
  }
}
</style>

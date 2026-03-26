<template>
  <el-dialog
      title="修改"
      width="60%"
      :visible.sync="updateDialogFormVisible"
      center
      custom-class="legacy-dialog-shell legacy-settings-dialog"
      :append-to-body="true"
      :destroy-on-close="true"
      :before-close="handleClose"
  >
    <el-form
        :inline="true"
        :model="editForm"
        class="demo-form-inline legacy-front-toolbar__form"
        label-width="120px"
        ref="ruleForm"
        :before-close="handleClose"
    >
      <div class="form-row">
        <el-form-item label="设备类型" prop="drtypenameCNEN" :label="$t('settings.deviceType')">
          <el-input disabled v-model="editForm.drtypenameCNEN"/>
        </el-form-item>
        <el-form-item label="设备名称" prop="drnameCNEN" :label="$t('settings.drname')">
          <el-input disabled v-model="editForm.drnameCNEN"/>
        </el-form-item>
        <el-form-item label="点位名称" prop="tagnameCNEN" :label="$t('settings.pointName')">
          <el-input disabled v-model="editForm.tagnameCNEN"/>
        </el-form-item>
        <el-form-item label="当前值" prop="tagvalue" :label="$t('settings.CurrentValue')">
          <el-input disabled v-model="editForm.tagvalue"/>
        </el-form-item>
        <!--        <el-form-item label="点位地址" prop="itemid" :label="$t('settings.PointAddress')">
                  <el-input disabled v-model="editForm.itemid"/>
                </el-form-item>-->
        <!--        <el-form-item label="单位" prop="units" :label="$t('settings.unit')">-->
        <!--          <el-input disabled v-model="editForm.units"/>-->
        <!--        </el-form-item>-->
        <el-form-item :label="$t('settings.Boolean')" label="布尔变量" prop="boolType">
          <!--          <el-input clearable v-model="editForm.alarmlevel"/>-->
          <el-select
              v-model="editForm.boolType"
              :placeholder="$t('userHomePage.pleaseSelect')"
              placeholder="请选择"
          >
            <el-option
                v-for="item in optionsBoolean"
                :key="item.value"
                :label="item.label"
                :value="item.value"
            >
            </el-option>
          </el-select>
        </el-form-item>
        <!--        <el-form-item label="点位描述" prop="tagdesc" :label="$t('settings.pointDescription')">
                  <el-input disabled v-model="editForm.tagdesc"/>
                </el-form-item>-->
        <el-form-item label="报警等级" prop="alarmlevel" :label="$t('settings.alarmlevel')">
          <!--          <el-input clearable v-model="editForm.alarmlevel"/>-->
          <el-select
              v-model="editForm.alarmlevel"
              placeholder="请选择"
              :placeholder="$t('userHomePage.pleaseSelect')"
              :disabled="alarmlevelDisableds"
          >
            <el-option
                v-for="item in optionsAlarm"
                :key="item.value"
                :label="item.label"
                :value="item.value"
            >
            </el-option>
          </el-select>
        </el-form-item>
        <!--        <el-form-item label="是否报警" prop="alarmtag" :label="$t('settings.alarmOrNot')">
                  &lt;!&ndash;          <el-input clearable v-model="editForm.alarmtag"/>&ndash;&gt;
                  <el-select
                      v-model="editForm.alarmtag"
                      placeholder="请选择"
                      :placeholder="$t('userHomePage.pleaseSelect')"
                  >
                    <el-option
                        v-for="item in optionsAlarmTag"
                        :key="item.value"
                        :label="item.label"
                        :value="item.value"
                    >
                    </el-option>
                  </el-select>
                </el-form-item>-->
        <!--        <el-form-item label="是否禁止" prop="alarmforbid" :label="$t('settings.prohibited')">
                  &lt;!&ndash;          <el-input clearable v-model="editForm.alarmforbid"/>&ndash;&gt;
                  <el-select
                      v-model="editForm.alarmforbid"
                      placeholder="请选择"
                      :placeholder="$t('userHomePage.pleaseSelect')"
                  >
                    <el-option
                        v-for="item in optionsAlarmforbid"
                        :key="item.value"
                        :label="item.label"
                        :value="item.value"
                    >
                    </el-option>
                  </el-select>
                </el-form-item>-->
        <el-form-item label="报警备注" prop="alarmnote" :label="$t('settings.alarmRemarks')">
          <el-input clearable v-model="editForm.alarmnote"/>
        </el-form-item>
        <!-- 保留 -->
        <el-form-item label="报警延时" prop="alarmdelay" :label="$t('settings.alarmdelay')+'（s）'">
          <el-input clearable v-model="editForm.alarmdelay"/>
        </el-form-item>
        <!--        <el-form-item label="" prop="alarmdelay" >
                </el-form-item>-->
        <el-form-item v-if="!disableds" :label="$t('settings.hhValue')" label="高高报设置值" prop="hhValue">
          <el-input clearable :disabled="disableds" v-model="editForm.hhValue"/>
        </el-form-item>
        <!--        <el-form-item label="高高报是否启用" prop="hhUse" :label="$t('settings.hhUse')">
                  &lt;!&ndash;          <el-input clearable v-model="editForm.hhUse"/> &ndash;&gt;
                  <el-select
                      v-model="editForm.hhUse"
                      placeholder="请选择"
                      :placeholder="$t('userHomePage.pleaseSelect')"
                  >
                    <el-option
                        v-for="item in optionsUse"
                        :key="item.value"
                        :label="item.label"
                        :value="item.value"
                    >
                    </el-option>
                  </el-select>
                </el-form-item>-->
        <el-form-item v-if="!disableds" :label="$t('settings.hhAlarmLevel')" label="高高报报警等级" prop="hhAlarmLevel">
          <!--          <el-input clearable v-model="editForm.hhAlarmLevel"/>-->
          <el-select
              v-model="editForm.hhAlarmLevel"
              placeholder="请选择"
              :placeholder="$t('userHomePage.pleaseSelect')"
              :disabled="disableds"
          >
            <el-option
                v-for="item in optionsAlarm"
                :key="item.value"
                :label="item.label"
                :value="item.value"
            >
            </el-option>
          </el-select>
        </el-form-item>

        <el-form-item v-if="!disableds" :label="$t('settings.hvalue')" label="高报设置值" prop="hvalue">
          <el-input clearable :disabled="disableds" v-model="editForm.hvalue"/>
        </el-form-item>
        <!--        <el-form-item label="高报是否启用" prop="huse" :label="$t('settings.huse')">
                  &lt;!&ndash;          <el-input clearable v-model="editForm.huse"/>&ndash;&gt;
                  <el-select
                      v-model="editForm.huse"
                      placeholder="请选择"
                      :placeholder="$t('userHomePage.pleaseSelect')"
                  >
                    <el-option
                        v-for="item in optionsUse"
                        :key="item.value"
                        :label="item.label"
                        :value="item.value"
                    >
                    </el-option>
                  </el-select>
                </el-form-item>-->
        <el-form-item v-if="!disableds" :label="$t('settings.halarmLevel')" label="高报报警等级" prop="halarmLevel">
          <!--          <el-input clearable v-model="editForm.halarmLevel"/>-->
          <el-select
              v-model="editForm.halarmLevel"
              placeholder="请选择"
              :placeholder="$t('userHomePage.pleaseSelect')"
              :disabled="disableds"
          >
            <el-option
                v-for="item in optionsAlarm"
                :key="item.value"
                :label="item.label"
                :value="item.value"
            >
            </el-option>
          </el-select>
        </el-form-item>
        <el-form-item v-if="!disableds" :label="$t('settings.lvalue')" label="低报设置值" prop="lvalue">
          <el-input clearable :disabled="disableds" v-model="editForm.lvalue"/>
        </el-form-item>
        <!--        <el-form-item label="低报是否启用" prop="luse" :label="$t('settings.luse')">
                  &lt;!&ndash;          <el-input clearable v-model="editForm.luse"/>&ndash;&gt;
                  <el-select
                      v-model="editForm.luse"
                      placeholder="请选择"
                      :placeholder="$t('userHomePage.pleaseSelect')"
                  >
                    <el-option
                        v-for="item in optionsUse"
                        :key="item.value"
                        :label="item.label"
                        :value="item.value"
                    >
                    </el-option>
                  </el-select>
                </el-form-item>-->
        <el-form-item v-if="!disableds" :label="$t('settings.lalarmLevel')" label="低报报警等级" prop="lalarmLevel">
          <!--          <el-input clearable v-model="editForm.lalarmLevel"/>-->
          <el-select
              v-model="editForm.lalarmLevel"
              placeholder="请选择"
              :placeholder="$t('userHomePage.pleaseSelect')"
              :disabled="disableds"
          >
            <el-option
                v-for="item in optionsAlarm"
                :key="item.value"
                :label="item.label"
                :value="item.value"
            >
            </el-option>
          </el-select>
        </el-form-item>
        <el-form-item v-if="!disableds" :label="$t('settings.llValue')" label="低低报设置值" prop="llValue">
          <el-input v-model="editForm.llValue" :disabled="disableds" clearable/>
        </el-form-item>
        <!--        <el-form-item label="低低报是否启用" prop="llUse" :label="$t('settings.llUse')">
                  &lt;!&ndash;          <el-input clearable v-model="editForm.llUse"/>&ndash;&gt;
                  <el-select
                      v-model="editForm.llUse"
                      placeholder="请选择"
                      :placeholder="$t('userHomePage.pleaseSelect')"
                  >
                    <el-option
                        v-for="item in optionsUse"
                        :key="item.value"
                        :label="item.label"
                        :value="item.value"
                    >
                    </el-option>
                  </el-select>
                </el-form-item>-->
        <el-form-item v-if="!disableds" :label="$t('settings.llAlarmLevel')" label="低低报报警等级" prop="llAlarmLevel">
          <!--          <el-input clearable v-model="editForm.llAlarmLevel"/>-->
          <el-select
              v-model="editForm.llAlarmLevel"
              :disabled="disableds"
              :placeholder="$t('userHomePage.pleaseSelect')"
              placeholder="请选择"
          >
            <el-option
                v-for="item in optionsAlarm"
                :key="item.value"
                :label="item.label"
                :value="item.value"
            >
            </el-option>
          </el-select>
        </el-form-item>
      </div>
    </el-form>
    <span slot="footer" class="dialog-footer">
         <el-button @click="handleClose">{{ $t('defaultpage.cancellation') }}</el-button>
         <el-button type="primary" @click="submitBook">{{ $t('defaultpage.confirm') }}</el-button>
      </span>
  </el-dialog>
</template>

<script>
import {editAlarmSetting} from "@/api/usersetting/runlog/timealarm";
import {mapGetters} from "vuex";

export default {
  computed: {
    ...mapGetters(["path"]),
  },
  props: {
    updateDialogFormVisible: {
      type: Boolean,
      default: false,
    },
    editFormData: Object
  },
  name: "settingsDialog",
  data() {
    return {
      disableds: false,
      alarmlevelDisableds: false,// 报警等级禁用
      editForm: {},
      optionsUse: [{
        value: 0,
        label: this.$t('settings.notEnabled') //'未启用'
      }, {
        value: 1,
        label: this.$t('settings.Enable')//'启用'
      }],
      optionsAlarm: [{
        value: 0,
        label: this.$t('settings.notAnAlarm') //'不是报警'
      }, {
        value: 1,
        label: this.$t('settings.generalAlarm')//'一般报警'
      }, {
        value: 2,
        label: this.$t('settings.seriousAlarm')//'严重报警'
      }, {
        value: 3,
        label: this.$t('settings.emergencyAlarm')//'紧急报警'
      }],
      optionsAlarmTag: [{
        value: 0,
        label: this.$t('settings.noAlarm')//'不报警'
      }, {
        value: 1,
        label: this.$t('settings.Alarm')//'报警'
      }],
      optionsAlarmforbid: [{
        value: 0,
        label: this.$t('settings.nrohibited')//'不禁止'
      }, {
        value: 1,
        label: this.$t('settings.prohibit')//'禁止'
      }],
      optionsBoolean: [{
        value: 1,
        label: this.$t('settings.yes')
      }, {
        value: 0,
        label: this.$t('settings.no')
      }],
    }
  },
  watch: {
    editFormData(val) {
      this.editForm = this.editFormData
      // if (this.editForm.boolType === 1) {
      //   this.disableds = true
      //   this.alarmlevelDisableds = false
      // } else {
      //   this.disableds = false
      //   this.alarmlevelDisableds = true
      // }
      // console.log('2222', this.editForm.valuetype)
    },
    'editForm.boolType': {
      handler(val) {
        if (this.editForm.boolType === 1) {
          this.disableds = true
          this.alarmlevelDisableds = false
        } else {
          this.disableds = false
          this.alarmlevelDisableds = true
        }
        console.log('111', this.editForm.boolType)
      },
      deep: true,
      immediate: true,
    },
  },
  methods: {
    handleClose(done) {
      this.$emit('close')
      this.$refs.ruleForm.resetFields();
    },
    Closedialog() {
      this.$emit('close')
      this.$refs.ruleForm.resetFields();
    },
    //提交信息
    submitBook() {
      console.log('确定', this.editForm, this.editForm.boolType)
      editAlarmSetting(this.path, this.editForm).then(res => {
        console.log('res', res)
        if (res.msg === "OK") {
          this.$message.success(this.$t('settings.successMsg'));
          this.Closedialog()
          this.$emit('submit')
        }
      }).catch(err => {
        this.$message.error(this.$t('settings.errorMsg'));
      })
    },
  },
}
</script>

<style scoped lang="scss">
.legacy-settings-dialog {
  ::v-deep .el-dialog {
    border-radius: 24px;
  }
}

.form-row {
  width: 100%;
  display: flex;
  //justify-content: center; /* 居中 */
  justify-content: flex-start; /* 居中 */
  align-items: center; /* 在交叉轴上居中 */
  flex-wrap: wrap; /* 超出换行 */

  .el-form-item {
    width: calc(50% - 10px); /* 10px 为项目之间的间隔 */
    margin-right: 10px; /* 右侧间隔 */

    ::v-deep .el-form-item__content {
      width: 202px;
    }
  }


  .el-form-item:last-child {
    margin-right: 0; /* 最后一个项目去掉右侧间隔 */
  }
}

::v-deep .legacy-settings-dialog {
  overflow: hidden;
  border: 1px solid rgba(122, 210, 255, 0.14);
  border-radius: 24px;
  background: linear-gradient(180deg, rgba(8, 20, 34, 0.98) 0%, rgba(10, 24, 39, 0.98) 100%);
  box-shadow: 0 32px 72px rgba(0, 0, 0, 0.38);

  .el-dialog__header {
    padding: 18px 22px;
    border-bottom: 1px solid rgba(122, 210, 255, 0.12);
    background: linear-gradient(90deg, rgba(67, 146, 255, 0.18) 0%, rgba(88, 227, 255, 0.08) 100%);
  }

  .el-dialog__title,
  .el-dialog__headerbtn .el-dialog__close {
    color: rgba(243, 251, 255, 0.94);
  }

  .el-dialog__body {
    padding: 18px 22px 12px;
    color: rgba(220, 234, 244, 0.82);
  }

  .el-dialog__footer {
    padding: 14px 22px 20px;
    border-top: 1px solid rgba(122, 210, 255, 0.12);
  }
}

::v-deep .legacy-front-toolbar__form {
  display: block;
}

::v-deep .legacy-settings-dialog .el-form-item__label {
  color: rgba(223, 236, 245, 0.84);
}

::v-deep .legacy-settings-dialog .el-input__inner,
::v-deep .legacy-settings-dialog .el-select .el-input__inner {
  min-height: 42px;
  border-radius: 12px;
  border-color: rgba(122, 210, 255, 0.14);
  background: rgba(255, 255, 255, 0.04);
  color: rgba(245, 251, 255, 0.96);
}

::v-deep .legacy-settings-dialog .el-input.is-disabled .el-input__inner {
  background: rgba(255, 255, 255, 0.03);
  color: rgba(212, 228, 241, 0.72);
}

::v-deep .legacy-settings-dialog .el-input__icon,
::v-deep .legacy-settings-dialog .el-select__caret {
  color: rgba(191, 220, 236, 0.72);
}

::v-deep .legacy-settings-dialog .el-button--default {
  border-color: rgba(122, 210, 255, 0.14);
  background: rgba(255, 255, 255, 0.04);
  color: rgba(233, 241, 248, 0.86);
}

::v-deep .legacy-settings-dialog .el-button--primary {
  border-color: rgba(78, 184, 238, 0.36);
  background: linear-gradient(135deg, #1c8dc3 0%, #166d9b 100%);
  color: #f5fbff;
}
</style>

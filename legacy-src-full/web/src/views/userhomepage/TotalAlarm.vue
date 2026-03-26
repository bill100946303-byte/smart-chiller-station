<template>
  <div class="total-alarm">
    <div class="tab">
      <div :style="{background: activeIndex == '1'? '#08739a' : '#102136'}" class="box" @click="handleSelect(1)">实时报警
      </div>
      <div :style="{background: activeIndex == '2'? '#08739a' : '#102136'}" class="box" @click="handleSelect(2)">历史报警
      </div>
    </div>
    <div class="total-tobel">
      <div class="total-tobel-box">
        <el-row :gutter="30">
          <el-col :span="24">
            <div class="grid-content bg-purple" style="padding: 10px 30px 0">
              <div>
                （ {{ $t('userHomePage.common') }} <span style="color: #ff0000;font-size: 22px">{{ totalCount }}</span> 个
                ）
                <el-date-picker
                    v-model="alarmTime"
                    :end-placeholder="$t('params.endTimePeriod')"
                    :start-placeholder="$t('public.selectStartTime')"
                    range-separator="-"
                    style="border: none;font-size: 30px; width: 540px;"
                    type="datetimerange"
                    value-format="yyyy-MM-dd HH:mm:ss"
                    @change="findAlarmByTime"
                    prefix-icon="al_element-icons al_icona-huaban1"
                ></el-date-picker>
                <el-select
                    v-model="project"
                    :placeholder="$t('totalalarm.pleaseSelectProject')"
                    clearable
                    @change="findAlarmByProject"
                >
                  <el-option
                      v-for="item in projects"
                      :key="item.appid"
                      :label="item.appexplain"
                      :value="item.appid"
                  ></el-option>
                </el-select>
                <el-select
                    v-model="alarmLevel"
                    :placeholder="$t('totalalarm.pleaseSelectAlarmLevel')"
                    clearable
                    @change="findAlarmByLevel"
                >
                  <el-option
                      v-for="item in alarmLevels"
                      :key="item.id"
                      :label="item.value"
                      :value="item.id"
                  ></el-option>
                </el-select>
                <div class="returnProject" @click="handleSelect(0)">
                  X
                </div>
              </div>

              <div class="contentBox">
                <div class="content">
                  <div v-for="item in tableDatas" class="details">
                    <div class="title">
                      <span>{{ item.regNameEN }}</span>
                      &nbsp;
                      <span :class="`alarmLevel${item.alarmLevel}`">{{ $t('userHomePage.level') }}：{{
                          item.alarmtypename
                        }}</span>
                      <span @click.stop="handleUpdate(item)"><span>{{ $t('userHomePage.operate') }}</span></span>
                    </div>
                    <div class="project">
                      {{ $t('totalalarm.Project') }}：<span>{{ item.appexplain }}</span>
                    </div>
                    <div class="device">
                      {{ $t('prompt.device') }}：<span>{{ item.drnameEN }}</span>
                    </div>
                    <div class="bottom">
                      <div class="left">
                        <div class="time">{{ $t('dialog.alarmTime') }}：{{ item.time }}</div>
                        <div>{{ $t('userHomePage.ParameterValues') }}：{{ item.alarmvalue }}</div>
                      </div>
                      <div class="right">
                        <div class="alarm-illustration" aria-hidden="true"></div>
                      </div>
                    </div>
                  </div>
                </div>
                <el-pagination
                    :current-page="currentPage"
                    :page-size="pageSize"
                    :page-sizes="[10, 20, 30, 40]"
                    :total="totalCount"
                    layout="total, sizes, prev, pager, next, jumper"
                    @size-change="handleSizeChange"
                    @current-change="handleCurrentChange"
                ></el-pagination>
              </div>
              <!--              <el-table
                                v-if="false"
                                :data="tableDatas"
                                style="width: 100%"
                                :row-class-name="tableRowClassName"
                                :default-sort="{ prop: 'date', order: 'descending' }"
                            >
                              <af-table-column prop="time" label="时间" :label="$t('logrizi.time')" sortable/>
                              <af-table-column prop="drname" label="设备名" :label="$t('alertrun_realtime.drname')"/>
                              <af-table-column prop="regName" label="变量名" :label="$t('totalalarm.variableName')"/>
                              <af-table-column prop="alarmvalue" label="参数值" :label="$t('totalalarm.parameterValues')"/>
                              <af-table-column prop="alarmtypename" label="级别" :label="$t('dialog.level')"/>
                              <af-table-column prop="appexplain" label="所属项目" :label="$t('totalalarm.Project')"/>
                              <el-table-column label="应答" :label="$t('totalalarm.response')">
                                <template slot-scope="scope">
                                  <p v-if="scope.row.alarmanswer == '1'">{{ $t('totalalarm.callPolice') }}报警</p>
                                  <p v-if="scope.row.alarmanswer == '2'">{{ $t('totalalarm.falsealarm') }}误报</p>
                                  <p v-if="scope.row.alarmanswer == '3'">{{ $t('totalalarm.test') }}测试</p>
                                </template>
                              </el-table-column>
                              <af-table-column prop="alarmhandle" label="应答说明" :label="$t('totalalarm.responseDescription')"/>
                              <el-table-column fixed="right" label="操作" width="120" :label="$t('alertrun_bill.operate')">
                                <template slot-scope="scope">
                                  <el-button
                                      @click="handleUpdate(scope.$index, scope.row)"
                                      type="text"
                                      size="small"
                                  >{{ $t('userHomePage.pleaseSelect') }}
                                  </el-button
                                  >
                                </template>
                              </el-table-column>
                              &lt;!&ndash;            <af-table-column prop="alarmtypename" label="确认人"/>&ndash;&gt;
                            </el-table>-->

            </div>
            <el-dialog :title="$t('totalalarm.historicalAlarmResponse')" :visible.sync="updateVisible" title="历史报警应答">
              <el-form label-position="left" label-width="100px">
                <el-form-item :label="$t('totalalarm.response')" label="应答">
                  <el-select
                      v-model="editData.alarmanswer"
                      :placeholder="$t('totalalarm.PleaseSelectResponse')"
                      clearable
                  >
                    <el-option
                        v-for="item in respondOptions"
                        :key="item.value"
                        :label="item.value"
                        :value="item.id"
                    ></el-option>
                  </el-select>
                </el-form-item>
                <el-form-item :label="$t('totalalarm.responseDescription')" label="应答说明">
                  <el-input
                      v-model="editData.alarmhandle"
                      :placeholder="$t('userHomePage.pleaseEnter')+$t('totalalarm.responseDescription')"
                      :rows="3"
                      placeholder="请输入应答说明"
                      type="textarea"
                  />
                </el-form-item>
              </el-form>
              <span slot="footer" class="dialog-footer">
            <el-button @click="updateVisible = false">{{ $t('defaultpage.cancellation') }}</el-button>
            <el-button type="primary" @click="updateTrue">{{ $t('defaultpage.confirm') }}</el-button>
          </span>
            </el-dialog>
          </el-col>
        </el-row>
      </div>
    </div>
    <!--    <el-menu
           :default-active="activeIndex"
           mode="vertical"
           @select="handleSelect"
           background-color="#011122"
           text-color="#fff"
       >
         <el-menu-item index="0">{{$t('totalalarm.returnProject')}}</el-menu-item>
         <el-menu-item index="1">{{$t('route.realtime')}}</el-menu-item>
         <el-menu-item index="2">{{$t('totalalarm.historicalAlarm')}}</el-menu-item>
       </el-menu>
      <el-row :gutter="30">
         <el-col :span="24">
           <div class="grid-content bg-purple">
             <div>
               <el-date-picker
                   v-model="alarmTime"
                   type="datetimerange"
                   value-format="yyyy-MM-dd HH:mm:ss"
                   range-separator="&#45;&#45;"
                   :start-placeholder="$t('public.selectStartTime')"
                   :end-placeholder="$t('params.endTimePeriod')"
                   @change="findAlarmByTime"
               ></el-date-picker>
               <el-select
                   v-model="project"
                   :placeholder="$t('totalalarm.pleaseSelectProject')"
                   @change="findAlarmByProject"
                   clearable
               >
                 <el-option
                     v-for="item in projects"
                     :key="item.appid"
                     :label="item.appexplain"
                     :value="item.appid"
                 ></el-option>
               </el-select>
               <el-select
                   v-model="alarmLevel"
                   :placeholder="$t('totalalarm.pleaseSelectAlarmLevel')"
                   @change="findAlarmByLevel"
                   clearable
               >
                 <el-option
                     v-for="item in alarmLevels"
                     :key="item.id"
                     :label="item.value"
                     :value="item.id"
                 ></el-option>
               </el-select>
             </div>

             <el-table
                 :data="tableDatas"
                 style="width: 100%"
                 :row-class-name="tableRowClassName"
                 :default-sort="{ prop: 'date', order: 'descending' }"
             >
               <af-table-column prop="time" label="时间" :label="$t('logrizi.time')" sortable/>
               <af-table-column prop="drname" label="设备名" :label="$t('alertrun_realtime.drname')"/>
               <af-table-column prop="regName" label="变量名" :label="$t('totalalarm.variableName')"/>
               <af-table-column prop="alarmvalue" label="参数值" :label="$t('totalalarm.parameterValues')"/>
               <af-table-column prop="alarmtypename" label="级别" :label="$t('dialog.level')"/>
               <af-table-column prop="appexplain" label="所属项目" :label="$t('totalalarm.Project')"/>
               <el-table-column label="应答" :label="$t('totalalarm.response')">
                 <template slot-scope="scope">
                   <p v-if="scope.row.alarmanswer == '1'">{{$t('totalalarm.callPolice')}}报警</p>
                   <p v-if="scope.row.alarmanswer == '2'">{{$t('totalalarm.falsealarm')}}误报</p>
                   <p v-if="scope.row.alarmanswer == '3'">{{$t('totalalarm.test')}}测试</p>
                 </template>
               </el-table-column>
               <af-table-column prop="alarmhandle" label="应答说明" :label="$t('totalalarm.responseDescription')"/>
               <el-table-column fixed="right" label="操作" width="120" :label="$t('alertrun_bill.operate')">
                 <template slot-scope="scope">
                   <el-button
                       @click="handleUpdate(scope.$index, scope.row)"
                       type="text"
                       size="small"
                   >{{$t('userHomePage.pleaseSelect')}}
                   </el-button
                   >
                 </template>
               </el-table-column>
   &lt;!&ndash;            <af-table-column prop="alarmtypename" label="确认人"/>&ndash;&gt;
             </el-table>
             <el-pagination
                 @size-change="handleSizeChange"
                 @current-change="handleCurrentChange"
                 :current-page="currentPage"
                 :page-sizes="[10, 20, 30, 40]"
                 :page-size="pageSize"
                 layout="total, sizes, prev, pager, next, jumper"
                 :total="totalCount"
             ></el-pagination>
           </div>
           <el-dialog title="历史报警应答" :visible.sync="updateVisible" :title="$t('totalalarm.historicalAlarmResponse')">
             <el-form label-position="left" label-width="100px">
               <el-form-item label="应答" :label="$t('totalalarm.response')">
                 <el-select
                     v-model="editData.alarmanswer"
                     clearable
                     :placeholder="$t('totalalarm.PleaseSelectResponse')"
                 >
                   <el-option
                       v-for="item in respondOptions"
                       :key="item.value"
                       :label="item.value"
                       :value="item.id"
                   ></el-option>
                 </el-select>
               </el-form-item>
               <el-form-item label="应答说明" :label="$t('totalalarm.responseDescription')">
                 <el-input
                     v-model="editData.alarmhandle"
                     type="textarea"
                     :rows="3"
                     placeholder="请输入应答说明"
                     :placeholder="$t('userHomePage.pleaseEnter')+$t('totalalarm.responseDescription')"
                 />
               </el-form-item>
             </el-form>
             <span slot="footer" class="dialog-footer">
               <el-button @click="updateVisible = false">{{$t('defaultpage.cancellation')}}</el-button>
               <el-button type="primary" @click="updateTrue">{{$t('defaultpage.confirm')}}</el-button>
             </span>
           </el-dialog>
         </el-col>
       </el-row>-->
  </div>
</template>
<script>
import {toggleClass} from "@/utils";
import {findProjectByIds, findUserHistoryAlarm, findUserTimeAlarm,} from "@/api/usersetting/userpagehome";
import {updateRespond} from "@/api/usersetting/runlog/historyalarm";
import {formatDate} from "@/utils/index";

export default {
  components: {},
  data() {
    return {
      activeName: 0, // 目前处于哪一个页面
      activeIndex: "1",
      tableDatas: [], // 表格数据
      pieData: [], // 饼图数据
      currentPage: 1, // 当前页
      pageSize: 20,
      totalCount: 0,
      respondOptions: [
        {
          id: 1,
          // value: "报警",
          value: this.$t("totalalarm.callPolice"),
        },
        {
          id: 2,
          // value: "误报",
          value: this.$t("totalalarm.falsealarm"),
        },
        {
          id: 3,
          // value: "测试",
          value: this.$t("totalalarm.test"),
        },
      ], // 应答
      updateVisible: false, // 修改应答弹窗
      editData: "",
      radio: 0,
      pageVisible: false,
      pages: [],
      alarmLevel: "", // 报警级别
      alarmLevels: [
        {
          id: 1,
          // value: "报警级别1",
          value: this.$t('totalalarm.Junior'),
        },
        {
          id: 2,
          // value: "报警级别2",
          value: this.$t('totalalarm.Intermediate'),
        },
        {
          id: 3,
          // value: "报警级别3",
          value: this.$t('totalalarm.Advance'),
        },
        // {
        //   id: 4,
        //   // value: "报警级别4",
        //   value: this.$t('totalalarm.Alarmlevel')+'4',
        // },
        // {
        //   id: 5,
        //   // value: "报警级别5",
        //   value: this.$t('totalalarm.Alarmlevel')+'5',
        // },
        // {
        //   id: 6,
        //   // value: "报警级别6",
        //   value: this.$t('totalalarm.Alarmlevel')+'6',
        // },
        // {
        //   id: 7,
        //   // value: "报警级别7",
        //   value: this.$t('totalalarm.Alarmlevel')+'7',
        // },
        // {
        //   id: 8,
        //   // value: "报警级别8",
        //   value: this.$t('totalalarm.Alarmlevel')+'8',
        // },
        // {
        //   id: 9,
        //   // value: "报警级别9",
        //   value: this.$t('totalalarm.Alarmlevel')+'9',
        // },
        // {
        //   id: 10,
        //   // value: "报警级别10",
        //   value: this.$t('totalalarm.Alarmlevel')+'10',
        // },
      ], // 报警级别选择
      project: "", // 项目
      projects: [], // 项目选择
      alarmTime: "", // 报警时间
    };
  },
  created() {
    this.handleSelect(this.activeIndex);
    // 查询项目
    findProjectByIds(this.$route.query.appids)
        .then((res) => {
          this.projects = res.data;
        })
        .catch(console.log);
  },
  mounted() {
    toggleClass(document.body, "darkblue");
  },
  methods: {
    // 查询历史报警
    findUserHistoryAlarm() {
      let formData = new FormData();
      formData.append("pageCurrent", this.currentPage);
      formData.append("pageSize", this.pageSize);
      formData.append(
          "appids",
          this.project == "" ? this.$route.query.appids : this.project
      );
      formData.append("alarmtypelevel", this.alarmLevel);
      if (
          this.alarmTime != "" &&
          this.alarmTime != null &&
          this.alarmTime != "null"
      ) {
        formData.append("startTime", this.alarmTime[0]);
        formData.append("endTime", this.alarmTime[1]);
      }
      findUserHistoryAlarm(formData)
          .then((res) => {
            this.tableDatas = res.data.records;
            this.totalCount = res.data.rowCount;
            this.tableDatas.forEach((ele) => {
              if (ele.time != null) {
                ele.time = formatDate(ele.time);
              }
            });
          })
          .catch(console.log);
    },

    // 查询实时报警
    findUserTimeAlarm() {
      let formData = new FormData();
      formData.append("pageCurrent", this.currentPage);
      formData.append("pageSize", this.pageSize);
      formData.append(
          "appids",
          this.project == "" ? this.$route.query.appids : this.project
      );
      formData.append("alarmtypelevel", this.alarmLevel);
      if (
          this.alarmTime != "" &&
          this.alarmTime != null &&
          this.alarmTime != "null"
      ) {
        formData.append("startTime", this.alarmTime[0]);
        formData.append("endTime", this.alarmTime[1]);
      }

      findUserTimeAlarm(formData)
          .then((res) => {
            this.tableDatas = res.data.records;
            this.totalCount = res.data.rowCount;
            this.tableDatas.forEach((ele) => {
              if (ele.time != null) {
                ele.time = formatDate(ele.time);
              }
            });
          })
          .catch(console.log);
    },

    handleSelect(key) {
      this.activeIndex = key;
      this.currentPage = 1
      if (key == 0) {
        this.goBack();
      }
      if (key == "1") {
        // 查询实时报警信息
        this.findUserTimeAlarm();
      } else {
        // 查询历史报警信息
        this.findUserHistoryAlarm();
      }
    },
    // 根据时间查询报警信息
    findAlarmByTime() {
      console.log(this.alarmTime);
      this.handleSelect(this.activeIndex);
    },
    // 根据项目查询报警信息
    findAlarmByProject(data) {
      this.project = data;
      this.handleSelect(this.activeIndex);
    },
    // 根据报警级别查询报警信息
    findAlarmByLevel(data) {
      this.alarmLevel = data;
      this.handleSelect(this.activeIndex);
    },
    handleSizeChange(val) {
      this.pageSize = val;
      this.pageNumberChange(this.activeIndex)
      // this.handleSelect(this.activeIndex);
    },
    handleCurrentChange(val) {
      this.currentPage = val;
      this.pageNumberChange(this.activeIndex)
      // this.handleSelect(this.activeIndex);
    },
    pageNumberChange(key) {
      if (key == "1") {
        // 查询实时报警信息
        this.findUserTimeAlarm();
      } else {
        // 查询历史报警信息
        this.findUserHistoryAlarm();
      }
    },
    tableRowClassName({row, rowIndex}) {
      if (row.alarmtypename != null) {
        if (row.alarmtypename.search("高") != -1) {
          return "heigh-warning";
        } else if (row.alarmtypename.search("中") != -1) {
          return "middle-warning";
        } else if (row.alarmtypename.search("低") != -1) {
          return "low-warning";
        }
      } else {
        return "";
      }
    },
    // 更新应答
    // handleUpdate(index, row) {
    handleUpdate(row) {
      this.updateVisible = true;
      this.editData = row;
    },
    // 确认修改应答
    updateTrue() {
      let formData = new FormData();
      formData.append("id", this.editData.id);
      formData.append("alarmanswer", 1);
      formData.append("alarmhandle", this.editData.alarmhandle);
      updateRespond(this.editData.dbname, formData)
          .then((res) => {
            if (res.status === 20000) {
              this.$message.success("修改成功!");
              this.updateVisible = false;
              this.handleSelect(this.activeIndex);
            }
          })
          .catch(console.log);
    },
    // 返回项目管理
    goBack() {
      this.$router.back(-1);
    },
  },
};
</script>
<style lang="scss" scoped>
.total-alarm {
  position: relative;
  display: flex;
  width: 100%;
  .tab {
    width: 100px;
    height: 100vh;
    //border: 1px solid red;
    color: #fff;
    display: flex;
    flex-direction: column; /* 竖排 */
    justify-content: center; /* 纵向居中对齐盒子 */
    align-items: center; /* 横向居中对齐盒子 */
    //gap: 20px; /* 盒子之间的间距 */

    .box {
      width: 100%;
      height: 50%; /* 盒子的高度 */
      display: flex;
      justify-content: center; /* 横向居中对齐文字 */
      align-items: center; /* 纵向居中对齐文字 */
      writing-mode: vertical-rl; /* 文字竖排 */
      text-align: center; /* 文字在盒子中居中 */
      font-size: 30px;
    }
  }

  .total-tobel {
    width: 100%;
    height: 100vh;
    background: #08739a;
    display: flex;
    justify-content: center; /* 水平居中 */
    align-items: center; /* 垂直居中 */

    .total-tobel-box {
      width: 98%;
      height: 95vh;
      border-radius: 20px;
      background: #ffffff;
    }

    .returnProject {
      position: absolute;
      top: 0%;
      right: 2%;
      color: #00c5fd;
      font-size: 50px;
    }
  }

  .contentBox {
    margin-top: 20px;
    width: 100%;
    height: 85vh;
    overflow: auto;

    .content {
      display: flex;
      //justify-content: space-around;
      justify-content: flex-start;
      gap: 10px;
      flex-wrap: wrap;

      .details {
        margin: 10px 0;
        width: calc(25% - 20px);
        height: 26vh;
        border: 2px solid #53d7fd;
        padding: 20px;
        border-radius: 10px;
        font-size: 15px;

        .title {
          display: flex;
          width: 100%;
          align-items: center;

          span:nth-child(1) {
            flex-grow: 0; // 第一个和第二个 span 元素不扩展，占据它们的自然宽度，因此它们会靠在容器的左边
            font-size: 22px;
          }

          span:nth-child(2) {
            flex-grow: 0;
            font-size: 22px;
          }

          span:nth-child(3) {
            flex-grow: 1; /* 第三个 span 元素扩展以填满 .title 容器中剩余的所有可用空间。它会自动推到容器的右边 */
            text-align: right; /* 确保在 span 内的文本对齐到右边 */
            cursor: pointer; // 鼠标经过显示小手
            span {
              display: inline-block;
              font-size: 13px;
              padding: 5px;
              border-radius: 30px;
              width: 55px;
              text-align: center;
              background: #00c5fd;
              color: #fff;
            }
          }

          .alarmLevel1 {
            color: #00c5fd;
          }

          .alarmLevel2 {
            color: #ff9922;
          }

          .alarmLevel3 {
            color: red;
          }
        }

        .project {
          margin-top: 20px;
        }

        .device {
          border-bottom: 2px solid #53d7fd;
          margin-top: 20px;
          padding-bottom: 10px;
        }

        .bottom {
          width: 100%;
          height: 50%;
          //border: 1px solid red;
          display: flex;
          justify-content: space-between;

          .left {
            div {
              margin-top: 20px;
            }
          }

          .right {
            margin-top: 5px;
            width: 30%;
            height: 100%;
            display: flex;
            align-items: center;
            justify-content: center;

            .alarm-illustration {
              width: 100%;
              height: 100%;
              min-height: 120px;
              border-radius: 18px;
              background:
                  radial-gradient(circle at 30% 28%, rgba(84, 199, 255, 0.28) 0%, rgba(84, 199, 255, 0.06) 26%, transparent 48%),
                  radial-gradient(circle at 72% 72%, rgba(11, 124, 255, 0.2) 0%, rgba(11, 124, 255, 0.04) 24%, transparent 42%),
                  linear-gradient(135deg, rgba(10, 30, 49, 0.92) 0%, rgba(16, 66, 96, 0.7) 100%);
              border: 1px solid rgba(133, 184, 255, 0.12);
              box-shadow:
                  inset 0 1px 0 rgba(255, 255, 255, 0.04),
                  0 12px 20px rgba(0, 0, 0, 0.08);
              position: relative;

              &::before {
                content: "";
                position: absolute;
                inset: 14px 16px;
                border-radius: 14px;
                border: 1px dashed rgba(133, 184, 255, 0.18);
              }

              &::after {
                content: "";
                position: absolute;
                width: 54px;
                height: 54px;
                left: 50%;
                top: 50%;
                transform: translate(-50%, -50%);
                border-radius: 50%;
                background: linear-gradient(135deg, rgba(92, 219, 229, 0.92) 0%, rgba(11, 124, 255, 0.84) 100%);
                box-shadow: 0 0 0 10px rgba(92, 219, 229, 0.08);
              }
            }
          }
        }
      }
    }
  }

  .el-menu-item {
    color: #fff !important;
  }

  .el-menu.el-menu--horizontal {
    border: none !important;
  }

  .alarm-btn {
    position: absolute;
    top: 15px;
    left: 10px;
    z-index: 99;
  }

  .el-pagination {
    margin-top: 20px;
    text-align: center;
  }

  .add-dialog {
    .add-content {
      margin: 20px 0;

      .el-input {
        width: 200px;
      }

      .el-textarea {
        width: 400px;
      }
    }
  }
}
</style>
<style lang="scss">
.total-alarm {
  .el-input__inner {
    // 去掉时间选择框的边框
    border: none; /* 去除激活状态下的边框 */
    //box-shadow: none !important; /* 去除激活状态下的阴影 */
    color: #000;
    //font-size: 20px !important;
  }

  //.darkblue .el-date-editor .el-range-input {
  //  color: #000; // placeholder的字体样式
  //  font-size: 20px !important;
  //}
  .el-range-editor--medium .el-range-input {
    color: #000; // placeholder的字体样式
    font-size: 20px;
  }

  .darkblue .el-date-editor .el-range__icon {
    font-size: 22px; // 时间选择框前面的 icon
  }

  //.darkblue .el-input--medium {
  //  font-size: 20px;
  //}
  .el-input--medium {
    font-size: 20px;
  }

  .total-alarm {
    //background: rgba(2, 23, 46, 1);

    .el-row {
      padding: 20px;
    }

    .el-menu {
      padding-left: 40%;
    }

    .el-menu--horizontal > .el-menu-item {
      text-align: center;
      width: 200px;
    }

    // .el-table .heigh-warning {
    //   color: rgb(206, 3, 3);
    // }

    // .el-table .middle-warning {
    //   color: orange;
    // }

    // .el-table .low-warning {
    //   color: blue;
    // }
  }

  .el-form .el-form-item--medium .el-form-item__label {
    padding-left: 30px;
    color: #000;

    //.el-select {
    //  border: 1px solid #000 !important;
    //}
    //
    //.el-textarea__inner {
    //  border: 1px solid #000;
    //}
  }

  .el-form-item {
    .el-form-item__content {
      .el-textarea__inner {
        border: 1px solid #000;
        border-radius: 10px;
      }

      .el-select {
        .el-input {
          .el-input__inner {
            border: 1px solid #000;
            border-radius: 10px;
          }
        }
      }
    }
  }

  .darkblue .el-date-editor .el-range__icon {
    font-size: 25px;
  }
}
</style>

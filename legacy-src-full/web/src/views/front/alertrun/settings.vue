<template>
  <div class="settings front-box-show">
    <div class="legacy-front-page__hero">
      <div>
        <div class="legacy-front-page__eyebrow">Alarm Settings</div>
        <h1 class="legacy-front-page__title">报警参数设置</h1>
        <div class="legacy-front-page__meta">按设备与点位过滤告警阈值，并在表格中直接进入编辑。</div>
      </div>
      <div class="legacy-front-stat-group">
        <div class="legacy-front-stat">
          <div class="legacy-front-stat__label">Rows</div>
          <div class="legacy-front-stat__value">{{ total }}</div>
        </div>
      </div>
    </div>

    <section class="legacy-front-toolbar">
      <div class="legacy-front-toolbar__title">
        <strong>筛选条件</strong>
        <span>设备、设备名和点位名称联合查询</span>
      </div>
      <search @drIdchange="drIdchange" @handleSearch="handleSearch"/>
    </section>

    <section class="legacy-front-table-card settings__table-card">
      <div class="legacy-front-table-card__head">
        <div class="legacy-front-section-title">
          <strong>报警设置列表</strong>
          <span>支持行内编辑</span>
        </div>
      </div>
      <el-table
          v-loading="loading"
          :data="tableDatas"
          :fit="true"
          class="report-search-tabel"
          element-loading-background="rgba(0, 0, 0, 0.8)"
          style="width: 100%"
      >
        <!--        <el-table-column align="center" label="id" prop="tagid"/>-->
        <!--        <el-table-column align="center" label="设备类型" :label="$t('settings.deviceType')" prop="drtypenameCNEN"></el-table-column>-->
        <el-table-column align="center" label="设备名称" :label="$t('settings.drname')" prop="drnameCNEN"></el-table-column>
        <el-table-column align="center" label="点位名称" :label="$t('settings.pointName')"
                         prop="tagnameCNEN"></el-table-column>
        <el-table-column align="center" label="当前值" :label="$t('settings.CurrentValue')"
                         prop="tagvalue"></el-table-column>
        <!--        <el-table-column align="center" label="点位地址" :label="$t('settings.PointAddress')" prop="itemid"></el-table-column>-->
        <!--        <el-table-column align="center" label="单位" :label="$t('settings.unit')" prop="units"></el-table-column>-->
        <!--        <el-table-column align="center" label="点位描述" :label="$t('settings.pointDescription')" prop="tagdesc"></el-table-column>-->
        <!--        <el-table-column align="center" label="报警备注" :label="$t('settings.alarmRemarks')" prop="alarmnote"></el-table-column>-->
        <el-table-column :label="$t('settings.Boolean')" align="center" label="布尔变量" prop="boolType">
          <template slot-scope="scope">
            <div v-if="scope.row.boolType === 1">{{ $t('settings.yes') }}</div>
            <div v-if="scope.row.boolType === 0">{{ $t('settings.no') }}</div>
          </template>
        </el-table-column>
        <!--        <el-table-column align="center" label="是否报警" :label="$t('settings.alarmOrNot')" prop="alarmtag">
                  <template slot-scope="scope">
                    <div v-if="scope.row.alarmtag === 1">{{$t('settings.Alarm')}}</div>
                    <div v-if="scope.row.alarmtag === 0">{{$t('settings.noAlarm')}}</div>
                  </template>
                </el-table-column>
                <el-table-column align="center" label="是否禁止" :label="$t('settings.prohibited')" prop="alarmforbid">
                  <template slot-scope="scope">
                    <div v-if="scope.row.alarmforbid === 1">{{$t('settings.prohibit')}}</div>
                    <div v-if="scope.row.alarmforbid === 0">{{$t('settings.nrohibited')}}</div>
                  </template>
                </el-table-column>-->
        <el-table-column align="center" label="报警等级" :label="$t('settings.alarmlevel')"  prop="alarmlevel">
          <template slot-scope="scope">
            <div>{{ gradeConversion(scope.row.alarmlevel) }}</div>
          </template>
        </el-table-column>
<!--        <el-table-column align="center" label="报警延时" :label="$t('settings.alarmdelay')" prop="alarmdelay"></el-table-column>-->
        <el-table-column align="center" label="高高报设置值" :label="$t('settings.hhValue')" prop="hhValue"></el-table-column>
        <!--        <el-table-column align="center" label="高高报是否启用" :label="$t('settings.hhUse')" prop="hhUse">
                  <template slot-scope="scope">
                    <div v-if="scope.row.hhUse">{{$t('settings.Enable')}}</div>
                    <div v-else>{{$t('settings.notEnabled')}}</div>
                  </template>
                </el-table-column>-->
        <el-table-column align="center" label="高高报报警等级" :label="$t('settings.hhAlarmLevel')" prop="hhAlarmLevel">
          <template slot-scope="scope">
            <div>{{ gradeConversion(scope.row.hhAlarmLevel) }}</div>
          </template>
        </el-table-column>
        <el-table-column align="center" label="低低报设置值" :label="$t('settings.llValue')" prop="llValue"></el-table-column>
<!--        <el-table-column align="center" label="低低报是否启用" :label="$t('settings.llUse')" prop="llUse">
          <template slot-scope="scope">
            <div v-if="scope.row.llUse">{{$t('settings.Enable')}}</div>
            <div v-else>{{$t('settings.notEnabled')}}</div>
          </template>
        </el-table-column>-->
        <el-table-column align="center" label="低低报报警等级" :label="$t('settings.llAlarmLevel')" prop="llAlarmLevel">
          <template slot-scope="scope">
            <div>{{ gradeConversion(scope.row.llAlarmLevel) }}</div>
          </template>
        </el-table-column>
        <el-table-column align="center" label="高报报警等级" :label="$t('settings.halarmLevel')" prop="halarmLevel">
          <template slot-scope="scope">
            <div>{{ gradeConversion(scope.row.halarmLevel) }}</div>
          </template>
        </el-table-column>
        <el-table-column align="center" label="低报设置值" :label="$t('settings.lvalue')" prop="lvalue"></el-table-column>
        <el-table-column align="center" label="高报设置值" :label="$t('settings.hvalue')" prop="hvalue"></el-table-column>
<!--        <el-table-column align="center" label="高报是否启用" :label="$t('settings.huse')" prop="huse">
          <template slot-scope="scope">
            <div v-if="scope.row.huse">{{$t('settings.Enable')}}</div>
            <div v-else>{{$t('settings.notEnabled')}}</div>
          </template>
        </el-table-column>-->
        <el-table-column align="center" label="低报报警等级" :label="$t('settings.lalarmLevel')" prop="lalarmLevel">
          <template slot-scope="scope">
            <div>{{ gradeConversion(scope.row.lalarmLevel) }}</div>
          </template>
        </el-table-column>
<!--        <el-table-column align="center" label="低报是否启用" :label="$t('settings.luse')" prop="luse">
          <template slot-scope="scope">
            <div v-if="scope.row.luse">{{$t('settings.Enable')}}</div>
            <div v-else>{{$t('settings.notEnabled')}}</div>
          </template>
        </el-table-column>-->
        <el-table-column fixed="right" label="操作" :label="$t('alertrun_bill.operate')" width="80">
          <template slot-scope="scope">
            <el-button
                type="success"
                size="mini"
                @click="handelEdit(scope.$index, scope.row)"
            >{{$t('alertrun_bill.edit')}}
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </section>
    <div class="legacy-front-pagination">
      <my-pagination :pageinfo="pageinfo" :total="total" @change="pagechange"/>
    </div>
    <settings-dialog :updateDialogFormVisible="updateDialogFormVisible" :editFormData="editFormData"
                     @close="Closedialog" @submit="initData"/>
  </div>
</template>

<script>
// import {runrecords} from "@/api/front/runrecords";
import {findAllAlarmSetting} from "@/api/usersetting/runlog/timealarm";
import {mapGetters} from "vuex";
import MyPagination from '../components/pagination.vue'
import Search from "./components/settingssearch";
import SettingsDialog from "./components/settingsDialog";

export default {
  inject: ["reload"],
  computed: {
    ...mapGetters(["path"]),
  },
  components: {
    SettingsDialog,
    Search,
    MyPagination
  },
  data() {
    return {
      tableTitle: [], // 表格标题
      tableDatas: [], // 表格数据
      searchParams: {
        drId: "",
        tagNameCN: ''
      }, // 开始时间
      pageinfo: {
        currentPage: 1,
        pageSize: 10
      },
      deviceName: "",
      firstLoad: true,
      total: 0,
      loading: true,
      updateDialogFormVisible: false,
      editFormData: {}
    };
  },
  created() {
  },
  methods: {
    gradeConversion(val) {
      if (val === 0) {
        return this.$t('settings.notAnAlarm')
      } else if (val === 1) {
        return this.$t('settings.generalAlarm')
      } else if (val === 2) {
        return this.$t('settings.seriousAlarm')
      } else if (val === 3) {
        return this.$t('settings.emergencyAlarm')
      }
    },
    Closedialog() {
      this.updateDialogFormVisible = false;
    },
    // 修改
    handelEdit(index, row) {
      this.updateDialogFormVisible = true;
      this.editFormData = JSON.parse(JSON.stringify(row));
      console.log('编辑', row, JSON.parse(JSON.stringify(row)))
    },
    //第一次加载设备名
    drIdchange(info) {
      if (this.firstLoad) {
        this.searchParams.drId = info.drId;
        this.searchParams.drTypeId = info.drTypeId;
        this.firstLoad = false;
        // let day = dayjs().format("YYYY-MM-DD");
        // this.searchParams.startTime = `${day} 00:00:00`;
        // this.searchParams.endTime = `${day} 23:59:59`;
        this.searchParams.pageCurrent = this.pageinfo.currentPage;
        this.searchParams.pageSize = this.pageinfo.pageSize
        this.searchParams.alarmTag = '-1'
        this.searchParams.alarmForbid = '-1'
        console.log('this.searchParams', this.searchParams)
        this.initData();
      }
    },
    //点击查询
    handleSearch(info) {
      console.log('搜索')
      this.searchParams = info;
      this.searchParams.pageSize = this.pageinfo.pageSize
      this.initData()
    },
    pagechange(info) {
      this.pageinfo = info;
      this.searchParams.pageCurrent = this.pageinfo.currentPage;
      this.searchParams.pageSize = this.pageinfo.pageSize
      this.initData()
    },
    initData() {
      console.log('searchParams', this.searchParams)
      findAllAlarmSetting(this.path, this.searchParams).then((res) => {
        // console.log(res)
        this.total = res.data.rowCount // 总条数，总条目数
        this.tableDatas = []
        this.loading = false;
        if (res.data.records.length) {
          this.tableDatas = res.data.records;
        }
      });
    },
  },
};
</script>

<style lang="scss" scoped>
.settings__table-card {
  overflow: visible;
}

.settings__table-card ::v-deep .el-table .cell {
  padding-left: 20px;
  padding-right: 20px;
}
</style>

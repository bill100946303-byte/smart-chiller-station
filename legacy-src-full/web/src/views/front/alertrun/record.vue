<template>
  <div class="record-front front-box-show">
    <section class="legacy-front-toolbar">
      <div class="legacy-front-toolbar__title">
        <strong>历史报警筛选</strong>
        <span>按设备、级别、状态与时间范围检索历史记录</span>
      </div>
      <search @handleSearch="handleSearch" @leadOut="leadOut" />
    </section>

    <section class="legacy-front-table-card">
      <div class="legacy-front-table-card__head">
        <div class="legacy-front-section-title">
          <strong>历史报警列表</strong>
          <span>{{ total }} records</span>
        </div>
      </div>
      <my-table :tableTitle="tableTitle" :tableDatas="tabledata" />
    </section>

    <div class="legacy-front-pagination">
      <my-pagination
        :pageinfo="pageinfo"
        :total="total"
        @change="pagechange"
      />
    </div>
  </div>
</template>
<script>
import Search from "./components/search";
import MyTable from "./components/table";
import MyPagination from "../components/pagination.vue";
import {
  findAllHisAlarm,
  exportTablebyAlarm,
} from "@/api/usersetting/runlog/historyalarm";
import { mapGetters } from "vuex";
import { exportExcel } from "@/utils/excel";

export default {
  components: {
    Search,
    MyTable,
    MyPagination,
  },
  computed: {
    ...mapGetters(["path"]),
  },
  data() {
    return {
      total: 0,
      pageinfo: {
        currentPage: 1,
        pageSize: 10,
      },
      searchParams: {
        alarmtypelevel: "",
        drtypeid: "",
        startTime: "",
        endTime: "",
      },
      tabledata: [],
      timer: null,
      tableTitle: [
        { name: "设备名称", prop: "drname" },
        { name: "报警内容", prop: "alarmexplain" },
        { name: "级别", prop: "alarmtypename" },
        { name: "状态", prop: "alarmstate" },
        { name: "报警时间", prop: "time" },
      ],
    };
  },
  created() {
    this.initData();
  },
  beforeDestroy() {
    this.timer = null;
  },
  methods: {
    initData() {
      findAllHisAlarm(this.path, this.searchParams).then((res) => {
        this.tabledata = res.data.records || [];
        this.total = res.data.rowCount;
      });
    },
    handleSearch(info) {
      this.searchParams = info;
      this.initData();
    },
    pagechange(info) {
      this.pageinfo = info;
      this.searchParams.pageCurrent = this.pageinfo.currentPage;
      this.searchParams.pageSize = this.pageinfo.pageSize;
      this.initData();
    },
    leadOut() {
      exportTablebyAlarm(this.path,this.searchParams)
        .then((res) => {
          const filename = "报警记录.xls";
          exportExcel(res, filename);
        })
        .catch(console.log);
    },
  },
};
</script>

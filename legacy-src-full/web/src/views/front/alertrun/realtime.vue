<template>
  <div class="record-front front-box-show">
    <section class="legacy-front-toolbar">
      <div class="legacy-front-toolbar__title">
        <strong>实时报警筛选</strong>
        <span>聚焦当前报警类型和设备范围</span>
      </div>
      <search @handleSearch="handleSearch"/>
    </section>

    <section class="legacy-front-table-card">
      <div class="legacy-front-table-card__head">
        <div class="legacy-front-section-title">
          <strong>实时报警列表</strong>
          <span>{{ total }} active records</span>
        </div>
      </div>
      <my-table :tableDatas="tabledata" :tableTitle="tableTitle"/>
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
import Search from "./components/realsearch";
import MyTable from "./components/table";
import MyPagination from "../components/pagination.vue";
import {findAllTimeAlarm} from "@/api/usersetting/runlog/timealarm";
import {mapGetters} from "vuex";

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
    this.timer = setInterval(() => {
      this.initData();
    }, 20000);
  },
  beforeDestroy() {
    clearInterval(this.timer);
    this.timer = null;
  },
  methods: {
    initData() {
      findAllTimeAlarm(this.path, this.searchParams).then((res) => {
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
  },
};
</script>

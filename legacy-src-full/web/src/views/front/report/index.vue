<template>
  <div class="report front-box-show">
    <div class="legacy-front-page__hero">
      <div>
        <div class="legacy-front-page__eyebrow">Front Report</div>
        <h1 class="legacy-front-page__title">运行报表</h1>
        <div class="legacy-front-page__meta">按设备和日期查看结构化运行报表，并支持直接导出。</div>
      </div>
      <div class="legacy-front-stat-group">
        <div class="legacy-front-stat">
          <div class="legacy-front-stat__label">Columns</div>
          <div class="legacy-front-stat__value">{{ tableTitle.length }}</div>
        </div>
        <div class="legacy-front-stat">
          <div class="legacy-front-stat__label">Rows</div>
          <div class="legacy-front-stat__value">{{ total }}</div>
        </div>
      </div>
    </div>

    <section class="legacy-front-toolbar">
      <div class="legacy-front-toolbar__title">
        <strong>查询条件</strong>
        <span>筛选设备、时间并导出当前结果</span>
      </div>
      <search @drIdchange="drIdchange" @handleSearch="handleSearch" @leadOut="leadOut"/>
    </section>

    <section class="legacy-front-table-card">
      <div class="legacy-front-table-card__head">
        <div class="legacy-front-section-title">
          <strong>报表结果</strong>
          <span>{{ filename || '当前报表' }}</span>
        </div>
      </div>
      <mytable :tableDatas="tableDatas" :tableTitle="tableTitle" />
    </section>

    <div class="legacy-front-pagination">
      <my-pagination :pageinfo="pageinfo" :total="total" @change="pagechange"/>
    </div>
  </div>
</template>

<script>
import { findAll ,exporttable} from "@/api/front/report";
import { mapGetters } from "vuex";
import Search from "./search.vue";
import Mytable from "./tabel.vue";
import dayjs from "dayjs";
import { exportExcel } from "@/utils/excel";
import MyPagination from "../components/pagination.vue";

export default {
  inject: ["reload"],
  computed: {
    ...mapGetters(["path"]),
  },
  components: {
    Search,
    Mytable,
    MyPagination
  },
  data() {
    return {
      tableTitle: [],
      tableDatas: [],
      searchParams: {
        drId: "",
        startTime: "",
        endTime: "",
      },
      pageinfo:{
        currentPage:1,
        pageSize:10
      },
      deviceName: "",
      firstLoad: true,
      total:0,
      filename:""
    };
  },
  methods: {
    drIdchange(info) {
      if (this.firstLoad) {
        this.searchParams.drId = info;
        this.firstLoad = false;
        const day = dayjs().format("YYYY-MM-DD");
        this.searchParams.startTime = `${day} 00:00:00`;
        this.searchParams.endTime = `${day} 23:59:59`;
        this.searchParams.pageCurrent = this.pageinfo.currentPage;
        this.searchParams.pageSize = this.pageinfo.pageSize;
        this.initData();
      }
    },
    handleSearch(info){
      this.searchParams = info;
      this.searchParams.pageSize = this.pageinfo.pageSize;
      this.initData();
    },
    pagechange(info){
      this.pageinfo = info;
      this.searchParams.pageCurrent = this.pageinfo.currentPage;
      this.searchParams.pageSize = this.pageinfo.pageSize;
      this.initData();
    },
    initData() {
      findAll(this.path, this.searchParams).then((res) => {
        this.tableTitle = [];
        this.tableDatas = [];
        this.total = res.data.rowCount;
        this.filename = res.data2;

        if (res.data.records.length) {
          for (const key in res.data.records[0]) {
            this.tableTitle.push(key);
          }
          this.$nextTick(() => {
            this.tableDatas = res.data.records;
          });
        }
      });
    },
    leadOut() {
      if (this.tableDatas.length !== 0 || this.tableTitle.length !== 0) {
        exporttable(this.path,this.searchParams).then(res=>{
          const filename = this.filename + "报表记录.xls";
          exportExcel(res, filename);
        }).catch((err)=>{
          console.log(err);
        });
      } else {
        this.$message.warning("请选择数据后在导出");
      }
    },
  },
};
</script>

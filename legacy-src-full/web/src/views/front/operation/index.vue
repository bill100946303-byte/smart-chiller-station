<template>
  <div class="record-front front-box-show">
    <div class="legacy-front-page__hero">
      <div>
        <div class="legacy-front-page__eyebrow">Operation Log</div>
        <h1 class="legacy-front-page__title">操作记录</h1>
        <div class="legacy-front-page__meta">按时间和设备类型筛选系统操作记录，快速查看用户行为明细。</div>
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
        <span>聚焦指定时间段和设备类型</span>
      </div>
      <search @handleSearch="handleSearch"/>
    </section>

    <section class="legacy-front-table-card">
      <div class="legacy-front-table-card__head">
        <div class="legacy-front-section-title">
          <strong>记录列表</strong>
          <span>{{ tableDatas.length }} items</span>
        </div>
      </div>
      <my-table :tableTitle="tableTitle" :tableDatas="tableDatas" />
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
import { runrecords } from "@/api/front/operation";
import MyPagination from "../components/pagination.vue";
import { mapGetters } from "vuex";

export default {
  components: {
    Search,
    MyTable,
    MyPagination,
  },
  data() {
    return {
      pageinfo: {
        currentPage: 1,
        pageSize: 10,
      },
      searchParams: {},
      total: 0,
      tableDatas: [],
      tableTitle: [
        { name: "日期" ,prop:"date"},
        { name: "设备类型", prop: "drTypeName" },
        { name: "设备名称", prop: "drName" },
        { name: "用户", prop: "operationPerson" },
        { name: "详情", prop: "details" },
      ],
    };
  },
  computed: {
    ...mapGetters(["path"]),
  },
  created() {
    this.initData();
  },
  methods: {
    handleSearch(info){
      this.searchParams = info;
      this.pageinfo = {
        currentPage: 1,
        pageSize: 10,
      };
      this.initData();
    },
    initData() {
      const obj = Object.assign({}, this.searchParams, this.pageinfo);
      runrecords(this.path, obj).then((res) => {
        this.total = res.data.rowCount;
        this.tableDatas = res.data.records || [];
      });
    },
    pagechange(info) {
      this.pageinfo = info;
      this.initData();
    },
  },
};
</script>

<template>
  <div class="report front-box-show">
    <div class="top">
      <search @drIdchange="drIdchange" @handleSearch="handleSearch"/>
    </div>

    <div class="bottom">
      <el-table
          v-loading="loading"
          :data="tableDatas"
          :fit="true"
          class="report-search-tabel"
          element-loading-background="rgba(0, 0, 0, 0.8)"
          style="width: 100%"
          :header-cell-style="{
            background: 'rgba(19, 115, 153, 1)',
            color: '#fff',
          }"
      >
        <el-table-column align="center" label="操作时间" :label="$t('dialog.operationTime')" prop="date"/>
        <el-table-column align="center" label="操作内容" :label="$t('dialog.operationContent')" prop="details"/>
        <el-table-column align="center" label="操作结果" :label="$t('dialog.operationResults')" prop="operationResult"/>
        <el-table-column align="center" label="操作人" :label="$t('dialog.operator')" prop="operationPerson"/>
      </el-table>
      <my-pagination :pageinfo="pageinfo" :total="total" @change="pagechange"/>
    </div>
  </div>
</template>

<script>
import {runrecords} from "@/api/front/runrecords";
import {mapGetters} from "vuex";
import Search from "./search.vue";
import dayjs from "dayjs";
import MyPagination from '../components/pagination.vue'

export default {
  inject: ["reload"],
  computed: {
    ...mapGetters(["path"]),
  },
  components: {
    Search,
    MyPagination
  },
  data() {
    return {
      tableTitle: [], // 表格标题
      tableDatas: [], // 表格数据
      searchParams: {
        drId: "",
        startTime: "",
        endTime: "",
        // timeSpaceType: 1,
      }, // 开始时间
      pageinfo: {
        currentPage: 1,
        pageSize: 10
      },
      deviceName: "",
      firstLoad: true,
      total: 0,
      loading: true
    };
  },
  created() {
  },
  methods: {
    //第一次加载设备名
    drIdchange(info) {
      if (this.firstLoad) {
        this.searchParams.drId = info.drId;
        this.searchParams.drTypeId = info.drTypeId;
        this.firstLoad = false;
        let day = dayjs().format("YYYY-MM-DD");
        this.searchParams.startTime = `${day} 00:00:00`;
        this.searchParams.endTime = `${day} 23:59:59`;
        this.searchParams.pageCurrent = this.pageinfo.currentPage;
        this.searchParams.pageSize = this.pageinfo.pageSize
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
      runrecords(this.path, this.searchParams).then((res) => {
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
.report {
  .report-search-tabel {
    border: 0.1px solid #878889;
  }

  .top {
    padding: 40px;
    padding-bottom: 8px;

    .operation {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      margin-top: 20px;

      //.margin {
      margin-right: 20px;
      margin-bottom: 20px;

      .el-input {
        width: 200px;
      }

      .el-select {
        width: 150px;
      }

      .btns {
        display: flex;
        align-items: center;
      }
    }
  }

  .bottom {
    padding: 0 40px;

    .tips {
      display: flex;
      align-items: center;
      margin-bottom: 37px;
      font-size: 18px;
      color: #fff;
    }

    .el-table {
      .cell {
        padding-left: 50px;
        padding-right: 50px;
      }
    }
  }
}
</style>

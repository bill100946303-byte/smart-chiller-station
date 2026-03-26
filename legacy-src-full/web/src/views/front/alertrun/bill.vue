<template>
  <div class="bill_page front-box-show">
    <section class="legacy-front-toolbar">
      <div class="legacy-front-toolbar__title">
        <strong>设备台账操作</strong>
        <span>管理台账条目，支持新增、批量删除、导入与导出</span>
      </div>

      <div class="add">
        <el-button type="primary" @click="addBook">
          <i class="al_element-icons2 al_icon2jia"></i>
          {{ $t('alertrun_bill.add') }}
        </el-button>
        <el-button type="danger" @click="deleteBook">
          <i class="al_element-icons2 al_icon2jian2"></i>
          {{ $t('alertrun_bill.delete') }}
        </el-button>
        <div class="set">
          <el-button type="primary">
            <i class="al_element-icons2 al_icon2daoru"></i>
            {{ $t('alertrun_bill.import') }}
          </el-button>
          <input type="file" @input="importtable" ref="fileipt" class="iptup"/>
        </div>
        <el-button type="primary" @click="exporttable">
          <i class="al_element-icons al_icondaochu"></i>
          {{ $t('public.exportData') }}
        </el-button>
      </div>
    </section>

    <section class="legacy-front-table-card">
      <div class="legacy-front-table-card__head">
        <div class="legacy-front-section-title">
          <strong>设备台账</strong>
          <span>{{ total }} items</span>
        </div>
      </div>
      <my-table
        :tableData="tableData"
        @chooseItem="chooseItem"
        @edittable="editComSort"
        @seetable="seetable"
      />
    </section>

    <div class="legacy-front-pagination">
      <my-pagination :pageinfo="pageinfo" :total="total" @change="pagechange"/>
    </div>

    <my-dialog
      :formDataback="formData"
      :isEdit="isEdit"
      :showdialog="showdialog"
      @close="Closedialog"
    />
    <my-drawer :drawer="drawer" :formData="formData" @close="drawer = false"/>
  </div>
</template>

<script>
import MyDialog from "./components/dialog.vue";
import MyTable from "./components/billtable.vue";
import MyDrawer from "./components/mydrawer.vue";
import MyPagination from "../components/pagination.vue";
import { findByPage, deleteinfo, exportByPage, inputimport } from "@/api/front/alarm";
import { exportExcel } from "@/utils/excel";
import { mapGetters } from "vuex";

export default {
  components: {
    MyDialog,
    MyTable,
    MyPagination,
    MyDrawer
  },
  data() {
    return {
      isEdit: false,
      drawer: false,
      formData: {},
      pageinfo: {
        currentPage: 1,
        pageSize: 10
      },
      total: 0,
      tableData: [],
      chooselList: [],
      showdialog: false,
    };
  },
  computed: {
    ...mapGetters(["path"])
  },
  methods: {
    initData() {
      findByPage({ path: this.path, ...this.pageinfo }).then(res => {
        this.total = res.data.rowCount;
        this.tableData = res.data.records || [];
      });
    },
    addBook() {
      this.isEdit = false;
      this.formData = {};
      this.showdialog = true;
    },
    chooseItem(val) {
      this.chooselList = val;
    },
    deleteBook() {
      if (this.chooselList.length === 0) {
        this.$message("请选择删除项");
      } else {
        deleteinfo(this.path, this.chooselList).then(() => {
          this.$message({
            message: "删除成功",
            type: "success"
          });
          this.pageinfo = {
            currentPage: 1,
            pageSize: 10
          };
          this.initData();
        });
      }
    },
    pagechange(info) {
      this.pageinfo = info;
      this.initData();
    },
    importtable() {
      const file = this.$refs.fileipt.files[0];
      const formData = new FormData();
      formData.append("file", file);
      const loading = this.$loading({
        lock: true,
        text: "数据正在导入数据库，请稍等",
        spinner: "el-icon-loading",
        background: "rgba(4, 11, 19, 0.72)",
      });
      inputimport(this.path, formData)
        .then((res) => {
          if (res.status === 20000) {
            loading.close();
            this.$message.success("成功导入数据库!");
            this.initData();
          }
        })
        .catch(() => loading.close());
    },
    exporttable() {
      exportByPage(this.path).then(res => {
        const filename = "设备台账.xls";
        exportExcel(res, filename);
      });
    },
    Closedialog() {
      this.showdialog = false;
      this.initData();
    },
    editComSort(val) {
      this.showdialog = true;
      this.formData = val;
      this.isEdit = true;
    },
    seetable(val) {
      this.drawer = true;
      this.formData = val;
    },
  },
  created() {
    this.initData();
  },
};
</script>

<style lang="scss" scoped>
.add {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.add i {
  margin-right: 6px;
}

.set {
  position: relative;
}

.iptup {
  position: absolute;
  left: 0;
  top: 0;
  width: 100%;
  height: 42px;
  opacity: 0;
}

::v-deep .el-dialog__title {
  color: rgba(47, 178, 247, 1);
}
</style>

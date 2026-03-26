<template>
  <div class="front-box-show workpage">
    <div class="legacy-front-page__hero">
      <div>
        <div class="legacy-front-page__eyebrow">Work Orders</div>
        <h1 class="legacy-front-page__title">工单管理</h1>
        <div class="legacy-front-page__meta">查询、创建、编辑和导出工单，保持运维协同流程清晰可追踪。</div>
      </div>
      <div class="legacy-front-stat-group">
        <div class="legacy-front-stat">
          <div class="legacy-front-stat__label">Orders</div>
          <div class="legacy-front-stat__value">{{ total }}</div>
        </div>
      </div>
    </div>

    <section class="legacy-front-toolbar">
      <div class="legacy-front-toolbar__title">
        <strong>工单筛选与操作</strong>
        <span>支持时间、编号、状态过滤，并可直接新增或导出</span>
      </div>
    <el-form
      :inline="true" 
      :model="formInline"
      class="demo-form-inline legacy-front-toolbar__form"
      ref="formsearch"
    >
      <el-form-item label="开始时间">
        <el-date-picker
          v-model="formInline.startTime"
          type="date"
          value-format="yyyy-MM-dd"
          placeholder="选择日期"
        >
        </el-date-picker>
      </el-form-item>
      <el-form-item label="结束时间">
        <el-date-picker
          v-model="formInline.endTime"
          type="date"
          value-format="yyyy-MM-dd"
          placeholder="选择日期"
        >
        </el-date-picker>
      </el-form-item>
      <el-form-item label="工单单号">
        <el-input
          v-model.number="formInline.id"
          placeholder="请输入单号"
        ></el-input>
      </el-form-item>

      <el-form-item label="工单状态">
        <el-select
          v-model="formInline.state"
          filterable
          clearable
          placeholder="请选择工单状态"
        >
          <el-option
            v-for="(item, index) in statuslist"
            :key="index"
            :label="item.value"
            :value="item.id"
          ></el-option>
        </el-select>
      </el-form-item>
      <el-form-item class="toolbar-actions">
        <el-button class="energy-btn" type="primary" @click="search">
          <i class="al_element-icons al_iconchaxun energy-btn__icon"></i>
          查询
        </el-button>
      </el-form-item>
      
      <el-button
        class="energy-btn energy-btn--secondary"
        type="primary"
        icon="el-icon-plus"
        @click="
          () => {
            Visible = true;
            isEdit = false;
          }
        "
        >新增工单</el-button
      >
      <el-form-item>
        <el-button class="energy-btn" type="info" @click="exportOrder">
          <i class="al_element-icons al_icondaochu energy-btn__icon energy-btn__icon--export"></i>
          导出数据
        </el-button>
      </el-form-item>
    </el-form>
    </section>

    <section class="legacy-front-table-card table-box">
      <div class="legacy-front-table-card__head">
        <div class="legacy-front-section-title">
          <strong>工单列表</strong>
          <span>支持编辑和删除</span>
        </div>
      </div>
      <my-table
        :tableDatas="tableDatas"
        @reload="reloads"
        @edit="handleEdit"
        @slectlist="slectlist"
      />
    </section>

    <div class="legacy-front-pagination bottom-pagination">
      <!-- <el-button type="danger" @click="handleDeletes" icon="el-icon-delete"
        >批量删除</el-button
      > -->
      <pagination @change="papchange" :pageinfo="pageinfo" :total="total" />
    </div>
    <my-dialog
      :Visible="Visible"
      :isEdit="isEdit"
      :id="orderId"
      @reload="reloads"
      @close="closeDialog"
      :editinfo="editinfo"
    />
  </div>
</template>

<script>
import {mapGetters} from "vuex";
import {exportExcel} from "@/utils/excel";
import {deleteOrder, findOrder,} from "@/api/usersetting/deviceoperation/ordermanage";
import {exportwork} from "@/api/front/home";
import MyTable from "./table.vue";
import MyDialog from "./dialog.vue";
import pagination from "../components/pagination";
import {handlePost} from "@/utils/handlepost";

export default {
  inject: ["reload"],
  computed: {
    ...mapGetters(["path", "name"]),
  },
  components: { pagination, MyTable, MyDialog },
  data() {
    return {
      isEdit: false,
      pageinfo: {
        currentPage: 1, // 初始页
        pageSize: 10,
      },
      total: 0,
      acceptManOptions: [], // 派单人选项
      tableDatas: [], // 表格数据
      editData: {}, // 修改单行数据
      Visible: false, // 控制新增弹窗
      orderId: null,
      editinfo: {},
      selectdata: [],
      statuslist: [
        {
          id: 1,
          value: "待处理",
        },
        {
          id: 2,
          value: "处理中",
        },
        {
          id: 3,
          value: "已完成",
        },
      ],
      formInline: {
        id: "",
        state: "",
        startTime: "",
        endTime: "",
      },
      searchForm: {},
    };
  },
  created() {
    // 查询所有工单
    this.findOrders();
  },
  methods: {
    closeDialog(){
      this.Visible = false
    },
    reloads() {
      this.Visible = false;
      this.pageinfo = {
        currentPage: 1, // 初始页
        pageSize: 10,
      };
      this.findOrders();
    },
    slectlist(info) {
      this.selectdata = info;
    },
    papchange(info) {
      this.pageinfo = info;
      this.findOrders();
    },
    handleEdit(info) {
      this.isEdit = true;
      this.Visible = true;
      this.editinfo = info;
    },
    // 查询所有工单
    findOrders() {
      findOrder(
        this.path,
        handlePost(Object.assign(this.searchForm, this.pageinfo))
      )
        .then((res) => {
          this.tableDatas = res.data.records;
          this.total = res.data.rowCount;
        })
        .catch(console.log);
    },
    // 批量删除
    handleDeletes() {
      let ids = [];
      this.selectdata.forEach((ele) => {
        ids.push(ele.id);
      });
      deleteOrder(this.path, ids.join(","))
        .then((res) => {
          const { msg } = res;
          if (msg == "OK") {
            this.$message.success("批量删除成功!");
            this.reload();
          }
        })
        .catch(console.log);
    },
    // 导出工单
    exportOrder() {
      exportwork(this.path).then((res) => {
        const filename = "工单信息" + ".xls";
        exportExcel(res, filename);
      });
    },
    search() {
      this.searchForm = { ...this.formInline };
      this.pageinfo = {
        currentPage: 1, // 初始页
        pageSize: 10,
      };
      this.findOrders();
    },
  },
};
</script>

<style lang="scss" scoped>
::v-deep .el-table__body-wrapper::-webkit-scrollbar {
  width: 8px; // 横向滚动条
  height: 8px; // 纵向滚动条 必写
}
::v-deep .el-table__body-wrapper::-webkit-scrollbar-thumb {
  background-color: #3d3d44;
  border-radius: 3px;
}
.el-table ::-webkit-scrollbar{
  display: inline !important;
}
.table-box {
  overflow: visible;
}

.bottom-pagination {
  margin-top: 18px;
}

.workpage {
  ::v-deep .legacy-front-toolbar__form {
    display: flex;
    flex-wrap: wrap;
    gap: 12px 18px;
    align-items: flex-end;
  }

  ::v-deep .el-form-item {
    margin-bottom: 0;
  }

  ::v-deep .el-form-item__label {
    color: rgba(223, 236, 245, 0.82);
  }

  ::v-deep .el-input__inner,
  ::v-deep .el-select .el-input__inner,
  ::v-deep .el-date-editor .el-input__inner {
    min-height: 42px;
    border-radius: 12px;
    border-color: rgba(122, 210, 255, 0.14);
    background: rgba(255, 255, 255, 0.04);
    color: rgba(245, 251, 255, 0.96);
  }

  ::v-deep .el-input__icon,
  ::v-deep .el-select__caret {
    color: rgba(191, 220, 236, 0.72);
  }
}

.toolbar-actions {
  display: flex;
}

.energy-btn {
  border-color: rgba(78, 184, 238, 0.36);
  background: linear-gradient(135deg, #1c8dc3 0%, #166d9b 100%);
  color: #f5fbff;
}

.energy-btn:hover,
.energy-btn:focus {
  border-color: rgba(107, 202, 245, 0.48);
  background: linear-gradient(135deg, #2298ce 0%, #1a7aa8 100%);
  color: #fff;
}

.energy-btn--secondary {
  background: linear-gradient(135deg, rgba(80, 133, 226, 0.95) 0%, rgba(54, 103, 188, 0.95) 100%);
  border-color: rgba(123, 169, 255, 0.36);
}

.energy-btn__icon {
  margin-right: 6px;
}

.energy-btn__icon--export {
  font-size: 15px;
}
</style>
<style lang="scss">
.workpage{
  .el-form-item__content{
    .el-input{
      width: 160px;
    }
    
  }
}
</style>

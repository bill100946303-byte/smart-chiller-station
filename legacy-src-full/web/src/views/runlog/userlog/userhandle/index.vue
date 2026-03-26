<template>
  <div class="app-container container">
    <el-row :gutter="10">
      <el-col :xs="24" :sm="24" :md="24" :lg="24" :xl="24">
        <div class="grid-content bg-purple-light">
          <p class="title">用户操作记录</p>
          <div class="operation">
            <div class="param">
              <span>用户名:</span>
              <el-input v-model="userName" clearable></el-input>
            </div>
            <div class="param">
              <span>开始时间:</span>
              <el-date-picker
                v-model="startTime"
                type="datetime"
                placeholder="选择开始时间"
              ></el-date-picker>
            </div>
            <div class="param">
              <span>结束时间:</span>
              <el-date-picker
                v-model="endTime"
                type="datetime"
                placeholder="选择结束时间"
              ></el-date-picker>
            </div>
            <div class="btn">
              <el-button type="primary" @click="search">查询</el-button>
            </div>
          </div>
          <el-table
            :data="tableDatas"
            style="width: 100%"
            max-height="600px"
            :default-sort="{ prop: 'date', order: 'descending' }"
          >
            <af-table-column prop="time" label="时间" sortable />
            <af-table-column prop="userName" label="用户名" />
            <af-table-column prop="drTypeName" label="设备类型" />
            <af-table-column prop="drName" label="设备名" />
            <af-table-column prop="regName" label="变量名" />
            <af-table-column prop="regNewvalue" label="变量值" />
          </el-table>
          <div class="el-pagination">
            <div class="btn">
              <button @click="prev">上一页</button>
              <span>{{ currentPage }}</span>
              <button @click="next">下一页</button>
            </div>
            <div>
              <el-pagination
                :current-page="currentPage"
                :page-sizes="[5, 10, 20, 40]"
                :page-size="pagesize"
                layout="total, sizes, jumper"
                :total="rowCount"
                @size-change="handleSizeChange"
                @current-change="handleCurrentChange"
              />
            </div>
          </div>
        </div>
      </el-col>
    </el-row>
  </div>
</template>

<script>
import { mapGetters } from "vuex";
import { findUserHandle, exportTable } from "@/api/usersetting/runlog/userlog";
import { formatDate } from "@/utils/index";
import { exportExcel } from "@/utils/excel";
export default {
  inject: ["reload"],
  computed: {
    ...mapGetters(["path"])
  },
  data () {
    return {
      currentPage: 1, // 初始页
      pagesize: 10,
      rowCount: 0,
      tableDatas: [], // 表格数据
      startTime: "", // 开始时间
      endTime: "", // 结束时间
      userName: "" // 用户名
    };
  },
  created () {
    this.findUserHandle(
      this.path,
      this.currentPage,
      this.pagesize,
      this.startTime,
      this.endTime,
      this.userName
    );
  },
  methods: {
    // 查询所有历史报警信息
    findUserHandle (path, currentPage, pageSize, startTime, endTime, userName) {
      var formData = new FormData();
      formData.append("pageCurrent", currentPage);
      formData.append("pageSize", pageSize);
      if (startTime != "" && startTime != null) {
        formData.append("startTime", startTime);
      }
      if (endTime != "" && endTime != null) {
        formData.append("endTime", endTime);
      }
      formData.append("username", userName);
      findUserHandle(path, formData)
        .then(res => {
          this.rowCount = res.data.rowCount;
          this.tableDatas = res.data.records;
          this.tableDatas.forEach(ele => {
            ele.time = formatDate(ele.time);
          });
        })
        .catch(console.log);
    },
    // 条件查询
    search () {
      this.findUserHandle(
        this.path,
        this.currentPage,
        this.pagesize,
        this.startTime,
        this.endTime,
        this.userName
      );
    },
    // 改变显示页数
    handleSizeChange (size) {
      this.pagesize = size;
      this.currentPage = 1;
      this.findUserHandle(
        this.path,
        this.currentPage,
        this.pagesize,
        this.startTime,
        this.endTime,
        this.userName
      );
    },
    // 跳页
    handleCurrentChange (currentpage) {
      this.currentPage = currentpage;
      if (this.tableDatas.length < this.rowCount) {
        this.findUserHandle(
          this.path,
          this.currentPage,
          this.pagesize,
          this.startTime,
          this.endTime,
          this.userName
        );
      }
    },
    // 上一页
    prev () {
      if (this.currentPage === 1) {
        this.currentPage = 1;
      } else {
        this.currentPage--;
        if (this.tableDatas.length < this.rowCount) {
          this.findUserHandle(
            this.path,
            this.currentPage,
            this.pagesize,
            this.startTime,
            this.endTime,
            this.userName
          );
        }
      }
    },
    // 下一页
    next () {
      const maxPage = Math.ceil(this.rowCount / this.pagesize);
      if (this.currentPage < maxPage) {
        this.currentPage++;
        if (this.tableDatas.length < this.rowCount) {
          this.findUserHandle(
            this.path,
            this.currentPage,
            this.pagesize,
            this.startTime,
            this.endTime,
            this.userName
          );
        }
      }
    }
  }
};
</script>

<style lang="scss" scoped>
.container {
  .el-col {
    border-radius: 4px;
  }
  .bg-purple-light {
    padding: 20px;
    background: var(--theme-color);
    .title {
      font-size: 18px;
      font-weight: bold;
    }
    .operation {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      margin-top: 20px;
      .param {
        margin-bottom: 20px;
        margin-right: 10px;
      }
      .el-select {
        width: 150px;
      }
      .el-input {
        width: 200px;
      }
      .btn {
        display: flex;
        align-items: center;
        margin-bottom: 20px;
        margin-left: 10px;
      }
    }
    .el-pagination {
      display: flex;
      justify-content: center;
      margin-top: 10px;
      text-align: center;
      align-items: center;
      .btn {
        margin-top: 10px;
        padding: 2px 5px;
      }
    }
  }
  .grid-content {
    border-radius: 4px;
    min-height: 36px;
  }
}
</style>

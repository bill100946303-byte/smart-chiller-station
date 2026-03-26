<template>
  <div class="page-shell">
    <main class="panel-card workbench">
      <div class="panel-card__header workbench-header">
        <div>
          <p class="panel-eyebrow">配置中心</p>
          <h2 class="panel-title">能耗参数配置</h2>
        </div>
        <div class="toolbar-actions">
          <el-button type="primary" @click="addVisible = true">新增参数</el-button>
        </div>
      </div>
      <div class="panel-body">
        <el-table :data="tableDatas" border class="analysis-table">
          <af-table-column prop="dayEnergy" label="每天预计产生能耗" />
          <af-table-column prop="drCost" label="设备成本" />
          <af-table-column prop="peopleCost" label="人力成本" />
          <af-table-column prop="carbonParm" label="减少标准碳参数" />
          <af-table-column prop="treeParm" label="相当于植树参数" />
          <af-table-column prop="costParm" label="折合人民币参数" />
          <el-table-column label="操作" width="160">
            <template slot-scope="scope">
              <div class="table-actions">
                <el-button
                  size="mini"
                  plain
                  type="primary"
                  @click="handleEdit(scope.$index, scope.row)"
                >编辑</el-button>
                <el-button
                  size="mini"
                  plain
                  type="danger"
                  @click="handleDelete(scope.$index, scope.row)"
                >删除</el-button>
              </div>
            </template>
          </el-table-column>
        </el-table>
        <div class="pagination-bar">
          <el-pagination
            :current-page="currentPage"
            :page-sizes="[5, 10, 20, 40]"
            :page-size="pageSize"
            layout="total, prev, pager, next, sizes, jumper"
            :total="rowCount"
            background
            @size-change="handleSizeChange"
            @current-change="handleCurrentChange"
          />
        </div>
      </div>
      <el-dialog title="新增能耗参数配置" :visible.sync="addVisible" width="50%">
        <div class="dialog-shell">
          <el-form
            ref="ruleForm"
            :model="ruleForm"
            :rules="rules"
            label-position="left"
            label-width="150px"
            class="config-form"
          >
            <el-form-item label="每天预计产生能耗">
              <el-input v-model="expectDayEnergy" placeholder="请输入每天预计产生能耗" clearable />
            </el-form-item>
            <el-form-item label="设备成本">
              <el-input v-model="deviceCost" placeholder="请输入设备成本" clearable />
            </el-form-item>
            <el-form-item label="人力成本">
              <el-input v-model="peopleCost" placeholder="请输入人力成本" clearable />
            </el-form-item>
            <el-form-item label="减少标碳参数">
              <el-input v-model="reduceCarbon" placeholder="请输入减少标碳参数" clearable />
            </el-form-item>
            <el-form-item label="相当于植树参数">
              <el-input v-model="treePlant" placeholder="请输入相当于植树参数" clearable />
            </el-form-item>
            <el-form-item label="折合人民币参数">
              <el-input v-model="moneyCost" placeholder="请输入折合人民币参数" clearable />
            </el-form-item>
          </el-form>
        </div>
        <span slot="footer" class="dialog-footer">
          <el-button @click="addVisible = false">取 消</el-button>
          <el-button type="primary" @click="handleAdd">确 定</el-button>
        </span>
      </el-dialog>
      <el-dialog title="修改能耗参数配置" :visible.sync="updateVisible" width="50%">
        <div class="dialog-shell">
          <el-form label-position="left" label-width="150px" class="config-form">
            <el-form-item label="每天预计产生能耗">
              <el-input v-model="editData.dayEnergy" placeholder="请输入每天预计产生能耗" clearable />
            </el-form-item>
            <el-form-item label="设备成本">
              <el-input v-model="editData.drCost" placeholder="请输入设备成本" clearable />
            </el-form-item>
            <el-form-item label="人力成本">
              <el-input v-model="editData.peopleCost" placeholder="请输入人力成本" clearable />
            </el-form-item>
            <el-form-item label="减少标碳参数">
              <el-input v-model="editData.carbonParm" placeholder="请输入减少标碳参数" clearable />
            </el-form-item>
            <el-form-item label="相当于植树参数">
              <el-input v-model="editData.treeParm" placeholder="请输入相当于植树参数" clearable />
            </el-form-item>
            <el-form-item label="折合人民币参数">
              <el-input v-model="editData.costParm" placeholder="请输入折合人民币参数" clearable />
            </el-form-item>
          </el-form>
        </div>
        <span slot="footer" class="dialog-footer">
          <el-button @click="updateVisible = false">取 消</el-button>
          <el-button type="primary" @click="updateTrue">确 定</el-button>
        </span>
      </el-dialog>
    </main>
  </div>
</template>

<script>
import { mapGetters } from "vuex";
import {
  findEnergyParams,
  addEnergyParams,
  updateEnergyParams,
  deleteEnergyParams
} from "@/api/usersetting/energymange/energyparams";

export default {
  inject: ["reload"],
  computed: {
    ...mapGetters(["path"])
  },
  data() {
    return {
      ruleForm: {
        
      },
      rules: {
        
      },
      currentPage: 1, // 初始页
      pageSize: 10,
      rowCount: 0,
      expectDayEnergy: "", // 每天预计产生的能耗
      deviceCost: "", // 设备成本
      peopleCost: "", // 人力成本
      reduceCarbon: "", // 减少标碳参数
      treePlant: "", // 相当于植树
      moneyCost: "", // 折合人民币参数
      tableDatas: [], // 表格数据
      editData: {}, // 修改单行数据
      addVisible: false, // 控制新增弹窗
      updateVisible: false // 控制修改弹窗
    };
  },
  created() {
    this.findEnergyParams();
  },
  methods: {
    // 查询能耗配置参数
    findEnergyParams() {
      findEnergyParams(this.path, this.currentPage, this.pageSize)
        .then(res => {
          this.tableDatas = res.data.records;
          this.rowCount = res.data.rowCount;
        })
        .catch(console.log);
    },
    // 改变显示页数
    handleSizeChange(size) {
      this.pageSize = size;
      this.currentPage = 1;
      this.findEnergyParams();
    },
    // 跳页
    handleCurrentChange(currentpage) {
      this.currentPage = currentpage;
      if (this.tableDatas.length < this.rowCount) {
        this.findEnergyParams();
      }
    },
    // 上一页
    prev() {
      if (this.currentPage === 1) {
        this.currentPage = 1;
      } else {
        this.currentPage--;
        if (this.tableDatas.length < this.rowCount) {
          this.findEnergyParams();
        }
      }
    },
    // 下一页
    next() {
      const maxPage = Math.ceil(this.rowCount / this.pageSize);
      if (this.currentPage < maxPage) {
        this.currentPage++;
        if (this.tableDatas.length < this.rowCount) {
          this.findEnergyParams();
        }
      }
    },

    // 新增
    handleAdd() {
      let formData = new FormData();
      formData.append("dayEnergy", this.expectDayEnergy);
      formData.append("drCost", this.deviceCost);
      formData.append("peopleCost", this.peopleCost);
      formData.append("carbonParm", this.reduceCarbon);
      formData.append("treeParm", this.treePlant);
      formData.append("costParm", this.moneyCost);
      addEnergyParams(this.path, formData)
        .then(res => {
          if (res.status === 20000) {
            this.$message.success("新增成功");
            this.reload();
          }
        })
        .catch(console.log);
    },
    // 修改
    handleEdit(index, row) {
      this.updateVisible = true;
      this.editData = row;
    },
    // 确认修改
    updateTrue() {
      let formData = new FormData();
      formData.append("id", this.editData.id);
      formData.append("dayEnergy", this.editData.dayEnergy);
      formData.append("drCost", this.editData.drCost);
      formData.append("peopleCost", this.editData.peopleCost);
      formData.append("carbonParm", this.editData.carbonParm);
      formData.append("treeParm", this.editData.treeParm);
      formData.append("costParm", this.editData.costParm);
      updateEnergyParams(this.path, formData)
        .then(res => {
          if (res.status === 20000) {
            this.$message.success("修改成功");
            this.reload();
          }
        })
        .catch(console.log);
    },
    // 删除
    handleDelete(index, row) {
      let tip = confirm("确定要删除吗");
      if (tip) {
        deleteEnergyParams(this.path, row.id)
          .then(res => {
            if (res.status === 20000) {
              this.$message.success("删除成功");
              this.reload();
            }
          })
          .catch(console.log);
      }
    }
  }
};
</script>

<style lang="scss" scoped>
.page-shell {
  padding: 0 20px 20px;
}

.panel-card {
  background: var(--theme-color);
  border-radius: 14px;
  padding: 20px;
  box-shadow: 0 14px 40px rgba(0, 0, 0, 0.08);
}

.panel-card__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 18px;
}

.panel-eyebrow {
  margin: 0 0 6px;
  font-size: 12px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: rgba(0, 0, 0, 0.45);
}

.panel-title {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: #1f2937;
}

.workbench {
  min-width: 0;
}

.toolbar-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.panel-body {
  min-width: 0;
}

.analysis-table {
  width: 100%;
}

.table-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.pagination-bar {
  display: flex;
  justify-content: flex-end;
  margin-top: 18px;
}

.dialog-shell {
  padding-top: 8px;
}

.config-form {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  column-gap: 16px;
}

.config-form .el-input,
.config-form .el-textarea {
  width: 100%;
}

@media (max-width: 768px) {
  .page-shell {
    padding: 0 12px 12px;
  }

  .panel-card {
    padding: 16px;
  }

  .panel-card__header {
    flex-direction: column;
    align-items: stretch;
  }

  .toolbar-actions {
    width: 100%;
  }

  .toolbar-actions .el-button {
    flex: 1 1 auto;
  }

  .pagination-bar {
    justify-content: center;
  }

  .config-form {
    grid-template-columns: 1fr;
  }
}
</style>

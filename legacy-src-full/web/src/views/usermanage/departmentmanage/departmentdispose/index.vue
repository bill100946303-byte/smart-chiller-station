<template>
  <div class="app-container">
    <el-row :gutter="10">
      <el-col :xs="24" :sm="24" :md="24" :lg="24" :xl="24">
        <div class="grid-content bg-purple-light">
          <div class="btn">
            <p>部门配置</p>
            <el-button type="primary" @click="addVisible = true"
              >新增</el-button
            >
          </div>
          <el-table
            :data="tableData"
            border
            style="width: 100%"
            max-height="600px"
          >
            <af-table-column prop="departmentid" label="ID" />
            <af-table-column prop="departmentname" label="部门名称" />
            <af-table-column prop="fudepartmentname" label="隶属部门" />
            <af-table-column prop="departmentExplain" label="部门职责" />
            <el-table-column label="操作" width="180px">
              <template slot-scope="scope">
                <el-button
                  size="mini"
                  type="success"
                  @click="handleEdit(scope.$index, scope.row)"
                  >编辑</el-button
                >
                <el-button
                  size="mini"
                  type="danger"
                  @click="handleDelete(scope.$index, scope.row)"
                  >删除</el-button
                >
              </template>
            </el-table-column>
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
                :page-size="pageSize"
                layout="total, sizes, jumper"
                :total="rowCount"
                @size-change="handleSizeChange"
                @current-change="handleCurrentChange"
              />
            </div>
          </div>
        </div>
        <el-dialog title="新增部门" :visible.sync="addVisible">
          <el-form label-width="80px" label-position="left">
            <el-form-item label="部门名称">
              <el-input v-model="department" placeholder="请输入部门名称" />
            </el-form-item>
            <el-form-item label="隶属部门">
              <el-select v-model="departmentId" placeholder="请选择隶属部门">
                <el-option
                  :label="departmentName"
                  :value="departmentId"
                  style="height: auto"
                >
                  <el-tree
                    :data="departmentTree"
                    node-key="departmentid"
                    ref="tree"
                    highlight-current
                    :props="defaultProps"
                    @node-click="handleCheck"
                  ></el-tree>
                </el-option>
              </el-select>
            </el-form-item>
            <el-form-item label="部门职责">
              <el-input
                v-model="departmentDuty"
                type="textarea"
                :rows="3"
                placeholder="请输入部门职责"
              />
            </el-form-item>
          </el-form>
          <span slot="footer" class="dialog-footer">
            <el-button @click="addVisible = false">取 消</el-button>
            <el-button type="primary" @click="handleAdd">确 定</el-button>
          </span>
        </el-dialog>
        <el-dialog title="修改部门" :visible.sync="updateVisible">
          <el-form label-width="80px" label-position="left">
            <el-form-item label="部门名称">
              <el-input
                v-model="editData.departmentname"
                placeholder="请输入部门名称"
              />
            </el-form-item>
            <el-form-item label="隶属部门">
              <el-select v-model="editData.fuid" placeholder="请选择隶属部门">
                <el-option
                  :label="editData.fudepartmentname"
                  :value="editData.fuid"
                  style="height: auto"
                >
                  <el-tree
                    :data="departmentTree"
                    node-key="departmentid"
                    ref="tree"
                    highlight-current
                    :props="defaultProps"
                    @node-click="handleCheck"
                  ></el-tree>
                </el-option>
              </el-select>
            </el-form-item>
            <el-form-item label="部门职责">
              <el-input
                v-model="editData.departmentExplain"
                type="textarea"
                :rows="3"
                placeholder="请输入部门职责"
              />
            </el-form-item>
          </el-form>
          <span slot="footer" class="dialog-footer">
            <el-button @click="updateVisible = false">取 消</el-button>
            <el-button type="primary" @click="updateTrue">确 定</el-button>
          </span>
        </el-dialog>
      </el-col>
    </el-row>
  </div>
</template>

<script>
import { mapGetters } from "vuex";
import {
  findDepartment,
  findDepartmentTable,
  addDepartment,
  updateDepartment,
  deleteDepartment
} from "@/api/usersetting/usermanage/departmentdispose";

export default {
  inject: ["reload"],
  computed: {
    ...mapGetters(["path"])
  },
  data () {
    return {
      currentPage: 1, // 初始页
      pageSize: 10,
      rowCount: 0,
      department: "", // 部门
      departmentId: "", // 部门id
      departmentName: "", // 部门名
      departmentDuty: "", // 部门职责
      addVisible: false, // 控制新增弹窗
      updateVisible: false, // 控制修改弹窗
      tableData: [], // 表格数据
      editData: {}, // 修改表格单行数据
      departmentTree: [], // 部门树图数据
      defaultProps: {
        children: "children",
        label: "departmentname"
      }
    };
  },
  created () {
    // 查询所有部门树图
    findDepartment(this.path)
      .then(res => {
        this.departmentTree = res.data;
      })
      .catch(console.log);
    // 查询所有部门分页
    this.findDepartmentTable(this.path, this.currentPage, this.pageSize);
  },
  methods: {
    // 查询所有部门分页
    findDepartmentTable (path, currentPage, pageSize) {
      findDepartmentTable(path, currentPage, pageSize)
        .then(res => {
          this.rowCount = res.data.rowCount;
          this.tableData = res.data.records;
        })
        .catch(console.log);
    },
    // 选择树图
    handleCheck (obj) {
      this.departmentName = obj.departmentname;
      this.departmentId = obj.departmentid;
      if (this.editData != {}) {
        this.editData.fuid = obj.fuid;
        this.editData.fudepartmentname = obj.fudepartmentname;
      }
    },
    // 改变显示页数
    handleSizeChange (size) {
      this.pageSize = size;
      this.currentpage = 1;
      this.findDepartmentTable(this.path, this.currentPage, this.pageSize);
    },
    // 跳页
    handleCurrentChange (currentpage) {
      this.currentPage = currentpage;
      if (this.tableData.length < this.rowCount) {
        this.findDepartmentTable(this.path, this.currentPage, this.pageSize);
      }
    },
    // 上一页
    prev () {
      if (this.currentPage === 1) {
        this.currentPage = 1;
      } else {
        this.currentPage--;
        if (this.tableData.length < this.rowCount) {
          this.findDepartmentTable(this.path, this.currentPage, this.pageSize);
        }
      }
    },
    // 下一页
    next () {
      const maxPage = Math.ceil(this.rowCount / this.pageSize);
      if (this.currentPage < maxPage) {
        this.currentPage++;
        if (this.tableData.length < this.rowCount) {
          this.findDepartmentTable(this.path, this.currentPage, this.pageSize);
        }
      }
    },
    // 新增
    handleAdd () {
      this.addVisible = false;
      var formData = new FormData();
      formData.append("departmentname", this.department);
      formData.append("fuid", this.departmentId);
      formData.append("departmentExplain", this.departmentDuty);
      addDepartment(this.path, formData)
        .then(res => {
          if (res.status === 20000) {
            this.$message.success("新增成功!");
            this.reload();
          }
        })
        .catch(console.log);
    },
    // 修改
    handleEdit (index, row) {
      this.updateVisible = true;
      this.editData = row;
      if (this.editData.fuid === 0) {
        this.editData.fuid = "";
        this.editData.fudepartmentname = 0;
      }
    },
    // 确认修改
    updateTrue () {
      this.updateVisible = false;
      var formData = new FormData();
      formData.append("departmentid", this.editData.departmentid);
      formData.append("departmentname", this.editData.departmentname);
      if (this.editData.fudepartmentname === 0) {
        formData.append("fuid", this.editData.fudepartmentname);
      } else {
        formData.append("fuid", this.editData.fuid);
      }
      formData.append("departmentExplain", this.editData.departmentExplain);
      updateDepartment(this.path, formData)
        .then(res => {
          if (res.status === 20000) {
            this.$message.success("修改成功!");
            this.reload();
          }
        })
        .catch(console.log);
    },
    // 删除
    handleDelete (index, row) {
      deleteDepartment(this.path, row.departmentid)
        .then(res => {
          if (res.status === 20000) {
            this.$message.success("删除成功!");
            this.reload();
          }
        })
        .catch(console.log);
    }
  }
};
</script>

<style lang="scss" scoped>
.app-container {
  .el-col {
    border-radius: 4px;
  }
  .bg-purple-light {
    padding: 20px;
    background: var(--theme-color);

    .btn {
      display: flex;
      align-items: center;
      margin: 20px 0;
      p {
        margin-right: 20px;
        font-size: 18px;
        font-weight: bold;
      }
    }
    .el-pagination {
      display: flex;
      justify-content: center;
      margin-top: 10px;
      text-align: center;
      .btn {
        margin-top: 10px;
        padding: 2px 5px;
      }
    }
  }
  .el-dialog {
    .el-input {
      width: 200px;
    }
    .el-textarea {
      width: 400px;
    }
  }
  .grid-content {
    border-radius: 4px;
    min-height: 36px;
  }
}
</style>

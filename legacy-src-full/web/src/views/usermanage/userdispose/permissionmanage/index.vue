<template>
  <div class="app-container">
    <el-row :gutter="10">
      <el-col :xs="24" :sm="24" :md="24" :lg="24" :xl="24">
        <div class="grid-content bg-purple-light">
          <div class="user-menu-info">
            <p>用户菜单权限</p>
            <el-button type="primary" @click="addDialog = true">增加</el-button>
            <el-button type="danger" @click="deletePermissions"
              >批量删除</el-button
            >
          </div>
          <el-table
            :data="tableDatas"
            border
            style="width: 100%"
            max-height="600px"
            @selection-change="selectPermission"
          >
            <el-table-column type="selection" width="55"></el-table-column>
            <af-table-column prop="id" label="ID"></af-table-column>
            <af-table-column
              prop="usergroupname"
              label="用户组"
            ></af-table-column>
            <af-table-column prop="qx" label="权限"></af-table-column>
            <el-table-column fixed="right" label="操作" width="150">
              <template slot-scope="scope">
                <el-button
                  type="success"
                  size="mini"
                  @click="editePermission(scope.$index, scope.row)"
                  >编辑</el-button
                >
                <el-button
                  type="danger"
                  size="mini"
                  @click="deletePermission(scope.$index, scope.row)"
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
                :page-size="pagesize"
                layout="total, sizes, jumper"
                :total="rowCount"
                @size-change="handleSizeChange"
                @current-change="handleCurrentChange"
              />
            </div>
          </div>
          <el-dialog title="添加用户组" :visible.sync="addDialog">
            <el-form label-width="80px" label-position="left">
              <el-form-item label="用户组">
                <el-input v-model="userGroup" clearable />
              </el-form-item>
              <el-form-item label="操作控制">
                <el-select
                  v-model="operateControl"
                  clearable
                  placeholder="请选择操作"
                >
                  <el-option
                    v-for="item in control"
                    :key="item.value"
                    :label="item.value"
                    :value="item.id"
                  ></el-option>
                </el-select>
              </el-form-item>
              <el-form-item label="菜单权限">
                <el-tree
                  ref="permissionTree"
                  class="tree"
                  check-strictly="true"
                  :data="permissionTreeData"
                  show-checkbox
                  node-key="id"
                  :props="permissionProps"
                />
              </el-form-item>
            </el-form>
            <div slot="footer" class="dialog-footer">
              <el-button @click="addDialog = false">取 消</el-button>
              <el-button type="primary" @click="addTrue">确 定</el-button>
            </div>
          </el-dialog>
          <el-dialog title="修改用户组" :visible.sync="updateDialog">
            <el-form label-width="80px" label-position="left">
              <el-form-item label="用户组">
                <el-input
                  v-model="permissionEditData.usergroupname"
                  clearable
                />
              </el-form-item>
              <el-form-item label="操作控制">
                <el-select
                  v-model="operateControl"
                  clearable
                  placeholder="请选择操作"
                >
                  <el-option
                    v-for="item in control"
                    :key="item.value"
                    :label="item.value"
                    :value="item.id"
                  ></el-option>
                </el-select>
              </el-form-item>
              <el-form-item label="菜单权限">
                <el-tree
                  ref="permissionTree"
                  class="tree"
                  show-checkbox
                  node-key="id"
                  check-strictly="true"
                  :data="permissionTreeData"
                  :default-expanded-keys="treeKeys"
                  :default-checked-keys="treeKeys"
                  :props="permissionProps"
                />
              </el-form-item>
            </el-form>
            <div slot="footer" class="dialog-footer">
              <el-button @click="updateDialog = false">取 消</el-button>
              <el-button type="primary" @click="updatePermission"
                >确 定</el-button
              >
            </div>
          </el-dialog>
        </div>
      </el-col>
    </el-row>
  </div>
</template>

<script>
import { mapGetters } from "vuex";
import {
  findPermission,
  addPermission,
  updatePermission,
  deletePermission
} from "@/api/contentsetting/permission";
import { findObjMenu } from "@/api/contentsetting/systemmenu";
export default {
  inject: ["reload"],
  name: "Permission",
  computed: {
    ...mapGetters(["path"])
  },
  data () {
    return {
      currentPage: 1,
      rowCount: 0,
      pagesize: 10,
      permissions: [], // 选择的权限数组
      userGroup: "",
      operateControl: "",
      addDialog: false,
      updateDialog: false,
      permissionProps: {
        children: "children",
        label: "menuName"
      },
      control: [
        {
          id: 0,
          value: "不控制"
        },
        {
          id: 1,
          value: "控制"
        }
      ],
      tableDatas: [],
      permissionTreeData: [],
      permissionEditData: {},
      treeKeys: []
    };
  },
  created () {
    // 查询项目菜单
    findObjMenu(this.path)
      .then(res => {
        this.permissionTreeData = res.data;
      })
      .catch(console.log);
    // 查询所有用户权限
    this.findAllPermission(this.path, this.currentPage, this.pagesize);
  },
  methods: {
    // 查询所有用户权限
    findAllPermission (path, currentPage, pageSize) {
      findPermission(path, currentPage, pageSize)
        .then(res => {
          this.rowCount = res.data.rowCount;
          this.tableDatas = res.data.records;
        })
        .catch(console.log);
    },
    // 改变显示页数
    handleSizeChange (size) {
      this.pagesize = size;
      this.currentPage = 1;
      this.findAllPermission(this.path, this.currentPage, this.pagesize);
    },
    // 跳页
    handleCurrentChange (currentpage) {
      this.currentPage = currentpage;
      if (this.tableDatas.length < this.rowCount) {
        this.findAllPermission(this.path, this.currentPage, this.pagesize);
      }
    },
    // 上一页
    prev () {
      if (this.currentPage === 1) {
        this.currentPage = 1;
      } else {
        this.currentPage--;
        if (this.tableDatas.length < this.rowCount) {
          this.findAllPermission(this.path, this.currentPage, this.pagesize);
        }
      }
    },
    // 下一页
    next () {
      const maxPage = Math.ceil(this.rowCount / this.pagesize);
      if (this.currentPage < maxPage) {
        this.currentPage++;
        if (this.tableDatas.length < this.rowCount) {
          this.findAllPermission(this.path, this.currentPage, this.pagesize);
        }
      }
    },
    // 新增权限
    addTrue () {
      let keys = this.$refs.permissionTree.getCheckedKeys();
      var formData = new FormData();
      formData.append("usergroupname", this.userGroup);
      formData.append("qx", keys.join(","));
      addPermission(this.path, formData)
        .then(res => {
          if (res.status === 20000) {
            this.$message.success("新增成功!");
            this.reload();
          }
        })
        .catch(console.log);
    },
    // 编辑权限
    editePermission (index, row) {
      this.updateDialog = true;
      this.permissionEditData = row;
      this.treeKeys = row.qx.split(",");
    },
    // 修改项目
    updatePermission () {
      let keys = this.$refs.permissionTree.getCheckedKeys();
      var formData = new FormData();
      formData.append("id", this.permissionEditData.id);
      formData.append("usergroupname", this.permissionEditData.usergroupname);
      formData.append("qx", keys.join(","));
      updatePermission(this.path, formData)
        .then(res => {
          if (res.status === 20000) {
            this.$message.success("修改成功!");
            this.reload();
          }
        })
        .catch(console.log);
    },
    // 删除用户权限
    deletePermission (index, row) {
      deletePermission(this.path, row.id)
        .then(res => {
          if (res.status === 20000) {
            this.$message.success("删除成功!");
            this.reload();
          }
        })
        .catch(console.log);
      this.reload();
    },
    // 选择权限
    selectPermission (val) {
      this.permissions = val;
    },
    // 批量删除
    deletePermissions () {
      let ids = [];
      this.permissions.forEach(ele => {
        ids.push(ele.id);
      });
      deletePermission(this.path, ids.join(","))
        .then(res => {
          if (res.status === 20000) {
            this.$message.success("批量删除成功!");
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
    .el-input {
      width: 200px;
    }
  }
  .bg-purple-dark {
    background: #99a9bf;
  }
  .bg-purple-light {
    padding: 20px;
    background: var(--theme-color);
    .user-menu-info {
      display: flex;
      align-items: center;
      margin-bottom: 20px;
      p {
        margin-right: 20px;
        font-size: 18px;
        font-weight: bold;
      }
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
  .grid-content {
    border-radius: 4px;
    min-height: 36px;
  }
}
</style>

<template>
  <div class="app-container container">
    <el-row :gutter="10">
      <el-col :xs="24" :sm="24" :md="24" :lg="24" :xl="24">
        <div class="grid-content bg-purple-light">
          <div class="title">
            <p>用户编辑</p>
            <el-button type="primary" @click="addVisible = true"
              >新增</el-button
            >
          </div>
          <el-table :data="tableDatas" style="width: 100%" max-height="600px">
            <af-table-column prop="userid" label="ID" />
            <af-table-column prop="username" label="用户名" />
            <af-table-column prop="phonenum" label="手机号" />
            <af-table-column prop="email" label="邮箱" />
            <af-table-column prop="usergroupname" label="用户组" />
            <af-table-column prop="departmentname" label="部门" />
            <af-table-column prop="isJB" label="是否交班" />
            <af-table-column prop="usertype" label="设备权限控制" />
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
                :page-size="pagesize"
                layout="total, sizes, jumper"
                :total="rowCount"
                @size-change="handleSizeChange"
                @current-change="handleCurrentChange"
              />
            </div>
          </div>
        </div>
        <el-dialog title="用户新增" :visible.sync="addVisible" width="30%">
          <el-form label-width="120px" label-position="left">
            <el-form-item label="用户名">
              <el-input
                v-model="username"
                placeholder="请输入用户名"
                clearable
              />
            </el-form-item>
            <el-form-item label="用户组">
              <el-select v-model="usergroup" placeholder="请选择用户组">
                <el-option
                  v-for="item in userGroupOptions"
                  :key="item.id"
                  :label="item.value"
                  :value="item.id"
                ></el-option>
              </el-select>
            </el-form-item>
            <el-form-item label="手机号">
              <el-input v-model="phone" placeholder="请输入手机号" clearable />
            </el-form-item>
            <el-form-item label="邮箱">
              <el-input v-model="email" placeholder="请输入邮箱" clearable />
            </el-form-item>
            <el-form-item label="授权时间">
              <el-date-picker
                v-model="qxTime"
                type="date"
                placeholder="选择授权时间"
                :editable="false"
                :clearable="false"
              />
            </el-form-item>
            <el-form-item label="部门">
              <el-select v-model="departmentid" placeholder="请选择部门">
                <el-option
                  :label="departmentname"
                  :value="departmentid"
                  style="height: auto"
                >
                  <el-tree
                    :data="departmentTree"
                    node-key="ldRwId"
                    ref="tree"
                    highlight-current
                    :props="defaultProps"
                    @node-click="handleCheck"
                  ></el-tree>
                </el-option>
              </el-select>
            </el-form-item>
            <el-form-item label="是否交班">
              <el-select v-model="isJB" placeholder="请选择是否交班">
                <el-option
                  v-for="item in JBOptions"
                  :key="item.value"
                  :label="item.value"
                  :value="item.id"
                ></el-option>
              </el-select>
            </el-form-item>
            <el-form-item label="设备权限控制">
              <el-select
                v-model="deviceControl"
                placeholder="请选择设备权限控制"
              >
                <el-option
                  v-for="item in deviceControlOptions"
                  :key="item.value"
                  :label="item.value"
                  :value="item.id"
                ></el-option>
              </el-select>
            </el-form-item>
          </el-form>
          <span slot="footer" class="dialog-footer">
            <el-button @click="addVisible = false">取 消</el-button>
            <el-button type="primary" @click="handleAdd">确 定</el-button>
          </span>
        </el-dialog>
        <el-dialog title="用户编辑" :visible.sync="updateVisible" width="30%">
          <el-form label-width="120px" label-position="left">
            <el-form-item label="用户名">
              <el-input v-model="editData.username" clearable readonly />
            </el-form-item>
            <el-form-item label="用户组">
              <el-select
                v-model="editData.usergroupid"
                placeholder="请选择用户组"
              >
                <el-option
                  v-for="item in userGroupOptions"
                  :key="item.id"
                  :label="item.value"
                  :value="item.id"
                ></el-option>
              </el-select>
            </el-form-item>
            <el-form-item label="手机号">
              <el-input
                v-model="editData.phonenum"
                placeholder="请输入手机号"
                clearable
              />
            </el-form-item>
            <el-form-item label="邮箱">
              <el-input
                v-model="editData.email"
                placeholder="请输入邮箱"
                clearable
              />
            </el-form-item>
            <el-form-item label="部门">
              <el-select
                v-model="editData.departmentid"
                placeholder="请选择部门"
              >
                <el-option
                  :label="editData.departmentname"
                  :value="editData.departmentid"
                  style="height: auto"
                >
                  <el-tree
                    :data="departmentTree"
                    node-key="ldRwId"
                    ref="tree"
                    highlight-current
                    :props="defaultProps"
                    @node-click="handleCheck"
                  ></el-tree>
                </el-option>
              </el-select>
            </el-form-item>
            <el-form-item label="是否交班">
              <el-select v-model="editData.isJB" placeholder="请选择是否交班">
                <el-option
                  v-for="item in JBOptions"
                  :key="item.value"
                  :label="item.value"
                  :value="item.id"
                ></el-option>
              </el-select>
            </el-form-item>
            <el-form-item label="设备权限控制">
              <el-select
                v-model="editData.usertype"
                placeholder="请选择设备权限控制"
              >
                <el-option
                  v-for="item in deviceControlOptions"
                  :key="item.value"
                  :label="item.value"
                  :value="item.id"
                ></el-option>
              </el-select>
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
  findUserInfo,
  findUserGroup,
  findDepartment,
  addUserInfo,
  updateUserInfo,
  deleteUserInfo
} from "@/api/usersetting/usermanage/useredit";
import { valToId, idToVal, nullToStr } from "@/utils/selectexchange";
export default {
  inject: ["reload"],
  computed: {
    ...mapGetters(["path", "id"])
  },
  data () {
    const today = new Date();
    return {
      currentPage: 1, // 初始页
      pagesize: 10,
      rowCount: 0,
      username: "", // 用户名
      phone: "", // 手机号
      email: "", // 邮箱
      usergroup: "", // 用户组
      qxTime: today, // 授权时间
      departmentid: "", // 部门id
      departmentname: "", // 部门名
      isJB: "", // 是否交班
      deviceControl: "否", // 设备权限控制
      tableDatas: [], // 表格数据
      editData: {},
      addVisible: false, // 控制新增弹窗
      updateVisible: false, // 控制更新弹窗
      departmentTree: [], // 部门树图
      defaultProps: {
        children: "children",
        label: "departmentname"
      },
      userGroupOptions: [], // 用户组选项
      departmentOptions: [], // 部门选项
      JBOptions: [
        {
          id: 1,
          value: "是"
        },
        {
          id: 0,
          value: "否"
        }
      ], // 是否交班选项
      deviceControlOptions: [
        {
          id: 1,
          value: "是"
        },
        {
          id: 0,
          value: "否"
        }
      ] // 是否设备权限控制
    };
  },
  created () {
    // 查询用户组
    findUserGroup(this.path, this.id)
      .then(res => {
        res.data.forEach(ele => {
          let obj = {
            id: ele.id,
            value: ele.usergroupname
          };
          this.userGroupOptions.push(obj);
        });
      })
      .catch(console.log);

    // 查询所有部门
    findDepartment(this.path, this.id)
      .then(res => {
        this.departmentTree = res.data;
      })
      .catch(console.log);

    // 查询用户编辑信息
    this.findUserInfo(this.path, this.currentPage, this.pagesize);
  },
  methods: {
    // 查询用户编辑信息
    findUserInfo (path, currentPage, pageSize) {
      findUserInfo(path, currentPage, pageSize)
        .then(res => {
          this.rowCount = res.data.rowCount;
          this.tableDatas = res.data.records;
          this.tableDatas.forEach(ele => {
            ele.isJB = idToVal(ele.isJB, this.JBOptions);
            ele.usertype = idToVal(ele.usertype, this.deviceControlOptions);
          });
        })
        .catch(console.log);
    },
    // 选择树图
    handleCheck (obj) {
      this.departmentid = obj.departmentid;
      this.departmentname = obj.departmentname;
      if (this.editData != {}) {
        this.editData.departmentid = obj.departmentid;
        this.editData.departmentname = obj.departmentname;
      }
    },
    // 改变显示页数
    handleSizeChange (size) {
      this.pagesize = size;
      this.currentpage = 1;
      this.findUserInfo(this.path, this.currentPage, this.pagesize);
    },
    // 跳页
    handleCurrentChange (currentpage) {
      this.currentPage = currentpage;
      if (this.tableDatas.length < this.rowCount) {
        this.findUserInfo(this.path, this.currentPage, this.pagesize);
      }
    },
    // 上一页
    prev () {
      if (this.currentPage === 1) {
        this.currentPage = 1;
      } else {
        this.currentPage--;
        if (this.tableDatas.length < this.rowCount) {
          this.findUserInfo(this.path, this.currentPage, this.pagesize);
        }
      }
    },
    // 下一页
    next () {
      const maxPage = Math.ceil(this.rowCount / this.pagesize);
      if (this.currentPage < maxPage) {
        this.currentPage++;
        if (this.tableDatas.length < this.rowCount) {
          this.findUserInfo(this.path, this.currentPage, this.pagesize);
        }
      }
    },
    // 新增
    handleAdd () {
      var formData = new FormData();
      formData.append("appid", this.id);
      formData.append("username", this.username);
      formData.append("phonenum", this.phone);
      formData.append("email", this.email);
      formData.append("usergroupid", this.usergroup);
      formData.append("licensetime", this.qxTime);
      formData.append("departmentid", this.departmentid);
      formData.append("isJB", this.isJB);
      formData.append(
        "usertype",
        valToId(this.deviceControl, this.deviceControlOptions)
      );
      addUserInfo(this.path, formData)
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
    },
    // 确认修改
    updateTrue () {
      var formData = new FormData();
      formData.append("appid", this.id);
      formData.append("userid", this.editData.userid);
      formData.append("username", this.editData.username);
      formData.append("phonenum", this.editData.phonenum);
      formData.append("email", this.editData.email);
      formData.append(
        "usergroupid",
        valToId(this.editData.usergroupid, this.userGroupOptions)
      );
      formData.append("departmentid", nullToStr(this.editData.departmentid));
      formData.append("isJB", valToId(this.editData.isJB, this.JBOptions));
      formData.append(
        "usertype",
        valToId(this.editData.usertype, this.deviceControlOptions)
      );
      updateUserInfo(this.path, formData)
        .then(res => {
          if (res.status === 20000) {
            this.$message.success("修改成功!");
            this.reload();
          }
        })
        .catch(console.log);
    },
    handleDelete (index, row) {
      let tip = confirm("确定要删除吗？");
      if (tip) {
        deleteUserInfo(this.path, this.id, row.userid)
          .then(res => {
            if (res.status === 20000) {
              this.$message.success("删除成功!");
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
.container {
  .el-col {
    border-radius: 4px;
  }
  .bg-purple-light {
    padding: 20px;
    background: var(--theme-color);
    .title {
      display: flex;
      align-items: center;
      margin-bottom: 20px;
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
      align-items: center;
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
  }
  .grid-content {
    border-radius: 4px;
    min-height: 36px;
  }
}
</style>

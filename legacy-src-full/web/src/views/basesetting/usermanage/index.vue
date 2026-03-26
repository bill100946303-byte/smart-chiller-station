<template>
  <div class="app-container building-information-container">
    <el-row :gutter="10">
      <el-col :xs="24" :sm="24" :md="24" :lg="24" :xl="24">
        <el-tabs type="border-card" v-model="activeName">
          <el-tab-pane label="用户管理">
            <el-row :gutter="10">
              <el-col :md="24" :lg="7" :xl="5">
                <div class="grid-content bg-purple">
                  <p class="buiding-info-title">用户信息</p>
                  <div class="buiding-info">
                    <el-form
                      :model="ruleForm"
                      label-width="80px"
                      label-position="left"
                      :rules="rules"
                      ref="ruleForm"
                    >
                      <el-form-item label="用户名" prop="input0" required>
                        <el-input
                          class="el-input"
                          v-model="ruleForm.input0"
                          placeholder="请输入用户名"
                          clearable
                        />
                      </el-form-item>
                      <el-form-item label="手机号" prop="phone" required>
                        <el-input
                            class="el-input"
                            v-model="ruleForm.phone"
                            placeholder="请输入手机号"
                            clearable
                        />
                      </el-form-item>
                      <el-form-item label="用户类型">
                        <el-select
                          v-model="input1"
                          clearable
                          placeholder="请选择用户类型"
                        >
                          <el-option
                            v-for="item in userOption"
                            :key="item.value"
                            :label="item.value"
                            :value="item.id"
                          ></el-option>
                        </el-select>
                      </el-form-item>
                      <el-form-item label="邮箱">
                        <el-input
                          class="el-input"
                          v-model="email"
                          placeholder="请输入邮箱"
                          clearable
                        />
                      </el-form-item>
                      <el-form-item label="授权时间">
                        <el-date-picker
                          v-model="input2"
                          type="date"
                          placeholder="选择授权时间"
                        />
                      </el-form-item>
                    </el-form>
                  </div>
                  <div class="buiding-btn">
                    <el-button type="primary" @click="handelAdd"
                      >增加用户</el-button
                    >
                  </div>
                </div>
              </el-col>
              <el-col :md="24" :lg="17" :xl="19">
                <div class="grid-content bg-purple-light">
                  <p class="buiding-list-title">用户列表</p>
                  <el-table
                    :data="tableDatas1"
                    style="width: 100%"
                    max-height="500"
                  >
                    <af-table-column prop="id" label="ID" />
                    <af-table-column prop="username" label="用户名" />
                    <af-table-column prop="licensetype" label="授权类型" />
                    <af-table-column prop="phonenum" label="手机号" />
                    <af-table-column prop="email" label="邮箱" />
                    <af-table-column prop="licensetime" label="授权时长" />
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
<!--                        <el-button-->
<!--                            size="mini"-->
<!--                            type="danger"-->
<!--                            @click="handleDeleteMessageBox(scope.$index, scope.row)"-->
<!--                        >删除</el-button-->
<!--                        >-->
                      </template>
                    </el-table-column>
                  </el-table>
<!--                  <div class="el-pagination">
                    <div class="btn">
                      <button @click="prev">上一页</button>
                      <span>{{ currentPage1 }}</span>
                      <button @click="next">下一页</button>
                    </div>
                    <div>
                      <el-pagination
                        :current-page="currentPage1"
                        :page-sizes="[5, 10, 20, 40]"
                        :page-size="pageSize1"
                        layout="total, sizes, jumper"
                        :total="rowCount1"
                        @size-change="handleSizeChange"
                        @current-change="handleCurrentChange"
                      />
                    </div>
                  </div>-->
                  <div class="el-pagination">
                    <el-pagination
                        :current-page="currentPage1"
                        :page-size="pageSize1"
                        :page-sizes="[10, 20, 30, 50]"
                        :total="rowCount1"
                        class="pagelist"
                        layout="total, sizes, prev, pager, next, jumper"
                        @size-change="handleSizeChange"
                        @current-change="handleCurrentChange"
                    >
                    </el-pagination>
                  </div>
                  <el-dialog
                    title="修改用户管理"
                    :visible.sync="updateVisible1"
                    width="40%"
                  >
                    <div class="add-dialog">
                      <div class="add-content">
                        <span>用户名</span>
                        <el-input
                          v-model="editData1.username"
                          clearable
                          readonly
                        />
                      </div>
                      <div class="add-content">
                        <span>用户类型</span>
                        <el-select
                          v-model="editData1.licensetype"
                          clearable
                          placeholder="请选择用户类型"
                        >
                          <el-option
                            v-for="item in userOption"
                            :key="item.value"
                            :label="item.value"
                            :value="item.id"
                          ></el-option>
                        </el-select>
                      </div>
                      <div class="add-content">
                        <span>手机号</span>
                        <el-input v-model="editData1.phonenum" clearable />
                      </div>
                      <div class="add-content">
                        <span>授权时间</span>
                        <el-date-picker
                          v-model="editData1.licensetime"
                          type="date"
                          placeholder="选择授权时间"
                        />
                      </div>
                      <div class="add-content">
                        <span>邮箱</span>
                        <el-input v-model="editData1.email" clearable />
                      </div>
                      <div class="add-contentNone">
                        <span>不显示</span>
                        <el-input v-model="editData1.email" clearable />
                      </div>
                    </div>
                    <span slot="footer" class="dialog-footer">
                      <el-button @click="updateVisible1 = false"
                        >取 消</el-button
                      >
                      <el-button type="primary" @click="updateTure"
                        >确 定</el-button
                      >
                    </span>
                  </el-dialog>
                </div>
              </el-col>
            </el-row>
          </el-tab-pane>
          <el-tab-pane label="用户权限">
            <el-row :gutter="10">
              <el-col :md="24" :lg="7" :xl="5">
                <div class="grid-content bg-purple">
                  <p class="buiding-info-title">授权信息</p>
                  <div class="buiding-info">
                    <ul>
                      <li>
                        <p><span style="color: red">*</span>用户名</p>
                        <el-select
                            v-model="input3"
                            clearable
                            placeholder="请选择用户名"
                            @change="selectUser"
                            filterable
                        >
                          <el-option
                            v-for="item in usernameOptions"
                            :key="item.value"
                            :label="item.username"
                            :value="item.id"
                          ></el-option>
                        </el-select>
                      </li>
                      <li>
                        <p><span style="color: red">*</span>项目名</p>
                        <el-select
                          v-model="input4"
                          clearable
                          placeholder="请选择项目名"
                          @change="selectProject"
                        >
                          <el-option
                            v-for="item in projectOptions"
                            :key="item.value"
                            :label="item.appexplain"
                            :value="item.appid"
                          ></el-option>
                        </el-select>
                      </li>
                      <li>
                        <p><span style="color: red">*</span>项目权限</p>
                        <el-select
                          v-model="input5"
                          clearable
                          placeholder="请选择项目权限"
                        >
                          <el-option
                            v-for="item in newprojectPermission"
                            :key="item.control"
                            :label="item.name"
                            :value="item.control"
                          ></el-option>
                        </el-select>
                      </li>
                    </ul>
                  </div>
                  <div class="buiding-btn">
                    <el-button type="primary" @click="handelAdd"
                      >增加权限</el-button
                    >
                  </div>
                </div>
              </el-col>
              <el-col :md="24" :lg="17" :xl="19">
                <div class="grid-content bg-purple-light">
                  <p class="buiding-list-title">用户权限列表</p>
                  <el-table
                    :data="tableDatas2"
                    style="width: 100%"
                    max-height="500"
                  >
                    <af-table-column prop="id" label="ID" />
                    <af-table-column prop="username" label="用户名" />
                    <af-table-column label="数据库名称" prop="appName" />
                    <af-table-column label="项目名" prop="appexplain" />
                    <af-table-column label="权限" prop="control" >
                      <template slot-scope="scope">
                        <span v-if="scope.row.control === 0">不可控</span >
                        <span v-if="scope.row.control === 1">可控</span >
                        <span v-if="scope.row.control === 2">部分可控</span >
                      </template>
                    </af-table-column>>
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
<!--                  <div class="el-pagination">
                    <div class="btn">
                      <button @click="prev">上一页</button>
                      <span>{{ currentPage2 }}</span>
                      <button @click="next">下一页</button>
                    </div>
                    <div>
                      <el-pagination
                        :current-page="currentPage2"
                        :page-sizes="[5, 10, 20, 40]"
                        :page-size="pageSize2"
                        layout="total, sizes, jumper"
                        :total="rowCount2"
                        @size-change="handleSizeChange"
                        @current-change="handleCurrentChange"
                      />
                    </div>
                  </div>-->
                  <div class="el-pagination">
                    <el-pagination
                        :current-page="currentPage2"
                        :page-size="pageSize2"
                        :page-sizes="[10, 20, 30, 50]"
                        :total="rowCount2"
                        layout="total, sizes, prev, pager, next, jumper"
                        @size-change="handleSizeChange"
                        @current-change="handleCurrentChange"
                    >
                    </el-pagination>
                  </div>
                  <el-dialog
                    title="修改用户权限"
                    :visible.sync="updateVisible2"
                    width="40%"
                  >
                    <div class="add-dialog">
                      <div class="add-content">
                        <span>用户名</span>
                        <el-input
                          v-model="editData2.username"
                          readonly
                        ></el-input>
                      </div>
                      <div class="add-content">
                        <span>数据库名称</span>
                        <el-input
                          v-model="editData2.appName"
                          readonly
                        ></el-input>
                      </div>
                      <div class="add-content">
                        <span>项目名</span>
                        <el-input
                            v-model="editData2.appexplain"
                            readonly
                        ></el-input>
                      </div>
                      <div class="add-content">
                        <span>项目权限</span>
                        <el-select
                          v-model="editData2.control"
                          clearable
                          placeholder="请选择项目权限"
                        >
                          <el-option
                            v-for="item in newprojectPermission"
                            :key="item.control"
                            :label="item.name"
                            :value="item.control"
                          ></el-option>
                        </el-select>
                      </div>
                      <div class="add-contentNone">
                        <span>不显示</span>
                        <el-input v-model="editData1.email" clearable />
                      </div>
                    </div>
                    <span slot="footer" class="dialog-footer">
                      <el-button @click="updateVisible2 = false"
                        >取 消</el-button
                      >
                      <el-button type="primary" @click="updateTure"
                        >确 定</el-button
                      >
                    </span>
                  </el-dialog>
                </div>
              </el-col>
            </el-row>
          </el-tab-pane>
        </el-tabs>
      </el-col>
    </el-row>
  </div>
</template>

<script>
import {idToVal, valToId} from "@/utils/selectexchange";
import {
  addUser,
  addUserRole,
  deleteUser,
  deleteUserRole,
  findAllUser,
  findProject,
  findProjectPermission,
  findUser,
  findUserRole,
  testUserName,
  updateUser,
  updateUserRole,
} from "@/api/basesetting/usermanage";
import {formatDay} from "@/utils/index";
import {showDelBox} from '@/utils/elmessage'

export default {
  inject: ["reload"],
  name: "UserManage",
  data() {
    var validateUsername = (rule, value, callback) => {
      if (value === "") {
        callback(new Error("用户名不能为空"));
      } else {
        testUserName(value)
          .then((res) => {
            console.log(res);
          })
          .catch(console.log);
        callback();
      }
    };
    return {
      newprojectPermission: [
        {
          control: 0,
          name: "不控制",
        },
        {
          control: 1,
          name: "可控",
        },
        {
          control: 2,
          name: "部分可控",
        },
      ],
      ruleForm: {
        input0: "", // 用户名（输入框）
        phone: "", // 手机号
      },
      rules: {
        input0: [{ validator: validateUsername, trigger: "blur" }],
        phone: [{ validator: validateUsername, trigger: "blur" }],
      },
      activeName: 0, // 目前处于哪一个页面
      currentPage1: 1,
      currentPage2: 1,
      rowCount1: 0,
      rowCount2: 0,
      pageSize1: 10,
      pageSize2: 10,
      email: "", // 邮箱
      input1: "", // 用户类型
      input2: "", // 授权时间
      input3: "", // 用户名（选项）
      input4: "", // 项目名
      input5: "", // 项目权限
      updateVisible1: false, // 用户管理修改弹窗
      updateVisible2: false, // 用户权限修改弹窗
      usernameOptions: [],
      projectOptions: [],
      userOption: [
        {
          id: 1,
          value: "临时用户",
        },
        {
          id: 2,
          value: "管理员",
        },
      ], // 用户类型
      projectPermission: [], // 项目权限
      editData1: "", // 用户管理单行修改
      editData2: "", // 用户权限单行修改
      tableDatas1: [], // 用户管理表格
      tableDatas2: [], // 用户权限表格
    };
  },
  created() {
    // 查询所有用户管理
    this.findUser(this.currentPage1, this.pageSize1);
    // 查询所有用户权限
    this.findUserRole(this.currentPage2, this.pageSize2);
    // 查询所有用户
    findAllUser()
      .then((res) => {
        this.usernameOptions = res.data;
      })
      .catch(console.log);
  },
  methods: {
    // 查询所有用户管理
    findUser(currentPage1, pageSize1) {
      findUser(currentPage1, pageSize1)
        .then((response) => {
          this.rowCount1 = response.data.rowCount;
          this.tableDatas1 = response.data.records;
          this.tableDatas1.forEach((ele) => {
            if (ele.licensetime != null) {
              ele.licensetime = formatDay(ele.licensetime);
            }
            ele.licensetype = idToVal(ele.licensetype, this.userOption);
          });
        })
        .catch(console.log);
    },
    // 查询所有用户权限
    findUserRole(currentPage2, pageSize2, userid) {
      findUserRole(currentPage2, pageSize2, userid)
        .then((response) => {
          this.rowCount2 = response.data.rowCount;
          this.tableDatas2 = response.data.records;
        })
        .catch(console.log);
    },
    // 改变显示页数
    handleSizeChange(size) {
      if (this.activeName == 0) {
        this.pageSize1 = size;
        this.currentpage1 = 1;
        this.findUser(this.currentPage1, this.pageSize1);
      } else {
        this.pageSize2 = size;
        this.currentpage2 = 1;
        this.findUserRole(this.currentPage2, this.pageSize2);
      }
    },
    // 跳页
    handleCurrentChange(currentpage) {
      if (this.activeName == 0) {
        this.currentPage1 = currentpage;
        if (this.tableDatas1.length < this.rowCount1) {
          this.findUser(this.currentPage1, this.pageSize1);
        }
      } else {
        this.currentPage2 = currentpage;
        if (this.tableDatas2.length < this.rowCount2) {
          this.findUserRole(this.currentPage2, this.pageSize2);
        }
      }
    },
    // 上一页
    prev() {
      if (this.activeName == 0) {
        if (this.currentPage1 === 1) {
          this.currentPage1 = 1;
        } else {
          this.currentPage1--;
          if (this.tableDatas1.length < this.rowCount1) {
            this.findUser(this.currentPage1, this.pageSize1);
          }
        }
      } else {
        if (this.currentPage2 === 1) {
          this.currentPage2 = 1;
        } else {
          this.currentPage2--;
          if (this.tableDatas2.length < this.rowCount2) {
            this.findUserRole(this.currentPage2, this.pageSize2);
          }
        }
      }
    },
    // 下一页
    next() {
      if (this.activeName == 0) {
        const maxPage = Math.ceil(this.rowCount1 / this.pageSize1);
        if (this.currentPage1 < maxPage) {
          this.currentPage1++;
          if (this.tableDatas1.length < this.rowCount1) {
            this.findUser(this.currentPage1, this.pageSize1);
          }
        }
      } else {
        const maxPage = Math.ceil(this.rowCount2 / this.pageSize2);
        if (this.currentPage2 < maxPage) {
          this.currentPage2++;
          if (this.tableDatas2.length < this.rowCount2) {
            this.findUserRole(this.currentPage2, this.pageSize2);
          }
        }
      }
    },
    // 选择用户名
    selectUser(id) {
      this.findUserRole(this.currentPage2, this.pageSize2, id);
      findProject(id)
        .then((res) => {
          console.log('res',res)
          this.projectOptions = res.data;
        })
        .catch(console.log);
    },
    // 选择项目查询项目权限
    selectProject(id) {
      let path = "";
      this.projectOptions.forEach((ele) => {
        if (ele.appid === id) {
          path = id + ele.appName;
        }
      });
      if (id != "") {
        findProjectPermission(path)
          .then((res) => {
            this.projectPermission = res.data;
          })
          .catch(console.log);
      }
    },
    // 增加
    handelAdd() {
      if (this.activeName == 0) {
        this.$refs.ruleForm.validate((valid) => {
          if (valid) {
            var formData = new FormData();
            formData.append("username", this.ruleForm.input0);
            formData.append("phonenum", this.ruleForm.phone);
            formData.append("email", this.email);
            formData.append("licensetype", this.input1);
            if (this.input2 != "") {
              formData.append("licensetime", this.input2);
            }
            addUser(formData)
              .then((res) => {
                const { msg } = res;
                if (msg == "OK") {
                  this.$message.success("新增成功!");
                  this.reload();
                }
              })
              .catch(console.log);
          } else {
            console.log("错误提交!!");
            return false;
          }
        });
      } else {
        if (this.input3 === "" || this.input4 === "" || this.input5 === "") {
          this.$message.error("*为必填项，请重新填写！");
        } else {
          let username = "";
          let phone = "";
          let email = "";
          this.usernameOptions.forEach((ele) => {
            if (ele.id === this.input3) {
              username = ele.username;
              phone = ele.phonenum;
              email = ele.email;
            }
          });
          let appName = "";
          this.projectOptions.forEach((ele) => {
            if (ele.appid === this.input4) {
              appName = ele.appName;
            }
          });
          var formData = new FormData();
          formData.append("userid", this.input3);
          formData.append("username", username);
          formData.append("appid", this.input4);
          formData.append("appName", appName);
          formData.append("phonenum", phone);
          formData.append("email", email);
          formData.append("control", this.input5);
          addUserRole(formData)
            .then((res) => {
              const { msg } = res;
              if (msg == "OK") {
                this.$message.success("新增成功!");
                this.reload();
              }
            })
            .catch(console.log);
        }
      }
    },
    // 修改
    handleEdit(index, row) {
      console.log('row',row)
      if (this.activeName == 0) {
        this.updateVisible1 = true;
        this.editData1 = JSON.parse(JSON.stringify(row));// 因为是双向绑定的原因，当在修改的时候页面也会变
      } else {
        this.updateVisible2 = true;
        this.editData2 = row;
        if (this.editData2.usergroupname != "") {
          let path = this.editData2.appid + this.editData2.appName;
          findProjectPermission(path)
            .then((res) => {
              this.projectPermission = res.data;
            })
            .catch(console.log);
        }
      }
    },
    // 确认修改
    updateTure() {
      if (this.activeName == 0) {
        var formData = new FormData();
        formData.append("id", this.editData1.id);
        formData.append("username", this.editData1.username);
        formData.append("phonenum", this.editData1.phonenum);
        formData.append("email", this.editData1.email);
        formData.append(
          "licensetype",
          valToId(this.editData1.licensetype, this.userOption)
        );
        formData.append("licensetime", new Date(this.editData1.licensetime));
        updateUser(formData)
          .then((res) => {
            const { msg } = res;
            if (msg == "OK") {
              this.$message.success("修改成功!");
              this.reload();
            }
          })
          .catch(console.log);
      } else {
        var formData = new FormData();
        formData.append("id", this.editData2.id);
        formData.append("userid", this.editData2.userid);
        formData.append("appid", this.editData2.appid);
        formData.append("appName", this.editData2.appName);
        formData.append(
          "control",
          valToId(this.editData2.control, this.projectPermission)
        );
        updateUserRole(formData)
          .then((res) => {
            const { msg } = res;
            if (msg == "OK") {
              this.$message.success("修改成功!");
              this.reload();
            }
          })
          .catch(console.log);
      }
    },

    // 删除用户管理
    handleDelete(index, row) {
      showDelBox().then(()=>{
        if (this.activeName == 0) {
          deleteUser(row.id)
            .then((res) => {
              const { status } = res;
              if (status == 20000) {
                this.$message.success("删除成功!");
                this.reload();
              }
            })
            .catch(console.log);
        } else {
          deleteUserRole(row.id, row.appid, row.appName, row.userid)
            .then((res) => {
              const { status } = res;
              if (status == 20000) {
                this.$message.success("删除成功!");
                this.reload();
              }
            })
            .catch(console.log);
        }
      })
    },
  },
};
</script>

<style lang="scss" scoped>
.building-information-container {
  .el-col {
    border-radius: 4px;
  }
  .bg-purple-dark {
    background: #99a9bf;
  }
  .bg-purple {
    position: relative;
    padding: 20px;
    background: var(--theme-color);

    .el-form {
      .el-input {
        width: 200px;
      }
    }

    .buiding-info-title {
      font-size: 18px;
      font-weight: bold;
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
    .buiding-info {
      margin-top: 30px;
      ul {
        li {
          margin: 20px 0;
          display: flex;
          justify-content: space-between;
          width: 300px;
          .el-select {
            .el-input {
              width: 200px;
            }
          }
          .el-input {
            width: 200px;
          }
          p {
            width: 100px;
            line-height: 40px;
          }
          .el-input__inner {
            width: 200px;
          }
        }
      }
    }
    .buiding-btn {
      position: absolute;
      top: 10px;
      right: 10px;
    }
  }
  .bg-purple-light {
    padding: 20px;
    background: var(--theme-color);
    .buiding-list-title {
      margin-bottom: 20px;
      font-size: 18px;
      font-weight: bold;
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
  .add-dialog {
    display: flex;
    justify-content: space-evenly;
    flex-wrap: wrap;
    .add-content {
      margin: 20px 0;
      .el-input {
        width: 200px;
      }
    }
    .add-contentNone{
        visibility: hidden;
    }
  }
  .grid-content {
    border-radius: 4px;
    min-height: 36px;
  }
}
</style>


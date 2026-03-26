<template>
  <div class="app-container project-manage-container">
    <el-row :gutter="10">
      <el-col :xs="24" :sm="24" :md="24" :lg="24" :xl="24">
        <div class="grid-content bg-purple-light">
          <div class="project-info">
            <div class="project-list">
              <p class="project-list-title">项目列表</p>
              <el-button type="primary" @click="addDialogFormVisible = true"
                >新增项目</el-button
              >
            </div>
            <div class="project-number">
              当前项目数量
              <span>{{ objectNum }}</span>
            </div>
          </div>
          <el-table
            :data="tableDatas"
            border
            style="width: 100%"
            max-height="700px"
          >
            <el-table-column
              prop="appid"
              label="ID"
              width="80"
            ></el-table-column>
            <el-table-column
              prop="appName"
              label="数据库名称"
            ></el-table-column>
            <el-table-column
              prop="ipaddr"
              label="项目节点ip地址"
              width="150"
            ></el-table-column>
            <el-table-column
              prop="appport"
              label="项目节点端口号"
              width="120"
            ></el-table-column>
            <el-table-column
              prop="customer"
              label="项目节点用户名"
              width="120"
            ></el-table-column>
            <el-table-column
              prop="appexplain"
              label="项目名称"
            ></el-table-column>
            <el-table-column
              prop="apptypename"
              label="项目类型"
              width="150"
            ></el-table-column>

            <el-table-column prop="appstate" label="是否初始化" width="95">
              <template slot-scope="scope">
                <p v-if="scope.row.appstate === '1'">已初始化</p>
                <p v-if="scope.row.appstate === '0'">未初始化</p>
              </template>
            </el-table-column>

            <el-table-column label="是否删除" width="80">
              <template slot-scope="scope">
                <p v-if="scope.row.state === '1'">已删除</p>
                <p v-if="scope.row.state === '0'">未删除</p>
              </template>
            </el-table-column>

            <el-table-column
              prop="region"
              label="所属省份"
              width="80"
            ></el-table-column>
            <el-table-column
              prop="city"
              label="所属城市"
              width="80"
            ></el-table-column>
            <el-table-column prop="longitude" label="经度" width="80"></el-table-column>
            <el-table-column prop="latitude" label="纬度" width="80"></el-table-column>
            <el-table-column fixed="right" label="操作" width="260">
              <template slot-scope="scope">
                <el-button
                  class="creat-database"
                  v-if="scope.row.appstate === '0'"
                  type="warning"
                  size="mini"
                  @click="createDB(scope.$index, scope.row)"
                  >创建数据库</el-button
                >
                <el-button
                  v-if="scope.row.appstate === '1'"
                  type="primary"
                  size="mini"
                  icon="el-icon-edit"
                  @click="enterObject(scope.$index, scope.row)"
                  >进入项目</el-button
                >
                <el-button
                  type="success"
                  size="mini"
                  @click="handelEdit(scope.$index, scope.row)"
                  >编辑</el-button
                >
                <el-button
                  type="danger"
                  size="mini"
                  @click="handelDelete(scope.$index, scope.row)"
                  >移除</el-button
                >
              </template>
            </el-table-column>
          </el-table>
<!--          <div class="el-pagination">
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
          </div>-->
          <div class="el-pagination">
            <el-pagination
                :current-page="currentPage"
                :page-size="pagesize"
                :page-sizes="[10, 20, 30, 50]"
                :total="rowCount"
                layout="total, sizes, prev, pager, next, jumper"
                @size-change="handleSizeChange"
                @current-change="handleCurrentChange"
            >
            </el-pagination>
          </div>
          <el-dialog
            title="新增项目"
            :visible.sync="addDialogFormVisible"
            width="55%"
          >
            <el-form
              label-position="left"
              label-width="120px"
              :model="ruleForm"
              :rules="rules"
              ref="ruleForm"
            >
              <el-form-item label="数据库名称" prop="dbName">
                <el-input
                  v-model="ruleForm.dbName"
                  clearable
                  placeholder="请输入数据库名称"
                />
              </el-form-item>
              <el-form-item label="3D模型地址" prop="modelIp">
                <el-input
                  v-model="ruleForm.modelIp"
                  clearable
                  placeholder="如：8:130.52.195:8099"
                />
              </el-form-item>
              <el-form-item label="项目节点ip地址">
                <el-input
                  v-model="input2"
                  clearable
                  placeholder="请输入项目节点ip地址"
                />
              </el-form-item>
              <el-form-item label="项目节点端口号">
                <el-input
                  v-model="input3"
                  clearable
                  placeholder="请输入项目节点端口号"
                />
              </el-form-item>
              <el-form-item label="项目节点用户名">
                <el-input
                  v-model="input4"
                  clearable
                  placeholder="请输入项目节点用户名"
                />
              </el-form-item>
              <el-form-item label="项目名称">
                <el-input
                  v-model="input5"
                  clearable
                  placeholder="请输入项目描述"
                />
              </el-form-item>
              <el-form-item label="项目类型">
                <el-select v-model="input6" placeholder="请选择项目类型">
                  <el-option
                    v-for="item in projectType"
                    :key="item.value"
                    :label="item.value"
                    :value="item.id"
                  ></el-option>
                </el-select>
              </el-form-item>
              <el-form-item label="经度">
                <el-input
                  v-model="longitude"
                  clearable
                  placeholder="请输入项目经度"
                />
              </el-form-item>
              <provincecity
                  ref="addFormProvince"
                  @selectChange="selectChange"
                  widthStyle="width"
              ></provincecity>
              <el-form-item label="纬度">
                <el-input
                    v-model="latitude"
                    clearable
                    placeholder="请输入项目纬度"
                />
              </el-form-item>
              <el-form-item label="项目简介">
                <el-input
                  v-model="input7"
                  :rows="4"
                  type="textarea"
                  clearable
                  placeholder="请输入项目简介"
                />
              </el-form-item>
            </el-form>
            <div slot="footer" class="dialog-footer">
              <el-button @click="addDialogFormVisible = false">取 消</el-button>
              <el-button type="primary" @click="addTrue">确 定</el-button>
            </div>
          </el-dialog>
          <el-dialog
            title="修改项目"
            :visible.sync="updateDialogFormVisible"
            width="50%"
          >
            <el-form label-position="left" label-width="120px">
              <el-form-item label="数据库名称" prop="dbName">
                <el-input
                    v-model="editData.appName"
                    clearable
                    placeholder="请输入数据库名称"
                    disabled
                />
              </el-form-item>
              <el-form-item label="3D模型地址" prop="modelIp">
                <el-input
                  v-model="editData.modelIp"
                  clearable
                  placeholder="如：8:130.52.195:8099"
                />
              </el-form-item>
              <el-form-item label="项目节点ip地址">
                <el-input
                  v-model="editData.ipaddr"
                  clearable
                  placeholder="请输入项目节点ip地址"
                />
              </el-form-item>
              <el-form-item label="项目节点端口号">
                <el-input
                  v-model="editData.appport"
                  clearable
                  placeholder="请输入项目节点端口号"
                />
              </el-form-item>
              <el-form-item label="项目节点用户名">
                <el-input
                  v-model="editData.customer"
                  clearable
                  placeholder="请输入项目节点用户名"
                />
              </el-form-item>
              <el-form-item label="项目名称">
                <el-input
                  v-model="editData.appexplain"
                  clearable
                  placeholder="请输入项目描述"
                />
              </el-form-item>
              <el-form-item label="项目类型">
                <el-select
                  v-model="editData.apptypename"
                  placeholder="请选择项目类型"
                >
                  <el-option
                    v-for="item in projectType"
                    :key="item.value"
                    :label="item.value"
                    :value="item.id"
                  ></el-option>
                </el-select>
              </el-form-item>
              <el-form-item label="经度">
                <el-input
                  v-model="editData.longitude"
                  clearable
                  placeholder="请输入项目经度"
                />
              </el-form-item>
              <provincecity
                  ref="addFormProvince"
                  :provinceName="editData.region"
                  :cityName="editData.city"
                  @selectChange="selectChange"
                  widthStyle="width"
              ></provincecity>
              <el-form-item label="纬度">
                <el-input
                  v-model="editData.latitude"
                  clearable
                  placeholder="请输入项目纬度"
                />
              </el-form-item>
              <el-form-item label="项目简介">
                <el-input
                  v-model="editData.appIntroduction"
                  :rows="4"
                  type="textarea"
                  clearable
                  placeholder="请输入项目简介"
                />
              </el-form-item>
            </el-form>
            <div slot="footer" class="dialog-footer">
              <el-button @click="updateDialogFormVisible = false"
                >取 消</el-button
              >
              <el-button type="primary" @click="updateObject">确 定</el-button>
            </div>
          </el-dialog>
        </div>
      </el-col>
    </el-row>
  </div>
</template>

<script>
import {addObject, checkName, createDB, findObject, removeObject, updateObject} from "@/api/basesetting/objectmanage";
import provincecity from "@/components/ProvinceCity";
import {valToId} from "@/utils/selectexchange";
import {showDelBox} from '@/utils/elmessage'
import dayjs from "dayjs";

export default {
  inject: ["reload"],
  name: "ObjectManage",
  components: {
    provincecity
  },
  data () {
    var validateDbName = (rule, value, callback) => {
      if (value === "") {
        callback(new Error("请输入数据库名"));
      } else {
        let regEn = /^[a-zA-Z]+$/;
        if (!regEn.test(value)) {
          callback(new Error("请输入英文"));
        } else {
          checkName(value)
            .then(res => {
              if (!res.data) {
                callback(new Error("该项目名已存在"));
              }
              callback();
            })
            .catch(console.log);
        }
      }
    };
    return {
      ruleForm: {
        dbName: "" ,// 数据库名称
        modelIp:''
      },
      rules: {
        dbName: [{ validator: validateDbName, trigger: "blur" }]
      },
      objectNum: 0,
      currentPage: 1,
      rowCount: 0,
      pagesize: 10,
      input2: "",
      input3: "",
      input4: "",
      input5: "",
      input6: "设备物联大数据平台",
      input7: "",
      province: "",
      city: "",
      longitude: "", // 项目经度
      latitude: "", // 项目纬度
      addDialogFormVisible: false,
      updateDialogFormVisible: false,
      projectType: [
        {
          id: 2,
          value: "设备物联大数据平台"
        },
        {
          id: 1,
          value: "电力运维平台"
        }
      ],
      tableDatas: [],
      editData: {}
    };
  },
  created () {
    // 查询所有项目类型
    // findProType()
    //   .then(res => {
    //     res.data.forEach(ele => {
    //       let obj = {
    //         id: ele.id,
    //         value: ele.apptypename
    //       };
    //       this.projectType.push(obj);
    //     });
    //   })
    //   .catch(console.log);
    // 查询所有项目
    this.findAllObject(this.currentPage, this.pagesize, 0);
  },
  methods: {
    // 查询所有项目
    findAllObject (currentPage, pageSize, state) {
      findObject(currentPage, pageSize, state)
        .then(res => {
          this.tableDatas = res.data.records;
          this.objectNum = res.data.rowCount;
          this.rowCount = res.data.rowCount;
        })
        .catch(console.log);
    },
    // 改变显示页数
    handleSizeChange (size) {
      this.pagesize = size;
      this.currentPage = 1;
      this.findAllObject(this.currentPage, this.pagesize, 0);
    },
    // 跳页
    handleCurrentChange (currentpage) {
      this.currentPage = currentpage;
      if (this.tableDatas.length < this.rowCount) {
        this.findAllObject(this.currentPage, this.pagesize, 0);
      }
    },
    // 上一页
    prev () {
      if (this.currentPage === 1) {
        this.currentPage = 1;
      } else {
        this.currentPage--;
        if (this.tableDatas.length < this.rowCount) {
          this.findAllObject(this.currentPage, this.pagesize, 0);
        }
      }
    },
    // 下一页
    next () {
      const maxPage = Math.ceil(this.rowCount / this.pagesize);
      if (this.currentPage < maxPage) {
        this.currentPage++;
        if (this.tableDatas.length < this.rowCount) {
          this.findAllObject(this.currentPage, this.pagesize, 0);
        }
      }
    },
    // 选择省市
    selectChange (province, city) {
      this.province = province;
      this.city = city;
      if (this.editData != {}) {
        this.editData.region = province;
        this.editData.city = city;
      }
    },
    // 新增项目
    addTrue () {
      console.log(this.$refs.ruleForm);
      this.$refs.ruleForm.validate(valid => {
        if (valid) {
          if (
            this.input2 === "" ||
            this.input3 === "" ||
            this.input4 === "" ||
            this.input5 === "" ||
            this.province === "" ||
            this.city === "" ||
            this.longitude === "" ||
            this.latitude === "" ||
            this.ruleForm.modelIp === ''
          ) {
            this.$message.error("项目下的所有内容都为必填项，请填写完整！");
          } else {
            this.dialogFormVisible = false;
            var formData = new FormData();
            formData.append("appName", this.ruleForm.dbName);
            formData.append("modelIp", this.ruleForm.modelIp);
            formData.append("ipaddr", this.input2);
            formData.append("appport", this.input3);
            formData.append("customer", this.input4);
            formData.append("appexplain", this.input5);
            formData.append(
              "apptypeid",
              valToId(this.input6, this.projectType)
            );
            formData.append("region", this.province);
            formData.append("city", this.city);
            formData.append("longitude", this.longitude);
            formData.append("latitude", this.latitude);
            formData.append("appIntroduction", this.input7);
            formData.append("createTime", dayjs().format("YYYY-MM-DD hh:mm:ss"));
            addObject(formData)
              .then(res => {
                if (res.status === 20000) {
                  this.$message.success("新增成功!");
                  this.reload();
                }
              })
              .catch(console.log);
          }
        } else {
          console.log("error submit!!");
          return false;
        }
      });
    },
    // 编辑项目
    handelEdit (index, row) {
      this.updateDialogFormVisible = true;
      this.editData = row;
      console.log('编辑',row)
    },
    // 确认修改项目
    updateObject () {
      var formData = new FormData();
      formData.append("appid", this.editData.appid);
      formData.append("ipaddr", this.editData.ipaddr);
      formData.append("appport", this.editData.appport);
      formData.append("appimg", this.editData.appimg);
      formData.append("appexplain", this.editData.appexplain);
      formData.append("state", this.editData.state);
      formData.append("modelIp", this.editData.modelIp);
      formData.append(
        "apptypeid",
        valToId(this.editData.apptypename, this.projectType)
      );
      formData.append("region", this.editData.region);
      formData.append("city", this.editData.city);
      formData.append("longitude", this.editData.longitude);
      formData.append("latitude", this.editData.latitude);
      formData.append("appIntroduction", this.editData.appIntroduction);
      updateObject(formData)
        .then(res => {
          if (res.status === 20000) {
            this.$message.success("修改成功!");
            this.reload();
          }
        })
        .catch(console.log);
    },
    // 移除项目
    handelDelete (index, row) {
      showDelBox().then(()=>{
        console.log('成功了')
        removeObject(row.appid, 1)
            .then(res => {
              if (res.status === 20000) {
                this.$message.success("移除成功!");
                this.reload();
              }
            })
      })
    },
    // 进入项目配置
    enterObject (index, row) {
      // 选择项目后把项目名和ID存到vuex中
      this.$store
        .dispatch("project/selectProject", row)
        .then(() => {
          this.$router.push({
            path: "/baseinformation/ProjectInformation"
          });
          setTimeout(() => {
            window.location.reload();
          }, 1000);
        })
        .catch(console.log);
    },
    // 创建项目数据库
    createDB (index, row) {
      let DBname = row.appid + row.appName;
      createDB(row.appid, DBname)
        .then(res => {
          if (res.status === 20000) {
            this.$message.success("该项目数据库已创建成功！");
            this.reload();
          }
        })
        .catch(console.log);
    }
  }
};
</script>

<style lang="scss" scoped>
::v-deep .el-table__body-wrapper::-webkit-scrollbar {
  width: 8px; // 横向滚动条
  height: 8px; // 纵向滚动条 必写
}
::v-deep .el-table__body-wrapper::-webkit-scrollbar-thumb {
  background-color: #dde;
  border-radius: 3px;
}
.el-table ::-webkit-scrollbar{
  display: inline !important;
}
.project-manage-container {
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
    .project-info {
      display: flex;
      justify-content: space-between;
      margin-bottom: 20px;
      .project-list {
        display: flex;
        justify-content: space-between;
        .project-list-title {
          font-size: 18px;
          font-weight: bold;
          line-height: 30px;
          margin-right: 10px;
        }
      }
      .project-number {
        font-weight: bold;
        span {
          font-size: 20px;
          color: red;
        }
      }
    }
    .creat-database {
      width: 98px;
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
  .el-form {
    display: flex;
    justify-content: space-evenly;
    flex-wrap: wrap;
    .el-input {
      width: 200px;
    }
    .el-select {
      width: 200px;
    }
    .el-textarea {
      width: 550px;
    }
  }
  .grid-content {
    border-radius: 4px;
    min-height: 36px;
  }
}
</style>
<style lang="scss">
.project-manage-container {
  .el-select--medium {
    width: 100px;
  }
}
</style>
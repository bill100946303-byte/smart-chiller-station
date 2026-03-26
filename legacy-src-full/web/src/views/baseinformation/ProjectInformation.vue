<template>
  <div class="app-container building-information-container">
    <el-row :gutter="10">
      <el-col>
        <div class="grid-content bg-purple">
          <div class="project-info-title">
            <p>项目信息</p>
            <el-button
              type="primary"
              v-if="tableDatas.length == 0"
              @click="addDialogFormVisible = true"
              >增加</el-button
            >
          </div>
          <el-table
            :data="tableDatas"
            border
            style="width: 100%"
            max-height="600"
          >
            <af-table-column prop="appname" label="项目名称" />
            <af-table-column prop="applogotype" label="LOGO类型" />
            <af-table-column prop="applogotext" label="LOGO文字显示" />
<!--            <af-table-column prop="applogoimg" label="LOGO图片显示">-->
            <af-table-column label="LOGO图片显示">
              <template slot-scope="scope">
                <el-image :src="host + scope.row.applogoimg" :alt="scope.row.applogoimg">
                  <div slot="error">{{scope.row.applogoimg}}</div>
                </el-image>
              </template>
            </af-table-column>>
            <af-table-column prop="apparea" label="项目面积" />
            <af-table-column prop="appdate" label="项目创建时间" />
            <af-table-column prop="appman" label="项目人数" />
<!--            <af-table-column prop="apppic" label="项目图片显示">-->
            <af-table-column label="项目图片显示">
              <template slot-scope="scope">
                <el-image :src="host + scope.row.apppic" :alt="scope.row.apppic">
                  <div slot="error">{{scope.row.apppic}}</div>
                </el-image>
              </template>
            </af-table-column>
            <el-table-column fixed="right" label="操作" width="150">
              <template slot-scope="scope">
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
                  >删除</el-button
                >
              </template>
            </el-table-column>
          </el-table>
        </div>
        <el-dialog title="新增项目信息" :visible.sync="addDialogFormVisible">
          <el-form class="form" ref="form">
            <el-form-item label="项目名称">
              <el-input v-model="project" readonly />
            </el-form-item>
            <el-form-item label="LOGO类型">
              <el-select
                v-model="applogotype"
                clearable
                placeholder="请选择LOGO类型"
              >
                <el-option
                  v-for="item in options"
                  :key="item.value"
                  :label="item.value"
                  :value="item.id"
                ></el-option>
              </el-select>
            </el-form-item>
            <el-form-item label="LOGO文字">
              <el-input
                v-model="logoText"
                clearable
                placeholder="请输入LOGO文字"
              />
            </el-form-item>
            <el-form-item label="项目面积">
              <el-input
                v-model="projectArea"
                clearable
                placeholder="请输入项目面积"
              />
            </el-form-item>
            <el-form-item label="项目创建时间">
              <el-date-picker
                v-model="projectCreateTime"
                type="date"
                placeholder="选择项目创建时间"
              ></el-date-picker>
            </el-form-item>
            <el-form-item label="项目人数">
              <el-input
                v-model="projectPeople"
                clearable
                placeholder="请输入项目人数"
              />
            </el-form-item>
            <el-form-item label="LOGO图片" class="upload">
              <MyImgUpload @upload="uploadLogoImg" />
            </el-form-item>
            <el-form-item label="项目图片" class="upload">
              <MyImgUpload @upload="uploadProjectImg" />
            </el-form-item>
          </el-form>
          <div slot="footer" class="dialog-footer">
            <el-button @click="addDialogFormVisible = false">取 消</el-button>
            <el-button type="primary" @click="handelAdd">确 定</el-button>
          </div>
        </el-dialog>
        <el-dialog title="修改项目信息" :visible.sync="updateDialogFormVisible">
          <el-form class="form" ref="form">
            <el-form-item label="项目名称">
              <el-input v-model="editeData.appname" readonly />
            </el-form-item>
            <el-form-item label="LOGO类型">
              <el-select
                v-model="editeData.applogotype"
                clearable
                placeholder="请选择LOGO类型"
              >
                <el-option
                  v-for="item in options"
                  :key="item.value"
                  :label="item.value"
                  :value="item.id"
                ></el-option>
              </el-select>
            </el-form-item>
            <el-form-item label="LOGO文字">
              <el-input
                v-model="editeData.applogotext"
                clearable
                placeholder="请输入LOGO文字"
              />
            </el-form-item>
            <el-form-item label="项目面积">
              <el-input
                v-model="editeData.apparea"
                clearable
                placeholder="请输入项目面积"
              />
            </el-form-item>
            <el-form-item label="项目创建时间">
              <el-date-picker
                v-model="editeData.appdate"
                type="date"
                placeholder="选择项目创建时间"
              ></el-date-picker>
            </el-form-item>
            <el-form-item label="项目人数">
              <el-input
                v-model="editeData.appman"
                clearable
                placeholder="请输入项目人数"
              />
            </el-form-item>
            <el-form-item label="LOGO图片" class="upload">
              <img class="project-img" :src="baseUrl + editeData.applogoimg" />
              <MyImgUpload class="upload-logo-img" @upload="uploadLogoImg" />
            </el-form-item>
            <el-form-item label="项目图片" class="upload">
              <img class="project-img" :src="baseUrl + editeData.apppic" />
              <MyImgUpload
                class="upload-project-img"
                @upload="uploadProjectImg"
              />
            </el-form-item>
          </el-form>
          <div slot="footer" class="dialog-footer">
            <el-button @click="updateDialogFormVisible = false"
              >取 消</el-button
            >
            <el-button type="primary" @click="handelUpdate">确 定</el-button>
          </div>
        </el-dialog>
      </el-col>
    </el-row>
  </div>
</template>

<script>
import {mapGetters} from "vuex";
import MyImgUpload from "@/components/MyImgUpload";
import {
  addProject,
  deleteProject,
  findProject,
  updateProject,
} from "@/api/contentsetting/baseinformation/projectinformation";
import {idToVal, valToId} from "@/utils/selectexchange";
import {formatDay} from "@/utils/index";

export default {
  inject: ["reload"],
  name: "ProjectInformation",
  components: {
    MyImgUpload,
  },
  computed: {
    ...mapGetters(["path", "project", "appexplain"]),
  },
  data() {
    return {
      baseUrl: "",
      logoType: "", // LOGO类型
      logoText: "", // LOGO文字
      logoImg: "", // LOGO图片
      applogotype: "", // LOGO类型
      projectArea: "", // 项目面积
      projectCreateTime: "", // 项目创建时间
      projectPeople: "", // 项目人数
      projectImg: "", // 项目图片
      addDialogFormVisible: false, // 控制项目新增页面弹窗
      updateDialogFormVisible: false, // 控制项目修改页面弹窗
      currentPage: 1, // 初始页
      pagesize: 10,
      rowCount: 0,
      options: [
        {
          id: 1,
          value: "显示文字",
        },
        {
          id: 2,
          value: "显示图片",
        },
      ],
      tableDatas: [],
      editeData: {},
      // host:'http://' + window.location.host
      host: this.global.baseUrl
      // host:'http://8.130.52.195:8098/'
    };
  },
  created() {
    this.baseUrl = this.global.baseUrl;
    // 查询所有项目信息
    this.findAllProject(this.path, this.currentPage, this.pagesize);
  },
  methods: {
    // 查询所有项目信息
    findAllProject(path, currentPage, pageSize) {
      findProject(path, currentPage, pageSize)
        .then((res) => {
          this.rowCount = res.data.rowCount;
          this.tableDatas = res.data.records;
          this.tableDatas.forEach((ele) => {
            ele.applogotype = idToVal(ele.applogotype, this.options);
            if (ele.appdate != null) {
              ele.appdate = formatDay(ele.appdate);
            }
          });
        })
        .catch(console.log);
    },
    // 改变显示页数
    handleSizeChange(size) {
      this.pagesize = size;
      this.currentPage = 1;
      this.findAllProject(this.path, this.currentPage, this.pagesize);
    },
    // 跳页
    handleCurrentChange(currentpage) {
      this.currentPage = currentpage;
      if (this.tableDatas.length < this.rowCount) {
        this.findAllProject(this.path, this.currentPage, this.pagesize);
      }
    },
    // 上一页
    prev() {
      if (this.currentPage === 1) {
        this.currentPage = 1;
      } else {
        this.currentPage--;
        if (this.tableDatas.length < this.rowCount) {
          this.findAllProject(this.path, this.currentPage, this.pagesize);
        }
      }
    },
    // 下一页
    next() {
      const maxPage = Math.ceil(this.rowCount / this.pagesize);
      if (this.currentPage < maxPage) {
        this.currentPage++;
        if (this.tableDatas.length < this.rowCount) {
          this.findAllProject(this.path, this.currentPage, this.pagesize);
        }
      }
    },
    // 上传logo图片
    uploadLogoImg(file) {
      this.logoImg = file;
    },
    // 上传项目图片
    uploadProjectImg(file) {
      this.projectImg = file;
    },
    // 增加
    handelAdd() {
      // 封装data
      var formData = new FormData();
      formData.append("appname", this.project);
      formData.append("applogotype", this.applogotype);
      formData.append("applogotext", this.logoText);
      formData.append("apparea", this.projectArea);
      formData.append("appman", this.projectPeople);
      if (this.projectCreateTime != "" && this.projectCreateTime != null) {
        formData.append("appdate", this.projectCreateTime);
      }
      if (this.logoImg != "") {
        formData.append("file1", this.logoImg);
      }
      if (this.projectImg != "") {
        formData.append("file2", this.projectImg);
      }
      addProject(this.path, formData)
        .then((res) => {
          if (res.status === 20000) {
            this.$message.success("新增成功!");
            this.reload();
          }
        })
        .catch(console.log);
    },
    // 编辑
    handelEdit(index, row) {
      this.updateDialogFormVisible = true;
      this.editeData = row;
    },
    // 修改
    handelUpdate() {
      var formData = new FormData();
      formData.append("appid", this.editeData.appid);
      formData.append("appname", this.editeData.appname);
      formData.append(
        "applogotype",
        valToId(this.editeData.applogotype, this.options)
      );
      formData.append("applogotext", this.editeData.applogotext);
      formData.append("apparea", this.editeData.apparea);
      if (this.editeData.appman != null) {
        formData.append("appman", this.editeData.appman);
      }
      if (this.editeData.appdate != "" && this.editeData.appdate != null) {
        formData.append("appdate", new Date(this.editeData.appdate));
      }
      if (this.logoImg != "") {
        formData.append("file1", this.logoImg);
      }
      if (this.projectImg != "") {
        formData.append("file2", this.projectImg);
      }
      updateProject(this.path, formData)
        .then((res) => {
          if (res.status === 20000) {
            this.$message.success("修改成功!");
            this.reload();
          }
        })
        .catch(console.log);
    },

    // 删除
    handelDelete(index, row) {
      let tip = confirm("确定要删除该项目的信息吗？");
      if (tip === true) {
        deleteProject(this.path, row.appid)
          .then((res) => {
            if (res.status === 20000) {
              this.$message.success("删除成功!");
              this.reload();
            }
          })
          .catch(console.log);
      }
    },
  },
};
</script>

<style lang="scss" scoped>
.building-information-container {
  .el-col {
    border-radius: 4px;
  }
  .bg-purple {
    position: relative;
    padding: 20px;
    background: var(--theme-color);

    .project-info-title {
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
    .form {
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;
      .el-input {
        width: 200px;
      }
      .el-form-item {
        width: 33%;
        .project-img {
          width: 148px;
          height: 148px;
        }
        .upload-logo-img {
          margin-left: 80px;
        }
        .upload-project-img {
          margin-left: 67px;
        }
      }
      .upload {
        width: 50%;
      }
    }
  }

  .grid-content {
    border-radius: 4px;
    min-height: 36px;
  }
}
</style>

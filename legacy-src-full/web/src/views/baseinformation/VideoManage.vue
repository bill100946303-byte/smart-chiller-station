<template>
  <div class="app-container video-manage-container">
    <el-row :gutter="10">
      <el-col :md="24" :lg="9" :xl="7">
        <div class="grid-content bg-purple">
          <p>视频配置</p>
          <el-form
            label-position="left"
            label-width="80px"
            class="form"
            ref="form"
          >
            <el-form-item label="视频ID">
              <el-input v-model="input0" placeholder="请输入视频ID" clearable />
            </el-form-item>
            <el-form-item label="视频类型">
              <el-select v-model="videoType" placeholder="请选择视频类型">
                <el-option
                  v-for="item in videoTypeOptions"
                  :key="item.value"
                  :label="item.value"
                  :value="item.id"
                ></el-option>
              </el-select>
            </el-form-item>
            <el-form-item label="驱动ID">
              <el-input v-model="input1" placeholder="请输入驱动ID" clearable />
            </el-form-item>
            <el-form-item label="IP地址">
              <el-input
                class="el-input"
                v-model="input2"
                placeholder="请输入IP地址"
                clearable
              />
            </el-form-item>
            <el-form-item label="端口号">
              <el-input
                class="el-input"
                v-model="input3"
                placeholder="请输入端口号"
              />
            </el-form-item>
            <el-form-item label="登录名">
              <el-input
                class="el-input"
                v-model="input4"
                placeholder="请输入登录名"
              />
            </el-form-item>
            <el-form-item label="密码">
              <el-input
                class="el-input"
                v-model="input5"
                placeholder="请输入密码"
              />
            </el-form-item>
            <el-form-item label="通道号">
              <el-input
                class="el-input"
                v-model="input6"
                placeholder="请输入通道号"
              />
            </el-form-item>
            <el-form-item label="云台控制">
              <el-select
                v-model="input7"
                clearable
                placeholder="请选择云台控制"
              >
                <el-option
                  v-for="item in options"
                  :key="item.value"
                  :label="item.value"
                  :value="item.value"
                ></el-option>
              </el-select>
            </el-form-item>
            <el-form-item label="控制速度">
              <el-input
                class="el-input"
                v-model="input8"
                placeholder="请输入控制速度"
              />
            </el-form-item>
            <div class="video-btn">
              <el-button type="primary" @click="handelAdd">增加</el-button>
              <el-button type="primary" @click="updateVideo"
                >确认修改</el-button
              >
            </div>
          </el-form>
        </div>
      </el-col>
      <el-col :md="24" :lg="15" :xl="17">
        <div class="grid-content bg-purple-light">
          <div class="video-list">
            <p class="video-list-title">详细</p>
            <el-button type="primary" @click="leadout">视频导出</el-button>
            <ExcelUpload
              class="upload"
              :btnName="btnName"
              @excelUpload="uploadFile"
            />
            <el-button type="danger" @click="handelDeletes">批量删除</el-button>
            <el-button type="primary" @click="startVideos">启动视频</el-button>
            <el-button type="info" @click="stopVideos">一键停止</el-button>
          </div>
          <el-table
            :data="tableDatas"
            border
            style="width: 100%"
            max-height="600"
            @selection-change="selectVideos"
          >
            <el-table-column type="selection" width="55"></el-table-column>
            <af-table-column prop="id" label="序号"></af-table-column>
            <af-table-column prop="spId" label="视频ID"></af-table-column>
            <af-table-column prop="spType" label="视频类型"></af-table-column>
            <af-table-column prop="spDllPath" label="驱动ID"></af-table-column>
            <af-table-column prop="spIp" label="IP地址"></af-table-column>
            <af-table-column prop="spPort" label="端口号"></af-table-column>
            <af-table-column prop="spUser" label="登录名"></af-table-column>
            <af-table-column prop="spCamera" label="通道号"></af-table-column>
            <af-table-column
              prop="spPtztype"
              label="云台控制"
            ></af-table-column>
            <af-table-column prop="monitor" label="控制速度"></af-table-column>
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
import ExcelUpload from "@/components/MyImgUpload/ExcelUpload";
import {
  outputExcel,
  inputExcel,
  findVideo,
  addVideo,
  updateVideo,
  deleteVideo,
  startVideos,
  stopVideos
} from "@/api/contentsetting/baseinformation/videomanage";
import { exportExcel } from "@/utils/excel";
import { valToId, idToVal } from "@/utils/selectexchange";
export default {
  inject: ["reload"],
  name: "VideoManage",
  components: {
    ExcelUpload
  },
  computed: {
    ...mapGetters(["path"])
  },
  data () {
    return {
      btnName: "视频导入",
      videos: [],
      input0: "", // 视频ID
      videoType: "大华", // 视频类型
      videoTypeOptions: [
        {
          id: 1,
          value: "大华"
        },
        {
          id: 2,
          value: "海康"
        }
      ], // 视频类型选择
      input1: "", // 驱动ID
      input2: "", // IP地址
      input3: "", // 端口号
      input4: "", // 登录名
      input5: "", // 密码
      input6: "", // 通道号
      input7: "", // 云台控制
      input8: "", // 控制速度
      currentPage: 1, // 初始页
      pagesize: 5,
      rowCount: 0,
      options: [
        {
          value: "PTZ",
          value: "PTZ"
        },
        {
          value: "NVR",
          value: "NVR"
        }
      ],
      tableDatas: [],
      editData: {}
    };
  },
  created () {
    // 查询所有视频
    this.findAllVideo(this.path, this.currentPage, this.pagesize);
  },
  methods: {
    // 查询所有视频
    findAllVideo (path, currentPage, pageSize) {
      findVideo(path, currentPage, pageSize)
        .then(res => {
          this.rowCount = res.data.rowCount;
          this.tableDatas = res.data.records;
          this.tableDatas.forEach(ele => {
            ele.spType = idToVal(ele.spType, this.videoTypeOptions)
          })
        })
        .catch(console.log);
    },
    // 改变显示页数
    handleSizeChange (size) {
      this.pagesize = size;
      this.currentPage = 1;
      this.findAllVideo(this.path, this.currentPage, this.pagesize);
    },
    // 跳页
    handleCurrentChange (currentpage) {
      this.currentPage = currentpage;
      if (this.tableDatas.length < this.rowCount) {
        this.findAllVideo(this.path, this.currentPage, this.pagesize);
      }
    },
    // 上一页
    prev () {
      if (this.currentPage === 1) {
        this.currentPage = 1;
      } else {
        this.currentPage--;
        if (this.tableDatas.length < this.rowCount) {
          this.findAllVideo(this.path, this.currentPage, this.pagesize);
        }
      }
    },
    // 下一页
    next () {
      const maxPage = Math.ceil(this.rowCount / this.pagesize);
      if (this.currentPage < maxPage) {
        this.currentPage++;
        if (this.tableDatas.length < this.rowCount) {
          this.findAllVideo(this.path, this.currentPage, this.pagesize);
        }
      }
    },
    // 增加视频
    handelAdd () {
      var formData = new FormData();
      formData.append("spId", this.input0);
      formData.append("spType", valToId(this.videoType, this.videoTypeOptions));
      formData.append("spDllPath", this.input1);
      formData.append("spIp", this.input2);
      formData.append("spPort", this.input3);
      formData.append("spUser", this.input4);
      formData.append("spPassword", this.input5);
      formData.append("spCamera", this.input6);
      formData.append("spPtztype", this.input7);
      formData.append("monitor", this.input8);
      addVideo(this.path, formData)
        .then(res => {
          if (res.status === 20000) {
            this.$message.success("新增成功!");
            this.findAllVideo(this.path, this.currentPage, this.pagesize);
          }
        })
        .catch(console.log);
    },
    // 编辑视频
    handelEdit (index, row) {
      this.editData = row;
      this.input0 = row.spId;
      this.videoType = row.spType
      this.input1 = row.spDllPath;
      this.input2 = row.spIp;
      this.input3 = row.spPort;
      this.input4 = row.spUser;
      this.input5 = row.spPassword;
      this.input6 = row.spCamera;
      this.input7 = row.spPtztype;
      this.input8 = row.monitor;
    },
    // 修改视频
    updateVideo () {
      var formData = new FormData();
      formData.append("id", this.editData.id);
      formData.append("spId", this.input0);
      formData.append("spType", valToId(this.videoType, this.videoTypeOptions));
      formData.append("spDllPath", this.input1);
      formData.append("spIp", this.input2);
      formData.append("spPort", this.input3);
      formData.append("spUser", this.input4);
      formData.append("spPassword", this.input5);
      formData.append("spCamera", this.input6);
      formData.append("spPtztype", this.input7);
      formData.append("monitor", this.input8);
      updateVideo(this.path, formData)
        .then(res => {
          if (res.status === 20000) {
            this.$message.success("修改成功!");
            this.findAllVideo(this.path, this.currentPage, this.pagesize);
          }
        })
        .catch(console.log);
    },
    // 删除视频
    handelDelete (index, row) {
      let tip = confirm("确定要删除该视频吗？");
      if (tip) {
        deleteVideo(this.path, row.id)
          .then(res => {
            if (res.status === 20000) {
              this.$message.success("删除成功!");
              this.findAllVideo(this.path, this.currentPage, this.pagesize);
            }
          })
          .catch(console.log);
      }
    },
    // 选择视频
    selectVideos (val) {
      this.videos = val;
    },
    // 批量删除视频
    handelDeletes () {
      let tip = confirm("确定要批量删除视频吗？");
      if (tip) {
        let ids = [];
        this.videos.forEach(ele => {
          ids.push(ele.id);
        });
        deleteVideo(this.path, ids.join(","))
          .then(res => {
            if (res.status === 20000) {
              this.$message.success("删除成功!");
              this.findAllVideo(this.path, this.currentPage, this.pagesize);
            }
          })
          .catch(console.log);
      }
    },
    // 启动视频
    startVideos () {
      let ids = [];
      this.videos.forEach(ele => {
        ids.push(ele.id);
      });
      startVideos(this.path, ids.join(","))
        .then(res => {
          if (res.status === 20000) {
            this.$message.success("视频启动成功");
          }
        })
        .catch(console.log);
    },
    // 停止视频
    stopVideos () {
      stopVideos(this.path)
        .then(res => {
          if (res.status === 20000) {
            this.$message.success("视频关闭成功");
          }
        })
        .catch(console.log);
    },
    // 视频导入
    uploadFile (file) {
      var formData = new FormData();
      formData.append("file", file);
      const loading = this.$loading({
        lock: true,
        text: "数据正在导入数据库，请稍等",
        spinner: "el-icon-loading",
        background: "rgba(0, 0, 0, 0.7)"
      });
      inputExcel(this.path, formData)
        .then(res => {
          if (res.status === 20000) {
            loading.close();
            this.$message.success("成功导入数据库!");
            this.reload();
          }
        })
        .catch(()=>loading.close());
    },
    // 视频导出
    leadout () {
      outputExcel(this.path)
        .then(res => {
          const filename = "视频管理.xls";
          exportExcel(res, filename);
        })
        .catch(console.log);
    }
  }
};
</script>

<style lang="scss" scoped>
.video-manage-container {
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

    p {
      margin-bottom: 20px;
      font-size: 18px;
      font-weight: bold;
    }
    .form {
      .el-form-item {
        .el-input {
          width: 200px;
        }
      }
      .video-btn {
        position: absolute;
        top: 10px;
        right: 10px;
      }
    }
  }
  .bg-purple-light {
    padding: 20px;
    background: var(--theme-color);
    .video-list {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 20px;
      width: 600px;
      .video-list-title {
        font-size: 18px;
        font-weight: bold;
      }
      .el-button {
        margin-left: 0;
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

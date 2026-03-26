<template>
  <div class="app-container">
    <el-row :gutter="10">
      <el-col :md="24" :lg="9" :xl="7">
        <div class="grid-content bg-purple">
          <p>图片编辑</p>
          <el-form class="form" ref="form">
            <el-form-item label="图片名称">
              <el-input
                v-model="imgName"
                clear="el-input"
                placeholder="请输入图片名称"
                clearable
              />
            </el-form-item>
            <el-form-item label="图片类型">
              <el-select
                v-model="imgType"
                @change="valueChange"
                clearable
                placeholder="请选择图片类型"
              >
                <el-option
                  v-for="(item, index) in options"
                  :key="index"
                  :label="item.value"
                  :value="item.item"
                ></el-option>
              </el-select>
            </el-form-item>
          </el-form>
          <div class="img-upload">
            <img class="show-img" :src="imgUrl" />
            <MyImgUpload @upload="uploadFile" />
          </div>
          <div class="img-btn">
            <el-button type="primary" @click="handelAdd">增加</el-button>
            <el-button type="primary" @click="updateImg">确认修改</el-button>
          </div>
        </div>
      </el-col>
      <el-col :md="24" :lg="15" :xl="17">
        <div class="grid-content bg-purple-light">
          <p>详细</p>
          <el-table
            :data="tableDatas"
            border
            style="width: 100%"
            max-height="600"
          >
            <af-table-column prop="imgid" label="序号"></af-table-column>
            <af-table-column prop="imgname" label="图片名称"></af-table-column>
            <af-table-column prop="imgtype" label="图片类型"></af-table-column>
            <af-table-column prop="imgurl" label="图片路径"></af-table-column>
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
        </div>
      </el-col>
    </el-row>
  </div>
</template>

<script>
import { mapGetters } from "vuex";
import MyImgUpload from "@/components/MyImgUpload";
import {
  findImg,
  addImg,
  updateImg,
  deleteImg,
} from "@/api/contentsetting/baseinformation/imgmanage";

export default {
  name: "BuildingInformation",
  components: {
    MyImgUpload,
  },
  computed: {
    ...mapGetters(["path"]),
  },
  data() {
    return {
      imgName: "", // 图片名称
      imgType: "", // 图片类型
      file: "",
      imgUrl: "",
      currentPage: 1, // 初始页
      pagesize: 10,
      rowCount: 0,
      options: [
        {
          item: "picimage",
          value: "平面图",
        },
        {
          item: "icon",
          value: "其他",
        },
      ],
      tableDatas: [],
      editData: {},
    };
  },
  created() {
    this.findAllImg(this.path, this.currentPage, this.pagesize, this.imgType);
  },
  methods: {
    // 查询所有图片
    findAllImg(path, currentPage, pageSize, imgType) {
      if (imgType === "其他") {
        imgType = "icon";
      } else if (imgType === "平面图") {
        imgType = "picimage";
      } else if (imgType === "结构图") {
        imgType = "systemicon";
      } else {
        imgType = imgType;
      }
      findImg(path, currentPage, pageSize, imgType)
        .then((res) => {
          this.rowCount = res.data.rowCount;
          this.tableDatas = res.data.records;
          this.tableDatas.forEach((ele) => {
            if (ele.imgtype == "picimage") {
              ele.imgtype = "平面图";
            } else if (ele.imgtype == "systemicon") {
              ele.imgtype = "结构图";
            } else {
              ele.imgtype = "其他";
            }
          });
        })
        .catch(console.log);
    },
    // 改变显示页数
    handleSizeChange(size) {
      this.pagesize = size;
      this.currentPage = 1;
      this.findAllImg(this.path, this.currentPage, this.pagesize, this.imgType);
    },
    // 跳页
    handleCurrentChange(currentpage) {
      this.currentPage = currentpage;
      if (this.tableDatas.length < this.rowCount) {
        this.findAllImg(
          this.path,
          this.currentPage,
          this.pagesize,
          this.imgType
        );
      }
    },
    // 上一页
    prev() {
      if (this.currentPage === 1) {
        this.currentPage = 1;
      } else {
        this.currentPage--;
        if (this.tableDatas.length < this.rowCount) {
          this.findAllImg(
            this.path,
            this.currentPage,
            this.pagesize,
            this.imgType
          );
        }
      }
    },
    // 下一页
    next() {
      const maxPage = Math.ceil(this.rowCount / this.pagesize);
      if (this.currentPage < maxPage) {
        this.currentPage++;
        if (this.tableDatas.length < this.rowCount) {
          this.findAllImg(
            this.path,
            this.currentPage,
            this.pagesize,
            this.imgType
          );
        }
      }
    },
    uploadFile(file) {
      this.file = file;
    },
    // 增加图片
    handelAdd() {
      if (this.imgType === "其他") {
        this.imgType = "icon";
      } else if (this.imgType === "平面图") {
        this.imgType = "picimage";
      } else if (this.imgType === "结构图") {
        this.imgType = "systemicon";
      } else {
        this.imgType = this.imgType;
      }
      var formData = new FormData();
      formData.append("imgname", this.imgName);
      formData.append("imgtype", this.imgType);
      formData.append("file", this.file);
      addImg(this.path, formData)
        .then((res) => {
          if (res.status === 20000) {
            this.$message.success("新增成功!");
            this.findAllImg(
              this.path,
              this.currentPage,
              this.pagesize,
              this.imgType
            );
          }
        })
        .catch(console.log);
    },
    // 编辑图片
    handelEdit(index, row) {
      this.editData = row;
      this.imgName = row.imgname;
      this.imgType = row.imgtype;
      this.imgUrl = this.global.baseUrl + row.imgurl;
    },
    // 修改图片
    updateImg() {
      if (this.imgType === "其他") {
        this.imgType = "icon";
      } else if (this.imgType === "平面图") {
        this.imgType = "picimage";
      } else if (this.imgType === "结构图") {
        this.imgType = "systemicon";
      } else {
        this.imgType = this.imgType;
      }
      var formData = new FormData();
      formData.append("imgid", this.editData.imgid);
      formData.append("imgname", this.imgName);
      formData.append("imgtype", this.imgType);
      formData.append("file", this.file);
      updateImg(this.path, formData)
        .then((res) => {
          if (res.status === 20000) {
            this.$message.success("修改成功!");
            this.findAllImg(
              this.path,
              this.currentPage,
              this.pagesize,
              this.imgType
            );
          }
        })
        .catch(console.log);
    },
    // 删除图片
    handelDelete(index, row) {
      const tip = confirm("确定要删除该图片吗？");
      if (tip) {
        deleteImg(this.path, row.imgid)
          .then((res) => {
            if (res.status === 20000) {
              this.$message.success("删除成功!");
              this.findAllImg(
                this.path,
                this.currentPage,
                this.pagesize,
                this.imgType
              );
            }
          })
          .catch(console.log);
      }
    },
    // 切换图标
    valueChange() {
      this.findAllImg(this.path, this.currentPage, this.pagesize, this.imgType);
    },
  },
};
</script>

<style lang="scss" scoped>
.app-container {
  .el-col {
    border-radius: 4px;
  }
  .bg-purple {
    position: relative;
    padding: 20px;
    background: var(--theme-color);

    p {
      margin-bottom: 30px;
      font-size: 18px;
      font-weight: bold;
    }
    .el-form {
      .el-form-item {
        .el-input {
          width: 200px;
        }
      }
    }
    .img-upload {
      padding: 10px 40px;
      width: 400px;
      .show-img {
        margin-bottom: 10px;
        width: 148px;
        height: 148px;
      }
    }
    .img-btn {
      position: absolute;
      top: 10px;
      right: 10px;
    }
  }
  .bg-purple-light {
    padding: 20px;
    background: var(--theme-color);
    p {
      margin-bottom: 20px;
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
  .grid-content {
    border-radius: 4px;
    min-height: 36px;
  }
}
</style>

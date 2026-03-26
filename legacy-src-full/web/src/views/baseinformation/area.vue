<template>
  <div class="app-container building-information-container">
    <el-row :gutter="10">
      <el-col :md="24" :lg="9" :xl="7">
        <div class="grid-content bg-purple">
          <p class="left-title">区域编辑</p>
          <el-form class="form" ref="form" :model="ruleForm">
            <el-form-item
                :rules="[{ required: true, message: '请选择楼栋' }]"
                label="选择楼栋"
                prop="buildingId"
            >
              <el-select
                  v-model="ruleForm.buildingId"
                  placeholder="请选择"
                  @change="buildSelect"
              >
                <el-option
                    v-for="item in options"
                    :key="item.buildid"
                  :label="item.buildname"
                  :value="item.buildid"
                >
                </el-option>
              </el-select>
            </el-form-item>
            <el-form-item
              label="选择楼层"
              :rules="[{ required: true, message: '请选择楼层' }]"
              prop="floorId"
            >
              <el-select v-model="ruleForm.floorId" placeholder="请选择">
                <el-option
                  v-for="item in floorOptions"
                  :key="item.id"
                  :label="item.floorName"
                  :value="item.id"
                >
                </el-option>
              </el-select>
            </el-form-item>
            <el-form-item
              label="区域名称"
              :rules="[{ required: true, message: '请填写区域名称' }]"
              prop="areaName"
            >
              <el-input
                v-model="ruleForm.areaName"
                placeholder="请输入区域名称"
              />
            </el-form-item>
            <el-form-item label="区域描述">
              <el-input
                v-model="ruleForm.remark"
                type="textarea"
                :rows="3"
                clearable
                placeholder="请输入区域描述"
              />
            </el-form-item>
          </el-form>
          <div class="left-btn">
            <el-button type="primary" @click="handelAdd">增加</el-button>
            <el-button type="primary" @click="updateBuild">确认修改</el-button>
          </div>
        </div>
      </el-col>
      <el-col :md="24" :lg="15" :xl="17">
        <div class="grid-content bg-purple">
          <div class="buiding-info-title">
            <p>区域信息</p>
            <el-button type="primary" @click="exportBuild">区域导出</el-button>
            <ExcelUpload
              class="upload"
              :btnName="btnName"
              @excelUpload="uploadFile"
            />
            <el-button type="danger" @click="handelDeletes">批量删除</el-button>
          </div>
          <el-table
            :data="tableDatas"
            border
            style="width: 100%"
            max-height="600"
            @selection-change="selectBuildings"
          >
            <el-table-column type="selection" width="55"></el-table-column>
            <af-table-column prop="id" label="区域ID"></af-table-column>
            <af-table-column prop="floorId" label="楼层ID"></af-table-column>
            <af-table-column prop="areaName" label="区域名称"></af-table-column>
            <af-table-column prop="remark" label="区域描述"></af-table-column>
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
import {
  outputExcel,
  inputExcel,
  findBuild,
  addBuild,
  updateBuild,
  deleteBuild,
  findAllbuild,
  findAllFloor
} from "@/api/contentsetting/baseinformation/area";
import ExcelUpload from "@/components/MyImgUpload/ExcelUpload";
import { exportExcel } from "@/utils/excel";
import { formatDate } from "@/utils/index";

export default {
  inject: ["reload"],
  name: "BuildingInformation",
  components: {
    ExcelUpload
  },
  computed: {
    ...mapGetters(["id", "path", "project"])
  },
  data () {
    return {
      btnName: '区域导入',
      ruleForm: {
        buildingId: '',
        floorId: '',
        areaName: "", // 区域名称
        remark: "", // 区域描述
      },

      buildings: [], // 多选区域
      excelFile: "", // 上传的excel

      currentPage: 1, // 初始页
      pagesize: 10,
      rowCount: 0,
      tableDatas: [],
      editData: {},
      options: [],
      floorOptions: []
    };
  },
  created () {
    findAllbuild(this.path).then(res => {
      this.options = res.data;
    })
  },
  mounted () {
    this.findAllBuild(this.path, this.currentPage, this.pagesize);
  },
  methods: {
    buildSelect () {
      if (this.ruleForm.buildingId) {
        console.log(8)
        findAllFloor(this.path, { buildingId: this.ruleForm.buildingId }).then(res => {
          this.floorOptions = res.data
        })
      }
    },
    // 查询所有区域
    findAllBuild (path, currentPage, pageSize) {
      findBuild(path, currentPage, pageSize)
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
      this.findAllBuild(this.path, this.currentPage, this.pagesize);
    },
    // 跳页
    handleCurrentChange (currentpage) {
      this.currentPage = currentpage;
      if (this.tableDatas.length < this.rowCount) {
        this.findAllBuild(this.path, this.currentPage, this.pagesize);
      }
    },
    // 上一页
    prev () {
      if (this.currentPage === 1) {
        this.currentPage = 1;
      } else {
        this.currentPage--;
        if (this.tableDatas.length < this.rowCount) {
          this.findAllBuild(this.path, this.currentPage, this.pagesize);
        }
      }
    },
    // 下一页
    next () {
      const maxPage = Math.ceil(this.rowCount / this.pagesize);
      if (this.currentPage < maxPage) {
        this.currentPage++;
        if (this.tableDatas.length < this.rowCount) {
          this.findAllBuild(this.path, this.currentPage, this.pagesize);
        }
      }
    },
    // 增加
    handelAdd () {
      this.$refs.form.validate((valid) => {
        if (valid) {
          let info = { ...this.ruleForm }
          addBuild(this.path, info)
            .then(res => {
              if (res.status === 20000) {
                this.$message.success("新增成功!");
                this.reload();
              }
            })
            .catch(console.log);
        } else {
          return false
        }

      })


    },
    // 编辑
    handelEdit (index, row) {
      this.ruleForm = row;
      findAllFloor(this.path, { buildingId: row.buildingId }).then(res => {
        this.floorOptions = res.data
      })
    },
    // 确认修改
    updateBuild () {
      updateBuild(this.path, this.ruleForm)
        .then(res => {
          if (res.status === 20000) {
            this.$message.success("修改成功!");
            this.reload();
          }
        })
        .catch(console.log);
    },

    // 删除
    handelDelete (index, row) {
      let tip = confirm("确定要删除该区域吗？");
      if (tip) {
        deleteBuild(this.path, row.id)
          .then(res => {
            if (res.status === 20000) {
              this.$message.success("删除成功!");
              this.reload();
            }
          })
          .catch(console.log);
      }
    },
    // 选择区域
    selectBuildings (val) {

      this.buildings = val;
      console.log('val', val)
    },
    // 批量删除
    handelDeletes () {
      let tip = confirm("确定要批量删除区域吗？");
      if (tip) {
        let ids = [];
        this.buildings.forEach(ele => {
          ids.push(ele.id);
        });
        deleteBuild(this.path, ids.join(","))
          .then(res => {
            if (res.status === 20000) {
              this.$message.success("批量删除成功!");
              this.reload();
            }
          })
          .catch(console.log);
      }
    },
    // 导入区域
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
        .catch(() => {
          loading.close();
        });
    },
    // 导出区域
    exportBuild () {
      outputExcel(this.path)
        .then(res => {
          let date = formatDate(new Date());
          const filename = "区域信息" + date + ".xls";
          exportExcel(res, filename);
        })
        .catch(console.log);
    }
  }
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

    .left-title {
      margin-bottom: 20px;
      font-size: 18px;
      font-weight: bold;
    }

    .left-btn {
      position: absolute;
      top: 10px;
      right: 10px;
    }

    .buiding-info-title {
      display: flex;
      align-items: center;
      margin-bottom: 20px;
      p {
        margin-right: 20px;
        font-size: 18px;
        font-weight: bold;
      }
      .upload {
        margin: 0 10px;
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
  .form {
    .el-input {
      width: 200px;
    }
    .el-textarea {
      width: 200px;
    }
  }

  .grid-content {
    border-radius: 4px;
    min-height: 36px;
  }
}
</style>

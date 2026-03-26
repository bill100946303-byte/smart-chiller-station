<template>
  <div class="app-container">
    <el-row :gutter="10">
      <el-col :md="24" :lg="8" :xl="6">
        <div class="grid-content bg-purple">
          <p class="left-title">能耗系数配置信息</p>
          <el-form
              class="form"
              ref="form"
              label-position="left"
              label-width="130px"
          >
            <el-form-item label="Type">
              <el-input
                  v-model="Type"
                  clearable
                  placeholder="请输入Type"
              />
            </el-form-item>
            <el-form-item label="TagName">
              <el-input
                  v-model="TagName"
                  clearable
                  placeholder="请输入TagName"
              />
            </el-form-item>
            <el-form-item label="RegName">
              <el-input
                  v-model="RegName"
                  clearable
                  placeholder="请输入RegName"
              />
            </el-form-item>
            <el-form-item label="采集类型">
              <el-select
                  v-model="collection_type"
                  clearable
                  placeholder="请选择采集类型"
                  style="width: 200px;"
              >
                <el-option
                    v-for="item in collectionOption"
                    :key="item.value"
                    :label="item.label"
                    :value="item.value"
                ></el-option>
              </el-select>
            </el-form-item>
            <el-form-item label="计算或直取">
              <el-select
                  v-model="energy_type"
                  clearable
                  placeholder="请选择计算或直取"
                  style="width: 200px;"
              >
                <el-option
                    v-for="item in energyOptions"
                    :key="item.value"
                    :label="item.label"
                    :value="item.value"
                ></el-option>
              </el-select>
            </el-form-item>
          </el-form>
          <div class="left-btn">
            <el-button type="primary" @click="handelAdd">增加</el-button>
            <el-button type="primary" @click="handelUpdate">确认修改</el-button>
          </div>
        </div>
      </el-col>
      <el-col :md="24" :lg="16" :xl="18">
        <div class="grid-content bg-purple">
          <div class="buiding-info-title">
            <p>能耗系数配置列表</p>
            <el-input v-model="exportTagName" clearable placeholder="输入寄您要搜索的"/>
            <el-button type="primary" @click="searchQsTag">查询</el-button>
          </div>
          <el-table
              :data="tableDatas"
              border
              max-height="600"
              @selection-change="selectQsTags"
          >
            <!--              <el-table-column type="selection"></el-table-column>-->
            <af-table-column prop="id" label="ID"></af-table-column>
            <af-table-column prop="Type" label="Type"></af-table-column>
            <af-table-column prop="TagName" label="TagName"></af-table-column>
            <af-table-column prop="RegName" label="RegName"></af-table-column>
            <af-table-column prop="collection_type" label="collection_type"></af-table-column>
            <af-table-column prop="energy_type" label="energy_type"></af-table-column>
            <el-table-column fixed="right" label="操作" width="90">
              <template slot-scope="scope">
                <el-button
                    type="success"
                    size="mini"
                    @click="handelEdit(scope.$index, scope.row)"
                >编辑
                </el-button
                >
<!--                <el-button-->
<!--                    type="danger"-->
<!--                    size="mini"-->
<!--                    @click="handelDelete(scope.$index, scope.row)"-->
<!--                >删除-->
<!--                </el-button-->
<!--                >-->
              </template>
            </el-table-column>
          </el-table>
          <div class="el-pagination">
            <!--              <el-pagination-->
            <!--                  layout="total, sizes, prev, pager, next, jumper"-->
            <!--                  :page-size="2"-->
            <!--                  :total="pageTotal"-->
            <!--                  @size-change="handleSizeChange"-->
            <!--                  @current-change="handleCurrentChange"-->
            <!--              ></el-pagination>-->
            <el-pagination
                @size-change="handleSizeChange"
                @current-change="handleCurrentChange"
                :page-size="100"
                layout="prev, pager, next, jumper"
                :total=pageTotal>
            </el-pagination>
          </div>
        </div>
      </el-col>
    </el-row>
  </div>
</template>

<script>
import {mapGetters} from "vuex";
import {valToId} from "@/utils/selectexchange";
import {add, del, info, update} from "@/api/basesetting/energyConsumption";
import {showDelBox} from '@/utils/elmessage'

export default {
  name: "EnergyConsumption",
  inject: ["reload"],
  computed: {
    ...mapGetters(["path", "id"]),
  },
  data() {
    return {
      Type: "",// 参数类型
      TagName: "",// 寄存器名
      RegName: "",// 变量名
      collectionOption: [{
        value: 1,
        label: '一小时一次'
      }, {
        value: 2,
        label: '一天一次'
      }, {
        value: 3,
        label: '一个月一次'
      }, {
        value: 4,
        label: '全部'
      }],
      collection_type: "",// 采集类型
      energyOptions: [{
        value: 1,
        label: '计算'
      }, {
        value: 2,
        label: '取值'
      }],
      energy_type: "",// 能耗分类
      exportTagName: "",// 查询
      editData: {},
      tableDatas: [{
        editData: 1,
        Type: 'type',
        TagName: "TagName",
        RegName: "RegName",
        collection_type: 1,
        energy_type: 2,
        id:1
      }],
      pageTotal: 0
    };
  },
  mounted() {
    this.energyConsumptionList()
  },
  methods: {
    // 查询
    energyConsumptionList() {
      info(this.path).then(res => {
        console.log(res)
      })
    },
    // 新增
    handelAdd() {
      let formData = new FormData();
      formData.append("Type", this.Type)
      formData.append("TagName", this.TagName)
      formData.append("RegName", this.RegName)
      formData.append("collection_type", valToId(this.collection_type, this.collectionOption))
      formData.append("energy_type", valToId(this.energy_type, this.energyOptions))
      for (let a of formData.entries()) {
        console.log(a);
      }
      add(this.path, formData).then(res => {
        console.log('新增成功', res)
      })
    },
    // 修改
    handelUpdate() {
      var formData = new FormData();
      formData.append("Type", this.Type)
      formData.append("TagName", this.TagName)
      formData.append("RegName", this.RegName)
      formData.append("collection_type", valToId(this.collection_type, this.collectionOption))
      formData.append("energy_type", valToId(this.energy_type, this.energyOptions))
      for (let a of formData.entries()) {
        console.log(a);
      }
      update(this.path, formData).then(res => {
        console.log('新增成功', res)
      })
    },
    // 删除
    handelDelete(index, row) {
      showDelBox("您确定要删除吗？").then(() => {
        del(this.path, row.id)
            .then((res) => {
              if (res.status === 20000) {
                this.$message.success("删除成功!");
                this.findQsTag(
                    this.currentPage,
                    this.pagesize,
                    this.exportTagName
                );
              }
            })
            .catch(console.log);
      })
    },
    // 搜索
    searchQsTag() {
      console.log('搜索', this.exportTagName)
    },
    //  编辑
    handelEdit(index, row) {
      // this.editData = row;
      // this.Type = row.Type;
      // this.TagName = row.TagName;
      // this.RegName = row.RegName;
      // this.collection_type = row.collection_type;
      // this.energy_type = row.energy_type;
      this.editData = 1;
      this.Type = 'type';
      this.TagName = "TagName";
      this.RegName = "RegName";
      this.collection_type = 1;
      this.energy_type = 2;
    },
    selectQsTags() {

    },
    // 每页显示条数
    handleSizeChange(val) {
      console.log('条数', val)
      this.params.pageSize = val;
      // this.energyConsumptionList();
    },
    handleCurrentChange(val) {
      console.log('123', val)
      this.params.pageNumber = val;
      // this.energyConsumptionList();
    },
  },
}
;
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

      .el-input {
        margin-right: 20px;
        width: 200px;
      }

      p {
        margin-right: 20px;
        font-size: 18px;
        font-weight: bold;
      }
      //.upload {
      //  margin: 0 10px;
      //}
    }

    .el-pagination {
      display: flex;
      justify-content: center;
      margin-top: 10px;
      text-align: center;
      align-items: center;

      //.btn {
      //  margin-top: 10px;
      //  padding: 2px 5px;
      //}
    }
  }

  .form {
    .el-input {
      width: 200px;
    }

    //.el-textarea {
    //  width: 200px;
    //}
  }

  .grid-content {
    border-radius: 4px;
    min-height: 36px;
  }
}
</style>

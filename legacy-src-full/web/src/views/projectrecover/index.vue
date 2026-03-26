<template>
  <div class="app-container project-manage-container">
    <el-row :gutter="10">
      <el-col :xs="24" :sm="24" :md="24" :lg="24" :xl="24">
        <div class="grid-content bg-purple-light">
          <div class="project-info">
            <div class="project-list">
              <p class="project-list-title">项目列表</p>
              <el-button type="primary" @click="selectObeject">恢复该项目</el-button>
            </div>
            <div class="project-number">
              当前回收站数量
              <span>{{tableDatas.length}}</span>
            </div>
          </div>
          <el-empty :image-size="200" v-if="tableDatas.length===0"/>
          <div class="buiding-list" v-else>
            <el-table
                :data="tableDatas.slice((currentPage-1)*pagesize,currentPage*pagesize)"
                border
                style="width: 100%"
                @selection-change="changeFun"
            >
              <el-table-column fixed type="selection" width="55" @selection-change="changeFun"/>
              <el-table-column
                  v-for="(tk,index) in tableDataKey"
                  :key="index"
                  :prop="tk"
                  :label="tableLables[index]"
                  :width="tableWidth[index]"
              />
              <el-table-column fixed="right" label="操作" width="200">
                <template slot-scope="scope">
                  <el-button
                      type="danger"
                      size="mini"
                      @click="handelDelete(scope.$index, scope.row)"
                  >永久删除</el-button>
                </template>
              </el-table-column>
            </el-table>
            <div class="el-pagination">
              <div class="btn">
                <button @click="prev">上一页</button>
                <span>{{currentPage}}</span>
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
        </div>
      </el-col>
    </el-row>
  </div>
</template>

<script>
import {deleteObject, findCount, findObject, removeObject} from "@/api/basesetting/objectmanage";
import {showDelBox} from '@/utils/elmessage'

export default {
  inject: ["reload"],
  name: "ProjectRecover",
  data() {
    return {
      selectObj: {}, // 选择的项目个数
      objectNum: 0,
      currentPage: 1,
      rowCount: 0,
      pagesize: 10,
      input1: "",
      input2: "",
      input3: "",
      input4: "",
      input5: "",
      dialogFormVisible: false,
      addData: {},
      tableDataKey: [], // 表格的属性
      tableDatas: [
        {
          id: "",
          appName: "",
          ipaddr: "",
          appport: "",
          apptypeid: "",
          appexplain: "",
          appstate: '',
          state: ''
        }
      ],
      tableLables: [
        "ID",
        "项目名称",
        "项目节点IP地址",
        "项目节点端口号",
        "项目节点用户名",
        "项目描述",
        '项目是否初始化',
        '项目是否删除'
      ],
      tableWidth: ['100', '150', '200', '200', '200', '200', '200', '150']
    };
  },
  created() {
    // 查询所有项目
    let state = 1
    findObject(this.currentPage, this.pagesize, state)
        .then(response => {
          const { data } = response;
          this.rowCount = data.rowCount;
          const { records } = data;
          let tableDatas = [];
          records.forEach(ele => {
            let obj = {
              id: ele.appid,
              appName: ele.appName,
              ipaddr: ele.ipaddr,
              appport: ele.appport,
              apptypeid: ele.apptypeid,
              appexplain: ele.appexplain,
              appstate: ele.appstate,
              state: ele.state
            };
            tableDatas.push(obj);
          });
          this.tableDatas = tableDatas;
          this.tableDatas.forEach(element => {
            this.tableData = element;
          });
          const obj = this.tableData;
          for (const key in obj) {
            this.tableDataKey.push(key);
          }
        })
        .catch(error => {
          console.log(error);
        });
    // 查询项目个数
    findCount()
        .then(response => {
          const { data } = response;
          this.objectNum = data;
        })
        .catch(error => {
          console.log(error);
        });
  },
  methods: {
    pageSize(pagesize) {
      this.pagesize = pagesize;
      this.currentPage = 1;
      findObject(this.currentPage, this.pagesize)
          .then(response => {
            const { data } = response;
            this.rowCount = data.rowCount;
            const { records } = data;
            let tableDatas = [];
            records.forEach(ele => {
              let obj = {
                id: ele.appid,
                appName: ele.appName,
                ipaddr: ele.ipaddr,
                appport: ele.appport,
                apptypeid: ele.apptypeid,
                appexplain: ele.appexplain,
                appstate: ele.appstate,
                state: ele.state
              };
              tableDatas.push(obj);
            });
            this.tableDatas = tableDatas;
          })
          .catch(console.log);
    },
    // 初始页currentPage、初始每页数据数pagesize和数据data
    handleSizeChange: function(size) {
      this.pagesize = size;
      this.currentpage = 1;
    },
    handleCurrentChange: function(currentpage) {
      this.currentpage = currentpage;
    },
    prev() {
      if (this.currentpage === 1) {
        this.currentpage = 1;
      } else {
        this.currentpage--;
      }
    },
    next() {
      const maxPage = Math.ceil(this.pageCount / this.pagesize);
      if (this.currentpage < maxPage) {
        this.currentpage++;
      }
    },
    currentpageChange() {
      if (this.tableDatas.length < this.pageCount) {
        findObject(this.currentpage, this.pagesize)
            .then(response => {
              const { data } = response;
              this.rowCount = data.rowCount;
              const { records } = data;
              records.forEach(ele => {
                let obj = {
                  id: ele.appid,
                  appName: ele.appName,
                  ipaddr: ele.ipaddr,
                  appport: ele.appport,
                  apptypeid: ele.apptypeid,
                  appexplain: ele.appexplain,
                  appstate: ele.appstate,
                  state: ele.state
                };
                this.tableDatas.push(obj);
              });
            })
            .catch(console.log);
      }
    },
    // 删除项目
    handelDelete(index,row) {
      // 显示弹框
      showDelBox().then(()=>{
        let DBname = row.id + row.appName
        deleteObject(row.id, DBname)
            .then(res => {
              const { msg } = res;
              if (msg == "OK") {
                this.$message.success("项目删除成功!");
                this.reload();
              }
            })
            .catch(console.log)
        this.reload()
      })
    },
    // 选择的项目id
    changeFun(val) {
      this.selectObj = val;
    },
    // 恢复项目
    selectObeject() {
      let state = 0
      removeObject(this.selectObj[0].id, state)
          .then(res => {
            const { msg } = res;
            if (msg == "OK") {
              this.$message.success("项目恢复成功!");
              this.reload();
            }
          })
          .catch(console.log)
      this.reload()
    }
  }
};
</script>

<style lang="scss" scoped>
.project-manage-container {
  .el-col {
    border-radius: 4px;
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
      .project-list {
        display: flex;
        justify-content: space-between;
        width: 200px;
        .project-list-title {
          font-size: 18px;
          font-weight: bold;
          line-height: 30px;
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
    .buiding-list {
      margin-top: 30px;
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
  }
  .grid-content {
    border-radius: 4px;
    min-height: 36px;
  }
}
</style>

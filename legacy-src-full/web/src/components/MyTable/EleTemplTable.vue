<template>
  <div>
    <div class="buiding-list">
      <div>
        <el-button type="success" size="mini" @click="deleteSelect">批量删除</el-button>
      </div>      
      <el-table
        :data="tableDatas"
        border
        style="width: 100%"
        max-height="550"
        @selection-change="changeFun"
      >
        <el-table-column fixed type="selection" width="35" @selection-change="changeFun" />
        <af-table-column
          v-for="(tk,index) in tableDataKey"
          :key="index"
          :prop="tk"
          :label="tableLables[index]"
        />
        <el-table-column fixed="right" label="操作" width="150">
          <template slot-scope="scope">
            <el-button type="success" size="mini" @click="handelEdit(scope.$index, scope.row)">编辑</el-button>
            <el-button type="danger" size="mini" @click="handelDelete(scope.$index, scope.row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
      <div class="el-pagination">
        <div class="btn">
          <button @click="prev">上一页</button>
          <span>{{currentpage}}</span>
          <button @click="next">下一页</button>
        </div>
        <div>
          <el-pagination
          :current-page="currentpage"
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
</template>

<script>
import Bus from '@/utils/bus'
export default {
  name: 'MyTable',
  props: ['tableDatas', 'tableLables', 'rowCount'],
  watch: {
    currentpage(val){
      this.$emit('currentpageChange', val)
    }
  },
  data() {
    return {
      tableLable: [], // 表格标签
      tableData: {}, // 每行表格的数据
      tableDataKey: [], // 表格的属性
      currentpage: 1,
      pagesize: 5,
      multipleSelection: [], // 选择的行
    }
  },
  created() {
    this.tableDatas.forEach(element => {
      this.tableData = element
    })
    const obj = this.tableData
    for (const key in obj) {
      this.tableDataKey.push(key)
    }
    this.tableDataKey = this.tableDataKey.slice(0, 5)
  },
  methods: {
    // 编辑
    handelEdit(index, row) {
      this.$emit('todialog', row)
    },
    
    // 删除
    handelDelete(index, row) {
      // 显示弹框
      const tip = confirm('确定要删除吗？')
      if (tip) {
        // 确定删除
        this.tableDatas = this.tableDatas.filter(function(item) {
          return item != row
        })
        this.$emit('delete',row.id)
      }
    },
    changeFun(val) {
       this.multipleSelection = val;
       this.$emit('selectObject', val)
    },
    deleteSelect(){
      let ids = []
      this.multipleSelection.forEach(ele => {
        ids.push(ele.id)
      })
      if(ids.length == 0){
        this.$message.error("至少选择一个要删除的选项!")
      } else {
        const tip = confirm('确定要删除吗？')
        if(tip){
          this.$emit('deletes',ids)
        }
      }
    },
    // 初始页currentPage、初始每页数据数pagesize和数据data
    handleSizeChange: function(size) {
      this.pagesize = size
      this.$emit('pagesizeChange', size)
      this.currentpage = 1
    },
    handleCurrentChange: function(currentpage) {
      this.currentpage = currentpage
    },
    prev() {
      if(this.currentpage === 1){
        this.currentpage = 1
      }else{
        this.currentpage --
      }
    },
    next() {
      const maxPage = Math.ceil(this.rowCount/this.pagesize)
      if(this.currentpage < maxPage){
        this.currentpage ++
      }
    }
  }
}
</script>
<style lang="scss" scoped>
.buiding-list {
  margin-top: 30px;
  .el-pagination {
    display: flex;
    justify-content:center;
    margin-top: 10px;
    text-align: center;
    align-items: center;
    
    .btn {
      margin-top: 10px;
      padding: 2px 5px;
    }
  }
}
</style>

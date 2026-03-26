<template>
  <el-pagination
    class="pagelist"
    @size-change="handleSizeChange"
    @current-change="handleCurrentChange"
    :current-page="pageinfo.currentPage"
    :page-sizes="[10, 20, 30, 50]"
    :page-size="pageinfo.pageSize"
    layout="total, sizes, prev, pager, next, jumper"
    :total="total"
  >
  </el-pagination>
</template>
<script>
export default {
  props: {
    pageinfo: {
      currentPage: 1,
      pageSize: 10
    },
    total: 0
  },
  methods: {
    handleSizeChange (size) {

      let obj = Object.assign({}, this.pageinfo, { pageSize: size })
      this.$emit('change', obj)
    },
    handleCurrentChange (current) {
      let obj = Object.assign({}, this.pageinfo, { currentPage: current })
      this.$emit('change', obj)
    }
  },
}
</script>
<style lang="scss" scoped>
.pagelist {
  display: flex;
  margin-top: 44px;
  margin-right: 97px;
  justify-content: flex-end;
  margin-bottom: 30px;
}
</style>
<template>

 
  <el-table
      :data="tableDatas"
      height="100%"
      class="report-search-tabel"
      style="width: 100%"
      :fit="true"
      v-loading="loading"
      :header-cell-style="{
       background: 'rgba(19, 115, 153, 1)',
       color: '#fff',
     }"
      element-loading-background="#fff"
  >
    <!--     element-loading-background="rgba(0, 0, 0, 0.8)"  table中更改loading颜色-->
    <el-table-column
        v-for="(item, i) in tableTitle"
        :key="i"
        :label="item"
        :min-width="item.includes('Time') || item.includes('时间') ?220:140"
        class-name="front-column"
    >
      <template slot-scope="scope">
        <p>{{ scope.row[item] }}</p>
      </template>
    </el-table-column>
  </el-table>

</template>
<script>
export default {
  props: {
    tableDatas: Array,
    tableTitle: Array,
  },
  data () {
    return {
      loading:true
    }
  },
  watch:{
    tableDatas:{
      handler(val){
        if(val.length){
          this.loading = false;
        }
      },
      immediate:true,
      deep:true
    }
  }
}
</script>
<style lang="scss">
.report-search-tabel {
  //border: 1px solid #264F7C;
  border: 1px solid #adadad;
}

</style>

<template>
  <el-table
    :data="tableDatas"
    max-height="750"
    class="search-tabel"
    style="width: 100%"
    :fit="true"
  >
    <el-table-column
      v-for="(item, i) in tableTitle"
      :key="i"
      :label="item.name"
      min-width="186"
      class-name="front-column"
    >
      <template slot-scope="scope">
        <p>{{ scope.row[item.prop] }}</p>
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
    }
  },

}
</script>
<style lang="scss">
</style>

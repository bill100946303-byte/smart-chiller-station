<template>
  <el-table
      :data="tableDatas"
      :fit="true"
      :header-cell-style="{
          background: 'rgba(19, 115, 153, 1)',
          color: '#fff',
        }"
      class="search-tabel"
      max-height="750"
      style="width: 100%"
  >
    <el-table-column
        v-for="(item, i) in tableTitle"
        :key="i"
        :label="$t(`alertrun_realtime.${item.prop}`)"
        class-name="front-column"
        min-width="186"
    >
      <template slot-scope="scope">
        <div v-if="item.prop === 'time' ||item.prop === 'alarmstate'">
          <p v-if="item.prop === 'time'">{{ getTime(scope.row[item.prop]) }}</p>
          <p v-if="item.prop === 'alarmstate'" v-html="getState(scope.row[item.prop])"></p>
        </div>

        <p v-else>{{ scope.row[item.prop] }}</p>
      </template>
    </el-table-column>
  </el-table>
</template>
<script>
import dayjs from 'dayjs'

export default {
  props: {
    tableDatas: Array,
    tableTitle: Array,
  },
  data() {
    return {
      tableData: []
    }
  },
  methods: {
    getTime(time) {
      if (time) {
        return dayjs(time).format('YYYY-MM-DD HH:mm:ss')
      } else {
        return '--'
      }
    },
    getState(stas) {
      return stas == "1" ? `<span class="pending">${this.$t('public.restored')}</span>` : `<span class="restore">${this.$t('public.Recovered')}</span>`
    }
  }
}
</script>
<style lang="scss">
.record-front {
  .pending {
    color: #FD9778;
  }

  .restore {
    color: #2FB2F7;
  }
}

</style>

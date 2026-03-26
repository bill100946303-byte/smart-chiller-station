<template>
  <div class="mytable-home">
    <el-table :data="data" :row-class-name="tableRowClassName" max-height="740" @row-click="gopage">
      <el-table-column label="冷站名称" :label="$t('userHomePage.coldStationName')">
        <template slot-scope="scope">
          <!--          <div
                      class="bluetxt"
                      style="cursor: pointer"
                      @click="gopage(scope.row)"
                    >-->
          <div
              class="bluetxt"
              style="cursor: pointer"
          >
            {{ scope.row.appexplainCNEN }}
          </div>
        </template>
      </el-table-column>
      <!--      <el-table-column prop="customer" label="所属客户" :label="$t('userHomePage.belongingCustomers')" > </el-table-column>-->
      <el-table-column label="运行状态" :label="$t('userHomePage.runningState')">
        <template slot-scope="scope">
          <div class="bluetxt">{{ getStatus(scope.row.runStatus) }}</div>
        </template>
      </el-table-column>
      <el-table-column prop="departmentName" label="负责部门" :label="$t('userHomePage.responsibleDepartment')">
      </el-table-column>
      <el-table-column prop="name" label="创建时间" :label="$t('userHomePage.createdTime')">
        <template slot-scope="scope">
          <div>{{ getNowTime(scope.row.createTime) }}</div>
        </template>
      </el-table-column>
    </el-table>
  </div>
</template>
<script>
import { formatDate } from "@/utils/index";
import srcMp3 from '@/assets/warn.mp3'

export default {
  props: ["data"],
  data() {
    return {};
  },
  methods: {
    getNowTime(time) {
      if (time) {
        return formatDate(time ? time : new Date().getTime());
      }
    },
    tableRowClassName({ row, rowIndex }) {
      if (rowIndex % 2) {
        return "success-row";
      } else {
        return "warning-row";
      }
    },
    getStatus(info) {
      switch (info) {
        case 1:
          return this.$t('totalalarm.InOperation');
        case 0:
          return this.$t('totalalarm.paused');
        default:
          return "--";
      }
    },
    gopage(data) {
      this.$store.commit("user/SET_MODELKEY", data.key);
      this.$store.commit("user/SET_TEMPLATE", data.template);
      this.$store
          .dispatch("project/getMenuId", data)
        .then(() => {
            let mp3 = this.MP3; // 为了解除谷歌用户不交互，不会播放音乐
            mp3.src = srcMp3;
            mp3.play();
            setTimeout(() => {
              mp3.pause();
              // this.$router.push({
              //   path: "/systemhomepage",
            //   query: { appinfo: data.appid },
            // });
            this.$router.push({
              name: 'defaultpage', //默认首页
            });
          },1)
        })
        .catch((error) => {
          this.$message.error(error.message || "进入项目失败");
        });
    },
  },
};
</script>
<style lang="scss">
.mytable-home {
  .el-table {
    th {
      //height: 94px;
      background: #081e36;
      text-align: center;
      font-weight: normal;
      //font-size: 20px;
      &.is-leaf {
        border-bottom: 1px solid #081e36;
      }
    }
    tr {
      height: 65px;
      font-size: 16px;
      color: #fff;

      .cell {
        text-align: center;
      }
    }
    .warning-row {
      background: #174472;
    }
    .success-row {
      background: #081e36;
    }
    .bluetxt {
      color: #78bffd;
    }
  }
}
</style>

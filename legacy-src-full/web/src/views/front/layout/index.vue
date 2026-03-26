<template>
  <div class="front-box-main">
    <div class="nav">
      <nav-bar/>
    </div>
    <div class="front-content">
      <div class="side">
        <Side/>
      </div>
      <div class="front-main">
        <router-view></router-view>
      </div>
    </div>
  </div>
</template>
<script>
import Side from "@/views/systemhomepage/components/Sidebar";
import NavBar from "../navbar/index";

export default {
  components: {
    NavBar,
    Side,
  },
};
</script>
<style lang="scss" scoped>
.front-box-main {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background:
    radial-gradient(circle at top, rgba(92, 200, 255, 0.12) 0%, transparent 24%),
    linear-gradient(180deg, #06111f 0%, #040d18 100%);
}

.nav {
  position: fixed;
  z-index: 5;
  top: 0;
  left: 0;
  width: 100%;
  height: 66px;
  background: linear-gradient(180deg, rgba(7, 18, 33, 0.92) 0%, rgba(7, 18, 33, 0.74) 100%);
  backdrop-filter: blur(16px);
  border-bottom: 1px solid rgba(132, 187, 255, 0.12);
}

.front-content {
  padding-top: 66px;
  flex: 1;
  display: flex;
  overflow: hidden;
  background:
    radial-gradient(circle at right top, rgba(92, 200, 255, 0.08) 0%, transparent 34%),
    linear-gradient(180deg, #07111f 0%, #050d17 100%);

  .side {
    width: 208px;
    height: 100%;
    overflow: auto;
    flex-shrink: 0;
    border-right: 1px solid rgba(132, 187, 255, 0.08);
  }

  .front-main {
    position: relative;
    z-index: 2;
    overflow: auto;
    box-sizing: border-box;
    flex: 1;
    padding: 18px 18px 0 18px;
    background: transparent;

    .front-box-show {
      min-height: 100%;
      padding-bottom: 36px;
      background: transparent;
    }
  }
}
</style>
<style lang="scss">
.el-input__icon, .el-date-editor .el-range__icon {
  font-size: 25px;
}

.el-input--prefix .el-input__inner {
  padding-left: 40px;
}

.front-box-show {
  .el-range-input {
    //background: #011123 !important;
  }

  .el-table {
    td {
      .cell {
        //color:#999;
      }
    }
  }

  thead {
    th {
      //background: #05182d !important;
    }
  }

  .el-table__fixed {
    &:before {
      //background: #264f7c !important;
    }
  }

  .btn-prev, .btn-next {
    color: #999999 !important;
    margin-right: 10px !important;
    border: 1px solid #6f6f6f !important;
  }

  .el-pager {
    li {
      margin-right: 10px;
      color: #999999;
      border: 1px solid #6f6f6f !important;
    }
  }

  .front-column {
    height: 67px;

    .cell {
      padding: 0 40px !important;
    }
  }
}
</style>

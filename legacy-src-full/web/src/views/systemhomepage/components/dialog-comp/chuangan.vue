<template >
  <div class="chuan-box">
    <div class="nav-staus">传感器暂时无异常</div>
    <div class="list">
      <div class="item" v-for="(item, index) in [1, 2, 3, 4, 5, 6]">
        <div class="temp">冷却水温度</div>
        <div class="main-con">
          <div class="left">
            <div class="status">传感器状态:<span>正常</span></div>
            <div class="time">2021-07-15 16:44:44</div>
          </div>
          <img src="../../../../assets/tan2.png" alt="" class="right" />
        </div>
      </div>
    </div>
  </div>
</template>
<script>
export default {

}
</script>
<style lang="scss" scoped>
.chuan-box {
  padding: 0 40px;
  .nav-staus {
    margin: 40px 0 24px 0;
    font-size: 14px;
    color: #06a4f8;
  }
  .list {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    .item {
      display: flex;
      flex-direction: column;
      width: 285px;
      height: 140px;
      margin-bottom: 9px;
      color: #fff;
      border: 1px solid #06a4f8;
      .temp {
        height: 34px;
        line-height: 34px;
        padding-left: 32px;

        background: #337bb1;
      }
      .main-con {
        display: flex;
        flex: 1;
        align-items: center;
        justify-content: space-between;
        padding: 0 32px;
        .left {
          span {
            color: #06a4f8;
          }
          .time {
            margin-top: 30px;
            font-size: 12px;
          }
        }
        .right {
          width: 41px;
        }
      }
    }
  }
}
</style>


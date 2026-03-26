<template >
  <div class="circle-box">
    <div class="detail">
      <div class="item">
        <div class="nav-sm">工单总数</div>
        <div class="num">{{ workdata["工单总数"] }}<span>个</span></div>
      </div>
      <div class="item">
        <div class="nav-sm">未完成工单</div>
        <div class="num">{{ workdata["未完成工单"] }}<span>个</span></div>
      </div>
    </div>
    <div class="detail">
      <div class="item">
        <div class="nav-sm">已完成工单</div>
        <div class="num">{{ workdata["已完成工单"] }}<span>个</span></div>
      </div>
    </div>
    <div class="circle">
      <div class="circle1">
        <div class="inner">
          <div class="name">当日生成<br />的工单数量</div>
          <div class="num">
            {{ workdata["当日生成工单数量"] }}<span>个</span>
          </div>
        </div>
      </div>
      <div class="circle2">
        <div class="inner">
          <div class="name">当日未完<br />的工单数量</div>

          <div class="num">
            {{ workdata["当日未完成的工单数量"] }}<span>个</span>
          </div>
        </div>
      </div>
      <div class="circle3">
        <div class="inner">
          <div>当日完成<br />的工单数量</div>
          <div class="num">
            {{ workdata["当日完成的工单数量"] }}<span>个</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
<script>
import { findAllOrderSort } from '@/api/user';
import { mapGetters } from "vuex";
export default {
  computed: {
    ...mapGetters(["path", "sidelist", "leave", "userid"]),
  },
  data () {
    return {
      workdata: {}
    }
  },
  created () {
    findAllOrderSort(this.userid).then(res => {
      this.workdata = res.data;
    })
  },
}
</script>
<style lang="scss" scoped>
.circle-box {
  position: relative;

  padding: 0 14px;
  .detail {
    display: flex;
    align-items: center;
    margin-top: 54px;
    .item {
      margin-bottom: 36px;
      margin-right: 84px;
      &:last-child {
        margin-right: 0px;
      }
      .nav-sm {
        font-size: 16px;
        color: #4988fd;
      }
      .num {
        display: flex;
        align-items: flex-end;
        color: #fefefe;
        margin-top: 23px;
        span {
          margin-left: 10px;
          font-size: 11px;
          color: #4988fd;
        }
      }
    }
  }
}
.circle {
  text-align: center;
  line-height: 22px;
  .inner {
    width: 73px;
    margin: 0 auto;
    text-align: center;
  }
  .num {
    font-size: 24px;
    color: #fefefe;
    span {
      margin-left: 11px;
      font-size: 12px;
      color: #0db4ae;
    }
  }
}
.circle1 {
  position: absolute;
  top: 125px;
  right: 40px;
  box-sizing: border-box;
  padding: 38px 0;
  width: 149px;
  height: 149px;
  background: rgba(6, 24, 55, 0);
  box-shadow: inset 0px 0px 27px 0px #16cba9,
    inset 0px 15px 171px 66px rgba(8, 58, 48, 0.49);
  opacity: 0.8;
  border-radius: 50%;
  font-size: 12px;
  color: rgba(13, 180, 174, 1);
  .num {
    margin-top: 15px;
  }
}
.circle2 {
  position: absolute;
  box-sizing: border-box;
  padding: 25px;
  top: 287px;
  left: 23px;
  width: 131px;
  height: 131px;
  background: rgba(6, 24, 55, 0);
  box-shadow: inset 0px 0px 27px 0px #ce7322,
    inset 0px 15px 171px 66px rgba(66, 35, 8, 0.49);
  opacity: 0.8;
  border-radius: 50%;
  font-size: 12px;
  color: #a96d3f;

  .num {
    margin-top: 10px;

    span {
      margin-left: 8px;
      color: rgba(169, 109, 63, 1);
    }
  }
}
.circle3 {
  position: absolute;
  top: 362px;
  right: 18px;
  box-sizing: border-box;
  padding: 22px;
  width: 131px;
  height: 131px;
  box-shadow: inset 0px 0px 27px 0px #166fe1,
    inset 0px 15px 171px 66px rgb(7, 36, 72);
  opacity: 0.8;
  border-radius: 50%;
  font-size: 12px;
  color: #3079cb;
  .num {
    margin-top: 10px;
    span {
      margin-left: 7px;
      color: rgba(48, 121, 203, 1);
    }
  }
}
</style>
<template>
  <div :class="{ 'four-items': isFourItems }" class="info-container">
    <!-- 遍历数据 -->
    <div
        v-for="(item, index) in data && data.data && data.data.data"
        :key="index"
        :class="contentClass(index)"
        class="content"
    >
      <div class="listBox">
        <div class="title">{{ item.title }}</div>
        <div v-for="item2 in item.formItem" :key="item2.name" class="list">
          <div class="left">{{ item2.name }}</div>
          ：
          <div class="right">{{ item2.tagValue }}</div>
          &nbsp;
          <div v-if="item2.units" class="right right2">{{ item2.units }}</div>
        </div>
      </div>
    </div>
    <div class="nameplateClass">
      <div class="title">
        基本信息
      </div>
      <div v-for="item in nameplate && nameplate.data && nameplate.data.data" class="">
        {{ item.name }}：&nbsp;<span style="color: #756bdc">{{ item.value }}</span>
      </div>
    </div>
    <div class="imgBox" style="width: 750px;height: auto">
      <div v-if="!nameplate || !nameplate.data">
        <!-- 显示加载状态或占位符 -->
        <p>加载中...</p>
      </div>
      <img v-else :src="baseurl + nameplate.data.deviceImg" alt="" style="width: 80%;height: 80%"/>
      <div v-if="nameplate && nameplate.data && nameplate.data.load !== null" class="progressBar">
        <el-progress :percentage="nameplate.data.load" :stroke-width="20" :text-inside="true" color="#10e1ff"
                     stroke-linecap="square"></el-progress>
        <div class="text">机组负荷</div>
      </div>
    </div>
  </div>
</template>


<script>
import {mapGetters} from "vuex";
import {findByDrTypeIdAndDrId, findByDrId} from "@/api/contentsetting/information";
import globalData from "@/utils/global";

export default {
  props: ["drTypeId", "drId"],
  name: "Info",
  computed: {
    ...mapGetters(['path', 'id']),
    isFourItems() {
      // 检查是否正好有 4 条数据
      return (
          this.data &&
          this.data.data &&
          this.data.data.data &&
          this.data.data.data.length === 4
      );
    },
  },
  data() {
    return {
      baseurl: globalData.baseUrl,
      data: {},
      nameplate: {}
    }
  },
  methods: {
    contentClass(index) {
      if (this.isFourItems) {
        // 四角布局
        return `position-${index}`;
      }
      // 默认左右布局
      return {left: index % 2 === 0, right: index % 2 !== 0};
    },
    // contentClass(index) {
    //   if (index < 3) {
    //     // 第一排三个
    //     return 'first-row';
    //   }
    //   // 第二排及后面一行两个
    //   return index % 2 === 0 ? 'left' : 'right';
    // },
  },
  mounted() {
    findByDrTypeIdAndDrId(this.path, {drId: this.drId}).then(res => {
      if (res.status !== 20000) this.$message.error(res.msg);
      this.data = res
      console.log('查询成功', this.data)
    })
    findByDrId(this.path, this.drId).then(res => {
      // if (res.status !== 20000) this.$message.error(res.msg);
      // this.data = res
      console.log('查询图片成功', res)
      this.nameplate = res
    })
  },
}
</script>
<style lang="scss">
.el-progress {
  .el-progress-bar__outer {
    background-color: #b0f5ff; //这里是背景颜色
    .el-progress-bar__innerText {
      color: #000;
      font-size: 15px;
      //margin-left: 30px;
    }
  }
}
</style>
<style lang="scss" scoped>
.info-container {
  position: relative;
  display: flex;
  flex-wrap: wrap; /* 允许换行 */
  gap: 10px; /* 每个 content 之间的间距 */
  margin-top: 20px;
  color: #000;

  /* 默认布局 */
  .content {
    //position: absolute; /* 四角布局需要绝对定位 */
    display: flex;
    justify-content: space-between; /* 确保左右两侧内容分布 */
    //align-items: center; /* 垂直居中 */
    width: calc(50% - 30px); /* 每个内容占四分之一宽度 */
    padding: 10px;
    border-radius: 8px;

    .title {
      text-align: center;
      margin-bottom: 10px;
    }

    .list {
      display: flex;
      margin-bottom: 10px;
      height: 30px;
      line-height: 30px;
      font-size: 14px;

      .left {
        min-width: 100px;
        text-align: right;
      }

      .right {
        background: #0b516b;
        width: 80px;
        text-align: center;
        color: #fff;
        border-radius: 5px;
      }

      .right2 {
        width: 40px;
      }
    }
  }

  /* 左右对齐样式 */
  .left {
    justify-content: flex-start;
  }

  .right {
    justify-content: flex-end;
  }

  /* 其他样式 */
  .nameplateClass {
    bottom: -10%;
    right: 5%;
    z-index: 4;
    position: absolute;
    //transform: translate(-50%, -50%);

    .title {
      margin-top: 20px;
      text-align: center;
    }

    div {
      margin-bottom: 10px;
    }
  }

  .imgBox {
    position: absolute;
    top: 40%;
    left: 50%;
    transform: translate(-50%, -15%);
    z-index: 3;

    .progressBar {
      width: calc(100% - 40%);
      position: relative;
      margin: 15px auto 0;

      .text {
        position: absolute;
        left: -15%;
        top: 2px;
      }
    }
  }
}
</style>


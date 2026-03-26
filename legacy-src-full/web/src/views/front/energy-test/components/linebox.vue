<template>
  <div class="line-content">
    <el-button class="btn" type="text">系统能效</el-button>
    <div class="time">
      <el-radio-group v-model="type" @change="groupchange">
        <el-radio-button :label="$t('public.month')"></el-radio-button>
        <el-radio-button :label="$t('public.day')"></el-radio-button>
      </el-radio-group>
    </div>

    <div class="title">{{ time }}{{ $t('energytest_day.energyEfficiency') }}:（{{ num }}）</div>

    <div class="line-box" ref="numline">
      <svg-icon ref="imgline" class="img" icon-class="dibiao"/>
      <div
          v-for="(item, index) in textlist"
          :key="index"
          :class="[item.classname, 'p-box']"
      >
        <!--        <p>{{ item.name }}</p>-->
        <p>{{ $t('defaultpage.' + item.name) }}</p>
        <div class="lai">
          <div
              v-for="(item1, index2) in item.length"
              :key="index2"
              :class="[index2 >= item.showstart ? 'show' : '', 'line']"
          >
            <div v-if="item.text.hasOwnProperty(index2)" class="span">
              {{ item.text[index2] }}
            </div>
            <div class="span">
              {{ item.text2[index2] }}
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="electol">
      <div class="el-item">{{ $t('energytest_day.quantityOfElectricity') }}：{{ info.p }}KW*h</div>
      <div class="el-item">{{ $t('energytest_day.coolingCapacity') }}：{{
          info.c
        }}{{ $store.getters.unitSelete }}*h
      </div>
      <div class="el-item" v-if="getMShow">{{ $t('energytest_day.electricCharge') }}：{{ info.k }}{{ $t('public.rmb') }}</div>
      <div class="el-item" v-if="getMShow">{{ $t('energytest_day.coldUnitPrice') }}：{{
          info.m
        }}{{ $t('public.rmb') }}/{{ $store.getters.unitSelete }}*h
      </div>
    </div>
  </div>
</template>
<script>
import {findMonthEnergy, findTodayEnergy} from "@/api/front/energytest";
import {mapGetters} from "vuex";

export default {
  data() {
    return {
      // type: "日",
      type: this.$t('public.day'),
      colorlist: {
        blue: "rgba(66, 117, 233, 1)",
        green: "rgba(56, 208, 184, 1)",
        yellow: "rgba(222, 175, 47, 1)",
        red: "rgba(232, 55, 117, 1)",
      },
      textlist: [
        {
          // name: "优秀",
          name: 'excellent',
          length: 7,
          classname: "first",
          showstart: 2,
          text: {
            0: "cop",
            2: "(7.0)",
            4: "(5.9)",
          },
          text2: {
            2: "(0.502)",//0.50
            4: "(0.596)",//0.5961
          },
        },
        {
          // name: "良好",
          name: 'good',
          length: 4,
          classname: "secon",
          showstart: 0,
          text: {
            0: "(5.0)",
            2: "(4.4)",
          },
          text2: {
            0: "(0.703)",
            2: "(0.799)",
          },
        },
        {
          // name: "一般",
          name: 'average',
          length: 4,
          classname: "secon thrid",
          showstart: 1,
          text: {
            1: "(3.9)",
            3: "(3.5)",
          },
          text2: {
            1: "(0.899)",
            3: "(1.004)",
          },
        },
        {
          // name: "急需改善",
          name: 'needsImprovement',
          length: 7,
          classname: "first last",
          showstart: 1,
          text: {
            2: "(3.2)",
            4: "(2.9)",
          },
          text2: {
            2: "(1.116)",
            4: "(1.206)",
          },
        },
      ],
    };
  },
  props: {
    time: String,
    info: Object,
    num: String | Number,
    energynumRT: String | Number,
    getMShow:Boolean | String
  },
  watch: {
    num: {
      handler(val) {
        // console.log("this.boxinfo9999", this.info);
        this.caculatenum();
      },
      // deep: true,
      immediate: true,
    },
    info: {
      handler(val) {
        // console.log("info=>>>>>>>>>>>>>>", val);
      },
      deep: true,
      immediate: true,
    },
  },
  computed: {
    ...mapGetters(["id", "path"]),
  },
  methods: {
    caculatenum() {
      this.$nextTick(() => {
        let totalnum = window
            .getComputedStyle(this.$refs.numline)
            .width.split("px")[0];
        this.$refs.imgline.$el.style.right = this.getnum(totalnum) - 15 + "px";
      });
    },
    getnum(total) {
      const colorlist = {
        red: {
          data: [2.6, 3.5],
          len: 6,
          p: 0,
        },
        yellow: {
          data: [3.5, 4.1],
          len: 3,
          p: 6,
        },
        green: {
          data: [4.1, 5],
          len: 3,
          p: 9,
        },
        blue: {
          data: [5.0, 7.4],
          len: 6,
          p: 12,
        },
      };
      for (const key in colorlist) {
        let cur = colorlist[key];
        if (this.energynumRT >= cur.data[0] && this.energynumRT < cur.data[1]) {
          let eachnum = total / 18;
          let tilelen = eachnum * cur.len;
          this.$refs.imgline.$el.style.color = this.colorlist[key];
          return (
              ((this.energynumRT - cur.data[0]) / (cur.data[1] - cur.data[0])) * tilelen +
              cur.p * eachnum
          );
        } else if (this.energynumRT < 2.6) {
          this.$refs.imgline.$el.style.color = this.colorlist["red"];
          return 0;
        } else if (this.energynumRT > 7.4) {
          this.$refs.imgline.$el.style.color = this.colorlist["blue"];
          return total;
        }
      }
      return

      const colorlist2 = {
        //原数据 备份
        red: {
          data: [2.6, 3.5],
          len: 6,
          p: 0,
        },
        yellow: {
          data: [3.5, 4.1],
          len: 3,
          p: 6,
        },
        green: {
          data: [4.1, 5],
          len: 3,
          p: 9,
        },
        blue: {
          data: [5.0, 7.4],
          len: 6,
          p: 12,
        },
      };
      for (const key in colorlist) {
        let cur = colorlist[key];
        if (this.num >= cur.data[0] && this.num < cur.data[1]) {
          let eachnum = total / 18;
          let tilelen = eachnum * cur.len;
          this.$refs.imgline.$el.style.color = this.colorlist[key];
          return (
              ((this.num - cur.data[0]) / (cur.data[1] - cur.data[0])) * tilelen +
              cur.p * eachnum
          );
        } else if (this.num < 2.6) {
          this.$refs.imgline.$el.style.color = this.colorlist["red"];
          return 0;
        } else if (this.num > 7.4) {
          this.$refs.imgline.$el.style.color = this.colorlist["blue"];
          return total;
        }
      }
    },
    groupchange() {
      console.log(this.type)
      let val
      if (this.type === 'month' || this.type === '月') {
        val = '月'
      } else {
        val = '日'
      }
      this.$emit("groupchange", val);
    },
  },
};
</script>
<style lang="scss">
.time {
  .el-radio-button__inner {
    color: #fff;
    background: #0b516b;
    border-color: #137399;
  }

  .el-radio-button:first-child .el-radio-button__inner {
    border-color: #137399;
    border-radius: 20px 0 0 20px;
  }

  .el-radio-button:last-child .el-radio-button__inner {
    border-radius: 0 20px 20px 0;
    border-color: #137399;
  }

  .el-radio-button__orig-radio:checked + .el-radio-button__inner {
    box-shadow: none;
  }

  .el-radio-button__orig-radio:checked + .el-radio-button__inner {
    background: #0d8ebd;
  }
}

</style>
<style lang="scss" scoped>
.line-content {
  background: #08739a;
  position: relative;
  box-shadow: 13px 13px 3px #bfbfbf; /* 右边和下边阴影 */
}

.btn {
  color: rgba(103, 236, 255, 0.92);
  font-size: 18px;
  height: 20px;
  position: absolute;
  left: 30px;
}

.choose-box {
}

.time {
  display: flex;
  justify-content: flex-end;
  padding-top: 10px;

  v-deep .el-radio-button__inner {
    background: rgba(255, 255, 255, 0.04);
  }
}

.electol {
  margin-top: 108px;
  margin-left: 8%;
  margin-right: 8%;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px 18px;
  color: rgba(237, 245, 250, 0.92);
  display: grid;

  .el-item {
    margin-bottom: 0;
    padding: 10px 12px;
    border-radius: 14px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(122, 210, 255, 0.08);
  }
}

.title {
  margin-top: 2px;
  margin-bottom: 24px;
  margin-left: -36px;
  color: rgba(245, 251, 255, 0.96);
  text-align: center;
}

.line-box {
  position: relative;
  display: flex;
  align-items: center;
  width: calc(100% - 18px);
  margin: 0 auto;

  .img {
    position: absolute;
    top: -30px;
    font-size: 30px;
  }

  .p-box {
    position: relative;
    flex: 1;
    color: rgba(245, 251, 255, 0.96);
    height: 34px;
    line-height: 34px;
    text-align: center;
    font-size: 14px;

    &:nth-child(2) {
      //background: rgba(91, 145, 229, 1);
      background: linear-gradient(to right, #4c7eec, rgba(39, 141, 187, 0.6), rgba(13, 179, 255, 0.1));;
    }

    &:nth-child(3) {
      //background: rgba(75, 215, 198, 1);
      background: linear-gradient(to right, #38c8b4, rgba(56, 200, 180, .6), rgba(13, 179, 255, 0));;
    }

    &:nth-child(4) {
      //background: rgba(227, 184, 88, 1);
      background: linear-gradient(to right, #d5a830, rgba(213, 168, 48, 0.6), rgba(13, 179, 255, 0));
    }

    &:nth-child(5) {
      //background: rgba(236, 82, 133, 1);
      background: linear-gradient(to right, #d53871, rgba(13, 179, 255, 0.1));
    }

    &.first {
      flex: 6;

      .lai {
        .line {
          &:last-child {
            visibility: hidden;
          }
        }
      }
    }

    &.last {
      .lai {
        .line {
          &:nth-last-child(2) {
            visibility: hidden;
          }
        }
      }
    }

    &.secon {
      flex: 3;
    }

    &.thrid {
      .lai {
        .line {
          &:nth-child(2n + 1) {
            height: 10px;
          }

          &:nth-child(2n) {
            height: 20px;
          }
        }
      }
    }

    .lai {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      position: absolute;
      width: 100%;
      height: 20px;
      left: 0;

      .line {
        width: 1px;

        visibility: hidden;
        background: rgba(167, 214, 244, 0.38);

        &:nth-child(2n + 1) {
          height: 20px;
        }

        &:nth-child(2n) {
          height: 10px;
        }

        &.show {
          visibility: visible;
        }

        .span {
          margin-top: 18px;
          visibility: visible;
          margin-left: -13.5px;
          color: rgba(206, 228, 239, 0.72);
        }

        .span:nth-child(2) {
          margin-top: 0;
          visibility: visible;
          margin-left: -13.5px;
          color: rgba(206, 228, 239, 0.72);
        }

        &:before {
          position: absolute;
          left: 0;
          right: 0;
          margin: auto;
          top: 0;
          content: "";
          width: 1px;
          height: 20px;
        }
      }
    }
  }
}
</style>

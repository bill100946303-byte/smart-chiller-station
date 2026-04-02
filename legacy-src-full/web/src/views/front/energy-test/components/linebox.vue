<template>
  <div class="line-content">
    <div class="line-content__top">
      <div class="line-content__heading">
        <div class="line-content__eyebrow">能效等级</div>
        <div class="line-content__title-row">
          <div class="line-content__title">系统能效</div>
          <span class="line-content__mode">{{ viewModeLabel }}</span>
        </div>
      </div>
      <div class="time">
        <el-radio-group v-model="type" @change="groupchange">
          <el-radio-button :label="$t('public.month')"></el-radio-button>
          <el-radio-button :label="$t('public.day')"></el-radio-button>
        </el-radio-group>
      </div>
    </div>

    <div class="line-content__summary">
      <div class="line-content__main">
        <strong>{{ formattedMainValue }}</strong>
        <span>{{ $store.getters.unitSelete }}/{{ $store.getters.unitSelete }}</span>
      </div>
      <div class="line-content__sub">当前{{ viewModeLabel }} · 判断系统能效等级</div>
    </div>

    <div class="line-content__grade">
      <div class="line-content__grade-head">
        <span>等级带</span>
        <span>{{ viewModeLabel }}</span>
      </div>
      <div class="line-box" ref="numline">
        <svg-icon ref="imgline" class="img" icon-class="dibiao"/>
        <div
          v-for="(item, index) in textlist"
          :key="index"
          :class="[item.classname, 'p-box']"
        >
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
    </div>

    <div class="electol">
      <div v-for="item in metricItems" :key="item.key" class="el-item">
        <span class="el-item__label">{{ item.label }}</span>
        <strong class="el-item__value">{{ item.value }}</strong>
      </div>
    </div>
  </div>
</template>
<script>
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
    viewModeLabel() {
      const monthLabel = this.$t("public.month");
      return this.type === monthLabel || this.type === "月" ? "月视图" : "日视图";
    },
    formattedMainValue() {
      return this.formatMetricValue(this.num, 2);
    },
    metricItems() {
      const unit = this.$store.getters.unitSelete;
      const items = [
        {
          key: "p",
          label: this.$t("energytest_day.quantityOfElectricity"),
          value: `${this.formatMetricValue(this.info && this.info.p, 1)} kWh`
        },
        {
          key: "c",
          label: this.$t("energytest_day.coolingCapacity"),
          value: `${this.formatMetricValue(this.info && this.info.c, 1)} ${unit}*h`
        }
      ];
      if (this.getMShow) {
        items.push(
          {
            key: "k",
            label: this.$t("energytest_day.electricCharge"),
            value: `${this.formatMetricValue(this.info && this.info.k, 2)}${this.$t("public.rmb")}`
          },
          {
            key: "m",
            label: this.$t("energytest_day.coldUnitPrice"),
            value: `${this.formatMetricValue(this.info && this.info.m, 2)}${this.$t("public.rmb")}/${unit}*h`
          }
        );
      }
      return items;
    }
  },
  methods: {
    toNumber(value) {
      if (value === undefined || value === null || value === "" || value === "-1") {
        return null;
      }
      const number = Number(String(value).replace(/,/g, ""));
      return isNaN(number) ? null : number;
    },
    formatMetricValue(value, digits = 1) {
      const number = this.toNumber(value);
      if (number === null) {
        return "--";
      }
      return number.toLocaleString("zh-CN", {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits
      });
    },
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
<style lang="scss" scoped>
.line-content {
  position: relative;
  display: grid;
  gap: 8px;
  padding: 10px;
  border-radius: 18px;
  border: 1px solid rgba(132, 187, 255, 0.08);
  background: linear-gradient(180deg, rgba(15, 33, 51, 0.9) 0%, rgba(8, 18, 31, 0.94) 100%);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.03);
}

.line-content__top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.line-content__heading {
  min-width: 0;
}

.line-content__eyebrow {
  font-size: 9px;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: rgba(171, 205, 225, 0.66);
}

.line-content__title-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 2px;
}

.line-content__title {
  color: rgba(245, 251, 255, 0.96);
  font-size: 16px;
  font-weight: 700;
}

.line-content__mode {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 999px;
  border: 1px solid rgba(132, 187, 255, 0.14);
  background: rgba(255, 255, 255, 0.04);
  color: rgba(197, 224, 239, 0.72);
  font-size: 10px;
}

.line-content__summary {
  display: grid;
  gap: 2px;
}

.line-content__main {
  display: inline-flex;
  align-items: baseline;
  gap: 6px;
  color: rgba(245, 251, 255, 0.96);

  strong {
    font-size: 30px;
    line-height: 1;
    font-weight: 700;
  }

  span {
    font-size: 12px;
    color: rgba(177, 201, 219, 0.74);
  }
}

.line-content__sub {
  font-size: 10px;
  color: rgba(177, 201, 219, 0.68);
}

.line-content__grade {
  display: grid;
  gap: 8px;
}

.line-content__grade-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  font-size: 10px;
  color: rgba(177, 201, 219, 0.72);
}

.choose-box {
}

.time {
  display: flex;
  justify-content: flex-end;
  flex-shrink: 0;
}

.electol {
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px 10px;
  color: rgba(237, 245, 250, 0.92);
  display: grid;

  .el-item {
    margin-bottom: 0;
    display: grid;
    gap: 3px;
    padding: 8px 10px;
    border-radius: 12px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(122, 210, 255, 0.08);
  }

  .el-item__label {
    font-size: 10px;
    line-height: 1.3;
    color: rgba(185, 210, 228, 0.68);
  }

  .el-item__value {
    font-size: 15px;
    line-height: 1.2;
    color: rgba(245, 251, 255, 0.96);
    font-weight: 700;
  }
}

.line-box {
  position: relative;
  display: flex;
  align-items: center;
  width: 100%;
  margin: 0 auto;
  padding-top: 22px;

  .img {
    position: absolute;
    top: -2px;
    font-size: 26px;
  }

  .p-box {
    position: relative;
    flex: 1;
    color: rgba(245, 251, 255, 0.96);
    height: 34px;
    line-height: 34px;
    text-align: center;
    font-size: 12px;

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
      height: 38px;
      left: 0;
      top: 34px;

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
          margin-top: 12px;
          visibility: visible;
          margin-left: -14px;
          color: rgba(206, 228, 239, 0.72);
          font-size: 9px;
        }

        .span:nth-child(2) {
          margin-top: 4px;
          visibility: visible;
          margin-left: -14px;
          color: rgba(206, 228, 239, 0.72);
          font-size: 9px;
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

::v-deep .time .el-radio-group {
  display: inline-flex;
  padding: 3px;
  border-radius: 999px;
  border: 1px solid rgba(132, 187, 255, 0.12);
  background: rgba(255, 255, 255, 0.04);
}

::v-deep .time .el-radio-button__inner {
  min-width: 44px;
  height: 26px;
  line-height: 24px;
  padding: 0 10px;
  color: rgba(214, 231, 243, 0.7);
  background: transparent;
  border: none !important;
  border-radius: 999px !important;
  box-shadow: none !important;
  font-size: 10px;
}

::v-deep .time .el-radio-button__orig-radio:checked + .el-radio-button__inner {
  background: linear-gradient(135deg, #2d86ff 0%, #1ca2da 100%);
  color: #fff;
}
</style>

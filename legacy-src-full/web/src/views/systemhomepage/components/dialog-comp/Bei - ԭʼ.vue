<template>
  <div class="top">
    <div class="write-box" v-if="readAndWriteParams.length">
      <div
        class="detail"
        v-for="(item, index) in readAndWriteParams"
        :key="index"
      >
        <div class="title">{{ item.name }}:</div>
        <div class="right">
          <p v-if="item.isSelect">
            <el-select
              v-model="item.value"
              placeholder="请选择"
              @change="changeDisabled($event, item)"
            >
              <el-option
                v-for="(item, index) in item.arr"
                :label="item.value"
                :value="item.value"
                :key="index"
              ></el-option>
            </el-select>
          </p>
          <p v-if="!item.isSelect">
            <el-input
              v-model="item.value"
               placeholder="请输入"
               
              @input="getinputValue($event, item)"
            ></el-input>
          </p>
          <p class="gray-name" v-if="!item.regSub">
            {{ item.regUnits }}
          </p>

          <!-- <div  :disabled="false">
            提交
          </div> -->

          <el-button
            type="primary"
            class="btn"
            @click="changeReg(item, index)"
            :disabled="item.isOpen"
          >
            提交</el-button
          >
        </div>
      </div>
      <div class="status">
        <!-- <div class="btn" @click="open = !open">
          {{ open ? "关闭" : "开启" }}
        </div> -->
        <!-- <div class="btn" @click="changeReg">提交</div> -->
      </div>
    </div>
  </div>
</template>

<script>
import { valToId } from "@/utils/selectexchange";

import { operationRegs } from "@/api/usersetting/devicemonitor/model1";
import { mapGetters } from "vuex";
import { getControl } from "@/utils/auth";
export default {
  props: ["drTypeId", "drId"],
  computed: {
    ...mapGetters(["baseInfo", "path", "userid", "id", "subs"]),
  },
  data() {
    return {
      control: getControl(),
      open: true,
      readAndWriteParams: [],
    };
  },
  watch: {
    baseInfo: {
      handler(val) {
         
        if (val) {
          this.handleData(val);
        }
      },
      deep: true,
      immediate: true,
    },

    // readAndWriteParams: {
    //   handler(val, newval) {
    //     console.log(val);
    //     console.log(newval);
    //   },
    //   deep: true,
    // },
  },
  created() {
    console.log(this.control, "control");
  },
  methods: {
    getinputValue(i, v) {
      v.isOpen = false;
    },
    changeDisabled(val, item) {
      item.isOpen = false;
    },
    handleData(data) {
      
      // console.log(data, "设备控制");
      this.readAndWriteParams = [];
      let writearr = [];
      data.forEach((item) => {
        if (item.regReadWrite === "2") {
         
          writearr.push(item);
        }
      });
      writearr.forEach((param) => {
        console.log(param, "ele");
        if (param.regName.includes(param.drname)) {
          param.regName = param.regName.slice(
            -(param.regName.length - param.drname.length - 1)
          );
        }
 
        if (param.regSub) {

          let obj = {
            name: param.drname+"_"+ param.regName,
            isSelect: true,
            arr: this.handleParam(param.regSub),
            value: this.handlevalue(param),
            regUnits: param.regUnits,
            tagName: param.tagName,
            isOpen: true,
          };
          // console.log(obj, "obj");
          this.readAndWriteParams.push(obj);
        } else {
          let obj = {
            name:param.drname+"_"+ param.regName,
            isSelect: false,
            isOpen: true,
            value: param.qstagvalue,
            tagName: param.tagName,
          };
          // console.log(obj, "elseobj");
          this.readAndWriteParams.push(obj);
        }
          
      });
    },
    handlevalue(param) {
      // console.log(param,"qstag");
      let value;
      this.subs.forEach((sub) => {
        // console.log(sub,"sub");
        if (
          param.regSub &&
          param.regSub == sub.subid &&
          sub.valueType == "1" &&
          param.qstagvalue == sub.value
        ) {
          value = sub.text;
        } else if (
          param.regSub &&
          param.regSub == sub.subid &&
          sub.valueType == "2" &&
          sub.andOr == "1" &&
          param.qstagvalue >= sub.valueMin &&
          param.qstagvalue <= sub.valueMax
        ) {
          value = param.qstagvalue;
        } else if (
          param.regSub &&
          param.regSub == sub.subid &&
          sub.valueType == "2" &&
          sub.andOr == "2" &&
          (param.qstagvalue < sub.valueMin || param.qstagvalue > sub.valueMax)
        ) {
          value = param.qstagvalue;
        }
      });
      // console.log(value,"value");
      return value;
    },
    handleParam(subid) {
      let arr = [];
      this.subs.forEach((ele) => {
        if (ele.subid === parseInt(subid)) {
          let obj = {
            id: ele.value,
            value: ele.text,
          };
          arr.push(obj);
        }
      });
      return arr;
    },
    // 改变读写参数的数值
    changeReg(item, index) {

      //  control: 1 可控
      //  control: 0 不可控
      // console.log(this.control, "control");
      this.$confirm('您确定要提交吗?', '提示', {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        // type: 'warning'
      }).then(() => {
        if (this.control == 1) {
          let msg = [];
          if (item.tagName != null && item.tagName != "") {
            msg.push(item.name + "|" + valToId(item.value, item.arr)+"|"+item.tagName);
          } else {
            this.$message.warning("该变量没有绑定寄存器，无法控制");
          }

          if (msg.length != 0) {
            let info = {
              userId: this.userid,
              appId: this.id,
              drTypeId: this.drTypeId,
              drId: this.drId,
              msg: msg.join(","),
            };
            operationRegs(this.path, info)
                .then((res) => {
                  if (res.status === 20000) {
                    this.$message.success("修改成功！");
                  }
                })
                .catch(console.log);
          }
        } else {
          this.$message.warning("无权限!");
        }
      })
    },

    getvalue(item) {
      if (item.isSelect) {
        return item.arr.find((ele) => ele.value == item.value).id;
      } else {
        return item.value;
      }
    },
  },
};
</script>

<style lang="scss" scoped>
@mixin green {
  text-shadow: 0px 8px 10px #00000073;
  // -webkit-text-stroke: 1px #000000;
  // text-stroke: 1px #000000;

  background: linear-gradient(0deg, rgba(45, 141, 246, 1) 0%, #fff 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}
.top {
  margin-top: 60px;
  .status {
    display: flex;
    align-items: center;
  }
  .btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 47px;
    height: 26px;
    font-weight: 500;
    color: #f2fffe;
    cursor: pointer;
    text-shadow: 0px 0px 9px rgba(30, 146, 255, 0.6);
    background: url(../../../../assets/switch.png) center center / 155%
      no-repeat;
    margin-right: 20px;
    font-size: 12px;
  }
}
.write-box {
  padding: 0 112px;
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  margin-top: 60px;
  .detail {
    display: flex;
    align-items: center;
    flex-shrink: 0;
    padding-right: 0;
    min-width: 25%;
    margin-bottom: 24px;
    .title {
      width: auto;
      margin-right: 14px;
      font-size: 14px;
      color: #fff;
      text-shadow: 0px 6px 8px rgba(0, 0, 0, 0.75);
    }
    &:last-child {
      margin-top: 20px;
    }
  }
  .status {
    margin-bottom: 24px;
  }

  .right {
    input {
    }
    span {
      font-size: 14px;
      @include green;
    }
  }
}
</style>
<style lang="scss">
@mixin green {
  text-shadow: 0px 8px 10px #00000073;
  // -webkit-text-stroke: 1px #000000;
  // text-stroke: 1px #000000;

  background: linear-gradient(0deg, rgba(45, 141, 246, 1) 0%, #fff 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}
// 弹出框的
.darkblue .el-message-box {
      border: 1px solid #000000;
  .el-message-box__header{
    .el-message-box__title{
      span{
        color: #ffffff;
      }
    }
  }
}
.write-box {
  .right {
    display: flex;
    .btn {
      margin-left: 20px;
      border: none;
      &:hover {
        background: url(../../../../assets/switch.png) center center / 155%;
        color: #fff;
      }
    }
    ::v-deep .el-button {
      border: none;
    }
    .el-input__inner {
      width: 90px;
      height: 30px;
      text-align: center;
      background: rgba(0, 4, 8, 1) !important;
      font-size: 14px;
      border: none;
      outline: none;
      border-radius: 3px;
      border: 1px solid #359fed !important;
      color: #fff;
    }
  }
}
</style>
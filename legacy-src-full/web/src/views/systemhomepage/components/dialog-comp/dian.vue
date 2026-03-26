<template >
  <div class="can">
    <div class="top">
      <div class="write-box" v-if="readAndWriteParams.length">
        <div class="detail" v-for="(item, index) in readAndWriteParams" :key="index">
          <div class="title">{{ item.name }}:</div>
          <div class="right">
            <p v-if="item.isSelect">
              <el-select v-model="item.value" :disabled="!open">
                <el-option
                  v-for="(item,index) in item.arr"
                  :label="item.value"
                  :value="item.value"
                  :key="index"
                ></el-option>
              </el-select>
            </p>

            <p v-if="!item.isSelect">
              <el-input v-model="item.value" :disabled="!open"></el-input>
            </p>
            <p class="gray-name" v-if="!item.regSub">
              {{ item.regUnits }}
            </p>
          </div>
        </div>
        <div class="status">
          <div class="btn" @click="open = !open">
            {{ open ? "关闭" : "开启" }}
          </div>
          <div class="btn" @click="changeReg">提交</div>
        </div>
      </div>
    </div>
    <div class="main">
      <div class="detail" v-for="(item,index) in arr" :key="index">
        <div class="title">{{ item.regName }}:</div>
        <div class="num">{{ item.tagValue }}{{ item.regUnits }}</div>
      </div>
    </div>
  </div>
</template>
<script>
import { findAllReg } from '@/api/contentsetting/drawedit';
import {
  findSub,
  operationRegs
} from "@/api/usersetting/devicemonitor/model1";
import { mapGetters } from 'vuex';
export default {
  computed:{
    ...mapGetters(['dianInfo','path'])
  },
  data () {
    return {
      open: false,
      readAndWriteParams: [],
      arr: [],
      subs: [],
      updateSub: [], // 待修改的sub
      thisSubs: [],
    }
  },
  watch:{
    dianInfo:{
      handler(val) {
        if(val&&val.length){
          if(this.subs.length){
            this.handleData(val)
          }else{
            this.getSub().then(res=>{
              this.handleData(val)
            })
          }
        }
      },
      deep: true,
      immediate: true,
    }
  },
  created () {
    
  },
  methods: {
    getSub(){
     return findSub(this.path)
      .then((res) => {
        this.subs = res.data;
        this.arr = [];
      })
    },
    handleData(data){
      let writearr = []
      this.arr = []
      this.readAndWriteParams = []
          data.forEach(item => {
            if (item.regReadWrite === "2") {
              writearr.push(item);
            } else {
              this.arr.push(item);
            }
          })
          writearr.forEach((param) => {
            if (param.regSub) {
              let obj = {
                name: param.regName,
                isSelect: true,
                arr: this.handleParam(param.regSub),
                value: this.handlevalue(param),
                regUnits: param.regUnits,
                tagName: param.tagName
              }
              this.readAndWriteParams.push(obj)
            } else {
              let obj = {
                name: param.regName,
                isSelect: false,
                value: param.tagValue,
                tagName: param.tagName
              }
              this.readAndWriteParams.push(obj)
            }
          });
          this.arr = this.mapArr(this.arr)
        
    },
    handleParam (subid) {
      let arr = []
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
    mapArr (arr) {
      return arr.map(item => {
        if (item.regSub) {
          item.tagValue = this.handlevalue(item)
          return item
        } else {
          item.tagValue = item.qstagvalue?item.qstagvalue:item.tagValue
          return item
        }
      })
    },
    handlevalue (param) {
      let value;
      this.subs.forEach((sub) => {
        if (
          param.regSub &&
          param.regSub == sub.subid &&
          sub.valueType == "1" &&
          param.tagValue == sub.value
        ) {
          value = (sub.text);
        } else if (
          param.regSub &&
          param.regSub == sub.subid &&
          sub.valueType == "2" &&
          sub.andOr == "1" &&
          param.tagValue >= sub.valueMin &&
          param.tagValue <= sub.valueMax
        ) {
          value = (param.tagValue);
        } else if (
          param.regSub &&
          param.regSub == sub.subid &&
          sub.valueType == "2" &&
          sub.andOr == "2" &&
          (param.tagValue < sub.valueMin ||
            param.tagValue > sub.valueMax)
        ) {
          value = (param.tagValue);
        }
      });
      return value
    },
    getvalue (item) {
      if (item.isSelect) {

        return item.arr.find(ele => ele.value == item.value).id
      } else {
        return item.value
      }

    },
    // 改变读写参数的数值
    changeReg () {
      let msg = [];
      this.readAndWriteParams.forEach((ele, i) => {
        if (ele.tagName != null && ele.tagName != "") {
          msg.push(
            ele.tagName + ":" + this.getvalue(ele)
          );
        } else {
          this.$message.warning("该变量没有绑定寄存器，无法控制");
        }
      });
      if (msg.length != 0) {
        console.log('msg', msg)
        operationRegs(this.path, this.id, msg.join(","))
          .then((res) => {
            if (res.status === 20000) {
              this.$message.success("修改成功！");
            }
          })
          .catch(console.log);
      }
    },
  },
}
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
.can {
  padding: 0px 0px 50px 55px;
  .el-input {
    width: 60px;
    margin-right: 5px;
    .el-input__inner {
      padding: 0 5px;
      height: 28px;
      color: #fff;
      box-shadow: inset 0px 0px 13px 0px #3870ff;
      outline: none;
      border: none;
    }
  }
  .top {
    .status {
      display: flex;
      align-items: center;
      justify-content: center;
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
}

.write-box {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  margin-top: 60px;
  .detail {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-left: 30px;
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
  .status{
    margin-left: 20px;
    margin-bottom: 24px;
  }

  .right {
    input {
      width: 50px;
      height: 24px;
      text-align: center;
      background: rgba(0, 46, 123, 0.58);
      font-size: 14px;
      border: none;
      box-shadow: inset 0px 0px 13px 0px #3870ff;
      outline: none;
      border-radius: 3px;
      @include green;
    }
    span {
      font-size: 14px;
      @include green;
    }
  }
}
.main {
  width: 100%;
  margin-top: 62px;
  padding-left: 30px;
  display: grid;
  grid-template-columns: repeat(3,1fr);
  .detail {
    overflow: hidden;
    display: flex;
    flex-wrap: nowrap;
    align-items: center;
    margin-bottom: 25px;
    color: #ffffff;
    padding-right: 36px;

    .title {
      flex: 1;
      overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
      margin-right: 10px;
    }
    .num{
      flex-shrink: 0;
      @include green;
    }
  }
}
</style>
<style lang="scss">
.can{
  .el-input {
    width: 60px;
    margin-right: 5px;
    .el-input__inner {
      padding: 0 5px;
      height: 28px;
      color: #fff;
      box-shadow: inset 0px 0px 13px 0px #3870ff;
      outline: none;
      border: none;
    }
  }
}
</style>
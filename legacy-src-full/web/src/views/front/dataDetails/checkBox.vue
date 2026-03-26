<template>
  <div class="chenckBox">
    <div ref="check_box" class="check_box">
      <el-row>
        <el-checkbox-group v-model="checkList" @change="changeBox">
          <el-col v-for="(item,index) in list" :key="index" :span="3">
            <el-checkbox :key="index" :label="item.typemodeid">{{ item.regName }}
            </el-checkbox>
          </el-col>
        </el-checkbox-group>
      </el-row>
    </div>
<!--    <div v-show="list.length > 16" class="icon" @click="clickShow">-->
<!--      <div v-if="!show"><i class="el-icon-caret-bottom el_icon"></i><div>展开</div></div>-->
<!--      <div v-else><i class="el-icon-caret-top el_icon"></i><div>收起</div></div>-->
<!--    </div>-->
  </div>
</template>

<script>
import {findAllByDrTypeId} from '@/api/contentsetting/varmanage'
import {mapGetters} from "vuex";

export default {
  name: "checkBox.vue",
  props: {
    drTypeId: Number | String,
    drId: Number | String,
    checkLists: Array
  },
  computed: {
    ...mapGetters(['path'])
  },
  watch: {
    drId: {
      handler(val) {
        this.findCheckboxData()
      },
      immediate: true
    },
    checkLists: {
      handler(val) {
        console.log('val',val)
        this.checkList = this.checkLists
      },
      deep: true,
      immediate: true,
    },
  },
  data() {
    return {
      list: [],
      checkList: [],
      show: false
    }
  },
  methods: {
    //  查找复选框数据
    findCheckboxData() {
      findAllByDrTypeId(this.path, {drtypeid: this.drTypeId, drId: this.drId}).then(res => {
        // let list = []
        // res.data.map(data => {
        //   list.push({
        //     typemodeid: data.typemodeid,
        //     regName: data.regName,
        //     checked: false
        //   })
        // })
        this.list = res.data;
        this.checkList=this.checkLists
        this.$emit('chenkShow',this.list.length)
      })
    },
    changeBox() {
      let data = [];
      /*console.log("checkList", this.checkList)*/
      this.list.forEach(obj => {
        /*console.log("obj", obj)*/
        if (this.checkList.indexOf(obj.typemodeid) !== -1) {
          data.push({value: obj.typemodeid, label: obj.regName})
        }
      })
      this.$emit("chenkBox", this.checkList);
      this.$emit("chenkBox2", data);
    },
    /*clickShow() {
      this.show = !this.show
      console.log(this.show)
      if (this.show) {
        this.$refs.check_box.style.overflow = "visible"
      } else {
        this.$refs.check_box.style.overflow = "hidden"
      }
    }*/
  }
}
</script>

<style lang="scss" scoped>
.chenckBox {
  width: 100%;

  .check_box {
    height: 100px;
    overflow: hidden;
    overflow-y: auto;
  }

  margin: 10px 0;
}

.icon {
  width: 100%;
  height: 40px;
  display: flex;
  justify-content: space-evenly;
  color: #feffff;
  cursor: pointer;

  .el_icon {
    font-size: 30px;
    padding-top: 3px;
  }
  div{
    display: flex;
    margin-left: 5px;
    line-height: 40px;
  }
}
.chenckBox ::-webkit-scrollbar {
  display: flex !important;
  width: 6px;
  height: 6px;
}
/*设置宽度,轨道颜色*/
.chenckBox ::-webkit-scrollbar {
  //width: 5px;
  background: transparent;
}

/*滚动条*/
.chenckBox ::-webkit-scrollbar-thumb {
  //background: transparent;
  border-radius: 4px;
  background: #575656;
  -webkit-transition: all 1s;
  transition: all 1s;
  width: 16px;
}
</style>
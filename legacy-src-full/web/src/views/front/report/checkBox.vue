<template>
  <div class="chenckBox">
    <div ref="check_box" class="check_box">
      <el-row>
        <!--        <el-col v-for="(item,index) in list" :key="index" :span="3
                  <el-checkbox-group v-model="item.checked">
                    <el-checkbox v-model="checkList" @change="changeBox(item)">{{ item.regName }}</el-checkbox>
                  </el-checkbox-group>
                </el-col>-->

        <el-checkbox-group v-model="checkList" @change="changeBox"  >
          <el-col v-for="(item,index) in list" :key="index" :span="3">
            <el-checkbox :key="index" :label="item.typemodeid">{{ item.regName }}
            </el-checkbox>
          </el-col>
        </el-checkbox-group>
      </el-row>
    </div>
    <div v-if="list.length > 16" class="icon" @click="clickShow">
      <div v-if="!show"><i class="el-icon-caret-bottom el_icon" style="color: #c3d6ee"></i>
        <div>{{ $t('dataDetails.expand') }}</div>
      </div>
      <div v-else><i class="el-icon-caret-top el_icon" style="color: #c3d6ee"></i>
        <div>{{ $t('dataDetails.collapse') }}</div>
      </div>
    </div>
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
        this.list = res.data
      })
    },
    changeBox(item) {
      // console.log('checkList', this.checkList)
      this.$emit("chenkBox", this.checkList);
    },
    clickShow() {
      this.show = !this.show
      console.log(this.show)
      if (this.show) {
        this.$refs.check_box.style.overflow = "visible"
      } else {
        this.$refs.check_box.style.overflow = "hidden"
      }
    }
  }
}
</script>

<style lang="scss" scoped>
.chenckBox {
  width: 100%;

  .check_box {
    height: 47px;
    overflow: hidden;
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
</style>
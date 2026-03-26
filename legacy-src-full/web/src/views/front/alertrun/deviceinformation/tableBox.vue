<template>
  <div>
    <div class="preserve">
      <el-button icon="el-icon-plus" type="primary" @click="sendRequest()">保存</el-button>
      <el-button v-if="formData.length < 6" class="addForm" @click="addFormItem(1)">新增表格</el-button>
    </div>
    <div class="tableBox">
      <div v-for="(form, index) in formData" :key="index" class="form-wrapper">
        <!--        <h3 class="title">index:{{ index + 1 }}</h3>-->
        <div class="title">
          表头：
          <el-input v-model="form.title"></el-input>
          <el-button class="add-button" icon="el-icon-minus" type="danger" @click="deleteForm(form,index)">删除当前组
          </el-button>
        </div>
        <el-form ref="form" class="form">
          <el-form-item v-for="(formItem, index2) in form.formItem" :key="`${form.index}_${index2}`" label="名称 / 点位">
            <el-input v-model="formItem.name"></el-input>
            <el-cascader
                :ref="`cascader${index}_${index2}`"
                v-model="formItem.regId"
                :options="PointPositionData"
                :placeholder="`cascader${index}_${index2}`"
                :props="{
                  emitPath:false,
                  expandTrigger: 'hover',
                  label: 'drnameCNEN',
                  value: 'drtypeid',
                  children: 'reglist',
             }"
                filterable
                @change="handleChange(index,index2)">
            </el-cascader>
            <el-button class="add-button" icon="el-icon-minus" type="danger" @click="deleteFormItem(index,index2)">删除
            </el-button>
          </el-form-item>
          <div class="add-button">
            <el-button icon="el-icon-plus" type="primary" @click="addFormItem(2,index)">新增名称/点位
            </el-button>
          </div>
        </el-form>
      </div>
    </div>
  </div>
</template>
<script>
import {findAllByDrTypeId} from "@/api/deviceinformation";
import {findByDrTypeIdAndDrId} from "@/api/contentsetting/information";

import {mapGetters} from "vuex";

export default {
  name: "tableBox",
  props: ["drId", "drTypeId"],
  data() {
    return {
      formData: [{
        index: 0,
        formItem: [{}, {}, {}]
      }, {
        index: 1,
        formItem: [{}, {}, {}]
      }, {
        index: 2,
        formItem: [{}, {}, {}]
      }, {
        index: 3,
        formItem: [{}, {}, {}]
      }], // 表单项数组
      value: '',
      PointPositionData: [], // 点位数据
      PointPositionDataAll: [], // 点位数据
    };
  },

  computed: {
    ...mapGetters(["path"])
  },
  created() {

  },
  watch: {
    drId: {
      handler(val) {
        console.log('drId changed:', val);
        if (val != 0) {
          if (this.PointPositionDataAll.length === 0) {
            console.log('进来了？')
            this.find()
          } else {
            console.log(this.PointPositionDataAll, '1111')
            this.equipmentInformation()
          }
        }
      },
      deep: true,
      immediate: true,
    },
  },
  methods: {
    find() {
      findAllByDrTypeId(this.path).then(res => {
        console.log('res', res, this.drId)
        res.data.forEach(data => {
          data.reglist.forEach(data2 => {
            data2.drnameCNEN = data2.regName
            data2.drtypeid = data2.regId
          })
        })
        // console.log(res.data)
        // this.PointPositionData = res.data
        this.PointPositionDataAll = res.data
        this.equipmentInformation()
      })
    },
    deleteForm(form, index) {
      console.log(this.formData, index, this.formData[index])
      this.formData.splice(index, 1)
    },
    equipmentInformation() {
      // console.log(this.drId, this.drTypeId, 22222)
      console.log('1111', this.drId, this.PointPositionDataAll)
      this.PointPositionData = []
      for (let item of this.PointPositionDataAll) {
        if (this.drId === item.drid) {
          this.PointPositionData = item.reglist
        }
      }
      findByDrTypeIdAndDrId(this.path, {drId: this.drId, drTypeId: this.drTypeId}).then(res => {
        if (res.status !== 20000) {
          this.formData = [{
            index: 0,
            formItem: [{}, {}, {}]
          }, {
            index: 1,
            formItem: [{}, {}, {}]
          }, {
            index: 2,
            formItem: [{}, {}, {}]
          }, {
            index: 3,
            formItem: [{}, {}, {}]
          }]
          console.log('查询失败222', this.formData)
          return
        }
        if (res.data.data) {
          this.formData = res.data.data
        }
        console.log('查询成功', this.formData, res)
        this.$emit('modifyLoad', res.data.load)
      }).catch(err => {
        console.log(err)
        this.$emit('modifyLoad', 0)
        this.formData = [{
          index: 0,
          formItem: [{}, {}, {}]
        }, {
          index: 1,
          formItem: [{}, {}, {}]
        }, {
          index: 2,
          formItem: [{}, {}, {}]
        }, {
          index: 3,
          formItem: [{}, {}, {}]
        }]
      });
    },
    sendRequest() {
      this.$emit('change', this.formData)
    },
    deleteFormItem(index, index2) {
      console.log(this.formData, index, this.formData[index].formItem[index2])
      this.formData[index].formItem.splice(index2, 1)
    },
    // 点击新增按钮时触发
    addFormItem(val, data) {
      // console.log(this.formData)
      // const newItemKey = `item${this.formData.length + 1}`; // 生成新的表单项的 key
      if (val === 1) {
        console.log('新增前', this.formData)
        // this.formData.push({index: this.formData.length+1, title: '', formItem: [{}, {}, {}]})
        // 新增时动态计算最大 index 确保每次新增时使用当前 formData 中的最大 index 加 1，而不是简单地依赖数组长度。
        const maxIndex = this.formData.length > 0
            ? Math.max(...this.formData.map(item => item.index))
            : 0;
        this.formData.push({
          index: maxIndex + 1, // 新的 index 是当前最大 index + 1
          title: '',
          formItem: [{}, {}, {}]
        });
        console.log('新增后', this.formData);
      } else {
        this.formData[data].formItem.push({})
      }
    },
    handleChange(formIndex, itemIndex) {
      // console.log('循环refs', this.$refs[`cascader${formIndex}_${itemIndex}`][0].getCheckedNodes()[0].data)
    },
  }
}
</script>
<style lang="scss">
.right1 {
  .el-cascader {
    margin-top: 2px;
    width: 260px;
    padding-right: 20px;

    .el-input__inner {
      border: 1px solid #dcdfe6;
      //font-style: italic;
      //text-align: left;
      //font-size: 20px;
      //font-weight: 600;
      color: #606266;
      font-size: 16px;
      background: transparent;
    }
  }
}
</style>
<style lang="scss" scoped>
.preserve {
  position: absolute;
  top: 11%;
  left: 38%;
}

.tableBox {
  width: 100%;
  display: flex;
  flex-wrap: wrap;

  .form-wrapper {
    width: 47%;
    justify-content: space-between;
    margin: 20px auto;

    .title {
      text-align: center;
      margin-right: 20%;
      margin-bottom: 10px;
    }
  }

  .el-input--medium {
    width: 180px;
  }

  .form {
    //text-align: center;
    margin: 0 auto;
    width: 700px;
    //width: 100%;
  }
}
</style>
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
          <el-form-item v-for="(formItem, index2) in form.formItem" :key="`${form.index}_${index2}`">
            <!--            <div class="Device">
                          <el-form
                              ref="forminline"
                              :inline="true"
                              :model="formInline"
                              class="demo-form-inline"
                          >
                            <el-form-item>
                              <span class="equipmentName">设备选择：</span>
                              <el-cascader
                                  v-model="formInline.drTypeId"
                                  :options="deviceTypeData"
                                  :props="{
                              emitPath:false,
                              expandTrigger: 'hover',
                              label: 'drtypenameCNEN',
                              value: 'drtypeid',
                              children: 'drtypeinfoList',
                            }"
                                  :show-all-levels="false"
                                  placeholder="请选择设备类型"
                              ></el-cascader>
                            </el-form-item>
                            <el-form-item>
                              <el-select
                                  v-model="formInline.drId"
                                  placeholder="请选择"
                                  @change="selectHandlechange"
                              >
                                <el-option
                                    v-for="item in options"
                                    :key="item.value"
                                    :label="item.label"
                                    :value="item.value"
                                >
                                </el-option>
                              </el-select>
                            </el-form-item>
                          </el-form>
                        </div>-->
            <el-form-item label="名称 / 点位">
              <el-input v-model="formItem.name"></el-input>
              <div v-for="(cascaderItem, index3) in formItem.cascaderFor" :key="`${form.index}_${index2}_${index3}`">
                <el-cascader
                    :ref="`cascader${index}_${index2}_${index3}`"
                    v-model="cascaderItem.regId"
                    :options="PointPositionData"
                    placeholder="请选择点位"
                    :props="{
                        emitPath: false,
                        expandTrigger: 'hover',
                        label: 'drnameCNEN',
                        value: 'drtypeid',
                        children: 'reglist',
                      }"
                    filterable
                    @change="handleChange(index, index2, index3)">
                </el-cascader>
              </div>
              <el-button class="add-button" icon="el-icon-plus" type="primary" @click="addElFormItem(index,index2)">增加
              </el-button>
              <el-button class="add-button" icon="el-icon-minus" type="danger" @click="deleteElFormItem(index,index2)">删除
              </el-button>
            </el-form-item>
            <div class="add-button">
              <el-button icon="el-icon-plus" type="primary" @click="addFormItem(2,index)">新增名称/点位
              </el-button>
              <el-button icon="el-icon-plus" type="primary" @click="deleteFormItem(index,index2)">删除名称/点位
              </el-button>
            </div>
          </el-form-item>
        </el-form>
      </div>
    </div>
  </div>
</template>
<script>
import {findAllByDrTypeId} from "@/api/deviceinformation";
import {findByDrTypeIdAndDrId} from "@/api/contentsetting/information";
import {findAllDrtypeOfDevice} from "@/api/usersetting/runlog/timealarm";
import {findDevice} from '@/api/contentsetting/varmanage';
import {mapGetters} from "vuex";

export default {
  name: "tableBox",
  props: ["drId", "drTypeId"],
  data() {
    return {
      // formData: [{
      //   index: 0,
      //   formItem: [{cascaderFor: [
      //       { regId: null },  // 第一个级联选择器
      //       { regId: null }   // 第二个级联选择器
      //     ] }, {cascaderFor: [{ regId: null }] }, {cascaderFor: [{ regId: null }] }],
      // }, {
      //   index: 1,
      //   formItem: [{cascaderFor: [{},{}] }, {cascaderFor: [{ regId: null }] }, {cascaderFor: [{ regId: null }] }],
      //
      // }, {
      //   index: 2,
      //   formItem: [{cascaderFor: [{},{}] }, {cascaderFor: [{ regId: null }] }, {cascaderFor: [{ regId: null }] }],
      // }], // 表单项数组
      formData: [{
        index: 0,
        formItem: [{
          cascaderFor: [
            { regId: null },
            { regId: null }   // 正确结构
          ]
        }, {
          cascaderFor: [{ regId: null }]
        }, {
          cascaderFor: [{ regId: null }]
        }],
      }, {
        index: 1,
        formItem: [{
          cascaderFor: [
            { regId: null },
            { regId: null }   // 正确结构
          ]
        }, {
          cascaderFor: [{ regId: null }]
        }, {
          cascaderFor: [{ regId: null }]
        }],
      }],
      value: '',
      PointPositionData: [], // 点位数据
      PointPositionDataAll: [], // 点位数据
      formInline: {
        drTypeId: 0,
        drId: 0,
        load: 0
      },
      deviceTypeData: [],
      options: [],
      firstGet: true,
    };
  },
  computed: {
    ...mapGetters(["path"])
  },
  created() {
    findAllByDrTypeId(this.path).then(res => {
      res.data.forEach(data => {
        data.reglist.forEach(data2 => {
          data2.drnameCNEN = data2.regName
          data2.drtypeid = data2.regId
        })
      })
      // console.log(res.data)
      this.PointPositionData = res.data
    })
    findAllDrtypeOfDevice(this.path).then(res => {
      this.deviceTypeData = res.data || [];

      //回显数据
      if (this.drTypeId) {
        console.log('c111111')
        this.formInline.drTypeId = this.filterDrtype(Number(this.formInline.drTypeId), this.deviceTypeData)
      }

      //如果需要取默认第一项
      if (this.firstGet && this.deviceTypeData.length) {
        console.log('c22222222')
        this.formInline.drTypeId = this.getFirstType(this.deviceTypeData)
      }
    })
  },
  watch: {
    drId: {
      handler(val) {
        // console.log('drId changed:', val);
        if (val != 0) {
          if (this.PointPositionDataAll.length === 0) {
            // console.log('进来了？')
            this.find()
          } else {
            // console.log(this.PointPositionDataAll, '1111')
            this.equipmentInformation()
          }
        }
      },
      deep: true,
      immediate: true,
    },
    'formInline.drTypeId': {
      handler(val) {
        console.log('11111', this.formInline.drTypeId)
        if (this.formInline.drId !== 72) {
          this.deviceName()
        }
      },
      deep: true,
      immediate: true,
    },
  },
  methods: {
    getFirstType(list) {
      if (list[0]['drtypeinfoList']) {
        return this.getFirstType(list[0]['drtypeinfoList'])
      } else {
        return list[0]['drtypeid']
      }
    },
    modifyLoad(val) {
      this.formInline.load = val === null || val === undefined ? 0 : val;
      console.log('load', this.formInline.load)
    },
    deviceName() {
      findDevice(this.path, this.formInline.drTypeId).then(res => {
        console.log('二级', res)
        this.options = []
        res.data.forEach(element => {
          // element.label = element.drname;
          element.label = element.drnameCNEN;
          element.value = element.drid
          this.options.push(element)
        });
        if (this.firstGet && this.options.length) {
          this.formInline.drId = this.options[0].drid;
          this.$emit('change', this.formInline.drId)
        }
      })
    },
    find() {
      findAllByDrTypeId(this.path).then(res => {
        // console.log('res', res, this.drId)
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
      // console.log(this.formData, index, this.formData[index])
      this.formData.splice(index, 1)
    },
    equipmentInformation() {
      // console.log(this.drId, this.drTypeId, 22222)
      // console.log('1111', this.drId, this.PointPositionDataAll)
      this.PointPositionData = []

      // 添加加载状态检查
      if (!this.PointPositionDataAll || this.PointPositionDataAll.length === 0) {
        console.warn('点位数据未加载完成')
        return
      }
      for (let item of this.PointPositionDataAll) {
        if (this.drId === item.drid) {
          this.PointPositionData = item.reglist
        }
      }
      findByDrTypeIdAndDrId(this.path, {drId: this.drId, drTypeId: this.drTypeId}).then(res => {
        if (res.status !== 20000) {
          // this.formData = [{
          //   index: 0,
          //   formItem: [{}, {}, {}]
          // }, {
          //   index: 1,
          //   formItem: [{}, {}, {}]
          // }, {
          //   index: 2,
          //   formItem: [{}, {}, {}]
          // }, {
          //   index: 3,
          //   formItem: [{}, {}, {}]
          // }]
          this.formData =  [{
            index: 0,
            formItem: [{
              cascaderFor: [
                { regId: null },
                { regId: null }   // 正确结构
              ]
            }, {
              cascaderFor: [{ regId: null }]
            }, {
              cascaderFor: [{ regId: null }]
            }],
          }, {
            index: 1,
            formItem: [{
              cascaderFor: [
                { regId: null },
                { regId: null }   // 正确结构
              ]
            }, {
              cascaderFor: [{ regId: null }]
            }, {
              cascaderFor: [{ regId: null }]
            }],
          }]
          // console.log('查询失败222', this.formData)
          return
        }
        if (res.data.data) {
          this.formData = res.data.data
        }
        // console.log('查询成功', this.formData, res)
        // this.$emit('modifyLoad', res.data.load)
        this.modifyLoad(res.data.load)
      }).catch(err => {
        // console.log(err)
        // this.$emit('modifyLoad', 0)
        this.modifyLoad(0)
        // this.formData = [{
        //   index: 0,
        //   formItem: [{}, {}, {}]
        // }, {
        //   index: 1,
        //   formItem: [{}, {}, {}]
        // }, {
        //   index: 2,
        //   formItem: [{}, {}, {}]
        // }, {
        //   index: 3,
        //   formItem: [{}, {}, {}]
        // }]
        this.formData =  [{
          index: 0,
          formItem: [{
            cascaderFor: [
              { regId: null },
              { regId: null }   // 正确结构
            ]
          }, {
            cascaderFor: [{ regId: null }]
          }, {
            cascaderFor: [{ regId: null }]
          }],
        }, {
          index: 1,
          formItem: [{
            cascaderFor: [
              { regId: null },
              { regId: null }   // 正确结构
            ]
          }, {
            cascaderFor: [{ regId: null }]
          }, {
            cascaderFor: [{ regId: null }]
          }],
        }]
      });
    },
    sendRequest() {
      console.log('提交', this.formData)
      // this.$emit('change', this.formData)
    },
    // addelFormItem(index, index2) {
    //   // console.log(this.formData, index, this.formData[index].formItem[index2])
    //   // this.formData[index].formItem.splice(index2, 1)
    //   this.formData[index].formItem.splice(index2 + 1, 0, { name: '', regId: null });
    // },
    addElFormItem(index, index2) {
      if (this.formData[index] && this.formData[index].formItem[index2]) {
        // 确保cascaderFor数组存在
        if (!this.formData[index].formItem[index2].cascaderFor) {
          this.$set(this.formData[index].formItem[index2], 'cascaderFor', []);
        }
        // 添加新的级联选择器
        this.formData[index].formItem[index2].cascaderFor.push({
          regId: null
        });
      }
    },
    deleteElFormItem(index, index2,index3) {
      // console.log(this.formData, index, this.formData[index].formItem[index2])
      // this.formData[index].formItem.splice(index2, 1)
      if (this.formData[index].formItem[index2].cascaderFor.length > 1) {
        this.formData[index].formItem[index2].cascaderFor.splice(index3, 1);
      } else {
        this.$message.warning('至少保留一个级联选择器');
      }
    },
    deleteFormItem(index, index2) {
      // console.log(this.formData, index, this.formData[index].formItem[index2])
      this.formData[index].formItem.splice(index2, 1)
    },
    // 点击新增按钮时触发
    addFormItem(val, data) {
      // console.log(this.formData)
      // const newItemKey = `item${this.formData.length + 1}`; // 生成新的表单项的 key
      if (val === 1) {
        // console.log('新增前', this.formData)
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
        // console.log('新增后', this.formData);
      } else {
        this.formData[data].formItem.push({})
      }
    },
    handleChange(formIndex, itemIndex) {
      // console.log('循环refs', this.$refs[`cascader${formIndex}_${itemIndex}`][0].getCheckedNodes()[0].data)
    },

    selectHandlechange(formIndex, itemIndex) {
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
      border: 1px solid rgba(122, 210, 255, 0.14);
      color: rgba(245, 251, 255, 0.92);
      font-size: 16px;
      background: rgba(255, 255, 255, 0.04);
      border-radius: 12px;
    }
  }
}
</style>
<style lang="scss" scoped>
.preserve {
  position: sticky;
  top: 0;
  z-index: 2;
  display: flex;
  justify-content: center;
  gap: 12px;
  padding: 18px 0 12px;
  margin-bottom: 8px;
  background: linear-gradient(180deg, rgba(9, 20, 34, 0.98) 0%, rgba(9, 20, 34, 0.78) 72%, rgba(9, 20, 34, 0) 100%);

  ::v-deep .el-button--primary {
    border-color: rgba(78, 184, 238, 0.36);
    background: linear-gradient(135deg, #1c8dc3 0%, #166d9b 100%);
    color: #f5fbff;
  }

  ::v-deep .addForm {
    border-color: rgba(122, 210, 255, 0.14);
    background: rgba(255, 255, 255, 0.04);
    color: rgba(235, 243, 250, 0.88);
  }
}

.tableBox {
  width: 100%;
  display: flex;
  flex-wrap: wrap;
  gap: 18px;

  .form-wrapper {
    width: calc(50% - 9px);
    justify-content: space-between;
    margin: 0;
    padding: 18px 18px 20px;
    border: 1px solid rgba(122, 210, 255, 0.12);
    border-radius: 22px;
    background: linear-gradient(180deg, rgba(12, 29, 45, 0.95) 0%, rgba(7, 18, 29, 0.98) 100%);
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.03), 0 16px 28px rgba(0, 0, 0, 0.16);

    .title {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      margin: 0 0 14px;
      color: rgba(235, 243, 250, 0.9);
    }
  }

  .el-input--medium {
    width: 180px;
  }

  .form {
    margin: 0;
    width: 100%;
  }
}

::v-deep .form-wrapper .el-form-item__label {
  color: rgba(223, 236, 245, 0.84);
}

::v-deep .form-wrapper .el-input__inner,
::v-deep .form-wrapper .el-cascader .el-input__inner {
  min-height: 42px;
  border-radius: 12px;
  border-color: rgba(122, 210, 255, 0.14);
  background: rgba(255, 255, 255, 0.04);
  color: rgba(245, 251, 255, 0.96);
}

::v-deep .form-wrapper .add-button .el-button--primary {
  border-color: rgba(78, 184, 238, 0.36);
  background: linear-gradient(135deg, #1c8dc3 0%, #166d9b 100%);
  color: #f5fbff;
}
</style>

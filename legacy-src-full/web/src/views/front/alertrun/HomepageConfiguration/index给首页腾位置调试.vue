<template>
  <div>
    <div class="action-buttons">
      <el-button icon="el-icon-plus" type="primary" @click="sendRequest()">保存</el-button>
      <el-button v-if="formData.length < 6" class="addForm" @click="addFormItem(1)">新增表格</el-button>
    </div>
    <div class="table-container">
      <el-row :gutter="20">
        <el-col
            v-for="(form, index) in formData"
            :key="form.id"
            :xs="24" :sm="12" :md="12" :lg="8"
            class="form-col">

          <el-card class="form-card" shadow="hover">
            <!-- 表头区域 -->
            <div slot="header" class="form-header">
              <span class="form-title">表格组 {{ index + 1 }}</span>
              <el-button
                  class="delete-group-btn"
                  icon="el-icon-delete"
                  type="danger"
                  size="mini"
                  @click="deleteForm(form,index)"
                  :disabled="formData.length <= 1">
                删除组
              </el-button>
            </div>

            <!-- 表头输入 -->
            <div class="header-input">
              <el-input
                  v-model="form.title"
                  placeholder="请输入表头名称"
                  maxlength="50"
                  show-word-limit>
                <template slot="prepend">表头：</template>
              </el-input>
            </div>

            <!-- 表单项循环 -->
            <el-form
                ref="dynamicForm"
                :model="form"
                class="dynamic-form"
                label-width="100px">

              <el-form-item
                  v-for="(formItem, index2) in form.formItem"
                  :key="index2"
                  :label="`项目 ${index2 + 1}`">

                <!-- 项目名称输入 -->
                <div class="form-item-content">
                  <el-input
                      v-model="formItem.name"
                      placeholder="请输入项目名称"
                      class="item-name-input"
                      clearable>
                  </el-input>

                  <!-- 级联选择器循环 -->
                  <div class="cascader-group">
                    <div
                        v-for="(cascaderItem, index3) in formItem.cascaderFor"
                        :key="`${form.index}_${index2}_${index3}`"
                        class="cascader-item">

                      <el-cascader
                          :ref="`cascader${index}_${index2}_${index3}`"
                          v-model="cascaderItem.regId"
                          :options="PointPositionData"
                          :placeholder="`cascader${index}_${index2}_${index3}`"
                          :props="{
                              emitPath: false,
                              expandTrigger: 'hover',
                              label: 'drnameCNEN',
                              value: 'regId',
                              children: 'reglist',
                            }"
                          filterable
                          @change="handleChange(index, index2, index3, $event)">
                      </el-cascader>

                      <!-- 单个级联选择器删除按钮 -->
                      <el-button
                          v-if="formItem.cascaderFor.length > 1"
                          icon="el-icon-remove"
                          type="danger"
                          size="mini"
                          circle
                          @click="deleteElFormItem(index, index2, index3)"
                          class="delete-cascader-btn">
                      </el-button>
                    </div>
                  </div>

                  <!-- 级联选择器操作按钮 -->
                  <div class="cascader-actions">
                    <el-button
                        icon="el-icon-circle-plus"
                        type="success"
                        size="mini"
                        @click="addElFormItem(index, index2)">
                      增加点位
                    </el-button>
                    <el-button
                        icon="el-icon-remove"
                        type="danger"
                        size="mini"
                        @click="deleteFormItem(index, index2)"
                        :disabled="form.formItem.length <= 1">
                      删除项目
                    </el-button>
                  </div>
                </div>
              </el-form-item>

              <!-- 添加新表单项 -->
              <div class="add-form-item-btn">
                <el-button
                    icon="el-icon-plus"
                    type="primary"
                    @click="addFormItem(index)"
                    plain>
                  新增项目
                </el-button>
              </div>
            </el-form>
          </el-card>
        </el-col>
      </el-row>
    </div>
    <!--    <div class="tableBox">
          <div v-for="(form, index) in formData" :key="index" class="form-wrapper">
            &lt;!&ndash;        <h3 class="title">index:{{ index + 1 }}</h3>&ndash;&gt;
            <div class="title">
              表头：
              <el-input v-model="form.title"></el-input>
              <el-button class="add-button" icon="el-icon-minus" type="danger" @click="deleteForm(form,index)">删除当前组
              </el-button>
            </div>
            <el-form ref="form" class="form">
              <el-form-item v-for="(formItem, index2) in form.formItem" :key="`${form.index}_${index2}`">
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
                  <el-button class="add-button" icon="el-icon-minus" type="danger" @click="deleteElFormItem(index,index2)">
                    删除
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
        </div>-->
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
      formData: [
        {
          index: 0,
          title: '',// 表头
          formItem: [
            // 项目组
            {
              cascaderFor: [
                {regId: null, drId: null}, // 绑定的数据
                {regId: null, drId: null}, // 绑定的数据
              ]
            }, {
              cascaderFor: [{regId: null, drId: null}, // 绑定的数据
              ]
            }, {
              cascaderFor: [{regId: null, drId: null}, // 绑定的数据
              ]
            }
          ],
        },
        {
          index: 1,
          formItem: [{
            cascaderFor: [ // 正确结构
            ]
          }, {
            cascaderFor: []
          }, {
            cascaderFor: []
          }],
        }
      ],
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
      console.log('有数据？', res)
      res.data.forEach(data => {
        data.reglist.forEach(data2 => {
          data2.drnameCNEN = data2.regName
          data2.drtypeid = data2.regId
        })
      })
      this.PointPositionData = res.data
      console.log('看看是什么', this.PointPositionData)
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
        // this.equipmentInformation()
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
          this.formData = [
            {
              index: 0,
              title: '',// 表头
              formItem: [
                // 项目组
                {
                  cascaderFor: [
                    {regId: null, drId: null}, // 绑定的数据
                    {regId: null, drId: null}, // 绑定的数据
                  ]
                }, {
                  cascaderFor: [{regId: null, drId: null}, // 绑定的数据
                  ]
                }, {
                  cascaderFor: [{regId: null, drId: null}, // 绑定的数据
                  ]
                }
              ],
            },
            {
              index: 1,
              formItem: [{
                cascaderFor: [ // 正确结构
                ]
              }, {
                cascaderFor: []
              }, {
                cascaderFor: []
              }],
            }
          ]
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
        this.formData = [
          {
            index: 0,
            title: '',// 表头
            formItem: [
              // 项目组
              {
                cascaderFor: [
                  {regId: null, drId: null}, // 绑定的数据
                  {regId: null, drId: null}, // 绑定的数据
                ]
              }, {
                cascaderFor: [{regId: null, drId: null}, // 绑定的数据
                ]
              }, {
                cascaderFor: [{regId: null, drId: null}, // 绑定的数据
                ]
              }
            ],
          },
          {
            index: 1,
            formItem: [{
              cascaderFor: [ // 正确结构
              ]
            }, {
              cascaderFor: []
            }, {
              cascaderFor: []
            }],
          }
        ]
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
    deleteElFormItem(index, index2, index3) {
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
    // handleChange(formIndex, itemIndex) {
    handleChange(formIndex, itemIndex, cascaderIndex, selectedValue) {
      // console.log('循环refs', this.$refs[`cascader${formIndex}_${itemIndex}`][0].getCheckedNodes()[0].data)
      // 1. 动态构建 ref 名称
      const refName = `cascader${formIndex}_${itemIndex}_${cascaderIndex}`;

      // 2. 确保 $refs 中存在该引用
      if (this.$refs[refName]) {
        // 注意：$refs 可能返回一个数组，取第一个元素
        const cascaderInstance = Array.isArray(this.$refs[refName])
            ? this.$refs[refName][0]
            : this.$refs[refName];

        // 3. 调用 getCheckedNodes 方法获取选中的节点数组
        const checkedNodes = cascaderInstance.getCheckedNodes();

        if (checkedNodes && checkedNodes.length > 0) {
          // 4. 获取第一个选中节点的完整数据对象
          const fullDataObject = checkedNodes[0].data;

          console.log('选中的 regId:', selectedValue);
          console.log('完整的节点数据:', fullDataObject);
          console.log('获取到的 drid:', fullDataObject.drId);

          // 5. 将 drid 存储到对应的数据位置
          this.formData[formIndex].formItem[itemIndex].cascaderFor[cascaderIndex].drId = fullDataObject.drId;

          // 如果需要，也可以存储其他字段
          // this.formData[formIndex].formItem[itemIndex].cascaderFor[cascaderIndex].drnameCNEN = fullDataObject.drnameCNEN;
        } else {
          console.warn('未找到选中的节点。用户可能清空了选择。');
          // 清空时重置 drid
          this.formData[formIndex].formItem[itemIndex].cascaderFor[cascaderIndex].drId = null;
        }
      } else {
        console.error(`未找到引用：${refName}`);
      }
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
//.preserve {
//  position: absolute;
//  top: 11%;
//  left: 38%;
//}
.action-buttons {
  margin-bottom: 20px;
  text-align: center;

  .el-button {
    margin: 0 10px;
  }
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
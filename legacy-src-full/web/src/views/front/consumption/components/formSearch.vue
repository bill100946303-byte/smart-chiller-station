<template>
  <div class="form consumption-search-form">
    <el-form
        ref="formsearch"
        :inline="true"
        :model="formInline"
        class="demo-form-inline legacy-front-toolbar__form"
    >
      <!--      <el-form-item label="设备选择" prop="drNameList" class="formone">-->
      <el-form-item :label="$t('public.deviceSelection')" prop="drNameList" class="formone">
        <el-button class="btnclass" @click="showtree = !showtree"
        >{{ btntext }}<i class="el-icon-arrow-down el-icon--right"></i
        ></el-button>
        <el-tree
            v-show="showtree"
            ref="tree"
            :load="loadNode"
            :props="defaultProps"
            class="treebox"
            lazy
            node-key="drid"
            show-checkbox
            @check-change="handleCheckChange"
        >
        </el-tree>
      </el-form-item>
      <!--      <el-form-item label="时间段选择" prop="time">-->
      <el-form-item :label="$t('logrizi.time')" prop="time">
        <el-date-picker
            ref="datepack"
            v-model="formInline.time"
            format="yyyy-MM-dd"
            placeholder="选择开始时间"
            type="daterange"
            value-format="yyyy-MM-dd"
            @blur="showtree = false"
            @focus="showtree = false"
            prefix-icon="al_element-icons al_icona-huaban1"
        />
      </el-form-item>
      <!--      <el-form-item label="时间间隔" prop="timeSpace">-->
      <el-form-item :label="$t('public.timeInterval')" prop="timeSpace">
        <el-select
            v-model="formInline.dateType"
            :placeholder="$t('public.selectTime')"
            filterable
            @change="changedatepicker"
        >
          <el-option
              v-for="(item, index) in timese"
              :key="index"
              :label="item.name"
              :value="item.value"
          ></el-option>
        </el-select>
      </el-form-item>
      <el-form-item>
        <el-button class="energy-btn" type="primary" @click="search">
          <i class="al_element-icons al_iconchaxun energy-btn__icon"></i>
          {{ $t('public.search') }}
        </el-button>
        <el-button class="energy-btn" type="primary" @click="exporttable">
          <i class="al_element-icons al_icondaochu energy-btn__icon energy-btn__icon--export"></i>
          {{ $t('public.exportData') }}
        </el-button>
      </el-form-item>
    </el-form>
  </div>
</template>
<script>
import {mapGetters} from "vuex";
import {findDrstructur, finddrlist} from '@/api/front/energytest'
import {handlePost} from "@/utils/handlepost";

export default {
  props: ["searchinfo"],
  computed: {
    ...mapGetters(["path"]),
  },
  watch: {
    searchinfo: {
      handler(val) {
        if (val) {
          this.formInline.time = [val.startTime, val.endTime];
        }
      },
      deep: true,
      immediate: true,
    },
  },
  data() {
    return {
      showtree: false,
      btntext: this.$t('public.deviceSelection'),
      treedata: [],
      defaultProps: {
        children: "drtypeinfoList",
        // label: "drtypename",
        label: "drtypenameCNEN",
        isLeaf: 'leaf'
      },
      formInline: {
        drNameList: [],
        time: [],
        dateType: 1,
      },
      time: "",
      timese: [
        {
          value: 1,
          name: this.$t('public.hour'),
        },
        {
          value: 2,
          name: this.$t('public.day'),
        },
        {
          value: 3,
          name: this.$t('public.month'),
        },
        {
          value: 4,
          name: this.$t('public.year'),
        }
      ],
      drinfo: {},
      initDataValue: '1'
    };
  },

  created() {
    this.$nextTick(() => {
      this.initData(this.initDataValue)
    });

  },
  methods: {
    checkAllFirstLevelNodes() {
      const firstLevelKeys = this.treedata
          .filter(item => item.parentid === 0) // 选择第一级节点
          .map(item => item.drtypeid); // 提取 drid（或使用你的标识符）
      console.log('firstLevelKeys', firstLevelKeys)
      // 调用 setCheckedKeys 方法
      // this.$refs.tree.setCheckedKeys(firstLevelKeys);
    },
    initData(value) {
      console.log('initData')
      return findDrstructur(this.path).then(res => {
        if (res.data.length > 0) {
          this.treedata = res.data.filter(item => item.isenergy == 1)
          const firstItem = this.treedata[0]; // 获取第一项
          this.btntext = firstItem.drtypenameCNEN
          firstItem.drid = firstItem.drtypeid
          if (value === '1')
            this.$nextTick(() => {
              // const firstItem = this.treedata[0]; // 获取第一项
              // this.btntext = firstItem.drtypenameCNEN
              // firstItem.drid = firstItem.drtypeid
              this.checkAllFirstLevelNodes();
              console.log('2222', firstItem);
              this.$refs.tree.setCheckedKeys([firstItem.drid], false)
              // this.$refs.tree.setChecked([firstItem.drid],true,true)
              // this.$refs.tree.setCheckedKeys([firstItem.drid]);
              // this.$nextTick(() => {
              //   setTimeout(() => {
              //     let checkedNodes = this.$refs.tree.getCheckedNodes();
              //     console.log(111, checkedNodes);
              //   }, 1000); // 根据实际情况调整时间
              // });
              this.search(value)
              this.initDataValue = '2'
            });
          //
          console.log('this.treedata', this.treedata)
        }
      })
    },
    loadNode(node, resolve) {
      console.log('loadNode')
      if (node.level === 2) {
        this.findDr(node.data.drtypeid).then(res => {
          console.log('res', res)
          this.drinfo[node.data.drtypeid] = res;
          return resolve(res);
        })
      } else if (node.level === 0) {
        this.initData().then(() => {
          return resolve(this.treedata)
        })
      } else if (node.level === 1) {
        let data = this.treedata.find(item => item.drtypeid === node.data.drtypeid)
        return resolve(data.drtypeinfoList || [])
      } else {
        return resolve([])
      }
    },
    changedatepicker() {
      // this.$set(this.$refs.datepack ,"type","date");
      //  console.log(this.$refs.datepack) ;

    },
    handleCheckChange(data, checked, indeterminate) {
      console.log(111, this.$refs.tree.getCheckedNodes())
      let node = this.$refs.tree.getCheckedNodes();
      console.log(node)
      this.btntext = node.reduce((pre, next) => {
        // return pre+next.drtypename+"/"
        return pre + next.drtypenameCNEN + "/"
      }, '')
      this.btntext = this.btntext.slice(0, this.btntext.length - 1)
      console.log(this.btntext)
    },
    findDr(drtypeid) {
      return finddrlist(this.path, {drtypeid}).then(res => {
        console.log(res)
        return res.data.map(item => {
          // item.drtypename = item.drname
          item.drtypenameCNEN = item.drnameCNEN
          item.isLeaf = true
          return item
        })
      })
    },
    async search(value) {

      this.showtree = false
      let keys
      if (value === '1') {
        keys = [this.treedata[0]]; // 获取第一项
        // keys = this.$refs.tree.getCheckedNodes();
      } else {
        keys = this.$refs.tree.getCheckedNodes();
      }
      console.log('keys', keys)
      if (!keys.length) {
        // this.$message.error('请选择设备');
        this.$message.error(this.$t('prompt.pleaseSelect') + this.$t('prompt.device'));
        return
      }
      if (!this.formInline.time.length) {
        // this.$message.error('请选择时间');
        this.$message.error(this.$t('prompt.pleaseSelect') + this.$t('logrizi.time'));
        return
      }
      let result = []
      for (let j = 0; j < keys.length; j++) {
        let item = keys[j]
        if (item.isLeaf === true) {
          result.push(item.drid)
        } else if (item.parentid === 0) {
          //第一层
          for (let i = 0; i < item.drtypeinfoList.length; i++) {
            const element = item.drtypeinfoList[i];
            let r = await this.findDr(element.drtypeid)
            r.forEach(element => {
              result.push(element.drid)
            });
          }
        } else {
          let r = await this.findDr(item.drtypeid)
          r.forEach(element => {
            result.push(element.drid)
          });
        }
      }
      let obj = {};

      obj.startTime = this.formInline.time[0];
      obj.endTime = this.formInline.time[1];
      obj.drIds = [...new Set(result)]
      obj.dateType = this.formInline.dateType
      console.log("this.formInline", obj);
      this.$emit("handleSearch", obj);
    },
    exporttable() {
      this.$emit("exporttable");
    }
  },
};
</script>
<style lang="scss" scoped>
.form {
  .btnclass {
    width: 220px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;

    &:hover {
      //color: #fff;
      //border-color: #6f6f6f;
      //background-color: #011123;
    }
  }

  .formone {
    position: relative;
    z-index: 3;

    .treebox {
      position: absolute;
      overflow: scroll;
      //width:220px;
      min-width: 220px;
      height: 230px;
      top: 40px;
      //border: 1px solid #6F6F6F;
      border: 1px solid #d3d1d1;
    }
  }

}

.consumption-search-form {
  ::v-deep .legacy-front-toolbar__form {
    display: flex;
    flex-wrap: wrap;
    gap: 12px 18px;
    align-items: flex-end;
  }

  ::v-deep .el-form-item {
    margin-bottom: 0;
  }

  ::v-deep .el-form-item__label {
    color: rgba(223, 236, 245, 0.82);
  }

  ::v-deep .el-input__inner,
  ::v-deep .el-range-editor.el-input__inner,
  ::v-deep .el-select .el-input__inner {
    min-height: 42px;
    border-radius: 12px;
    border-color: rgba(122, 210, 255, 0.14);
    background: rgba(255, 255, 255, 0.04);
    color: rgba(245, 251, 255, 0.96);
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.03);
  }

  ::v-deep .el-range-separator,
  ::v-deep .el-input__icon,
  ::v-deep .el-select__caret {
    color: rgba(191, 220, 236, 0.72);
  }

  ::v-deep .treebox {
    border: 1px solid rgba(122, 210, 255, 0.14);
    border-radius: 14px;
    background: linear-gradient(180deg, rgba(7, 18, 32, 0.96) 0%, rgba(11, 24, 40, 0.96) 100%);
    box-shadow: 0 24px 48px rgba(0, 0, 0, 0.28);
  }
}

.energy-btn {
  border-color: rgba(78, 184, 238, 0.36);
  background: linear-gradient(135deg, #1c8dc3 0%, #166d9b 100%);
  color: #f5fbff;
}

.energy-btn:hover,
.energy-btn:focus {
  border-color: rgba(107, 202, 245, 0.48);
  background: linear-gradient(135deg, #2298ce 0%, #1a7aa8 100%);
  color: #fff;
}

.energy-btn__icon {
  margin-right: 6px;
}

.energy-btn__icon--export {
  font-size: 17px;
}

</style>
<style lang="scss">
.consumption-search-form {
  .el-input__icon {
    font-size: 25px;
  }

  .el-input--prefix .el-input__inner {
    padding-left: 40px;
    font-weight: 600;
    font-size: 16px;
  }
}
</style>

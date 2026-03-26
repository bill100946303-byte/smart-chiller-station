<template>
  <div class="app-container">
    <el-row :gutter="10">
      <el-col :md="24" :lg="7" :xl="5">
        <div class="grid-content bg-purple">
          <p class="left-title">变量寄存器信息</p>
          <el-form
              class="form"
              ref="form"
              label-position="left"
              label-width="130px"
          >
            <el-form-item label="变量寄存器名称">
              <el-input
                  v-model="tagName"
                  clearable
                  placeholder="请输入寄存器名称"
              />
            </el-form-item>
            <el-form-item label="寄存器地址">
              <el-input v-model="tagAddr" placeholder="请输入寄存器地址"/>
            </el-form-item>
            <el-form-item label="寄存器值">
              <el-input
                  v-model="tagValue"
                  disabled
                  placeholder="请输入寄存器值"
              />
            </el-form-item>
            <el-form-item label="寄存器值类型">
              <el-select
                  v-model="valueType"
                  clearable
                  placeholder="请选择寄存器值类型"
                  style="width: 200px;"
              >
                <el-option
                    v-for="item in valueTypeOptions"
                    :key="item.value"
                    :label="item.value"
                    :value="item.id"
                ></el-option>
              </el-select>
            </el-form-item>
            <el-form-item label="寄存器类型">
              <el-select
                  v-model="tagType"
                  clearable
                  placeholder="请选择寄存器类型"
                  style="width: 200px;"
              >
                <el-option
                    v-for="item in tagTypeOptions"
                    :key="item.value"
                    :label="item.value"
                    :value="item.id"
                ></el-option>
              </el-select>
            </el-form-item>
            <el-form-item label="设备名称">
              <el-select
                  v-model="deviceAddr"
                  clearable
                  placeholder="请选择设备名称"
                  @change="changeDevice"
                  style="width: 200px;"
              >
                <el-option
                    v-for="item in deviceAddrOptions"
                    :key="item.value"
                    :label="item.value"
                    :value="item.id"
                ></el-option>
              </el-select>
            </el-form-item>
            <el-form-item label="设备地址">
              <el-input v-model="deviceAddress" placeholder="请输入设备地址"/>
            </el-form-item>
            <el-form-item label="转存历史间隔时间">
              <el-select
                  v-model="saveTime"
                  clearable
                  placeholder="请选择时间间隔"
                  style="width: 200px;"
              >
                <el-option
                    v-for="item in saveTimeOptions"
                    :key="item.value"
                    :label="item.value"
                    :value="item.id"
                ></el-option>
              </el-select>
            </el-form-item>
            <el-form-item label="读写属性">
              <el-select
                  v-model="readWrite"
                  clearable
                  placeholder="请选择读写属性"
                  style="width: 200px;"
              >
                <el-option
                    v-for="item in readWriteOptions"
                    :key="item.value"
                    :label="item.value"
                    :value="item.id"
                ></el-option>
              </el-select>
            </el-form-item>
            <el-form-item label="系数">
              <el-input v-model="ratio" placeholder="请输入系数"/>
            </el-form-item>

            <el-form-item label="权限">
              <el-select
                  v-model="control"
                  clearable
                  placeholder="请选择权限"
                  style="width: 200px;"
              >
                <el-option
                    v-for="item in limitsOfAuthority"
                    :key="item.control"
                    :label="item.name"
                    :value="item.control"
                ></el-option>
              </el-select>
            </el-form-item>

            <el-form-item label="公式" v-if="tagformula">
              <el-input v-model="tagformula" type="textarea" autosize disabled/>
            </el-form-item>
          </el-form>
          <div class="left-btn">
            <el-button type="primary" @click="handelAdd">增加</el-button>
            <el-button type="primary" @click="handelUpdate">确认修改</el-button>
          </div>
        </div>
      </el-col>
      <el-col :md="24" :lg="17" :xl="19">
        <div class="grid-content bg-purple">
          <div class="buiding-info-title">
            <p>变量寄存器列表</p>
            <el-input v-model="exportTagName" clearable placeholder="输入变量寄存器含义"/>
            <el-button type="primary" @click="searchQsTag">查询</el-button>
            <!--<el-button type="primary" @click="exportQsTag">寄存器导出</el-button>
            <ExcelUpload class="upload" :btnName="btnName" @excelUpload="uploadFile"/>-->
            <ExcelUpload class="upload" :btnName="btnName2" @excelUpload="uploadFile2"/>
            <el-button type="danger" @click="handelDeletes">批量删除</el-button>
          </div>
          <el-table
              :data="tableDatas"
              border
              style="width: 100%"
              max-height="600"
              @selection-change="selectQsTags"
          >
            <el-table-column type="selection" width="55"></el-table-column>
            <af-table-column prop="tagid" label="寄存器ID" width="80"></af-table-column>
            <af-table-column prop="tagname" label="变量寄存器名称"></af-table-column>
            <af-table-column prop="tagnameCN" label="变量寄存器含义"></af-table-column>
            <af-table-column prop="itemid" label="寄存器地址"></af-table-column>
            <af-table-column prop="tagvalue" label="寄存器值"></af-table-column>
            <af-table-column prop="tagdesc" label="单位/描述"></af-table-column>
            <af-table-column prop="valuetype" label="值类型"></af-table-column>
            <af-table-column prop="itemname" label="寄存器类型"></af-table-column>
            <af-table-column prop="drname" label="设备名称"></af-table-column>
            <af-table-column prop="itemdradd" label="设备地址"></af-table-column>
            <af-table-column prop="savetime" label="转存历史间隔时间" width="135"></af-table-column>
            <af-table-column prop="itemreadtype" label="读写"></af-table-column>
            <af-table-column label="权限" prop="control">
              <template slot-scope="scope">
                <span v-if="scope.row.control === 0">不可控</span>
                <span v-if="scope.row.control === 1">可控</span>
                <span v-if="scope.row.control === 2">部分可控</span>
              </template>
            </af-table-column>
            <af-table-column v-if="false" prop="tagformula"></af-table-column>
            <el-table-column fixed="right" label="操作" width="220">
              <template slot-scope="scope">
                <el-button
                    type="success"
                    size="mini"
                    @click="formulaClick(scope.$index, scope.row)"
                >公式
                </el-button
                >
                <el-button
                    type="success"
                    size="mini"
                    @click="handelEdit(scope.$index, scope.row)"
                >编辑
                </el-button
                >
                <el-button
                    type="danger"
                    size="mini"
                    @click="handelDelete(scope.$index, scope.row)"
                >删除
                </el-button
                >
              </template>
            </el-table-column>
          </el-table>
          <el-dialog
              width="60%"
              :title="formulaTitle"
              :visible.sync="formulaVisible"
              append-to-body
              top="10px"
          >
            <div class="math-dispose">
              <div class="math-chooses">
                <el-input
                    v-model="mathConstant"
                    placeholder="请输入寄存器ID"
                    clearable
                />
                <el-button type="primary" @click="addMath(2)">添加</el-button>
                <el-button type="primary" @click="formula = ''">清除公式</el-button>
                <div>
                  <el-button type="primary" @click="addMath(3)">+</el-button>
                  <el-button type="primary" @click="addMath(4)">-</el-button>
                  <el-button type="primary" @click="addMath(5)">×</el-button>
                  <el-button type="primary" @click="addMath(6)">÷</el-button>
                  <el-button type="primary" @click="addMath(7)">(</el-button>
                  <el-button type="primary" @click="addMath(8)">)</el-button>
                  <el-button type="primary" @click="addMath(9)">&&</el-button>
                  <el-button type="primary" @click="addMath(10)">||</el-button>
                  <el-button type="primary" @click="addMath(11)">＜</el-button>
                  <el-button type="primary" @click="addMath(12)">＞</el-button>
                  <el-button type="primary" @click="addMath(13)">＝</el-button>
                </div>
              </div>
              <el-input
                  type="textarea"
                  :rows="3"
                  v-model="formula"
              ></el-input>
            </div>
            <div class="finishMathOk">
              <el-button @click="formulaVisible = false">取 消</el-button>
              <el-button type="primary" @click="finishMath">确 定</el-button>
            </div>
            <div class="dialogTable">
              <el-input v-model="formulaExportTagName" clearable placeholder="请输入变量寄存器含义" @input="formulaSearch"/>
              <el-table
                  :data="formulaTableDatas"
                  border
                  style="width: 100%"
                  max-height="600"
                  @selection-change="selectQsTags"
              >
                <af-table-column prop="tagid" label="寄存器ID" width="80"></af-table-column>
                <af-table-column prop="tagname" label="变量寄存器名称"></af-table-column>
                <af-table-column prop="tagnameCN" label="变量寄存器含义"></af-table-column>
                <af-table-column prop="itemid" label="寄存器地址"></af-table-column>
                <af-table-column prop="tagvalue" label="寄存器值"></af-table-column>
                <af-table-column prop="tagdesc" label="单位/描述"></af-table-column>
                <af-table-column prop="valuetype" label="值类型"></af-table-column>
                <af-table-column prop="itemname" label="寄存器类型"></af-table-column>
                <af-table-column prop="drname" label="设备名称"></af-table-column>
                <af-table-column prop="itemdradd" label="设备地址"></af-table-column>
                <af-table-column prop="savetime" label="转存历史间隔时间" width="135"></af-table-column>
                <af-table-column prop="itemreadtype" label="读写"></af-table-column>
              </el-table>
              <el-pagination
                  layout="prev, pager, next"
                  :total="dialogPaging.total"
                  :current-page="dialogPaging.currentPage"
                  @current-change="formulaCurrentChange">
              </el-pagination>
            </div>
          </el-dialog>
<!--          <div class="el-pagination">
            <div class="btn">
              <button @click="prev">上一页</button>
              <span>{{ currentPage }}</span>
              <button @click="next">下一页</button>
            </div>
            <div>
              <el-pagination
                  :current-page="currentPage"
                  :page-sizes="[5, 10, 20, 40]"
                  :page-size="pagesize"
                  layout="total, sizes, jumper"
                  :total="rowCount"
                  @size-change="handleSizeChange"
                  @current-change="handleCurrentChange"
              />
            </div>
          </div>-->
          <div class="el-pagination">
            <el-pagination
                :current-page="currentPage"
                :page-size="pagesize"
                :page-sizes="[10, 20, 30, 50]"
                :total="rowCount"
                layout="total, sizes, prev, pager, next, jumper"
                @size-change="handleSizeChange"
                @current-change="handleCurrentChange"
            >
            </el-pagination>
          </div>
        </div>
      </el-col>
    </el-row>
  </div>
</template>

<script>
import {mapGetters} from "vuex";
import {
  addQsTag,
  deleteQsTag,
  findAllDrAddr,
  findAllDrllType,
  findQsTag,
  inputExcel,
  inputExcelModbusTcp,
  outputExcel,
  updateFormula,
  updateQsTag
} from "@/api/basesetting/qstag";
import ExcelUpload from "@/components/MyImgUpload/ExcelUpload";
import {exportExcel} from "@/utils/excel";
import {formatDate} from "@/utils/index";
import {idToVal, nullToStr, valToId} from "@/utils/selectexchange";

export default {
  inject: ["reload"],
  components: {
    ExcelUpload,
  },
  computed: {
    ...mapGetters(["path", "id"]),
  },
  data() {
    return {
      btnName: "寄存器导入",
      btnName2: '导入ModbusTcp类型变量',
      exportTagName: "", // 导出寄存器名
      tagName: "", // 寄存器名
      valueType: 1, // 值类型
      valueTypeOptions: [
        {
          id: 1,
          value: "离散型",
        },
        {
          id: 2,
          value: "长整型",
        },
        {
          id: 3,
          value: "模拟型",
        },
        {
          id: 4,
          value: "字符型",
        },
        {
          id: 5,
          value: "浮点型",
        },
      ],
      tagValue: 0, // 寄存器值
      saveTime: "每5分钟存储", // 存储周期
      saveTimeOptions: [
        {
          id: 5,
          value: "每5分钟存储",
        },
        {
          id: 10,
          value: "每10分钟存储",
        },
        {
          id: 30,
          value: "每30分钟存储",
        },
        {
          id: 60,
          value: "每60分钟存储",
        },
      ], // 存储周期选项
      deviceAddr: "", // 设备地址
      deviceAddrOptions: [], // 设备地址选择
      tagAddr: "", // 寄存器地址
      deviceAddress: "", // 设备地址
      readWrite: 1, // 读写属性
      readWriteOptions: [
        {
          id: 1,
          value: "只读",
        },
        {
          id: 2,
          value: "读写",
        },
        {
          id: 3,
          value: "只写",
        },
      ],
      ratio: "", // 系数

      tagType: "", // 寄存器类型
      tagTypeOptions: [], // 寄存器类型选择
      qsTags: [], // 选择的寄存器数组
      currentPage: 1, // 初始页
      pagesize: 10,
      rowCount: 0,
      tableDatas: [],
      editData: {},
      formulaVisible: false,// 以下是公式dialog的配置项
      formulaData: {}, // 当前数据
      mathConstant: '',
      formula: "", // 公式数据
      dialogPaging: {
        total: 0,
        currentPage: 1
      },
      formulaTableDatas: [],
      formulaExportTagName: '',
      timer: true,
      formulaTitle: '',
      tagformula: '',
      control: '',
      limitsOfAuthority: [
        {
          control: 0,
          name: "不控制",
        },
        {
          control: 1,
          name: "可控",
        },
        {
          control: 2,
          name: "部分可控",
        },
      ],
    };
  },
  mounted() {
    findAllDrAddr(this.path)
        .then((res) => {
          res.data.forEach((ele) => {
            let obj = {
              id: ele.drid,
              value: ele.drname,
            };
            this.deviceAddrOptions.push(obj);
          });
        })
        .catch(console.log);
    this.findQsTag(
        this.currentPage,
        this.pagesize,
        this.exportTagName
    );
  },
  methods: {
    // 编辑公式
    formulaClick(index, value) {
      this.formulaTitle = "编辑公式：" + value.tagname + `（${value.tagnameCN}）`
      this.formulaData = {}
      this.formulaFindQsTag()
      this.formulaVisible = !this.formulaVisible
      console.log(value)
      this.formulaData = value
      if (value.tagformula) {
        this.formula = value.tagformula
      } else {
        this.formula = ""
      }

    },
    addMath(state) {
      switch (state) {
        case 1:
          // 变量
          break;
        case 2:
          // 常量
          this.formula += "@" + this.mathConstant + "@";
          break;
        case 3:
          // +
          this.formula += "+";
          break;
        case 4:
          // -
          this.formula += "-";
          break;
        case 5:
          // ×
          this.formula += "*";
          break;
        case 6:
          // ÷
          this.formula += "/";
          break;
        case 7:
          // 左括号
          this.formula += "(";
          break;
        case 8:
          // 右括号
          this.formula += ")";
          break;
        case 9:
          // 逻辑与
          this.formula += "&&";
          break;
        case 10:
          // 逻辑或
          this.formula += "||";
          break;
        case 11:
          // 小于号
          this.formula += "<";
          break;
        case 12:
          // 大于号
          this.formula += ">";
          break;
        case 10:
          // 等于号
          this.formula += "=";
          break;
        default:
          this.$message.error("没有该变量或符号");
          break;
      }
    },
    // 编辑公式完成
    finishMath() {
      let formData = new FormData()
      formData.append('tagformula', this.formula)// 公式数据
      formData.append('tagid', this.formulaData.tagid)// 公式数据
      updateFormula(this.path, formData).then(res => {
        this.formulaVisible = false;
      })
    },
    // 分页
    formulaCurrentChange(e) {
      this.currentPage = e
      this.formulaFindQsTag()
    },
    formulaSearch(val) {
      if (val == '') {
        this.formulaFindQsTag()
      }
      if (this.timer) {
        setTimeout(() => {
          this.timer = true;
          this.dialogPaging.total = 0;
          this.dialogPaging.currentPage = 1;
          this.formulaFindQsTag(val)
        }, 300)
      }
      this.timer = false
    },
    // dialog 的表格数据
    formulaFindQsTag(e) {
      findQsTag(this.path, this.currentPage, '10', e).then((res) => {
        // currentPage 当前页面, pageSize大小
        console.log(res)
        this.dialogPaging.total = res.data.rowCount;
        this.formulaTableDatas = res.data.records;
        this.formulaTableDatas.forEach((ele) => {
          ele.valuetype = idToVal(ele.valuetype, this.valueTypeOptions);
          ele.savetime = idToVal(ele.savetime, this.saveTimeOptions);
          ele.itemreadtype = idToVal(ele.itemreadtype, this.readWriteOptions);
        });
      })
    },
    searchQsTag() {
      this.currentPage = 1;
      this.pagesize = 10;
      this.findQsTag(
          this.currentPage,
          this.pagesize,
          this.exportTagName
      );
    },
    // 查询变量寄存器
    findQsTag(currentPage, pageSize, tagname) {
      findQsTag(this.path, currentPage, pageSize, tagname)
          .then((res) => {
            this.rowCount = res.data.rowCount;
            this.tableDatas = res.data.records;
            this.tableDatas.forEach((ele) => {
              ele.valuetype = idToVal(ele.valuetype, this.valueTypeOptions);
              ele.savetime = idToVal(ele.savetime, this.saveTimeOptions);
              ele.itemreadtype = idToVal(ele.itemreadtype, this.readWriteOptions);
            });
          })
          .catch(console.log);
    },
    // 改变显示页数
    handleSizeChange(size) {
      this.pagesize = size;
      this.currentPage = 1;
      this.findQsTag(
          this.currentPage,
          this.pagesize,
          this.exportTagName
      );
    },
    // 跳页
    handleCurrentChange(currentpage) {
      this.currentPage = currentpage;
      if (this.tableDatas.length < this.rowCount) {
        this.findQsTag(
            this.currentPage,
            this.pagesize,
            this.exportTagName
        );
      }
    },
    // 上一页
    prev() {
      if (this.currentPage === 1) {
        this.currentPage = 1;
      } else {
        this.currentPage--;
        if (this.tableDatas.length < this.rowCount) {
          this.findQsTag(
              this.currentPage,
              this.pagesize,
              this.exportTagName
          );
        }
      }
    },
    // 下一页
    next() {
      const maxPage = Math.ceil(this.rowCount / this.pagesize);
      if (this.currentPage < maxPage) {
        this.currentPage++;
        if (this.tableDatas.length < this.rowCount) {
          this.findQsTag(
              this.currentPage,
              this.pagesize,
              this.exportTagName
          );
        }
      }
    },
    // 根据设备id查询寄存器类型
    findAllDrllType(drid) {
      findAllDrllType(this.path, drid)
          .then((res) => {
            res.data.forEach((ele) => {
              let obj = {
                id: ele.itemtype,
                value: ele.itemname,
              };
              this.tagTypeOptions.push(obj);
            });
          })
          .catch(console.log);
    },
    // 改变设备查询寄存器类型
    changeDevice(drid) {
      this.tagTypeOptions = [];
      this.tagType = "";
      if (drid != "") {
        this.findAllDrllType(drid);
      }
    },
    // 增加
    handelAdd() {
      var formData = new FormData();
      formData.append("tagname", this.tagName.replace(/\s/g, ""));
      formData.append("tagvalue", this.tagValue);
      formData.append("savetime", valToId(this.saveTime, this.saveTimeOptions));
      formData.append(
          "itemdrid",
          valToId(this.deviceAddr, this.deviceAddrOptions)
      );
      formData.append("itemid", nullToStr(this.tagAddr));
      formData.append("itemtype", valToId(this.tagType, this.tagTypeOptions));
      formData.append("itemdradd", this.deviceAddress);
      formData.append("itemreadtype", this.readWrite);
      formData.append("valuetype", this.valueType);
      formData.append("itemxs", this.ratio);
      formData.append("control", this.control);
      addQsTag(this.path, formData)
          .then((res) => {
            if (res.status === 20000) {
              this.$message.success("新增成功!");
              this.findQsTag(this.currentPage, this.pagesize, this.exportTagName);
            }
          })
          .catch(console.log);
    },
    // 编辑
    handelEdit(index, row) {
      console.log('编辑', row)
      this.editData = row;
      this.tagformula = row.tagformula
      this.tagName = row.tagname;
      this.tagValue = row.tagvalue;
      this.saveTime = row.savetime;
      this.deviceAddr = row.drname;
      this.tagAddr = row.itemid;
      this.tagType = row.itemname;
      this.deviceAddress = row.itemdradd;
      this.readWrite = row.itemreadtype;
      this.valueType = row.valuetype;
      this.ratio = row.itemxs;
      this.control = row.control;
      this.findAllDrllType(row.itemdrid);
    },
    // 确认修改
    handelUpdate() {
      var formData = new FormData();
      formData.append("tagid", this.editData.tagid);
      formData.append("tagname", this.tagName.replace(/\s/g, ""));
      formData.append("tagvalue", nullToStr(this.tagValue));
      formData.append("savetime", valToId(this.saveTime, this.saveTimeOptions));
      formData.append(
          "itemdrid",
          valToId(this.deviceAddr, this.deviceAddrOptions)
      );
      formData.append("itemid", nullToStr(this.tagAddr));
      formData.append("itemtype", valToId(this.tagType, this.tagTypeOptions));
      formData.append("itemdradd", this.deviceAddress);
      formData.append("itemreadtype", valToId(this.readWrite, this.readWriteOptions));
      formData.append("valuetype", valToId(this.valueType, this.valueTypeOptions));
      formData.append("itemxs", this.ratio);
      formData.append("control", this.control);
      updateQsTag(this.path, formData)
          .then((res) => {
            if (res.status === 20000) {
              this.$message.success("修改成功!");
              this.findQsTag(this.currentPage, this.pagesize, this.exportTagName);
            }
          })
          .catch(console.log);
    },

    // 删除
    handelDelete(index, row) {
      let tip = confirm("确定要删除吗？");
      if (tip) {
        deleteQsTag(this.path, row.tagid)
            .then((res) => {
              if (res.status === 20000) {
                this.$message.success("删除成功!");
                this.findQsTag(
                    this.currentPage,
                    this.pagesize,
                    this.exportTagName
                );
              }
            })
            .catch(console.log);
      }
    },
    // 选择楼栋
    selectQsTags(val) {
      this.qsTags = val;
    },
    // 批量删除
    handelDeletes() {
      let tip = confirm("确定要批量删除吗？");
      if (tip) {
        let ids = [];
        this.qsTags.forEach((ele) => {
          ids.push(ele.tagid);
        });
        deleteQsTag(this.path, ids.join(","))
            .then((res) => {
              if (res.status === 20000) {
                this.$message.success("批量删除成功!");
                this.findQsTag(
                    this.currentPage,
                    this.pagesize,
                    this.exportTagName
                );
              }
            })
            .catch(console.log);
      }
    },
    // 导入
    uploadFile(file) {
      var formData = new FormData();
      formData.append("file", file);
      const loading = this.$loading({
        lock: true,
        text: "数据正在导入数据库，请稍等",
        spinner: "el-icon-loading",
        background: "rgba(0, 0, 0, 0.7)",
      });
      inputExcel(this.path, formData)
          .then((res) => {
            if (res.status === 20000) {
              loading.close();
              this.$message.success("成功导入数据库!");
              this.findQsTag(
                  this.currentPage,
                  this.pagesize,
                  this.exportTagName
              );
            } else {
              loading.close();
            }
          })
          .catch(() => loading.close());
    },
    uploadFile2(file) {
      var formData = new FormData();
      formData.append("file", file);
      const loading = this.$loading({
        lock: true,
        text: "数据正在导入数据库，请稍等",
        spinner: "el-icon-loading",
        background: "rgba(0, 0, 0, 0.7)",
      });
      // console.log('uploadFile2', file)
      inputExcelModbusTcp(this.path, formData)
          .then((res) => {
            if (res.status === 20000) {
              loading.close();
              this.$message.success("成功导入数据库!");
              this.findQsTag(
                  this.currentPage,
                  this.pagesize,
                  this.exportTagName
              );
            } else {
              console.log('1111')
              loading.close();
            }
          })
          .catch(() => loading.close());
    },
    // 导出
    exportQsTag() {
      outputExcel(this.path, this.exportTagName)
          .then((res) => {
            let date = formatDate(new Date());
            const filename = "变量寄存器信息" + date + ".xls";
            exportExcel(res, filename);
          })
          .catch(console.log);
    },
  },
};
</script>

<style lang="scss" scoped>
::v-deep .el-table__body-wrapper::-webkit-scrollbar {
  width: 8px; // 横向滚动条
  height: 8px; // 纵向滚动条 必写
}

::v-deep .el-table__body-wrapper::-webkit-scrollbar-thumb {
  background-color: #dde;
  border-radius: 3px;
}

.el-table ::-webkit-scrollbar {
  display: inline !important;
}

.app-container {
  .el-col {
    border-radius: 4px;
  }

  .bg-purple {
    position: relative;
    padding: 20px;
    background: var(--theme-color);

    .left-title {
      margin-bottom: 20px;
      font-size: 18px;
      font-weight: bold;
    }

    .left-btn {
      position: absolute;
      top: 10px;
      right: 10px;
    }

    .buiding-info-title {
      display: flex;
      align-items: center;
      margin-bottom: 20px;

      .el-input {
        margin-right: 20px;
        width: 200px;
      }

      p {
        margin-right: 20px;
        font-size: 18px;
        font-weight: bold;
      }

      .upload {
        margin: 0 10px;
      }
    }

    .el-pagination {
      display: flex;
      justify-content: center;
      margin-top: 10px;
      text-align: center;
      align-items: center;

      .btn {
        margin-top: 10px;
        padding: 2px 5px;
      }
    }
  }

  .form {
    .el-input {
      width: 200px;
    }

    .el-textarea {
      width: 200px;
    }
  }

  .grid-content {
    border-radius: 4px;
    min-height: 36px;
  }
}

.math-dispose {
  .math-chooses {
    //display: flex;
    //flex-wrap: wrap;

    div {
      margin-bottom: 20px;
    }

    .el-input {
      width: 200px;
    }
  }
}

.finishMathOk {
  margin: 30px 0;
  display: flex;
  justify-content: flex-end;
}

.dialogTable {
  .el-input {
    margin-bottom: 20px;
    width: 200px;
  }
}
</style>

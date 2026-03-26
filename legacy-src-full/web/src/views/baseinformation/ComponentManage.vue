<template>
  <div class="app-container">
    <el-row :gutter="10">
      <el-col :md="24" :lg="24" :xl="24">
        <el-tabs type="border-card" v-model="activeName">
          <el-tab-pane class="component-manage" label="阈值管理">
            <el-row :gutter="10">
              <el-col :md="24" :lg="9" :xl="7">
                <div class="grid-content bg-purple">
                  <p class="elements-info-title">自定义阈值</p>
                  <div class="elements-info">
                    <p><span style="color: red">*</span>阈值名</p>
                    <el-input
                      v-model="comSortName"
                      placeholder="请输入阈值类型名"
                      clearable
                    />
                  </div>
                  <div class="elements-btn">
                    <el-button type="primary" @click="addComSort"
                      >增加</el-button
                    >
                    <el-button type="primary" @click="updateComSort"
                      >确认修改</el-button
                    >
                  </div>
                </div>
              </el-col>
              <el-col :md="24" :lg="15" :xl="17">
                <div class="grid-content bg-purple-light">
                  <div class="elements-list">
                    <p>详细</p>
                    <el-button type="danger" @click="deleteComSorts"
                      >批量删除</el-button
                    >
                  </div>
                  <el-table
                    :data="comSortTableDatas"
                    border
                    style="width: 100%"
                    max-height="600"
                    @selection-change="selectComSort"
                  >
                    <el-table-column
                      type="selection"
                      width="55"
                    ></el-table-column>
                    <af-table-column
                      prop="subid"
                      label="编号"
                    ></af-table-column>
                    <af-table-column
                      prop="subname"
                      label="阈值名称"
                    ></af-table-column>
                    <el-table-column fixed="right" label="操作" width="150">
                      <template slot-scope="scope">
                        <el-button
                          type="success"
                          size="mini"
                          @click="editComSort(scope.$index, scope.row)"
                          >编辑</el-button
                        >
                        <el-button
                          type="danger"
                          size="mini"
                          @click="deleteComSort(scope.$index, scope.row)"
                          >删除</el-button
                        >
                      </template>
                    </el-table-column>
                  </el-table>
<!--                  <div class="el-pagination">
                    <div class="btn">
                      <button @click="prev">上一页</button>
                      <span>{{ McurrentPage }}</span>
                      <button @click="next">下一页</button>
                    </div>
                    <div>
                      <el-pagination
                        :current-page="McurrentPage"
                        :page-sizes="[5, 10, 20, 40]"
                        :page-size="Mpagesize"
                        layout="total, sizes, jumper"
                        :total="MrowCount"
                        @size-change="handleSizeChange"
                        @current-change="handleCurrentChange"
                      />
                    </div>
                  </div>-->
                  <div class="el-pagination">
                    <el-pagination
                        :current-page="McurrentPage"
                        :page-size="Mpagesize"
                        :page-sizes="[10, 20, 30, 50]"
                        :total="MrowCount"
                        layout="total, sizes, prev, pager, next, jumper"
                        @size-change="handleSizeChange"
                        @current-change="handleCurrentChange"
                    >
                    </el-pagination>
                  </div>
                </div>
              </el-col>
            </el-row>
          </el-tab-pane>
          <el-tab-pane class="component-edit" label="阈值编辑">
            <el-row :gutter="10">
              <el-col :xs="4" :sm="6" :md="6" :lg="6" :xl="6">
                <div class="grid-content bg-purple">
                  <p>自定义阈值</p>
                  <el-tree
                    class="tree"
                    :data="treeData"
                    :props="defaultProps"
                    @node-click="selectComp"
                  />
                </div>
              </el-col>
              <el-col :xs="20" :sm="18" :md="18" :lg="18" :xl="18">
                <div class="grid-content bg-purple-light">
                  <div class="type-list">
                    <div class="btn-left">
                      <p>信息记录</p>
                      <el-button type="primary" @click="addCom">增加</el-button>
                      <el-button type="danger" @click="deleteComs"
                        >批量删除</el-button
                      >
                    </div>
                    <div class="btn-right">
                      <p>自定义阈值：{{ compName }}</p>
                    </div>
                  </div>
                  <el-table
                    :data="comTableDatas"
                    border
                    style="width: 100%"
                    max-height="600"
                    @selection-change="selectComs"
                  >
                    <el-table-column
                      type="selection"
                      width="55"
                    ></el-table-column>
                    <af-table-column prop="id" label="序号"></af-table-column>
                    <af-table-column
                      prop="subname"
                      label="阈值"
                    ></af-table-column>
                    <af-table-column
                      prop="valueType"
                      label="类型"
                    ></af-table-column>
                    <af-table-column prop="value" label="值"></af-table-column>
                    <af-table-column
                      prop="valueMax"
                      label="最大值"
                    ></af-table-column>
                    <af-table-column
                      prop="valueMin"
                      label="最小值"
                    ></af-table-column>
                    <af-table-column
                      prop="andOr"
                      label="条件与或"
                    ></af-table-column>
                    <af-table-column prop="text" label="文本"></af-table-column>
                    <af-table-column prop="url" label="图片"></af-table-column>
                    <el-table-column fixed="right" label="操作" width="150">
                      <template slot-scope="scope">
                        <el-button
                          type="success"
                          size="mini"
                          @click="editCom(scope.$index, scope.row)"
                          >编辑</el-button
                        >
                        <el-button
                          type="danger"
                          size="mini"
                          @click="deleteCom(scope.$index, scope.row)"
                          >删除</el-button
                        >
                      </template>
                    </el-table-column>
                  </el-table>
<!--                  <div class="el-pagination">
                    <div class="btn">
                      <button @click="prev">上一页</button>
                      <span>{{ EcurrentPage }}</span>
                      <button @click="next">下一页</button>
                    </div>
                    <div>
                      <el-pagination
                        :current-page="EcurrentPage"
                        :page-sizes="[5, 10, 20, 40]"
                        :page-size="Epagesize"
                        layout="total, sizes, jumper"
                        :total="ErowCount"
                        @size-change="handleSizeChange"
                        @current-change="handleCurrentChange"
                      />
                    </div>
                  </div>-->
                  <div class="el-pagination">
                    <el-pagination
                        :current-page="EcurrentPage"
                        :page-size="Epagesize"
                        :page-sizes="[10, 20, 30, 50]"
                        :total="ErowCount"
                        layout="total, sizes, prev, pager, next, jumper"
                        @size-change="handleSizeChange"
                        @current-change="handleCurrentChange"
                    >
                    </el-pagination>
                  </div>
                </div>
              </el-col>
            </el-row>
            <el-dialog
              title="新增阈值"
              :visible.sync="addDialogFormVisible"
              width="60%"
            >
              <el-form label-position="left" label-width="80px" class="form">
                <div class="flex">
                  <el-form-item label="选择类型">
                    <el-select
                      v-model="theType"
                      placeholder="请选择类型"
                      @change="valueChage"
                    >
                      <el-option
                        v-for="item in Type"
                        :key="item.value"
                        :label="item.value"
                        :value="item.id"
                      ></el-option>
                    </el-select>
                  </el-form-item>
                </div>
                <div class="flex" v-show="theType === '数值型'">
                  <el-form-item label="值型=">
                    <el-input
                      v-model="valueType"
                      clearable
                      placeholder="请输入值型"
                    />
                  </el-form-item>
                </div>
                <div class="flex" v-show="theType === '条件型'">
                  <el-form-item label="最小值">
                    <el-input
                      v-model="minValue"
                      clearable
                      placeholder="请输入最小值"
                    />
                  </el-form-item>
                  <el-form-item label="最大值">
                    <el-input
                      v-model="maxValue"
                      clearable
                      placeholder="请输入最大值"
                    />
                  </el-form-item>
                  <el-form-item label="条件与或">
                    <el-select
                      v-model="andOr"
                      clearable
                      placeholder="请选择条件与或"
                    >
                      <el-option
                        v-for="item in AndOr"
                        :key="item.value"
                        :label="item.value"
                        :value="item.id"
                      ></el-option>
                    </el-select>
                  </el-form-item>
                </div>
                <div class="flex">
                  <el-form-item label="显示文本">
                    <el-input
                      v-model="showText"
                      clearable
                      placeholder="请输入显示文本"
                    />
                  </el-form-item>
                  <el-form-item label="图片url">
                    <el-select
                      v-model="imgurl"
                      clearable
                      placeholder="请选择图片"
                    >
                      <el-option
                        v-for="item in imgUrl"
                        :key="item.value"
                        :label="item.value"
                        :value="item.id"
                      ></el-option>
                    </el-select>
                  </el-form-item>
                </div>
              </el-form>
              <div slot="footer" class="dialog-footer">
                <el-button @click="addDialogFormVisible = false"
                  >取 消</el-button
                >
                <el-button type="primary" @click="addTrue">确 定</el-button>
              </div>
            </el-dialog>
            <el-dialog
              title="修改阈值"
              :visible.sync="updateDialogFormVisible"
              width="60%"
            >
              <el-form label-position="left" label-width="80px" class="form">
                <div class="flex">
                  <el-form-item label="选择类型">
                    <el-select
                      v-model="theType"
                      placeholder="请选择类型"
                      @change="valueChage"
                    >
                      <el-option
                        v-for="item in Type"
                        :key="item.value"
                        :label="item.value"
                        :value="item.id"
                      ></el-option>
                    </el-select>
                  </el-form-item>
                </div>
                <div class="flex" v-show="theType === '数值型'">
                  <el-form-item label="值型=">
                    <el-input
                      v-model="comEditData.value"
                      clearable
                      placeholder="请输入值型"
                    />
                  </el-form-item>
                </div>
                <div class="flex" v-show="theType === '条件型'">
                  <el-form-item label="最小值">
                    <el-input
                      v-model="comEditData.valueMin"
                      clearable
                      placeholder="请输入最小值"
                    />
                  </el-form-item>
                  <el-form-item label="最大值">
                    <el-input
                      v-model="comEditData.valueMax"
                      clearable
                      placeholder="请输入最大值"
                    />
                  </el-form-item>
                  <el-form-item label="条件与或">
                    <el-select
                      v-model="comEditData.andOr"
                      clearable
                      placeholder="请选择条件与或"
                    >
                      <el-option
                        v-for="item in AndOr"
                        :key="item.value"
                        :label="item.value"
                        :value="item.id"
                      ></el-option>
                    </el-select>
                  </el-form-item>
                </div>
                <div class="flex">
                  <el-form-item label="显示文本">
                    <el-input
                      v-model="comEditData.text"
                      clearable
                      placeholder="请输入显示文本"
                    />
                  </el-form-item>
                  <el-form-item label="图片url">
                    <el-select
                      v-model="comEditData.url"
                      clearable
                      placeholder="请选择图片"
                    >
                      <el-option
                        v-for="item in imgUrl"
                        :key="item.value"
                        :label="item.value"
                        :value="item.id"
                      ></el-option>
                    </el-select>
                  </el-form-item>
                </div>
              </el-form>
              <div slot="footer" class="dialog-footer">
                <el-button @click="updateDialogFormVisible = false"
                  >取 消</el-button
                >
                <el-button type="primary" @click="updateCom">确 定</el-button>
              </div>
            </el-dialog>
          </el-tab-pane>
        </el-tabs>
      </el-col>
    </el-row>
  </div>
</template>

<script>
import { mapGetters } from "vuex";
import {
  findComp,
  addComp,
  updateComp,
  deleteComp
} from "@/api/contentsetting/componentmanage";
import {
  findAllImg,
  findAllComp,
  findCom,
  addCom,
  updateCom,
  deleteCom
} from "@/api/contentsetting/componentedit";
import { valToId, idToVal, nullToStr } from "@/utils/selectexchange";

export default {
  computed: {
    ...mapGetters(["path"])
  },
  data () {
    return {
      activeName: 0,
      comSorts: [], // 阈值类型数组
      comSortName: "", // 阈值类型名
      McurrentPage: 1,
      MrowCount: 0,
      Mpagesize: 10,
      comSortTableDatas: [], // 阈值类型表格数据
      comSortEditData: {}, // 阈值类型编辑数据

      EcurrentPage: 1,
      ErowCount: 0,
      Epagesize: 10,
      coms: [], // 阈值数组
      compId: "",
      compName: "", // 阈值名
      theType: "数值型", // 选择类型
      valueType: "", // 值型
      showText: "", // 显示文本
      imgurl: "", // 图片url
      maxValue: "", // 最小值
      minValue: "", // 最大值
      andOr: "", // 条件与或
      addDialogFormVisible: false,
      updateDialogFormVisible: false,
      Type: [
        {
          id: 1,
          value: "数值型"
        },
        {
          id: 2,
          value: "条件型"
        }
      ],
      imgUrl: [],
      AndOr: [
        {
          id: 1,
          value: "条件与"
        },
        {
          id: 2,
          value: "条件或"
        }
      ], // 条件与或
      comTableDatas: [],
      comEditData: {},
      treeData: [],
      defaultProps: {
        children: "subid",
        label: "subname"
      }
    };
  },
  created () {
    // 查询所有阈值类型
    this.findCompSort(this.path, this.McurrentPage, this.Mpagesize);

    // 查询所有图片
    findAllImg(this.path)
      .then(res => {
        res.data.forEach(ele => {
          let obj = {
            id: ele.imgid,
            value: ele.imgname
          };
          this.imgUrl.push(obj);
        });
      })
      .catch(console.log);
    // 查询所有阈值类型
    findAllComp(this.path)
      .then(res => {
        this.treeData = res.data;
      })
      .catch(console.log);
    // 查询所有自定义阈值
    this.findCom(this.path, this.EcurrentPage, this.Epagesize);
  },
  methods: {
    // 查询所有阈值类型
    findCompSort (path, currentPage, pagesize) {
      findComp(path, currentPage, pagesize)
        .then(res => {
          this.MrowCount = res.data.rowCount;
          this.comSortTableDatas = res.data.records;
        })
        .catch(console.log);
    },
    // 改变显示页数
    handleSizeChange (size) {
      if (this.activeName == 0) {
        this.Mpagesize = size;
        this.McurrentPage = 1;
        this.findCompSort(this.path, this.McurrentPage, this.Mpagesize);
      } else {
        this.Epagesize = size;
        this.EcurrentPage = 1;
        this.findCom(this.path, this.EcurrentPage, this.Epagesize, this.compId);
      }
    },
    // 跳页
    handleCurrentChange (currentpage) {
      if (this.activeName == 0) {
        this.McurrentPage = currentpage;
        if (this.comSortTableDatas.length < this.MrowCount) {
          this.findCompSort(this.path, this.McurrentPage, this.Mpagesize);
        }
      } else {
        this.EcurrentPage = currentpage;
        if (this.comTableDatas.length < this.ErowCount) {
          this.findCom(
            this.path,
            this.EcurrentPage,
            this.Epagesize,
            this.compId
          );
        }
      }
    },
    // 上一页
    prev () {
      if (this.activeName == 0) {
        if (this.McurrentPage === 1) {
          this.McurrentPage = 1;
        } else {
          this.McurrentPage--;
          if (this.comSortTableDatas.length < this.MrowCount) {
            this.findCompSort(this.path, this.McurrentPage, this.Mpagesize);
          }
        }
      } else {
        if (this.EcurrentPage === 1) {
          this.EcurrentPage = 1;
        } else {
          this.EcurrentPage--;
          if (this.comTableDatas.length < this.ErowCount) {
            this.findCom(
              this.path,
              this.EcurrentPage,
              this.Epagesize,
              this.compId
            );
          }
        }
      }
    },
    // 下一页
    next () {
      if (this.activeName == 0) {
        let maxPage = Math.ceil(this.MrowCount / this.Mpagesize);
        if (this.McurrentPage < maxPage) {
          this.McurrentPage++;
          if (this.comSortTableDatas.length < this.MrowCount) {
            this.findCompSort(this.path, this.McurrentPage, this.Mpagesize);
          }
        }
      } else {
        let maxPage = Math.ceil(this.ErowCount / this.Epagesize);
        if (this.EcurrentPage < maxPage) {
          this.EcurrentPage++;
          if (this.comTableDatas.length < this.ErowCount) {
            this.findCom(
              this.path,
              this.EcurrentPage,
              this.Epagesize,
              this.compId
            );
          }
        }
      }
    },
    // 增加类型模板
    addComSort () {
      if (this.comSortName === "") {
        this.$message.error("*为必填项，请重新填写！");
      } else {
        var formData = new FormData();
        formData.append("subname", this.comSortName);
        addComp(this.path, formData)
          .then(res => {
            if (res.status === 20000) {
              this.$message.success("新增成功!");
              this.findCom(
                this.path,
                this.EcurrentPage,
                this.Epagesize,
                this.compId
              );
            }
          })
          .catch(console.log);
      }
    },
    // 编辑阈值类型
    editComSort (index, row) {
      this.comSortEditData = row;
      this.comSortName = this.comSortEditData.subname;
    },
    // 确认修改
    updateComSort () {
      var formData = new FormData();
      formData.append("subid", this.comSortEditData.subid);
      formData.append("subname", this.comSortName);
      updateComp(this.path, formData)
        .then(res => {
          if (res.status === 20000) {
            this.$message.success("修改成功!");
            this.findCom(
              this.path,
              this.EcurrentPage,
              this.Epagesize,
              this.compId
            );
          }
        })
        .catch(console.log);
    },
    // 删除阈值类型
    deleteComSort (index, row) {
      let tip = confirm("确定要删除吗?");
      if (tip) {
        deleteComp(this.path, row.subid)
          .then(res => {
            if (res.status === 20000) {
              this.$message.success("删除成功!");
              this.findCom(
                this.path,
                this.EcurrentPage,
                this.Epagesize,
                this.compId
              );
            }
          })
          .catch(console.log);
      }
    },
    // 选择阈值类型
    selectComSort (val) {
      this.comSorts = val;
    },
    // 批量删除阈值类型
    deleteComSorts () {
      let tip = confirm("确定要删除吗?");
      if (tip) {
        let ids = [];
        this.comSorts.forEach(ele => {
          ids.push(ele.subid);
        });
        deleteComp(this.path, ids.join(","))
          .then(res => {
            if (res.status === 20000) {
              this.$message.success("批量删除成功!");
              this.findCom(
                this.path,
                this.EcurrentPage,
                this.Epagesize,
                this.compId
              );
            }
          })
          .catch(console.log);
      }
    },

    // 查询所有自定义阈值
    findCom (path, currentPage, pageSize, id) {
      findCom(path, currentPage, pageSize, id)
        .then(res => {
          this.ErowCount = res.data.rowCount;
          this.comTableDatas = res.data.records;
          this.comTableDatas.forEach(ele => {
            ele.url = idToVal(ele.url, this.imgUrl);
            ele.valueType = idToVal(ele.valueType, this.Type);
            ele.andOr = idToVal(ele.andOr, this.AndOr);
          });
        })
        .catch(console.log);
    },
    // 查询相应阈值
    selectComp (data) {
      this.compId = data.subid;
      this.compName = data.subname;
      // 条件查询自定义阈值
      this.findCom(this.path, this.EcurrentPage, this.Epagesize, this.compId);
    },
    // 切换值类型
    valueChage () {
      if (!isNaN(this.theType)) {
        this.theType = idToVal(this.theType, this.Type);
      }
    },
    // 增加类型模板
    addCom () {
      if (this.compName === "") {
        this.$message.error("增加模板前必须先选择阈值名！");
      } else {
        this.addDialogFormVisible = true;
      }
    },
    // 确认增加
    addTrue () {
      var formData = new FormData();
      formData.append("subid", this.compId);
      formData.append("valueType", valToId(this.theType, this.Type));
      formData.append("value", this.valueType);
      formData.append("text", this.showText);
      formData.append("url", this.imgurl);
      formData.append("valueMin", this.minValue);
      formData.append("valueMax", this.maxValue);
      formData.append("andOr", this.andOr);
      addCom(this.path, formData)
        .then(res => {
          if (res.status === 20000) {
            this.$message.success("新增成功!");
            this.findCom(
              this.path,
              this.EcurrentPage,
              this.Epagesize,
              this.compId
            );
            this.addDialogFormVisible = false;
          }
        })
        .catch(console.log);
    },
    // 编辑阈值
    editCom (index, row) {
      this.updateDialogFormVisible = true;
      this.comEditData = row;
      this.theType = idToVal(this.comEditData.valueType, this.Type);
    },
    // 修改阈值
    updateCom () {
      var formData = new FormData();
      formData.append("id", this.comEditData.id);
      formData.append("subid", this.comEditData.subid);
      formData.append("valueType", valToId(this.theType, this.Type));
      formData.append("value", nullToStr(this.comEditData.value));
      formData.append("text", nullToStr(this.comEditData.text));
      formData.append("url", valToId(this.comEditData.url, this.imgUrl));
      formData.append("valueMin", nullToStr(this.comEditData.valueMin));
      formData.append("valueMax", nullToStr(this.comEditData.valueMax));
      formData.append("andOr", valToId(this.comEditData.andOr, this.AndOr));
      updateCom(this.path, formData)
        .then(res => {
          if (res.status === 20000) {
            this.$message.success("修改成功!");
            this.findCom(
              this.path,
              this.EcurrentPage,
              this.Epagesize,
              this.compId
            );
            this.updateDialogFormVisible = false;
          }
        })
        .catch(console.log);
    },
    // 删除类型模板
    deleteCom (index, row) {
      let tip = confirm("确定删除吗？");
      if (tip) {
        deleteCom(this.path, row.id)
          .then(res => {
            if (res.status === 20000) {
              this.$message.success("删除成功!");
              this.findCom(
                this.path,
                this.EcurrentPage,
                this.Epagesize,
                this.compId
              );
            }
          })
          .catch(console.log);
      }
    },
    // 勾选阈值
    selectComs (val) {
      this.coms = val;
    },
    // 批量删除阈值
    deleteComs () {
      let tip = confirm("确定批量删除吗？");
      if (tip) {
        let ids = [];
        this.coms.forEach(ele => {
          ids.push(ele.id);
        });
        deleteCom(this.path, ids.join(","))
          .then(res => {
            if (res.status === 20000) {
              this.$message.success("批量删除成功!");
              this.findCom(
                this.path,
                this.EcurrentPage,
                this.Epagesize,
                this.compId
              );
            }
          })
          .catch(console.log);
      }
    }
  }
};
</script>

<style lang="scss" scoped>
.app-container {
  .component-manage {
    .el-col {
      border-radius: 4px;
    }
    .bg-purple-dark {
      background: #99a9bf;
    }
    .bg-purple {
      position: relative;
      padding: 20px;
      background: var(--theme-color);

      .elements-info-title {
        font-size: 18px;
        font-weight: bold;
      }
      .elements-info {
        margin: 20px 0;
        display: flex;
        justify-content: space-between;
        width: 300px;
        p {
          width: 150px;
          line-height: 40px;
        }
      }
      .elements-btn {
        position: absolute;
        top: 10px;
        right: 10px;
      }
    }
    .bg-purple-light {
      padding: 20px;
      background: var(--theme-color);
      .elements-list {
        display: flex;
        align-items: center;
        margin-bottom: 20px;
        p {
          margin-right: 20px;
          font-size: 18px;
          font-weight: bold;
        }
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
    .grid-content {
      border-radius: 4px;
      min-height: 36px;
    }
  }
  .component-edit {
    .form {
      .flex {
        display: flex;
        align-items: center;
        padding: 10px 0;
        border-bottom: 1px solid #f5f5f5;
        .el-form-item {
          width: 25%;
          .el-input {
            width: 150px;
          }
          .el-select {
            width: 150px;
          }
        }
      }
    }
    .el-col {
      border-radius: 4px;
    }
    .bg-purple-dark {
      background: #99a9bf;
    }
    .bg-purple {
      padding: 20px;
      background: var(--theme-color);
      p {
        margin-bottom: 20px;
        font-size: 18px;
        font-weight: bold;
      }
      .type-relation {
        margin-top: 30px;
        max-height: 900px;
        overflow-y: auto;
      }
    }
    .bg-purple-light {
      padding: 20px;
      background: var(--theme-color);
      .type-list {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 20px;
        .btn-left {
          display: flex;
          justify-content: space-between;
          width: 270px;
          p {
            font-size: 18px;
            font-weight: bold;
            line-height: 30px;
          }
        }
        .btn-right {
          display: flex;
          align-items: center;
        }
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
    .grid-content {
      border-radius: 4px;
      min-height: 36px;
    }
  }
}
</style>


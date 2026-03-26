<template>
  <div class="app-container">
    <el-row :gutter="10">
      <el-col :xs="24" :sm="24" :md="24" :lg="24" :xl="24">
        <el-tabs type="border-card">
          <el-tab-pane class="device-manage-menu" label="设备监控菜单">
            <el-row :gutter="10">
              <el-col :md="24" :lg="9" :xl="9">
                <div class="grid-content bg-purple">
                  <p>监控菜单</p>
                  <el-form
                    ref="ruleForm"
                    label-position="left"
                    class="demo-ruleForm"
                  >
                    <el-form-item label="菜单名称">
                      <el-input
                        class="page-name el-input"
                        v-model="pageName"
                        placeholder="请输入菜单名称"
                        clearable
                      />
                    </el-form-item>
                    <el-form-item label="隶属菜单">
                      <el-cascader
                        v-model="belongPage"
                        placeholder="请选择隶属菜单"
                        :options="parentMenus"
                        :show-all-levels="false"
                        :props="{
                          expandTrigger: 'hover',
                          label: 'picname',
                          value: 'picid',
                          checkStrictly: true,
                        }"
                        @change="handleChange"
                        clearable
                      ></el-cascader>
                    </el-form-item>
                    <el-form-item label="菜单展示">
                      <el-select
                        class="page-name"
                        v-model="pageModel"
                        placeholder="请选择菜单展示"
                      >
                        <el-option
                          v-for="(item, index) in pageModelOptions"
                          :key="index"
                          :label="item.value"
                          :value="item.id"
                        ></el-option>
                      </el-select>
                    </el-form-item>
                    <el-form-item label="菜单用途">
                      <el-select
                        class="page-name"
                        v-model="pageType"
                        placeholder="请选择菜单用途"
                      >
                        <el-option
                          v-for="(item, index) in PageOptions"
                          :key="index"
                          :label="item.value"
                          :value="item.id"
                        ></el-option>
                      </el-select>
                    </el-form-item>
                    <el-form-item label="排列顺序">
                      <el-input
                        class="el-input"
                        v-model="pageLevel"
                        placeholder="请输入页面排列顺序"
                        clearable
                      />
                    </el-form-item>
                    <el-form-item label="平面图片">
                      <el-select
                        v-model="pageImg"
                        clearable
                        placeholder="请选择平面图片"
                      >
                        <el-option
                          v-for="(item, index) in imgMenus"
                          :key="index"
                          :label="item.value"
                          :value="item.id"
                        ></el-option>
                      </el-select>
                    </el-form-item>
                    <el-form-item label="页面路径">
                      <el-input
                        class="el-input"
                        v-model="rootPath"
                        placeholder="请输入页面路径"
                        clearable
                      />
                    </el-form-item>
                    <el-form-item label="页面颜色">
                      <el-color-picker v-model="pageBgColor"></el-color-picker>
                    </el-form-item>
                    <el-form-item class="img-show">
                      <img :src="imgUrl" alt="请选择所需图片！" />
                    </el-form-item>
                  </el-form>
                  <div class="page-btn">
                    <el-button type="primary" @click="handelAdd"
                      >增加</el-button
                    >
                  </div>
                  <div class="bottom">
                    <el-button type="primary" @click="updateTrue"
                      >确认修改</el-button
                    >
                    <el-button type="primary" @click="deletePage"
                      >删除</el-button
                    >
                  </div>
                </div>
              </el-col>
              <el-col :md="24" :lg="15" :xl="15">
                <div class="grid-content bg-purple-light">
                  <p>页面关系</p>
                  <el-tree
                    class="tree"
                    :props="pageProps"
                    :data="treeData"
                    @node-click="update"
                  ></el-tree>
                </div>
              </el-col>
            </el-row>
          </el-tab-pane>
          <el-tab-pane class="system-menu" label="系统菜单">
            <el-row :gutter="10">
              <el-col :md="24" :lg="8" :xl="7">
                <div class="grid-content bg-purple">
                  <el-tree
                    ref="LtreeData"
                    class="LtreeData"
                    :data="LtreeData"
                    show-checkbox
                    node-key="id"
                    default-expand-all
                    :props="defaultProps"
                  ></el-tree>
                </div>
              </el-col>
              <el-col :md="24" :lg="16" :xl="17">
                <div class="grid-content bg-purple-light">
                  <div class="btn">
                    <el-button type="primary" @click="saveMenu"
                      >保存菜单</el-button
                    >
                  </div>
                  <el-tree
                    ref="RtreeData"
                    class="RtreeData"
                    :data="RtreeData"
                    node-key="id"
                    default-expand-all
                    :props="defaultProps"
                    @node-click="updateMenu"
                  ></el-tree>
                </div>
              </el-col>
            </el-row>
            <el-dialog title="编辑菜单" :visible.sync="dialogFormVisible">
              <el-form>
                <el-form-item label="菜单名称">
                  <el-input v-model="editData.menuName" clearable />
                </el-form-item>
                <el-form-item label="隶属菜单">
                  <el-select v-model="editData.parentId" clearable>
                    <el-option
                      v-for="item in parentMenu"
                      :key="item.id"
                      :label="item.value"
                      :value="item.id"
                    ></el-option>
                  </el-select>
                </el-form-item>
                <el-form-item label="是否显示">
                  <el-select v-model="editData.isshow" clearable>
                    <el-option
                      v-for="item in isShow"
                      :key="item.value"
                      :label="item.value"
                      :value="item.id"
                    ></el-option>
                  </el-select>
                </el-form-item>
                <el-form-item label="页面路径">
                  <el-input v-model="editData.menuPath" clearable />
                </el-form-item>
                <el-form-item label="连接页面">
                  <el-cascader
                    v-model="editData.picid"
                    placeholder="请选择隶属菜单"
                    :options="parentMenus"
                    :show-all-levels="false"
                    :props="{
                      expandTrigger: 'hover',
                      label: 'picname',
                      value: 'picid',
                      checkStrictly: true,
                    }"
                    @change="handleChange"
                    clearable
                  ></el-cascader>
                </el-form-item>
                <el-form-item label="排列顺序">
                  <el-input v-model="editData.menuLevel" clearable />
                </el-form-item>
                <el-form-item label="菜单类型">
                  <el-select v-model="editData.menuindex" clearable>
                    <el-option
                      v-for="item in menuType"
                      :key="item.value"
                      :label="item.value"
                      :value="item.id"
                    ></el-option>
                  </el-select>
                </el-form-item>
              </el-form>
              <div slot="footer" class="dialog-footer">
                <el-button @click="dialogFormVisible = false">取 消</el-button>
                <el-button type="primary" @click="updateMenuTrue"
                  >确 定</el-button
                >
              </div>
            </el-dialog>
          </el-tab-pane>
          <el-tab-pane class="user-menu-permission" label="用户菜单权限">
            <el-row :gutter="10">
              <el-col :xs="24" :sm="24" :md="24" :lg="24" :xl="24">
                <div class="grid-content bg-purple-light">
                  <div class="user-menu-info">
                    <p>用户菜单权限</p>
                    <el-button type="primary" @click="addDialog = true"
                      >增加</el-button
                    >
                    <el-button type="danger" @click="deletePermissions"
                      >批量删除</el-button
                    >
                  </div>
                  <el-table
                    :data="tableDatas"
                    border
                    style="width: 100%"
                    max-height="600"
                    @selection-change="selectPermission"
                  >
                    <el-table-column
                      type="selection"
                      width="55"
                    ></el-table-column>
                    <af-table-column prop="id" label="ID"></af-table-column>
                    <af-table-column
                      prop="usergroupname"
                      label="用户组"
                    ></af-table-column>
                    <af-table-column prop="qx" label="权限"></af-table-column>
                    <el-table-column fixed="right" label="操作" width="150">
                      <template slot-scope="scope">
                        <el-button
                          type="success"
                          size="mini"
                          @click="editePermission(scope.$index, scope.row)"
                          >编辑</el-button
                        >
                        <el-button
                          type="danger"
                          size="mini"
                          @click="deletePermission(scope.$index, scope.row)"
                          >删除</el-button
                        >
                      </template>
                    </el-table-column>
                  </el-table>
                  <div class="el-pagination">
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
                  </div>
                  <el-dialog title="添加用户组" :visible.sync="addDialog">
                    <el-form label-width="80px" label-position="left">
                      <el-form-item label="用户组">
                        <el-input v-model="userGroup" clearable />
                      </el-form-item>
                      <el-form-item label="操作控制">
                        <el-select
                          v-model="operateControl"
                          clearable
                          placeholder="请选择操作"
                        >
                          <el-option
                            v-for="item in control"
                            :key="item.value"
                            :label="item.value"
                            :value="item.id"
                          ></el-option>
                        </el-select>
                      </el-form-item>
                      <el-form-item label="菜单权限">
                        <el-tree
                          ref="permissionTree"
                          class="tree"
                          check-strictly="true"
                          :data="permissionTreeData"
                          show-checkbox
                          node-key="id"
                          :props="permissionProps"
                        />
                      </el-form-item>
                    </el-form>
                    <div slot="footer" class="dialog-footer">
                      <el-button @click="addDialog = false">取 消</el-button>
                      <el-button type="primary" @click="addTrue"
                        >确 定</el-button
                      >
                    </div>
                  </el-dialog>
                  <el-dialog title="修改用户组" :visible.sync="updateDialog">
                    <el-form label-width="80px" label-position="left">
                      <el-form-item label="用户组">
                        <el-input
                          v-model="permissionEditData.usergroupname"
                          clearable
                        />
                      </el-form-item>
                      <el-form-item label="操作控制">
                        <el-select
                          v-model="operateControl"
                          clearable
                          placeholder="请选择操作"
                        >
                          <el-option
                            v-for="item in control"
                            :key="item.value"
                            :label="item.value"
                            :value="item.id"
                          ></el-option>
                        </el-select>
                      </el-form-item>
                      <el-form-item label="菜单权限">
                        <el-tree
                          ref="permissionTree"
                          class="tree"
                          show-checkbox
                          node-key="id"
                          check-strictly="true"
                          :data="permissionTreeData"
                          :default-expanded-keys="treeKeys"
                          :default-checked-keys="treeKeys"
                          :props="permissionProps"
                        />
                      </el-form-item>
                    </el-form>
                    <div slot="footer" class="dialog-footer">
                      <el-button @click="updateDialog = false">取 消</el-button>
                      <el-button type="primary" @click="updatePermission"
                        >确 定</el-button
                      >
                    </div>
                  </el-dialog>
                </div>
              </el-col>
            </el-row>
          </el-tab-pane>
        </el-tabs>
      </el-col>
    </el-row>
  </div>
</template>

<script>
import { mapGetters } from "vuex";
import {
  findBuild,
  findImg,
  findPage,
  addPage,
  updatePage,
  deletePage
} from "@/api/contentsetting/baseinformation/pagemanage";
import {
  findAllMenu,
  findObjMenu,
  findMenu,
  findPages,
  saveMenu,
  updateMenu
} from "@/api/contentsetting/systemmenu";
import {
  findPermission,
  addPermission,
  updatePermission,
  deletePermission
} from "@/api/contentsetting/permission";
import { valToId, idToVal, nullToStr } from "@/utils/selectexchange";

export default {
  inject: ["reload"],
  computed: {
    ...mapGetters(["path", "projectTypeId"])
  },
  data () {
    return {
      baseUrl: null,
      pageName: "", // 页面名称
      belongPage: "", // 隶属页面
      pageModel: "一般页面", // 页面展示gis还是一般页面
      pageType: "展示页", // 页面类型
      pageImg: "", // 平面图片
      pageLevel: "", // 排列顺序
      rootPath: "", // 页面路径
      pageBgColor: "#000", // 页面颜色
      imgUrl: "",
      parentMenus: [], // 隶属页面查询结果
      imgMenus: [], // 平面图片的查询结果
      pageModelOptions: [
        {
          id: 3,
          value: "一般页面"
        },
        {
          id: 2,
          value: "gis页面"
        }
      ],
      PageOptions: [
        {
          id: 0,
          value: "展示页"
        },
        {
          id: 1,
          value: "跳转页（隐藏）"
        }
      ],
      treeData: [],
      pageProps: {
        children: "children",
        label: "picname",
        isLeaf: "leaf"
      },

      defaultProps: {
        children: "children",
        label: "menuName"
      },
      LtreeData: [],
      RtreeData: [],
      editData: {},
      dialogFormVisible: false,
      parentMenu: [], // 隶属菜单
      isShow: [
        {
          id: 0,
          value: "不显示"
        },
        {
          id: 1,
          value: "显示"
        }
      ], // 是否显示
      connectPage: [], // 连接页面
      menuType: [
        {
          id: 1,
          value: "运行日志"
        },
        {
          id: 2,
          value: "联动控制"
        },
        {
          id: 3,
          value: "设备运维"
        },
        {
          id: 4,
          value: "能耗管理"
        },
        {
          id: 5,
          value: "用户管理"
        },
        {
          id: 6,
          value: "系统管理"
        }
      ], // 菜单类型

      currentPage: 1,
      rowCount: 0,
      pagesize: 5,
      permissions: [], // 选择的权限数组
      userGroup: "",
      operateControl: "",
      addDialog: false,
      updateDialog: false,
      permissionProps: {
        children: "children",
        label: "menuName"
      },
      control: [
        {
          id: 0,
          value: "不控制"
        },
        {
          id: 1,
          value: "控制"
        }
      ],
      tableDatas: [],
      permissionTreeData: [],
      permissionEditData: {},
      treeKeys: []
    };
  },
  created () {
    this.baseUrl = this.global.baseUrl;
    // 请求平面图片
    let imgtype = "picimage";
    findImg(this.path, imgtype)
      .then(res => {
        res.data.forEach(ele => {
          let obj = {
            id: ele.imgid,
            value: ele.imgname,
            imgUrl: this.baseUrl + ele.imgurl
          };
          this.imgMenus.push(obj);
        });
      })
      .catch(console.log);

    // 查询所有页面
    findPages(this.path)
      .then(res => {
        this.treeData = res.data;
        this.parentMenus = res.data;
      })
      .catch(console.log);

    // 查询所有菜单
    findAllMenu(this.projectTypeId)
      .then(res => {
        this.LtreeData = res.data;
      })
      .catch(console.log);
    // 查询项目菜单
    findObjMenu(this.path)
      .then(res => {
        this.RtreeData = res.data;
        this.permissionTreeData = res.data;
      })
      .catch(console.log);
    // 查询所有菜单目录
    findMenu(this.projectTypeId)
      .then(res => {
        res.data.forEach(ele => {
          let obj = {
            id: ele.id,
            value: ele.menuName
          };
          this.parentMenu.push(obj);
        });
      })
      .catch(console.log);
    // 查询所有页面
    findPages(this.path, "picimage")
      .then(res => {
        res.data.forEach(ele => {
          let obj = {
            id: ele.picid,
            value: ele.picname
          };
          this.connectPage.push(obj);
        });
      })
      .catch(console.log);

    // 查询所有用户权限
    this.findAllPermission(this.path, this.currentPage, this.pagesize);
  },
  methods: {
    // 增加
    handelAdd () {
      var formData = new FormData();
      formData.append("picname", this.pageName);
      formData.append(
        "parentid",
        valToId(this.belongPage[this.belongPage.length - 1], this.parentMenus)
      );
      formData.append("picmodeid", valToId(this.pageModel, this.pageModelOptions));
      formData.append("pictype", valToId(this.pageType, this.PageOptions));
      formData.append("imgId", valToId(this.pageImg, this.imgMenus));
      formData.append("prioritylv", nullToStr(this.pageLevel));
      formData.append("rootPath", nullToStr(this.rootPath));
      formData.append("color", nullToStr(this.pageBgColor));
      addPage(this.path, formData)
        .then(res => {
          if (res.status === 20000) {
            this.$message.success("新增成功!");
            this.reload();
          }
        })
        .catch(console.log);
    },
    handleChange (value) {
      console.log(value);
    },
    // 更新页面
    update (data) {
      this.updateData = data;
      this.pageName = data.picname;
      if (data.parentid === 0) {
        this.belongPage = "";
      }
      this.parentMenus.forEach(eles => {
        if (eles.children != null) {
          eles.children.forEach(ele1 => {
            if (ele1.picid === data.picid) {
              this.belongPage = [ele1.parentid];
            }
            if (ele1.children != null) {
              ele1.children.forEach(ele2 => {
                if (ele2.picid === data.picid) {
                  this.belongPage = [ele1.parentid, ele2.parentid];
                }
              });
            }
          });
        }
      });
      this.pageModel = idToVal(data.picmodeid, this.pageModelOptions)
      this.pageType = idToVal(data.pictype, this.PageOptions);
      this.pageLevel = data.prioritylv;
      this.rootPath = data.rootPath;
      this.pageImg = idToVal(data.imgId, this.imgMenus);
      this.imgUrl = this.baseUrl + data.imgurl;
      this.pageBgColor = data.color;
    },
    // 确认修改
    updateTrue () {
      var formData = new FormData();
      formData.append("picid", this.updateData.picid);
      formData.append("picname", this.pageName);
      formData.append(
        "parentid",
        valToId(this.belongPage[this.belongPage.length - 1], this.parentMenus)
      );
      formData.append("picmodeid", valToId(this.pageModel, this.pageModelOptions));
      formData.append("pictype", valToId(this.pageType, this.PageOptions));
      formData.append("imgId", valToId(this.pageImg, this.imgMenus));
      formData.append("prioritylv", nullToStr(this.pageLevel));
      formData.append("rootPath", nullToStr(this.rootPath));
      formData.append("color", nullToStr(this.pageBgColor));
      updatePage(this.path, formData)
        .then(res => {
          if (res.status === 20000) {
            this.$message.success("修改成功!");
            this.reload();
          }
        })
        .catch(console.log);
    },
    // 删除页面
    deletePage () {
      const tip = confirm("该目录下的子目录将全部删除，确定要删除吗？");
      if (tip) {
        deletePage(this.path, this.updateData.picid)
          .then(res => {
            if (res.status === 20000) {
              this.$message.success("删除成功!");
              this.reload();
            }
          })
          .catch(console.log);
      }
    },

    // 保存菜单
    saveMenu () {
      const datas = [];
      const checkDatas = this.$refs.LtreeData.getCheckedNodes();
      const uncheckDatas = this.$refs.LtreeData.getHalfCheckedNodes();
      checkDatas.forEach(ele => {
        datas.push(ele);
      });
      uncheckDatas.forEach(ele => {
        datas.push(ele);
      });
      var formData = new FormData();
      formData.append("sysmenuinfo", JSON.stringify(datas));
      saveMenu(this.path, formData)
        .then(res => {
          if (res.status === 20000) {
            this.$message.success("新增成功!");
            this.reload();
          }
        })
        .catch(console.log);
    },
    // 修改菜单
    updateMenu (obj) {
      console.log(obj);
      this.dialogFormVisible = true;
      this.editData = obj;
      this.editData.parentId = idToVal(this.editData.parentId, this.parentMenu);
      this.editData.isshow = idToVal(this.editData.isshow, this.isShow);
      // this.parentMenus.forEach(eles => {
      //   if (eles.children != null) {
      //     eles.children.forEach(ele1 => {
      //       if (ele1.picid === obj.picid) {
      //         this.editData.picid = [ele1.parentid];
      //       }
      //       if (ele1.children != null) {
      //         ele1.children.forEach(ele2 => {
      //           if (ele2.picid === obj.picid) {
      //             this.editData.picid = [ele1.parentid, ele2.parentid];
      //           }
      //         });
      //       }
      //     });
      //   }
      // });
      this.editData.menuindex = idToVal(this.editData.menuindex, this.menuType);
    },
    // 确认修改
    updateMenuTrue () {
      var formData = new FormData();
      formData.append("id", this.editData.id);
      formData.append("menuName", this.editData.menuName);
      if (this.editData.parentId != "") {
        formData.append(
          "parentId",
          valToId(this.editData.parentId, this.parentMenu)
        );
      } else {
        formData.append("parentId", 0);
      }
      formData.append("isShow", valToId(this.editData.isshow, this.isShow));
      formData.append("menuPath", this.editData.menuPath);
      formData.append(
        "picid",
        valToId(
          this.editData.picid[this.editData.picid.length - 1],
          this.parentMenus
        )
      );
      formData.append("menuLevel", this.editData.menuLevel);
      formData.append(
        "menuType",
        valToId(this.editData.menuindex, this.menuType)
      );
      updateMenu(this.path, formData)
        .then(res => {
          if (res.status === 20000) {
            this.$message.success("修改成功!");
            this.reload();
          }
        })
        .catch(console.log);
    },

    // 查询所有用户权限
    findAllPermission (path, currentPage, pageSize) {
      findPermission(path, currentPage, pageSize)
        .then(res => {
          this.rowCount = res.data.rowCount;
          this.tableDatas = res.data.records;
        })
        .catch(console.log);
    },
    // 改变显示页数
    handleSizeChange (size) {
      this.pagesize = size;
      this.currentPage = 1;
      this.findAllPermission(this.path, this.currentPage, this.pagesize);
    },
    // 跳页
    handleCurrentChange (currentpage) {
      this.currentPage = currentpage;
      if (this.tableDatas.length < this.rowCount) {
        this.findAllPermission(this.path, this.currentPage, this.pagesize);
      }
    },
    // 上一页
    prev () {
      if (this.currentPage === 1) {
        this.currentPage = 1;
      } else {
        this.currentPage--;
        if (this.tableDatas.length < this.rowCount) {
          this.findAllPermission(this.path, this.currentPage, this.pagesize);
        }
      }
    },
    // 下一页
    next () {
      const maxPage = Math.ceil(this.rowCount / this.pagesize);
      if (this.currentPage < maxPage) {
        this.currentPage++;
        if (this.tableDatas.length < this.rowCount) {
          this.findAllPermission(this.path, this.currentPage, this.pagesize);
        }
      }
    },
    // 新增权限
    addTrue () {
      let keys = this.$refs.permissionTree.getCheckedKeys();
      var formData = new FormData();
      formData.append("usergroupname", this.userGroup);
      formData.append("qx", keys.join(","));
      addPermission(this.path, formData)
        .then(res => {
          if (res.status === 20000) {
            this.$message.success("新增成功!");
            this.reload();
          }
        })
        .catch(console.log);
    },
    // 编辑权限
    editePermission (index, row) {
      this.updateDialog = true;
      this.permissionEditData = row;
      this.treeKeys = row.qx.split(",");
    },
    // 修改项目
    updatePermission () {
      let keys = this.$refs.permissionTree.getCheckedKeys();
      var formData = new FormData();
      formData.append("id", this.permissionEditData.id);
      formData.append("usergroupname", this.permissionEditData.usergroupname);
      formData.append("qx", keys.join(","));
      updatePermission(this.path, formData)
        .then(res => {
          if (res.status === 20000) {
            this.$message.success("修改成功!");
            this.reload();
          }
        })
        .catch(console.log);
    },
    // 删除用户权限
    deletePermission (index, row) {
      deletePermission(this.path, row.id)
        .then(res => {
          if (res.status === 20000) {
            this.$message.success("删除成功!");
            this.reload();
          }
        })
        .catch(console.log);
      this.reload();
    },
    // 选择权限
    selectPermission (val) {
      this.permissions = val;
    },
    // 批量删除
    deletePermissions () {
      let ids = [];
      this.permissions.forEach(ele => {
        ids.push(ele.id);
      });
      deletePermission(this.path, ids.join(","))
        .then(res => {
          if (res.status === 20000) {
            this.$message.success("批量删除成功!");
            this.reload();
          }
        })
        .catch(console.log);
    }
  }
};
</script>

<style lang="scss" scoped>
.app-container {
  .device-manage-menu {
    p {
      margin-bottom: 20px;
      font-size: 18px;
      font-weight: bold;
    }
    .bg-purple {
      position: relative;
      padding: 20px;
      background: var(--theme-color);

      .demo-ruleForm {
        .el-form-item {
          margin: 20px 0;
          .el-input {
            width: 200px;
          }
          .page-name {
            background: #e4bbcf;
          }
        }
        .img-show {
          padding: 10px 0 0 40px;
          img {
            width: 250px;
            height: 200px;
          }
        }
      }

      .page-btn {
        position: absolute;
        top: 10px;
        right: 10px;
      }
      .bottom {
        position: absolute;
        bottom: 10px;
        right: 10px;
      }
    }

    .bg-purple-light {
      padding: 20px;
      background: var(--theme-color);
      .tree {
        max-height: 700px;
        overflow-y: auto;
      }
    }
    .grid-content {
      border-radius: 4px;
      min-height: 36px;
    }
  }
  .system-menu {
    .el-input {
      width: 200px;
    }
    .el-col {
      border-radius: 4px;
      .el-button {
        margin-bottom: 20px;
      }
    }
    .bg-purple {
      position: relative;
      padding: 20px;
      background: var(--theme-color);
      .LtreeData {
        padding: 10px;
        overflow-y: auto;
        max-height: 800px;
      }
    }
    .bg-purple-light {
      padding: 20px;
      background: var(--theme-color);
      .RtreeData {
        padding: 10px;
        overflow-y: auto;
        max-height: 740px;
      }
    }
  }
  .user-menu-permission {
    .el-col {
      border-radius: 4px;
      .el-input {
        width: 200px;
      }
    }
    .bg-purple-dark {
      background: #99a9bf;
    }
    .bg-purple-light {
      padding: 20px;
      background: var(--theme-color);
      .user-menu-info {
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
}
</style>
<style lang="scss">
.el-radio__inner {
  border: 1px solid #000;
}
</style>


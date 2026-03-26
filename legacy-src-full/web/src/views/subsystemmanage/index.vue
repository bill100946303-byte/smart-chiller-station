<template>
  <div class="app-container">
    <el-row :gutter="10">
      <el-col :xs="24" :sm="24" :md="24" :lg="24" :xl="24">
        <el-tabs type="border-card" v-model="activeName">
          <el-tab-pane class="subsystem" label="子系统与设备类型">
            <el-row :gutter="10">
              <el-col :md="24" :lg="18" :xl="18">
                <div class="grid-content bg-purple-light">
                  <div class="tree-btn">
                    <p>待配置类型</p>
                    <el-button type="primary" @click="saveDeviceType"
                      >配置类型</el-button
                    >
                    <div class="right">已配置类型</div>
                  </div>
                  <div class="trees">
                    <el-tree
                      class="leftTree"
                      ref="leftTree"
                      node-key="drtypeid"
                      :props="props"
                      :data="totalTreeData"
                      show-checkbox
                      default-expand-all
                    ></el-tree>
                    <el-tree
                      class="rightTree"
                      :props="props"
                      :data="treeData"
                      @node-click="update"
                    ></el-tree>
                  </div>
                </div>
              </el-col>
              <el-col :md="24" :lg="6" :xl="6">
                <div class="grid-content bg-purple">
                  <p class="page-info-title">子系统与设备类型信息</p>
                  <div class="page-info">
                    <ul>
                      <li>
                        <p><span style="color: red">*</span>类型名</p>
                        <el-input
                          name="text"
                          v-model="input1"
                          placeholder="请输入类型名"
                          clearable
                        />
                      </li>
                      <li>
                        <p>隶属类型</p>
                        <el-select
                          v-model="input2"
                          filterable
                          placeholder="请选择隶属类型"
                          clearable
                        >
                          <el-option
                            v-for="item in parentMenus"
                            :key="item.id"
                            :label="item.value"
                            :value="item.id"
                          ></el-option>
                        </el-select>
                      </li>
                      <li>
                        <p>类型图标</p>
                        <el-select
                          v-model="input3"
                          clearable
                          placeholder="请选择类型图标"
                        >
                          <el-option
                            v-for="(item, index) in iconMenus"
                            :key="index"
                            :label="item.value"
                            :value="item.id"
                          ></el-option>
                        </el-select>
                      </li>
                      <!-- <li>
                        <p>是否显示</p>
                        <el-select
                          v-model="input4"
                          clearable
                          placeholder="请选择是否显示"
                        >
                          <el-option
                            v-for="(item, index) in options"
                            :key="index"
                            :label="item.value"
                            :value="item.id"
                          ></el-option>
                        </el-select>
                      </li> -->
                      <!-- <li>
                        <p>是否结构图</p>
                        <el-select
                          v-model="input5"
                          clearable
                          placeholder="请选择是否显示"
                        >
                          <el-option
                            v-for="(item, index) in options"
                            :key="index"
                            :label="item.value"
                            :value="item.id"
                          ></el-option>
                        </el-select>
                      </li> -->
                      <!-- <li>
                        <p>连接页面</p>
                        <el-cascader
                          v-model="input6"
                          :options="pageOptions"
                          :show-all-levels="false"
                          :props="{
                            expandTrigger: 'hover',
                            label: 'picname',
                            value: 'picid',
                          }"
                          @change="handleChange"
                          clearable
                        ></el-cascader>
                      </li> -->
                    </ul>
                  </div>
                  <div class="page-btn">
                    <el-button type="primary" @click="handelAdd"
                      >增加</el-button
                    >
                  </div>
                  <div class="bottom">
                    <el-button type="primary" @click="updateTrue"
                      >确认修改</el-button
                    >
                    <el-button type="primary" @click="deleteSubsystem"
                      >删除</el-button
                    >
                  </div>
                </div>
              </el-col>
            </el-row>
          </el-tab-pane>
          <el-tab-pane class="typemodel" label="类型模板">
            <el-row :gutter="10">
              <el-col :md="24" :lg="6" :xl="6">
                <div class="grid-content bg-purple">
                  <p>已配置设备类型</p>
                  <el-tree
                    class="tree"
                    :data="deviceTypeTree"
                    :props="defaultProps"
                    @node-click="selectDeviceType"
                  />
                </div>
              </el-col>
              <el-col :md="24" :lg="18" :xl="18">
                <div class="grid-content bg-purple-light">
                  <div class="type-list">
                    <div class="btn-left">
                      <p>模板列表</p>
                      <el-button type="primary" @click="beforAddModel">增加</el-button>
                      <!--<el-button type="primary" @click="exportVar">类型模板导出</el-button>
                      <ExcelUpload class="upload" :btnName="btnName" @excelUpload="uploadFile"/>-->
                      <el-button type="danger" @click="deleteModels">批量删除</el-button>
                    </div>
                    <div class="btn-right">
                      <p>设备类型：{{ deviceTypeName }}</p>
                    </div>
                  </div>
                  <el-table
                    :data="tableDatas"
                    border
                    style="width: 100%"
                    max-height="600"
                    @selection-change="selectModel"
                  >
                    <el-table-column
                      type="selection"
                      width="55"
                    ></el-table-column>
                    <af-table-column
                      prop="typemodeid"
                      label="序号"
                    ></af-table-column>
                    <af-table-column
                      prop="drtypename"
                      label="设备类型"
                    ></af-table-column>
                    <af-table-column
                      prop="regName"
                      label="变量名"
                    ></af-table-column>
                    <af-table-column
                      prop="regType"
                      label="变量类型"
                    ></af-table-column>
                    <af-table-column
                      prop="regListShowLevel"
                      label="列表顺序"
                    ></af-table-column>
                    <af-table-column
                      prop="regUnits"
                      label="单位"
                    ></af-table-column>
                    <af-table-column
                      prop="tagValue"
                      label="初始值"
                    ></af-table-column>
                    <!-- <af-table-column
                      prop="tagTime"
                      label="采集周期"
                    ></af-table-column> -->
                    <af-table-column
                      prop="ishistory"
                      label="历史记录"
                    ></af-table-column>
                    <af-table-column
                      prop="isenergy"
                      label="能源记录"
                    ></af-table-column>
                    <af-table-column
                      prop="isalarm"
                      label="是否报警"
                    ></af-table-column>
                    <el-table-column fixed="right" label="操作" width="150">
                      <template slot-scope="scope">
                        <el-button
                          type="success"
                          size="mini"
                          @click="editModel(scope.$index, scope.row)"
                          >编辑</el-button
                        >
                        <el-button
                          type="danger"
                          size="mini"
                          @click="deleteModel(scope.$index, scope.row)"
                          >删除</el-button
                        >
                      </template>
                    </el-table-column>
                  </el-table>
<!--                  <div class="el-pagination">
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
            <el-dialog
              title="新增类型模板"
              :visible.sync="addDialogFormVisible"
              width="60%"
            >
              <el-form
                :model="ruleForm"
                :rules="rules"
                ref="ruleForm"
                label-position="left"
                class="demo-ruleForm"
              >
                <div class="flex bordernone">
                  <el-form-item label="设备类型">
                    <el-input v-model="deviceTypeName" disabled />
                  </el-form-item>
                  <el-form-item label="显示顺序" prop="showLevel">
                    <el-input
                      v-model="ruleForm.showLevel"
                      placeholder="请输入显示顺序"
                    />
                  </el-form-item>
                </div>
                <div>
                  <i class="title base el-icon-setting">基本信息</i>
                  <div class="flex">
                    <el-form-item label="参数名" prop="paramName">
                      <el-input
                        v-model="ruleForm.paramName"
                        placeholder="请输入参数名"
                      />
                    </el-form-item>
                    <el-form-item label="参数类型" prop="theParamType">
                      <el-select
                        v-model="ruleForm.theParamType"
                        clearable
                        placeholder="请选择参数类型"
                      >
                        <el-option
                          v-for="item in paramType"
                          :key="item.value"
                          :label="item.value"
                          :value="item.id"
                        ></el-option>
                      </el-select>
                    </el-form-item>
                    <el-form-item label="读写属性" prop="readWrite">
                      <el-select
                        v-model="ruleForm.readWrite"
                        clearable
                        placeholder="请选择读写属性"
                      >
                        <el-option
                          v-for="item in ReadAndWrite"
                          :key="item.value"
                          :label="item.value"
                          :value="item.id"
                        ></el-option>
                      </el-select>
                    </el-form-item>
                    <el-form-item label="初始值">
                      <el-input
                        v-model="initValue"
                        clearable
                        placeholder="请输入初始值"
                      />
                    </el-form-item>
                    <el-form-item label="显示阈值">
                      <el-select
                        v-model="FZ"
                        clearable
                        placeholder="请选择显示阈值"
                      >
                        <el-option
                          v-for="item in showFZ"
                          :key="item.value"
                          :label="item.value"
                          :value="item.id"
                        ></el-option>
                      </el-select>
                    </el-form-item>
                    <el-form-item label="设备属性">
                      <el-select
                        v-model="deviceProperty"
                        clearable
                        placeholder="请选择设备属性"
                      >
                        <el-option
                          v-for="item in deviceType"
                          :key="item.value"
                          :label="item.value"
                          :value="item.id"
                        ></el-option>
                      </el-select>
                    </el-form-item>
                    <!-- <el-form-item label="采集周期">
                      <el-select
                        v-model="tagTime"
                        clearable
                        placeholder="请选择采集周期"
                      >
                        <el-option
                          v-for="item in collectTime"
                          :key="item.value"
                          :label="item.value"
                          :value="item.id"
                        ></el-option>
                      </el-select>
                    </el-form-item> -->
                    <el-form-item label="单位">
                      <el-input
                        v-model="unit"
                        clearable
                        placeholder="请输入单位"
                      />
                    </el-form-item>
                  </div>
                </div>
                <div class="flex bordernone">
                  <el-form-item label="历史记录">
                    <el-select
                      v-model="history"
                      clearable
                      placeholder="请选择历史记录"
                    >
                      <el-option
                        v-for="item in historyRecord"
                        :key="item.value"
                        :label="item.value"
                        :value="item.id"
                      ></el-option>
                    </el-select>
                  </el-form-item>
                  <el-form-item label="能耗记录">
                    <el-select
                      v-model="energy"
                      clearable
                      placeholder="请选择能耗记录"
                    >
                      <el-option
                        v-for="item in energyRecord"
                        :key="item.value"
                        :label="item.value"
                        :value="item.id"
                      ></el-option>
                    </el-select>
                  </el-form-item>
                </div>
                <!-- <div> -->
                <!-- <i class="title alarm el-icon-warning-outline">报警信息</i> -->
                <!-- <div class="flex">
                    <el-form-item label="是否报警">
                      <el-select
                        v-model="alarmOrNot"
                        clearable
                        placeholder="请选择是否报警"
                      >
                        <el-option
                          v-for="item in isAlarm"
                          :key="item.value"
                          :label="item.value"
                          :value="item.id"
                        ></el-option>
                      </el-select>
                    </el-form-item>
                    <el-form-item label="报警级别">
                      <el-select
                        v-model="theAlarmLevel"
                        clearable
                        placeholder="请选择报警级别"
                      >
                        <el-option
                          v-for="item in alarmLevel"
                          :key="item.value"
                          :label="item.value"
                          :value="item.id"
                        ></el-option>
                      </el-select>
                    </el-form-item>
                    <el-form-item label="报警类型">
                      <el-select
                        v-model="theAlarmType"
                        clearable
                        placeholder="请选择报警类别"
                      >
                        <el-option
                          v-for="item in alarmType"
                          :key="item.value"
                          :label="item.value"
                          :value="item.id"
                        ></el-option>
                      </el-select>
                    </el-form-item>
                  </div>
                  <div class="flex">
                    <el-form-item label="报警条件低">
                      <el-input
                        v-model="alarmHigh"
                        clearable
                        placeholder="请输入报警条件低"
                      />
                    </el-form-item>
                    <el-form-item label="报警条件高">
                      <el-input
                        v-model="alarmLow"
                        clearable
                        placeholder="请输入报警条件高"
                      />
                    </el-form-item>
                    <el-form-item label="条件与或">
                      <el-select
                        v-model="andOrNot"
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
                </div> -->
                <!-- <div class="flex">
                  <el-form-item label="是否显示">
                    <el-select
                      v-model="showOrNot"
                      clearable
                      placeholder="请选择是否显示"
                    >
                      <el-option
                        v-for="item in isShow"
                        :key="item.value"
                        :label="item.value"
                        :value="item.id"
                      ></el-option>
                    </el-select>
                  </el-form-item>
                  <el-form-item label="显示颜色">
                    <el-color-picker v-model="regColor" />
                  </el-form-item>
                </div> -->
              </el-form>
              <div slot="footer" class="dialog-footer">
                <el-button @click="addDialogFormVisible = false"
                  >取 消</el-button
                >
                <el-button type="primary" @click="addModel">确 定</el-button>
              </div>
            </el-dialog>
            <el-dialog
              title="修改类型模板"
              :visible.sync="updateDialogFormVisible"
              width="60%"
            >
              <el-form
                ref="ruleForm"
                label-position="left"
                class="demo-ruleForm"
              >
                <div class="flex bordernone">
                  <el-form-item label="设备类型">
                    <el-input v-model="editData.drtypename" disabled />
                  </el-form-item>
                  <el-form-item label="显示顺序">
                    <el-input
                      v-model="editData.regListShowLevel"
                      placeholder="请输入显示顺序"
                    />
                  </el-form-item>
                </div>
                <div>
                  <i class="title base el-icon-setting">基本信息</i>
                  <div class="flex">
                    <el-form-item label="参数名">
                      <el-input
                        v-model="editData.regName"
                        placeholder="请输入参数名"
                      />
                    </el-form-item>
                    <el-form-item label="参数类型">
                      <el-select
                        v-model="editData.regType"
                        clearable
                        placeholder="请选择参数类型"
                      >
                        <el-option
                          v-for="item in paramType"
                          :key="item.value"
                          :label="item.value"
                          :value="item.id"
                        ></el-option>
                      </el-select>
                    </el-form-item>
                    <el-form-item label="读写属性">
                      <el-select
                        v-model="editData.regReadWrite"
                        clearable
                        placeholder="请选择读写属性"
                      >
                        <el-option
                          v-for="item in ReadAndWrite"
                          :key="item.value"
                          :label="item.value"
                          :value="item.id"
                        ></el-option>
                      </el-select>
                    </el-form-item>
                    <el-form-item label="初始值">
                      <el-input
                        v-model="editData.tagValue"
                        clearable
                        placeholder="请输入初始值"
                      />
                    </el-form-item>
                    <el-form-item label="显示阈值">
                      <el-select
                        v-model="editData.regSub"
                        clearable
                        placeholder="请选择显示阈值"
                      >
                        <el-option
                          v-for="item in showFZ"
                          :key="item.value"
                          :label="item.value"
                          :value="item.id"
                        ></el-option>
                      </el-select>
                    </el-form-item>
                    <el-form-item label="设备属性">
                      <el-select
                        v-model="editData.regDrShowType"
                        clearable
                        placeholder="请选择设备属性"
                      >
                        <el-option
                          v-for="item in deviceType"
                          :key="item.value"
                          :label="item.value"
                          :value="item.id"
                        ></el-option>
                      </el-select>
                    </el-form-item>
                    <!-- <el-form-item label="采集周期">
                      <el-select
                        v-model="editData.tagTime"
                        clearable
                        placeholder="请选择采集周期"
                      >
                        <el-option
                          v-for="item in collectTime"
                          :key="item.value"
                          :label="item.value"
                          :value="item.id"
                        ></el-option>
                      </el-select>
                    </el-form-item> -->
                    <el-form-item label="单位">
                      <el-input
                        v-model="editData.regUnits"
                        clearable
                        placeholder="请输入单位"
                      />
                    </el-form-item>
                  </div>
                </div>

                <div class="flex bordernone">
                  <el-form-item label="历史记录">
                    <el-select
                      v-model="editData.ishistory"
                      clearable
                      placeholder="请选择历史记录"
                    >
                      <el-option
                        v-for="item in historyRecord"
                        :key="item.value"
                        :label="item.value"
                        :value="item.id"
                      ></el-option>
                    </el-select>
                  </el-form-item>
                  <el-form-item label="能耗记录">
                    <el-select
                      v-model="editData.isenergy"
                      clearable
                      placeholder="请选择能耗记录"
                    >
                      <el-option
                        v-for="item in energyRecord"
                        :key="item.value"
                        :label="item.value"
                        :value="item.id"
                      ></el-option>
                    </el-select>
                  </el-form-item>
                </div>

                <!-- <div>
                  <i class="title alarm el-icon-warning-outline">报警信息</i>
                  <div class="flex">
                    <el-form-item label="是否报警">
                      <el-select
                        v-model="editData.isalarm"
                        clearable
                        placeholder="请选择是否报警"
                      >
                        <el-option
                          v-for="item in isAlarm"
                          :key="item.value"
                          :label="item.value"
                          :value="item.id"
                        ></el-option>
                      </el-select>
                    </el-form-item>
                    <el-form-item label="报警级别">
                      <el-select
                        v-model="editData.alarmLevel"
                        clearable
                        placeholder="请选择报警级别"
                      >
                        <el-option
                          v-for="item in alarmLevel"
                          :key="item.value"
                          :label="item.value"
                          :value="item.id"
                        ></el-option>
                      </el-select>
                    </el-form-item>
                    <el-form-item label="报警类型">
                      <el-select
                        v-model="editData.alarmtype"
                        clearable
                        placeholder="请选择报警类别"
                      >
                        <el-option
                          v-for="item in alarmType"
                          :key="item.value"
                          :label="item.value"
                          :value="item.id"
                        ></el-option>
                      </el-select>
                    </el-form-item>
                  </div>
                </div> -->
                <!-- <div class="flex">
                  <el-form-item label="报警条件低">
                    <el-input
                      v-model="editData.valueMin"
                      clearable
                      placeholder="请输入报警条件低"
                    />
                  </el-form-item>
                  <el-form-item label="报警条件高">
                    <el-input
                      v-model="editData.valueMax"
                      clearable
                      placeholder="请输入报警条件高"
                    />
                  </el-form-item>
                  <el-form-item label="条件与或">
                    <el-select
                      v-model="editData.andOr"
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
                </div> -->
                <!-- <div class="flex">
                  <el-form-item label="是否显示">
                    <el-select
                      v-model="editData.islistshow"
                      clearable
                      placeholder="请选择是否显示"
                    >
                      <el-option
                        v-for="item in isShow"
                        :key="item.value"
                        :label="item.value"
                        :value="item.id"
                      ></el-option>
                    </el-select>
                  </el-form-item>
                  <el-form-item label="显示颜色">
                    <el-color-picker v-model="editData.regcolor" />
                  </el-form-item>
                </div> -->
              </el-form>
              <div slot="footer" class="dialog-footer">
                <el-button @click="updateDialogFormVisible = false"
                >取 消</el-button
                >
                <el-button type="primary" @click="updateModel">修 改</el-button>
              </div>
            <div slot="footer" class="dialog-footer update-model">
                <el-button type="primary" @click="addModelInUpdate"
                  >新增</el-button
                >
              <!--  <div>
                <el-button @click="updateDialogFormVisible = false"
                  >取 消</el-button
                >
                <el-button type="primary" @click="updateModel"
                  >修改</el-button
                >
              </div>-->
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
  addModel,
  deleteModel,
  findAlarmType,
  findComponent,
  findDeviceType,
  findModel,
  inputExcel,
  outputExcel,
  updateModel,
} from "@/api/contentsetting/baseinformation/typemodel";
import {
  addSubsystem,
  deleteSubsystem,
  findAllSubsystem,
  findIcon,
  findPages,
  saveSubsystem,
  updateSubsystem,
} from "@/api/contentsetting/baseinformation/subsystemtype";
import { exportExcel } from "@/utils/excel";
import { formatDate } from "@/utils/index";
import ExcelUpload from "@/components/MyImgUpload/ExcelUpload";
import { idToVal, nullToStr, valToId } from "@/utils/selectexchange";

export default {
  inject: ["reload"],
  components: {
    ExcelUpload,
  },
  computed: {
    ...mapGetters(["path"]),
  },
  data() {
    return {
      activeName: 0,
      input1: "", // 类型名
      input2: "", // 隶属类型
      input3: "", // 类型图标
      input4: "显示", // 是否显示
      input5: "不显示", // 是否结构图
      input6: "", // 连接页面
      updateData: {},
      parentMenus: [],
      iconMenus: [],
      options: [
        {
          id: 1,
          value: "显示",
        },
        {
          id: 0,
          value: "不显示",
        },
      ],
      pageOptions: [], // 连接页面选项
      totalTreeData: [], // 中心库页面树图
      treeData: [], // 项目页面树图
      props: {
        children: "drtypeinfoList",
        label: "drtypename",
        isLeaf: "leaf",
      },

      ruleForm: {
        paramName: "", // 参数名
        theParamType: "", // 参数类型
        readWrite: "只读", // 读写属性
        showLevel: "", // 显示顺序
      },
      rules: {
        paramName: [
          { required: true, message: "参数名不能为空", trigger: "change" },
        ],
        theParamType: [
          { required: true, message: "参数类型不能为空", trigger: "change" },
        ],
        readWrite: [
          { required: true, message: "读写属性不能为空", trigger: "change" },
        ],
        showLevel: [
          { required: true, message: "显示顺序不能为空", trigger: "change" },
        ],
      },
      currentPage: 1,
      rowCount: 0,
      pagesize: 10,
      vars: [], // 选择的变量
      btnName: "类型模板导入",
      deviceTypeId: "", // 设备类型id
      deviceTypeName: "", // 设备类型名
      deviceProperty: "", // 设备属性
      unit: "", // 单位
      FZ: "", // 显示阈值
      initValue: "", // 初始值
      tagTime: "每5分钟存储", // 采集周期
      history: "历史记录", // 历史记录
      energy: "", // 能耗记录
      showOrNot: "显示", // 是否显示
      regColor: "#FFF", // 显示颜色
      alarmOrNot: "", // 是否报警
      theAlarmLevel: "", // 报警级别
      theAlarmType: "", // 报警类别
      alarmHigh: "", // 报警条件低
      alarmLow: "", // 报警条件高
      andOrNot: "", // 条件与或
      addDialogFormVisible: false,
      updateDialogFormVisible: false,
      deviceType: [
        {
          id: 1,
          value: "运行状态",
        },
        {
          id: 2,
          value: "运行报警",
        },
        {
          id: 3,
          value: "设备故障",
        },
      ], // 设备属性select
      paramType: [
        {
          id: 1,
          value: "离散型",
        },
        // {
        //   id: 2,
        //   value: "长整型",
        // },
        {
          id: 3,
          value: "模拟型",
        },
        // {
        //   id: 4,
        //   value: "字符型",
        // },
        {
          id: 5,
          value: "浮点型",
        },
      ], // 参数类别select
      showFZ: [], // 显示阈值
      ReadAndWrite: [
        {
          id: 1,
          value: "只读",
        },
        {
          id: 2,
          value: "读写",
        },
      ], // 读写属性
      collectTime: [
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
      ], // 采集周期
      historyRecord: [
        {
          id: 1,
          value: "历史记录",
        },
      ], // 历史记录
      energyRecord: [
        {
          id: 1,
          value: "能耗记录",
        },
      ], // 能耗记录
      isShow: [
        {
          id: 0,
          value: "不显示",
        },
        {
          id: 1,
          value: "显示",
        },
      ], // 是否显示
      isAlarm: [
        {
          id: 1,
          value: "报警",
        },
      ], // 是否报警
      alarmLevel: [], // 报警级别
      alarmType: [
        {
          id: 1,
          value: "报警",
        },
        {
          id: 2,
          value: "故障",
        },
      ], // 报警类别
      AndOr: [
        {
          id: 1,
          value: "条件与",
        },
        {
          id: 2,
          value: "条件或",
        },
      ], // 条件与或
      tableDatas: [],
      editData: {},
      deviceTypeTree: [], // 设备类型树图数据
      defaultProps: {
        children: "drtypeinfoList",
        label: "drtypename",
      },
    };
  },
  watch: {
    activeName(val) {
      if (val == 2) {
        this.$router.push("/frameworkmap/jgtpage");
      }
    },
  },
  created() {
    // 查询所有子系统类型
    findAllSubsystem(this.path)
      .then((res) => {
        res.data.forEach((ele) => {
          let obj = {
            id: ele.drtypeid,
            value: ele.drtypename,
          };
          this.parentMenus.push(obj);
        });
      })
      .catch(console.log);

    // 查询所有icon
    findIcon()
      .then((res) => {
        res.data.forEach((ele) => {
          let obj = {
            id: ele.iconid,
            value: ele.iconname,
          };
          this.iconMenus.push(obj);
        });
      })
      .catch(console.log);
    // 查询所有页面
    findPages(this.path)
      .then((res) => {
        this.pageOptions = res.data;
      })
      .catch(console.log);

    // 查询所有设备类型
    findDeviceType(this.path)
      .then((res) => {
        this.deviceTypeTree = res.data;
        this.treeData = res.data;
      })
      .catch(console.log);

    // 查询所有设备类型（中心库）
    findDeviceType("zsqy_v1")
      .then((res) => {
        let obj = {
          id: 0,
          drtypename: "全选",
          drtypeinfoList: res.data,
        };
        this.totalTreeData.push(obj);
      })
      .catch(console.log);

    // 查询所有属性组件
    findComponent(this.path)
      .then((res) => {
        res.data.forEach((ele) => {
          let obj = {
            id: ele.subid,
            value: ele.subname,
          };
          this.showFZ.push(obj);
        });
      })
      .catch(console.log);
    // 查询所有报警类别
    findAlarmType(this.path)
      .then((res) => {
        res.data.forEach((ele) => {
          let obj = {
            id: ele.alarmtypelevel,
            value: ele.alarmtypename,
          };
          this.alarmLevel.push(obj);
        });
      })
      .catch(console.log);

    // 查询所有类型模板
    this.findAllModel(
      this.path,
      this.currentPage,
      this.pagesize,
      this.deviceTypeId
    );
  },
  methods: {
    // 保存设备类型
    saveDeviceType() {
      let tip = confirm("确定要保存菜单吗？一旦保存将覆盖右侧菜单");
      if (tip) {
        let deviceTypeIds = this.$refs.leftTree
          .getCheckedKeys()
          .concat(this.$refs.leftTree.getHalfCheckedKeys());
        deviceTypeIds.forEach((ele, i) => {
          if (ele === undefined) {
            deviceTypeIds.splice(i, 1);
          }
        });
        var formData = new FormData();
        formData.append("drtypeids", deviceTypeIds.join(","));
        // 加载
        let loading = this.$loading({
          lock: true,
          text: "数据正在导入数据库，请稍等",
          spinner: "el-icon-loading",
          background: "rgba(0, 0, 0, 0.7)",
        });
        saveSubsystem(this.path, formData)
          .then((res) => {
            if (res.status === 20000) {
              // 加载完成
              loading.close();
              this.$message.success("菜单保存成功!");
              this.reload();
            }
          })
          .catch(()=>loading.close());
      }
    },
    handleChange(value) {
      console.log(this.input6);
      console.log(value);
    },
    // 增加子系统
    handelAdd() {
      if (this.input1 === "") {
        this.$message.error("类型名为必填项！");
      } else {
        var formData = new FormData();
        formData.append("drtypename", nullToStr(this.input1));
        formData.append("parentid", valToId(this.input2, this.parentMenus));
        formData.append("drtypeiconid", valToId(this.input3, this.iconMenus));
        formData.append("isshow", valToId(this.input4, this.options));
        formData.append("isdrtype", valToId(this.input5, this.options));
        formData.append("iscustomType", 0);
        formData.append(
          "picid",
          valToId(this.input6[this.input6.length - 1], this.pageOptions)
        );
        addSubsystem(this.path, formData)
          .then((res) => {
            if (res.status === 20000) {
              this.$message.success("新增成功!");
              this.reload();
            }
          })
          .catch(console.log);
      }
    },
    // 修改
    update(data) {
      this.input6 = "";
      this.updateData = data;
      this.input1 = data.drtypename;
      this.input2 = idToVal(data.parentid, this.parentMenus);
      this.input3 = idToVal(data.drtypeiconid, this.iconMenus);
      this.input4 = idToVal(data.isshow, this.options);
      this.input5 = idToVal(data.isdrtype, this.options);
      this.pageOptions.forEach((eles) => {
        if (eles.children != null) {
          eles.children.forEach((ele) => {
            if (ele.picid === data.picid) {
              this.input6 = [ele.parentid, data.picid];
            }
          });
        } else {
          if (this.input6 === "") {
            this.input6 = [data.picid];
          }
        }
      });
    },
    // 确认修改
    updateTrue() {
      if (this.input1 === "") {
        this.$message.error("类型名为必填项！！");
      } else {
        var formData = new FormData();
        formData.append("drtypeid", this.updateData.drtypeid);
        formData.append("drtypename", this.input1);
        formData.append("parentid", valToId(this.input2, this.parentMenus));
        formData.append("drtypeiconid", valToId(this.input3, this.iconMenus));
        formData.append("isshow", valToId(this.input4, this.options));
        formData.append("isdrtype", valToId(this.input5, this.options));
        formData.append(
          "picid",
          valToId(this.input6[this.input6.length - 1], this.pageOptions)
        );
        updateSubsystem(this.path, formData)
          .then((res) => {
            if (res.status === 20000) {
              this.$message.success("修改成功!");
              this.reload();
            }
          })
          .catch(console.log);
      }
    },
    // 删除子系统
    deleteSubsystem() {
      const tip = confirm("该目录下的子目录将全部删除，确定要删除吗？");
      if (tip) {
        deleteSubsystem(this.path, this.updateData.drtypeid)
          .then((res) => {
            if (res.status === 20000) {
              this.$message.success("删除成功!");
              this.reload();
            }
          })
          .catch(console.log);
      }
    },

    // 查询所有类型模板
    findAllModel(path, currentPage, pageSize, id) {
      findModel(path, currentPage, pageSize, id)
        .then((res) => {
          this.rowCount = res.data.rowCount;
          this.tableDatas = res.data.records;
          this.tableDatas.forEach((ele) => {
            ele.regDrShowType = idToVal(ele.regDrShowType, this.deviceType);
            ele.regType = idToVal(ele.regType, this.paramType);
            ele.tagTime = idToVal(ele.tagTime, this.collectTime);
            ele.ishistory = idToVal(ele.ishistory, this.historyRecord);
            ele.isenergy = idToVal(ele.isenergy, this.energyRecord);
            ele.isalarm = idToVal(ele.isalarm, this.isAlarm);
          });
        })
        .catch(console.log);
    },
    // 改变显示页数
    handleSizeChange(size) {
      this.pagesize = size;
      this.currentPage = 1;
      this.findAllModel(
        this.path,
        this.currentPage,
        this.pagesize,
        this.deviceTypeId
      );
    },
    // 跳页
    handleCurrentChange(currentpage) {
      this.currentPage = currentpage;
      if (this.tableDatas.length < this.rowCount) {
        this.findAllModel(
          this.path,
          this.currentPage,
          this.pagesize,
          this.deviceTypeId
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
          this.findAllModel(
            this.path,
            this.currentPage,
            this.pagesize,
            this.deviceTypeId
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
          this.findAllModel(
            this.path,
            this.currentPage,
            this.pagesize,
            this.deviceTypeId
          );
        }
      }
    },
    // 选择设备类型
    selectDeviceType(data) {
      if (
        data.drtypeinfoList.length === 0 ||
        data.drtypeinfoList.length === null
      ) {
        this.deviceTypeName = data.drtypename;
        this.deviceTypeId = data.drtypeid;
        this.findAllModel(
          this.path,
          this.currentPage,
          this.pagesize,
          this.deviceTypeId
        );
      }
    },
    // 增加类型模板
    beforAddModel() {
      if (this.deviceTypeName === "") {
        this.$message.error("增加模板前必须先选择设备类型！");
      } else {
        this.addDialogFormVisible = true;
      }
    },
    // 确认增加
    addModel() {
      this.$refs.ruleForm.validate((valid) => {
        if (valid) {
          var formData = new FormData();
          formData.append("drtypeid", this.deviceTypeId);
          formData.append("regDrShowType", this.deviceProperty);
          formData.append("regName", this.ruleForm.paramName);
          formData.append("regType", this.ruleForm.theParamType);
          formData.append("regUnits", this.unit);
          formData.append("regSub", this.FZ);
          formData.append(
            "regReadWrite",
            valToId(this.ruleForm.readWrite, this.ReadAndWrite)
          );
          formData.append("regListShowLevel", this.ruleForm.showLevel);
          formData.append("tagValue", this.initValue);
          formData.append("tagTime", valToId(this.tagTime, this.collectTime));
          formData.append(
            "ishistory",
            valToId(this.history, this.historyRecord)
          );
          formData.append("isenergy", this.energy);
          formData.append("islistshow", valToId(this.showOrNot, this.isShow));
          formData.append("regcolor", this.regColor);
          formData.append("isalarm", this.alarmOrNot);
          formData.append("alarmLevel", this.theAlarmLevel);
          formData.append("alarmtype", this.theAlarmType);
          formData.append("valueMin", this.alarmHigh);
          formData.append("valueMax", this.alarmLow);
          formData.append("andOr", this.andOrNot);
          addModel(this.path, formData)
            .then((res) => {
              if (res.status === 20000) {
                this.$message.success("新增成功!");
                this.findAllModel(
                  this.path,
                  this.currentPage,
                  this.pagesize,
                  this.deviceTypeId
                );
                this.addDialogFormVisible = false;
              }
            })
            .catch(console.log);
        } else {
          console.log("错误提交!!");
          return false;
        }
      });
    },
    // 编辑类型模板
    editModel(index, row) {
      this.updateDialogFormVisible = true;
      this.editData = row;
      this.editData.regSub = idToVal(this.editData.regSub, this.showFZ);
      this.editData.regReadWrite = idToVal(
        this.editData.regReadWrite,
        this.ReadAndWrite
      );
      this.editData.islistshow = idToVal(this.editData.islistshow, this.isShow);
      this.editData.alarmtype = idToVal(
        this.editData.alarmtype,
        this.alarmType
      );
      this.editData.andOr = idToVal(this.editData.andOr, this.AndOr);
    },
    // 修改类型模板
    updateModel() {
      var formData = new FormData();
      formData.append("typemodeid", this.editData.typemodeid);
      formData.append("drtypeid", this.editData.drtypeid);
      formData.append(
        "regDrShowType",
        valToId(this.editData.regDrShowType, this.deviceType)
      );
      formData.append("regName", nullToStr(this.editData.regName));
      formData.append(
        "regType",
        valToId(this.editData.regType, this.paramType)
      );
      formData.append("regUnits", nullToStr(this.editData.regUnits));
      formData.append("regSub", valToId(this.editData.regSub, this.showFZ));
      formData.append(
        "regReadWrite",
        valToId(this.editData.regReadWrite, this.ReadAndWrite)
      );
      formData.append(
        "regListShowLevel",
        nullToStr(this.editData.regListShowLevel)
      );
      formData.append("tagValue", nullToStr(this.editData.tagValue));
      formData.append(
        "tagTime",
        valToId(this.editData.tagTime, this.collectTime)
      );
      formData.append(
        "ishistory",
        valToId(this.editData.ishistory, this.historyRecord)
      );
      formData.append(
        "isenergy",
        valToId(this.editData.isenergy, this.energyRecord)
      );
      formData.append(
        "islistshow",
        valToId(this.editData.islistshow, this.isShow)
      );
      formData.append("regcolor", this.editData.regcolor);
      formData.append("isalarm", valToId(this.editData.isalarm, this.isAlarm));
      formData.append(
        "alarmLevel",
        valToId(this.editData.alarmLevel, this.alarmLevel)
      );
      formData.append(
        "alarmtype",
        valToId(this.editData.alarmtype, this.alarmType)
      );
      formData.append("valueMin", nullToStr(this.editData.valueMin));
      formData.append("valueMax", nullToStr(this.editData.valueMax));
      formData.append("andOr", valToId(this.editData.andOr, this.AndOr));
      updateModel(this.path, formData)
        .then((res) => {
          if (res.status === 20000) {
            this.$message.success("修改成功!");
            this.findAllModel(
              this.path,
              this.currentPage,
              this.pagesize,
              this.deviceTypeId
            );
            this.updateDialogFormVisible = false;
          }
        })
        .catch(console.log);
    },
    // 在编辑页面中做新增
    addModelInUpdate() {
      var formData = new FormData();
      formData.append("drtypeid", this.editData.drtypeid);
      formData.append(
        "regDrShowType",
        valToId(this.editData.regDrShowType, this.deviceType)
      );
      formData.append("regName", nullToStr(this.editData.regName));
      formData.append(
        "regType",
        valToId(this.editData.regType, this.paramType)
      );
      formData.append("regUnits", nullToStr(this.editData.regUnits));
      formData.append("regSub", valToId(this.editData.regSub, this.showFZ));
      formData.append(
        "regReadWrite",
        valToId(this.editData.regReadWrite, this.ReadAndWrite)
      );
      formData.append(
        "regListShowLevel",
        nullToStr(this.editData.regListShowLevel)
      );
      formData.append("tagValue", nullToStr(this.editData.tagValue));
      formData.append(
        "tagTime",
        valToId(this.editData.tagTime, this.collectTime)
      );
      formData.append(
        "ishistory",
        valToId(this.editData.ishistory, this.historyRecord)
      );
      formData.append(
        "isenergy",
        valToId(this.editData.isenergy, this.energyRecord)
      );
      formData.append(
        "islistshow",
        valToId(this.editData.islistshow, this.isShow)
      );
      formData.append("regcolor", this.editData.regcolor);
      formData.append("isalarm", valToId(this.editData.isalarm, this.isAlarm));
      formData.append(
        "alarmLevel",
        valToId(this.editData.alarmLevel, this.alarmLevel)
      );
      formData.append(
        "alarmtype",
        valToId(this.editData.alarmtype, this.alarmType)
      );
      formData.append("valueMin", nullToStr(this.editData.valueMin));
      formData.append("valueMax", nullToStr(this.editData.valueMax));
      formData.append("andOr", valToId(this.editData.andOr, this.AndOr));
      addModel(this.path, formData)
        .then((res) => {
          if (res.status === 20000) {
            this.$message.success("修改成功!");
            this.findAllModel(
              this.path,
              this.currentPage,
              this.pagesize,
              this.deviceTypeId
            );
            this.updateDialogFormVisible = false;
          }
        })
        .catch(console.log);
    },
    // 删除类型模板
    deleteModel(index, row) {
      let tip = confirm("确定要删除该模板吗？");
      if (tip) {
        deleteModel(this.path, row.typemodeid)
          .then((res) => {
            if (res.status === 20000) {
              this.$message.success("删除成功!");
              this.findAllModel(
                this.path,
                this.currentPage,
                this.pagesize,
                this.deviceTypeId
              );
            }
          })
          .catch(console.log);
      }
    },
    // 勾选类型模板
    selectModel(val) {
      this.vars = val;
    },
    // 批量删除类型模板
    deleteModels() {
      let tip = confirm("确定要批量删除模板吗？");
      if (tip) {
        let ids = [];
        this.vars.forEach((ele) => {
          ids.push(ele.typemodeid);
        });
        deleteModel(this.path, ids.join(","))
          .then((res) => {
            if (res.status === 20000) {
              this.$message.success("批量删除成功!");
              this.findAllModel(
                this.path,
                this.currentPage,
                this.pagesize,
                this.deviceTypeId
              );
            }
          })
          .catch(console.log);
      }
    },
    // 文件上传
    uploadFile(file) {
      var formData = new FormData();
      formData.append("file", file);
      let loading = this.$loading({
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
            this.reload();
          }
        })
        .catch(()=>loading.close());
    },
    // 导出变量
    exportVar() {
      outputExcel(this.path, this.deviceTypeId)
        .then((res) => {
          let date = formatDate(new Date());
          const filename = "设备类型模板" + date + ".xls";
          exportExcel(res, filename);
        })
        .catch(console.log);
    },
  },
};
</script>
<style lang="scss" scoped>
.app-container {
  .subsystem {
    .bg-purple {
      position: relative;
      padding: 20px;
      height: 795px;
      background: var(--theme-color);

      .page-info-title {
        font-size: 18px;
        font-weight: bold;
      }
      .page-info {
        margin-top: 30px;
        ul {
          li {
            margin: 20px 0;
            display: flex;
            justify-content: space-between;
            width: 250px;
            .el-input {
              width: 200px;
            }
            p {
              width: 120px;
              line-height: 40px;
            }
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
      .tree-btn {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 20px;
        //width: 200px;
        p {
          font-size: 18px;
          font-weight: bold;
          margin-right: 30px;
        }
        .right {
          flex: 1;
          font-size: 18px;
          font-weight: bold;
          text-align: center;
        }
      }

      .trees {
        display: flex;
        align-items: center;
        justify-content: space-between;
        .leftTree,
        .rightTree {
          width: 45%;
          height: 700px;
          overflow-y: auto;
        }
      }
    }
    .grid-content {
      border-radius: 4px;
      min-height: 36px;
    }
  }
  .typemodel {
    .flex {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      padding: 20px 0;
      border-bottom: 1px solid #d3d0d0;
      .el-form-item {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 10px;
        width: 25%;
        min-width: 300px;
        .el-input {
          width: 150px;
        }
        .el-select {
          width: 150px;
        }
        .el-autocomplete {
          width: 150px;
        }
      }
    }

    .bordernone {
      border: none;
    }

    .title {
      padding: 10px;
      width: 100%;
      font-size: 20px;
      font-weight: bold;
    }

    .base {
      background: #f0f6fa;
    }

    .alarm {
      background: #f0f6fa;
    }

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

      .tree {
        max-height: 700px;
        overflow-y: auto;
      }

      p {
        margin-bottom: 20px;
        font-size: 18px;
        font-weight: bold;
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
          //justify-content: space-between;
          width: 550px;
          .el-button {
             margin-left: 10px;
            //margin-left: 0;
          }
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
    .el-dialog {
      .update-model {
        display: flex;
        align-items: center;
        justify-content: space-between;
      }
    }
    .grid-content {
      border-radius: 4px;
      min-height: 36px;
    }
  }
}
</style>


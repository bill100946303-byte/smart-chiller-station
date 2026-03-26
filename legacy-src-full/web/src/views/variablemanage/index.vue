<template>
  <div class="app-container">
    <el-row :gutter="10">
      <el-col :xs="24" :sm="24" :md="24" :lg="24" :xl="24">
        <el-tabs type="border-card" v-model="activeName">
          <el-tab-pane class="alarmtype-manage" label="报警类型管理">
            <el-row :gutter="10">
              <el-col :md="24" :lg="9" :xl="7">
                <div class="grid-content bg-purple">
                  <p>报警类型定义</p>
                  <el-form
                    ref="alarmTypeForm"
                    label-position="left"
                    class="demo-ruleForm"
                    :rules="rules1"
                    :model="alarmTypeForm"
                  >
                    <el-form-item label="类型名称" prop="alarmTypeName">
                      <el-input
                        v-model="alarmTypeForm.alarmTypeName"
                        placeholder="请输入类型名称"
                        clearable
                      />
                    </el-form-item>
                    <el-form-item label="报警级别" prop="alarmTypeLevel">
                      <el-input
                        v-model="alarmTypeForm.alarmTypeLevel"
                        placeholder="请输入报警级别"
                        clearable
                      />
                    </el-form-item>
                    <el-form-item label="类型描述" prop="alarmTypeSrc">
                      <el-input
                        v-model="alarmTypeForm.alarmTypeSrc"
                        type="textarea"
                        :rows="3"
                        placeholder="请输入类型描述"
                      />
                    </el-form-item>
                  </el-form>
                  <div class="buiding-btn">
                    <el-button type="primary" @click="addAlarm">增加</el-button>
                    <el-button type="primary" @click="updateAlarm"
                      >确认修改</el-button
                    >
                  </div>
                </div>
              </el-col>
              <el-col :md="24" :lg="15" :xl="17">
                <div class="grid-content bg-purple-light">
                  <div class="alarm-btn">
                    <p>报警类型信息</p>
                    <el-button type="danger" @click="deleteAlarms"
                      >批量删除</el-button
                    >
                  </div>
                  <el-table
                    :data="alarmTypeTableDatas"
                    border
                    style="width: 100%"
                    max-height="600"
                    @selection-change="selectAlarmType"
                  >
                    <el-table-column
                      type="selection"
                      width="55"
                    ></el-table-column>
                    <af-table-column prop="id" label="序号"></af-table-column>
                    <af-table-column
                      prop="alarmtypename"
                      label="类型名称"
                    ></af-table-column>
                    <af-table-column
                      prop="alarmtypelevel"
                      label="报警级别"
                    ></af-table-column>
                    <af-table-column
                      prop="alarmtypeExpain"
                      label="类型描述"
                    ></af-table-column>
                    <el-table-column fixed="right" label="操作" width="150">
                      <template slot-scope="scope">
                        <el-button
                          type="success"
                          size="mini"
                          @click="editAlarm(scope.$index, scope.row)"
                          >编辑</el-button
                        >
                        <el-button
                          type="danger"
                          size="mini"
                          @click="deleteAlarm(scope.$index, scope.row)"
                          >删除</el-button
                        >
                      </template>
                    </el-table-column>
                  </el-table>
<!--                  <div class="el-pagination">
                    <div class="btn">
                      <button @click="prev">上一页</button>
                      <span>{{ AcurrentPage }}</span>
                      <button @click="next">下一页</button>
                    </div>
                    <div>
                      <el-pagination
                        :current-page="AcurrentPage"
                        :page-sizes="[5, 10, 20, 40]"
                        :page-size="Apagesize"
                        layout="total, sizes, jumper"
                        :total="ArowCount"
                        @size-change="handleSizeChange"
                        @current-change="handleCurrentChange"
                      />
                    </div>
                  </div>-->
                  <div class="el-pagination">
                    <el-pagination
                        :current-page="AcurrentPage"
                        :page-size="Apagesize"
                        :page-sizes="[10, 20, 30, 50]"
                        :total="ArowCount"
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
          <el-tab-pane class="variable-manage" label="变量管理">
            <el-row :gutter="10">
              <el-col :md="24" :lg="5" :xl="5">
                <div class="grid-content bg-purple">
                  <div class="treeTitle">
                    <p>已配置设备类型</p>
                    <p>设备列表</p>
                  </div>
                  <div class="tree">
                    <el-tree
                      class="tree-device-type"
                      :data="deviceTypeTree"
                      :props="deviceTypeProps"
                      @node-click="selectDeviceType"
                    />
                    <el-tree
                      :data="deviceTree"
                      :props="deviceProps"
                      @node-click="selectDevice"
                    />
                  </div>
                </div>
              </el-col>
              <el-col :md="24" :lg="19" :xl="19">
                <div class="grid-content bg-purple-light">
                  <div class="type-list">
                    <div class="btn-left">
                      <p>设备变量列表</p>
                      <el-button type="primary" @click="handelAdd">增加</el-button>
                      <el-button type="primary" @click="exportVar">变量导出</el-button>
                      <!--<ExcelUpload class="upload" :btnName="btnName" @excelUpload="uploadFile"/>-->
                      <el-button type="primary" @click="exportVarModel">导出变量寄存器模板</el-button>
                      <el-button type="primary" @click="exportAlarm">导出变量报警</el-button>
                      <!--<ExcelUpload class="upload" :btnName="'导入变量报警'" @excelUpload="uploadAlarmFile"/>-->
                      <el-button type="danger" @click="handelDeletes" >批量删除</el-button>
                    </div>
                  </div>
                  <div class="btn-right">
                    <p v-if="deviceTypeTreePath">设备类型：{{deviceTypeTreePath}}</p>
                    <p>设备名：{{ deviceName }}</p>
                  </div>
                  <el-table
                    :data="tableDatas"
                    border
                    style="width: 100%"
                    max-height="650"
                    @selection-change="selectVars"
                  >
                    <el-table-column
                      type="selection"
                      width="40"
                    ></el-table-column>
                    <af-table-column prop="regId" label="序号"  width="65"/>
                    <af-table-column prop="drname" label="设备名称" />
                    <af-table-column prop="drcode" label="设备编码" />
                    <af-table-column prop="regName" label="变量名" />
                    <af-table-column prop="regType" label="变量类型"  width="80"/>
                    <af-table-column prop="regListShowLevel" label="列表顺序" width="80"/>
                    <af-table-column prop="regUnits" label="单位" width="60"/>
                    <af-table-column prop="tagValue" label="初始值" width="65"/>
                    <af-table-column prop="tagTime" label="采集周期" width="110"/>
                    <af-table-column prop="tagName" label="变量寄存器名称" width="120"/>
                    <af-table-column prop="isenergy" label="能源记录" width="80"/>
                    <af-table-column prop="isalarm" label="是否报警" width="80"/>
                    <el-table-column fixed="right" label="操作" width="150">
                      <template slot-scope="scope">
                        <el-button
                          type="success"
                          size="mini"
                          @click="handelEdit(scope.$index, scope.row)"
                          >编辑</el-button
                        >
                        <el-button
                          type="danger"
                          size="mini"
                          @click="handelDelete(scope.$index, scope.row)"
                          >删除</el-button
                        >
                      </template>
                    </el-table-column>
                  </el-table>
<!--                  <div class="el-pagination">
                    <div class="btn">
                      <button @click="prev">上一页</button>
                      <span>{{ VcurrentPage }}</span>
                      <button @click="next">下一页</button>
                    </div>
                    <div>
                      <el-pagination
                        :current-page="VcurrentPage"
                        :page-sizes="[5, 10, 20, 40]"
                        :page-size="VpageSize"
                        layout="total, sizes, jumper"
                        :total="VrowCount"
                        @size-change="handleSizeChange"
                        @current-change="handleCurrentChange"
                      />
                    </div>
                  </div>-->
                  <div class="el-pagination">
                    <el-pagination
                        :current-page="VcurrentPage"
                        :page-size="VpageSize"
                        :page-sizes="[10, 20, 30, 50]"
                        :total="VrowCount"
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
              title="新增变量"
              :visible.sync="addDialogFormVisible"
              width="65%"
            >
              <el-form
                :model="ruleForm"
                :rules="rules"
                ref="ruleForm"
                label-position="left"
                class="demo-ruleForm"
              >
                <div class="flex bordernone">
                  <el-form-item label="设备名">
                    <el-input v-model="deviceName" disabled />
                  </el-form-item>
                  <el-form-item label="设备类型">
                    <el-input v-model="deviceType" disabled />
                  </el-form-item>
                  <el-form-item label="显示顺序" prop="input8">
                    <el-input
                      v-model="ruleForm.input8"
                      placeholder="请输入显示顺序"
                    />
                  </el-form-item>
                </div>
                <div>
                  <i class="title base el-icon-setting">基本信息</i>
                  <div class="flex">
                    <el-form-item label="参数名" prop="input3">
                      <el-input
                        v-model="ruleForm.input3"
                        placeholder="请输入参数名"
                      />
                    </el-form-item>
                    <el-form-item label="参数类型" prop="input4">
                      <el-select
                        v-model="ruleForm.input4"
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
                    <el-form-item label="读写属性" prop="input7">
                      <el-select
                        v-model="ruleForm.input7"
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
                      <el-input v-model="input10" placeholder="请输入初始值" />
                    </el-form-item>
                    <el-form-item label="寄存器">
                      <el-input v-model="input9" placeholder="请输入寄存器" />
                      <!-- <el-select v-model="input9" clearable placeholder="请选择寄存器">
                        <el-option
                          v-for="item in register"
                          :key="item.value"
                          :label="item.tagname"
                          :value="item.tagname"
                        ></el-option>
                      </el-select> -->
                    </el-form-item>
                    <el-form-item label="显示阀值">
                      <el-select
                        v-model="input6"
                        clearable
                        placeholder="请选择显示阀值"
                      >
                        <el-option
                          v-for="item in showFZ"
                          :key="item.value"
                          :label="item.subname"
                          :value="item.subid"
                        ></el-option>
                      </el-select>
                    </el-form-item>
                    <el-form-item label="设备属性">
                      <el-select
                        v-model="input1"
                        clearable
                        placeholder="请选择设备属性"
                      >
                        <el-option
                          v-for="item in DeviceType"
                          :key="item.value"
                          :label="item.value"
                          :value="item.id"
                        ></el-option>
                      </el-select>
                    </el-form-item>
                    <el-form-item label="存储周期">
                      <el-select
                        v-model="input11"
                        clearable
                        placeholder="请选择存储周期"
                      >
                        <el-option
                          v-for="item in saveTime"
                          :key="item.value"
                          :label="item.value"
                          :value="item.id"
                        ></el-option>
                      </el-select>
                    </el-form-item>
                    <el-form-item label="单位">
                      <el-input v-model="input5" placeholder="请输入单位" />
                    </el-form-item>
                  </div>
                </div>
                <div class="flex bordernone">
                  <el-form-item label="历史记录">
                    <el-select
                      v-model="input12"
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
                      v-model="input13"
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
                <div>
                  <i class="title alarm el-icon-warning-outline">报警信息</i>
                  <div class="alarm-info">
                    <div class="control-alarm">
                      <el-form-item label="是否报警">
                        <el-select
                          v-model="input20"
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
                      <div>
                        <el-button type="primary" @click="createAlarmForm"
                          >新建报警</el-button
                        >
                        <el-button type="primary" @click="removeAlarmForm"
                          >移除报警</el-button
                        >
                      </div>
                    </div>
                    <div
                      class="alarmflex"
                      v-for="(item, i) in alarmForm"
                      :key="i"
                    >
                      <el-form-item
                        :label="'报警级别' + i"
                        :prop="'alarmLevel' + i"
                      >
                        <el-select
                          v-model="item.alarmLevel"
                          clearable
                          placeholder="请选择报警级别"
                        >
                          <el-option
                            v-for="item in alarmLevel"
                            :key="item.id"
                            :label="item.alarmtypename"
                            :value="item.alarmtypelevel"
                          ></el-option>
                        </el-select>
                      </el-form-item>
                      <el-form-item
                        :label="'报警类型' + i"
                        :prop="'alarmType' + i"
                      >
                        <el-select
                          v-model="item.alarmtype"
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
                      <el-form-item
                        :label="'报警条件低' + i"
                        :prop="'alarmMin' + i"
                      >
                        <el-input
                          v-model="item.valueMin"
                          placeholder="请输入报警条件低"
                        />
                      </el-form-item>
                      <el-form-item
                        :label="'报警条件高' + i"
                        :prop="'alarmMax' + i"
                      >
                        <el-input
                          v-model="item.valueMax"
                          placeholder="请输入报警条件高"
                        />
                      </el-form-item>
                      <el-form-item
                        :label="'条件与或' + i"
                        :prop="'alarmOrNot' + i"
                      >
                        <el-select
                          v-model="item.andOr"
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
                      <el-form-item
                        :label="'报警描述' + i"
                        :prop="'alarmexplain' + i"
                      >
                        <el-input
                          v-model="item.alarmexplain"
                          type="textarea"
                          placeholder="请输入报警描述"
                        />
                      </el-form-item>
                    </div>
                  </div>
                </div>

                <div class="flex">
                  <el-form-item label="显示公式">
                    <el-input
                      v-model="input14"
                      readonly
                      placeholder="请输入显示公式"
                    />
                  </el-form-item>
                  <el-button
                    style="margin-bottom: 20px"
                    @click="mathVisible = true"
                    type="primary"
                    size="mini"
                    >编辑公式</el-button
                  >
                  <el-form-item label="显示颜色">
                    <el-color-picker v-model="regColor" />
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
              title="修改变量"
              :visible.sync="updateDialogFormVisible"
              width="65%"
            >
              <el-form
                ref="ruleForm"
                label-position="left"
                class="demo-ruleForm"
              >
                <div class="flex bordernone">
                  <el-form-item label="设备名">
                    <el-input v-model="editData.drname" disabled />
                  </el-form-item>
                  <el-form-item label="设备类型">
                    <el-input v-model="editData.drtypename" disabled />
                  </el-form-item>
                  <el-form-item label="显示顺序">
                    <el-input v-model="editData.regListShowLevel" disabled />
                  </el-form-item>
                </div>
                <div>
                  <i class="title base el-icon-setting">基本信息</i>
                  <div class="flex">
                    <el-form-item label="参数名">
                      <el-input v-model="editData.regName" disabled />
                    </el-form-item>
                    <el-form-item label="参数类型">
                      <el-select v-model="editData.regType">
                        <el-option
                          v-for="item in paramType"
                          :key="item.value"
                          :label="item.value"
                          :value="item.id"
                        ></el-option>
                      </el-select>
                    </el-form-item>
                    <el-form-item label="读写属性">
                      <el-select v-model="editData.regReadWrite">
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
                        placeholder="请输入初始值"
                      />
                    </el-form-item>
                    <el-form-item label="寄存器">
                      <el-input v-model="editData.tagName" />
                      <!-- <el-select v-model="editData.tagName" clearable>
                        <el-option
                          v-for="item in register"
                          :key="item.value"
                          :label="item.tagname"
                          :value="item.tagname"
                        ></el-option>
                      </el-select> -->
                    </el-form-item>
                    <el-form-item label="显示阀值">
                      <el-select v-model="editData.regSub" clearable>
                        <el-option
                          v-for="item in showFZ"
                          :key="item.value"
                          :label="item.subname"
                          :value="item.subid"
                        ></el-option>
                      </el-select>
                    </el-form-item>
                    <el-form-item label="设备属性">
                      <el-select v-model="editData.regDrShowType">
                        <el-option
                          v-for="item in DeviceType"
                          :key="item.value"
                          :label="item.value"
                          :value="item.id"
                        ></el-option>
                      </el-select>
                    </el-form-item>
                    <el-form-item label="存储周期">
                      <el-select v-model="editData.tagTime">
                        <el-option
                          v-for="item in saveTime"
                          :key="item.value"
                          :label="item.value"
                          :value="item.id"
                        ></el-option>
                      </el-select>
                    </el-form-item>
                    <el-form-item label="单位">
                      <el-input
                        v-model="editData.regUnits"
                        placeholder="请输入单位"
                        auto-complete="off"
                      />
                    </el-form-item>
                  </div>
                </div>
                <div class="flex bordernone">
                  <el-form-item label="历史记录">
                    <el-select v-model="editData.ishistory" clearable>
                      <el-option
                        v-for="item in historyRecord"
                        :key="item.value"
                        :label="item.value"
                        :value="item.id"
                      ></el-option>
                    </el-select>
                  </el-form-item>
                  <el-form-item label="能耗记录">
                    <el-select v-model="editData.isenergy" clearable>
                      <el-option
                        v-for="item in energyRecord"
                        :key="item.value"
                        :label="item.value"
                        :value="item.id"
                      ></el-option>
                    </el-select>
                  </el-form-item>
                </div>
                <div>
                  <i class="title alarm el-icon-warning-outline">报警信息</i>
                  <div class="alarm-info">
                    <div class="control-alarm">
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
                      <div>
                        <el-button type="primary" @click="createAlarmForm"
                          >新建报警</el-button
                        >
                        <el-button type="primary" @click="removeAlarmForm"
                          >移除报警</el-button
                        >
                      </div>
                    </div>
                    <div
                      class="alarmflex"
                      v-for="(item, i) in alarmForm"
                      :key="i"
                    >
                      <el-form-item
                        :label="'报警级别' + i"
                        :prop="'alarmLevel' + i"
                      >
                        <el-select
                          v-model="item.alarmLevel"
                          clearable
                          placeholder="请选择报警级别"
                        >
                          <el-option
                            v-for="item in alarmLevel"
                            :key="item.value"
                            :label="item.alarmtypename"
                            :value="item.alarmtypelevel"
                          ></el-option>
                        </el-select>
                      </el-form-item>
                      <el-form-item
                        :label="'报警类型' + i"
                        :prop="'alarmType' + i"
                      >
                        <el-select
                          v-model="item.alarmtype"
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
                      <el-form-item
                        :label="'报警条件低' + i"
                        :prop="'alarmMin' + i"
                      >
                        <el-input
                          v-model="item.valueMin"
                          placeholder="请输入报警条件低"
                        />
                      </el-form-item>
                      <el-form-item
                        :label="'报警条件高' + i"
                        :prop="'alarmMax' + i"
                      >
                        <el-input
                          v-model="item.valueMax"
                          placeholder="请输入报警条件高"
                        />
                      </el-form-item>
                      <el-form-item
                        :label="'条件与或' + i"
                        :prop="'alarmOrNot' + i"
                      >
                        <el-select
                          v-model="item.andOr"
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
                      <el-form-item
                        :label="'报警描述' + i"
                        :prop="'alarmexplain' + i"
                      >
                        <el-input
                          v-model="item.alarmexplain"
                          type="textarea"
                          placeholder="请输入报警描述"
                        />
                      </el-form-item>
                    </div>
                  </div>
                </div>
                <div class="flex">
                  <el-form-item label="显示公式">
                    <el-input v-model="editData.regmath" readonly />
                  </el-form-item>
                  <el-button
                    style="margin-bottom: 20px"
                    @click="editMath"
                    type="primary"
                    size="mini"
                    >编辑公式</el-button
                  >
                  <el-form-item label="显示颜色">
                    <el-color-picker v-model="editData.regcolor" />
                  </el-form-item>
                </div>
              </el-form>
              <div slot="footer" class="dialog-footer update-var">
                <el-button type="primary" @click="addVarInUpdate"
                  >新 增</el-button
                >
                <div>
                  <el-button @click="updateDialogFormVisible = false"
                    >取 消</el-button
                  >
                  <el-button type="primary" @click="updateTrue"
                    >确 定</el-button
                  >
                </div>
              </div>
            </el-dialog>
            <el-dialog
              width="60%"
              title="变量公式配置"
              :visible.sync="mathVisible"
              :close-on-click-modal="false"
              append-to-body
            >
              <div class="math-dispose">
                <div class="math-chooses">
                  <el-button type="primary" @click="regVisible = true"
                    >添加变量</el-button
                  >
                  <el-input
                    v-model="mathConstant"
                    placeholder="输入常量"
                    clearable
                  />
                  <el-button type="primary" @click="addMath(2)">添加</el-button>
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
                <el-input
                  type="textarea"
                  :rows="3"
                  v-model="mathContent"
                ></el-input>
                <el-button type="primary" @click="mathContent = ''"
                  >清除公式</el-button
                >
              </div>
              <div slot="footer" class="dialog-footer">
                <el-button @click="mathVisible = false">取 消</el-button>
                <el-button type="primary" @click="finishMath">确 定</el-button>
              </div>
            </el-dialog>
            <el-dialog
              width="50%"
              title="变量选择"
              :visible.sync="regVisible"
              :close-on-click-modal="false"
              append-to-body
            >
              <div class="reg-chooses">
                <el-tree
                  class="tree-device-type"
                  :data="deviceTypeTree"
                  :props="deviceTypeProps"
                  @node-click="selectDeviceType"
                />
                <el-tree
                  :data="deviceTree"
                  :props="deviceProps"
                  @node-click="selectDevice"
                />
                <el-tree
                  :data="regTreeData"
                  :props="regProps"
                  @node-click="selectReg"
                />
              </div>
            </el-dialog>
          </el-tab-pane>
        </el-tabs>
      </el-col>
    </el-row>
  </div>
</template>

<script>
import {mapGetters} from "vuex";
import {addAlarm, deleteAlarm, findAlarm, updateAlarm} from "@/api/contentsetting/alarmtype";
import {
  addVar,
  deleteVar,
  findDevice,
  findSub,
  findVar,
  inputAlarmExcel,
  inputExcel,
  outputAlarmExcel,
  outputExcel,
  outputVarModel,
  updateVar
} from "@/api/contentsetting/varmanage";
import {findAlarmType, findComponent, findDeviceType} from "@/api/contentsetting/baseinformation/typemodel";
import {findAllReg} from "@/api/contentsetting/drawedit";
import {idToVal, nullToStr, valToId} from "@/utils/selectexchange";
import {exportExcel} from "@/utils/excel";
import {formatDate} from "@/utils/index";
import ExcelUpload from "@/components/MyImgUpload/ExcelUpload";

export default {
  inject: ["reload"],
  components: {
    ExcelUpload
  },
  computed: {
    ...mapGetters(["path"])
  },
  data () {
    return {
      btnName: "变量导入",
      activeName: 0,
      alarmTypes: [], // 报警类型数组
      alarmTypeForm:{
        alarmTypeName: "", // 类型名
        alarmTypeLevel: "", // 报警级别
        alarmTypeSrc: "", // 类型描述
      },
      AcurrentPage: 1, // 初始页
      Apagesize: 10,
      ArowCount: 0,
      alarmTypeTableDatas: [],
      alarmTypeEditData: {},

      ruleForm: {
        input3: "", // 参数名
        input4: "", // 参数类型
        input7: "", // 读写属性
        input8: "" // 显示顺序
      },
      rules: {
        input3: [
          { required: true, message: "参数名不能为空", trigger: "change" }
        ],
        input4: [
          { required: true, message: "参数类型不能为空", trigger: "change" }
        ],
        input7: [
          { required: true, message: "读写属性不能为空", trigger: "change" }
        ],
        input8: [
          { required: true, message: "显示顺序不能为空", trigger: "change" }
        ]
      },
      rules1: {
        alarmTypeName: [ { required: true, message: "类型名不能为空", trigger: "change" }],
        alarmTypeLevel: [ { required: true, message: "报警级别不能为空", trigger: "change" }],
        alarmTypeSrc: [ { required: true, message: "类型描述不能为空", trigger: "change" }]
      },
      VcurrentPage: 1, // 初始页
      VpageSize: 10,
      VrowCount: 0,
      vars: [], // 选择变量数组
      deviceId: "",
      deviceTypeId: "",
      deviceName: "", // 设备名
      deviceTypeTreePath:'', // 已配置类型路径
      deviceType: "", // 设备类型
      input1: "", // 设备属性
      input2: "", // 属性组件
      input5: "", // 单位
      input6: "", // 显示阀值
      input9: "", // 寄存器
      input10: "", // 初始值
      input11: "每5分钟存储", // 存储周期
      input12: "", // 历史记录
      input13: "", // 能耗记录
      input14: "", // 显示公式
      regColor: "#FFF", // 显示颜色
      input20: "", // 是否报警
      alarmForm: [],

      addDialogFormVisible: false, //控制新增变量弹窗
      updateDialogFormVisible: false, //控制修改变量弹窗
      DeviceType: [
        {
          id: 1,
          value: "运行状态"
        },
        {
          id: 2,
          value: "运行报警"
        },
        {
          id: 3,
          value: "设备故障"
        }
      ], // 设备属性select
      Component: [], // 属性组件select
      paramType: [
        {
          id: 1,
          value: "离散型"
        },
        {
          id: 2,
          value: "长整型"
        },
        {
          id: 3,
          value: "模拟型"
        },
        {
          id: 4,
          value: "字符型"
        },
        {
          id: 5,
          value: "浮点型"
        }
      ], // 参数类别select
      showFZ: [], // 显示阀值
      ReadAndWrite: [
        {
          id: 1,
          value: "只读"
        },
        {
          id: 2,
          value: "读写"
        }
      ], // 读写属性
      saveTime: [
        {
          id: 5,
          value: "每5分钟存储"
        },
        {
          id: 10,
          value: "每10分钟存储"
        },
        {
          id: 30,
          value: "每30分钟存储"
        },
        {
          id: 60,
          value: "每60分钟存储"
        }
      ], // 存储周期
      historyRecord: [
        {
          id: 1,
          value: "历史记录"
        }
      ], // 历史记录
      energyRecord: [
        {
          id: 1,
          value: "能耗记录"
        }
      ], // 能耗记录
      // register: [], // 寄存器
      isAlarm: [
        {
          id: 1,
          value: "报警"
        }
      ], // 是否报警
      alarmLevel: [], // 报警级别
      alarmType: [
        {
          id: 1,
          value: "报警"
        },
        {
          id: 2,
          value: "故障"
        }
      ], // 报警类别
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
      tableDatas: [],
      editData: "",
      deviceTypeTree: [], // 设备类型树图数据
      deviceTree: [], // 设备树形图
      regTreeData: [], // 变量树形图
      deviceTypeProps: {
        children: "drtypeinfoList",
        label: "drtypename"
      },
      deviceProps: {
        label: "drname"
      },
      regProps: {
        label: "regName"
      },
      mathVisible: false, // 公式弹窗
      mathConstant: "", // 公式常量系数
      mathContent: "", // 公式内容
      regVisible: false
    };
  },
  created () {
    // 查询所有报警类型
    this.findAllAlarm(this.path, this.AcurrentPage, this.Apagesize);

    // 查询所有设备类型
    findDeviceType(this.path)
      .then(res => {
        this.deviceTypeTree = res.data;
      })
      .catch(console.log);
    // 查询所有属性组件
    findComponent(this.path)
      .then(res => {
        this.Component = res.data;
      })
      .catch(console.log);
    // 查询所有寄存器
    // findQstag(this.path)
    //   .then(res => {
    //     this.register = res.data;
    //   })
    //   .catch(console.log);
    // 查询所有阀值
    findSub(this.path)
      .then(res => {
        this.showFZ = res.data;
      })
      .catch(console.log);
    // 查询所有报警类别
    findAlarmType(this.path)
      .then(res => {
        this.alarmLevel = res.data;
      })
      .catch(console.log);
    // 查询所有变量
    this.findAllVar(
      this.path,
      this.VcurrentPage,
      this.VpageSize,
      this.deviceId
    );
  },
  methods: {
    // 查询所有报警类型
    findAllAlarm (path, AcurrentPage, Apagesize) {
      findAlarm(path, AcurrentPage, Apagesize)
        .then(res => {
          this.ArowCount = res.data.rowCount;
          this.alarmTypeTableDatas = res.data.records;
        })
        .catch(console.log);
    },
    // 改变显示页数
    handleSizeChange (size) {
      if (this.activeName == 0) {
        this.Apagesize = size;
        this.AcurrentPage = 1;
        this.findAllAlarm(this.path, this.AcurrentPage, this.Apagesize);
      } else {
        this.VpageSize = size;
        this.VcurrentPage = 1;
        this.findAllVar(
          this.path,
          this.VcurrentPage,
          this.VpageSize,
          this.deviceId
        );
      }
    },
    // 跳页
    handleCurrentChange (AcurrentPage) {
      if (this.activeName == 0) {
        this.AcurrentPage = AcurrentPage;
        if (this.tableDatas.length < this.ArowCount) {
          this.findAllAlarm(this.path, this.AcurrentPage, this.Apagesize);
        }
      } else {
        this.VcurrentPage = AcurrentPage;
        if (this.tableDatas.length < this.VrowCount) {
          this.findAllVar(
            this.path,
            this.VcurrentPage,
            this.VpageSize,
            this.deviceId
          );
        }
      }
    },
    // 上一页
    prev () {
      if (this.activeName == 0) {
        if (this.AcurrentPage === 1) {
          this.AcurrentPage = 1;
        } else {
          this.AcurrentPage--;
          if (this.tableDatas.length < this.ArowCount) {
            this.findAllAlarm(this.path, this.AcurrentPage, this.Apagesize);
          }
        }
      } else {
        if (this.VcurrentPage === 1) {
          this.VcurrentPage = 1;
        } else {
          this.VcurrentPage--;
          if (this.tableDatas.length < this.VrowCount) {
            this.findAllVar(
              this.path,
              this.VcurrentPage,
              this.VpageSize,
              this.deviceId
            );
          }
        }
      }
    },
    // 下一页
    next () {
      if (this.activeName == 0) {
        let maxPage = Math.ceil(this.ArowCount / this.Apagesize);
        if (this.AcurrentPage < maxPage) {
          this.AcurrentPage++;
          if (this.tableDatas.length < this.ArowCount) {
            this.findAllAlarm(this.path, this.AcurrentPage, this.Apagesize);
          }
        }
      } else {
        let maxPage = Math.ceil(this.VrowCount / this.VpageSize);
        if (this.VcurrentPage < maxPage) {
          this.VcurrentPage++;
          if (this.tableDatas.length < this.VrowCount) {
            this.findAllVar(
              this.path,
              this.VcurrentPage,
              this.VpageSize,
              this.deviceId
            );
          }
        }
      }
    },
    // 增加
    addAlarm () {
      this.$refs.alarmTypeForm.validate((valid) => {
        if (valid){
          var formData = new FormData();
          formData.append("alarmtypename", this.alarmTypeForm.alarmTypeName);
          formData.append("alarmtypelevel", this.alarmTypeForm.alarmTypeLevel);
          formData.append("alarmtypeExpain", this.alarmTypeForm.alarmTypeSrc);
          addAlarm(this.path, formData)
            .then(res => {
              if (res.status === 20000) {
                this.$message.success("新增成功!");
                this.reload();
              }
            })
            .catch(console.log);
        }
      })
    },
    // 编辑
    editAlarm (index, row) {
      this.alarmTypeEditData = row;
      this.alarmTypeForm.alarmTypeName = row.alarmtypename;
      this.alarmTypeForm.alarmTypeLevel = row.alarmtypelevel;
      this.alarmTypeForm.alarmTypeSrc = row.alarmtypeExpain;
    },
    // 修改
    updateAlarm () {
      var formData = new FormData();
      formData.append("id", this.alarmTypeEditData.id);
      formData.append("alarmtypename", this.alarmTypeForm.alarmTypeName);
      formData.append("alarmtypelevel", this.alarmTypeForm.alarmTypeLevel);
      formData.append("alarmtypeExpain", this.alarmTypeForm.alarmTypeSrc);
      updateAlarm(this.path, formData)
        .then(res => {
          if (res.status === 20000) {
            this.$message.success("修改成功!");
            this.reload();
          }
        })
        .catch(console.log);
    },

    // 删除
    deleteAlarm (index, row) {
      let tip = confirm("确定要删除该报警类型吗？");
      if (tip) {
        deleteAlarm(this.path, row.id)
          .then(res => {
            if (res.status === 20000) {
              this.$message.success("删除成功!");
              this.reload();
            }
          })
          .catch(console.log);
      }
    },
    // 选择报警类型
    selectAlarmType (val) {
      this.alarmTypes = val;
    },
    deleteAlarms () {
      let tip = confirm("确定要批量删除报警类型吗？");
      if (tip) {
        let id = [];
        this.alarmTypes.forEach(ele => {
          ids.push(ele.id);
        });
        deleteAlarm(this.path, ids.join(","))
          .then(res => {
            if (res.status === 20000) {
              this.$message.success("批量删除成功!");
              this.reload();
            }
          })
          .catch(console.log);
      }
    },

    // 查询所有变量
    findAllVar (path, VcurrentPage, VpageSize, id) {
      findVar(path, VcurrentPage, VpageSize, id)
        .then(res => {
          this.VrowCount = res.data.rowCount;
          this.tableDatas = res.data.records;
          this.tableDatas.forEach(ele => {
            ele.regType = idToVal(ele.regType, this.paramType);
            ele.tagTime = idToVal(ele.tagTime, this.saveTime);
            ele.ishistory = idToVal(ele.ishistory, this.historyRecord);
            ele.isenergy = idToVal(ele.isenergy, this.energyRecord);
            ele.isalarm = idToVal(ele.isalarm, this.isAlarm);
          });
        })
        .catch(console.log);
    },
    // 选择设备类型查询设备名
    selectDeviceType (data) {
      if (data.drtypeinfoList.length === 0) {
        this.deviceTypeId = data.drtypeid;
        this.deviceType = data.drtypename;
        findDevice(this.path, data.drtypeid)
          .then(res => {
            this.deviceTree = res.data;
            this.deviceTypeTreePath = res.data2
          })
          .catch(console.log);
      }
    },
    // 选择设备名
    selectDevice (data) {
      this.deviceName = data.drname;
      this.deviceId = data.drid;
      this.findAllVar(
        this.path,
        this.VcurrentPage,
        this.VpageSize,
        this.deviceId
      );
      if (this.regVisible) {
        findAllReg(this.path, data.drid)
          .then(res => {
            this.regTreeData = res.data;
          })
          .catch(console.log);
      }
    },
    // 选择变量
    selectReg (data) {
      this.mathContent += "@" + data.regId + "@";
      this.regVisible = false;
    },
    // 增加类型模板
    handelAdd () {
      if (this.deviceName === "") {
        this.$message.error("增加模板前必须先选择设备！");
      } else {
        this.addDialogFormVisible = true;
      }
    },
    // 新建报警表单
    createAlarmForm () {
      this.alarmForm.push({
        alarmLevel: "", // 报警级别
        alarmtype: "", // 报警类别
        valueMin: "", // 报警条件低
        valueMax: "", // 报警条件高
        andOr: "", // 条件与或
        alarmexplain: "" // 报警描述
      });
    },
    // 移除报警表单
    removeAlarmForm () {
      if (this.alarmForm.length > 0) {
        this.alarmForm.pop();
      }
    },
    // 编辑公式
    editMath () {
      this.mathVisible = true;
      this.mathContent = this.editData.regmath;
    },
    // 添加参数
    addMath (state) {
      switch (state) {
        case 1:
          // 变量
          break;
        case 2:
          // 常量
          this.mathContent += this.mathConstant;
          break;
        case 3:
          // +
          this.mathContent += "+";
          break;
        case 4:
          // -
          this.mathContent += "-";
          break;
        case 5:
          // ×
          this.mathContent += "*";
          break;
        case 6:
          // ÷
          this.mathContent += "/";
          break;
        case 7:
          // 左括号
          this.mathContent += "(";
          break;
        case 8:
          // 右括号
          this.mathContent += ")";
          break;
        case 9:
          // 逻辑与
          this.mathContent += "&&";
          break;
        case 10:
          // 逻辑或
          this.mathContent += "||";
          break;
        case 11:
          // 小于号
          this.mathContent += "<";
          break;
        case 12:
          // 大于号
          this.mathContent += ">";
          break;
        case 10:
          // 等于号
          this.mathContent += "=";
          break;
        default:
          this.$message.error("没有该变量或符号");
          break;
      }
    },
    // 编辑公式完成
    finishMath () {
      this.mathVisible = false;
      if (this.editData) {
        this.editData.regmath = this.mathContent;
      } else {
        this.input14 = this.mathContent;
      }
    },
    // 确认增加
    addTrue () {
      this.$refs.ruleForm.validate(valid => {
        if (valid) {
          var formData = new FormData();
          formData.append("drId", this.deviceId); // 设备id
          formData.append("drtypeid", this.deviceTypeId); // 设备类型id
          formData.append("regDrShowType", this.input1); // 设备属性
          formData.append("regName", this.ruleForm.input3); // 参数名
          formData.append("regType", this.ruleForm.input4); // 参数类型
          formData.append("regUnits", this.input5); // 单位
          formData.append("regSub", this.input6); // 显示阀值
          formData.append("regReadWrite", this.ruleForm.input7); // 读写属性
          formData.append("regListShowLevel", this.ruleForm.input8); // 显示顺序
          formData.append("tagName", this.input9); // 寄存器
          formData.append("tagValue", this.input10); // 初始值
          formData.append("tagTime", valToId(this.input11, this.saveTime)); // 存储周期
          formData.append("ishistory", this.input12); // 历史记录
          formData.append("isenergy", this.input13); // 能耗记录
          formData.append("regmath", this.input14); // 显示公式
          formData.append("regcolor", this.regColor); // 显示颜色
          formData.append("isalarm", this.input20); // 是否报警
          formData.append("regalarminfo", JSON.stringify(this.alarmForm)); // 报警信息列表
          addVar(this.path, formData)
            .then(res => {
              if (res.status === 20000) {
                this.$message.success("新增成功!");
                this.findAllVar(
                  this.path,
                  this.VcurrentPage,
                  this.VpageSize,
                  this.deviceId
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
    // 修改类型模板
    handelEdit (index, row) {
      this.updateDialogFormVisible = true;
      this.editData = row;
      this.showFZ.forEach(ele => {
        if (ele.subid == this.editData.regSub) {
          this.editData.regSub = ele.subname;
        }
      });
      this.editData.regDrShowType = idToVal(
        this.editData.regDrShowType,
        this.DeviceType
      );
      this.editData.regReadWrite = idToVal(
        this.editData.regReadWrite,
        this.ReadAndWrite
      );
      if (this.editData.isalarm == "报警") {
        this.showAlarm = true;
      }
      this.alarmForm = this.editData.regalarminfoslist;
      this.alarmForm.forEach(ele => {
        //ele.alarmLevel = parseInt(ele.alarmLevel);
        ele.alarmtype = parseInt(ele.alarmtype);
        ele.andOr = parseInt(ele.andOr);
      });
    },
    // 确认修改
    updateTrue () {
      var formData = new FormData();
      this.input6 = this.editData.regSub;
      formData.append("regId", this.editData.regId);
      formData.append("drId", this.editData.drId);
      formData.append("drtypeid", this.deviceTypeId); // 设备类型id
      formData.append(
        "regDrShowType",
        valToId(this.editData.regDrShowType, this.DeviceType)
      );
      formData.append("regName", nullToStr(this.editData.regName));
      formData.append(
        "regType",
        valToId(this.editData.regType, this.paramType)
      );
      formData.append("regUnits", nullToStr(this.editData.regUnits));
      this.showFZ.forEach(ele => {
        if (ele.subname === this.editData.regSub) {
          this.editData.regSub = ele.subid;
        }
      });
      formData.append("regSub", nullToStr(this.editData.regSub));
      formData.append(
        "regReadWrite",
        valToId(this.editData.regReadWrite, this.ReadAndWrite)
      );
      formData.append(
        "regListShowLevel",
        nullToStr(this.editData.regListShowLevel)
      );
      formData.append("tagValue", nullToStr(this.editData.tagValue));
      formData.append("tagTime", valToId(this.editData.tagTime, this.saveTime));
      formData.append(
        "ishistory",
        valToId(this.editData.ishistory, this.historyRecord)
      );
      formData.append(
        "isenergy",
        valToId(this.editData.isenergy, this.energyRecord)
      );
      formData.append("tagName", nullToStr(this.editData.tagName));
      formData.append("isalarm", valToId(this.editData.isalarm, this.isAlarm));
      formData.append("regalarminfo", JSON.stringify(this.alarmForm)); // 报警信息列表
      formData.append("regmath", this.editData.regmath);
      formData.append("regcolor", this.editData.regcolor);
      updateVar(this.path, formData)
        .then(res => {
          if (res.status === 20000) {
            this.$message.success("修改成功!");
            this.findAllVar(
              this.path,
              this.VcurrentPage,
              this.VpageSize,
              this.deviceId
            );
            this.updateDialogFormVisible = false;
          }
        })
        .catch(console.log);
    },

    // 在编辑页面中新增
    addVarInUpdate () {
      var formData = new FormData();
      this.input6 = this.editData.regSub;
      formData.append("drId", this.editData.drId);
      formData.append("drtypeid", this.deviceTypeId); // 设备类型id
      formData.append(
        "regDrShowType",
        valToId(this.editData.regDrShowType, this.DeviceType)
      );
      //formData.append("regSub", this.editData.regSub);
      formData.append("regName", nullToStr(this.editData.regName));
      formData.append(
        "regType",
        valToId(this.editData.regType, this.paramType)
      );
      formData.append("regUnits", nullToStr(this.editData.regUnits));
      this.showFZ.forEach(ele => {
        if (ele.subname === this.editData.regSub) {
          this.editData.regSub = ele.subid;
        }
      });
      formData.append("regSub", nullToStr(this.editData.regSub));
      formData.append(
        "regReadWrite",
        valToId(this.editData.regReadWrite, this.ReadAndWrite)
      );
      formData.append(
        "regListShowLevel",
        nullToStr(this.editData.regListShowLevel)
      );
      formData.append("tagValue", nullToStr(this.editData.tagValue));
      formData.append("tagTime", valToId(this.editData.tagTime, this.saveTime));
      formData.append(
        "ishistory",
        valToId(this.editData.ishistory, this.historyRecord)
      );
      formData.append(
        "isenergy",
        valToId(this.editData.isenergy, this.energyRecord)
      );
      formData.append("tagName", nullToStr(this.editData.tagName));
      formData.append("isalarm", valToId(this.editData.isalarm, this.isAlarm));
      formData.append("regalarminfo", JSON.stringify(this.alarmForm)); // 报警信息列表
      formData.append("regmath", this.editData.regmath);
      formData.append("regcolor", this.editData.regcolor);
      addVar(this.path, formData)
        .then(res => {
          if (res.status === 20000) {
            this.$message.success("新增成功!");
            this.findAllVar(
              this.path,
              this.VcurrentPage,
              this.VpageSize,
              this.deviceId
            );
            this.updateDialogFormVisible = false;
          }
        })
        .catch(console.log);
    },

    // 删除变量
    handelDelete (index, row) {
      let tip = confirm("确定要删除该变量吗？");
      if (tip) {
        deleteVar(this.path, row.regId)
          .then(res => {
            if (res.status === 20000) {
              this.$message.success("删除成功!");
              this.findAllVar(
                this.path,
                this.VcurrentPage,
                this.VpageSize,
                this.deviceId
              );
            }
          })
          .catch(console.log);
      }
    },

    // 选择变量
    selectVars (val) {
      this.vars = val;
    },
    // 批量删除变量
    handelDeletes () {
      let tip = confirm("确定要批量删除变量吗？");
      if (tip) {
        let ids = [];
        this.vars.forEach(ele => {
          ids.push(ele.regId);
        });
        deleteVar(this.path, ids.join(","))
          .then(res => {
            if (res.status === 20000) {
              this.$message.success("删除成功!");
              this.findAllVar(
                this.path,
                this.VcurrentPage,
                this.VpageSize,
                this.deviceId
              );
            }
          })
          .catch(console.log);
      }
    },

    // 导入变量
    uploadFile (file) {
      var formData = new FormData();
      formData.append("file", file);
      const loading = this.$loading({
        lock: true,
        text: "数据正在导入数据库，请稍等",
        spinner: "el-icon-loading",
        background: "rgba(0, 0, 0, 0.7)"
      });
      inputExcel(this.path, formData)
        .then(res => {
          if (res.status === 20000) {
            loading.close();
            this.$message.success("成功导入数据库!");
            this.reload();
          }
        })
        .catch(() => {
          loading.close();
        });
    },
    // 导出寄存器模板
    exportVarModel () {
      outputVarModel(this.path)
        .then(res => {
          let date = formatDate(new Date());
          const filename = "变量寄存器模板" + date + ".xls";
          exportExcel(res, filename);
        })
        .catch(console.log);
    },
    // 导出变量
    exportVar () {
      outputExcel(this.path, this.deviceTypeId)
        .then(res => {
          let date = formatDate(new Date());
          const filename = "变量管理" + date + ".xls";
          exportExcel(res, filename);
        })
        .catch(console.log);
    },
    // 导出报警信息
    exportAlarm () {
      outputAlarmExcel(this.path)
        .then(res => {
          let date = formatDate(new Date());
          const filename = "变量报警信息" + date + ".xls";
          exportExcel(res, filename);
        })
        .catch(console.log);
    },
    // 导入变量报警信息
    uploadAlarmFile (file) {
      var formData = new FormData();
      formData.append("file", file);
      const loading = this.$loading({
        lock: true,
        text: "数据正在导入数据库，请稍等",
        spinner: "el-icon-loading",
        background: "rgba(0, 0, 0, 0.7)"
      });
      inputAlarmExcel(this.path, formData)
        .then(res => {
          if (res.status === 20000) {
            loading.close();
            this.$message.success("成功导入数据库!");
            this.reload();
          }
        })
        .catch(() => {
          loading.close();
        });
    }
  }
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
.el-table ::-webkit-scrollbar{
  display: inline !important;
}
.app-container {
  .alarmtype-manage {
    .el-col {
      border-radius: 4px;
    }
    .bg-purple {
      position: relative;
      padding: 20px;
      background: var(--theme-color);

      .demo-ruleForm {
        .el-form-item {
          display: flex;
          .el-input,
          .el-textarea {
            width: 200px;
          }
        }
      }
      p {
        margin-bottom: 20px;
        font-size: 18px;
        font-weight: bold;
      }
      .buiding-btn {
        position: absolute;
        top: 10px;
        right: 10px;
      }
    }
    .bg-purple-light {
      padding: 20px;
      background: var(--theme-color);
      .alarm-btn {
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
  .variable-manage {
    .treeTitle{
      display: flex;
      text-align: center;
      justify-content: space-between;
      margin-top: 5px;
    }
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
        margin-bottom: 20px;
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

    .alarm-info {
      padding: 20px 20px 0;
      .el-form-item {
        display: flex;
        align-items: center;
        padding-right: 10px;
        margin: 0;
        width: 25%;
        .el-input {
          width: 150px;
        }
        .el-select {
          width: 150px;
        }
      }

      .control-alarm {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin: 0 15px 20px 0;
      }
      .alarmflex {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        margin-bottom: 20px;
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
        display: flex;
        justify-content: space-between;
        margin-top: 20px;
        padding: 10px;
        width: 100%;
        background: #fff;
        max-height: 700px;
        overflow-y: auto;
        .tree-device-type {
          padding-right: 15px;
          border-right: 1px solid lightgrey;
        }
      }

      p {
        font-size: 18px;
        font-weight: bold;
      }
      .type-relation {
        margin-top: 30px;
      }
    }
    .bg-purple-light {
      padding: 20px;
      background: var(--theme-color);
      .type-list {
        display: flex;
        align-items: center;
        justify-content: space-between;
        //margin-bottom: 20px;
        .btn-left {
          display: flex;
          flex-wrap: wrap;
          // justify-content: space-between;
          //width: 900px;
          .el-button {
            margin-left: 10px;
            margin-bottom: 10px;
          }
          .upload {
            margin-left: 10px;
          }
          p {
            font-size: 18px;
            font-weight: bold;
            line-height: 30px;
          }
        }
      }
      .btn-right {
        //width: 200px;
        margin-right: 20px;
        display: flex;
        align-items: center;
        justify-content: flex-end;
        margin-bottom: 20px;
      }
      .el-pagination {
        display: flex;
        justify-content: center;
        margin-top: 10px;
        text-align: center;
        .btn {
          margin-top: 10px;
          padding: 2px 5px;
        }
      }
    }
    .el-dialog {
      .update-var {
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
<style lang="scss">
.math-dispose {
  .math-chooses {
    display: flex;
    flex-wrap: wrap;
    margin-bottom: 30px;

    .el-input {
      margin: 0 20px;
      width: 100px;
    }
  }
}
.reg-chooses {
  display: flex;
  justify-content: space-between;
}
</style>


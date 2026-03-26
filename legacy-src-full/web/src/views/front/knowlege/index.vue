<template>
  <div class="legacy-front-page knowlege-page front-box-show">
    <div class="legacy-front-page__hero">
      <div>
        <div class="legacy-front-page__eyebrow">Knowledge</div>
        <h1 class="legacy-front-page__title">{{ $t('knowlege.instructionsInformation') }}</h1>
        <div class="legacy-front-page__meta">统一管理说明书、类型和下载入口，减少重复维护成本。</div>
      </div>
      <div class="legacy-front-stat-group">
        <div class="legacy-front-stat">
          <div class="legacy-front-stat__label">Documents</div>
          <div class="legacy-front-stat__value">{{ rowCount }}</div>
        </div>
        <div class="legacy-front-stat">
          <div class="legacy-front-stat__label">Types</div>
          <div class="legacy-front-stat__value">{{ deviceTypeData.length }}</div>
        </div>
      </div>
    </div>

    <section class="legacy-front-table-card knowledge-card">
      <div class="legacy-front-table-card__head knowledge-card__head">
        <div class="legacy-front-toolbar__title">
          <strong>{{ $t('knowlege.instructionsInformation') }}</strong>
          <span>按名称、类型和描述统一维护</span>
        </div>
        <el-button type="primary" @click="addVisible = true">
          <i class="al_element-icons2 al_icon2jia knowledge-card__button-icon"></i>
          {{ $t('knowlege.newlyAdded') }}
        </el-button>
      </div>

      <el-table
        :data="tableDatas"
        class="knowledge-table"
        max-height="620px"
      >
        <af-table-column :label="$t('knowlege.name')" class-name="front-column" prop="instructionsName" />
        <af-table-column :label="$t('knowlege.typesOf')" prop="drtypename" />
        <af-table-column :label="$t('knowlege.describe')" prop="instructionsExplain" />
        <el-table-column :label="$t('alertrun_bill.operate')" fixed="right" width="300">
          <template slot-scope="scope">
            <el-button size="mini" type="primary" @click="handleView(scope.$index, scope.row)">
              {{ $t('knowlege.view') }}
            </el-button>
            <el-button size="mini" type="warning" @click="handleDownload(scope.$index, scope.row)">
              {{ $t('knowlege.download') }}
            </el-button>
            <el-button size="mini" type="success" @click="handleEdit(scope.$index, scope.row)">
              {{ $t('alertrun_bill.edit') }}
            </el-button>
            <el-button size="mini" type="danger" @click="handleDelete(scope.$index, scope.row)">
              {{ $t('alertrun_bill.delete') }}
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="legacy-front-pagination">
        <el-pagination
          class="pagelist"
          :current-page="currentPage"
          :page-sizes="[10, 20, 30, 50]"
          :page-size="pageSize"
          layout="total, sizes, prev, pager, next, jumper"
          :total="rowCount"
          @size-change="handleSizeChange"
          @current-change="handleCurrentChange"
        />
      </div>
    </section>

    <el-dialog
      :title="$t('knowlege.newlyAddedInstructionManual')"
      :visible.sync="addVisible"
      append-to-body
      class="knowledge-dialog"
      custom-class="legacy-dialog-shell"
      width="560px"
    >
      <el-form class="legacy-dialog-form" label-position="left" label-width="120px">
        <el-form-item :label="$t('knowlege.manualName')">
          <el-input
            v-model="docName"
            :placeholder="$t('knowlege.pleaseManualName')"
            type="text"
          />
        </el-form-item>
        <el-form-item :label="$t('alertrun_realtime.deviceType')">
          <el-select
            v-model="deviceTypeId"
            :placeholder="$t('alertrun_realtime.selectDeviceType')"
          >
            <el-option :label="deviceType" :value="deviceTypeId">
              <el-tree
                ref="tree"
                :data="deviceTypeData"
                :props="defaultProps"
                highlight-current
                node-key="drtypeid"
                @node-click="handleCheck"
              />
            </el-option>
          </el-select>
        </el-form-item>
        <el-form-item :label="$t('knowlege.InstructionManualDescription')">
          <el-input
            v-model="docInfo"
            :placeholder="$t('knowlege.pleaseInstructionManualDescription')"
            :rows="4"
            type="textarea"
          />
        </el-form-item>
        <el-form-item :label="$t('knowlege.manualUpload')">
          <el-upload
            :auto-upload="false"
            :limit="1"
            :on-change="selectFile"
            action
            class="knowledge-upload"
            drag
          >
            <i class="el-icon-upload"></i>
            <div class="el-upload__text">
              将文件拖到此处，或
              <em>{{ $t('knowlege.clickUpload') }}</em>
            </div>
          </el-upload>
        </el-form-item>
      </el-form>
      <span slot="footer" class="dialog-footer">
        <el-button @click="addVisible = false">{{ $t('defaultpage.cancellation') }}</el-button>
        <el-button type="primary" @click="handleAdd">{{ $t('defaultpage.confirm') }}</el-button>
      </span>
    </el-dialog>

    <el-dialog
      :title="$t('knowlege.amendTheDescription')"
      :visible.sync="updateVisible"
      append-to-body
      class="knowledge-dialog"
      custom-class="legacy-dialog-shell"
      width="560px"
    >
      <el-form class="legacy-dialog-form" label-position="left" label-width="120px">
        <el-form-item :label="$t('knowlege.manualName')">
          <el-input
            v-model="editData.instructionsName"
            :placeholder="$t('knowlege.pleaseManualName')"
            type="text"
          />
        </el-form-item>
        <el-form-item :label="$t('alertrun_realtime.deviceType')">
          <el-select
            v-model="editData.instructionsTypeid"
            :placeholder="$t('alertrun_realtime.selectDeviceType')"
          >
            <el-option :label="editData.drtypename" :value="editData.instructionsTypeid">
              <el-tree
                ref="tree"
                :data="deviceTypeData"
                :props="defaultProps"
                highlight-current
                node-key="drtypeid"
                @node-click="handleCheck"
              />
            </el-option>
          </el-select>
        </el-form-item>
        <el-form-item :label="$t('knowlege.InstructionManualDescription')">
          <el-input
            v-model="editData.instructionsExplain"
            :placeholder="$t('knowlege.pleaseInstructionManualDescription')"
            :rows="4"
            type="textarea"
          />
        </el-form-item>
        <el-form-item :label="$t('knowlege.manualUpload')">
          <el-upload
            :auto-upload="false"
            :limit="1"
            :on-change="selectFile"
            action
            class="knowledge-upload"
            drag
          >
            <i class="el-icon-upload"></i>
            <div class="el-upload__text">
              将文件拖到此处，或
              <em>{{ $t('knowlege.clickUpload') }}</em>
            </div>
          </el-upload>
        </el-form-item>
      </el-form>
      <span slot="footer" class="dialog-footer">
        <el-button @click="updateVisible = false">{{ $t('defaultpage.cancellation') }}</el-button>
        <el-button type="primary" @click="updateTrue">{{ $t('defaultpage.confirm') }}</el-button>
      </span>
    </el-dialog>
  </div>
</template>

<script>
import { mapGetters } from "vuex";
import {
  findDoc,
  findDeviceType,
  addDoc,
  updateDoc,
  deleteDoc
} from "@/api/usersetting/deviceoperation/docmanage";

export default {
  inject: ["reload"],
  computed: {
    ...mapGetters(["path"])
  },
  data() {
    return {
      baseUrl: null,
      currentPage: 1,
      pageSize: 10,
      rowCount: 0,
      docName: "",
      file: {},
      docInfo: "",
      tableDatas: [],
      editData: {},
      addVisible: false,
      updateVisible: false,
      deviceTypeData: [],
      deviceTypeId: "",
      deviceType: "",
      defaultProps: {
        children: "drtypeinfoList",
        label: "drtypename"
      }
    };
  },
  created() {
    this.baseUrl = process.env.VUE_APP_BASE_URL;
    this.findDoc(this.path, this.currentPage, this.pageSize);
    findDeviceType(this.path)
      .then(res => {
        this.deviceTypeData = res.data;
      })
      .catch(() => {});
  },
  methods: {
    findDoc(path, currentPage, pageSize) {
      findDoc(path, currentPage, pageSize)
        .then(res => {
          this.rowCount = res.data.rowCount;
          this.tableDatas = res.data.records;
        })
        .catch(() => {});
    },
    handleCheck(obj) {
      this.deviceType = obj.drtypename;
      this.deviceTypeId = obj.drtypeid;
      if (this.editData && this.editData.id) {
        this.editData.instructionsTypeid = obj.drtypeid;
        this.editData.drtypename = obj.drtypename;
      }
    },
    handleSizeChange(size) {
      this.pageSize = size;
      this.currentPage = 1;
      this.findDoc(this.path, this.currentPage, this.pageSize);
    },
    handleCurrentChange(currentPage) {
      this.currentPage = currentPage;
      this.findDoc(this.path, this.currentPage, this.pageSize);
    },
    selectFile(file) {
      this.file = file;
    },
    handleAdd() {
      const formData = new FormData();
      formData.append("instructionsName", this.docName);
      formData.append("instructionsTypeid", this.deviceTypeId);
      if (this.file.raw != undefined) {
        formData.append("file", this.file.raw);
      }
      formData.append("instructionsExplain", this.docInfo);
      addDoc(this.path, formData)
        .then(res => {
          const { msg } = res;
          if (msg == "OK") {
            this.$message.success("新增成功!");
            this.addVisible = false;
            this.file = {};
            this.reload();
          }
        })
        .catch(() => {});
    },
    handleEdit(index, row) {
      this.updateVisible = true;
      this.editData = Object.assign({}, row);
    },
    updateTrue() {
      const formData = new FormData();
      formData.append("id", this.editData.id);
      formData.append("instructionsName", this.editData.instructionsName);
      formData.append("instructionsTypeid", this.editData.instructionsTypeid);
      if (this.file.raw != undefined) {
        formData.append("file", this.file.raw);
      }
      formData.append("instructionsExplain", this.editData.instructionsExplain);
      updateDoc(this.path, formData)
        .then(res => {
          const { msg } = res;
          if (msg == "OK") {
            this.$message.success("修改成功!");
            this.updateVisible = false;
            this.file = {};
            this.reload();
          }
        })
        .catch(() => {});
    },
    handleDelete(index, row) {
      deleteDoc(this.path, row.id)
        .then(res => {
          const { msg } = res;
          if (msg == "OK") {
            this.$message.success("删除成功!");
            this.reload();
          }
        })
        .catch(() => {});
    },
    handleView(index, row) {
      window.open(this.baseUrl + row.filepath, "_blank");
    },
    handleDownload(index, row) {
      window.location.href = this.baseUrl + row.filepath;
    }
  }
};
</script>

<style lang="scss" scoped>
.knowlege-page {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.knowledge-card__head {
  margin-bottom: 18px;
}

.knowledge-card__button-icon {
  margin-right: 6px;
  font-size: 15px;
}

.knowledge-table {
  border-radius: 18px;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.02);
}

.knowledge-table ::v-deep .el-table__header-wrapper th,
.knowledge-table ::v-deep .el-table__fixed-header-wrapper th {
  background: rgba(255, 255, 255, 0.04) !important;
  color: rgba(244, 250, 255, 0.96);
  border-bottom-color: rgba(132, 187, 255, 0.12);
}

.knowledge-table ::v-deep .el-table__body-wrapper td,
.knowledge-table ::v-deep .el-table__fixed-body-wrapper td {
  background: rgba(255, 255, 255, 0.01) !important;
  border-bottom-color: rgba(132, 187, 255, 0.08);
}

.knowledge-table ::v-deep .el-button {
  margin: 4px 6px 4px 0;
}

.knowledge-dialog ::v-deep .el-dialog {
  background: linear-gradient(180deg, rgba(10, 24, 39, 0.98) 0%, rgba(6, 16, 28, 0.98) 100%);
  border: 1px solid rgba(132, 187, 255, 0.14);
  border-radius: 22px;
  overflow: hidden;
}

.knowledge-dialog ::v-deep .el-dialog__title {
  color: rgba(244, 250, 255, 0.98);
}

.knowledge-dialog ::v-deep .el-dialog__body {
  padding-top: 12px;
}

.knowledge-dialog ::v-deep .el-form {
  display: grid;
  gap: 14px;
}

.knowledge-dialog ::v-deep .el-form-item {
  margin: 0;
}

.knowledge-dialog ::v-deep .el-input,
.knowledge-dialog ::v-deep .el-select,
.knowledge-dialog ::v-deep .el-textarea {
  width: 100%;
}

.knowledge-upload {
  width: 100%;
}

.knowledge-upload ::v-deep .el-upload,
.knowledge-upload ::v-deep .el-upload-dragger {
  width: 100%;
}

@media (max-width: 768px) {
  .knowledge-card__head {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>

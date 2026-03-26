<template>
  <div class="legacy-front-page device-information-page front-box-show">
    <div class="legacy-front-page__hero">
      <div>
        <div class="legacy-front-page__eyebrow">Device Info</div>
        <h1 class="legacy-front-page__title">设备信息配置</h1>
        <div class="legacy-front-page__meta">维护设备类型、状态图和点位配置，统一进入工作台处理。</div>
      </div>
      <div class="legacy-front-stat-group">
        <div class="legacy-front-stat">
          <div class="legacy-front-stat__label">Type</div>
          <div class="legacy-front-stat__value">{{ formInline.drTypeId || '未选择' }}</div>
        </div>
        <div class="legacy-front-stat">
          <div class="legacy-front-stat__label">Device</div>
          <div class="legacy-front-stat__value">{{ formInline.drId || '未选择' }}</div>
        </div>
        <div class="legacy-front-stat">
          <div class="legacy-front-stat__label">Load</div>
          <div class="legacy-front-stat__value">{{ formInline.load || '未选择' }}</div>
        </div>
      </div>
    </div>

    <div class="legacy-front-grid legacy-front-grid--two device-workbench">
      <section class="legacy-front-card device-panel">
        <div class="legacy-front-section-title">
          <strong>设备选择</strong>
          <span>类型、设备与状态图统一维护</span>
        </div>

        <el-form
          ref="forminline"
          :model="formInline"
          class="device-toolbar"
        >
          <el-form-item label="设备类型：">
            <el-cascader
              v-model="formInline.drTypeId"
              :options="deviceTypeData"
              :props="{
                emitPath: false,
                expandTrigger: 'hover',
                label: 'drtypenameCNEN',
                value: 'drtypeid',
                children: 'drtypeinfoList',
              }"
              :show-all-levels="false"
              placeholder="请选择设备类型"
            />
          </el-form-item>
          <el-form-item label="设备名称：">
            <el-select
              v-model="formInline.drId"
              placeholder="请选择"
              @change="handlechange"
            >
              <el-option
                v-for="item in options"
                :key="item.value"
                :label="item.label"
                :value="item.value"
              />
            </el-select>
          </el-form-item>
        </el-form>

        <div class="device-summary">
          <span class="legacy-front-chip">类型：{{ formInline.drTypeId || '未选择' }}</span>
          <span class="legacy-front-chip">设备：{{ formInline.drId || '未选择' }}</span>
        </div>

        <div class="device-upload-grid">
          <div class="device-upload-item">
            <div class="device-upload-item__head">
              <span>运行图</span>
              <span class="device-upload-item__hint">运行态</span>
            </div>
            <MyImgUpload class="upload-logo-img" @upload="uploadImgRun" />
          </div>
          <div class="device-upload-item">
            <div class="device-upload-item__head">
              <span>停止图</span>
              <span class="device-upload-item__hint">停止态</span>
            </div>
            <MyImgUpload class="upload-logo-img" @upload="uploadImgStop" />
          </div>
          <div class="device-upload-item">
            <div class="device-upload-item__head">
              <span>运行中报警</span>
              <span class="device-upload-item__hint">告警态</span>
            </div>
            <MyImgUpload class="upload-logo-img" @upload="uploadImgRunAlarm" />
          </div>
          <div class="device-upload-item">
            <div class="device-upload-item__head">
              <span>停止中报警</span>
              <span class="device-upload-item__hint">告警态</span>
            </div>
            <MyImgUpload class="upload-logo-img" @upload="uploadImgStopAlarm" />
          </div>
        </div>
      </section>

      <section class="legacy-front-card device-panel device-panel--detail">
        <div class="legacy-front-section-title">
          <strong>点位配置</strong>
          <span>机组电流比与变量映射</span>
        </div>

        <div class="device-point">
          <span class="device-point__label">机组电流比</span>
          <el-cascader
            :ref="`cascader`"
            v-model="formInline.load"
            class="device-point__select"
            :options="PointPositionData"
            :props="{
              emitPath: false,
              expandTrigger: 'hover',
              label: 'drnameCNEN',
              value: 'drtypeid',
              children: 'reglist',
            }"
            filterable
          />
          <span class="device-point__hint">此选项当设备为主机时使用！</span>
        </div>

        <div class="device-table-panel">
          <tabel
            :drId="formInline.drId"
            :drTypeId="formInline.drTypeId"
            @change="changeForm"
            @modifyLoad="modifyLoad"
          />
        </div>
      </section>
    </div>
  </div>
</template>

<script>
import { findAllDrtypeOfDevice } from "@/api/usersetting/runlog/timealarm";
import { findDevice } from "@/api/contentsetting/varmanage";
import { mapGetters } from "vuex";
import tabel from "./tableBox.vue";
import MyImgUpload from "@/components/MyImgUpload";
import { drInfoSetting } from "@/api/contentsetting/information";
import { findAllByDrTypeId } from "@/api/deviceinformation";

export default {
  name: "index",
  components: {
    tabel,
    MyImgUpload
  },
  data() {
    return {
      PointPositionData: [],
      baseUrl: "",
      formInline: {
        drTypeId: 0,
        drId: 0,
        load: 0
      },
      deviceTypeData: [],
      firstGet: true,
      options: [],
      deviceImg: "",
      run: "",
      stop: "",
      runAlarm: "",
      stopAlarm: ""
    };
  },
  watch: {
    "formInline.drTypeId": {
      handler() {
        this.deviceName();
      },
      deep: true,
      immediate: true
    }
  },
  computed: {
    ...mapGetters(["path"])
  },
  created() {
    findAllByDrTypeId(this.path).then(res => {
      res.data.forEach(data => {
        data.reglist.forEach(data2 => {
          data2.drnameCNEN = data2.regName;
          data2.drtypeid = data2.regId;
        });
      });
      this.PointPositionData = res.data;
    });
    findAllDrtypeOfDevice(this.path).then(res => {
      this.deviceTypeData = res.data || [];

      if (this.drTypeId) {
        this.formInline.drTypeId = this.filterDrtype(Number(this.formInline.drTypeId), this.deviceTypeData);
      }

      if (this.firstGet && this.deviceTypeData.length) {
        this.formInline.drTypeId = this.getFirstType(this.deviceTypeData);
      }
    });
    this.baseUrl = this.global.baseUrl;
  },
  methods: {
    modifyLoad(val) {
      this.formInline.load = val === null || val === undefined ? 0 : val;
    },
    uploadLogoImg(file) {
      this.deviceImg = file;
    },
    uploadImgRun(file) {
      this.run = file;
    },
    uploadImgStop(file) {
      this.stop = file;
    },
    uploadImgRunAlarm(file) {
      this.runAlarm = file;
    },
    uploadImgStopAlarm(file) {
      this.stopAlarm = file;
    },
    changeForm(val) {
      const formData = new FormData();
      formData.append("drTypeId", this.formInline.drTypeId);
      formData.append("data", JSON.stringify(val));
      formData.append("drId", this.formInline.drId);
      formData.append("load", this.formInline.load);
      formData.append("run", this.run);
      formData.append("stop", this.stop);
      formData.append("runAlarm", this.runAlarm);
      formData.append("stopAlarm", this.stopAlarm);
      this.formInline.data = val;
      drInfoSetting(this.path, formData).then(res => {
        if (res.status === 20000) {
          this.$message.success("成功!");
        }
      });
    },
    handlechange() {},
    deviceName() {
      findDevice(this.path, this.formInline.drTypeId).then(res => {
        this.options = [];
        res.data.forEach(element => {
          element.label = element.drnameCNEN;
          element.value = element.drid;
          this.options.push(element);
        });
        if (this.firstGet && this.options.length) {
          this.formInline.drId = this.options[0].drid;
          this.$emit("change", this.formInline.drId);
        }
      });
    },
    getFirstType(list) {
      if (list[0]["drtypeinfoList"]) {
        return this.getFirstType(list[0]["drtypeinfoList"]);
      }
      return list[0]["drtypeid"];
    },
    filterDrtype(value, list) {
      const parent = Symbol("parent");
      let result;

      function findparent(arr, p) {
        for (let index = 0; index < arr.length; index++) {
          arr[index][parent] = p;
          if (arr[index].drtypeid == value) {
            result = arr[index];
            return;
          }
          !result && arr[index].drtypeinfoList && findparent(arr[index].drtypeinfoList, arr[index]);
        }
      }

      findparent(list, null);
      const temp = [];
      if (!result) return null;
      while (result) {
        temp.unshift(result.drtypeid);
        result = result[parent];
      }
      return temp;
    }
  }
};
</script>

<style lang="scss" scoped>
.device-information-page {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.device-workbench {
  align-items: start;
}

.device-panel {
  min-width: 0;
}

.device-toolbar {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px 16px;
  margin-bottom: 16px;
}

.device-toolbar ::v-deep .el-form-item {
  width: 100%;
  margin: 0 !important;
}

.device-toolbar ::v-deep .el-form-item__content {
  width: 100%;
}

.device-toolbar ::v-deep .el-cascader,
.device-toolbar ::v-deep .el-select {
  width: 100%;
}

.device-summary {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 16px;
}

.device-upload-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

.device-upload-item {
  padding: 16px;
  border-radius: 18px;
  border: 1px solid rgba(132, 187, 255, 0.12);
  background: rgba(255, 255, 255, 0.03);
}

.device-upload-item__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
  color: rgba(234, 243, 250, 0.92);
  font-size: 13px;
  font-weight: 600;
}

.device-upload-item__hint {
  color: var(--shell-text-muted);
  font-size: 12px;
  font-weight: 400;
}

.device-point {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  padding-top: 2px;
}

.device-point__label {
  color: var(--shell-text-muted);
  font-size: 13px;
}

.device-point__select {
  flex: 1 1 260px;
  min-width: 260px;
}

.device-point__hint {
  color: var(--shell-text-muted);
  font-size: 12px;
}

.device-table-panel {
  margin-top: 18px;
}

@media (max-width: 1200px) {
  .device-upload-grid,
  .device-toolbar {
    grid-template-columns: 1fr;
  }
}
</style>

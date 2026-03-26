<template>
  <div class="legacy-front-page params-page">
    <div class="legacy-front-page__hero">
      <div>
        <div class="legacy-front-page__eyebrow">Parameters</div>
        <h1 class="legacy-front-page__title">{{ $t('params.deviceInformationManagement') }}</h1>
        <div class="legacy-front-page__meta">维护峰平谷尖时段和电价，保存后立即生效。</div>
      </div>
      <div class="legacy-front-stat-group">
        <div class="legacy-front-stat">
          <div class="legacy-front-stat__label">Hours</div>
          <div class="legacy-front-stat__value">{{ options.length }}</div>
        </div>
      </div>
    </div>

    <section class="legacy-front-card params-card">
      <div class="legacy-front-section-title params-card__title">
        <strong>{{ $t('params.deviceInformationManagement') }}</strong>
        <span>统一编辑所有电价时段</span>
      </div>

      <el-form
        ref="form"
        :model="form"
        :rules="rules"
        class="params-form"
        label-width="160px"
        label-position="left"
      >
        <el-form-item :label="$t('params.schemeName')" prop="schemeName">
          <el-input v-model="form.schemeName"/>
        </el-form-item>
        <el-form-item :label="$t('params.startTimePeriod')" prop="startPeriod">
          <el-date-picker
            v-model="form.startPeriod"
            :clearable="true"
            :placeholder="$t('params.startTimePeriod')"
            :editable="true"
            prefix-icon="al_element-icons al_icona-huaban1"
            type="date"
          />
        </el-form-item>
        <el-form-item :label="$t('params.endTimePeriod')" prop="endPeriod">
          <el-date-picker
            v-model="form.endPeriod"
            :clearable="true"
            :placeholder="$t('params.endTimePeriod')"
            :editable="true"
            prefix-icon="al_element-icons al_icona-huaban1"
            type="date"
          />
        </el-form-item>
        <el-form-item :label="$t('params.peakTimePeriod')" prop="peakPeriod">
          <el-select
            v-model="form.peakPeriod"
            class="params-form__select"
            multiple
            :placeholder="$t('prompt.pleaseSelect')"
          >
            <el-option
              v-for="item in options"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item :label="$t('params.peakElectricityPrice')" prop="peakPrice">
          <div class="params-form__price">
            <el-input v-model="form.peakPrice"/>
            <span class="params-form__unit">{{ $t('public.rmb') }}/kwh</span>
          </div>
        </el-form-item>
        <el-form-item :label="$t('params.flatTimePeriod')" prop="averagePeriod">
          <el-select
            v-model="form.averagePeriod"
            class="params-form__select"
            multiple
            :placeholder="$t('prompt.pleaseSelect')"
          >
            <el-option
              v-for="item in options"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item :label="$t('params.flatElectricityPrice')" prop="averagePrice">
          <div class="params-form__price">
            <el-input v-model="form.averagePrice"/>
            <span class="params-form__unit">{{ $t('public.rmb') }}/kwh</span>
          </div>
        </el-form-item>
        <el-form-item :label="$t('params.valleyTimePeriod')" prop="valleyPeriod">
          <el-select
            v-model="form.valleyPeriod"
            class="params-form__select"
            multiple
            :placeholder="$t('prompt.pleaseSelect')"
          >
            <el-option
              v-for="item in options"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item :label="$t('params.valleyElectricityPrice')" prop="valleyPrice">
          <div class="params-form__price">
            <el-input v-model="form.valleyPrice"/>
            <span class="params-form__unit">{{ $t('public.rmb') }}/kwh</span>
          </div>
        </el-form-item>
        <el-form-item :label="$t('params.shoulderTimePeriod')" prop="sharpTime">
          <el-select
            v-model="form.sharpTime"
            class="params-form__select"
            multiple
            :placeholder="$t('prompt.pleaseSelect')"
          >
            <el-option
              v-for="item in options"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item :label="$t('params.shoulderElectricityPrice')" prop="sharpPrice">
          <div class="params-form__price">
            <el-input v-model="form.sharpPrice"/>
            <span class="params-form__unit">{{ $t('public.rmb') }}/kwh</span>
          </div>
        </el-form-item>
        <el-form-item class="params-form__actions">
          <el-button v-loading="loading" type="primary" @click="edit">
            {{ $t('params.editElectricityEriceContent') }}
          </el-button>
        </el-form-item>
      </el-form>
    </section>
  </div>
</template>
<script>
import {findAll, update} from '@/api/front/params'
import {getrules} from './form'
import {mapGetters} from 'vuex';

export default {
  data() {
    return {
      form: {
        id: '',
        schemeName: '',
        startPeriod: '',
        endPeriod: '',
        peakPeriod: [],
        peakPrice: '',
        averagePeriod: [],
        averagePrice: '',
        valleyPeriod: [],
        valleyPrice: '',
        sharpTime: [],
        sharpPrice: ''
      },
      rules: getrules(this),
      loading: false,
      options: [
        {
          value: '00:00',
          label: '00:00'
        },
        {
          value: '01:00',
          label: '01:00'
        },
        {
          value: '02:00',
          label: '02:00'
        },
        {
          value: '03:00',
          label: '03:00'
        },
        {
          value: '04:00',
          label: '04:00'
        },
        {
          value: '05:00',
          label: '05:00'
        },
        {
          value: '06:00',
          label: '06:00'
        },
        {
          value: '07:00',
          label: '07:00'
        },
        {
          value: '08:00',
          label: '08:00'
        },
        {
          value: '09:00',
          label: '09:00'
        },
        {
          value: '10:00',
          label: '10:00'
        },
        {
          value: '11:00',
          label: '11:00'
        },
        {
          value: '12:00',
          label: '12:00'
        },
        {
          value: '13:00',
          label: '13:00'
        },
        {
          value: '14:00',
          label: '14:00'
        },
        {
          value: '15:00',
          label: '15:00'
        },
        {
          value: '16:00',
          label: '16:00'
        },
        {
          value: '17:00',
          label: '17:00'
        },
        {
          value: '18:00',
          label: '18:00'
        },
        {
          value: '19:00',
          label: '19:00'
        },
        {
          value: '20:00',
          label: '20:00'
        },
        {
          value: '21:00',
          label: '21:00'
        },
        {
          value: '22:00',
          label: '22:00'
        },
        {
          value: '23:00',
          label: '23:00'
        }
      ]
    }
  },
  computed: {
    ...mapGetters(['path']),
  },
  created() {
    this.initData()
  },
  methods: {
    initData() {
      findAll(this.path).then(res => {
        this.form = this.decodeData(res.data[0])
      })
    },
    formatData(data) {
      return Object.keys(data).reduce((pre, next) => {
        pre[next] = Array.isArray(data[next]) ? data[next].join(',') : data[next]
        return pre
      }, {})
    },
    decodeData(data) {
      data['averagePeriod'] = data['averagePeriod'].split(',')
      data['peakPeriod'] = data['peakPeriod'].split(',')
      data['valleyPeriod'] = data['valleyPeriod'].split(',')
      data['sharpTime'] = data['sharpTime'] ? data['sharpTime'].split(',') : []
      return data
    },
    edit() {
      this.$refs['form'].validate((valid) => {
        if (valid) {
          this.loading = true;

          update(this.path, this.formatData(this.form)).then(res => {
            this.initData()
          }).finally(() => {
            this.loading = false;
          })
        } else {
          return false;
        }
      });

    },
  },
}
</script>
<style lang="scss" scoped>
.params-card {
  max-width: 940px;
}

.params-card__title {
  margin-bottom: 18px;
}

.params-form {
  max-width: 780px;
}

.params-form__select,
.params-form .el-date-editor,
.params-form .el-input {
  width: 100%;
}

.params-form__price {
  display: flex;
  align-items: center;
  gap: 14px;
}

.params-form__unit {
  white-space: nowrap;
  color: var(--shell-text-muted);
}

.params-form__actions {
  margin-top: 4px;
}

::v-deep .params-form .el-form-item__label {
  word-break: keep-all;
}
</style>

<template>
  <el-form-item :label="label" :required="required">
    <el-select
      v-model="currentValue"
      placeholder="请选择"
      @change="handlechange"
      :clearable="!required"
    >
      <el-option
        v-for="item in options"
        :key="item.value"
        :label="item.label"
        :value="item.value"
      >
      </el-option>
    </el-select>
  </el-form-item>
</template>
<script>
import { findDevice } from '@/api/contentsetting/varmanage';
import { mapGetters } from 'vuex'
export default {
  model: {
    prop: 'drId',
    event: 'change'
  },
  computed: {
    ...mapGetters(['path'])
  },
  props: {
    drTypeId: Number | String,
    drId: Number | String,
    label: String,
    firstGet:Boolean,
    required:{
      type:Boolean,
      default:false
    }
  },
  watch: {
    drTypeId: {
      handler (val) {
        if (val) {
          findDevice(this.path, val).then(res => {
            this.options = []
            res.data.forEach(element => {
              // element.label = element.drname;
              element.label = element.drnameCNEN;
              element.value = element.drid
              this.options.push(element)
            });
            if(this.firstGet&&this.options.length){
              this.currentValue = this.options[0].drid;
              this.$emit('change', this.currentValue)
            }
          })
        }
      },
      immediate: true
    },
    drId (newVal) {
      this.currentValue = Number(newVal) || '';
    }
  },
  data () {
    return {
      options: [],
      currentValue: Number(this.drId) || ''
    }
  },
  methods: {
    handlechange () {
      this.$emit('change', this.currentValue)
    }
  },

}
</script>
<style lang="">
</style>
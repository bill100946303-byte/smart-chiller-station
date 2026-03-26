<template>
  <el-form-item :label="label" :required="required">
    <el-select
      v-model="currentValue"
      :clearable="!required"
      placeholder="请选择"
    >
      <el-option
          v-for="item in options"
          :key="item.value"
        :label="item.label"
        :value="item.value"
        @click.native="handlechange(item)"
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
              // this.$emit('change2', {value:this.options[0].drid,label:this.options[0].drname})
              this.$emit('change2', {value:this.options[0].drid,label:this.options[0].drnameCNEN})
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
    handlechange (e) {
      this.$emit('change', this.currentValue)
      console.log('111111',e)
      // this.$emit('change2', {value:e.drid,label:e.drname})
      this.$emit('change2', {value:e.drid,label:e.drnameCNEN})
    }
  },

}
</script>
<style lang="">
</style>
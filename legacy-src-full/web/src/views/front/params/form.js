var checkItem = (item) => {
  return (rule, value, callback) => {
    if (!value) {
      return callback(new Error(`请填写${item}`));
    }
    setTimeout(() => {
      if (/^\d+(\.\d+)?$/.test(value)) {
        callback();
      } else {
        callback(new Error("请输入数字"));
      }
    }, 300);
  };
};

var vm;



const keyvalide = function(key1,key2,key3){
  return  (rule, value, callback) => {
    console.log('valueeee',value,rule)
    if (value&&value.length) {
      let formdata = vm.form;
      let totalarr = [].concat(
        formdata[key1],
        formdata[key2],
        formdata[key3],
      );
      console.log(1,value,totalarr)
      let bool = value.every((item) => !totalarr.includes(item));
      if (!bool) {
        callback("时间段不能重复");
      } else {
        callback();
      }
    }else{
      callback("时段不能为空")
    }
  };
}
export const rules = {
  schemeName: [
    { required: true, message: "方案名称不能为空", trigger: "blur" },
  ],
  startPeriod: [
    { required: true, message: "开始时段不能为空", trigger: "change" },
  ],
  endPeriod: [
    { required: true, message: "结束时段不能为空", trigger: "change" },
  ],
  peakPeriod: [
    {
      required: true,
      trigger: "change",
      validator: keyvalide('averagePeriod','valleyPeriod','sharpTime'),
    },
  ],
  peakPrice: [
    { validator: checkItem("峰值电价"), required: true, trigger: "blur" },
  ],
  averagePeriod: [
    { required: true,trigger: "change",validator: keyvalide('peakPeriod','valleyPeriod','sharpTime'), },
  ],
  averagePrice: [
    { required: true, validator: checkItem("平值电价"), trigger: "change" },
  ],
  valleyPeriod: [
    { required: true, trigger: "change",validator: keyvalide('peakPeriod','averagePeriod','sharpTime'), },
  ],
  valleyPrice: [
    { required: true, validator: checkItem("谷值电价"), trigger: "change" },
  ],
  sharpPrice: [
    { required: true, validator: checkItem("尖值电价"), trigger: "change" },
  ],
  sharpTime: [
    { required: true,trigger: "change", validator: keyvalide('peakPeriod','averagePeriod','valleyPeriod'),  },
  ],
};

export function getrules(vms) {
  console.log("vm", vm);
  vm = vms;
  return rules;
}

let rules = {
    drtypeid: [
        {required: true, message: '设备类型', trigger: 'change' },
      ],
      drid: [
        {required: true, message: '设备', trigger: 'change' },
      ],
      worktime:[{ type: 'date', required: true, message: '请选择派单时间', trigger: 'change' }],
      worklevel:[
        { required: true, message: '请选择工单级别', trigger: 'change' }
      ],
      executeuser:[
        { required: true, message: '请选择接单人', trigger: 'change' }
      ],
      executetime:[{ type: 'date', required: true, message: '请选择工单处理时间', trigger: 'change' }],
      finishtime:[{ type: 'date', required: true, message: '请选择工单完成时间', trigger: 'change' }],
      state:[
        { required: true, message: '请选择工单状态', trigger: 'change' }
      ]
    }
    export default rules
<template>
  <div class="echarts">
    <div class="map-crumb" @click="goChina">
      <span>中国</span>
      <span v-if="region">></span>
      <span>{{ region }}</span>
    </div>
    <div
      id="myEchart"
      ref="myEchart"
      :style="{ height: '100%', width: '100%' }"
      class="myEchart"
    ></div>
  </div>
</template>
<script>
import { mapGetters } from "vuex";
import echarts from "echarts";
import "echarts/map/js/china.js";

const provinceMapLoaders = {
  安徽: () =>
    import(
      /* webpackChunkName: "user-map-provinces" */ "echarts/map/js/province/anhui.js"
    ),
  澳门: () =>
    import(
      /* webpackChunkName: "user-map-provinces" */ "echarts/map/js/province/aomen.js"
    ),
  北京: () =>
    import(
      /* webpackChunkName: "user-map-provinces" */ "echarts/map/js/province/beijing.js"
    ),
  重庆: () =>
    import(
      /* webpackChunkName: "user-map-provinces" */ "echarts/map/js/province/chongqing.js"
    ),
  福建: () =>
    import(
      /* webpackChunkName: "user-map-provinces" */ "echarts/map/js/province/fujian.js"
    ),
  甘肃: () =>
    import(
      /* webpackChunkName: "user-map-provinces" */ "echarts/map/js/province/gansu.js"
    ),
  广东: () =>
    import(
      /* webpackChunkName: "user-map-provinces" */ "echarts/map/js/province/guangdong.js"
    ),
  广西: () =>
    import(
      /* webpackChunkName: "user-map-provinces" */ "echarts/map/js/province/guangxi.js"
    ),
  贵州: () =>
    import(
      /* webpackChunkName: "user-map-provinces" */ "echarts/map/js/province/guizhou.js"
    ),
  海南: () =>
    import(
      /* webpackChunkName: "user-map-provinces" */ "echarts/map/js/province/hainan.js"
    ),
  河北: () =>
    import(
      /* webpackChunkName: "user-map-provinces" */ "echarts/map/js/province/hebei.js"
    ),
  黑龙江: () =>
    import(
      /* webpackChunkName: "user-map-provinces" */ "echarts/map/js/province/heilongjiang.js"
    ),
  河南: () =>
    import(
      /* webpackChunkName: "user-map-provinces" */ "echarts/map/js/province/henan.js"
    ),
  湖北: () =>
    import(
      /* webpackChunkName: "user-map-provinces" */ "echarts/map/js/province/hubei.js"
    ),
  湖南: () =>
    import(
      /* webpackChunkName: "user-map-provinces" */ "echarts/map/js/province/hunan.js"
    ),
  江苏: () =>
    import(
      /* webpackChunkName: "user-map-provinces" */ "echarts/map/js/province/jiangsu.js"
    ),
  江西: () =>
    import(
      /* webpackChunkName: "user-map-provinces" */ "echarts/map/js/province/jiangxi.js"
    ),
  吉林: () =>
    import(
      /* webpackChunkName: "user-map-provinces" */ "echarts/map/js/province/jilin.js"
    ),
  辽宁: () =>
    import(
      /* webpackChunkName: "user-map-provinces" */ "echarts/map/js/province/liaoning.js"
    ),
  内蒙古: () =>
    import(
      /* webpackChunkName: "user-map-provinces" */ "echarts/map/js/province/neimenggu.js"
    ),
  宁夏: () =>
    import(
      /* webpackChunkName: "user-map-provinces" */ "echarts/map/js/province/ningxia.js"
    ),
  青海: () =>
    import(
      /* webpackChunkName: "user-map-provinces" */ "echarts/map/js/province/qinghai.js"
    ),
  山东: () =>
    import(
      /* webpackChunkName: "user-map-provinces" */ "echarts/map/js/province/shandong.js"
    ),
  上海: () =>
    import(
      /* webpackChunkName: "user-map-provinces" */ "echarts/map/js/province/shanghai.js"
    ),
  山西: () =>
    import(
      /* webpackChunkName: "user-map-provinces" */ "echarts/map/js/province/shanxi.js"
    ),
  陕西: () =>
    import(
      /* webpackChunkName: "user-map-provinces" */ "echarts/map/js/province/shanxi1.js"
    ),
  四川: () =>
    import(
      /* webpackChunkName: "user-map-provinces" */ "echarts/map/js/province/sichuan.js"
    ),
  台湾: () =>
    import(
      /* webpackChunkName: "user-map-provinces" */ "echarts/map/js/province/taiwan.js"
    ),
  天津: () =>
    import(
      /* webpackChunkName: "user-map-provinces" */ "echarts/map/js/province/tianjin.js"
    ),
  香港: () =>
    import(
      /* webpackChunkName: "user-map-provinces" */ "echarts/map/js/province/xianggang.js"
    ),
  新疆: () =>
    import(
      /* webpackChunkName: "user-map-provinces" */ "echarts/map/js/province/xinjiang.js"
    ),
  西藏: () =>
    import(
      /* webpackChunkName: "user-map-provinces" */ "echarts/map/js/province/xizang.js"
    ),
  云南: () =>
    import(
      /* webpackChunkName: "user-map-provinces" */ "echarts/map/js/province/yunnan.js"
    ),
  浙江: () =>
    import(
      /* webpackChunkName: "user-map-provinces" */ "echarts/map/js/province/zhejiang.js"
    ),
};

const loadedProvinceMaps = {};

export default {
  data() {
    return {
      chart: null,
      mapType: "china",
      mapLevel: 1,
      region: "",
      mapData: [],
      mapCityData: [],
      mapRegionData: [],
      HighlightData: [],
    };
  },
  watch: {
    mapRegionData(val) {
      this.mapData = val;
      if (this.$refs.myEchart) {
        this.initEchartMap();
      }
    },
  },
  computed: {
    ...mapGetters(["appusergroup"]),
  },
  created() {
    if (this.appusergroup) {
      this.appusergroup.forEach((ele) => {
        const point = {
          region: ele.region,
          name: ele.appexplainCNEN,
          img: `image://${require("../../../assets/spash.png")}`,
          value: [ele.longitude, ele.latitude],
          city: ele.city,
        };
        const highlight = {
          name: ele.region.slice(0, -1),
          img: `image://${require("../../../assets/spash.png")}`,
          itemStyle: {
            normal: {
              areaColor: "#0470f3",
            },
          },
          value: [ele.longitude, ele.latitude],
        };
        this.mapCityData.push(point);
        this.HighlightData.push(highlight);
        this.handleSwitchData(ele);
      });
    }
    this.mapData = this.mapRegionData;
  },
  mounted() {
    this.initEchartMap();
    window.addEventListener("resize", this.handleResize);
  },
  beforeDestroy() {
    window.removeEventListener("resize", this.handleResize);
    if (!this.chart) {
      return;
    }
    this.chart.dispose();
    this.chart = null;
  },
  methods: {
    ensureProvinceMap(regionName) {
      if (!provinceMapLoaders[regionName]) {
        return Promise.resolve();
      }
      if (!loadedProvinceMaps[regionName]) {
        loadedProvinceMaps[regionName] = provinceMapLoaders[regionName]();
      }
      return loadedProvinceMaps[regionName];
    },
    handleResize() {
      if (this.chart) {
        this.chart.resize();
      }
    },
    handleSwitchData(ele) {
      switch (ele.region) {
        case "湖北省":
        case "北京市":
        case "天津市":
        case "河北省":
        case "山西省":
        case "内蒙古自治区":
        case "辽宁省":
        case "吉林省":
        case "黑龙江省":
        case "上海市":
        case "江苏省":
        case "浙江省":
        case "安徽省":
        case "福建省":
        case "江西省":
        case "山东省":
        case "河南省":
        case "湖南省":
        case "广东省":
        case "广西壮族自治区":
        case "海南省":
        case "重庆市":
        case "四川省":
        case "贵州省":
        case "云南省":
        case "西藏自治区":
        case "陕西省":
        case "甘肃省":
        case "青海省":
        case "宁夏回族自治区":
        case "新疆维吾尔自治区":
        case "台湾省":
        case "香港特别行政区":
        case "澳门特别行政区":
          this.handleMaplocation(ele);
          break;
        default:
          break;
      }
    },
    handleMaplocation(ele) {
      this.mapRegionData.push({
        name: ele.city,
        img: `image://${require("../../../assets/spash.png")}`,
        value: [ele.longitude, ele.latitude],
        itemStyle: {
          normal: {
            areaColor: "#2283c3",
          },
        },
        datainfo: ele,
      });
    },
    initEchartMap() {
      if (!this.$refs.myEchart) {
        return;
      }
      if (!this.chart) {
        this.chart = echarts.init(this.$refs.myEchart);
      } else {
        this.chart.clear();
      }
      this.chart.setOption(
        {
          dataRange: {
            show: false,
            min: 0,
            max: 1000,
            text: ["High", "Low"],
            realtime: true,
            calculable: true,
            color: ["orangered", "yellow", "lightskyblue"],
          },
          visualMap: {
            show: false,
            min: 0,
            max: 255,
            calculable: true,
            inRange: {
              color: ["aqua", "lime", "yellow", "orange", "#ff3333"],
            },
            textStyle: {
              color: "#fff",
            },
          },
          geo: [
            {
              map: this.mapType,
              aspectScale: 1,
              top: "10%",
              left: "8%",
              roam: true,
              label: {
                normal: {
                  show: true,
                  textStyle: {
                    color: "rgba(214, 232, 248, 0.74)",
                    fontSize: 11,
                  },
                },
                emphasis: {
                  textStyle: {
                    color: "#ffffff",
                  },
                },
              },
              regions: this.HighlightData,
              itemStyle: {
                normal: {
                  areaColor: {
                    type: "linear",
                    x: 0.5,
                    y: 0.5,
                    r: 0.5,
                    colorStops: [
                      {
                        offset: 0,
                        color: "#35445f",
                      },
                      {
                        offset: 1,
                        color: "#1b2b4b",
                      },
                    ],
                    global: false,
                  },
                  borderColor: "#0085d6",
                  shadowColor: "rgba(12, 23, 38, 0.76)",
                  shadowOffsetX: 5,
                  shadowOffsetY: 25,
                },
                emphasis: {
                  areaColor: "#094fe8",
                },
              },
              emphasis: {
                textStyle: {
                  color: "#fff",
                },
              },
            },
          ],
          tooltip: {
            trigger: "item",
            backgroundColor: "rgba(7, 18, 31, 0.96)",
            borderColor: "rgba(116, 211, 255, 0.18)",
            borderWidth: 1,
            padding: 0,
            extraCssText: "box-shadow:0 18px 32px rgba(0,0,0,0.28);border-radius:18px;overflow:hidden;",
            formatter(param) {
              const params = param.data && param.data.datainfo;
              let html = "";
              if (params) {
                html =
                  '<div style="padding:18px 20px;min-width:260px;background:linear-gradient(180deg,rgba(8,22,37,0.98) 0%,rgba(12,31,48,0.98) 100%);">' +
                  '<div style="font-size:12px;letter-spacing:0.18em;text-transform:uppercase;color:rgba(194,219,237,0.54);margin-bottom:8px;">Project Snapshot</div>' +
                  '<div style="font-size:18px;font-weight:600;color:#f4fbff;margin-bottom:14px;">' +
                  params.appexplainCNEN +
                  "</div>" +
                  '<div style="display:flex;align-items:center;justify-content:space-between;font-size:13px;color:rgba(214,232,248,0.76);margin-bottom:8px;">' +
                  '<span>设备运行数</span>' +
                  '<span style="font-size:16px;color:#9ef6dd;">' +
                  params.drRunSum +
                  '<span style="margin-left:4px;font-size:12px;color:rgba(214,232,248,0.6);">台</span></span>' +
                  "</div>" +
                  '<div style="display:flex;align-items:center;justify-content:space-between;font-size:13px;color:rgba(214,232,248,0.76);margin-bottom:8px;">' +
                  '<span>设备报警数</span>' +
                  '<span style="font-size:16px;color:#ffd89f;">' +
                  params.drAlarmSum +
                  '<span style="margin-left:4px;font-size:12px;color:rgba(214,232,248,0.6);">台</span></span>' +
                  "</div>" +
                  '<div style="display:flex;align-items:center;justify-content:space-between;font-size:13px;color:rgba(214,232,248,0.76);margin-bottom:8px;">' +
                  '<span>设备故障数</span>' +
                  '<span style="font-size:16px;color:#ffb5c6;">' +
                  params.drmalfunctionSum +
                  '<span style="margin-left:4px;font-size:12px;color:rgba(214,232,248,0.6);">台</span></span>' +
                  "</div>" +
                  '<div style="display:flex;align-items:center;justify-content:space-between;font-size:13px;color:rgba(214,232,248,0.76);margin-bottom:8px;">' +
                  '<span>实时功率</span>' +
                  '<span style="font-size:16px;color:#66e7ff;">' +
                  params.timingPower +
                  '<span style="margin-left:4px;font-size:12px;color:rgba(214,232,248,0.6);">kW</span></span>' +
                  "</div>" +
                  '<div style="display:flex;align-items:center;justify-content:space-between;font-size:13px;color:rgba(214,232,248,0.76);">' +
                  '<span>月累计能耗</span>' +
                  '<span style="font-size:16px;color:#66e7ff;">' +
                  params.totalEnergy +
                  '<span style="margin-left:4px;font-size:12px;color:rgba(214,232,248,0.6);">kWh</span></span>' +
                  "</div>" +
                  "</div>";
              }
              return html;
            },
          },
          series: [
            {
              name: "项目地点",
              type: "effectScatter",
              coordinateSystem: "geo",
              symbol: "circle",
              symbolSize: 12,
              zlevel: 2,
              rippleEffect: {
                period: 4,
                brushType: "stroke",
                scale: 4,
              },
              tooltip: {
                trigger: "item",
                formatter: (params) => {
                  let num = 0;
                  this.mapRegionData.forEach((ele) => {
                    if (ele.name === params.name) {
                      num++;
                    }
                  });
                  return params.name + " 项目个数：" + num;
                },
              },
              label: {
                normal: {
                  show: true,
                  position: "left",
                  offset: [-5, 5],
                  textStyle: {
                    color: "#f0db69",
                    fontSize: 12,
                  },
                  formatter: "{b}",
                },
                emphasis: {
                  show: true,
                },
              },
              hoverAnimation: true,
              itemStyle: {
                normal: {
                  color: {
                    type: "radial",
                    x: 0.5,
                    y: 0.5,
                    r: 0.5,
                    colorStops: [
                      {
                        offset: 0,
                        color: "#f8d56d",
                      },
                      {
                        offset: 1,
                        color: "#2f7cff",
                      },
                    ],
                    global: false,
                  },
                },
              },
              data: this.mapData,
            },
            {
              type: "scatter",
              coordinateSystem: "geo",
              itemStyle: {
                color: "#f00",
              },
              symbol(value, params) {
                return params.data.img;
              },
              symbolSize: [40, 100],
              symbolOffset: [0, -45],
              z: 9999,
              data: this.mapData,
            },
          ],
        },
        true
      );
      this.chart.off("click");
      this.chart.on("click", async (params) => {
        if (
          this.mapLevel < 2 &&
          params.name != "北京" &&
          params.name != "上海" &&
          params.name != "重庆" &&
          params.name != "天津" &&
          params.name != "台湾" &&
          params.name != "澳门" &&
          params.name != "香港"
        ) {
          if (params.region) {
            await this.ensureProvinceMap(params.region.name);
            this.mapType = params.region.name;
            this.mapLevel++;
            this.region = params.region.name;
            this.mapData = [];
            this.mapCityData.forEach((ele) => {
              if (!ele.region.indexOf(params.region.name)) {
                this.mapData.push(ele);
              }
            });
            this.HighlightData = this.mapData.map((item) => {
              return {
                name: item.city,
                itemStyle: {
                  normal: {
                    areaColor: "#0470f3",
                  },
                },
              };
            });
            this.initEchartMap();
          }
        }
      });
    },
    goChina() {
      if (this.region != "") {
        this.mapType = "china";
        this.mapLevel = 1;
        this.mapData = this.mapRegionData;
        this.region = "";
        this.HighlightData = this.mapCityData.map((item) => {
          return {
            name: item.region.slice(0, -1),
            itemStyle: {
              normal: {
                areaColor: "#0470f3",
              },
            },
          };
        });
        this.initEchartMap();
      }
    },
  },
};
</script>
<style lang="scss" scoped>
.echarts {
  height: 100%;
  padding-left: 2%;
  .map-crumb {
    position: absolute;
    z-index: 999;
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 10px 14px;
    border-radius: 999px;
    border: 1px solid rgba(116, 211, 255, 0.14);
    background: linear-gradient(135deg, rgba(6, 19, 31, 0.9) 0%, rgba(12, 34, 52, 0.82) 100%);
    font-size: 13px;
    letter-spacing: 0.12em;
    color: rgba(233, 244, 252, 0.9);
    cursor: pointer;
    left: 15%;
    top: 13%;
  }
}
</style>

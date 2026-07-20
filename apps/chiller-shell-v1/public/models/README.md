# 模型目录说明

该目录用于存放冷站系统新壳使用的 GLB 模型。

当前建议结构：

- `chiller/`
- `cooling-tower/`
- `pump/`
- `plc-control-cabinet/`
- `solenoid-valve/`
- `pressure-gauge/`
- `temperature-gauge/`
- `supply-return-manifold/`
- `cooling-water-dosing-skid/`
- `pressurization-water-makeup-skid/`
- `differential-pressure-transmitter/`
- `plant-overview/`

仓库保留十二个经回导验证的最终模型条目，对应十二个权威源 Blend：

- `chiller/chiller-centrifugal-generic-v1.glb`
- `cooling-tower/cooling-tower-crossflow-generic-v1.glb`
- `pump/pump-horizontal-split-case-generic-v1.glb`
- `plc-control-cabinet/plc-control-cabinet-generic-v1.glb`
- `solenoid-valve/solenoid-valve-flanged-dn50-generic-v1.glb`
- `pressure-gauge/pressure-gauge-radial-dn100-generic-v1.glb`
- `temperature-gauge/temperature-gauge-bimetal-dn100-generic-v1.glb`
- `supply-return-manifold/supply-return-manifold-four-branch-generic-v1.glb`
- `cooling-water-dosing-skid/cooling-water-automatic-dosing-skid-generic-v1.glb`
- `pressurization-water-makeup-skid/pressurization-water-makeup-skid-generic-v1.glb`
- `differential-pressure-transmitter/differential-pressure-transmitter-wet-wet-generic-v1.glb`
- `plant-overview/chilled-water-plant-overview-latest-v2.glb`

机房总览另提供两个同源轻量化层级，不属于旧模型或状态副本：

- `plant-overview/lod/chilled-water-plant-overview-latest-v2-lod1.glb`：中景，建议 25–60m
- `plant-overview/lod/chilled-water-plant-overview-latest-v2-lod2.glb`：远景，建议 60m 以外

因此 Public 模型目录共有十四个 GLB：十二个清单主目标，加上总览的 LOD1 和 LOD2。

模型路径以 `model-manifest-v1.json` 为唯一清单，不再保留旧版、状态副本或原始商用模型包。

建议规范：

- 优先使用 `.glb`
- 文件名使用小写加中划线
- 单文件优先控制在 `20MB` 内
- 尽量不要依赖外部纹理文件
- 总览模型按 `model-manifest-v1.json` 中的 `lodPaths` 和 `lodDistanceMeters` 切换层级

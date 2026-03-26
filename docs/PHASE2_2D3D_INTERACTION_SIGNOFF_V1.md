# PHASE2_2D3D_INTERACTION_SIGNOFF_V1

## 1. 事项归类

- `2D/3D` 深交互增强
- 当前仅针对 Phase 2 第一批最小闭环做验收

## 2. 第一批验收范围

本次只验收：

1. `/scene-control` 深链接补齐
2. `SystemDiagram3D / 设备侧栏 / 详情区` 统一选中态
3. `/scene-control -> /devices -> /scene-control` 上下文回跳

本次明确不验收：

- legacy `4000` 场景本体改造
- 节点级控制下发
- 新业务页
- `/simulate`
- `/assistant/query`
- 正式 optimize engine

## 3. 验收结果

### 3.1 深链接

通过。

`/scene-control` 已支持并持久化：

- `mode`
- `floor`
- `deviceId`
- `nodeId`

### 3.2 统一选中态

通过。

当前壳层已建立：

- `SystemDiagram3D`
- 同楼层设备侧栏
- 右侧详情区

之间的统一选中逻辑。

### 3.3 场景页到设备页

通过。

场景页“在设备页打开当前主设备”已携带：

- `floor`
- `deviceId`
- `sceneMode`
- `sceneNodeId`

### 3.4 设备页返回场景页

通过。

设备页“返回场景页”已保留：

- `mode`
- `floor`
- `deviceId`
- `nodeId`

## 4. 实测依据

- `apps/chiller-shell-v1 -> npm run build`：通过
- Playwright 实测：
  - 进入：
    - `/scene-control?mode=3d&floor=11&deviceId=15`
  - 打开设备页后进入：
    - `/devices?floor=11楼&deviceId=2&sceneMode=3d&sceneNodeId=device-chiller-1`
  - 设备页“返回场景页”链接为：
    - `/scene-control?mode=3d&floor=11&deviceId=2&nodeId=device-chiller-1`
- legacy iframe 在线回归：
  - `http://127.0.0.1:4000/2d/floor/ten/`：`200`
  - `http://127.0.0.1:4000/2d/floor/eleven/`：`200`
  - `http://127.0.0.1:4000/3d/floor/ten/`：`200`
  - `http://127.0.0.1:4000/3d/floor/eleven/`：`200`
  - `/scene-control?mode=3d&floor=11&deviceId=15` 已进入 `已嵌入`
  - 在线条件下完成：
    - `/scene-control -> /devices -> /scene-control`
    - `mode + floor + deviceId + nodeId` 未丢失
  - 2D iframe 单向桥接补测：
    - 当 legacy 2D 上抛 `id='19|办公室01'` 时
    - 新壳已可映射到 `deviceId=19`
    - 右侧详情切到 `办公室01`
    - 设备编码显示 `BGS01`
  - 3D iframe 壳层兼容补测：
    - 当 legacy 3D 上抛 `id='onClickModelObservable'` 时，新壳已兼容主回路四类典型 payload：
      - `CH001 / drid=2`
      - `CHP001 / drid=1`
      - `CWP001 / drid=5`
      - `CT001 / drid=3`
    - 新壳已可对应更新：
      - 当前选中节点
      - 主设备信息
      - “在设备页打开当前主设备”跳转链接
  - 3D iframe 真实点击补测：
    - 对 legacy 3D 画布做密集真实点击扫描后，已抓到两条真实 `postMessage`：
      - `{ id: 'onClickModelObservable', data: { id: '1', name: 'CHP1', type: 74, runningid: '3' } }`
      - `{ id: 'onClickModelObservable', data: { id: '2', name: 'CH1', type: 75, runningid: '30' } }`
      - `{ id: 'onClickModelObservable', data: { id: '4', name: 'SY', type: 77, runningid: '87' } }`
      - `{ id: 'onClickModelObservable', data: { id: '7', name: '', type: 0, runningid: '177' } }`
    - 其中：
      - `drid=1 / CHP1` 对应主回路冷冻泵对象，点击后新壳可切到 `deviceId=1 / nodeId=device-chilledPump-1`
      - `drid=2 / CH1` 对应主回路冷机对象，点击后新壳可切到 `deviceId=2 / nodeId=device-chiller-1`
      - `drid=3 / CTF1` 对应主回路冷却塔对象，点击后新壳可切到 `deviceId=3 / nodeId=device-coolingTower-3`
      - `drid=4 / name=SY` 对应旧系统“参数设置”对象，不属于当前主回路设备联动范围
      - `drid=7` 对应“冷冻回水主管温度”传感器，也不在当前主回路设备联动范围
    - 这说明 legacy 3D 的真实点击消息链已存在，且主回路对象的真实鼠标点击已可驱动新壳联动；当前仍未联动的样本，应视为点击到了非主回路对象

## 5. 当前限制

当前仍存在但不阻断第一批验收的事项：

- 2D legacy iframe 已可通过 `postMessage({ id })` 把设备选择同步到新壳，但当前仅完成单向 `iframe -> shell` 承接
- 3D legacy iframe 已完成壳层消息兼容、主回路样本联动和真实点击主回路对象补测；后续仅剩冷却泵等个别对象的真实点击样本可按需补采
- legacy 资源未来如再次离线，页面仍会回退到现有降级态

## 6. 结论

Phase 2 第一批最小闭环：

- `已完成`
- `可验收`
- `可暂停`

当前建议：

- 不直接进入第二批开发
- 先以本验收单作为第一批封口依据

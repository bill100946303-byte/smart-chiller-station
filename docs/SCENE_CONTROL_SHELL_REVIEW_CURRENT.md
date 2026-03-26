# SCENE_CONTROL_SHELL_REVIEW_CURRENT

## 1. 结论

- `/scene-control`：`可联调`
- `/scene-control`：`可演示`
- `/scene-control`：`正式签收`

当前页面已经形成真实可访问的新壳外层入口，且旧 2D / 3D 静态资源服务 `127.0.0.1:4000` 已恢复可访问，因此本轮将其收口为“外壳已落地、ready 态可复核、正式签收”。

## 2. 当前真实运行态

主控复核结果：

- `./scripts/chiller_ctl.sh runtime-status`
  - `runtimeChain=ok`
  - `runtimeDataCompleteness=enhanced`
- `GET http://127.0.0.1:3001/scene-control`
  - `200`
- `GET http://127.0.0.1:4000/2d/floor/ten/`
  - `200`
- `GET http://127.0.0.1:4000/3d/floor/ten/`
  - `200`
- `GET http://127.0.0.1:4000/2d/floor/eleven/`
  - `200`
- `GET http://127.0.0.1:4000/3d/floor/eleven/`
  - `200`

这说明：

1. 新壳页面本身已经在 `3001` 上正常提供。
2. 场景外壳路由本身已可访问。
3. 旧静态资源服务已恢复，默认场景 iframe 已能进入 ready / embedded 分支。

## 3. 页面级能力

当前 `/scene-control` 已真实具备：

- 2D / 3D 模式切换
- 10 楼 / 11 楼切换
- URL 查询参数承接（`mode` / `floor` / `deviceId` / `nodeId`）
- 四场景快速切换
- 手动重探测
- 同楼层设备侧栏（复用 `devices/list + devices/{deviceId}`）
- 场景页跳转设备页时携带 `floor + deviceId + sceneMode + sceneNodeId` 深链接
- 设备页返回场景页时保留 `mode + floor + deviceId + nodeId` 上下文
- `SystemDiagram3D`、设备侧栏与详情区已建立壳层统一选中态
- legacy 场景 URL 透出
- 外部打开旧场景入口
- 资源探测失败时的降级提示
- 新壳 summary / controls / preview 三段式结构

当前页面仍未覆盖的范围：

- legacy 引擎内部节点级控制
- 场景控制下发
- 场景资产原生替换

## 4. 当前判定依据

判定为 `正式签收` 的依据：

1. 页面路由、导航入口和三语文案已真实落地。
2. `4000` 端口的 2D / 3D、10/11 楼资源入口均已返回 `200`。
3. 真实页面已从降级态切换到 `已嵌入`，并可清楚说明：
   - 当前模式
   - 当前楼层
   - 当前 legacy URL
   - 当前策略是“继续嵌入旧资产，由新壳承接设备上下文联动”

## 5. 后续建议

1. 当前不要继续扩场景页前端壳层复杂度。
2. 后续如果继续推进，应优先做 2D/3D 深化交互，而不是再重复外壳建设。
3. 如 `4000` 再次不可达，应回退到当前页面已具备的降级态处理。

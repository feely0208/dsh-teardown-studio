# 本地 3D 预处理 / 缓存流水线

流程：

```
上传 GLB -> 解析所有节点/网格/材质 -> 生成 partgraph.json -> 复制模型到本地 cache
下一次同一模型 -> 直接读 cache，不重复解析
```

运行：

```bash
cd /Users/mac/DeepSeek Harness2/1017-lab
node tools/model-pipeline.mjs assets-test/drone-concept.glb
node tools/model-pipeline.mjs --list
```

输出目录：

```
cache/models/<hash>/
  model.glb        # 本地副本
  partgraph.json   # 所有部件、包围盒、中心、爆炸方向、材质分组
  manifest.json
```

partgraph 里每个 part 含：

- id / name / nodeIndex / meshIndex
- materials
- bounds / center / size
- explode 方向
- groups 按材质归组（如 enginemetal -> 发动机/金属动力结构）

注意：这里“创建所有部件”指模型里实际存在的节点/网格。模型没有建出来的内部零件（例如外壳模型里的电池）不会被凭空生成；需要客户 CAD、拆解图，或单独的概念件生成器。

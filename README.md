# 深鲸拆解 · DeepWhale Teardown Studio

上传**已经分件**的 3D，或直接用内置「无人机成品 42s」模板，在本地生成拆解视频。

## 安装

```bash
dsh plugin --profile web add @deepwhale-cn/dsh-teardown-studio
```

装完重启 DeepWhale Desktop，右下角进入「深鲸拆解」。

## 能力

- 内置无人机成品 42 秒管线（带音效、端卡）；
- 上传分件 GLB → 15 秒通用拆解；
- 模板 #01 / #02；
- 本地背景图片/视频、本地音乐；
- 本地模型缓存，下次秒开；
- 不内置 Chromium / ffmpeg：使用本机 Chrome/Edge + ffmpeg，缺失时界面提示。

## 限制

- 仅支持**已分件**的 GLB；单网格模型不支持；
- 不支持图纸上传、图生 3D、自动语义拆解；
- 免费版个人/非商用，导出带 `powered by dwh`；商用需授权。

## 许可证

MIT

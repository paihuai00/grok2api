## Why

图像编辑功能目前只显示编辑后的结果，用户无法直观对比编辑前后的差异。添加对比功能可以让用户更好地评估编辑效果，决定是否满意或需要重新编辑。

## What Changes

- **瀑布流卡片添加对比按钮**：在编辑模式下，每张结果图片的卡片上添加对比按钮
- **Lightbox 添加对比功能**：在大图预览时可以切换到对比模式，并排显示原图和编辑图
- **存储原图引用**：在编辑模式下保存原图数据，供对比功能使用

## Capabilities

### New Capabilities
- `image-compare`: 图像编辑结果与原图的对比功能，包括瀑布流对比按钮和 Lightbox 并排对比模式

### Modified Capabilities
<!-- 无 -->

## Impact

- **前端代码修改**：
  - `app/static/imagine/imagine.html` - 添加对比 UI 元素
  - `app/static/imagine/imagine.js` - 添加对比逻辑
  - `app/static/imagine/imagine.css` - 添加对比样式
- **无 API 变更**
- **无后端变更**

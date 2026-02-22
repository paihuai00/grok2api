## Context

当前图像编辑功能的前端实现位于 `app/static/imagine/` 目录：
- `imagine.html` - 页面结构
- `imagine.js` - 核心逻辑
- `imagine.css` - 样式

关键代码位置：
- 原图上传预览：`editPreviewImg.src` 存储了原图 base64
- 瀑布流图片添加：`appendImage()` 函数 (第 322-387 行)
- Lightbox 预览：第 1078-1159 行

## Goals / Non-Goals

**Goals:**
- 在编辑模式的瀑布流卡片上添加对比按钮
- 在 Lightbox 中实现并排对比视图
- 仅在编辑模式下显示对比功能

**Non-Goals:**
- 不实现滑动分割线对比（用户选择了并排显示）
- 不修改后端 API
- 不影响生成模式的行为

## Decisions

### Decision 1: 原图数据存储方式

**选择**: 使用全局变量存储原图 base64

**理由**:
- `editPreviewImg.src` 已经包含原图 base64 数据
- 编辑模式下只有一张原图，无需复杂的数据结构
- 简单直接，易于实现

### Decision 2: 并排对比布局

**选择**: Lightbox 内使用 flexbox 并排显示两张图

**实现**:
```css
.lightbox-compare {
  display: flex;
  gap: 20px;
  justify-content: center;
  align-items: center;
}
.lightbox-compare img {
  max-width: 48%;
  max-height: 90vh;
}
```

**理由**:
- 响应式布局，适应不同屏幕尺寸
- 两张图片大小一致，便于对比

### Decision 3: 对比按钮位置

**选择**:
- 瀑布流卡片：在图片右下角添加对比图标按钮
- Lightbox：在顶部工具栏添加对比切换按钮

**理由**:
- 不影响现有布局
- 位置明显，易于发现和操作

### Decision 4: 对比模式标识

**选择**: 使用 CSS class `compare-mode` 控制显示状态

**理由**:
- 通过添加/移除 class 切换视图
- 便于管理样式和状态

## Risks / Trade-offs

| 风险 | 缓解措施 |
|------|----------|
| **原图尺寸与结果尺寸不同导致对比不对齐** | 使用 `object-fit: contain` 保持比例，两侧添加标签区分 |
| **移动端并排显示空间不足** | 考虑在小屏幕上改为上下堆叠布局 |

## Context

当前图像编辑功能的前端实现位于 `app/static/imagine/` 目录：
- `imagine.html` - 页面结构
- `imagine.js` - 核心逻辑
- `imagine.css` - 样式

关键代码位置：
- 模式切换：`imagineModeBtns` 和 `switchImagineMode()` 函数
- 编辑模式逻辑：`startEditMode()` 函数（第 732-805 行）
- 图片上传区域：`editUploadArea`、`editFileInput`
- 瀑布流展示：`waterfall` 容器和 `appendImage()` 函数

现有 API：
- `POST /v1/images/edits` - 图片编辑接口，支持 FormData 上传

## Goals / Non-Goals

**Goals:**
- 新增"批量编辑"模式，与"生成"、"编辑"并列
- 支持多选图片和选择目录两种导入方式
- 图片卡片带选择框，可单选/全选，未选中显示灰色
- 批量处理时显示总体进度条
- 失败的图片显示错误信息
- 优先并行处理以提高效率

**Non-Goals:**
- 不修改后端 API
- 不影响现有"生成"和"编辑"模式的任何功能
- 不支持非 Chromium 浏览器的目录选择（降级为多选文件）
- 不实现断点续传

## Decisions

### Decision 1: 模式架构

**选择**: 新增独立的 `batch` 模式，与 `generate`、`edit` 并列

**实现**:
```javascript
let imagineMode = 'generate'; // 'generate' | 'edit' | 'batch'
```

**理由**:
- 完全隔离，不影响现有功能
- 代码结构清晰，便于维护

### Decision 2: 图片选择 UI

**选择**: 独立的批量图片上传区域 + 已选图片网格展示

**布局**:
```
┌─────────────────────────────────────────┐
│  [多选图片] [选择目录]                    │
├─────────────────────────────────────────┤
│  提示词输入框                            │
├─────────────────────────────────────────┤
│  已选图片：N 张          [全选] [开始处理] │
├─────────────────────────────────────────┤
│  ┌───┐ ┌───┐ ┌───┐ ┌───┐              │
│  │☑️│ │☑️│ │☐│ │☑️│  ...             │
│  │img│ │img│ │img│ │img│              │
│  └───┘ └───┘ └───┘ └───┘              │
│              (灰色)                      │
└─────────────────────────────────────────┘
```

**理由**:
- 清晰展示已选图片
- 选择框位于右上角，区域适当大，方便点击
- 未选中的卡片灰色显示，视觉区分明显

### Decision 3: 选择逻辑

**选择**: 默认全选，0 选中 = 全选

**规则**:
- 导入图片后，所有图片默认选中
- 用户可单独取消选择
- 点击"全选"按钮选中所有图片
- 若用户未选择任何图片（全部取消），执行时视为全选

**理由**:
- 符合批量处理的常见预期
- 防止用户误操作（取消了所有选择后点开始，不会报错而是处理全部）

### Decision 4: 并行处理策略

**选择**: 使用 `Promise.allSettled()` + 并发控制

**实现**:
```javascript
const BATCH_CONCURRENCY = 3; // 最大并发数

async function processBatch(files, prompt) {
  const results = [];
  for (let i = 0; i < files.length; i += BATCH_CONCURRENCY) {
    const batch = files.slice(i, i + BATCH_CONCURRENCY);
    const batchResults = await Promise.allSettled(
      batch.map(file => processEditSingle(file, prompt))
    );
    results.push(...batchResults);
    updateProgress(i + batch.length, files.length);
  }
  return results;
}
```

**理由**:
- 并发数限制避免浏览器和服务器过载
- `Promise.allSettled` 确保单个失败不影响其他图片处理
- 分批处理便于更新进度

### Decision 5: 进度与错误展示

**选择**: 
- 顶部进度条显示总体进度
- 底部错误区域显示失败详情

**实现**:
```html
<!-- 进度条 -->
<div class="batch-progress">
  <div class="batch-progress-bar" style="width: 60%"></div>
  <span class="batch-progress-text">处理中: 6/10</span>
</div>

<!-- 错误区域 -->
<div class="batch-errors">
  <div class="batch-error-item">
    <span class="error-filename">image1.jpg</span>
    <span class="error-message">上传失败: 文件过大</span>
  </div>
</div>
```

**理由**:
- 进度条直观显示整体进度
- 错误信息详细，便于用户排查问题

### Decision 6: 目录选择兼容性

**选择**: 仅 Chrome/Edge 支持目录选择，其他浏览器隐藏该按钮

**检测**:
```javascript
const supportsDirectoryPicker = 'showDirectoryPicker' in window;
if (!supportsDirectoryPicker) {
  selectDirBtn.style.display = 'none';
}
```

**理由**:
- File System Access API 是 Chromium 专有
- 优雅降级，不影响多选文件功能

## Risks / Trade-offs

| 风险 | 缓解措施 |
|------|----------|
| **大量图片同时处理导致浏览器卡顿** | 限制并发数为 3，分批处理 |
| **单个请求超时影响体验** | 使用 `Promise.allSettled`，单个失败不阻塞整体 |
| **目录内非图片文件** | 过滤文件类型，仅处理 png/jpg/webp |
| **用户误点开始但未输入提示词** | 处理前校验提示词，为空时提示 |
| **大量失败信息导致页面过长** | 错误区域添加最大高度和滚动条 |

## Data Flow

```
用户操作                     前端状态                    API 调用
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. 切换到批量编辑模式  ──→ imagineMode = 'batch'
2. 多选图片/选择目录   ──→ batchFiles[] 存储 File 对象
                           ↓ 渲染图片网格（默认全选）
3. 输入提示词         ──→ promptInput.value
4. 点击开始处理       ──→ getSelectedFiles() 
                           ↓ (若 0 选中，取全部)
                           ↓ processBatch()
                             ├──→ POST /v1/images/edits (file1)
                             ├──→ POST /v1/images/edits (file2)
                             └──→ POST /v1/images/edits (file3)
                           ↓ 更新进度条
5. 处理完成           ←── 成功的图片添加到瀑布流
                           失败的图片显示在错误区域
```
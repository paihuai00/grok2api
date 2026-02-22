## Why

图像编辑 API (`/v1/images/edits`) 当前仅支持固定的宽高比（1:1, 16:9, 9:16, 2:3, 3:2），用户无法保持原图尺寸进行编辑。当用户的原图尺寸与支持的尺寸不匹配时，需要手动进行预处理和后处理，使用体验不佳。

## What Changes

- **新增 `size=original` 选项**：允许用户指定保持原图尺寸
- **图像预处理**：当检测到 `original` 选项时，自动将原图缩放到最接近的 Grok 支持尺寸
- **图像后处理**：将 Grok 返回的结果图缩放回原图尺寸
- **新增 Pillow 依赖**：用于图像尺寸检测和缩放处理

## Capabilities

### New Capabilities
- `original-size-editing`: 图像编辑时保持原图尺寸的能力，包括尺寸检测、比例匹配、图像缩放

### Modified Capabilities
<!-- 无需修改现有 spec 级别的需求 -->

## Impact

- **代码修改**：
  - `app/api/v1/image.py` - 添加 `original` 尺寸处理逻辑
  - `pyproject.toml` - 添加 Pillow 依赖
- **API 变更**：
  - `/v1/images/edits` 的 `size` 参数新增 `original` 选项（向后兼容）
- **依赖变更**：
  - 新增 `Pillow` 库用于图像处理
- **性能影响**：
  - 使用 `original` 选项时会增加额外的图像缩放开销

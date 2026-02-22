## Context

当前 `/v1/images/edits` 接口通过 `resolve_aspect_ratio()` 函数将用户传入的 `size` 参数映射为 Grok 支持的 5 种固定比例（1:1, 16:9, 9:16, 2:3, 3:2）。Grok API 不支持任意尺寸，因此需要在应用层进行图像尺寸的预处理和后处理。

关键代码位置：
- `app/api/v1/image.py:158-179` - `resolve_aspect_ratio()` 函数
- `app/api/v1/image.py:493-747` - `edit_image()` 端点

## Goals / Non-Goals

**Goals:**
- 支持 `size=original` 选项，保持输入输出图像尺寸一致
- 自动选择最接近原图比例的 Grok 支持比例
- 保持向后兼容，现有参数正常工作
- 使用高质量图像缩放算法

**Non-Goals:**
- 不支持任意自定义尺寸（仅支持 `original`）
- 不应用于图像生成接口（仅图像编辑）
- 不修改 Grok API 的调用方式

## Decisions

### Decision 1: 图像处理库选择

**选择**: Pillow (PIL)

**理由**:
- Python 生态中最成熟的图像处理库
- 轻量级，安装简单
- 提供高质量的 LANCZOS 重采样算法
- 社区活跃，文档完善

**备选方案**:
- opencv-python：功能更强但依赖较重，对于简单的缩放需求过于复杂
- scikit-image：适合科学计算，对于本场景过于复杂

### Decision 2: 比例匹配算法

**选择**: 计算原图比例与支持比例的差值，选择差值最小的比例

**算法**:
```python
SUPPORTED_RATIOS = {
    "1:1": 1.0,
    "16:9": 16/9,  # 1.778
    "9:16": 9/16,  # 0.5625
    "2:3": 2/3,    # 0.667
    "3:2": 3/2,    # 1.5
}

def find_closest_ratio(width: int, height: int) -> str:
    original_ratio = width / height
    closest = min(SUPPORTED_RATIOS.items(),
                  key=lambda x: abs(x[1] - original_ratio))
    return closest[0]
```

**理由**:
- 简单直观，易于理解和维护
- 数学上准确选择最接近的比例

### Decision 3: 目标尺寸选择

**选择**: 每个比例使用固定的标准尺寸

| 比例 | 标准尺寸 |
|------|----------|
| 1:1 | 1024x1024 |
| 16:9 | 1536x864 |
| 9:16 | 864x1536 |
| 2:3 | 1024x1536 |
| 3:2 | 1536x1024 |

**理由**:
- 使用较大尺寸以获得更好的生成质量
- 与 Grok 的最佳支持尺寸对齐

### Decision 4: 图像缩放时机

**选择**: 在上传到 Grok 之前进行预处理，在收到结果后进行后处理

**流程**:
```
原图 → 检测尺寸 → 选择比例 → 缩放到标准尺寸 → Base64 编码
     → 上传 Grok → 调用编辑 API → 接收结果
     → 解码结果 → 缩放回原图尺寸 → 返回用户
```

**理由**:
- 最小化对现有流程的修改
- 只在 `size=original` 时激活额外处理

### Decision 5: 代码组织

**选择**: 创建独立的图像处理模块 `app/services/image/processor.py`

**接口**:
```python
class ImageProcessor:
    @staticmethod
    def get_dimensions(image_data: bytes) -> tuple[int, int]:
        """获取图像尺寸"""

    @staticmethod
    def find_closest_ratio(width: int, height: int) -> str:
        """找到最接近的支持比例"""

    @staticmethod
    def scale_image(image_data: bytes, target_width: int, target_height: int) -> bytes:
        """缩放图像"""
```

**理由**:
- 保持单一职责原则
- 便于测试和复用
- 不污染现有代码结构

## Risks / Trade-offs

| 风险 | 缓解措施 |
|------|----------|
| **缩放可能影响图像质量** | 使用 LANCZOS 高质量重采样；选择较大标准尺寸减少放大幅度 |
| **额外的处理开销** | 仅在 `size=original` 时激活；内存中处理，避免磁盘 I/O |
| **比例不匹配导致轻微变形** | 选择最接近比例，变形程度最小化；文档说明此行为 |
| **大图像可能占用大量内存** | 利用现有的 50MB 文件大小限制；必要时可添加尺寸限制 |

## Open Questions

1. ~~图像处理库选择~~ → 已确定使用 Pillow
2. ~~比例不匹配处理方式~~ → 已确定选择最接近比例
3. ~~功能范围~~ → 已确定仅支持图像编辑

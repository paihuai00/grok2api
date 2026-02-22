## 1. 依赖配置

- [x] 1.1 在 `pyproject.toml` 中添加 Pillow 依赖

## 2. 图像处理模块

- [x] 2.1 创建 `app/services/image/processor.py` 模块
- [x] 2.2 实现 `get_dimensions()` 函数：从图像数据获取宽高
- [x] 2.3 实现 `find_closest_ratio()` 函数：根据原图比例找到最接近的 Grok 支持比例
- [x] 2.4 实现 `get_target_size()` 函数：根据比例返回标准目标尺寸
- [x] 2.5 实现 `scale_image()` 函数：使用 LANCZOS 算法缩放图像

## 3. API 集成

- [x] 3.1 修改 `app/api/v1/image.py` 中的 `resolve_aspect_ratio()` 函数，添加 `original` 选项支持
- [x] 3.2 修改 `edit_image()` 函数：检测 `size=original` 时读取原图尺寸
- [x] 3.3 修改 `edit_image()` 函数：在上传前对原图进行缩放预处理
- [x] 3.4 修改响应处理：在返回结果前将图像缩放回原图尺寸

## 4. 测试验证

- [x] 4.1 手动测试：使用不同尺寸的图像验证 `size=original` 功能
- [x] 4.2 验证向后兼容性：确保现有 size 参数正常工作

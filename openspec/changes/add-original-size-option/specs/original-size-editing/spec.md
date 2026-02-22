## ADDED Requirements

### Requirement: Support original size option in image edits
系统 SHALL 在 `/v1/images/edits` 接口的 `size` 参数中支持 `original` 选项，使编辑后的图像保持与输入图像相同的尺寸。

#### Scenario: User specifies size=original
- **WHEN** 用户调用 `/v1/images/edits` 并设置 `size=original`
- **THEN** 系统返回的编辑后图像尺寸与输入图像尺寸一致

#### Scenario: Original size with non-standard aspect ratio
- **WHEN** 用户上传 800x600 的图像并设置 `size=original`
- **THEN** 系统自动选择最接近的 Grok 支持比例（3:2）进行处理，并将结果缩放回 800x600

### Requirement: Detect input image dimensions
系统 SHALL 能够检测上传图像的宽度和高度。

#### Scenario: Detect dimensions from uploaded image
- **WHEN** 用户上传一张图像
- **THEN** 系统能够读取该图像的原始宽度和高度（以像素为单位）

### Requirement: Match closest supported aspect ratio
系统 SHALL 能够根据原图比例，自动选择最接近的 Grok 支持比例。

#### Scenario: Match ratio for landscape image
- **WHEN** 原图比例为 1.33:1 (如 800x600)
- **THEN** 系统选择最接近的支持比例 3:2 (1.5:1)

#### Scenario: Match ratio for portrait image
- **WHEN** 原图比例为 0.75:1 (如 600x800)
- **THEN** 系统选择最接近的支持比例 2:3 (0.67:1)

#### Scenario: Match ratio for square-like image
- **WHEN** 原图比例接近 1:1 (如 500x480)
- **THEN** 系统选择 1:1 比例

### Requirement: Scale input image to target size
系统 SHALL 能够将输入图像缩放到 Grok 支持的目标尺寸。

#### Scenario: Scale up small image
- **WHEN** 原图为 400x300，目标比例为 3:2
- **THEN** 系统将图像缩放到 1536x1024 用于 Grok 处理

#### Scenario: Scale down large image
- **WHEN** 原图为 3000x2000，目标比例为 3:2
- **THEN** 系统将图像缩放到 1536x1024 用于 Grok 处理

### Requirement: Scale output image to original dimensions
系统 SHALL 能够将 Grok 返回的结果图像缩放回原图尺寸。

#### Scenario: Scale result back to original size
- **WHEN** Grok 返回 1536x1024 的结果图像，原图尺寸为 800x600
- **THEN** 系统将结果缩放回 800x600

### Requirement: Preserve image quality during scaling
系统 SHALL 在缩放过程中使用高质量的重采样算法以保持图像质量。

#### Scenario: High quality downscaling
- **WHEN** 将大尺寸结果图缩放回小尺寸原图
- **THEN** 系统使用 LANCZOS 或同等质量的重采样算法

### Requirement: Backward compatibility
`size=original` 选项 SHALL 是可选的，现有的尺寸参数（如 `1024x1024`、`16:9` 等）仍然正常工作。

#### Scenario: Existing size parameters still work
- **WHEN** 用户调用 `/v1/images/edits` 并设置 `size=1024x1024`
- **THEN** 系统行为与之前完全一致，不进行额外的缩放处理

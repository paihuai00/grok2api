## ADDED Requirements

### Requirement: Compare button in waterfall cards
系统 SHALL 在编辑模式下的瀑布流图片卡片上显示对比按钮，点击后打开并排对比视图。

#### Scenario: Show compare button for edit results
- **WHEN** 用户在编辑模式下生成了结果图片
- **THEN** 每张结果图片的卡片上显示对比按钮（图标或文字）

#### Scenario: Click compare button opens comparison view
- **WHEN** 用户点击瀑布流卡片上的对比按钮
- **THEN** 打开 Lightbox 并显示并排对比视图

### Requirement: Side-by-side comparison in Lightbox
系统 SHALL 在 Lightbox 预览中支持并排对比模式，左侧显示原图，右侧显示编辑后的图。

#### Scenario: Toggle comparison mode in Lightbox
- **WHEN** 用户在 Lightbox 中点击对比按钮
- **THEN** 切换到并排对比模式，左侧显示原图，右侧显示当前编辑结果

#### Scenario: Exit comparison mode
- **WHEN** 用户在对比模式下再次点击对比按钮或关闭 Lightbox
- **THEN** 退出对比模式，恢复单图预览

### Requirement: Store original image reference
系统 SHALL 在编辑模式下保存上传的原图数据，供对比功能使用。

#### Scenario: Original image available for comparison
- **WHEN** 用户上传原图并执行编辑
- **THEN** 原图的 base64 数据被保存，对比功能可以访问

### Requirement: Compare feature only in edit mode
对比功能 SHALL 仅在编辑模式下可用，生成模式下不显示对比按钮。

#### Scenario: No compare button in generate mode
- **WHEN** 用户在生成模式下生成图片
- **THEN** 瀑布流卡片上不显示对比按钮

#### Scenario: Compare button visible in edit mode
- **WHEN** 用户在编辑模式下生成图片
- **THEN** 瀑布流卡片上显示对比按钮

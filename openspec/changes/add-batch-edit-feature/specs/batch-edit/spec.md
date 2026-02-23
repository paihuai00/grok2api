## ADDED Requirements

### Requirement: Batch edit mode tab
系统 SHALL 提供"批量编辑"模式标签，与"生成"、"编辑"并列显示。

#### Scenario: Switch to batch edit mode
- **WHEN** 用户点击"批量编辑"标签
- **THEN** 系统切换到批量编辑模式
- **AND** 显示批量编辑专用界面
- **AND** 不影响"生成"和"编辑"模式的功能

### Requirement: Multiple image selection
系统 SHALL 支持多选本地图片文件导入。

#### Scenario: Select multiple images
- **WHEN** 用户点击"多选图片"按钮
- **THEN** 打开文件选择对话框，支持多选
- **AND** 仅允许选择 png/jpg/webp 格式的图片

#### Scenario: Display selected images
- **WHEN** 用户选择了多张图片
- **THEN** 在图片网格中显示所有选中的图片缩略图
- **AND** 每张图片默认处于选中状态

### Requirement: Directory selection
系统 SHALL 支持选择本地目录批量导入图片（仅 Chrome/Edge）。

#### Scenario: Select directory
- **WHEN** 用户点击"选择目录"按钮
- **THEN** 打开目录选择对话框
- **AND** 导入目录内所有符合格式的图片（png/jpg/webp）

#### Scenario: Directory selection unavailable
- **WHEN** 用户使用不支持 File System Access API 的浏览器
- **THEN** "选择目录"按钮不显示或禁用

### Requirement: Image card selection
系统 SHALL 在每张图片卡片右上角显示选择框。

#### Scenario: Selection checkbox position
- **GIVEN** 图片网格中有已导入的图片
- **THEN** 每张图片卡片的右上角显示选择框
- **AND** 选择框区域适当大，方便点击

#### Scenario: Toggle single image selection
- **WHEN** 用户点击某张图片的选择框
- **THEN** 切换该图片的选中状态

#### Scenario: Unselected image appears gray
- **WHEN** 某张图片处于未选中状态
- **THEN** 该图片卡片显示为灰色

### Requirement: Default select all
系统 SHALL 在导入图片后默认全选所有图片。

#### Scenario: Images default to selected
- **WHEN** 用户导入一批图片
- **THEN** 所有图片默认处于选中状态

### Requirement: Select all button
系统 SHALL 在标题右侧提供"全选"按钮。

#### Scenario: Click select all
- **WHEN** 用户点击"全选"按钮
- **THEN** 所有图片变为选中状态

### Requirement: Zero selection equals select all
系统 SHALL 在用户未选择任何图片时，将其视为全选。

#### Scenario: Process with no selection
- **GIVEN** 用户取消了所有图片的选择（0 张选中）
- **WHEN** 用户点击"开始处理"
- **THEN** 系统处理所有图片（视为全选）

### Requirement: Batch processing with parallelism
系统 SHALL 并行处理选中的图片以提高效率。

#### Scenario: Parallel processing
- **WHEN** 用户点击"开始处理"
- **THEN** 系统并行调用 `/v1/images/edits` API 处理多张图片
- **AND** 并发数量有限制（如最多 3 个并行请求）

#### Scenario: Single failure does not block others
- **WHEN** 某张图片处理失败
- **THEN** 其他图片继续处理
- **AND** 失败的图片记录到错误区域

### Requirement: Progress bar
系统 SHALL 显示总体处理进度条。

#### Scenario: Show progress
- **WHEN** 批量处理进行中
- **THEN** 显示进度条，指示已处理/总数（如 "6/10"）
- **AND** 进度条随处理进度更新

### Requirement: Error display area
系统 SHALL 提供错误信息展示区域，显示处理失败的图片及错误原因。

#### Scenario: Display error details
- **WHEN** 某张图片处理失败
- **THEN** 在错误区域显示该图片的文件名和错误信息

#### Scenario: Error area scrollable
- **WHEN** 错误信息过多
- **THEN** 错误区域显示滚动条，限制最大高度

### Requirement: Results in waterfall
系统 SHALL 将成功处理的图片结果显示在瀑布流中。

#### Scenario: Show successful results
- **WHEN** 图片处理成功
- **THEN** 结果图片添加到瀑布流展示区域

### Requirement: No impact on existing features
批量编辑功能 SHALL NOT 影响现有的"生成"和"编辑"模式功能。

#### Scenario: Generate mode unchanged
- **WHEN** 用户使用"生成"模式
- **THEN** 功能与添加批量编辑前完全一致

#### Scenario: Edit mode unchanged
- **WHEN** 用户使用"编辑"模式
- **THEN** 功能与添加批量编辑前完全一致
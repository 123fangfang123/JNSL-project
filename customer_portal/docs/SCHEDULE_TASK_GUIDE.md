# 物流商运单同步定时任务说明文档

## 系统概述

物流商运单同步定时任务是一个可配置的管理系统，用于自动化执行多个物流商的运单状态查询、回写和验证流程。

### 主要特性

- 灵活的配置：通过 JSON 配置文件管理所有参数
- 命令行管理工具：快速修改配置，无需手动编辑文件
- 守护进程模式：自动按计划执行，支持热重载配置
- 独立控制：可单独启用/禁用每个物流商
- 错误处理：可配置遇到错误时停止或继续执行
- 日志记录：自动记录执行过程和结果

---

## 文件路径

### 核心文件

customer_portal/tools/
- schedule-config.json          # 定时任务配置文件
- manage-schedule.js            # 命令行管理工具
- scheduler.js                  # 守护进程调度器
- _run_daily_carrier_sync.js    # 旧版编排器（备用）

### 物流商执行脚本

customer_portal/tools/
- _hh_query_batch.js            # HH EXPRESS 查询脚本
- _hh_writeback.js              # HH EXPRESS 回写脚本
- _hh_verify.js                 # HH EXPRESS 验证脚本
- _yanwen_query_batch.js        # YANWEN 查询脚本
- _yanwen_writeback.js          # YANWEN 回写脚本
- _yanwen_verify.js             # YANWEN 验证脚本
- _yun_query_batch.js           # YUNEXPRESS 查询脚本
- _yun_writeback.js             # YUNEXPRESS 回写脚本
- _yun_verify_writeback.js      # YUNEXPRESS 验证脚本

### 日志文件位置

customer_portal/Data Import/Process Log/
- [日期时间戳].log              # 执行日志文件

---

## 核心功能

### 1. 配置文件（schedule-config.json）

存储所有定时任务的配置参数，包括：
- 总开关：启用/禁用整个定时任务
- 执行时间：每天执行的时间点（24小时制 HH:MM）
- 时区：执行时间的时区（默认 Asia/Shanghai）
- 物流商列表：执行顺序、脚本路径、启用状态
- 选项：错误处理策略、日志配置

### 2. 管理工具（manage-schedule.js）

命令行接口，用于快速修改配置：
- 查看当前配置
- 启用/禁用定时任务
- 修改执行时间
- 调整物流商执行顺序
- 单独控制物流商启用状态
- 配置错误处理策略

### 3. 调度器（scheduler.js）

守护进程，负责按计划执行任务：
- 每分钟检查一次配置
- 时间匹配时自动执行
- 支持热重载（修改配置无需重启）
- 提供多种运行模式（正常/立即执行/模拟）

---

## 配置说明

### schedule-config.json 结构

{
  "enabled": true,                    // 总开关：true=启用，false=禁用
  "schedule": {
    "time": "02:00",                  // 执行时间（24小时制）
    "timezone": "Asia/Shanghai",      // 时区
    "description": "每天凌晨2点执行物流商运单同步"
  },
  "carriers": [                       // 物流商配置数组（按执行顺序排列）
    {
      "name": "HH EXPRESS",           // 物流商名称
      "enabled": true,                // 是否启用
      "query": "_hh_query_batch.js",  // 查询脚本
      "writeback": "_hh_writeback.js",// 回写脚本
      "verify": "_hh_verify.js",      // 验证脚本
      "writebackArgs": ["--write"]    // 回写脚本参数
    }
  ],
  "options": {
    "stopOnError": false,             // 遇到错误时停止：true=停止，false=继续
    "logEnabled": true,               // 启用日志
    "logDir": "Data Import/Process Log"  // 日志目录
  }
}

---

## 执行顺序

### 当前配置的执行顺序

1. HH EXPRESS
   - 查询：_hh_query_batch.js
   - 回写：_hh_writeback.js --write
   - 验证：_hh_verify.js

2. YANWEN（燕文物流）
   - 查询：_yanwen_query_batch.js
   - 回写：_yanwen_writeback.js --write
   - 验证：_yanwen_verify.js

3. YUNEXPRESS（云途物流）
   - 查询：_yun_query_batch.js
   - 回写：_yun_writeback.js --write
   - 验证：_yun_verify_writeback.js

### 执行流程

每个物流商执行完整的三步流水线：
1. 查询（Query）：从物流商 API 获取运单状态数据
2. 回写（Writeback）：将查询结果写入数据库
3. 验证（Verify）：验证回写结果的完整性和准确性

---

## 如何修改配置

### 方法一：使用命令行管理工具（推荐）

#### 查看当前配置
cd customer_portal/tools
node manage-schedule.js

#### 查看状态摘要
node manage-schedule.js --status

#### 启用/禁用定时任务
node manage-schedule.js --enable
node manage-schedule.js --disable

#### 修改执行时间
node manage-schedule.js --time=03:00
node manage-schedule.js --time=06:30
node manage-schedule.js --time=22:00

#### 调整执行顺序
node manage-schedule.js --order=YUN,HH,YANWEN
node manage-schedule.js --order=YANWEN,HH

注意：未列出的物流商会保持原顺序追加到末尾
支持简写：HH=HH EXPRESS, YUN=YUNEXPRESS

#### 单独控制物流商
node manage-schedule.js --disable-carrier=HH
node manage-schedule.js --enable-carrier=HH
node manage-schedule.js --disable-carrier=YANWEN
node manage-schedule.js --disable-carrier=YUN

#### 配置错误处理策略
node manage-schedule.js --stop-on-error
node manage-schedule.js --no-stop-on-error

### 方法二：直接编辑配置文件

1. 打开文件：customer_portal/tools/schedule-config.json
2. 修改对应的配置项
3. 保存文件（确保格式为 UTF-8 无 BOM）

---

## 常用命令示例

### 场景一：临时暂停定时任务
node manage-schedule.js --disable
node manage-schedule.js --enable

### 场景二：只执行特定物流商
node manage-schedule.js --disable-carrier=YANWEN
node manage-schedule.js --disable-carrier=YUN
node manage-schedule.js --enable-carrier=HH
node scheduler.js --once

### 场景三：修改执行时间并立即测试
node manage-schedule.js --time=05:00
node scheduler.js --dry-run --once
node scheduler.js --once

### 场景四：启动守护进程
node scheduler.js

---

## 故障排查

### 问题一：配置文件加载失败
错误信息：!! 加载配置失败: Unexpected token ...
原因：配置文件格式错误或包含 BOM
解决方法：
1. 使用 JSON 验证工具检查格式
2. 确保文件编码为 UTF-8 无 BOM
3. 重新保存配置文件

### 问题二：定时任务未按时执行
检查步骤：
1. 确认总开关已启用：node manage-schedule.js --status
2. 确认调度器正在运行：Get-Process node
3. 检查执行时间配置是否正确：node manage-schedule.js

### 问题三：某个物流商执行失败
排查方法：
1. 查看日志文件：customer_portal/Data Import/Process Log/
2. 单独测试该物流商的脚本：node _hh_query_batch.js
3. 检查该物流商是否启用：node manage-schedule.js --status

---

## 快速参考卡片

查看配置：node manage-schedule.js
查看状态：node manage-schedule.js --status
启用任务：node manage-schedule.js --enable
禁用任务：node manage-schedule.js --disable
修改时间：node manage-schedule.js --time=03:00
调整顺序：node manage-schedule.js --order=YUN,HH,YANWEN
启用物流商：node manage-schedule.js --enable-carrier=HH
禁用物流商：node manage-schedule.js --disable-carrier=YUN
立即执行：node scheduler.js --once
模拟运行：node scheduler.js --dry-run --once
启动守护：node scheduler.js

---

文档版本：v1.0
最后更新：2026-10-20

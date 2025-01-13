# HLCL: 高级指令编程语言
Language: **简体中文** | [English](a)

一个 **CBLDL** (Command Block Logic Description Language, 命令方块逻辑描述语言) 标准的实例,
为MCBE1.18指令设计的编程语言。
其可简化大型指令系统的逻辑表达、构建、存储与修改。

# 待办事项
- ❌ CBLDL新标设计
  - ❌ ``start``与``stop``关键字
    - ❌CBG文件及其格式
    - ❌模块位置与联系
    - ❌Wrapper坐标系
  - ❌链本位编程及其优化
    - ❌变量虚拟实体分配优化
    - ❌条件命令块控制流优化
  - ❌实体本位编程及其优化
    - ❌execute实体层合并
    - ❌执行者相关选择器优化
    - ❌逆选优化
    - ❌临时计分项生命周期管理
  - ❌

# 语言与编译特性
- 使用类似于JS的语法及变量定义模式操作指令及计分项。
- 基于原版指令的底层操作模式。
- 基于模块及链的程序架构。
- 编译结果以模块或指令区整体为单位。

# 示例
见[examples-zh_CN.md]()。
```
// 默认计分项声明
#defaultscb "bkstage"

// 变量声明
var itemCtr;

// 命名模块
chain itemClear repeating {
  // 赋值
  itemCtr = @e[type=item];
  // 链本位条件语句
  if (itemCtr > 200)
    // 原版指令表达式
    `kill @e[type=item]`;

  // 硬延迟语句
  delayh 4;
}

// 匿名模块
module {
  while (1) {
    
  }
}
```
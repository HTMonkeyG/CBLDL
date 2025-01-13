# HLCL示例
## 链与模块
```
chain Test1 pulse {
  // 一条脉冲链
  // 使用反引号括起来的字符串为原版指令
  `say a`;
  // 硬延迟语句
  delayh 10;
  `say b`;
}

chain Test2 repeating {
  // 一条重复链
  `say a`;
  `say b`;
  // 硬延迟语句
  delayh 10;
}

module Test3 {
  // 一个模块
  // 相比于链，模块允许循环，但不允许硬延迟
  while (@e[tag=!qf])
    // 选择器 += 字符串
    // 表示添加标签
    @e[c=1] += "qf";
}
```

## 条件分支
```
chain repeating {
  // 一个匿名链
  // 不可被start或stop语句开启或停止

  // 选择器被强行转换为数字
  // 即该选择器选择的实体数量
  if (@e[type=item] > 100)
    // 直接在初始实体层下的if-else语句相当于条件命令块
    `kill @e[type=item]`;
  delayh 3;
}
```

## 开启或关闭模块
```
var flag = 0
  , flag2 = 0;

chain ToBeTurnedOff repeating {
  `say "关掉这条链"`;
  flag = 1;
}

chain Parent repeating {
  if (flag) {
    stop ToBeTurnedOff;
    stop Parent;
    flag = 0;
  }
}

// 标识默认情况下的开启或关闭状态
start Parent;
start ToBeTurnedOff;
```

## 实体本位
### 箭头execute
```
chain Grenade repeating {
  // 箭头execute即: 选择器 => 语句
  // 相当于对之后的语句(块)内所有指令都添加一条execute as ... at @s run
  // 把执行者转换为给定选择器
  @e[type=item, name=aaa] => {
    `fill ~-2~~-2 ~2~~2 potatoes`;

    // 箭头execute可嵌套
    @e[type=item, name=马铃薯, r=2] => {
      `summon ender_crystal ~~~ minecraft:crystal_explode`;
      `kill @e[type=item, name=aaa, r=2]`;
    }
  }
}

chain Test repeating {
  @e => {
    // 在某一execute语句下
    // 可使用initial关键字将执行者重置为命令方块本身
    initial => `say 666`;
  }
}
```

## 预处理语句
### #define
```
#define MAX_ENTITY 1800

chain repeating {
  // 在编译时直接将对应宏标识符替换为宏的定义
  if (@e > MAX_ENTITY)
    `kill @e[type=!player]`;
  delayh 3;
}
```

### #defaultscb
```
// 仅可在文件头使用
// 标识该文件下的默认计分板
// 相当于#define DEFAULTSCB "bkstage"
// 可以使用DEFAULTSCB引用该编译器宏
// 但不可使用#define重定义
#defaultscb "bkstage"
```

### #dup
```
chain pulse {
  // 该语句较为复杂
  // 可定义多个仅用于当前#dup块下的局部宏, 并用方括号表示其取值
  // 编译处理时对于每个宏遍历所有取值, 且重复拼接#dup块下内容多次, 每次都将对应宏的取值改变
  // 如下是一个二分法
#dup N [128, 64, 32, 16, 8, 4, 2, 1]
     N_ [255, 127, 63, 31, 15, 7, 3, 1]

  @e[tag=b,scores={f=${N}..${_N}}] => {
    `tp @s ~~~${N}`;
    @s.f -= N;
  }

#enddup
}

chain pulse {
  // 将上述dup展开后相当于该链
  @e[tag=b,scores={f=${128}..${255}}] => {
    `tp @s ~~~${128}`;
    @s.f -= 128;
  }

  @e[tag=b,scores={f=${64}..${127}}] => {
    `tp @s ~~~${64}`;
    @s.f -= 64;
  }

  @e[tag=b,scores={f=${32}..${63}}] => {
    `tp @s ~~~${32}`;
    @s.f -= 32;
  }

  // ...
}
```
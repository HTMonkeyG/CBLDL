# CBLDL示例
&emsp;&emsp;本文包括了一些CBLDL示例，用于辅助理解标准内容。使用的命令块表达方式如下：
```
PCB 脉冲命令块
CCB 链命令块
RCB 循环命令块

+K 保开
+C 条件
-d <延迟>

RCB +K -d 10 say a
表示一个指令为say a、延迟10的循环保开

RCB或PCB后跟中间无空行的CCB表示一条链
```

## 1 阈值实体清除
```
int entityCtr; // 全局变量会在$DefaultScb保留原始字符序列

chain repeating {
  entityCtr = @e;
  if(entityCtr > 1800) {
    `kill @e[type=!player]`;
  }
}
```
&emsp;&emsp;其相当于
```
RCB +K  scoreboard players set entityCtr $DefaultScb 0
CCB +K  execute @e ~~~ scoreboard players add entityCtr $DefaultScb 1
CCB +K  scoreboard players test entityCtr $DefaultScb 1801
CCB +KC kill @e
```

## 2 丢出特定物品爆炸
```
chain repeating {
  @e[name=aaa,type=item] => {
    `fill ~-2~~-2 ~2~~2 potatoes`;
    @e[name=马铃薯,r=2.5] => {
      `summon ender_crystal ~~~ minecraft:crystal_explode`;
      `kill @e[name=aaa,type=item,r=2.5]`;
    }
  }
}
```
&emsp;&emsp;其相当于
```
RCB +K execute @e[name=aaa,type=item] ~~~ fill ~-2~~-2 ~2~~2 potatoes
CCB +K execute @e[name=aaa,type=item] ~~~ execute @e[name=马铃薯,r=2.5] ~~~ summon ender_crystal ~~~ minecraft:crystal_explode
CCB +K execute @e[name=aaa,type=item] ~~~ execute @e[name=马铃薯,r=2.5] ~~~ kill @e[name=aaa,type=item,r=2.5]
```

## 3 Execute的一些说明
&emsp;&emsp;不管是类原版execute还是箭头execute，它们都是指令级的：也即在语句编译为指令后才会作用于其之上。且execute对执行者的改变仅对下列表达（的部分）有效：
+ 原版指令。
+ 对含有选择器的Vector的赋值。仅对赋值本身起效，而不是整个表达式。
+ execute语句。
+ 选择器+=或-=的标签操作。
+ 右侧仅有一个含有选择器的Vector的复合赋值。
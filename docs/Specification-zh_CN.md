# CBLDL语言标准v1.0
## 1 序
&emsp;&emsp;CBLDL是针对MCBE1.18指令开发的一个编程语言，其编译目标是命令方块，某些情况下也可以编译为.mcfunction。  
&emsp;&emsp;在这篇标准中将介绍CBLDL语言的语法及其实现方式。  

## 2 概览
&emsp;&emsp;CBLDL是一个与C类似的强类型语言。单个CBLDL程序表述了一整个指令系统，而指令系统中的单个模块或命令链则在程序中由各自独立的程序段表述。其在编译时会被组合在一起，成为一个整体的指令系统。

## 2.1 术语
&emsp;&emsp;为了表述方便，应用以下术语进行表达。

### 2.1.1 类型
&emsp;&emsp;由一系列在第4节中定义的数据值构成的集合。

### 2.1.2 字符串
&emsp;&emsp;一个字符串为一有限的由一系列16位有符号整数构成的数组。一般情况下，该数组中每一元素均表述一UTF-16字符。  
&emsp;&emsp;该数组内元素无法以任何方式从CBLDL层面访问，其仅可作为整体。

### 2.1.3 整型
&emsp;&emsp;一个整型为一32位有符号整数，与MC中保持一致。

### 2.1.4 选择器
&emsp;&emsp;一个选择器为一与游戏内选择器一致的字符序列，其指代一系列满足条件的实体。

### 2.1.5 计分板向量
&emsp;&emsp;计分板向量由一个指代记分项的字符串和一个指代目标的选择器或字符串组成。

# 3 语法符号
## 3.1 基本约定
&emsp;&emsp;本标准中使用的语法符号及产生式在没有特殊说明情况下均遵循以下约定。
```
# 被尖括号括起来的为非终结符
<Non-Terminal>
# 无尖括号标记或单个出现的为终结符
Terminal
# 被方括号括起来的为可选成分
[<Non-Terminal>]
```
&emsp;&emsp;例如，下方产生式
```
<IfStatement> :
  if ( <Expression> ) <Statement>
```
表达了一个非终结符```<IfStatement>```可以由终结符```if```后跟一个左括号后跟一个非终结符```<Expression>```后跟一个右括号后跟一个非终结符```<Statement>```推导得出。  
&emsp;&emsp;用空格分隔开的字符为两个独立的语法符号；若一个非终结符对应多条产生式，则用换行将产生式之间分隔开，如：
```
<GetScore> :
  <PrimaryExpression> -> <PrimaryExpression>
  <PrimaryExpression> . <Identifier>
  <PrimaryExpression>
```

## 3.2 one-of 标记
&emsp;&emsp;one-of 标记表明其后的所有语法符号均为可选项。例如
```
<AssignmentOperator> : one-of
  = += -= *= /= %= 
```
等同于
```
<AssignmentOperator> : 
  = 
  += 
  -= 
  *= 
  /= 
  %= 
```
# 4 CBLDL类型
&emsp;&emsp;CBLDL的类型分为常量类型和引用类型。  

## 4.1 常量类型
&emsp;&emsp;常量类型又称字面量类型，此种类型的值等于其字面量，且无法在运行时修改。  

### 4.1.1 字符串（String）
&emsp;&emsp;一个字符串在编译器层面为一有限的由一系列16位有符号整数构成的数组。一般情况下，该数组中每一元素均表述一UTF-16字符。  

### 4.1.2 选择器（Selector）
&emsp;&emsp;选择器提供了在CBLDL层面访问实体的方式，其语法与游戏内保持一致。

#### 4.1.2.1 GetCount(S)方法
&emsp;&emsp;1. 返回S选中的实体数量。等价于指令  
```
scoreboard players set ${return} 0
execute as ${S} run scoreboard players add ${return} 1
```

### 4.1.3 整型（Int）
&emsp;&emsp;一个整型为一个-2147483648至2147483647间的整数。

### 4.1.3 浮点型（Float）
&emsp;&emsp;一个浮点型为一个符合IEEE-754标准的双精度浮点数。

## 4.2 引用类型
&emsp;&emsp;引用类型类似指针，是CBLDL操作计分项分数的方式。其连接了一个或多个（虚拟）实体及给定计分项，以表示实体在计分项中存储的分数。

### 4.2.1 计分板向量（Vector）
&emsp;&emsp;计分板向量由一个指代记分项的字符串S和一个指代目标的选择器或字符串T组成。这是在CBLDL中对计分板的访问方法。  
&emsp;&emsp;若一个计分项向量作为赋值表达式的左侧参与运算，则其包含的所有实体在对应计分项的分数均会被赋值为表达式的右侧值。  
&emsp;&emsp;本标准中使用以下抽象方法来访问计分项向量的组成成分：
+ GetTarget(V)，返回V的目标T。
+ GetScoreboard(V)，返回V的计分板S。
+ toScbString()，返回```<target-string> <scoreboard-string>```的形式；其中```<target-string>```为T，```<scoreboard-string>```为S。

&emsp;&emsp;在本标准中使用以下抽象方法来描述计分项操作：

#### 4.2.1.1 GetScore(V)方法
1. 如果typeof(V)不为Vector，报**TypeError**。
2. 调用GetTarget(V)。
3. 调用GetScoreboard(V)。
4. 如果typeof(Result(2))为String，返回虚拟实体Result(2)在计分项Result(3)上的分数。
5. 如果typeof(Result(2))为Selector，返回实体Result(2)在计分项Result(3)上的分数。

&emsp;&emsp;需要注意的是，上述操作中若Result(2)中包含多个实体，则该操作是一个**不确定操作**，编译器无需确定该操作结果。

#### 4.2.1.2 PutScore(V, W)方法
1. 如果typeof(V)不为Vector，则报**TypeError**。
2. 执行GetValue(W)。
3. 如果Result(2)不为Int，则报**TypeError**。
5. 将所有T中包含的(虚拟)实体在S中的分数设为Result(2)。

#### 4.2.1.3 ReduceScoreSum(V)方法
1. 调用GetTarget(V)。
2. 调用GetScoreboard(V)。  
3. 求出Result(1)中所有实体在计分项Result(2)上的分数之和。等价于指令：  
```
scoreboard players set ${Result(3)} 1
scoreboard players operation ${Result(3)} += ${Result(1)} ${Result(2)}
```
4. 返回Result(3)。

#### 4.2.1.4 ReduceScoreMul(V)方法
1. 调用GetTarget(V)。
2. 调用GetScoreboard(V)。  
3. 求出Result(1)中所有实体在计分项Result(2)上的分数之积。等价于指令：  
```
scoreboard players set ${Result(3)} 1
scoreboard players operation ${Result(3)} *= ${Result(1)} ${Result(2)}
```
4. 返回Result(3)。

### 4.2.2 变量引用
&emsp;&emsp;**变量引用不是一个实际的数据类型。** 该类型使用计分项向量实现，其仅在本标准中作为辅助说明变量的实现而定义。CBLDL实现须以标准中描述的方式操作变量引用。但同时，变量引用仅可用于表达式求值过程的中转，不可存储为变量的实际值。  
&emsp;&emsp;变量引用是一种特殊的记分项向量，其对应的计分板指向全局默认计分板($DefaultScb)，用于描述变量的取值、赋值运算等运算类型，比如一个赋值运算的左值应生成一个变量引用。  
&emsp;&emsp;变量引用的目标为一个用于描述该变量存储位置(复用的虚拟实体的名字，也叫寄存器)的字符串。

&emsp;&emsp;在本标准中使用以下抽象方法来操作变量引用：

#### 4.2.2.1 GetValue(V)方法
1. 如果V不是一个变量引用，则跳转到步骤4。
2. 调用GetScore(V)。
3. 返回Result(2)。
4. 如果typeof(V)不为Vector，则直接返回V。
5. 调用GetScore(V)。
6. 返回Result(5)。

#### 4.2.2.2 PutValue(V, W)方法
1. 调用GetValue(W)。
2. 如果V不是一个变量引用，则跳转到步骤5。
3. 调用PutScore(V, Result(1))。
4. 返回。
5. 如果typeof(V)不为Vector，报**ReferenceError**。
6. 调用PutScore(V, Result(1))。
7. 返回。

# 5 类型转换
&emsp;&emsp;CBLDL是强类型语言，同时其仅允许自动的强制类型转换。下方为编程语言内置的类型转换函数。这些函数无法在语言层面调用，也不是保留字，其效果由编译器实现。

## 5.1 ToInt
&emsp;&emsp;该方法将其输入根据以下规则转换为Int：
|输入类型|操作|
|-|-|
|Bool|若其值为true，则转换为1；为false时，转换为0|
|Int|不作更改|
|Vector|根据???节的方式处理|
|Selector|返回GetCount(输入)|

&emsp;&emsp;其余类型不允许转换。

## 5.2 ToBoolean
&emsp;&emsp;该方法将其输入根据以下规则转换为Bool：
|输入类型|操作|
|-|-|
|Bool|不作更改|
|Int|若输入等于0，则转换为true，否则转换为false|
|Vector|根据5.1节的方式处理为整型后，按照整型处理|
|Selector|若选择器能选择到目标则转换为true，否则转换为false|

&emsp;&emsp;其余类型不允许转换。

## 5.3 ToString
&emsp;&emsp;该方法将其输入根据以下规则转换为String：
|输入类型|操作|
|-|-|
|Vector|转换为```<target-string> <scoreboard-string>```的形式；其中```<target-string>```为Vector的目标执行ToString的结果，```<scoreboard-string>```为Vector的计分项执行ToString的结果|
|Selector|转换为选择器原始字符串|
|String|不作更改|

&emsp;&emsp;其余类型不允许转换。

# 6 表达式
## 6.1 初级表达式
```
<PrimaryExpression> :
  <Identifier>
  <Literal>
  <VanillaCommand>
  ( <Expression> )
```

## 6.2 左值表达式
```
<GetScoreExpression> :
  <PrimaryExpression>
  <PrimaryExpression> -> <PrimaryExpression>
  <PrimaryExpression> . <Identifier>

<LeftHandSideExpression> :
  <GetScoreExpression>
```

### 6.2.1 取分算符
&emsp;&emsp;取分算符用于对实体在某一计分项中的分数进行操作。其有两种表达形式：小箭头```->```或点```.```符号。  
&emsp;&emsp;```<PrimaryExpression> . <Identifier>```  
的行为等同于  
&emsp;&emsp;```<PrimaryExpression> -> <identifier-string>```  
其中```<identifier-string>```是一个与```<Identifier>```包含相同字符序列的字符串。  
&emsp;&emsp;产生式```<GetScoreExpression>: <PrimaryExpression> -> <PrimaryExpression>```求值过程如下：  
1. 求值取分算符左侧的```<PrimaryExpression>```。  
2. 求值取分算符右侧的```<PrimaryExpression>```。  
3. 如果Result(2)不为字符串或选择器，Result(1)不为字符串，报**TypeError**。  
4. 返回一个目标为Result(1)、记分项为Result(2)的Vector。

## 6.3 后缀算符
```
<PostfixExpression> :
  <LeftHandSideExpression>
  <LeftHandSideExpression> ++
  <LeftHandSideExpression> --
```
### 6.3.1 后缀递增算符
&emsp;&emsp;产生式```<LeftHandSideExpression> ++```求值过程如下：
1. 求值```<LeftHandSideExpression>```。
2. 调用GetValue(Result(1))。
3. 调用ToInt(Result(2))。
4. 使用等价于指令```scoreboard players add ${Result(3)} 1```的方式为Result(3)加1。
5. 调用PutValue(Result(1), Result(4))。
6. 返回Result(1)。

### 6.3.2 后缀递减算符
&emsp;&emsp;产生式```<LeftHandSideExpression> --```求值过程如下：
1. 求值```<LeftHandSideExpression>```。
2. 调用GetValue(Result(1))。
3. 调用ToInt(Result(2))。
4. 使用等价于指令```scoreboard players add ${Result(3)} -1```的方式为Result(3)减1。
5. 调用PutValue(Result(1), Result(4))。
6. 返回Result(1)。

## 6.4 单目算符
```
<UnaryExpression> :
  <PostfixExpression>
  ++ <UnaryExpression>
  -- <UnaryExpression>
  + <UnaryExpression>
  - <UnaryExpression>
  ! <UnaryExpression>
```

### 6.4.1 前缀递增算符
&emsp;&emsp;与后缀递增算符(6.3.1节)完全相同。

### 6.4.2 前缀递减算符
&emsp;&emsp;与后缀递减算符(6.3.2节)完全相同。

### 6.4.3 前缀+算符
&emsp;&emsp;前缀+算符将其操作对象转换为Int类型。
&emsp;&emsp;产生式```+ <UnaryExpression>```求值过程如下：
1. 求值```<UnaryExpression>```。
2. 调用GetValue(Result(1))。
3. 调用ToInt(Result(2))。
4. 返回Result(3)。

### 6.4.4 前缀-算符
&emsp;&emsp;前缀-算符将其操作对象转换为Int类型并且取相反数。
&emsp;&emsp;产生式```- <UnaryExpression>```求值过程如下：
1. 求值```<UnaryExpression>```。
2. 调用GetValue(Result(1))。
3. 调用ToInt(Result(2))。
4. 使用等价于语句```Result(3) *= -1```的方式对Result(3)取相反数。
5. 返回Result(4)。

### 6.4.5 逻辑取反算符
&emsp;&emsp;产生式```! <UnaryExpression>```求值过程如下：
1. 求值```<UnaryExpression>```。
2. 调用GetValue(Result(1))。
3. 调用ToBoolean(Result(2))。
4. 如果Result(3)为true，返回 false。
5. 返回true。

## 6.5 乘除运算
```
<MultiplicativeExpression> :
  <UnaryExpression>
  <MultiplicativeExpression> * <UnaryExpression>
  <MultiplicativeExpression> / <UnaryExpression>
  <MultiplicativeExpression> % <UnaryExpression>
```
&emsp;&emsp;产生式```<MultiplicativeExpression> : <MultiplicativeExpression> @ <UnaryExpression>```，其中@为上述表述中任一算符，求值过程如下：
1. 求值```<MultiplicativeExpression>```。
2. 调用GetValue(Result(1))。
3. 求值```<UnaryExpression>```。
4. 调用GetValue(Result(3))。
5. 调用ToInt(Result(2))。
6. 调用ToInt(Result(4))。
7. 使用乘除运算符(*，/，或者 %)对Result(5)和Result(6)进行运算。等效于指令：
```
scoreboard players operation ${Result(7)} = ${Result(5)}
scoreboard players operation ${Result(7)} @= ${Result(5)}
```
8. 返回Result(7)。

## 6.6 加减运算
```
<AdditiveExpression> :
  <MultiplicativeExpression>
  <AdditiveExpression> + <MultiplicativeExpression>
  <AdditiveExpression> - <MultiplicativeExpression>
```

&emsp;&emsp;产生式```<AdditiveExpression> : <AdditiveExpression> @ <MultiplicativeExpression>```，其中@为上述表述中任一算符，求值过程如下：
1. 求值```<AdditiveExpression>```。
2. 调用GetValue(Result(1))。
3. 求值```<MultiplicativeExpression>```。
4. 调用GetValue(Result(3))。
5. 调用ToInt(Result(2))。
6. 调用ToInt(Result(4))。
7. 使用加减运算符(+ 或者 -)对Result(5)和Result(6)进行运算。等效于指令：
```
scoreboard players operation ${Result(7)} = ${Result(5)}
scoreboard players operation ${Result(7)} @= ${Result(5)}
```
8. 返回Result(7)。

## 6.7 比较运算
```
<RelationalExpression> :
  <AdditiveExpression>
  <RelationalExpression> < <AdditiveExpression>
  <RelationalExpression> > <AdditiveExpression>
  <RelationalExpression> <= <AdditiveExpression>
  <RelationalExpression> >= <AdditiveExpression>
```

### 6.7.1 小于 ( < )
&emsp;&emsp;产生式```<RelationalExpression> : <RelationalExpression> < <AdditiveExpression>```求值过程如下：
1. 求值```<RelationalExpression>```。
2. 调用GetValue(Result(1))。
3. 求值```<AdditiveExpression>```。
4. 调用GetValue(Result(3))。
5. 执行比较逻辑Result(2) < Result(4)。(见 6.7.5)
6. 返回Result(5)。

### 6.7.2 大于 ( > )
&emsp;&emsp;产生式```<RelationalExpression> : <RelationalExpression> > <AdditiveExpression>```求值过程如下：
1. 求值```<RelationalExpression>```。
2. 调用GetValue(Result(1))。
3. 求值```<AdditiveExpression>```。
4. 调用GetValue(Result(3))。
5. 执行比较逻辑Result(4) < Result(2)。(见 6.7.5)
6. 返回Result(5)。

### 6.7.3 小于等于 ( <= )
&emsp;&emsp;产生式```<RelationalExpression> : <RelationalExpression> <= <AdditiveExpression>```求值过程如下：
1. 求值```<RelationalExpression>```。
2. 调用GetValue(Result(1))。
3. 求值```<AdditiveExpression>```。
4. 调用GetValue(Result(3))。
5. 执行比较逻辑Result(4) < Result(2)。(见 6.7.5)
6. 若Result(5)为true，则返回false；反之返回true。

### 6.7.4 大于等于 ( >= )
&emsp;&emsp;产生式```<RelationalExpression> : <RelationalExpression> >= <AdditiveExpression>```求值过程如下：
1. 求值```<RelationalExpression>```。
2. 调用GetValue(Result(1))。
3. 求值```<AdditiveExpression>```。
4. 调用GetValue(Result(3))。
5. 执行比较逻辑Result(2) < Result(4)。(见 6.7.5)
6. 若Result(5)为true，则返回false；反之返回true。

### 6.7.5 比较逻辑
&emsp;&emsp;一个类似于```x < y```的比较返回true或false。其求值过程如下：
1. 调用ToInt(x)。
2. 调用ToInt(y)。
3. 执行```Result(1) - Result(2)```。等价于指令：
```
scoreboard players operation ${Result(3)} = ${Result(1)}
scoreboard players operation ${Result(3)} -= ${Result(2)}
```
4. 如果Result(3)小于0，则返回true。
5. 否则返回false。  

&emsp;&emsp;需要注意的是，第3步中的减法使用的运算法则为32位有符号整数减法，无法保证是否溢出；而在溢出情况下结果可能不正确。

## 6.8 相等判定
```
<EqualityExpression> :
  <RelationalExpression>
  <EqualityExpression> == <RelationalExpression>
  <EqualityExpression> != <RelationalExpression>
```

### 6.8.1 等于 ( == )
&emsp;&emsp;产生式```<EqualityExpression> : <EqualityExpression> == <RelationalExpression>```求值过程如下：
1. 求值```<RelationalExpression>```。
2. 调用GetValue(Result(1))。
3. 求值```<AdditiveExpression>```。
4. 调用GetValue(Result(3))。
5. 执行相等判断逻辑Result(2) == Result(4)。(见 6.8.3)
6. 返回Result(5)。

### 6.8.2 不等于 ( != )
&emsp;&emsp;产生式```<EqualityExpression> : <EqualityExpression> != <RelationalExpression>```求值过程如下：
1. 求值```<RelationalExpression>```。
2. 调用GetValue(Result(1))。
3. 求值```<AdditiveExpression>```。
4. 调用GetValue(Result(3))。
5. 执行相等判断逻辑Result(2) == Result(4)。(见 6.8.3)
6. 若Result(5)为true，则返回false；反之返回true。

### 6.8.3 相等判断逻辑
&emsp;&emsp;一个类似于```x == y```的比较返回true或false。其求值过程如下：
1. 调用ToInt(x)。
2. 调用ToInt(y)。
3. 执行```Result(1) - Result(2)```。等价于指令：
```
scoreboard players operation ${Result(3)} = ${Result(1)}
scoreboard players operation ${Result(3)} -= ${Result(2)}
```
4. 如果Result(3)等于0，则返回true。
5. 否则返回false。

## 6.9 逻辑运算
```
<LogicalANDExpression> :
  <EqualityExpression>
  <LogicalANDExpression> && <EqualityExpression>

<LogicalORExpression> :
  <LogicalANDExpression>
  <LogicalORExpression> || <LogicalANDExpression>
```
&emsp;&emsp;产生式```<LogicalANDExpression> : <LogicalANDExpression> && <EqualityExpression>```求值过程如下：
1. 求值```<LogicalANDExpression>```。
2. 调用GetValue(Result(1))。
3. 调用ToBoolean(Result(2))。
4. 如果Result(3)为false，返回Result(2)。
5. 求值```<EqualityExpression>```。
6. 调用GetValue(Result(5))。
7. 返回Result(6)。

&emsp;&emsp;产生式```<LogicalORExpression> : <LogicalORExpression> && <LogicalANDExpression>```求值过程如下：
1. 求值```<LogicalORExpression>```。
2. 调用GetValue(Result(1))。
3. 调用ToBoolean(Result(2))。
4. 如果Result(3)为true，返回Result(2)。
5. 求值```<LogicalANDExpression>```。
6. 调用GetValue(Result(5))。
7. 返回Result(6)。

## 6.10 赋值运算
```
<AssignmentExpression> :
  <LogicalORExpression>
  <LeftHandSideExpression> <AssignmentOperator> <AssignmentExpression>

<AssignmentOperator> : one-of
  = += -= *= /= %=

<Expression> :
  <AssignmentExpression>
```
### 6.10.1 简单赋值 ( = )
&emsp;&emsp;产生式```<AssignmentExpression> : <LeftHandSideExpression> = <AssignmentExpression>```求值过程如下：
1. 求值```<LeftHandSideExpression>```。
2. 求值```<AssignmentExpression>```。
3. 调用GetValue(Result(2))。
4. 调用PutValue(Result(1), Result(3))。
5. 返回Result(1)。

### 6.10.2 复合赋值 ( += -= )
&emsp;&emsp;产生式```<AssignmentExpression> : <LeftHandSideExpression> @= <AssignmentExpression>```，其中@为上述产生式中任一算符，求值过程如下：
1. 求值```<LeftHandSideExpression>```。
2. 调用GetValue(Result(1))。
3. 求值```<AssignmentExpression>```。
4. 如果Result(3)为变量引用则跳转至步骤10。
5. 调用GetValue(Result(3))。
6. 调用ReduceScoreSum(Result(5))。
7. 使用@算符对Result(2)和Result(6)进行运算。等价于指令：
```
scoreboard players operation ${Result(7)} = ${Result(2)}
scoreboard players operation ${Result(7)} @= ${Result(6)}
```
8. 调用PutValue(Result(1), Result(7))。
9. 返回Result(1)。
10. 调用GetValue(Result(3))。
11. 使用@算符对Result(2)和Result(10)进行运算。等价于指令：
```
scoreboard players operation ${Result(11)} = ${Result(2)}
scoreboard players operation ${Result(11)} @= ${Result(10)}
```
12. 调用PutValue(Result(1), Result(11))。
13. 返回Result(1)。

### 6.10.2 复合赋值 ( *= /= %= )
&emsp;&emsp;产生式```<AssignmentExpression> : <LeftHandSideExpression> @= <AssignmentExpression>```，其中@为上述产生式中任一算符，求值过程如下：
1. 求值```<LeftHandSideExpression>```。
2. 调用GetValue(Result(1))。
3. 求值```<AssignmentExpression>```。
4. 如果Result(3)为变量引用则跳转至步骤10。
5. 调用GetValue(Result(3))。
6. 调用ReduceScoreMul(Result(5))。
7. 使用@算符对Result(2)和Result(6)进行运算。等价于指令：
```
scoreboard players operation ${Result(7)} = ${Result(2)}
scoreboard players operation ${Result(7)} @= ${Result(6)}
```
8. 调用PutValue(Result(1), Result(7))。
9. 返回Result(1)。
10. 调用GetValue(Result(3))。
11. 使用@算符对Result(2)和Result(10)进行运算。等价于指令：
```
scoreboard players operation ${Result(11)} = ${Result(2)}
scoreboard players operation ${Result(11)} @= ${Result(10)}
```
12. 调用PutValue(Result(1), Result(11))。
13. 返回Result(1)。

# 7 语句
```
<Statement> :
  <Block>
  <VariableStatement>
  <EmptyStatement>
  <ExpressionStatement>
  <IfStatement>
  <IterationStatement>
  <BreakStatement>
  <DelayHardStatement>
  <DeleteStatement>
  <ExecuteStatement>

<StatementNoDelayHard> :
  <BlockNoDelayHard>
  <VariableStatement>
  <EmptyStatement>
  <ExpressionStatement>
  <IfStatement>
  <IterationStatement>
  <BreakStatement>
  <DeleteStatement>
  <ExecuteStatement>
```
&emsp;&emsp;语句是CBLDL程序的最基础成分。

## 7.1 块（Block）
```
<Block> :
  { [<StatementList>] }

<StatementList> :
  <Statement>
  <StatementList> <Statement>

<BlockNoDelayHard> :
  { [<StatementListNoDelayHard>] }

<StatementListNoDelayHard> :
  <StatementNoDelayHard>
  <StatementListNoDelayHard> <StatementNoDelayHard>
```

## 7.2 变量定义语句（VariableStatement）
```
<VariableStatement> :
  <VariableTypes> <VariableDeclarationList> ;

<VariableTypes> : one-of
  var const

<VariableDeclarationList> :
  <VariableDeclarationList> , <VariableDeclaration>
  <VariableDeclaration>

<VariableDeclaration> :
  <Identifier>
  <Identifier> <Initialiser>

<Initialiser> :
  = <AssignmentExpression>
```

## 7.3 空语句（EmptyStatement）
```
<EmptyStatement> :
  ;
```

## 7.4 表达式语句（ExpressionStatement）
```
<ExpressionStatement> :
  <Expression> ;
```

## 7.5 If语句（IfStatement）
```
<IfStatement> :
  if ( <Expression> ) <Statement> else <Statement>
  if ( <Expression> ) <Statement>
```

## 7.6 循环语句（IterationStatement）
```
<IterationStatement> :
  do <Statement> while ( <Expression> ) ;
  while ( <Expression> ) <Statement>
```

## 7.7 Break语句（BreakStatement）
```
<BreakStatement> :
  break ;
```

## 7.8 硬延迟语句（DelayHardStatement）
```
<DelayHardStatement> :
  delayh <NumericLiteral> ;
```

## 7.9 重置计分项语句（DeleteStatement）
```
<DelayHardStatement> :
  delayh <NumericLiteral> ;
```

## 7.10 Execute实体层语句（ExecuteStatement）
```
<VanillaExecute> :
  at <PrimaryExpression>
  as <PrimaryExpression>
  positioned <PrimaryExpression>
  if block <PrimaryExpression>

<VanillaExecuteList> :
  <VanillaExecute> <VanillaExecuteList>

<ExecuteStatement> :
  <PrimaryExpression> => <Statement>
  execute <VanillaExecuteList> run <Statement>
```

# 8 模块
```
<ChainPulseModule> :
  chain pulse <Block>
  chain <Block>

<ChainRepeatingModule> :
  chain repeating <Block>

<CombinedModule> :
  module <BlockNoDelayHard>

<Module> :
  <ChainPulseModule>
  <ChainRepeatingModule>
  <CombinedModule>

<ModuleList> :
  <Module> <ModuleList>
  <Module>
```
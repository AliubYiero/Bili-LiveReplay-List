# 猛男寨直播录播分组列表

## 分组目录

- [[**Mr.Quin**]](./docx/Mr.Quin):
	- [Mr.Quin直播回放列表(from Mr.Quin)](./docx/Mr.Quin/Mr.Quin%E7%9B%B4%E6%92%AD%E5%9B%9E%E6%94%BE%E5%88%97%E8%A1%A8(from%20Mr.Quin).md)
	- [Mr.Quin直播回放列表(from 胧黑)](./docx/Mr.Quin/Mr.Quin%E7%9B%B4%E6%92%AD%E5%9B%9E%E6%94%BE%E5%88%97%E8%A1%A8(from%20%E8%83%A7%E9%BB%91).md)
	- [Mr.Quin直播回放列表(from 自行车二层)](./docx/Mr.Quin/Mr.Quin%E7%9B%B4%E6%92%AD%E5%9B%9E%E6%94%BE%E5%88%97%E8%A1%A8(from%20%E8%87%AA%E8%A1%8C%E8%BD%A6%E4%BA%8C%E5%B1%82).md)
- [[**北极熊剩饭**]](./docx/北极熊剩饭):
	- [北极熊剩饭直播回放列表(from 自行车二层)](./docx/%E5%8C%97%E6%9E%81%E7%86%8A%E5%89%A9%E9%A5%AD/%E5%8C%97%E6%9E%81%E7%86%8A%E5%89%A9%E9%A5%AD%E7%9B%B4%E6%92%AD%E5%9B%9E%E6%94%BE%E5%88%97%E8%A1%A8(from%20%E8%87%AA%E8%A1%8C%E8%BD%A6%E4%BA%8C%E5%B1%82).md)
- [[**机智的肯尼**]](./docx/机智的肯尼):
	- [机智的肯尼直播回放列表(from 自行车二层)](./docx/%E6%9C%BA%E6%99%BA%E7%9A%84%E8%82%AF%E5%B0%BC/%E6%9C%BA%E6%99%BA%E7%9A%84%E8%82%AF%E5%B0%BC%E7%9B%B4%E6%92%AD%E5%9B%9E%E6%94%BE%E5%88%97%E8%A1%A8(from%20%E8%87%AA%E8%A1%8C%E8%BD%A6%E4%BA%8C%E5%B1%82).md)
- [[**机皇**]](./docx/机皇):
	- [机皇直播回放列表(from 胧黑)](./docx/%E6%9C%BA%E7%9A%87/%E6%9C%BA%E7%9A%87%E7%9B%B4%E6%92%AD%E5%9B%9E%E6%94%BE%E5%88%97%E8%A1%A8(from%20%E8%83%A7%E9%BB%91).md)
	- [机皇直播回放列表(from 自行车二层)](./docx/%E6%9C%BA%E7%9A%87/%E6%9C%BA%E7%9A%87%E7%9B%B4%E6%92%AD%E5%9B%9E%E6%94%BE%E5%88%97%E8%A1%A8(from%20%E8%87%AA%E8%A1%8C%E8%BD%A6%E4%BA%8C%E5%B1%82).md)


## 项目描述

本项目通过识别录播Man上传的带游戏名的直播录像视频, 生成如以下形式的分组列表:

> ## Draw & Guess/你画我猜
>
> | 游戏名称              | 直播日期  | 时长     | 集数   | 标题                                                         |
> | --------------------- | --------- | -------- | ------ | ------------------------------------------------------------ |
> | Draw & Guess/你画我猜 | 2023/5/2  | 03:20:18 | Part 1 | [【Mr.Quin】2023年5月2日《红霞岛》+《Draw & Guess/你画我猜》弹幕录像](https://www.bilibili.com/video/av570720260/) |
> | Draw & Guess/你画我猜 | 2023/8/31 | 03:56:11 | Part 2 | [【Mr.Quin】2023年8月31日《装甲核心6/机战佣兵VI 境界天火》+《Draw & Guess/你画我猜》弹幕录像](https://www.bilibili.com/video/av532943857/) |

## 支持的录播Man

- Mr.Quin: https://space.bilibili.com/15810
- 胧黑: https://space.bilibili.com/245335
- 自行车二层: https://space.bilibili.com/1400350754



## 功能

1. 通过 Github Action 每天定时获取录播视频信息
2. 自动获取数据, 并进行简单处理成以下格式的数据:

```ts
interface RecordItem {
	aid: number;	// 视频 av 号
	bvId: string;	// 视频 bv 号
	publishTime: number;	// 视频发布时间(毫秒级时间戳)
	liveDuration: number;	// 视频的持续时长(秒)
	title: string;			// 视频标题
	liveTime: number;		// 直播时间 (毫秒级时间戳) (通过标题的日期识别)
	playGame: string[];		// 游玩的游戏列表 (通过标题识别)
	liver: 'Mr.Quin' | '机智的肯尼' | '北极熊剩饭' | '机皇';	// 对应的主播 (通过标题识别)
}
```

> 数据储存在本项目的 *[config/<uid>.record.json]* 文件下, 想要进一步处理可以使用.

3. 生成可视化文档, 详细文档见 [[分组目录](#分组目录)], 分组规则为:
	1. 通过 **主播** 生成对应的目录
	2. 每个主播目录下, 不同的 **上传者*(录播Man)*** 生成对应的文档
	3. 按直播时间降序 (从最新到最旧) 顺序排序数据
	4. 将一条录播数据提取为多条只存在单个游玩游戏的数据 (`playGame`是一个数组, 一个录播可能玩多个游戏)
	5. 将所有数据按游玩的游戏分组
		- 如果是曾经游玩过的游戏, 重新开始玩, 旧的数据也会提前到和最新的数据一起
	6. 按照将同一个游戏分组下的所有数据, 按直播时间升序 (从最旧到最新) 顺序排序
	7. 将数据生成为 Markdown 文本, 写入对应的文档中

> 游戏分组取决于录播Man写入的游戏名. 就算是同一个游戏, 如果打错字会识别为不同的游戏.
>
> 对于这部分错误内容, 有一个简单的纠错系统: [纠错](#纠错)



## 纠错

针对错别字, dlc, 上传者备注等情况导致的同一个游戏被识别为不同的游戏的情况, 项目将会通过以下方法进行纠错:

1. 去除所有括号
2. 去除 `残缺——`/`——残缺` 的备注
3. 去除 `——已爆炸` 的备注
4. 通过 ***错别字字典*** 进行纠正

> **错别字字典** 是一组键值对数据, 以 JSON 文件的形式保存在项目的 *[config/SpellingCorrections.json]* 文件中, 数据由**键名**为错误游戏名称, **值**为正确游戏名称的键值对组成:
>
> ```json
> {
>     "data2": "dota2"
> }
> ```
>
> 通过该错别字的映射关系, 可以在**输出**文档的时候, 将错误的游戏名称更正为正确的游戏名称, 从而让同一个游戏可以被归类到同一个游戏分组下.

### 更新错别字字典

**方法一**: 修改 *[config/SpellingCorrections.json]* 文件, 提交 **PR**.

> 提交 PR 时请注明, 该修改是针对哪一个文档的修改.

**方法二**: 使用以下格式提交 **Issue**

> **标题**
>
> ```
> [错别字字典更新请求]
> ```
>
> **正文**
>
> ```
> 文件:
> 错误游戏名称:
> 更新游戏名称:
> ```
>
> ---
>
> **示例正文**
>
> ```
> 文件: Mr.Quin直播回放列表(from 自行车二层).md
> 错误游戏名称: 幻想生活i
> 更新游戏名称: 幻想生活i：转圈圈的龙与偷取时间的少女
> ```



## Build

> 安装依赖

```
pnpm install
```

> 运行项目

```
npm run dev
```

> 获取数据 & 生成 Markdown 文档 & 更新 README

```
npm run start
```

### 自定义主播解析

> 1. fork 项目
> 2. 将 fork 的项目拉取到本地
> 3. 启动项目

---

> 1. 进入文件 `src/module/matchData/handleParseMapper.ts` 文件
> 2. 在 `handleParseMapper` 数组中新增一个对象, 对象必须包含以下内容:

| 属性       | 类型                                                        | 描述             |
| ---------- | ----------------------------------------------------------- | ---------------- |
| `uid`      | `number`                                                    | 上传者的uid      |
| `userName` | `string`                                                    | 上传者的用户名称 |
| `onParse`  | `( item: UnparseRecordItem ) => Promise<RecordItem | null>` | 解析函数         |

```ts
export interface IParseItem {
	uid: number;
	userName: string;
	onParse: ( item: UnparseRecordItem ) => Promise<RecordItem | null>;
}
```

---

**`onParse` 函数**

`onParse` 函数传入的参数是一个未被解析的原始视频数据 `UnparseRecordItem` , 内容如下:

| 属性           | 类型     | 描述                          |
| -------------- | -------- | ----------------------------- |
| `aid`          | `number` | 视频的 av 号                  |
| `bvId`         | `string` | 视频的 bv 号                  |
| `publishTime`  | `number` | 视频的发布时间 (毫秒级时间戳) |
| `liveDuration` | `number` | 视频的时长 (秒)               |
| `title`        | `string` | 视频标题                      |

`onParse` 函数需要返回一个解析完成后视频数据 `RecordItem` , 内容如下:

| 属性           | 类型            | 描述                          |
| -------------- | --------------- | ----------------------------- |
| `aid`          | `number`        | 视频的 av 号                  |
| `bvId`         | `string`        | 视频的 bv 号                  |
| `publishTime`  | `number`        | 视频的发布时间 (毫秒级时间戳) |
| `liveDuration` | `number`        | 视频的时长 (秒)               |
| `title`        | `string`        | 视频标题                      |
| `liveTime`     | `number`        | 直播的日期 (毫秒级时间戳)     |
| `playGame`     | `Array<string>` | 游玩的游戏列表                |
| `liver`        | `string`        | 主播                          |

需要解析的数据为: `liveTime`, `playGame` 和 `liver`, 剩下的数据直接解构 `UnparseRecordItem` 即可.
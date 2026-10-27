# 云途 YUNExpress 运单批量查询结果（交运日 2026-01-15）

- 数据源文件: YUNEXPRESS_track_2026-01-15_20261019_164637.json
- 查询接口: GET /v1/track-service/info/get（状态+轨迹）、POST /v1/order/last-mile/get（尾程跟踪号）
- 状态映射来源: source/lib/admin/column-maps/carrier-shipment-config.ts（单一数据源）
- 本次为只读查询，未写入数据库

## 一、总体统计

| 项目 | 数量 |
|---|---|
| 运单总数 | 65 |
| API 查询成功 | 65 |
| API 查询失败 | 0 |
| 取得尾程跟踪号 | 65 |

## 二、API 状态码  数据库状态 映射

映射链路：`package_status`  `API_STATUS_MAP` 中文状态名  `SHIPMENT_STATUS_MAP` 数据库枚举

| API 状态码 | 官方释义 | 配置中文状态 | 数据库 shipment_status | 数量 |
|---|---|---|---|---|
| D | 投递成功 | 已签收 | shipped | 65 |

### 完整映射表（carrier-shipment-config 中 YUNExpress 的 API_STATUS_MAP）

| API package_status | 官方释义 | 映射到的中文状态 | 数据库枚举 |
|---|---|---|---|
| F | 已接收电子预报 | 已预报 | created |
| T | 运输中 | 运输中 | shipped |
| D | 投递成功 | 已签收 | shipped |
| E | 可能异常 | 异常 | shipped |
| R | 包裹退回 | 已退件 | cancelled |
| C | 订单取消 | 已取消 | cancelled |
| N | 订单未找到 | （null，无业务状态） | null  不更新 shipment_status |

> 未在表中出现的 API 状态码同样返回 null，按「未映射状态安全处理规则」跳过 shipment_status 更新。

## 三、与库中数据比对

| shipment_status 比对 | 数量 |
|---|---|
| 一致 | 65 |

| dest_tracking 比对 | 数量 |
|---|---|
| 一致 | 65 |

## 四、尾程派送商分布

| 尾程商 | 数量 |
|---|---|
| SP0281 / 英国 INPOST | 10 |
| DEDHL-INTL / 德国DHL INTL | 8 |
| DEDPD / 德国DPD | 7 |
| SP0134 / 爱尔兰 邮政 | 6 |
| SP1600 / 美国 Gofo | 6 |
| UK-HERMES SORT / 英国Evri预分拣 | 5 |
| AT-ATPOST / 奥地利邮政 | 3 |
| DEDHLS / 德国DHL预分拣 | 3 |
| UK-RM / 英国Royal mail | 2 |
| SP1844 / 澳大利亚SPEEDX | 2 |
| SP0656 / 加拿大 Intelcom | 2 |
| SP1695 / 瑞士-NOVA | 2 |
| JFK OSM / JFK OSM | 2 |
| CAPOST / 加拿大邮政 | 1 |
| PARCEL POST / 澳大利亚 Parcel Post  | 1 |
| ORD USPS FC / ORD USPS FC | 1 |
| DFW OSM / DFW OSM | 1 |
| GR-DPD / 希腊DPD | 1 |
| SP1647 / 加拿大 Emile | 1 |
| SG-JT / 新加坡极兔 | 1 |

## 五、全部明细（65 条）

| # | 运单号 | API状态 | 中文状态 | 映射后DB状态 | 库中状态 | 状态比对 | 尾程跟踪号(API) | 库中dest_tracking | 尾程号比对 | 尾程商 | 目的国 | 最新轨迹时间 | 最新轨迹 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | YT2601500701843557 | D | 已签收 | shipped | shipped | 一致 | IW726625192GB | IW726625192GB | 一致 | UK-RM | GB | 2026-01-31T15:12:13Z | Safeplace Delivered |
| 2 | YT2601500701843573 | D | 已签收 | shipped | shipped | 一致 | JJD0002234220810138 | JJD0002234220810138 | 一致 | SP0281 | GB | 2026-01-24T12:56:51Z | Delivered - left as authorised |
| 3 | YT2601500701843581 | D | 已签收 | shipped | shipped | 一致 | 01505493475079 | 01505493475079 | 一致 | DEDPD | DE | 2026-01-27T13:07:13Z | Delivered. , Evidence |
| 4 | YT2601500701843607 | D | 已签收 | shipped | shipped | 一致 | JJD0002234220801174 | JJD0002234220801174 | 一致 | SP0281 | GB | 2026-01-23T14:10:01Z | Delivered - item posted |
| 5 | YT2601500701843615 | D | 已签收 | shipped | shipped | 一致 | SPXSYD087200253569 | SPXSYD087200253569 | 一致 | SP1844 | AU | 2026-01-25T18:53:02Z | Delivered. Position: Front door |
| 6 | YT2601500701843623 | D | 已签收 | shipped | shipped | 一致 | 00340434525201501212 | 00340434525201501212 | 一致 | DEDHL-INTL | DE | 2026-02-04T16:04:13Z | The shipment has been successfully delivered |
| 7 | YT2601500701843631 | D | 已签收 | shipped | shipped | 一致 | JJD0002234220810174 | JJD0002234220810174 | 一致 | SP0281 | GB | 2026-01-24T10:58:11Z | Delivered, handed to customer |
| 8 | YT2601500701843649 | D | 已签收 | shipped | shipped | 一致 | CB084748254IE | CB084748254IE | 一致 | SP0134 | IE | 2026-01-28T09:35:29Z | Item has been sucessfully delivered |
| 9 | YT2601500701843664 | D | 已签收 | shipped | shipped | 一致 | H00RVA0456750977 | H00RVA0456750977 | 一致 | UK-HERMES SORT | GB | 2026-01-21T17:38:24Z | Parcel delivered with a signature |
| 10 | YT2601500701843680 | D | 已签收 | shipped | shipped | 一致 | 7321315483197321 | 7321315483197321 | 一致 | CAPOST | CA | 2026-02-02T17:17:41Z | DELIVERED |
| 11 | YT2601500701852178 | D | 已签收 | shipped | shipped | 一致 | CRIN26011616429239 | CRIN26011616429239 | 一致 | SP0656 | CA | 2026-01-24T10:37:53Z | Completed Unloading at Delivery Location:Normal Status |
| 12 | YT2601500701870139 | D | 已签收 | shipped | shipped | 一致 | CB082909753IE | CB082909753IE | 一致 | SP0134 | IE | 2026-01-27T12:08:37Z | Item has been sucessfully delivered |
| 13 | YT2601500702042100 | D | 已签收 | shipped | shipped | 一致 | CB082908996IE | CB082908996IE | 一致 | SP0134 | IE | 2026-01-27T09:00:27Z | Item has been sucessfully delivered |
| 14 | YT2601500702042118 | D | 已签收 | shipped | shipped | 一致 | CB082909223IE | CB082909223IE | 一致 | SP0134 | IE | 2026-01-27T07:54:25Z | Item has been sucessfully delivered |
| 15 | YT2601500702042142 | D | 已签收 | shipped | shipped | 一致 | JJD0002234220801189 | JJD0002234220801189 | 一致 | SP0281 | GB | 2026-01-23T12:19:11Z | Delivered, handed to customer |
| 16 | YT2601500702042175 | D | 已签收 | shipped | shipped | 一致 | JJD0002234220801209 | JJD0002234220801209 | 一致 | SP0281 | GB | 2026-01-24T14:15:11Z | Delivered - left with neighbour |
| 17 | YT2601500702042274 | D | 已签收 | shipped | shipped | 一致 | JJD0002234220800864 | JJD0002234220800864 | 一致 | SP0281 | GB | 2026-01-23T08:56:51Z | Delivered - left as authorised |
| 18 | YT2601500702042431 | D | 已签收 | shipped | shipped | 一致 | JJD0002234220801169 | JJD0002234220801169 | 一致 | SP0281 | GB | 2026-01-23T13:56:51Z | Delivered, handed to customer |
| 19 | YT2601500702042449 | D | 已签收 | shipped | shipped | 一致 | JJD0002234220801154 | JJD0002234220801154 | 一致 | SP0281 | GB | 2026-01-24T13:05:01Z | Delivered, handed to customer |
| 20 | YT2601500702042464 | D | 已签收 | shipped | shipped | 一致 | 00340434518429947429 | 00340434518429947429 | 一致 | DEDHL-INTL | DE | 2026-01-23T10:08:16Z | The shipment has been successfully delivered |
| 21 | YT2601500702042472 | D | 已签收 | shipped | shipped | 一致 | 34YEM979259801000605005 | 34YEM979259801000605005 | 一致 | PARCEL POST | AU | 2026-01-21T09:56:24Z | Delivered with signature from V DROP |
| 22 | YT2601500702042498 | D | 已签收 | shipped | shipped | 一致 | JJD0002234220800860 | JJD0002234220800860 | 一致 | SP0281 | GB | 2026-01-23T15:32:41Z | Delivered, handed to customer |
| 23 | YT2601500702042506 | D | 已签收 | shipped | shipped | 一致 | JJD0002234220801135 | JJD0002234220801135 | 一致 | SP0281 | GB | 2026-01-24T10:39:31Z | Delivered - left as authorised |
| 24 | YT2601500702042522 | D | 已签收 | shipped | shipped | 一致 | SPXMEL087300235224 | SPXMEL087300235224 | 一致 | SP1844 | AU | 2026-01-23T07:53:41Z | Delivered. Position: Front door |
| 25 | YT2601500702042530 | D | 已签收 | shipped | shipped | 一致 | 1044860535879064511904 | 1044860535879064511904 | 一致 | AT-ATPOST | AT | 2026-01-26T11:11:19Z | Item delivered |
| 26 | YT2601500702042548 | D | 已签收 | shipped | shipped | 一致 | 01505493462454 | 01505493462454 | 一致 | DEDPD | DE | 2026-01-26T11:33:45Z | Delivered. , Evidence |
| 27 | YT2601500702058064 | D | 已签收 | shipped | shipped | 一致 | 980603941729940748 | 980603941729940748 | 一致 | SP1695 | CH | 2026-01-23T10:38:48Z | Event of delivery (inland): Delivered to stacking tay |
| 28 | YT2601500702103357 | D | 已签收 | shipped | shipped | 一致 | IW725542338GB | IW725542338GB | 一致 | UK-RM | GB | 2026-02-04T11:39:54Z | Safeplace Delivered |
| 29 | YT2601500702135797 | D | 已签收 | shipped | shipped | 一致 | GFUS01030070602881 | GFUS01030070602881 | 一致 | SP1600 | US | 2026-01-21T13:15:52Z | Delivered, Door/Yard. For Delivery Issues & Tracking Support, Contact GOFO at +1 949 688-6032 or cs@mail.gofoexpress.com |
| 30 | YT2601500702135805 | D | 已签收 | shipped | shipped | 一致 | 00340434518429572263 | 00340434518429572263 | 一致 | DEDHL-INTL | DE | 2026-01-24T11:18:16Z | The shipment has been successfully delivered |
| 31 | YT2601500702135813 | D | 已签收 | shipped | shipped | 一致 | 1044860535817314546900 | 1044860535817314546900 | 一致 | AT-ATPOST | AT | 2026-01-27T09:30:42Z | Delivered to Letterbox |
| 32 | YT2601500702135854 | D | 已签收 | shipped | shipped | 一致 | 980603941729932951 | 980603941729932951 | 一致 | SP1695 | CH | 2026-01-22T13:26:27Z | Event of delivery (inland): Delivered |
| 33 | YT2601500702135888 | D | 已签收 | shipped | shipped | 一致 | H00RVA0456757096 | H00RVA0456757096 | 一致 | UK-HERMES SORT | GB | 2026-01-24T10:43:30Z | Parcel delivered with a signature |
| 34 | YT2601500702259183 | D | 已签收 | shipped | shipped | 一致 | 9261290278833950408314 | 9261290278833950408314 | 一致 | JFK OSM | US | 2026-01-23T10:16:00Z | Delivered, Left with Individual |
| 35 | YT2601500702334564 | D | 已签收 | shipped | shipped | 一致 | 00340434518429572911 | 00340434518429572911 | 一致 | DEDHL-INTL | DE | 2026-01-23T15:31:45Z | The shipment has been successfully delivered |
| 36 | YT2601500702334572 | D | 已签收 | shipped | shipped | 一致 | 9214490351533418428646 | 9214490351533418428646 | 一致 | ORD USPS FC | US | 2026-01-23T12:02:00Z | Delivered, Front Door/Porch |
| 37 | YT2601500702334580 | D | 已签收 | shipped | shipped | 一致 | H00RVA0456757414 | H00RVA0456757414 | 一致 | UK-HERMES SORT | GB | 2026-01-22T12:09:14Z | This parcel has been delivered to the customers outbuilding |
| 38 | YT2601500702334598 | D | 已签收 | shipped | shipped | 一致 | H00RVA0456757224 | H00RVA0456757224 | 一致 | UK-HERMES SORT | GB | 2026-01-23T16:06:54Z | Secure delivery (Enclosed porch) |
| 39 | YT2601500702334606 | D | 已签收 | shipped | shipped | 一致 | GFUS01030070721216 | GFUS01030070721216 | 一致 | SP1600 | US | 2026-01-21T10:15:39Z | Delivered, Door/Yard. For Delivery Issues & Tracking Support, Contact GOFO at +1 949 688-6032 or cs@mail.gofoexpress.com |
| 40 | YT2601500702334648 | D | 已签收 | shipped | shipped | 一致 | GFUS01030070728320 | GFUS01030070728320 | 一致 | SP1600 | US | 2026-01-21T19:36:05Z | Delivered, Door/Yard. For Delivery Issues & Tracking Support, Contact GOFO at +1 949 688-6032 or cs@mail.gofoexpress.com |
| 41 | YT2601500702334663 | D | 已签收 | shipped | shipped | 一致 | 9261290278833950406426 | 9261290278833950406426 | 一致 | JFK OSM | US | 2026-01-23T12:20:00Z | Delivered, Front Desk/Reception/Mail Room |
| 42 | YT2601500703031870 | D | 已签收 | shipped | shipped | 一致 | 01505493457160 | 01505493457160 | 一致 | DEDPD | DE | 2026-01-22T18:29:48Z | Picked up from Pickup parcelshop by consignee. , Evidence |
| 43 | YT2601500703031888 | D | 已签收 | shipped | shipped | 一致 | 01505493456941 | 01505493456941 | 一致 | DEDPD | DE | 2026-01-24T10:32:32Z | Delivered. , Evidence |
| 44 | YT2601500703031912 | D | 已签收 | shipped | shipped | 一致 | 00340435067616784433 | 00340435067616784433 | 一致 | DEDHLS | DE | 2026-01-29T12:00:35Z | The shipment has been successfully delivered |
| 45 | YT2601500703031987 | D | 已签收 | shipped | shipped | 一致 | GFUS01030070737346 | GFUS01030070737346 | 一致 | SP1600 | US | 2026-01-27T11:03:43Z | Delivered, Door/Yard. For Delivery Issues & Tracking Support, Contact GOFO at +1 949 688-6032 or cs@mail.gofoexpress.com |
| 46 | YT2601500703032027 | D | 已签收 | shipped | shipped | 一致 | 9261290306531781936687 | 9261290306531781936687 | 一致 | DFW OSM | US | 2026-01-26T11:55:00Z | Delivered, Front Door/Porch |
| 47 | YT2601500703227338 | D | 已签收 | shipped | shipped | 一致 | 00340435067616812365 | 00340435067616812365 | 一致 | DEDHLS | DE | 2026-01-27T11:19:06Z | Delivered |
| 48 | YT2601500703227452 | D | 已签收 | shipped | shipped | 一致 | GFUS01030070815808 | GFUS01030070815808 | 一致 | SP1600 | US | 2026-01-25T12:41:16Z | Delivered, Door/Yard. For Delivery Issues & Tracking Support, Contact GOFO at +1 949 688-6032 or cs@mail.gofoexpress.com |
| 49 | YT2601500703227502 | D | 已签收 | shipped | shipped | 一致 | 00340434518429753112 | 00340434518429753112 | 一致 | DEDHL-INTL | DE | 2026-01-26T11:46:39Z | Delivered |
| 50 | YT2601500703227528 | D | 已签收 | shipped | shipped | 一致 | CB082209420IE | CB082209420IE | 一致 | SP0134 | IE | 2026-01-27T10:39:32Z | Item has been sucessfully delivered |
| 51 | YT2601500704451366 | D | 已签收 | shipped | shipped | 一致 | GFUS01030071814337 | GFUS01030071814337 | 一致 | SP1600 | US | 2026-01-26T14:16:32Z | Delivered, Mail Room/Parcel Locker. For Delivery Issues & Tracking Support, Contact GOFO at +1 949 688-6032 or cs@mail.gofoexpress.com |
| 52 | YT2601500705151437 | D | 已签收 | shipped | shipped | 一致 | 00340434518429947856 | 00340434518429947856 | 一致 | DEDHL-INTL | DE | 2026-01-27T11:42:07Z | The shipment has been successfully delivered |
| 53 | YT2601500705211587 | D | 已签收 | shipped | shipped | 一致 | 63434332349 | 63434332349 | 一致 | GR-DPD | GR | 2026-01-26T14:11:15Z | Delivered consignee:VASILIP |
| 54 | YT2601500705722823 | D | 已签收 | shipped | shipped | 一致 | CRIN26011918352865 | CRIN26011918352865 | 一致 | SP0656 | CA | 2026-01-25T20:31:35Z | Completed Unloading at Delivery Location:Normal Status |
| 55 | YT2601500705723060 | D | 已签收 | shipped | shipped | 一致 | 1044860536054374568902 | 1044860536054374568902 | 一致 | AT-ATPOST | AT | 2026-01-28T14:58:38Z | Delivered to Letterbox |
| 56 | YT2601500705724043 | D | 已签收 | shipped | shipped | 一致 | 00340435067616908891 | 00340435067616908891 | 一致 | DEDHLS | DE | 2026-01-23T13:48:21Z | The shipment has been successfully delivered |
| 57 | YT2601500705724662 | D | 已签收 | shipped | shipped | 一致 | CB082908948IE | CB082908948IE | 一致 | SP0134 | IE | 2026-01-28T11:57:12Z | Item has been sucessfully delivered |
| 58 | YT2601500705725743 | D | 已签收 | shipped | shipped | 一致 | 00340434518429901223 | 00340434518429901223 | 一致 | DEDHL-INTL | DE | 2026-01-22T16:33:14Z | The shipment has been successfully delivered |
| 59 | YT2601500705726253 | D | 已签收 | shipped | shipped | 一致 | 01505493475076 | 01505493475076 | 一致 | DEDPD | DE | 2026-01-27T10:54:32Z | Delivered. , Evidence |
| 60 | YT2601500705915591 | D | 已签收 | shipped | shipped | 一致 | 00340434518430242124 | 00340434518430242124 | 一致 | DEDHL-INTL | DE | 2026-01-23T14:39:13Z | The shipment has been successfully delivered |
| 61 | YT2601500705916771 | D | 已签收 | shipped | shipped | 一致 | EM200007469277CA | EM200007469277CA | 一致 | SP1647 | CA | 2026-01-27T11:48:50Z | DELIVERED |
| 62 | YT2601500705918496 | D | 已签收 | shipped | shipped | 一致 | 01505493462409 | 01505493462409 | 一致 | DEDPD | DE | 2026-01-26T11:35:17Z | Delivered. , Evidence |
| 63 | YT2601500705919320 | D | 已签收 | shipped | shipped | 一致 | H00RVA0456881378 | H00RVA0456881378 | 一致 | UK-HERMES SORT | GB | 2026-02-04T13:21:49Z | This parcel has been delivered to the delivery address |
| 64 | YT2601500705920039 | D | 已签收 | shipped | shipped | 一致 | 01475250970009 | 01475250970009 | 一致 | DEDPD | DE | 2026-01-27T10:34:38Z | Delivered. Delivery / one-off authorisation to deposit., Evidence |
| 65 | YT2601500705920989 | D | 已签收 | shipped | shipped | 一致 | JT20260164063517 | JT20260164063517 | 一致 | SG-JT | SG | 2026-01-21T21:43:15Z | DELIVERED |

## 六、状态需更新明细

无。库中 shipment_status 与 API 映射结果 **100% 一致**，无需回写。
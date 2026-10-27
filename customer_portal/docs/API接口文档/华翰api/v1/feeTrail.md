#### 简要描述：

运费试算接口

------------

#### service名称:

feeTrail

------------

#### paramsJson示例：

```json
{
	"country_code": "US",
	"weight": "1",
	"length": "1",
	"width": "1",
	"height": "1"
}
```
------------

#### paramsJson参数:

|参数名|数据类型|是否必填|说明|
|:----    |:---|:----- |-----   |
|country_code |string  |Require |国家二字码   |
|weight |float  |Require | 订单重量(KG)    |
|length |float  |Option | 包裹长(CM)    |
|width |float  |Option | 包裹宽(CM)    |
|height |float  |Option | 包裹高(CM)    |


------------

#### response XML示例:


##### 成功返回示例:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<SOAP-ENV:Envelope xmlns:SOAP-ENV="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ns1="http://www.example.org/Ec/">
    <SOAP-ENV:Body>
        <ns1:callServiceResponse>
            <response>{"ask":"Success","message":"Success","data":[{"ChargeWeight":"1.000","Effectiveness":"3-7","FreightCostFee":"","FreightFee":"117.22","FuelFee":"21.39","InsuranceFee":"0.00","OtherFee":"1.00","Pr_id":"11983","ProductSort":"3","RegisteredFee":"0.00","Remark":"1、报价不含油不含税、海关罚款、仓储费以及收件人责任所引起的退件费等；2、偏远地区的快件需加收偏远地区附加费，标准为4.6港币/KG，最低收费为230港币/每票,偏远地区附加费须另加燃油附加费；3、高风险地区附加费:200HKD/票（需加燃油，文件和包裹都适用，具体涉及国家请查看报价表）。","ServiceCnName":"HKDHL-代理价","ServiceCode":"HKDHLDLJ","ServiceEnName":"HKDHLDLJ","TotalFee":"139.61","Traceability":"Y","VolumeCharge":"5000","m_ServiceCode":"HKDHLDLJ"},{"ChargeWeight":"1.000","Effectiveness":"3-7","FreightCostFee":"","FreightFee":"118.32","FuelFee":"21.59","InsuranceFee":"0.00","OtherFee":"1.00","Pr_id":"11984","ProductSort":"3","RegisteredFee":"0.00","Remark":"","ServiceCnName":"HKDHL-敏感价","ServiceCode":"HLDHLMGJ","ServiceEnName":"HKDHLMGJ","TotalFee":"140.91","Traceability":"Y","VolumeCharge":"5000","m_ServiceCode":"HLDHLMGJ"},{"ChargeWeight":"1.000","Effectiveness":"3-7","FreightCostFee":"","FreightFee":"107.15","FuelFee":"19.55","InsuranceFee":"0.00","OtherFee":"0.00","Pr_id":"3050","ProductSort":"2","RegisteredFee":"0.00","Remark":"1、报价不含油不含税；2、偏远地区是否请自行先查询，我司不代为查询。目的地去往偏远地区的快件需加收偏远地区附加费，标准为RMB3.2/KG，每票最低收费为RMB180/票（文件特惠价请看当面表格说明）偏远地区附加费须另行收取燃油附加费，发货后6个月内有效，官网能查询到偏远地区我司不提供DHL账单。","ServiceCnName":"深圳DHL小货价","ServiceCode":"SZDHLXHJ","ServiceEnName":"SZDHLXHJ","TotalFee":"126.7","Traceability":"Y","VolumeCharge":"5000","m_ServiceCode":"SZDHLXHJ"},{"ChargeWeight":"1.0","Effectiveness":"7-20","FreightCostFee":"","FreightFee":"63.25","FuelFee":"0.00","InsuranceFee":"0.00","OtherFee":"0.00","Pr_id":"11647","ProductSort":"1","RegisteredFee":"0.00","Remark":"1、该渠道可以接固体化妆品，乳膏状化妆品，磁性支架，蓝牙耳机，不带烟油电子烟，泡沫盒（较重）；2、部分国家可接内置电池及少量配套电池，系统需要分开下单，分开包装，分开交货（详细查看报价表）；3、面单要求：10CM*10CM,面单要干净整洁，条码精度要大于300DPI，须用自粘型热敏纸张打印面单。","ServiceCnName":"深圳平邮","ServiceCode":"SZPYCP","ServiceEnName":"SZPYCP","TotalFee":"63.25","Traceability":"Y","VolumeCharge":"","m_ServiceCode":"SZPYCP"},{"ChargeWeight":"1.0","Effectiveness":"7-20","FreightCostFee":"","FreightFee":"63.25","FuelFee":"0.00","InsuranceFee":"0.00","OtherFee":"0.00","Pr_id":"11649","ProductSort":"1","RegisteredFee":"0.00","Remark":"1、该渠道可以接固体化妆品，乳膏状化妆品，磁性支架，蓝牙耳机，不带烟油电子烟，泡沫盒（较重）；2、部分国家可接内置电池及少量配套电池，系统需要分开下单，分开包装，分开交货（详细查看报价表）；3、面单要求：10CM*10CM,面单要干净整洁，条码精度要大于300DPI，须用自粘型热敏纸张打印面单。","ServiceCnName":"深圳平邮(内置电)","ServiceCode":"PK0043","ServiceEnName":"SZPYDDCP","TotalFee":"63.25","Traceability":"Y","VolumeCharge":"","m_ServiceCode":"PK0043"},{"ChargeWeight":"1.0","Effectiveness":"7-20","FreightCostFee":"","FreightFee":"53.00","FuelFee":"0.00","InsuranceFee":"0.00","OtherFee":"0.00","Pr_id":"11639","ProductSort":"1","RegisteredFee":"20.00","Remark":"1、带电货物需分开下单，分开交货2、本渠道适用于带内置电池产品，包括手机、平板电脑、笔记本电脑、数码相机、电子表、蓝牙键盘、多功能闹钟、无线路由器、电子烟（不含烟油等液体）等内置锂电池产品；3、面单要求：10CM*10CM,面单要干净整洁，条码精度要大于300DPI，须用自粘型热敏纸张打印面单。","ServiceCnName":"深圳挂号","ServiceCode":"PK0001","ServiceEnName":"SZGH","TotalFee":"73","Traceability":"Y","VolumeCharge":"","m_ServiceCode":"PK0001"},{"ChargeWeight":"1.0","Effectiveness":"7-20","FreightCostFee":"","FreightFee":"53.00","FuelFee":"0.00","InsuranceFee":"0.00","OtherFee":"0.00","Pr_id":"11641","ProductSort":"1","RegisteredFee":"20.00","Remark":"1、带电货物需分开下单，分开交货2、本渠道适用于带内置电池产品，包括手机、平板电脑、笔记本电脑、数码相机、电子表、蓝牙键盘、多功能闹钟、无线路由器、电子烟（不含烟油等液体）等内置锂电池产品；3、面单要求：10CM*10CM,面单要干净整洁，条码精度要大于300DPI，须用自粘型热敏纸张打印面单。","ServiceCnName":"深圳挂号(内置电)","ServiceCode":"PK0042","ServiceEnName":"SZGHDDCP","TotalFee":"73","Traceability":"Y","VolumeCharge":"","m_ServiceCode":"PK0042"},{"ChargeWeight":"1.0","Effectiveness":"","FreightCostFee":"","FreightFee":"63.25","FuelFee":"0.00","InsuranceFee":"0.00","OtherFee":"0.00","Pr_id":"11675","ProductSort":"0","RegisteredFee":"0.00","Remark":"","ServiceCnName":"湖南平邮","ServiceCode":"PK0247","ServiceEnName":"HNPYC","TotalFee":"63.25","Traceability":"N","VolumeCharge":"","m_ServiceCode":"PK0247"},{"ChargeWeight":"1.0","Effectiveness":"7-20","FreightCostFee":"","FreightFee":"63.25","FuelFee":"0.00","InsuranceFee":"0.00","OtherFee":"0.00","Pr_id":"11652","ProductSort":"0","RegisteredFee":"0.00","Remark":"1、该渠道可以接固体化妆品，乳膏状化妆品，磁性支架，蓝牙耳机，不带烟油电子烟，泡沫盒（较重）；2、部分国家可接内置电池及少量配套电池，系统需要分开下单，分开包装，分开交货（详细查看报价表）；3、面单要求：10CM*10CM,面单要干净整洁，条码精度要大于300DPI，须用自粘型热敏纸张打印面单。","ServiceCnName":"深圳平邮(纽扣电)","ServiceCode":"PK0078","ServiceEnName":"SZPYNKD","TotalFee":"63.25","Traceability":"Y","VolumeCharge":"","m_ServiceCode":"PK0078"},{"ChargeWeight":"1.0","Effectiveness":"7-20","FreightCostFee":"","FreightFee":"63.25","FuelFee":"0.00","InsuranceFee":"0.00","OtherFee":"0.00","Pr_id":"10906","ProductSort":"0","RegisteredFee":"0.00","Remark":"1、该渠道可以接固体化妆品，乳膏状化妆品，磁性支架，蓝牙耳机，不带烟油电子烟，泡沫盒（较重）；2、部分国家可接内置电池及少量配套电池，系统需要分开下单，分开包装，分开交货（详细查看报价表）；3、面单要求：10CM*10CM,面单要干净整洁，条码精度要大于300DPI，须用自粘型热敏纸张打印面单。","ServiceCnName":"线上-深圳平邮(WISH)","ServiceCode":"XSSZPYCP","ServiceEnName":"XSSZPYCP","TotalFee":"63.25","Traceability":"Y","VolumeCharge":"","m_ServiceCode":"XSSZPYCP"},{"ChargeWeight":"1.0","Effectiveness":"3-25","FreightCostFee":"","FreightFee":"63.25","FuelFee":"0.00","InsuranceFee":"0.00","OtherFee":"1.00","Pr_id":"11679","ProductSort":"0","RegisteredFee":"0.00","Remark":"","ServiceCnName":"华邮宝平邮","ServiceCode":"PK0218","ServiceEnName":"EYBPYC","TotalFee":"64.25","Traceability":"Y","VolumeCharge":"","m_ServiceCode":"PK0218"},{"ChargeWeight":"1.0","Effectiveness":"7-20","FreightCostFee":"","FreightFee":"53.00","FuelFee":"0.00","InsuranceFee":"0.00","OtherFee":"0.00","Pr_id":"11645","ProductSort":"0","RegisteredFee":"20.00","Remark":"1、带电货物需分开下单，分开交货2、本渠道适用于带内置电池产品，包括手机、平板电脑、笔记本电脑、数码相机、电子表、蓝牙键盘、多功能闹钟、无线路由器、电子烟（不含烟油等液体）等内置锂电池产品；3、面单要求：10CM*10CM,面单要干净整洁，条码精度要大于300DPI，须用自粘型热敏纸张打印面单。","ServiceCnName":"深圳挂号(纽扣电)","ServiceCode":"PK0079","ServiceEnName":"SZGHNKDC","TotalFee":"73","Traceability":"Y","VolumeCharge":"","m_ServiceCode":"PK0079"},{"ChargeWeight":"1.0","Effectiveness":"7-20","FreightCostFee":"","FreightFee":"53.00","FuelFee":"0.00","InsuranceFee":"0.00","OtherFee":"0.00","Pr_id":"11656","ProductSort":"0","RegisteredFee":"20.00","Remark":"1、带电货物需分开下单，分开交货2、本渠道适用于带内置电池产品，包括手机、平板电脑、笔记本电脑、数码相机、电子表、蓝牙键盘、多功能闹钟、无线路由器、电子烟（不含烟油等液体）等内置锂电池产品；3、面单要求：10CM*10CM,面单要干净整洁，条码精度要大于300DPI，须用自粘型热敏纸张打印面单。","ServiceCnName":"线上-深圳挂号(WISH)","ServiceCode":"XSSZGHCP","ServiceEnName":"XSSZGHCP","TotalFee":"73","Traceability":"Y","VolumeCharge":"","m_ServiceCode":"XSSZGHCP"},{"ChargeWeight":"1.0","Effectiveness":"3-25","FreightCostFee":"","FreightFee":"53.00","FuelFee":"0.00","InsuranceFee":"0.00","OtherFee":"1.00","Pr_id":"11677","ProductSort":"0","RegisteredFee":"20.00","Remark":"","ServiceCnName":"华邮宝挂号","ServiceCode":"PK0219","ServiceEnName":"EYBGHC","TotalFee":"74","Traceability":"Y","VolumeCharge":"","m_ServiceCode":"PK0219"},{"ChargeWeight":"1.0","Effectiveness":"3-11","FreightCostFee":"","FreightFee":"65.00","FuelFee":"0.00","InsuranceFee":"0.00","OtherFee":"0.00","Pr_id":"10616","ProductSort":"0","RegisteredFee":"15.00","Remark":"1、限重：0-2公斤，面单的有效期是15天，面单尺寸10CM*10CM;2、申报价值：如实填写申报价值，如因申报价值与实际不符带来的风险由发货人承担；3、跟踪查询网站:http://www.hh-exp.com/","ServiceCnName":"广州e邮宝","ServiceCode":"PK0114","ServiceEnName":"GDEUBC","TotalFee":"80","Traceability":"Y","VolumeCharge":"","m_ServiceCode":"PK0114"},{"ChargeWeight":"1.0","Effectiveness":"","FreightCostFee":"","FreightFee":"65.00","FuelFee":"0.00","InsuranceFee":"0.00","OtherFee":"0.00","Pr_id":"10993","ProductSort":"0","RegisteredFee":"15.00","Remark":"","ServiceCnName":"湖南e邮宝","ServiceCode":"PK0249","ServiceEnName":"HNEUBC","TotalFee":"80","Traceability":"N","VolumeCharge":"","m_ServiceCode":"PK0249"},{"ChargeWeight":"1.0","Effectiveness":"","FreightCostFee":"","FreightFee":"65.00","FuelFee":"0.00","InsuranceFee":"0.00","OtherFee":"0.00","Pr_id":"11059","ProductSort":"0","RegisteredFee":"15.00","Remark":"","ServiceCnName":"深圳e邮宝(美国)","ServiceCode":"PK0107","ServiceEnName":"szeubdUS","TotalFee":"80","Traceability":"N","VolumeCharge":"","m_ServiceCode":"PK0107"},{"ChargeWeight":"1.0","Effectiveness":"7-20","FreightCostFee":"","FreightFee":"65.00","FuelFee":"0.00","InsuranceFee":"0.00","OtherFee":"0.00","Pr_id":"9589","ProductSort":"0","RegisteredFee":"15.00","Remark":"1、以色列e邮宝限重3Kg，其他国家e邮宝限重2Kg。2、发往美国/新西兰/巴西/日本/哈萨克斯坦的e邮宝邮件，重量不足50g将按50g收费。3、发往乌克兰的e邮宝邮件，重量不足10g将按10g收费，4、面单的有效期是15天，面单尺寸10CM*10CM. 深圳e邮宝Plus","ServiceCnName":"深圳e邮宝Plus","ServiceCode":"PK0164","ServiceEnName":"SZEYBPLUSC","TotalFee":"80","Traceability":"Y","VolumeCharge":"","m_ServiceCode":"PK0164"},{"ChargeWeight":"1.0","Effectiveness":"7-20","FreightCostFee":"","FreightFee":"65.00","FuelFee":"0.00","InsuranceFee":"0.00","OtherFee":"0.00","Pr_id":"9590","ProductSort":"0","RegisteredFee":"15.00","Remark":"","ServiceCnName":"深圳e邮宝Plus(带电)","ServiceCode":"PK0212","ServiceEnName":"SZEUBPLUSC","TotalFee":"80","Traceability":"Y","VolumeCharge":"","m_ServiceCode":"PK0212"},{"ChargeWeight":"1.0","Effectiveness":"3-15","FreightCostFee":"","FreightFee":"65.00","FuelFee":"0.00","InsuranceFee":"0.00","OtherFee":"0.00","Pr_id":"10019","ProductSort":"0","RegisteredFee":"15.00","Remark":"","ServiceCnName":"深圳e邮宝-特货","ServiceCode":"PK0203","ServiceEnName":"SZEUBTHC","TotalFee":"80","Traceability":"Y","VolumeCharge":"","m_ServiceCode":"PK0203"},{"ChargeWeight":"1.0","Effectiveness":"","FreightCostFee":"","FreightFee":"65.00","FuelFee":"0.00","InsuranceFee":"0.00","OtherFee":"0.00","Pr_id":"10436","ProductSort":"0","RegisteredFee":"15.00","Remark":"","ServiceCnName":"郑州e邮宝","ServiceCode":"ZZEUB","ServiceEnName":"ZZEUB","TotalFee":"80","Traceability":"Y","VolumeCharge":"","m_ServiceCode":"ZZEUB"},{"ChargeWeight":"1.0","Effectiveness":"3-12","FreightCostFee":"","FreightFee":"69.92","FuelFee":"0.00","InsuranceFee":"0.00","OtherFee":"0.00","Pr_id":"8635","ProductSort":"0","RegisteredFee":"21.50","Remark":"1、限重0-2kg2、尺寸要求：长、宽、高长度之和&lt;90cm，最长一边长度&lt;60cm3、面单要求：10CM*10CM,面单要求干净整洁，不能出现中文字样以及MADE IN CHINA4、详细请查看报价表","ServiceCnName":"华翰航空小包挂号","ServiceCode":"PK0089","ServiceEnName":"HHJJXBGHC","TotalFee":"91.42","Traceability":"Y","VolumeCharge":"","m_ServiceCode":"PK0089"},{"ChargeWeight":"1.000","Effectiveness":"3-15","FreightCostFee":"","FreightFee":"80.00","FuelFee":"0.00","InsuranceFee":"0.00","OtherFee":"0.00","Pr_id":"9721","ProductSort":"0","RegisteredFee":"15.00","Remark":"","ServiceCnName":"美国专线","ServiceCode":"PK0220","ServiceEnName":"USZXC","TotalFee":"95","Traceability":"Y","VolumeCharge":"7000","m_ServiceCode":"PK0220"},{"ChargeWeight":"1.0","Effectiveness":"","FreightCostFee":"","FreightFee":"100.00","FuelFee":"0.00","InsuranceFee":"0.00","OtherFee":"0.50","Pr_id":"10506","ProductSort":"0","RegisteredFee":"0.00","Remark":"","ServiceCnName":"美国经济专线平邮-普货","ServiceCode":"PK0240","ServiceEnName":"USJJZXPYPHC","TotalFee":"100.5","Traceability":"N","VolumeCharge":"","m_ServiceCode":"PK0240"},{"ChargeWeight":"1.0","Effectiveness":"3-15","FreightCostFee":"","FreightFee":"108.00","FuelFee":"0.00","InsuranceFee":"0.00","OtherFee":"0.50","Pr_id":"10023","ProductSort":"0","RegisteredFee":"0.00","Remark":"1、限重0-2kg2、尺寸要求：长、宽、高长度之和&lt;90cm，最长一边长度&lt;60cm3、面单要求：10CM*10CM,面单要求干净整洁，不能出现中文字样以及MADE IN CHINA4、详细请查看报价表","ServiceCnName":"华翰航空小包平邮","ServiceCode":"PK0084","ServiceEnName":"HH ECONOMIC AIR MAIL - BATTERY","TotalFee":"108.5","Traceability":"Y","VolumeCharge":"","m_ServiceCode":"PK0084"},{"ChargeWeight":"1.0","Effectiveness":"","FreightCostFee":"","FreightFee":"110.00","FuelFee":"0.00","InsuranceFee":"0.00","OtherFee":"0.50","Pr_id":"10508","ProductSort":"0","RegisteredFee":"0.00","Remark":"","ServiceCnName":"美国经济专线平邮-特货","ServiceCode":"PK0239","ServiceEnName":"USJJZXPINGYTH","TotalFee":"110.5","Traceability":"N","VolumeCharge":"","m_ServiceCode":"PK0239"},{"ChargeWeight":"1.0","Effectiveness":"7-20","FreightCostFee":"","FreightFee":"330.00","FuelFee":"0.00","InsuranceFee":"0.00","OtherFee":"0.00","Pr_id":"8817","ProductSort":"0","RegisteredFee":"0.00","Remark":"","ServiceCnName":"深圳e邮宝-大货","ServiceCode":"PK0211","ServiceEnName":"SZEUBBIGC","TotalFee":"330","Traceability":"Y","VolumeCharge":"","m_ServiceCode":"PK0211"}],"time_cost(s)":"2.5156409740448"}</response>
        </ns1:callServiceResponse>
    </SOAP-ENV:Body>
</SOAP-ENV:Envelope>
```

##### 失败返回示例:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<SOAP-ENV:Envelope xmlns:SOAP-ENV="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ns1="http://www.example.org/Ec/">
    <SOAP-ENV:Body>
        <ns1:callServiceResponse>
            <response>{"ask":"Failure","message":"试算失败.","time_cost(s)":"0.28126621246338"}</response>
        </ns1:callServiceResponse>
    </SOAP-ENV:Body>
</SOAP-ENV:Envelope>
```


------------

#### response参数:

|参数名|数据类型|说明|
|:----    |:---|-----   |
|ask |string  |参考公共请求参数中response参数   |
|message |string  | 参考公共请求参数中response参数    |
|data |Object   | 数据内容(2维数组)    |
|Error |Object   | 参考公共请求参数中Error格式   |

##### data参数:

|参数名|数据类型|说明|
|:----    |:---|-----   |
|ChargeWeight |float  |计费重量   |
|Effectiveness |string  | 时效    |
|FreightCostFee |  float |   （占位用）   |
|FreightFee |float   | 运费    |
|FuelFee |float   | 燃油费   |
|InsuranceFee |float   |  保险费   |
|OtherFee |float   | 其他费用   |
|Pr_id | int   |  （占位用）   |
|ProductSort |int   | 产品排序权重值   |
|RegisteredFee |float   | 挂号费   |
|Remark |string   | 备注   |
|ServiceCnName |string   | 服务中文名称   |
|ServiceCode |string   |  产品代码   |
|ServiceEnName |string   | 服务英文名称   |
|TotalFee |float   | 总费用   |
|Traceability |string   | 可追踪   |
|VolumeCharge |float   | 体积重计费   |
|m_ServiceCode |string   |  （占位用）   |
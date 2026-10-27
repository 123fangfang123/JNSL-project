#### 简要描述：

创建订单接口

------------

#### service名称:

createOrder

------------



#### paramsJson示例：

```json
{
	"reference_no": "WWTEST202001084545",
	"shipping_method": "B测试产品",
	"credit_code":"9132××1X04R87F",
	"platform_name":"AliExpress",
	"country_code": "US",
	"order_weight": 1,
	"order_pieces": "1",
	"length":1,
	"width":1,
	"height":1,
	"Consignee": {
		"consignee_street": "19 N Long Ave",
		"consignee_street2": "",
		"consignee_name": "Xiao Cai",
		"consignee_telephone": "958465448",
		"consignee_postcode": "60644-3224",
		"consignee_province": "Illinois",
		"consignee_city": "Chicago",
		"consignee_taxno": "TA2020181245",
		"consignee_email": "9586645845@qq.com",
		"ioss":"IM5280002079"
	},
	"Shipper": {
		"shipper_countrycode": "CN",
		"shipper_province": "GUANGDONG",
		"shipper_city": "SHENZHEN",
		"shipper_street": "pinghu 55 SHENZHEN GUANGDONG",
		"shipper_postcode": "518000",
		"shipper_name": "hh cai",
		"shipper_telephone": "9586458745",
		"shipper_mobile": "18011911234",
		"shipper_taxno": "FAFA8181AA"
	},
	"ItemArr": [{
		"invoice_cnname": "手机外壳1",
		"invoice_enname": "Mobile phone shell1",
		"invoice_weight": 0.8,
		"invoice_quantity": "3",
		"invoice_unitcharge": 3.5,
		"sku": "4644392",
		"asin" : "B017VXKVXE",
		"invoice_url":"http://www.aliexpress.com/item//4000599110017.html",
		"invoice_export_unitprice": 1.5
	},{
		"invoice_cnname": "手机外壳2",
		"invoice_enname": "Mobile phone shell2",
		"invoice_weight": 0.8,
		"invoice_quantity": "3",
		"invoice_unitcharge": 3.5,
		"sku": "4644392",
		"asin" : "B017VXKVXE",
		"invoice_url":"http://www.aliexpress.com/item//4000599110017.html",
		"invoice_export_unitprice": 1.5
	}]
}
```
------------

#### paramsJson参数:

|参数名|数据类型|是否必填|说明|
|:----    |:---|:----- |-----   |
|reference_no |string  |Require |客户参考号(客户自定义单号，不能重复，需唯一)   |
|shipping_method |string  |Require | 配送方式（产品代码）可以通过“获取配送方式”接口获取列表，也可以访问我司产品代码网站https://www.hh-exp.cn/ProductCode/index.php 手工查询    |
|credit_code |string  |Option | 企业信用代码 (填写你在华翰备案成功的销售企业信用代码，如：91440300550307832J)   |
|platform_name |string  |Option | 电商平台名称（Wish,Amazon,AliExpress,Shopee,TikTok）    |
|country_code |string  |Require | 收件人国家二字码    |
|extra_service |string  |Option | 附加服务代码，每个以英文分号“;”隔开    |
|order_weight |float  |Require | 订单重量，单位KG   |
|shipping_method_no |string  |Option | 服务商单号（追踪单号，默认不需要传值，由华翰接口返回）    |
|order_pieces |int  |Option | 外包装件数,默认1（**小包默认值1即可**,发FBA空海运等一票货多箱的时候才需要根据情况设置）这个字段不是数量不要传错。    |
|insurance_value |float  |Option | 投保金额，默认RMB    |
|mail_cargo_type |string  |Option | 包裹申报种类（1-Gif礼品；2-CommercialSample商品货样；3-Document文件；4-Other其他。默认4）|
|length |float  |Option | 长，单位cm，默认1  |
|width |float  |Option | 宽，单位cm，默认1   |
|height |float  |Option | 高，单位cm，默认1   |
|Consignee |Object  |Require | 收件人信息    |
|Shipper |Object  |Require | 发件人信息    |
|ItemArr |Object/Array  |Require | 海关申报信息    |

##### Consignee参数

|参数名|数据类型|是否必填|说明|
|:----    |:---|:----- |-----   |
|consignee_company |string  |Option |收件人公司名   |
|consignee_province |string  |Require | 收件人省    |
|consignee_city |string  |Require | 收件人城市    |
|consignee_street |string  |Require | 收件人地址1    |
|consignee_street2 |string  |Option | 收件人地址2    |
|consignee_street3 |string  |Option | 收件人地址3    |
|consignee_postcode |string  |Require | 收件人邮编    |
|consignee_name |string  |Require | 收件人姓名    |
|consignee_telephone |string  |Require | 收件人电话    |
|consignee_mobile |string  |Require | 收件人手机   |
|consignee_email |string  |Option | 收件人邮箱    |
|consignee_certificatetype |string  |Option | 证件类型（ID-身份证；PP-护照）  |
|consignee_certificatecode |string  |Option | 证件号码    |
|consignee_credentials_period |string  |Option |  证件有效期， 格式：2014-04-15    |
|consignee_doorplate |string  |Option | 收件人门牌号**（注意：除一些特殊专线产品要求单独上传门牌号外，门牌号直接放地址里面即可无需单独放到此字段）**   |
|consignee_taxno |string  |Option | 收件人税号（VAT税号）    |
|ioss |string  |Option | 欧盟税号（ioss税号）    |

##### Shipper参数

|参数名|数据类型|是否必填|说明|
|:----    |:---|:----- |-----   |
|shipper_company |string  |Option |发件人公司名   |
|shipper_countrycode |string  |Require | 发件人国家二字码    |
|shipper_province |string  |Require | 发件人省    |
|shipper_city |string  |Require | 发件人城市    |
|shipper_street |string  |Require | 发件人地址    |
|shipper_postcode |string  |Require | 发件人邮编    |
|shipper_areacode |string  |Option | 区域代码    |
|shipper_name |string  |Require | 发件人姓名    |
|shipper_telephone |string  |Require  | 发件人电话    |
|shipper_mobile |string  |Require | 发件人手机   |
|shipper_email |string  |Option | 发件人邮箱    |
|shipper_fax |string  |Option | 发件人传真  |
|order_note |string  |Option | 备注 (未启用)   |
|shipper_taxno |string  |Option | 发件人税号（发件人VAT税号）    |

##### ItemArr参数

|参数名|数据类型|是否必填|说明|
|:----    |:---|:----- |-----   |
|invoice_enname |string  |Require |英文海关申报品名   |
|invoice_cnname |string  |Option | 中文海关申报品名    |
|invoice_weight |float  |Require | 申报重量，单位KG, 精确到三位小数。    |
|invoice_quantity |int  |Require | 数量    |
|unit_code |string  |Option | 单位(MTR-米；PCE-件；SET-套),默认PCE    |
|invoice_unitcharge |float  |Require | 单价    |
|invoice_currencycode |string  |Option | 申报币种，不传值默认为USD(美元)；USD-美元,AUD-澳元,CAD-加元,EUR-欧元,GBP-英镑,HKD-港币,MXN-墨西哥元,RMB-人民币,RUB-俄罗斯卢布,SGD-新加坡元 |
|hs_code |string  |Require | 海关协制编号(海关编码)    |
|invoice_note |string  |Option  | 配货信息    |
|invoice_url |string  |Option | 产品销售地址（销售链接）   |
|sku |string  |Option | 产品SKU编码    |
|material |string  |Option | 申报材质    |
|invoice_function |string  |Option | 用途    |
|invoice_export_unitprice |string  |Option | 出口申报单价（币种默认：RMB-人民币）     |
|asin |string  |Option | 亚马逊ASIN码    |



#### response XML示例:


##### 成功返回示例:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<SOAP-ENV:Envelope xmlns:SOAP-ENV="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ns1="http://www.example.org/Ec/">
    <SOAP-ENV:Body>
        <ns1:callServiceResponse>
            <response>{"ask":"Success","message":"Success","reference_no":"WWTEST202001084549","shipping_method_no":"LW423745051CN","order_code":"HHWEW0008000011YQ","track_status":"1","sender_info_status":"1","ODA":"","agent_number":"496409","time_cost(s)":"3.8042180538177"}</response>
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
            <response>{"ask":"Failure","message":"服务异常：订单数据不合法","reference_no":"WWTEST202001084545","Error":{"errMessage":"参考单号已存在[WWTEST202001084545]","errCode":"ORDER_REFER_ISEXISTS"},"time_cost(s)":"0.92805314064026"}</response>
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
|reference_no |string   | 客户单号   |
|shipping_method_no |string   | 服务商单号(追踪单号\尾程派送单号)，如：RV507879168CN ,默认取此单号 |
|order_code |string   | 华翰系统订单号，系统生成的唯一单号，如：HHWCO0296000051YQ ，如果需要华翰运单号，可以获取这个字段，此单号也可以17TRACK或华翰官网（hh-exp.com）查询全程轨迹  |
|track_status |string   |   track_status（1-已产生跟踪号，2-等待后续更新跟踪号,3-不需要跟踪号） ---暂未启用此功能  |
|sender_info_status |string   | 是否需要分配发件人地址（0-是，1-否）     |
|ODA |string   |   是否需要ODA检验（Y-是）   |
|agent_number |string   |  渠道换单号    |
|Error |Object   | 参考公共请求参数中Error格式  (**注意：获取报错信息是 message +errMessage 才是完整的报错提示**)   |
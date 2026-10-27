#### 简要描述：

批量创建订单接口

------------

#### service名称:

batchCreateOrder

------------



#### paramsJson示例：

```json
[{
	"reference_no": "WWTEST202001084545",
	"shipping_method": "PK0032",
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
	    "consignee_taxno": "TA2020181245"
	},
	"Shipper": {
		"shipper_countrycode": "CN",
		"shipper_province": "GUANGDONG",
		"shipper_city": "SHENZHEN",
		"shipper_street": "pinghu 55 SHENZHEN GUANGDONG",
		"shipper_postcode": "518000",
		"shipper_name": "hh cai",
		"shipper_telephone": "18011911234",
		"shipper_mobile": "18011911234"
	},
	"ItemArr": [{
		"invoice_cnname": "手机壳1",
		"invoice_enname": "Mobile phone shell1",
		"invoice_weight": 1,
		"invoice_quantity": "1",
		"invoice_unitcharge": 3.3,
		"sku": "4644392"
	},{
		"invoice_cnname": "手机壳2",
		"invoice_enname": "Mobile phone shell2",
		"invoice_weight": 1,
		"invoice_quantity": "1",
		"invoice_unitcharge": 3.3,
		"sku": "4644392"
	}]
}, {
	"shipper_hawbcode": "",
	"reference_no": "WWTEST202001084546",
	"shipping_method": "PK0032",
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
	    "consignee_taxno": "TA2020181246"
	},
	"Shipper": {
		"shipper_countrycode": "CN",
		"shipper_province": "GUANGDONG",
		"shipper_city": "SHENZHEN",
		"shipper_street": "pinghu 55 SHENZHEN GUANGDONG",
		"shipper_postcode": "518000",
		"shipper_name": "hh cai",
		"shipper_telephone": "18011911234",
		"shipper_mobile": "18011911234"
	},
	"ItemArr": [{
		"invoice_cnname": "手机壳1",
		"invoice_enname": "Mobile phone shell1",
		"invoice_weight": 1,
		"invoice_quantity": "1",
		"invoice_unitcharge": 3.33,
		"sku": "4644392"
	},{
		"invoice_cnname": "手机壳2",
		"invoice_enname": "Mobile phone shell2",
		"invoice_weight": 1,
		"invoice_quantity": "1",
		"invoice_unitcharge": 3.33,
		"sku": "4644392"
	}]
}]
```
------------

#### paramsJson参数:

paramsJson参数参考createOrder

------------

#### response XML示例:


##### 成功返回示例:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<SOAP-ENV:Envelope xmlns:SOAP-ENV="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ns1="http://www.example.org/Ec/">
	<SOAP-ENV:Body>
		<ns1:callServiceResponse>
			<response>
				{
					"ask": "Success",
					"message": "Success",
					"Result": [
						{
							"ask": "Success",
							"message": "Success",
							"reference_no": "WWTEST202001084999",
							"shipping_method_no": "LW423680523CN",
							"order_code": "HHWEW0008000004YQ",
							"track_status": "1",
							"sender_info_status": "1",
							"ODA": "",
							"agent_number": "496494"
						},
						{
							"ask": "Success",
							"message": "Success",
							"reference_no": "WWTEST202001084998",
							"shipping_method_no": "LW423680660CN",
							"order_code": "HHWEW0008000005YQ",
							"track_status": "1",
							"sender_info_status": "1",
							"ODA": "",
							"agent_number": "496514"
						}
					],
					"Error": [],
					"time_cost(s)": "6.6593809127808"
				}
			</response>
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
			<response>
				{
					"ask": "Success",
					"message": "Success",
					"Result": [
						{
							"ask": "Failure",
							"message": "服务异常：订单数据不合法",
							"reference_no": "WWTEST202001084999",
							"Error": {
								"errMessage": "参考单号已存在[WWTEST202001084999]",
								"errCode": "ORDER_REFER_ISEXISTS"
							}
						},
						{
							"ask": "Failure",
							"message": "服务异常：HHWEW0008000009YQ换号失败。下家接口报错：异常:B03 收件人邮编不能为空;",
							"reference_no": "WWTEST202001084997"
						}
					],
					"Error": [],
					"time_cost(s)": "3.1871819496155"
				}
			</response>
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
|Result |string   | 参考 createOrder 的 responese参数    |
|Error |Object   | 参考公共请求参数中Error格式   |
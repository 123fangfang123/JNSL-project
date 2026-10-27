#### 简要描述：

批量获取标签接口
> 注：暂时批量获取标签的接口只能打印同一物流产品的订单，不同物流产品混合打印会报错
------------

#### service名称:

batchGetLabelUrl

------------

#### paramsJson示例：

```json
{
	"reference_nos":["HHWEW0191000054YQ","HHWEW0191000046YQ"],
	"label_type":1,
	"label_content_type":6,
	"extra_option":{
		"print_declare_info":"N"
	}
}
```
------------

#### paramsJson参数:

|参数名|数据类型|是否必填|说明|
|:----    |:---|:----- |-----   |
|reference_nos |object  |Require |客户参考号（或者 系统运单号order_code 或 服务商追踪号shipping_method_no ） ***注意：一次性最多支持20票批量生成,超过数量容易出现获取失败或超时等错误*** |
|label_type |int  |Require |PDF标签尺寸类型：1：10 * 10 标签；~~2：A4纸；3：10 * 15标签~~    |
|label_content_type |int  |Option | 1--标签；2--报关单；3--配货单；4--标签+报关单；5--标签+配货单；6--标签+报关单+配货单，默认为4    |
|extra_option |object  |Option | 标签可选项    |

##### extra_option参数:
|参数名|数据类型|是否必填|说明|
|:----    |:---|:----- |-----   |
|print_declare_info |string  |Option | 是否打印配货信息：Y是，N否，默认为Y    |

------------

#### response XML示例:


##### 成功返回示例:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<SOAP-ENV:Envelope xmlns:SOAP-ENV="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ns1="http://www.example.org/Ec/">
    <SOAP-ENV:Body>
        <ns1:callServiceResponse>
            <response>{"ask":"Success","message":"Success","url":"http://192.168.16.21:10001/PDF/aa74bb0c-d7db-4182-9831-d9ce1f39f828.pdf","time_cost(s)":"7.1494090557098"}</response>
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
            <response>{"ask":"Failure","message":"","Error":{"errCode":"","errMessage":"HHWEW0191000054YYQ订单不存在"},"time_cost(s)":"0.29101586341858"}</response>
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
|url |string   | PDF标签格式URL地址    |
|Error |Object   | 参考公共请求参数中Error格式   |
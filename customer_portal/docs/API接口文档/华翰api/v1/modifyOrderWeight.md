#### 简要描述：

修改订单重量接口

------------

#### service名称:

modifyOrderWeight

------------


#### paramsJson示例：

```json
[{
	"order_code": "HHWEW0007000006YQ",
	"weight": "0.02"
},{
	"order_code": "HHWEW0007000005YQ",
	"weight": "0.03"
}]
```
------------

#### paramsJson参数:

|参数名|数据类型|是否必填|说明|
|:----    |:---|:----- |-----   |
|order_code |string  |Require |客户单号（或者系统订单号，或者服务商单号都可以）   |
|weight |string  |Require | 重量，单位KG,最多支持3位小数。   |

------------

#### response XML示例:


##### 成功返回示例:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<SOAP-ENV:Envelope xmlns:SOAP-ENV="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ns1="http://www.example.org/Ec/">
    <SOAP-ENV:Body>
        <ns1:callServiceResponse>
            <response>{"ask":"Success","message":"","Result":[{"order_code":"HHWEW0007000004YQ","ask":"Success","message":"Success"},{"order_code":"HHWEW0007000005YQ","ask":"Success","message":"Success"}],"time_cost(s)":"0.29701685905457"}</response>
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
            <response>{"ask":"Success","message":"","Result":[{"order_code":"HHWEW0007000006YQ","ask":"Failure","Error":{"errMessage":"只支持“草稿”，“换号中”，“已预报”等状态更新重量!","errCode":""}},{"order_code":"HHWEW000700000KYQ","ask":"Failure","Error":{"errMessage":"单号不存在!","errCode":""}}],"time_cost(s)":"0.25001502037048"}</response>
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
|Result |string   | 结果数组    |
|Error |Object   | 参考公共请求参数中Error格式   |

------------

#### Result参数:

|参数名|数据类型|说明|
|:----    |:---|-----   |
|ask |string  |参考公共请求参数中response参数   |
|message |string  | 参考公共请求参数中response参数    |
|order_code |string   | 请求单号    |
|Error |Object   | 参考公共请求参数中Error格式   |
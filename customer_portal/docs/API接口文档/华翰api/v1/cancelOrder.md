#### 简要描述：

取消订单接口

------------

#### service名称:

cancelOrder

------------

#### paramsJson示例：

```json
{
	"reference_no": "HHWEW0007000006YQ"
}
```
------------

#### paramsJson参数:

|参数名|数据类型|是否必填|说明|
|:----    |:---|:----- |-----   |
|reference_no |string  |Require |客户单号（或者系统运单号），注：只有草稿、已预报状态支持取消。   |

------------

#### response XML示例:


##### 成功返回示例:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<SOAP-ENV:Envelope xmlns:SOAP-ENV="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ns1="http://www.example.org/Ec/">
    <SOAP-ENV:Body>
        <ns1:callServiceResponse>
            <response>{"ask":"Success","message":"Success","reference_no":"HHWEW0007000005YQ","time_cost(s)":"0.45802593231201"}</response>
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
            <response>{"ask":"Failure","message":"订单不存在","reference_no":"HHWEW0007000006KYQ","Error":{"errMessage":"订单不存在","errCode":"5000"},"time_cost(s)":"0.2200129032135"}</response>
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
|reference_no |string  | 需要删除的客户单号（或者系统运单号）    |
|Error |Object   | 参考公共请求参数中Error格式   |
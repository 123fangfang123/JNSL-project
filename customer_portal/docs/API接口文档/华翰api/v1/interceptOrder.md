#### 简要描述：

拦截订单接口

------------

#### service名称:

interceptOrder

------------

#### paramsJson示例：

```json
{
	"reference_no": "HHWDE0092000008YQ"
}
```
------------

#### paramsJson参数:

|参数名|数据类型|是否必填|说明|
|:----    |:---|:----- |-----   |
|reference_no |string  |Require |系统运单号order_code。注：只有**“已预报”** 状态支持拦截。 


------------

#### response XML示例:


##### 成功返回示例:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<SOAP-ENV:Envelope xmlns:SOAP-ENV="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ns1="http://www.example.org/Ec/">
    <SOAP-ENV:Body>
        <ns1:callServiceResponse>
            <response>{"ask":"Success","message":"Success","reference_no":"HHWDE0098000004YQ","time_cost(s)":"0.28801608085632"}</response>
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
            <response>{"ask":"Failure","message":"订单不存在","reference_no":"HHWDE0098000004Y3Q","Error":{"errMessage":"订单不存在","errCode":"5000"},"time_cost(s)":"0.27701592445374"}</response>
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
|reference_no |Object   | 系统单号    |
|Error |Object   | 参考公共请求参数中Error格式   |
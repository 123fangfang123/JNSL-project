#### 简要描述：

批量获取标签接口
> 注：暂时批量获取发货证明的接口
------------

#### service名称:

batchGetDeliveryProof

------------

#### paramsJson示例：

```json
{
    "reference_nos":["HHWAA4236000002YQ","HHWAA4236000001YQ"],
    "labelName": "发货证明"
}
```
------------

#### paramsJson参数:

|参数名|数据类型|是否必填|说明|
|:----    |:---|:----- |-----   |
|reference_nos |object  |Require |客户参考号（或者 系统运单号order_code 或 服务商追踪号shipping_method_no ） ***注意：一次性最多支持10票批量生成,超过数量容易出现获取失败或超时等错误，建议一次获取3票以内*** |
|labelName |string  |Require |发货证明    |

------------

#### response XML示例:


##### 成功返回示例:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<SOAP-ENV:Envelope xmlns:SOAP-ENV="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ns1="http://www.example.org/Ec/">
    <SOAP-ENV:Body>
        <ns1:callServiceResponse>
            <response>{"ask":"Success","message":"Success","data":[{"url":"http://120.79.252.215:10001/PDF/1be397ef-901f-403d-a770-85a4dcb30ee7.pdf","reference_no":"HHWCY4239000001YQ"},{"url":"http://120.79.252.215:10001/PDF/c06de41f-aa11-4f46-a941-299e7c1dd93d.pdf","reference_no":"HHWCY4237000002YQ"}],"time_cost(s)":"0.11023712158203"}</response>
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
            <response>{"ask":"Failure","message":"","Error":{"errCode":"","errMessage":"全部获取失败"},"time_cost(s)":"0.10532593727112"}</response>
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
|Error |Object   | 参考公共请求参数中Error格式   |****
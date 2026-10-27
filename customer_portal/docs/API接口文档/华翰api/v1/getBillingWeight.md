#### 简要描述：

订单实际计费重接口

------------

#### service名称:

getBillingWeight

------------

#### paramsJson示例：

```json
{"codes":["HHWIK1102001476YQ","LY735983048CN"]}
```
------------

#### paramsJson参数:

|参数名|数据类型|是否必填|说明|
|:----    |:---|:----- |-----   |
|codes |Object/Array  |Require |客户单号reference_no（或者 系统运单号order_code，或服务商单号shipping_method_no 都可以） |

------------
#### response XML示例:


##### 成功返回示例:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<SOAP-ENV:Envelope xmlns:SOAP-ENV="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ns1="http://www.example.org/Ec/">
    <SOAP-ENV:Body>
        <ns1:callServiceResponse>
            <response>{"ask":"Success","message":"Success","Data":[{"Code":"HHWIK1102001476YQ","chargeweight":"0.301","message":""},{"Code":"LY735983048CN","chargeweight":"1.000","message":""}],"time_cost(s)":"0.078124046325684"}</response>
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
            <response>{"ask":"Success","message":"Success","Data":[{"Code":"HHWHL1092000002YQ","chargeweight":"","message":"订单还未入库"},{"Code":"RV561160645CN11","chargeweight":"","message":"订单不存在,或运单不属于该客户"}],"time_cost(s)":"0.15624809265137"}</response>
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
|Data |Object   | 数据内容(2维数组)    |
|Error |Object   | 参考公共请求参数中Error格式   |

##### Data参数:

|参数名|数据类型|说明|
|:----    |:---|-----   |
|Code |string  |单号   |
|chargeweight |float  |计费重 （KG）  |
|message |string  | 报错信息    |
#### 简要描述：

订单费用查询接口

------------

#### service名称:

getOrderFee

------------

#### paramsJson示例：

```json
{
	"reference_no": "HHWFL9289000004YQ"
}
```
------------

#### paramsJson参数:

|参数名|数据类型|是否必填|说明|
|:----    |:---|:----- |-----   |
|reference_no |string  |Require |客户单号reference_no（或者 系统运单号order_code，或服务商单号shipping_method_no 都可以），注意：目前只支持单个单号查询 |

------------
#### response XML示例:


##### 成功返回示例:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<SOAP-ENV:Envelope xmlns:SOAP-ENV="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ns1="http://www.example.org/Ec/">
    <SOAP-ENV:Body>
        <ns1:callServiceResponse>
            <response>{"ask":"Success","message":"Success","reference_no":"HHWFL9289000004YQ","data":"{"total_price":"0.00","details":[{"fee_name":"\u901f\u9012\u8fd0\u8d39","price":"25.50","currency":"RMB","create_date":"2019-10-16 11:20:12"},{"fee_name":"\u6d4b\u8bd5\u8d39\u7528","price":"0.07","currency":"RMB","create_date":"2019-10-16 11:20:12"},{"fee_name":"\u6302\u53f7\u8d39","price":"21.35","currency":"RMB","create_date":"2019-10-16 11:20:12"}]}","time_cost(s)":"0.3000168800354"}</response>
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
            <response>{"ask":"Failure","message":"Failure","reference_no":"HHWFL9289000004YQ1","Error":{"errCode":"50010","errMessage":"订单不存在,或运单不属于该客户"},"time_cost(s)":"0.28201603889465"}</response>
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
|reference_no |string  | 客户参考号   |
|data |Object   | 数据内容(2维数组)    |
|Error |Object   | 参考公共请求参数中Error格式   |

##### data参数:

|参数名|数据类型|说明|
|:----    |:---|-----   |
|total_price |float  |总费用   |
|details |Object  | 费用明细列表    |

###### details参数:

|参数名|数据类型|说明|
|:----    |:---|-----   |
|fee_name |string  |费用名称   |
|price |float  | 金额    |
|currency |string  | 币种    |
|currencyrate |string  | 币种汇率    |
|create_date |string  | 创建时间    |
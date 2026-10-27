#### 简要描述：

查询运单入库后实际发货跟踪号接口

------------

#### service名称:

getTrackNumber

------------

#### paramsJson示例：

```json
{
	"reference_no": ["HHWEW0007000008YQ", "HHWEW0007000009YQ"]
}
```
------------

#### paramsJson参数:

|参数名|数据类型|是否必填|说明|
|:----    |:---|:----- |-----   |
|reference_no |Object  |Require |客户单号reference_no（或者系统运单号order_code）数组,如{" reference_no ":["code1"," code2"]}   |

------------

#### response XML示例:


##### 成功返回示例:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<SOAP-ENV:Envelope xmlns:SOAP-ENV="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ns1="http://www.example.org/Ec/">
    <SOAP-ENV:Body>
        <ns1:callServiceResponse>
            <response>{"ask":"Success","data":[{"state":"1","OrderNumber":"WWW3THHF5S25A23","TrackingNumber":"LO715818719CN","WayBillNumber":"HHWEW0007000008YQ"},{"state":"1","OrderNumber":"WWW3THHF5S25A23","TrackingNumber":"LO715818719CN","WayBillNumber":"HHWEW0007000008YQ"}],"Error":[],"message":"全部获取成功","time_cost(s)":"0.35601997375488"}</response>
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
            <response>{"ask":"Failure","data":[{"state":"0","OrderNumber":"HHWEW0007000008YQK","TrackingNumber":"","WayBillNumber":"","msg":"单号：[HHWEW0007000008YQK]订单信息不存在"},{"state":"0","OrderNumber":"HHWEW0007000008YQL","TrackingNumber":"","WayBillNumber":"","msg":"单号：[HHWEW0007000008YQL]订单信息不存在"}],"Error":[],"message":"全部获取失败","time_cost(s)":"0.24401378631592"}</response>
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
| state |  int  |  1为成功；0为失败   |
| OrderNumber |  string  |  客户单号   |
| TrackingNumber |  string  |  跟踪号   |
| WayBillNumber |  string  |  系统运单号   |
| msg |  string  |  错误信息   |
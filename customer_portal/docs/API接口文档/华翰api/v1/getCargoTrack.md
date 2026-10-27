#### 简要描述：

轨迹查询接口

------------

#### service名称:

getCargoTrack

------------

#### paramsJson示例：

```json
{
	"codes": ["HHWDE9344000011YQ", "HHWDE9344000012YQ"]
}
```
------------

#### paramsJson参数:

|参数名|数据类型|是否必填|说明|
|:----    |:---|:----- |-----   |
|codes |Object/Array  |Require |服务商单号shipping_method_no（或者系统订单号order_code）数组,如{"codes":["TFL1"," TFL2"]}   |

*注：1、此单号为创建订单时候我司返回的追踪号（shipping_method_no字段）*
     * 2、此接口支持批量查询，建议一次请求50票；不建议并发请求，并发可能会被WAF防火墙拦截（建议 5 req/s 以下的请求频率） *
------------

#### response XML示例:


##### 成功返回示例:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<SOAP-ENV:Envelope xmlns:SOAP-ENV="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ns1="http://www.example.org/Ec/">
    <SOAP-ENV:Body>
        <ns1:callServiceResponse>
            <response>{"ask":"Success","message":"Success","Data":[{"Code":"HHWDE9344000011YQ","Country_code":"FR","New_date":"2019-12-31 09:26:30","New_Comment":"快件操作完成","Status":"DF","Detail":[{"Occur_date":"2019-12-31 09:26:30","Status":"DF","Comment":"快件操作完成 Shipment departed from facility","track_area":"SHENZHEN"},{"Occur_date":"2019-12-31 09:26:30","Status":"AF","Comment":"快件到达作业中心 Shipment arrived at facility","track_area":"SHENZHEN"},{"Occur_date":"2019-12-10 17:33:00","Status":"IR","Comment":"快件电子信息已经收到 Shipment information received","track_area":""}]},{"Code":"HHWDE9344000012YQ","Country_code":"FI","New_date":"2019-12-10 17:33:03","New_Comment":"运单电子信息已收到","Status":"NO","Detail":[{"Occur_date":"2019-12-10 17:33:03","Status":"IR","Comment":"快件电子信息已经收到 Shipment information received","track_area":""}]}],"Error":[],"time_cost(s)":"0.22901296615601"}</response>
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
            <response>{"ask":"Success","message":"Success","Data":[{"Code":"HHWDE9344000011KYQ","Country_code":"","New_date":"","New_Comment":"","Status":"","Detail":[]},{"Code":"HHWDE9344000012kkYKQ","Country_code":"","New_date":"","New_Comment":"","Status":"","Detail":[]}],"Error":[],"time_cost(s)":"0.18701100349426"}</response>
        </ns1:callServiceResponse>
    </SOAP-ENV:Body>
</SOAP-ENV:Envelope>
```

```xml
<?xml version="1.0" encoding="UTF-8"?>
<SOAP-ENV:Envelope xmlns:SOAP-ENV="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ns1="http://www.example.org/Ec/">
    <SOAP-ENV:Body>
        <ns1:callServiceResponse>
            <response>{"ask":"Failure","message":"","Data":[],"Error":{"cnMessage":"单号不能为空","enMessage":"Order Code. can not be empty"},"time_cost(s)":"0.063003063201904"}</response>
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
|Country_code |string  | 目的国家代码    |
|New_date |string   | 最新的轨迹时间，格式为：YYYY-MM-DD HH:MM:SS    |
|New_Comment |string   | 最新的轨迹内容   |
|Status |string   | **轨迹状态码**   |
|Detail |Object   | 轨迹明细内容(2维数组)   |

##### Detail参数:

|参数名|数据类型|说明|
|:----    |:---|-----   |
|Occur_date |string  |轨迹发生时间   |
|Status |string  | 轨迹状态    |
|Comment |string   | 轨迹内容   |
|track_area |string   |  发生地点全称  |

##### 轨迹状态代码对应表:
![](/uploads/mindoc/images/m_dda782192c155c0f4053a9980d2eeace_r.png)
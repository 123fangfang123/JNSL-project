#### 简要描述：

轨迹查询接口

------------

#### service名称:

getCargoTrackPdd

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

*注： 1、此单号为创建订单时候我司返回的运单号或者追踪单号或者客户单号）*

------------

#### response XML示例:


##### 成功返回示例:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<SOAP-ENV:Envelope xmlns:SOAP-ENV="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ns1="http://www.example.org/Ec/">
    <SOAP-ENV:Body>
        <ns1:callServiceResponse>
            <response>{"ask":"Success","message":"Success","Data":[{"Code":"HHWQV2359000002YQ","Country_code":"US","New_date":"2022-12-25 14:26:15","Time_zone":"+08:00","New_Comment":"快件到达作业中心","Status":"AF","Error_code":"0000","Detail":[{"Occur_date":"2022-12-25 14:26:15","Occur_time_zone":"+08:00","Status":"AF","Comment":"Has entered the warehouse","track_area":"SHENZHEN"},{"Occur_date":"2022-12-25 14:07:43","Occur_time_zone":"+08:00","Status":"IR","Comment":"Shipment information received","track_area":"CHINA"}]}],"Error":[],"time_cost(s)":"0.032227039337158"}</response>
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
            <response>{"ask":"Success","message":"Success","Data":[{"Code":"Haaaaaaaa000002YQ","Country_code":"","New_date":"","New_Comment":"","Status":"","Error_code":"0001","Detail":[]}],"Error":[],"time_cost(s)":"0.030274868011475"}</response>
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
|New_date |string   | 最新的轨迹时间+时区，格式为：YYYY-MM-DD HH:MM:SS  |
|Time_zone |string  | 时区，格式：+08:00   |
|New_Comment |string   | 最新的轨迹内容   |
|Status |string   | **轨迹状态码**   |
|Detail |Object   | 轨迹明细内容(2维数组)   |

##### Detail参数:

|参数名|数据类型|说明|
|:----    |:---|-----   |
|Occur_date |string  |轨迹发生时间  |
|Occur_time_zone |string   | 时区，格式：+08:00 |
|Status |string  | 轨迹状态    |
|Comment |string   | 轨迹内容   |
|track_area |string   |  发生地点全称  |

##### 轨迹状态代码对应表:
![](/uploads/mindoc/images/m_9f65badd44a065c5be6e87dcf426d07d_r.png)
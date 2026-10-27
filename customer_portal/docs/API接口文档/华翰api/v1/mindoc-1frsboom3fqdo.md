#### 简要描述：

批量获取FBA标签
> 注：批量获取FBA标签
------------

#### service名称:

getFbaLabel

------------

#### paramsJson示例：

```json
{
    "box_nos":["HHWAA4236000002YQU0011"]
}
```
------------

#### paramsJson参数:

|参数名|数据类型|是否必填|说明|
|:----    |:---|:----- |-----   |
|box_nos |object  |Require |FBA箱号（或者 子单追踪单号 ） ***注意：一次性最多支持20票批量生成,超过数量容易出现获取失败或超时等错误*** |

------------

#### response XML示例:


##### 成功返回示例:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<SOAP-ENV:Envelope xmlns:SOAP-ENV="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ns1="http://www.example.org/Ec/">
    <SOAP-ENV:Body>
        <ns1:callServiceResponse>
            <response>{"ask":"Success","message":"Success","data":[{"child_number":"HHWAA4236000002YQU001","fba_box_no":"fbaboxnosjk11","child_track_number":"HHWAA4236000002YQU001","ol_label_url_ori":"http://192.168.16.21:80/index/get-label/code/HHWAA1291000019YQ"}],"time_cost(s)":"0.13107204437256"}</response>
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
            <response>{"ask":"Failure","message":"","Error":{"errCode":"","errMessage":"订单号HHWAA4236000002YQU0011不存在，或者不属于该用户"},"time_cost(s)":"0.12351894378662"}</response>
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
|data |Object   | 包含子单号，FBA箱号，子单追踪单号，PDF标签URL    |
|Error |Object   | 参考公共请求参数中Error格式   |****
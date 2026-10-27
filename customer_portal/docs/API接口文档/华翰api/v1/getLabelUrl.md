#### 简要描述：

获取标签接口

------------

#### service名称:

getLabelUrl

------------

#### paramsJson示例：

```json
{
	"reference_no": "HHWEW0006000012YQ",
	"label_type": 1,
	"label_content_type": 4
}
```
------------

#### paramsJson参数:

|参数名|数据类型|是否必填|说明|
|:----    |:---|:----- |-----   |
|reference_no |string  |Require |客户单号reference_no（或者 系统运单号order_code，或服务商单号shipping_method_no 都可以）|
|label_type |int  |Require | PDF标签尺寸类型（1：10 * 10标签；~~2：A4纸；3：10 * 15标签~~） |
|label_content_type |int  |option | 1-标签；2-报关单；3-配货单；4-标签+报关单；5-标签+配货单；6-标签+报关单+配货单，默认为4    |

------------

#### response XML示例:


##### 成功返回示例:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<SOAP-ENV:Envelope xmlns:SOAP-ENV="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ns1="http://www.example.org/Ec/">
    <SOAP-ENV:Body>
        <ns1:callServiceResponse>
            <response>{"ask":"Success","message":"获取标签成功","Error":[],"type":"pdf","url":"http://127.0.0.1/index/get-label/code/HHWEW0006000012YQ","time_cost(s)":"0.88304996490479"}</response>
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
            <response>{"ask":"Failure","message":"","Error":{"errCode":"","errMessage":"HHWEW0006000012KYQ订单不存在"},"type":"pdf","url":"","time_cost(s)":"0.18701100349426"}</response>
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
|url |string   | PDF标签格式URL地址。注标签URL有效时间为1个星期，如果未保存标签文件到本地,可以重新调用获取标签接口生成新的标签。    |
|type |string   | 文件格式    |
|Error |Object   | 参考公共请求参数中Error格式   |
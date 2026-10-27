#### 客户线索接口（暂未对外启用）
> 注：客户线索接口（暂未对外启用，使用之前请联系您的业务经理找我司IT获取请求参数信息）
------------

service名称: ( 正式地址请咨询IT获取)

------------
#### paramsJson示例：

```
{
	"customersource_code":"test",
    "company_name":"test",
	"contact_name":"123456",
	"contact_phone":"158138××885",
	"province":"广东省",
	"city":"深圳市",
	"area":"龙岗区",
	"street":"布吉街道新二村202",
	"sale_name":"ADMIN",
	"remarks":"这个是个测试",
}
```
------------

#### Body参数:
|参数名|数据类型|是否必填|说明|
|:----    |:---|:----- |-----   |
|customersource_code |string  |Require |校验的客户来源名字 (请咨询IT获取)
|company_name |string  |Require |公司名称
|contact_name |string  |Require |联系人名字
|contact_phone |string  |Require |联系人电话
|province |string  |Require |省份
|city |string  |Require |城市
|area |string  |Require |地区
|street |string  |Require |街道
|sale_name |string  |Option |业务员 默认admin
|remarks |string  |Option |客户备注

  
##### response 成功返回示例:

```xml
<?xml version="1.0" encoding="UTF-8"?>
   <SOAP-ENV:Envelope xmlns:SOAP-ENV="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ns1="http://www.example.org/Ec/">
      <SOAP-ENV:Body>
         <ns1:callServiceResponse>
            <response>
               {"ask":"1","message":"success","customer_code":"HHTEST12122","time_cost(s)":"0.16000890731812"}
            </response>
</ns1:callServiceResponse>
</SOAP-ENV:Body>
</SOAP-ENV:Envelope>
```

##### response 失败返回示例:

```xml

<?xml version="1.0" encoding="UTF-8"?>
   <SOAP-ENV:Envelope xmlns:SOAP-ENV="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ns1="http://www.example.org/Ec/">
      <SOAP-ENV:Body>
         <ns1:callServiceResponse>
            <response>
              {"ask":"0","message":"公司名称已存在","time_cost(s)":"0.11800694465637"}
            </response>
</ns1:callServiceResponse>
</SOAP-ENV:Body>
</SOAP-ENV:Envelope>
```

#### response参数:

|参数名|数据类型|说明|
|:----    |:---|-----   |
|ask |string  |参考公共请求参数中response参数   |
|message |string  | 参考公共请求参数中response参数    |
|customer_code |string   | 客户代码    |

------------
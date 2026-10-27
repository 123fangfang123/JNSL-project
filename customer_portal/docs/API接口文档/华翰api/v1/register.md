#### 注册用户接口（暂未对外启用）
> 注：注册用户接口（暂未对外启用，使用之前请联系您的业务经理找我司IT获取请求参数信息）
------------

service名称: ( 正式地址请咨询IT获取)

------------
#### paramsJson示例：

```
{
	"verify_name":"test",
    "user_code":"test",
	"user_password":"123456",
	"user_name":"测试",
	"user_mobile_phone":"158138××885",
	"customer_shortname":"华翰",
	"user_email":"1812@qq.com",
	"customer_address":"深圳市×××",
	"customersource_code":"C",
	"sale_name":"WYZC11",
	"introducer_code":"DSERS"
}
```
------------

#### Body参数:
|参数名|数据类型|是否必填|说明|
|:----    |:---|:----- |-----   |
|verify_name |string  |Require |校验的对象名字 (请咨询IT获取)
|user_code |string  |Require |用户名
|user_password |string  |Require |密码
|user_name |string  |Require |联系人
|user_mobile_phone |string  |Require |联系人电话
|customer_shortname |string  |Require |客户名称/公司名称
|user_email |string  |Require |邮箱
|customer_address |string  |Require |详细地址
|customersource_code |string  |Option |客户来源（C:自行寻找 P：平台介绍 S:内部介绍 A:API注册(默认)）
|sale_name |string  |Require |绑定销售人员工号
|introducer_code |string  |Option |介绍人代码（需提前找您的销售人员获取）

  
##### response 成功返回示例:

```xml
<?xml version="1.0" encoding="UTF-8"?>
   <SOAP-ENV:Envelope xmlns:SOAP-ENV="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ns1="http://www.example.org/Ec/">
      <SOAP-ENV:Body>
         <ns1:callServiceResponse>
            <response>
               {"ask":"1","message":"账号注册成功","account":"test","password":"123456","customer_id":"15867","time_cost(s)":"0.16000890731812"}
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
               {"ask":0,"message":"用户名已被使用","time_cost(s)":"0.16000890731812"}
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
|account |string   | 用户账号    |
|password |string   | 用户密码    |
|customer_id |string   | 用户ID    |

------------
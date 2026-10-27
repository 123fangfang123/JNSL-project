#### 简要描述：

API公共请求参数说明

------------

#### 请求地址:

##### WebServices地址(如果用soap方法做对接，就用这个地址)
#### http://api.hh-exp.com/default/svc/wsdl

##### webApi地址(如果用curl方法做对接，就用这个地址，该地址支持postman请求)建议使用此模式
#### **http://api.hh-exp.com/default/svc/web-service**
> 注：此接口地址就是正式环境地址.
`特别说明:  不可以使用该接口域名进行客户端登陆操作(会出现无法登陆等异常)，此地址是专门给API接口使用！华翰客户端地址：http://www.hhddb.com 客户端应该使用此地址登陆操作！切记！！！`
------------

#### 请求公共参数:

|参数名|类型|必填项|描述|
|:----    |:---|:----- |-----   |
|appToken |String  |√ |API账号 |
|appKey |String  |√ | API密码  |
|service |String  |√ | 接口方法，参考接口列表中service名称    |
|paramsJson |String  |√ | 请求的数据内容（json格式），参考接口列表中paramsJson示例说明    |

------------
> ###### 注：API账户密码是使用您在我司开户账号密码，登陆我司客户端：www.hhddb.com 生成对接的API账号密码 [步骤：登陆->API设置->添加]
![](/uploads/mindoc/images/m_e38d2b97d08776121c8686161b13a37c_r.png)
------------

#### 请求XML:
```xml
<?xml version="1.0" encoding="UTF-8"?>
<SOAP-ENV:Envelope xmlns:SOAP-ENV="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ns1="http://www.example.org/Ec/">
	<SOAP-ENV:Body>
		<ns1:callService>			
			<paramsJson>{json}</paramsJson>
			<appToken>appToken</appToken>
			<appKey>appKey</appKey>
			<service>{service}</service>
		</ns1:callService>
	</SOAP-ENV:Body>
</SOAP-ENV:Envelope>
```

------------

#### 响应公共参数:

|参数名|类型|必填项|描述|
|:----    |:---|:----- |-----   |
|ask |String  |√ |响应标志，Success表示成功，Failure表示失败   |
|message |String  |√ | 消息提示    |
|Error |Object  | | 错误信息    |

------------

#### Error格式:

|参数名|类型|必填项|描述|
|:----    |:---|:----- |-----   |
|errMessage |String  |√ |错误信息内容   |
|errCode |String  |√ | 错误码    |

------------

#### pagination格式:

|参数名|类型|必填项|描述|
|:----    |:---|:----- |-----   |
|pageSize |String  |√ |分页大小   |
|page |String  |√ | 当前页    |

------------

#### 响应XML:
```xml
<?xml version="1.0" encoding="UTF-8"?>
<SOAP-ENV:Envelope xmlns:SOAP-ENV="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ns1="http://www.example.org/Ec/">
	<SOAP-ENV:Body>
		<ns1:callServiceResponse>			
		<response>{json}</response>
		</ns1:callServiceResponse>
	</SOAP-ENV:Body>
</SOAP-ENV:Envelope>
```

------------

#### 备注:

如果JSON里面有"<"和"&",请转义成对应的XML实体。
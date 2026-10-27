获取仓库代码列表接口
> 注：获取获取仓库代码列表
------------

#### service名称:

getWarehouseCode

------------

#### paramsJson示例：

```json
{
    "warehouse_code":"CDG7-60452",
	"country_code":"US"
}
```
------------

#### paramsJson参数:
paramsJson不需要传参  默认查询所有  也支持查询单个

|参数名|数据类型|是否必填|说明|
|:----    |:---|:----- |-----   |
|warehouse_code |string  |Option |仓库代码
|country_code |string  |Option |国家二字码

#### response XML示例:

  
##### 成功返回示例:

```xml
<?xml version="1.0" encoding="UTF-8"?>
   <SOAP-ENV:Envelope xmlns:SOAP-ENV="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ns1="http://www.example.org/Ec/">
      <SOAP-ENV:Body>
         <ns1:callServiceResponse>
            <response>
               {"ask":"Success","data":[{"aa_id":"140","aa_via_code":"AMZ-CDG7","aa_warehouse_code":"CDG7-60452","aa_status":"ON","aa_contact":"PARC ACTIVITES DES PORTES DE SENLIS","aa_country_code":"FR","aa_province":"","aa_city":"SENLIS","aa_district":"","aa_street":"1 AVENUE ALAIN BOUCHER","aa_street2":"","aa_street3":"","aa_doorplate":"","aa_postcode":"60452","aa_telephone":"","aa_mobile":"","aa_company":"AMAZON FULFILLMENT CENTER (CDG7)","st_id_creator":"0","createdate":"2023-09-01 13:47:35","st_id_modify":"","modifydate":"","last_update_time":"2024-10-07 11:36:48","group_code":"default","service_warehouse_code":""}],"Error":[],"message":"数据返回成功","time_cost(s)":"0.092005968093872"}
            </response>
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
            <response>
               {"ask":"Failure","data":[],"Error":[],"message":"暂无数据，不存在此仓库代码或者国家","time_cost(s)":"0.10100603103638"}
            </response>
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
|aa_via_code |string  | 自定义代码    |
|aa_warehouse_code |string  | 仓库代码    |
|aa_status |string  | 状态,ON 生效， OF 失败    |
|aa_contact |string  | 联系人    |
|aa_country_code |string  | 国家    |
|aa_province |string  | 州    |
|aa_city |string  | 城市    |
|aa_district |string  | 区    |
|aa_street |string  | 街道1    |
|aa_street2 |string  | 街道2    |
|aa_street3 |string  | 街道3    |
|aa_doorplate |string  | 门牌号    |
|aa_postcode |string  | 邮编    |
|aa_telephone |string  | 电话    |
|aa_mobile |string  | 手机    |
|aa_company |string  | 公司名    |
|st_id_creator |string  | 创建人    |
|createdate |string  | 创建时间    |
|st_id_modify |string  | 修改人    |
|modifydate |string  | 修改时间    |
|group_code |string  | 仓库组别代码    |
|service_warehouse_code |string  | 服务商仓库代码    |
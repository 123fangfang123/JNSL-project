#### 简要描述：

查询订单接口

------------

#### service名称:

getOrder

------------

#### paramsJson示例：

```json
{
	"reference_no": "HHWEW0007000006YQ"
}
```
------------

#### paramsJson参数:

|参数名|数据类型|是否必填|说明|
|:----    |:---|:----- |-----   |
|reference_no |string  |Require |客户参考号（或者系统运单号）   |

------------

#### response XML示例:


##### 成功返回示例:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<SOAP-ENV:Envelope xmlns:SOAP-ENV="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ns1="http://www.example.org/Ec/">
    <SOAP-ENV:Body>
        <ns1:callServiceResponse>
            <response>{"ask":"Success","message":"Success","reference_no":"HHWEW0007000006YQ","data":{"shipping_method":"PK0032","country_code":"ES","reference_no":"WWW3THHF5S25A13D416","shipper_hawbcode":"HHWEW0007000006YQ","shipping_method_no":"LO715812132CND664","order_weight":"0.000","order_pieces":"1","buyer_id":"","modify_date":"2020-01-08 15:03:27","mail_cargo_type":"4","insurance_value":"0.000","Consignee":{"consignee_countrycode":"ES","consignee_company":"","consignee_province":"aa","consignee_name":"sdg","consignee_city":"dfh","consignee_telephone":"1212521","consignee_mobile":"","consignee_postcode":"","consignee_email":"","consignee_street":"SDAGSDGSDG","consignee_street2":"","consignee_street3":"","consignee_certificatetype":"","consignee_certificatecode":"","consignee_credentials_period":"","consignee_doorplate":"","consignee_taxno":"AABBCC008"},"Shipper":{"shipper_name":"hh cai","shipper_company":"","shipper_countrycode":"CN","shipper_province":"GUANGDONG","shipper_city":"SHENZHEN","shipper_street":"pinghu 55 SHENZHEN GUANGDONG","shipper_postcode":"518000","shipper_areacode":"","shipper_telephone":"18011911234","shipper_mobile":"18011911234","shipper_email":"","shipper_fax":""},"ItemArr":[{"invoice_cnname":"手机壳","invoice_enname":"sd","unit_code":"PCE","invoice_weight":"1.000","invoice_quantity":"1","invoice_totalcharge":"3.33","invoice_totalWeight":"1.000","invoice_currencycode":"USD","hs_code":"","invoice_note":"","invoice_url":"","sku":"4644392","sku_audit_status":"","CertificateRemark":"","HSTaxrate":"0.00000","type_code":"","box_no":"U001","Material":"","ASIN":"","invoice_function":"","invoice_brand":"","invoice_unitcharge":"3.33"}]},"time_cost(s)":"0.27301597595215"}</response>
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
            <response>{"ask":"Failure","message":"订单不存在","reference_no":"HHWEW0007000006YKQ","time_cost(s)":"0.22101211547852"}</response>
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
|reference_no |string  | 客户单号    |
|data |string   | 数据内容(2维数组)     |
|err_code |Object   | 参考公共请求参数中Error格式   |

##### data参数:

|参数名|数据类型|说明|
|:----    |:---|-----   |
| shipping_method | string  | 配送方式   |
| country_code | string  |  收件人国家二字码  |
| reference_no | string  |  客户参考号  |
| shipper_hawbcode |  string |  运单号  |
| shipping_method_no | string  |  服务商单号  |
| order_weight | float  |  订单重量，单位KG，默认为0.2  |
| order_pieces | int  |  外包装件数,默认1  |
| buyer_id | string  |  买家ID  |
| modify_date | string  |  修改时间  |
| mail_cargo_type |  string |  包裹申报种类（1-Gif礼品；2-CommercialSample商品货样；3-Document文件；4-Other其他），默认4 |
| insurance_value | float  |  投保金额,币种USD  |
| Consignee | Object  |  收件人信息  |
| Shipper | Object  |  发件人信息  |
| ItemArr | Object/Array  |  海关申报信息  |

##### Consignee参数:

|参数名|数据类型|说明|
|:----    |:---|-----   |
| consignee_countrycode  |  string  |  收件人国家二字码   |
|  consignee_company  |  string  |  收件人公司名   |
|  consignee_province  |  string  |  收件人省   |
|  consignee_name  |  string  |  收件人姓名   |
|  consignee_city  |  string  |  收件人城市   |
|  consignee_telephone  |  string  |  收件人电话   |
|  consignee_mobile  |  string  |  收件人手机   |
|  consignee_postcode  |  string  |  收件人邮编   |
|  consignee_email  |  string  |   收件人邮箱  |
|  consignee_street  |  string  |  收件人地址1   |
|  consignee_street2  |  string  |  收件人地址2   |
|  consignee_street3  |  string  |   收件人地址3  |
|  consignee_certificatetype  |  string  |  证件类型 ID:身份证 PP:护照   |
|  consignee_certificatecode  |  string  |  证件号码   |
|  consignee_credentials_period  |  string  |  有效期,格式：2014-04-15   |
|  consignee_doorplate  |  string  |  收件人名牌号   |
|  consignee_taxno  |  string  |  收件人税号   |



##### Shipper参数:

|参数名|数据类型|说明|
|:----    |:---|-----   |
|  shipper_name  |   string  |   发件人姓名  |
|  shipper_company  |  string   |  发件人公司名   |
|  shipper_countrycode  |  string   |  发件人国家二字码   |
|  shipper_province  |  string   |  发件人省   |
|  shipper_city  |  string   |  发件人城市   |
|  shipper_street  |   string  |   发件人地址  |
|  shipper_postcode  |   string  |  发件人邮编   |
|  shipper_areacode  |  string   |   区域代码  |
|  shipper_telephone  |   string  |   发件人电话  |
|  shipper_mobile  |  string   |  发件人手机   |
|  shipper_email  |  string   |  发件人邮箱   |
|  shipper_fax  |  string   |  发件人传真   |



##### ItemArr参数:

|参数名|数据类型|说明|
|:----    |:---|-----   |
|  invoice_cnname   |   string   |   中文海关申报品名   |
|  invoice_enname   |   string   |   海关申报品名   |
|  unit_code   |   string   |  单位(MTR(米), PCE(件), SET(套)), 默认PCE    |
|  invoice_weight   |  float    |   申报重量，单位KG, 精确到三位小数。   |
|  invoice_quantity   |   int   |   数量   |
|  invoice_totalcharge   |   float   |  总价    |
|  invoice_totalWeight   |   float   |   总重量   |
|  invoice_currencycode   |   string   |   申报币种，默认为USD(美元)   |
|  hs_code  |   string   |  海关协制编号    |
|  invoice_note   |   string   |   配货信息   |
|  invoice_url   |   string   |   销售地址   |
|  sku   |   string   |  产品SKU编码    |
|  invoice_unitcharge   |  float    |  单价    |
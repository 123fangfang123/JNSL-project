#### 简要描述：

获取配送方式接口

------------

#### service名称:

getShippingMethod

------------



#### paramsJson示例：

paramsJson不需要传参

------------

#### response XML示例:


##### 成功返回示例:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<SOAP-ENV:Envelope xmlns:SOAP-ENV="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ns1="http://www.example.org/Ec/">
    <SOAP-ENV:Body>
        <ns1:callServiceResponse>
            <response>{"ask":"Success","data":[{"code":"PK0032","cn_name":"B测试产品","en_name":"B测试产品","group_code":"SP","track_status":"N","aging":"1-3","note":""},{"code":"PK0048","cn_name":"C测试产品","en_name":"Cproduct","group_code":"SP","track_status":"N","aging":"1-2","note":""},{"code":"PK0059","cn_name":"D测试产品","en_name":"Dproduct","group_code":"MA","track_status":"N","aging":"","note":""},{"code":"FEDEX-IE","cn_name":"FEDEX-IE","en_name":"FEDEX-IE","group_code":"FE","track_status":"Y","aging":"1-7","note":"FEDEX-IE"},{"code":"FEDEX-IP","cn_name":"FEDEX-IP","en_name":"FEDEX-IP","group_code":"FE","track_status":"Y","aging":"1-7","note":""},{"code":"HKUPSDLCX","cn_name":"HK-UPS代理促销","en_name":"HKUPSDLCX","group_code":"UP","track_status":"N","aging":"","note":""},{"code":"HKUPSTH5","cn_name":"HK-UPS特惠5000","en_name":"HKUPSTH5","group_code":"UP","track_status":"Y","aging":"","note":""},{"code":"HKUPSTH","cn_name":"HK-UPS特惠6000","en_name":"HKUPSTH6000","group_code":"UP","track_status":"Y","aging":"","note":""},{"code":"HKUPSTHCX","cn_name":"HK-UPS特惠促销","en_name":"HKUPSTHCX","group_code":"UP","track_status":"Y","aging":"","note":""},{"code":"HKUPSLDF","cn_name":"HK-UPS蓝单F","en_name":"HKUPSLDF","group_code":"UP","track_status":"Y","aging":"","note":""},{"code":"HKUPSLDCX","cn_name":"HK-UPS蓝单促销","en_name":"HKUPSLDCX","group_code":"UP","track_status":"Y","aging":"","note":""},{"code":"HKUPSKS","cn_name":"HK-UPS速快","en_name":"HKUPSKS","group_code":"SP","track_status":"Y","aging":"","note":""},{"code":"HKDHLDLJ","cn_name":"HKDHL-代理价","en_name":"HKDHLDLJ","group_code":"DH","track_status":"Y","aging":"1-7","note":""},{"code":"HLDHLMGJ","cn_name":"HKDHL-敏感价","en_name":"HKDHLMGJ","group_code":"DH","track_status":"Y","aging":"1-7","note":""},{"code":"HKUPSDLJ","cn_name":"HKUPS-代理价","en_name":"HKUPSDLJ","group_code":"UP","track_status":"Y","aging":"1-7","note":""},{"code":"HKUPSTH5F","cn_name":"HKUPS特惠5000-F","en_name":"HKUPSTH5F","group_code":"UP","track_status":"Y","aging":"","note":""},{"code":"PK0028","cn_name":"UPS红单包税","en_name":"UPSHDBSCP","group_code":"SP","track_status":"N","aging":"","note":""},{"code":"PK0019","cn_name":"US--速快(平衡车类)","en_name":"USSKPHCCP","group_code":"SP","track_status":"N","aging":"","note":""},{"code":"PK0018","cn_name":"US--速快(敏感)","en_name":"USSKMGCP","group_code":"SP","track_status":"N","aging":"","note":""},{"code":"PK0014","cn_name":"US--速快(纯电)","en_name":"USSKCDCP","group_code":"SP","track_status":"Y","aging":"","note":""},{"code":"PK0015","cn_name":"US--速快(美国东部)","en_name":"USSKMGDBCP","group_code":"SP","track_status":"Y","aging":"","note":""},{"code":"PK0017","cn_name":"US--速快(美国中部)","en_name":"USSKMGZBCP","group_code":"SP","track_status":"N","aging":"","note":""},{"code":"PK0016","cn_name":"US--速快(美国西部)","en_name":"USSKMGXBCP","group_code":"SP","track_status":"Y","aging":"","note":""},{"code":"EST","cn_name":"俄速通","en_name":"EST","group_code":"MA","track_status":"Y","aging":"1-30","note":""},{"code":"NJGH","cn_name":"南京挂号","en_name":"NJGH","group_code":"MA","track_status":"Y","aging":"1-30","note":""},{"code":"XMPYCP","cn_name":"厦门平邮","en_name":"XMPYCP","group_code":"PY","track_status":"N","aging":"1-30","note":""},{"code":"PK0053","cn_name":"小包测试","en_name":"小包测试","group_code":"SP","track_status":"Y","aging":"1-3","note":""},{"code":"DHLXB","cn_name":"德国DHL专线","en_name":"DGDHLZX","group_code":"SP","track_status":"Y","aging":"1-15","note":""},{"code":"PK0095","cn_name":"德国专线","en_name":"DGZXC","group_code":"SP","track_status":"Y","aging":"3-7","note":""},{"code":"PK0013","cn_name":"日本FBA专线(平衡车类)","en_name":"RBFBAZXPHCLCP","group_code":"SP","track_status":"N","aging":"","note":"RBFBAZXPHCLCP"},{"code":"PK0011","cn_name":"日本FBA专线(深圳直航普货)","en_name":"RBFBAZXSZZHPHCP","group_code":"SP","track_status":"N","aging":"","note":""},{"code":"PK0012","cn_name":"日本FBA专线(深圳直航经济)","en_name":"RBFBAZXSZZHJJ","group_code":"SP","track_status":"N","aging":"","note":""},{"code":"PK0010","cn_name":"日本FBA专线(香港直航)","en_name":"RBFBAZXXGZH","group_code":"SP","track_status":"N","aging":"","note":""},{"code":"PK0047","cn_name":"欧洲FBA空运(单)","en_name":"OZFBAKYD","group_code":"SP","track_status":"N","aging":"","note":"欧洲FBA空运(单)"},{"code":"PK0051","cn_name":"欧洲FBA空运(卡板)","en_name":"OZFBAKYKB","group_code":"SP","track_status":"N","aging":"","note":""},{"code":"PK0044","cn_name":"欧洲FBA空运(大)","en_name":"OZFBAKYDCP","group_code":"SP","track_status":"Y","aging":"1-10","note":""},{"code":"PK0057","cn_name":"泰邮平邮测试","en_name":"TYPYCSC","group_code":"SP","track_status":"N","aging":"","note":""},{"code":"PK0050","cn_name":"测试API换号","en_name":"API测试","group_code":"PY","track_status":"N","aging":"","note":""},{"code":"PK0058","cn_name":"测试hh","en_name":"testhh","group_code":"PY","track_status":"N","aging":"","note":""},{"code":"PK0049","cn_name":"测试强制换号","en_name":"强制换号","group_code":"SP","track_status":"N","aging":"","note":""},{"code":"PK0007","cn_name":"测试海运(方)","en_name":"测试海运(方)","group_code":"MA","track_status":"Y","aging":" 3- 30","note":""},{"code":"HYOZFBA","cn_name":"海运-欧洲FBA","en_name":"HYOZFBA","group_code":"SP","track_status":"Y","aging":"","note":""},{"code":"PK0052","cn_name":"海运DEMO","en_name":"HHHYDEMO","group_code":"SP","track_status":"Y","aging":"2-3","note":""},{"code":"SZDHLAJ","cn_name":"深圳DHL-A价","en_name":"SZDHLAJ","group_code":"DH","track_status":"Y","aging":"","note":""},{"code":"SZDHLXHJ","cn_name":"深圳DHL小货价","en_name":"SZDHLXHJ","group_code":"DH","track_status":"Y","aging":"1-7","note":""},{"code":"SZEMS","cn_name":"深圳EMS","en_name":"SZEMS","group_code":"EM","track_status":"Y","aging":"1-7","note":""},{"code":"EUB-SZ","cn_name":"深圳eub","en_name":"SZEUB","group_code":"EM","track_status":"Y","aging":"1-15","note":""},{"code":"SZPYCP","cn_name":"深圳平邮","en_name":"SZPYCP","group_code":"PY","track_status":"Y","aging":"3-30","note":""},{"code":"PK0041","cn_name":"深圳平邮(俄罗斯)","en_name":"SZPYRUCP","group_code":"PY","track_status":"N","aging":"1-30","note":""},{"code":"PK0043","cn_name":"深圳平邮-带电","en_name":"SZPYDDCP","group_code":"PY","track_status":"N","aging":"1-30","note":""},{"code":"PK0001","cn_name":"深圳挂号","en_name":"SZGH","group_code":"MA","track_status":"Y","aging":"1-30","note":""},{"code":"PK0040","cn_name":"深圳挂号(俄罗斯)","en_name":"SZGHRUCP","group_code":"MA","track_status":"Y","aging":"1-30","note":"只到俄罗斯"},{"code":"PK0042","cn_name":"深圳挂号-带电","en_name":"SZGHDDCP","group_code":"MA","track_status":"Y","aging":"1-30","note":""},{"code":"XSXMPYCP","cn_name":"线上-厦门平邮","en_name":"XSXMPYCP","group_code":"PY","track_status":"Y","aging":"1-30","note":""},{"code":"XSZZPY","cn_name":"线上-郑州平邮","en_name":"XSZZPY","group_code":"MA","track_status":"Y","aging":"1-15","note":""},{"code":"XSZZGH","cn_name":"线上-郑州挂号","en_name":"XSZZGH","group_code":"MA","track_status":"Y","aging":"1-15","note":""},{"code":"PK0029","cn_name":"美国FBA海运散货","en_name":"MGFBAHYSHCPC","group_code":"SP","track_status":"N","aging":"","note":""},{"code":"PK0023","cn_name":"美国UPS专线(东部)","en_name":"MGUPSZXDBCP","group_code":"SP","track_status":"N","aging":"","note":""},{"code":"PK0025","cn_name":"美国UPS专线(中部)","en_name":"MGUPSZXZBCP","group_code":"SP","track_status":"N","aging":"","note":""},{"code":"PK0024","cn_name":"美国UPS专线(西部)","en_name":"MGUPSZXXBCP","group_code":"SP","track_status":"N","aging":"","note":""},{"code":"HEB","cn_name":"翰俄宝","en_name":"HEB","group_code":"MA","track_status":"Y","aging":"1-30","note":""},{"code":"PK0056","cn_name":"航空小包测试","en_name":"HHXBCS","group_code":"PY","track_status":"N","aging":"","note":""},{"code":"PK0030","cn_name":"英国FBA海运散货(不含税）","en_name":"YGFBAHYSHCP","group_code":"SP","track_status":"N","aging":"","note":""},{"code":"YGZXCP","cn_name":"英国专线","en_name":"YGZXCP","group_code":"SP","track_status":"Y","aging":"1-7","note":""},{"code":"HLPY","cn_name":"荷兰平邮","en_name":"HLPY","group_code":"PY","track_status":"Y","aging":"1-30","note":""},{"code":"HLGH","cn_name":"荷兰挂号","en_name":"HLGH","group_code":"MA","track_status":"Y","aging":"1-20","note":""},{"code":"ZZPY","cn_name":"郑州平邮","en_name":"ZZPY","group_code":"PY","track_status":"N","aging":"1-30","note":""},{"code":"ZZGH","cn_name":"郑州挂号","en_name":"ZZGH","group_code":"MA","track_status":"Y","aging":"1-30","note":""}],"time_cost(s)":"1.5290870666504"}</response>
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
|code |string  |运输方式代码   |
|cn_name |string  | 中文名称    |
|en_name |string   | 英文名称    |
|group_code |string   | 产品组   |
|track_status |string   | 是否可跟踪(TRACK)，N为不可跟踪、Y为可跟踪   |
|aging |string   | 派送时效   |
|note |string   | 备注   |
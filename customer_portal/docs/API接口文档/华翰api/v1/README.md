> 深圳市华翰鸿运国际物流技术有限公司
------------
# API接口文档V2.2

> http code请求示例

```html
POST /default/svc/web-service HTTP/1.1
Host: 127.0.0.1
Content-Type: application/xml
<?xml version="1.0" encoding="utf-8"?>
<SOAP-ENV:Envelope xmlns:SOAP-ENV="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ns1="http://www.example.org/Ec/">  
  <SOAP-ENV:Body> 
    <ns1:callService> 
      <paramsJson>{"codes":["GV436479377GB"]}</paramsJson>  
      <appToken>123</appToken>  
      <appKey>456</appKey>  
      <service>getCargoTrack</service> 
    </ns1:callService> 
  </SOAP-ENV:Body> 
</SOAP-ENV:Envelope>
```

> PHP code 1请求示例

```php
<?php
$curl = curl_init();

curl_setopt_array($curl, array(
  CURLOPT_URL => "http://127.0.0.1/default/svc/web-service",
  CURLOPT_RETURNTRANSFER => true,
  CURLOPT_ENCODING => "",
  CURLOPT_MAXREDIRS => 10,
  CURLOPT_TIMEOUT => 0,
  CURLOPT_FOLLOWLOCATION => true,
  CURLOPT_HTTP_VERSION => CURL_HTTP_VERSION_1_1,
  CURLOPT_CUSTOMREQUEST => "POST",
  CURLOPT_POSTFIELDS =>"<?xml version=\"1.0\" encoding=\"utf-8\"?>\r\n<SOAP-ENV:Envelope xmlns:SOAP-ENV=\"http://schemas.xmlsoap.org/soap/envelope/\" xmlns:ns1=\"http://www.example.org/Ec/\">  \r\n  <SOAP-ENV:Body> \r\n    <ns1:callService> \r\n      <paramsJson>{\"codes\":[\"GV436479377GB\"]}</paramsJson>  \r\n      <appToken>123</appToken>  \r\n      <appKey>456</appKey>  \r\n      <service>getCargoTrack</service> \r\n    </ns1:callService> \r\n  </SOAP-ENV:Body> \r\n</SOAP-ENV:Envelope>\r\n",
  CURLOPT_HTTPHEADER => array(
    "Content-Type: application/xml"
  ),
));

$response = curl_exec($curl);

curl_close($curl);
echo $response;
?>
```

> PHP code 2 请求示例

```php
<?php
$params = array(
            'codes' => array('GV436479377GB')
        );
        $req = array(
            'service'    => 'getCargoTrack',
            'paramsJson' => json_encode($params),
            'appToken'   => '123',
            'appKey'     => '456'
        );
        $options = array (
            "trace" => true,
            "connection_timeout" => 1000,
            "encoding" => "utf-8"
        );

        $wsdl = 'http://127.0.0.1/default/svc/wsdl';

        try {
            $client = new SoapClient ( $wsdl, $options );
            $result = $client->callService($req);
        } catch (Exception $e) {
            echo $e->getMessage();
        }
        print_r($result);
?>
```

> C# code  请求示例

```csharp
var client = new RestClient("http://127.0.0.1/default/svc/web-service");
    client.Timeout = -1;
    var request = new RestRequest(Method.POST);
    request.AddHeader("Content-Type", "application/xml");
    request.AddParameter("application/xml", "<?xml version=\"1.0\" encoding=\"utf-8\"?>\r\n<SOAP-ENV:Envelope xmlns:SOAP-ENV=\"http://schemas.xmlsoap.org/soap/envelope/\" xmlns:ns1=\"http://www.example.org/Ec/\">  \r\n  <SOAP-ENV:Body> \r\n    <ns1:callService> \r\n      <paramsJson>{\"codes\":[\"GV436479377GB\"]}</paramsJson>  \r\n      <appToken>123</appToken>  \r\n      <appKey>456</appKey>  \r\n      <service>getCargoTrack</service> \r\n    </ns1:callService> \r\n  </SOAP-ENV:Body> \r\n</SOAP-ENV:Envelope>\r\n",  ParameterType.RequestBody);
    IRestResponse response = client.Execute(request);
    Console.WriteLine(response.Content);
```
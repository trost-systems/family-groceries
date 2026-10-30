import 'package:http/http.dart' as http;

/// POSTs [body] as JSON and returns the status code.
Future<int> postJson(http.Client client, Uri url, String body) async =>
    (await client.post(
      url,
      headers: const {'content-type': 'application/json'},
      body: body,
    )).statusCode;

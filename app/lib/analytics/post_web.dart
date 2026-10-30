import 'dart:js_interop';

import 'package:http/http.dart' as http;
import 'package:web/web.dart' as web;

/// POSTs [body] as JSON with `keepalive`, so a batch sent as the tab is
/// hidden or closed still arrives; returns the status code. [client] is
/// unused: the browser's fetch is the one that can outlive the page.
Future<int> postJson(http.Client client, Uri url, String body) async {
  final headers = web.Headers()..append('content-type', 'application/json');
  final response = await web.window
      .fetch(
        url.toString().toJS,
        web.RequestInit(
          method: 'POST',
          headers: headers,
          body: body.toJS,
          keepalive: true,
        ),
      )
      .toDart;
  return response.status;
}

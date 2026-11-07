import 'dart:async';
import 'dart:convert';

import 'package:speech_to_text/speech_recognition_result.dart';
import 'package:speech_to_text/speech_to_text.dart';
import 'package:speech_to_text_platform_interface/speech_to_text_platform_interface.dart';

/// A recognizer that hears scripted sentences, for filming the app's real
/// dictation on Linux, which has no recognizer. It stands where the iOS and
/// Android plugins stand: speech_to_text, `DeviceDictation` and the rest of
/// the app run as on a phone and only the words come from [sentences], one
/// per listening session, then nothing.
///
/// Like a person talking, the words come one by one after [onset], as
/// partial results; the final result follows the plugin's own stop after
/// its pause.
class ScriptedSpeech(
  final List<String> sentences, {
  final Duration onset = const Duration(milliseconds: 700),
  final Duration perWord = const Duration(milliseconds: 340),
}) extends SpeechToTextPlatform {
  var _session = 0;
  var _heard = '';
  final _timers = <Timer>[];

  /// The plugin's status for a session that ended without words.
  static const _doneNoResult = 'doneNoResult';

  void _result(String words, ResultType type) => onTextRecognition?.call(
    jsonEncode(
      SpeechRecognitionResult([
        SpeechRecognitionWords(words, null, 0.92),
      ], type.value).toJson(),
    ),
  );

  void _clear() {
    for (final timer in _timers) {
      timer.cancel();
    }
    _timers.clear();
  }

  @override
  Future<bool> hasPermission() async => true;

  @override
  Future<bool> hasOnDeviceSupport({String? localeId}) async => true;

  @override
  Future<bool> initialize({
    debugLogging = false,
    List<SpeechConfigOption>? options,
  }) async => true;

  @override
  Future<bool> listen({
    String? localeId,
    partialResults = true,
    onDevice = false,
    int listenMode = 0,
    sampleRate = 0,
    SpeechListenOptions? options,
  }) async {
    _clear();
    _heard = '';
    final sentence = _session < sentences.length ? sentences[_session] : '';
    _session++;
    onStatus?.call(SpeechToText.listeningStatus);
    final words = sentence.split(' ').where((word) => word.isNotEmpty);
    var at = onset;
    final said = <String>[];
    for (final word in words) {
      said.add(word);
      final soFar = said.join(' ');
      _timers.add(
        Timer(at, () {
          _heard = soFar;
          _result(soFar, ResultType.partial);
        }),
      );
      at += perWord;
    }
    return true;
  }

  @override
  Future<void> stop() async {
    _clear();
    onStatus?.call(SpeechToText.notListeningStatus);
    if (_heard.isEmpty) {
      onStatus?.call(_doneNoResult);
      return;
    }
    _result(_heard, ResultType.finalResult);
    onStatus?.call(SpeechToText.doneStatus);
  }

  @override
  Future<void> cancel() async {
    _clear();
    onStatus?.call(SpeechToText.notListeningStatus);
    onStatus?.call(_doneNoResult);
  }

  @override
  Future<List<dynamic>> locales() async => const ['de_DE:Deutsch'];
}

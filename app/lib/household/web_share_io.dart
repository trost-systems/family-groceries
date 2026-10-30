import 'dart:io';

/// iOS, Android and macOS have a share sheet; elsewhere share_plus would
/// open a mailto: link, so the invite offers copying instead.
bool shareSheetAvailable() =>
    Platform.isIOS || Platform.isAndroid || Platform.isMacOS;

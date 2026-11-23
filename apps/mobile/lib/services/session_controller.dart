import 'package:flutter/foundation.dart';

import '../models/session.dart';
import 'api_client.dart';

enum SessionStatus { checking, signedOut, signedIn }

class SessionController extends ChangeNotifier {
  SessionController(this.api);

  final ApiClient api;

  SessionStatus _status = SessionStatus.checking;
  SessionUser? _user;
  String? _restoreError;

  SessionStatus get status => _status;
  SessionUser? get user => _user;
  String? get restoreError => _restoreError;

  Future<void> restore() async {
    _status = SessionStatus.checking;
    _restoreError = null;
    notifyListeners();
    try {
      final user = await api.restoreSession();
      if (user == null) {
        _status = SessionStatus.signedOut;
      } else {
        _user = user;
        _status = SessionStatus.signedIn;
      }
    } on ApiException catch (error) {
      _restoreError = error.isNetworkFailure
          ? 'Tidak dapat memeriksa sesi karena API tidak terjangkau.'
          : null;
      _status = SessionStatus.signedOut;
    }
    notifyListeners();
  }

  Future<void> signIn(String email, String password) async {
    final user = await api.login(email, password);
    _user = user;
    _restoreError = null;
    _status = SessionStatus.signedIn;
    notifyListeners();
  }

  Future<void> signOut() async {
    await api.logout();
    _user = null;
    _status = SessionStatus.signedOut;
    notifyListeners();
  }

  void handleUnauthorized() {
    _user = null;
    _status = SessionStatus.signedOut;
    notifyListeners();
  }
}

import 'package:mobile/core/network/api_client.dart';
import 'package:mobile/core/network/json_helpers.dart';
import 'package:mobile/features/auth/domain/auth_repository.dart';
import 'package:mobile/features/auth/domain/current_user.dart';

/// [CurrentUserRepository] backed by the platform API. Takes the authenticated
/// client, which attaches the access token and refreshes it on a 401.
class CurrentUserApiRepository implements CurrentUserRepository {
  CurrentUserApiRepository(this._api);

  final ApiClient _api;

  @override
  Future<CurrentUser> fetchCurrentUser() async {
    final data = await _api.get('/api/auth/me');
    return CurrentUser.fromJson(asJsonObject(data));
  }
}

class SessionScope {
  const SessionScope({
    required this.id,
    required this.code,
    required this.name,
    required this.path,
  });

  final String id;
  final String code;
  final String name;
  final String path;

  factory SessionScope.fromJson(Map<String, dynamic> json) {
    return SessionScope(
      id: json['id']?.toString() ?? '',
      code: json['code']?.toString() ?? '',
      name: json['name']?.toString() ?? '',
      path: json['path']?.toString() ?? '',
    );
  }
}

class SessionRole {
  const SessionRole({required this.code, required this.name});

  final String code;
  final String name;

  factory SessionRole.fromJson(Map<String, dynamic> json) {
    return SessionRole(
      code: json['code']?.toString() ?? '',
      name: json['name']?.toString() ?? '',
    );
  }
}

class SessionUser {
  const SessionUser({
    required this.id,
    required this.email,
    required this.fullName,
    required this.scope,
    required this.roles,
    required this.permissions,
  });

  final String id;
  final String email;
  final String fullName;
  final SessionScope scope;
  final List<SessionRole> roles;
  final Set<String> permissions;

  String get roleSummary => roles.map((role) => role.name).join(', ');

  bool can(String permission) => permissions.contains(permission);

  bool get canWriteInspections => can('inspections:write');

  factory SessionUser.fromJson(Map<String, dynamic> json) {
    final rawRoles = json['roles'];
    final rawPermissions = json['permissions'];
    return SessionUser(
      id: json['id']?.toString() ?? '',
      email: json['email']?.toString() ?? '',
      fullName: json['full_name']?.toString() ?? '',
      scope: SessionScope.fromJson(
        json['scope'] is Map<String, dynamic>
            ? json['scope'] as Map<String, dynamic>
            : const {},
      ),
      roles: rawRoles is List
          ? rawRoles
              .whereType<Map>()
              .map((entry) =>
                  SessionRole.fromJson(entry.cast<String, dynamic>()))
              .toList(growable: false)
          : const [],
      permissions: rawPermissions is List
          ? rawPermissions.map((entry) => entry.toString()).toSet()
          : const {},
    );
  }
}

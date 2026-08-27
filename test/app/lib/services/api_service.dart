import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

import '../config.dart';

/// Erro simples para exibir a mensagem que o backend PHP devolveu.
class ApiException implements Exception {
  final String message;
  ApiException(this.message);

  @override
  String toString() => message;
}

/// Fala com a API PHP e guarda o token de login no dispositivo (shared_preferences).
class ApiService {
  static String? _token;

  static Future<void> _loadToken() async {
    if (_token != null) return;
    final prefs = await SharedPreferences.getInstance();
    _token = prefs.getString('auth_token');
  }

  static Future<void> _saveToken(String token) async {
    _token = token;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('auth_token', token);
  }

  static Future<void> clearToken() async {
    _token = null;
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('auth_token');
  }

  static Future<bool> hasToken() async {
    await _loadToken();
    return _token != null;
  }

  static Future<Map<String, String>> _headers() async {
    await _loadToken();
    return {
      'Content-Type': 'application/json',
      if (_token != null) 'Authorization': 'Bearer $_token',
    };
  }

  static Map<String, dynamic> _decodeObject(http.Response response) {
    final decoded = response.body.isNotEmpty ? jsonDecode(response.body) : {};
    if (response.statusCode >= 400) {
      throw ApiException(decoded['error'] ?? 'Erro ao falar com o servidor.');
    }
    return decoded as Map<String, dynamic>;
  }

  static List<dynamic> _decodeList(http.Response response) {
    final decoded = response.body.isNotEmpty ? jsonDecode(response.body) : [];
    if (response.statusCode >= 400) {
      final map = decoded as Map<String, dynamic>;
      throw ApiException(map['error'] ?? 'Erro ao falar com o servidor.');
    }
    return decoded as List<dynamic>;
  }

  static Future<void> register(String name, String email, String password) async {
    final response = await http.post(
      Uri.parse('$apiBaseUrl/register'),
      headers: await _headers(),
      body: jsonEncode({'name': name, 'email': email, 'password': password}),
    );
    final data = _decodeObject(response);
    await _saveToken(data['token']);
  }

  static Future<void> login(String email, String password) async {
    final response = await http.post(
      Uri.parse('$apiBaseUrl/login'),
      headers: await _headers(),
      body: jsonEncode({'email': email, 'password': password}),
    );
    final data = _decodeObject(response);
    await _saveToken(data['token']);
  }

  static Future<void> logout() async {
    try {
      await http.post(Uri.parse('$apiBaseUrl/logout'), headers: await _headers());
    } finally {
      await clearToken();
    }
  }

  static Future<List<dynamic>> getDevices() async {
    final response = await http.get(Uri.parse('$apiBaseUrl/devices'), headers: await _headers());
    return _decodeList(response);
  }

  static Future<Map<String, dynamic>> createDevice(String name) async {
    final response = await http.post(
      Uri.parse('$apiBaseUrl/devices'),
      headers: await _headers(),
      body: jsonEncode({'name': name}),
    );
    return _decodeObject(response);
  }

  static Future<void> deleteDevice(int id) async {
    final response =
        await http.delete(Uri.parse('$apiBaseUrl/devices/$id'), headers: await _headers());
    _decodeObject(response);
  }

  static Future<void> simulateReading(int deviceId) async {
    final response = await http.post(
      Uri.parse('$apiBaseUrl/devices/$deviceId/simulate'),
      headers: await _headers(),
    );
    _decodeObject(response);
  }

  static Future<List<dynamic>> getHistory(int deviceId) async {
    final response = await http.get(
      Uri.parse('$apiBaseUrl/devices/$deviceId/measurements'),
      headers: await _headers(),
    );
    return _decodeList(response);
  }

  static Future<Map<String, dynamic>> getSettings() async {
    final response = await http.get(Uri.parse('$apiBaseUrl/settings'), headers: await _headers());
    return _decodeObject(response);
  }

  static Future<void> updateSettings(Map<String, dynamic> values) async {
    final response = await http.put(
      Uri.parse('$apiBaseUrl/settings'),
      headers: await _headers(),
      body: jsonEncode(values),
    );
    _decodeObject(response);
  }

  static Future<List<dynamic>> getAlerts() async {
    final response = await http.get(Uri.parse('$apiBaseUrl/alerts'), headers: await _headers());
    return _decodeList(response);
  }

  static Future<void> resolveAlert(int id) async {
    final response = await http.patch(
      Uri.parse('$apiBaseUrl/alerts/$id/resolve'),
      headers: await _headers(),
    );
    _decodeObject(response);
  }
}

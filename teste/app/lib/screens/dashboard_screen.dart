import 'package:flutter/material.dart';

import '../models/device.dart';
import '../services/api_service.dart';
import 'add_device_screen.dart';
import 'alerts_screen.dart';
import 'device_detail_screen.dart';
import 'login_screen.dart';
import 'settings_screen.dart';

class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key});

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  late Future<List<Device>> _devicesFuture;

  @override
  void initState() {
    super.initState();
    _devicesFuture = _load();
  }

  Future<List<Device>> _load() async {
    final raw = await ApiService.getDevices();
    return raw.map((json) => Device.fromJson(json)).toList();
  }

  Future<void> _refresh() async {
    setState(() => _devicesFuture = _load());
    await _devicesFuture;
  }

  Future<void> _logout() async {
    await ApiService.logout();
    if (!mounted) return;
    Navigator.of(context).pushAndRemoveUntil(
      MaterialPageRoute(builder: (_) => const LoginScreen()),
      (route) => false,
    );
  }

  Color _statusColor(String status) {
    switch (status) {
      case 'online':
        return Colors.green;
      case 'offline':
        return Colors.red;
      default:
        return Colors.grey;
    }
  }

  String _statusLabel(String status) {
    switch (status) {
      case 'online':
        return 'Online';
      case 'offline':
        return 'Offline';
      default:
        return 'Sem dados';
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Meus dispositivos'),
        actions: [
          IconButton(
            icon: const Icon(Icons.notifications_outlined),
            onPressed: () => Navigator.of(context)
                .push(MaterialPageRoute(builder: (_) => const AlertsScreen())),
          ),
          IconButton(
            icon: const Icon(Icons.settings_outlined),
            onPressed: () => Navigator.of(context)
                .push(MaterialPageRoute(builder: (_) => const SettingsScreen())),
          ),
          IconButton(icon: const Icon(Icons.logout), onPressed: _logout),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: _refresh,
        child: FutureBuilder<List<Device>>(
          future: _devicesFuture,
          builder: (context, snapshot) {
            if (snapshot.connectionState == ConnectionState.waiting) {
              return const Center(child: CircularProgressIndicator());
            }
            if (snapshot.hasError) {
              return ListView(
                children: [
                  const SizedBox(height: 80),
                  Center(child: Text('Erro: ${snapshot.error}')),
                ],
              );
            }
            final devices = snapshot.data ?? [];
            if (devices.isEmpty) {
              return ListView(
                children: const [
                  SizedBox(height: 80),
                  Center(child: Text('Nenhum dispositivo cadastrado ainda.\nToque em "+" para criar um.', textAlign: TextAlign.center)),
                ],
              );
            }
            return ListView.builder(
              padding: const EdgeInsets.all(12),
              itemCount: devices.length,
              itemBuilder: (context, index) {
                final device = devices[index];
                return Card(
                  child: ListTile(
                    leading: CircleAvatar(
                      backgroundColor: _statusColor(device.status),
                      child: const Icon(Icons.sensors, color: Colors.white),
                    ),
                    title: Text(device.name),
                    subtitle: Text(
                      device.temperature != null
                          ? '${device.temperature}°C · ${device.humidity}% · ${_statusLabel(device.status)}'
                          : _statusLabel(device.status),
                    ),
                    trailing: const Icon(Icons.chevron_right),
                    onTap: () => Navigator.of(context)
                        .push(MaterialPageRoute(
                          builder: (_) => DeviceDetailScreen(device: device),
                        ))
                        .then((_) => _refresh()),
                  ),
                );
              },
            );
          },
        ),
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: () => Navigator.of(context)
            .push(MaterialPageRoute(builder: (_) => const AddDeviceScreen()))
            .then((_) => _refresh()),
        child: const Icon(Icons.add),
      ),
    );
  }
}

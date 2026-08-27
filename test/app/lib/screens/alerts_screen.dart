import 'package:flutter/material.dart';

import '../models/alert_item.dart';
import '../services/api_service.dart';

class AlertsScreen extends StatefulWidget {
  const AlertsScreen({super.key});

  @override
  State<AlertsScreen> createState() => _AlertsScreenState();
}

class _AlertsScreenState extends State<AlertsScreen> {
  late Future<List<AlertItem>> _alertsFuture;

  @override
  void initState() {
    super.initState();
    _alertsFuture = _load();
  }

  Future<List<AlertItem>> _load() async {
    final raw = await ApiService.getAlerts();
    return raw.map((json) => AlertItem.fromJson(json)).toList();
  }

  Future<void> _refresh() async {
    setState(() => _alertsFuture = _load());
    await _alertsFuture;
  }

  Future<void> _resolve(int id) async {
    await ApiService.resolveAlert(id);
    await _refresh();
  }

  String _label(AlertItem alert) {
    final variable = alert.variable == 'temperature' ? 'Temperatura' : 'Umidade';
    final direction = alert.direction == 'acima' ? 'acima de' : 'abaixo de';
    return '$variable ${alert.value} ($direction ${alert.limitValue})';
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Alertas')),
      body: RefreshIndicator(
        onRefresh: _refresh,
        child: FutureBuilder<List<AlertItem>>(
          future: _alertsFuture,
          builder: (context, snapshot) {
            if (snapshot.connectionState == ConnectionState.waiting) {
              return const Center(child: CircularProgressIndicator());
            }
            final alerts = snapshot.data ?? [];
            if (alerts.isEmpty) {
              return ListView(
                children: const [
                  SizedBox(height: 80),
                  Center(child: Text('Nenhum alerta registrado.')),
                ],
              );
            }
            return ListView.builder(
              padding: const EdgeInsets.all(12),
              itemCount: alerts.length,
              itemBuilder: (context, index) {
                final alert = alerts[index];
                final active = alert.status == 'active';
                return Card(
                  child: ListTile(
                    leading: Icon(Icons.warning_amber, color: active ? Colors.orange : Colors.grey),
                    title: Text(alert.deviceName),
                    subtitle: Text(_label(alert)),
                    trailing: active
                        ? TextButton(
                            onPressed: () => _resolve(alert.id),
                            child: const Text('Resolver'),
                          )
                        : const Text('Resolvido', style: TextStyle(color: Colors.grey)),
                  ),
                );
              },
            );
          },
        ),
      ),
    );
  }
}

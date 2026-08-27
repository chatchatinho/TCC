import 'package:flutter/material.dart';

import '../models/device.dart';
import '../models/measurement.dart';
import '../services/api_service.dart';

class DeviceDetailScreen extends StatefulWidget {
  final Device device;
  const DeviceDetailScreen({super.key, required this.device});

  @override
  State<DeviceDetailScreen> createState() => _DeviceDetailScreenState();
}

class _DeviceDetailScreenState extends State<DeviceDetailScreen> {
  late Future<List<Measurement>> _historyFuture;
  bool _simulating = false;

  @override
  void initState() {
    super.initState();
    _historyFuture = _load();
  }

  Future<List<Measurement>> _load() async {
    final raw = await ApiService.getHistory(widget.device.id);
    return raw.map((json) => Measurement.fromJson(json)).toList();
  }

  Future<void> _refresh() async {
    setState(() => _historyFuture = _load());
    await _historyFuture;
  }

  Future<void> _simulate() async {
    setState(() => _simulating = true);
    try {
      await ApiService.simulateReading(widget.device.id);
      await _refresh();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.toString())));
      }
    } finally {
      if (mounted) setState(() => _simulating = false);
    }
  }

  Future<void> _delete() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Remover dispositivo?'),
        content: const Text('O histórico e os alertas desse dispositivo também serão apagados.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Cancelar')),
          FilledButton(onPressed: () => Navigator.pop(context, true), child: const Text('Remover')),
        ],
      ),
    );
    if (confirmed != true) return;
    await ApiService.deleteDevice(widget.device.id);
    if (mounted) Navigator.of(context).pop();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(widget.device.name),
        actions: [
          IconButton(icon: const Icon(Icons.delete_outline), onPressed: _delete),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: _refresh,
        child: FutureBuilder<List<Measurement>>(
          future: _historyFuture,
          builder: (context, snapshot) {
            if (snapshot.connectionState == ConnectionState.waiting) {
              return const Center(child: CircularProgressIndicator());
            }
            final measurements = snapshot.data ?? [];
            if (measurements.isEmpty) {
              return ListView(
                children: const [
                  SizedBox(height: 80),
                  Center(child: Text('Nenhuma leitura ainda.\nUse "Simular leitura" para testar.', textAlign: TextAlign.center)),
                ],
              );
            }
            return ListView.separated(
              padding: const EdgeInsets.fromLTRB(12, 12, 12, 80),
              itemCount: measurements.length,
              separatorBuilder: (_, __) => const Divider(height: 1),
              itemBuilder: (context, index) {
                final m = measurements[index];
                return ListTile(
                  leading: const Icon(Icons.thermostat_outlined),
                  title: Text('${m.temperature}°C · ${m.humidity}%'),
                  subtitle: Text(m.measuredAt),
                );
              },
            );
          },
        ),
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _simulating ? null : _simulate,
        icon: _simulating
            ? const SizedBox(
                height: 16,
                width: 16,
                child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
              )
            : const Icon(Icons.bolt),
        label: const Text('Simular leitura'),
      ),
    );
  }
}

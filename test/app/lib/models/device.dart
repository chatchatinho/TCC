class Device {
  final int id;
  final String name;
  final String status;
  final double? temperature;
  final double? humidity;
  final String? measuredAt;

  Device({
    required this.id,
    required this.name,
    required this.status,
    this.temperature,
    this.humidity,
    this.measuredAt,
  });

  factory Device.fromJson(Map<String, dynamic> json) => Device(
        id: json['id'],
        name: json['name'],
        status: json['status'] ?? 'sem_dados',
        temperature:
            json['temperature'] != null ? double.parse(json['temperature'].toString()) : null,
        humidity: json['humidity'] != null ? double.parse(json['humidity'].toString()) : null,
        measuredAt: json['measured_at'],
      );
}

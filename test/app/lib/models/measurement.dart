class Measurement {
  final int id;
  final double temperature;
  final double humidity;
  final String measuredAt;

  Measurement({
    required this.id,
    required this.temperature,
    required this.humidity,
    required this.measuredAt,
  });

  factory Measurement.fromJson(Map<String, dynamic> json) => Measurement(
        id: json['id'],
        temperature: double.parse(json['temperature'].toString()),
        humidity: double.parse(json['humidity'].toString()),
        measuredAt: json['measured_at'],
      );
}

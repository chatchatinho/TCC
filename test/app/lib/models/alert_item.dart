class AlertItem {
  final int id;
  final String deviceName;
  final String variable;
  final String direction;
  final double value;
  final double limitValue;
  final String status;
  final String createdAt;

  AlertItem({
    required this.id,
    required this.deviceName,
    required this.variable,
    required this.direction,
    required this.value,
    required this.limitValue,
    required this.status,
    required this.createdAt,
  });

  factory AlertItem.fromJson(Map<String, dynamic> json) => AlertItem(
        id: json['id'],
        deviceName: json['device_name'],
        variable: json['variable'],
        direction: json['direction'],
        value: double.parse(json['value'].toString()),
        limitValue: double.parse(json['limit_value'].toString()),
        status: json['status'],
        createdAt: json['created_at'],
      );
}

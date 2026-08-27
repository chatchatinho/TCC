-- Banco de dados do ThermoSense Lite (versão simplificada do TCC original).
-- Como rodar: mysql -u root -p < schema.sql

CREATE DATABASE IF NOT EXISTS tcc_teste CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE tcc_teste;

-- Usuários que acessam o app.
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(120) NOT NULL,
    email VARCHAR(160) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- Tokens de sessão (login). Só o hash fica salvo, nunca o token em texto puro.
CREATE TABLE auth_tokens (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    token_hash CHAR(64) NOT NULL UNIQUE,
    expires_at DATETIME NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Dispositivos ESP32 cadastrados por cada usuário.
CREATE TABLE devices (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    name VARCHAR(80) NOT NULL,
    device_token_hash CHAR(64) NOT NULL UNIQUE,
    last_seen_at DATETIME NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Leituras de temperatura/umidade enviadas pelos dispositivos.
CREATE TABLE measurements (
    id INT AUTO_INCREMENT PRIMARY KEY,
    device_id INT NOT NULL,
    temperature DECIMAL(5,2) NOT NULL,
    humidity DECIMAL(5,2) NOT NULL,
    measured_at DATETIME NOT NULL,
    INDEX idx_device_measured (device_id, measured_at DESC),
    FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Faixa ideal de temperatura/umidade de cada usuário (usada para gerar alertas).
CREATE TABLE settings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL UNIQUE,
    temp_min DECIMAL(5,2) NOT NULL DEFAULT 15,
    temp_max DECIMAL(5,2) NOT NULL DEFAULT 30,
    humidity_min DECIMAL(5,2) NOT NULL DEFAULT 30,
    humidity_max DECIMAL(5,2) NOT NULL DEFAULT 70,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Alertas: um registro por "evento" fora da faixa, não um por leitura
-- (evita notificação repetida enquanto o valor continuar fora do normal).
CREATE TABLE alerts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    device_id INT NOT NULL,
    variable ENUM('temperature', 'humidity') NOT NULL,
    direction ENUM('acima', 'abaixo') NOT NULL,
    value DECIMAL(5,2) NOT NULL,
    limit_value DECIMAL(5,2) NOT NULL,
    status ENUM('active', 'resolved') NOT NULL DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    resolved_at DATETIME NULL,
    INDEX idx_user_status (user_id, status),
    INDEX idx_device_variable_status (device_id, variable, status),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE
) ENGINE=InnoDB;

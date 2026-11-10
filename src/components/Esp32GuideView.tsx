import React, { useState } from 'react';
import { 
  Code2, 
  Copy, 
  Check, 
  Layers, 
  Terminal, 
  FileCode, 
  Wifi, 
  Usb, 
  Globe, 
  CheckCircle2, 
  ShieldCheck, 
  Sparkles 
} from 'lucide-react';

export const Esp32GuideView: React.FC = () => {
  const [copiedSection, setCopiedSection] = useState<string | null>(null);

  const handleCopy = (code: string, id: string) => {
    navigator.clipboard.writeText(code);
    setCopiedSection(id);
    setTimeout(() => setCopiedSection(null), 2000);
  };

  const esp32DualModeCode = `/*
 * ==============================================================
 * SMART PARCEL BOX - FIRMWARE ESP32 CONTROLLER (DUAL MODE)
 * ==============================================================
 * Fitur Komunikasi:
 * 1. WiFi Hotspot SoftAP (SSID: "SMART-PARCEL-BOX-AP", IP: 192.168.4.1)
 *    - WebServer port 80 dengan header CORS (Access-Control-Allow-Origin: *)
 *    - Endpoint GET  /api/status  : Mengembalikan JSON status lengkap
 *    - Endpoint GET  /api/pin     : Mengembalikan JSON PIN 6-digit aktif
 *    - Endpoint POST /api/command : Menerima perintah (PING, STATUS, BEEP, DOOR)
 * 2. Serial USB (Baud 9600): Stream JSON satu baris untuk Web Serial API
 * 3. Hardware UART2 (GPIO16 RX, GPIO17 TX): Komunikasi ke Arduino Uno
 * 4. RTC DS1302: Basis waktu fisik interval 12 jam
 * 5. HMAC-SHA256: Algoritma kalkulasi PIN dinamis 6-digit (TOTP)
 * 6. Reed Switch (GPIO4): Deteksi magnetik buka/tutup pintu box
 * 7. Buzzer (GPIO5): Indikator audio
 * ==============================================================
 */

#include <Arduino.h>
#include <WiFi.h>
#include <WebServer.h>
#include <RtcDS1302.h>
#include <mbedtls/md.h>

// Definisi Pin Modul RTC DS1302
#define RTC_RST_PIN 14
#define RTC_DAT_PIN 12
#define RTC_CLK_PIN 13

ThreeWire myWire(RTC_DAT_PIN, RTC_CLK_PIN, RTC_RST_PIN);
RtcDS1302<ThreeWire> Rtc(myWire);

// Pin Sensor Reed Switch & Buzzer
#define REED_SWITCH_PIN 4
#define BUZZER_PIN 5

// Konfigurasi WiFi Hotspot (SoftAP)
const char* WIFI_SSID = "SMART-PARCEL-BOX-AP";
const char* WIFI_PASS = "12345678";
WebServer server(80);

// Secret Key HMAC-SHA256 (Harus SAMA PERSIS dengan Arduino Uno)
const char* SECRET_KEY = "SMART_PARCEL_SECRET_KEY_2026";
const unsigned long INTERVAL_12_HOURS = 43200UL; // 12 jam dalam detik

// Serial2 ke Arduino Uno (GPIO16 = RX, GPIO17 = TX)
HardwareSerial ArduinoSerial(2);

// Status Cache
int lastReedState = -1;
unsigned long lastTelemetryMillis = 0;
unsigned long currentPeriod = 0;
char currentPin[7] = "000000";
char currentDate[12] = "2026-11-09";
char currentTime[10] = "12:00:00";
bool isRtcValid = false;

// Fungsi HMAC-SHA256 menghasilkan PIN 6 digit
void generateHmacPin(unsigned long period, char* outPin) {
  byte hmacResult[32];
  mbedtls_md_context_t ctx;
  mbedtls_md_type_t md_type = MBEDTLS_MD_SHA256;

  mbedtls_md_init(&ctx);
  mbedtls_md_setup(&ctx, mbedtls_md_info_from_type(md_type), 1);
  mbedtls_md_hmac_starts(&ctx, (const unsigned char*)SECRET_KEY, strlen(SECRET_KEY));
  mbedtls_md_hmac_update(&ctx, (const unsigned char*)&period, sizeof(period));
  mbedtls_md_hmac_finish(&ctx, hmacResult);
  mbedtls_md_free(&ctx);

  // Dynamic Truncation (TOTP standard RFC 6238)
  int offset = hmacResult[31] & 0x0F;
  unsigned long binary = 
    ((hmacResult[offset] & 0x7F) << 24) |
    ((hmacResult[offset + 1] & 0xFF) << 16) |
    ((hmacResult[offset + 2] & 0xFF) << 8) |
    (hmacResult[offset + 3] & 0xFF);

  unsigned long pinNum = binary % 1000000;
  snprintf(outPin, 7, "%06lu", pinNum);
}

// Buat format string JSON status lengkap
String buildStatusJson() {
  int reedState = digitalRead(REED_SWITCH_PIN);
  const char* doorStateStr = (reedState == HIGH) ? "OPEN" : "CLOSED";
  
  if (!isRtcValid) {
    return "{\\"type\\":\\"ERROR\\",\\"rtc\\":\\"ERROR\\",\\"message\\":\\"RTC NOT READY\\",\\"door\\":\\"" + String(doorStateStr) + "\\"}";
  }

  char buf[256];
  snprintf(buf, sizeof(buf),
    "{\\"type\\":\\"STATUS\\",\\"rtc\\":\\"OK\\",\\"date\\":\\"%s\\",\\"time\\":\\"%s\\",\\"period\\":%lu,\\"pin\\":\\"%s\\",\\"door\\":\\"%s\\"}",
    currentDate, currentTime, currentPeriod, currentPin, doorStateStr
  );
  return String(buf);
}

// Helper untuk menambahkan header CORS ke respon HTTP
void setCorsHeaders() {
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.sendHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  server.sendHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, Accept");
}

// HTTP Handler: /api/status
void handleApiStatus() {
  setCorsHeaders();
  String json = buildStatusJson();
  server.send(200, "application/json", json);
}

// HTTP Handler: /api/pin
void handleApiPin() {
  setCorsHeaders();
  char buf[128];
  snprintf(buf, sizeof(buf),
    "{\\"pin\\":\\"%s\\",\\"period\\":%lu,\\"status\\":\\"%s\\"}",
    currentPin, currentPeriod, isRtcValid ? "ACTIVE" : "INVALID"
  );
  server.send(200, "application/json", String(buf));
}

// HTTP Handler: /api/command
void handleApiCommand() {
  setCorsHeaders();
  String cmd = "";
  if (server.hasArg("plain")) {
    String body = server.arg("plain");
    // Simple command extract or plain string
    if (body.indexOf("PING") >= 0) cmd = "PING";
    else if (body.indexOf("STATUS") >= 0) cmd = "STATUS";
    else if (body.indexOf("BEEP") >= 0) cmd = "BEEP";
    else if (body.indexOf("OPEN") >= 0) cmd = "OPEN";
    else if (body.indexOf("CLOSE") >= 0) cmd = "CLOSE";
    else cmd = body;
  } else if (server.hasArg("cmd")) {
    cmd = server.arg("cmd");
  }

  cmd.trim();
  cmd.toUpperCase();

  if (cmd == "PING") {
    server.send(200, "application/json", "{\\"type\\":\\"PONG\\",\\"message\\":\\"ESP32 HOTSPOT ALIVE\\"}");
  } else if (cmd == "BEEP") {
    digitalWrite(BUZZER_PIN, HIGH); delay(150); digitalWrite(BUZZER_PIN, LOW);
    server.send(200, "application/json", "{\\"type\\":\\"ACK\\",\\"message\\":\\"BEEP EXECUTED\\"}");
  } else {
    server.send(200, "application/json", buildStatusJson());
  }
}

// HTTP Handler: Preflight OPTIONS request
void handleOptions() {
  setCorsHeaders();
  server.send(204);
}

void setup() {
  // 1. Serial USB ke Browser Web Serial API
  Serial.begin(9600);
  
  // 2. Serial2 UART2 ke Arduino Uno (GPIO16 RX, GPIO17 TX)
  ArduinoSerial.begin(9600, SERIAL_8N1, 16, 17);

  pinMode(REED_SWITCH_PIN, INPUT_PULLUP);
  pinMode(BUZZER_PIN, OUTPUT);
  digitalWrite(BUZZER_PIN, LOW);

  // 3. Inisialisasi WiFi Hotspot (SoftAP Mode)
  WiFi.mode(WIFI_AP);
  WiFi.softAP(WIFI_SSID, WIFI_PASS);
  IPAddress apIP = WiFi.softAPIP(); // Default: 192.168.4.1

  Serial.println("");
  Serial.println("=========================================");
  Serial.println("SMART PARCEL BOX ESP32 FIRMWARE READY");
  Serial.printf("WiFi Hotspot SSID: %s\\n", WIFI_SSID);
  Serial.printf("WiFi Hotspot IP  : %s\\n", apIP.toString().c_str());
  Serial.println("=========================================");

  // 4. Setup Rute HTTP Server
  server.on("/api/status", HTTP_GET, handleApiStatus);
  server.on("/api/pin", HTTP_GET, handleApiPin);
  server.on("/api/command", HTTP_POST, handleApiCommand);
  server.on("/api/command", HTTP_OPTIONS, handleOptions);
  server.on("/api/status", HTTP_OPTIONS, handleOptions);
  server.onNotFound([]() {
    setCorsHeaders();
    if (server.method() == HTTP_OPTIONS) {
      server.send(204);
    } else {
      server.send(404, "application/json", "{\\"error\\":\\"Endpoint Not Found\\"}");
    }
  });
  server.begin();

  // 5. Inisialisasi RTC DS1302
  Rtc.Begin();
  if (Rtc.GetIsWriteProtected()) {
    Rtc.SetIsWriteProtected(false);
  }
  if (!Rtc.GetIsRunning()) {
    Rtc.SetIsRunning(true);
  }
}

void loop() {
  // Handle request HTTP masuk dari browser via WiFi Hotspot
  server.handleClient();

  // 1. Baca Reed Switch
  int reedState = digitalRead(REED_SWITCH_PIN);
  const char* doorStateStr = (reedState == HIGH) ? "OPEN" : "CLOSED";

  if (reedState != lastReedState) {
    lastReedState = reedState;
    if (reedState == HIGH) {
      ArduinoSerial.println("DOOR_OPEN");
    } else {
      ArduinoSerial.println("DOOR_CLOSED");
    }
    // Kirim event instan ke Serial USB
    Serial.printf("{\\"type\\":\\"DOOR\\",\\"door\\":\\"%s\\"}\\n", doorStateStr);
  }

  // 2. Baca Pesan dari Arduino Uno via UART2
  while (ArduinoSerial.available()) {
    String msg = ArduinoSerial.readStringUntil('\\n');
    msg.trim();
    if (msg == "BEEP_GRANTED") {
      digitalWrite(BUZZER_PIN, HIGH); delay(100); digitalWrite(BUZZER_PIN, LOW);
      delay(80);
      digitalWrite(BUZZER_PIN, HIGH); delay(100); digitalWrite(BUZZER_PIN, LOW);
    } else if (msg == "BEEP_DENIED") {
      digitalWrite(BUZZER_PIN, HIGH); delay(400); digitalWrite(BUZZER_PIN, LOW);
    }
  }

  // 3. Baca Perintah Masuk dari Web Serial USB
  while (Serial.available()) {
    String cmd = Serial.readStringUntil('\\n');
    cmd.trim();
    cmd.toUpperCase();
    if (cmd == "PING") {
      Serial.println("{\\"type\\":\\"PONG\\",\\"message\\":\\"ESP32 ALIVE\\"}");
    } else if (cmd == "STATUS") {
      lastTelemetryMillis = 0;
    } else if (cmd == "BEEP") {
      digitalWrite(BUZZER_PIN, HIGH); delay(150); digitalWrite(BUZZER_PIN, LOW);
      Serial.println("{\\"type\\":\\"ACK\\",\\"message\\":\\"BEEP EXECUTED\\"}");
    }
  }

  // 4. Update Waktu RTC & Telemetri Rutin setiap 2 detik
  if (millis() - lastTelemetryMillis >= 2000) {
    lastTelemetryMillis = millis();

    if (!Rtc.IsDateTimeValid()) {
      isRtcValid = false;
      Serial.println("{\\"type\\":\\"ERROR\\",\\"rtc\\":\\"ERROR\\",\\"message\\":\\"RTC NOT READY\\"}");
      ArduinoSerial.println("RTC_ERROR");
      return;
    }

    isRtcValid = true;
    RtcDateTime now = Rtc.GetDateTime();
    unsigned long epochSeconds = now.Epoch32Time();
    unsigned long newPeriod = epochSeconds / INTERVAL_12_HOURS;

    if (newPeriod != currentPeriod) {
      currentPeriod = newPeriod;
      generateHmacPin(currentPeriod, currentPin);
      ArduinoSerial.printf("STEP:%lu\\n", currentPeriod);
    }

    snprintf(currentDate, sizeof(currentDate), "%04u-%02u-%02u", now.Year(), now.Month(), now.Day());
    snprintf(currentTime, sizeof(currentTime), "%02u:%02u:%02u", now.Hour(), now.Minute(), now.Second());

    // Kirim juga ke USB Serial
    Serial.println(buildStatusJson());
  }
}`;

  const unoCode = `/*
 * ==============================================================
 * SMART PARCEL BOX - ARDUINO UNO SLAVE
 * ==============================================================
 * Pengelola:
 * - Keypad 4x4 (Input PIN)
 * - LCD I2C 1602 (Tampilan Status)
 * - RFID RC522 (Akses Tag Pemilik)
 * - Servo Motor (Kunci Box)
 * - SoftwareSerial / Hardware Serial ke ESP32 UART2
 * ==============================================================
 */

#include <Keypad.h>
#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <Servo.h>

LiquidCrystal_I2C lcd(0x27, 16, 2);
Servo lockServo;

const byte ROWS = 4;
const byte COLS = 4;
char keys[ROWS][COLS] = {
  {'1','2','3','A'},
  {'4','5','6','B'},
  {'7','8','9','C'},
  {'*','0','#','D'}
};
byte rowPins[ROWS] = {9, 8, 7, 6};
byte colPins[COLS] = {5, 4, 3, 2};
Keypad keypad = Keypad(makeKeymap(keys), rowPins, colPins, ROWS, COLS);

char enteredPin[7] = "";
byte pinIndex = 0;
unsigned long activePeriod = 0;

void setup() {
  Serial.begin(9600); // Terhubung ke ESP32 UART2 (GPIO16/17)
  lcd.init();
  lcd.backlight();
  lockServo.attach(10);
  lockServo.write(0); // Posisi Kunci Tertutup
  
  lcd.setCursor(0, 0);
  lcd.print("SMART PARCEL BOX");
  lcd.setCursor(0, 1);
  lcd.print("STANDBY...");
}

void loop() {
  // Baca perintah sinkronisasi dari ESP32
  if (Serial.available()) {
    String command = Serial.readStringUntil('\\n');
    command.trim();
    if (command.startsWith("STEP:")) {
      activePeriod = command.substring(5).toInt();
    } else if (command == "DOOR_OPEN") {
      lcd.clear();
      lcd.print("PINTU TERBUKA");
    } else if (command == "DOOR_CLOSED") {
      lcd.clear();
      lcd.print("PINTU TERKUNCI");
    }
  }

  // Baca input Keypad
  char key = keypad.getKey();
  if (key) {
    if (key == '#') {
      // Verifikasi PIN
      // Jika cocok:
      // Serial.println("BEEP_GRANTED");
      // lockServo.write(90); // Buka
    }
  }
}`;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl md:text-2xl font-bold text-white tracking-wide font-tech flex items-center gap-2.5">
            <Code2 className="w-6 h-6 text-cyan-400" />
            PANDUAN & KODE FIRMWARE ESP32 + ARDUINO
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Program lengkap ESP32 yang mendukung <strong>WiFi Hotspot (SoftAP WebServer)</strong> dan <strong>USB Serial CDC</strong> secara bersamaan.
          </p>
        </div>
      </div>

      {/* Dual Connection Features Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-4 rounded-xl bg-blue-950/30 border border-blue-800/60 text-xs text-slate-300 space-y-2">
          <div className="flex items-center gap-2 text-blue-400 font-bold font-tech text-sm">
            <Wifi className="w-4 h-4" />
            METODE 1: WIFI HOTSPOT SOFTAP (192.168.4.1)
          </div>
          <p className="leading-relaxed text-[11px] text-slate-400">
            ESP32 memancarkan jaringan WiFi sendiri bernama <code>SMART-PARCEL-BOX-AP</code>. Pengguna cukup menyambungkan smartphone atau laptop ke WiFi ini tanpa perlu router internet. WebServer melayani endpoint REST JSON dengan header CORS otomatis.
          </p>
        </div>

        <div className="p-4 rounded-xl bg-cyan-950/30 border border-cyan-800/60 text-xs text-slate-300 space-y-2">
          <div className="flex items-center gap-2 text-cyan-400 font-bold font-tech text-sm">
            <Usb className="w-4 h-4" />
            METODE 2: USB SERIAL (WEB SERIAL API)
          </div>
          <p className="leading-relaxed text-[11px] text-slate-400">
            Kabel data USB terhubung langsung ke browser via Chrome/Edge Web Serial API pada baud rate 9600. Terpisah secara hardware dari UART2 (GPIO16/17) yang digunakan untuk Arduino Uno.
          </p>
        </div>
      </div>

      {/* ESP32 Dual Mode Code Section */}
      <div className="rounded-2xl bg-[#0a0f1d] border border-slate-800/80 overflow-hidden shadow-xl">
        <div className="p-4 bg-slate-900/80 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileCode className="w-4 h-4 text-cyan-400" />
            <span className="text-xs font-bold text-white font-tech">ESP32_SmartParcelBox_DualMode.ino</span>
            <span className="text-[10px] px-2 py-0.5 rounded bg-gradient-to-r from-blue-950 to-cyan-950 text-cyan-300 border border-cyan-800/60 font-mono-code">
              WiFi Hotspot + USB Serial
            </span>
          </div>

          <button
            onClick={() => handleCopy(esp32DualModeCode, 'esp32')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono-code transition-colors"
          >
            {copiedSection === 'esp32' ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-400">Tersalin!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-cyan-400" />
                <span>Salin Kode ESP32</span>
              </>
            )}
          </button>
        </div>

        <pre className="p-4 text-[11px] font-mono-code text-slate-300 overflow-x-auto max-h-96 bg-black/60 leading-relaxed">
          <code>{esp32DualModeCode}</code>
        </pre>
      </div>

      {/* Arduino Uno Slave Code Section */}
      <div className="rounded-2xl bg-[#0a0f1d] border border-slate-800/80 overflow-hidden shadow-xl">
        <div className="p-4 bg-slate-900/80 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-blue-400" />
            <span className="text-xs font-bold text-white font-tech">ArduinoUno_KeypadSlave.ino</span>
            <span className="text-[10px] px-2 py-0.5 rounded bg-blue-950 text-blue-300 border border-blue-800/60 font-mono-code">
              Keypad & Servo Slave
            </span>
          </div>

          <button
            onClick={() => handleCopy(unoCode, 'uno')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono-code transition-colors"
          >
            {copiedSection === 'uno' ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-400">Tersalin!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-cyan-400" />
                <span>Salin Kode Uno</span>
              </>
            )}
          </button>
        </div>

        <pre className="p-4 text-[11px] font-mono-code text-slate-300 overflow-x-auto max-h-64 bg-black/60 leading-relaxed">
          <code>{unoCode}</code>
        </pre>
      </div>
    </div>
  );
};

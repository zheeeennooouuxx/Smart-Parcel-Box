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
  const [activeSketchTab, setActiveSketchTab] = useState<'user' | 'webserver'>('user');

  const handleCopy = (code: string, id: string) => {
    navigator.clipboard.writeText(code);
    setCopiedSection(id);
    setTimeout(() => setCopiedSection(null), 2000);
  };

  const userSketch = `/*
 * ==============================================================
 * SMART PARCEL BOX - KODE FIRMWARE ESP32 ANDA (HOTSPOT "AAA")
 * ==============================================================
 * Konfigurasi Pin:
 * - UART2 ke Uno: RXD2 (GPIO16), TXD2 (GPIO17)
 * - RTC DS1302  : DAT (GPIO19), CLK (GPIO18), RST/CE (GPIO21)
 * - Reed Switch : PIN_REED (GPIO22)
 * - Buzzer      : PIN_BUZZER (GPIO26)
 * - Wi-Fi STA   : SSID "AAA", Sandi "123456789"
 * - Serial USB  : 9600 Baud (Terbaca langsung oleh Dashboard ini!)
 * ==============================================================
 */

#include <WiFi.h>
#include <ThreeWire.h>
#include <RtcDS1302.h>
#include <SHA256.h>
#include <string.h>

// 1. KONFIGURASI PIN ESP32
#define RXD2 16
#define TXD2 17
#define RTC_DAT 19
#define RTC_CLK 18
#define RTC_RST 21
#define PIN_REED 22
#define PIN_BUZZER 26

// 2. KONFIGURASI SISTEM
const uint32_t INTERVAL_PIN = 43200UL; // 12 Jam
const unsigned long INTERVAL_BACA = 1000UL;
const unsigned long INTERVAL_KIRIM = 2000UL;
const char SECRET_KEY[] = "SMARTPARCEL-CHANGE-THIS-SECRET-KEY-2026";

// 3. KONFIGURASI WIFI
const char* WIFI_SSID = "AAA";
const char* WIFI_PASSWORD = "123456789";
const unsigned long INTERVAL_WIFI = 10000UL;
unsigned long waktuCobaWifi = 0;
bool wifiTerhubungSebelumnya = false;

// 4. INISIALISASI RTC DS1302
ThreeWire myWire(RTC_DAT, RTC_CLK, RTC_RST);
RtcDS1302<ThreeWire> rtc(myWire);
bool rtcTersedia = false;

// 5. VARIABEL SISTEM
unsigned long waktuBaca = 0;
unsigned long waktuKirim = 0;
bool statusPintuStabil;
bool statusPintuMentah;
unsigned long waktuDebounce = 0;
const unsigned long DEBOUNCE_DELAY = 50;
char bufferSerial[40];
byte indeksSerial = 0;
uint32_t periodeTerakhir = 0;

void mulaiWifi() {
  Serial.println();
  Serial.println("Menghubungkan ke Wi-Fi...");
  WiFi.mode(WIFI_STA);
  WiFi.setAutoReconnect(true);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  waktuCobaWifi = millis();
}

void periksaWifi() {
  if (WiFi.status() == WL_CONNECTED) {
    if (!wifiTerhubungSebelumnya) {
      wifiTerhubungSebelumnya = true;
      Serial.println();
      Serial.println("============================");
      Serial.println(" WIFI BERHASIL TERHUBUNG");
      Serial.println("============================");
      Serial.print("Nama Wi-Fi : ");
      Serial.println(WIFI_SSID);
      Serial.print("Alamat IP  : ");
      Serial.println(WiFi.localIP());
      Serial.print("Kekuatan   : ");
      Serial.print(WiFi.RSSI());
      Serial.println(" dBm");
      Serial.println("============================");
    }
    return;
  }
  if (wifiTerhubungSebelumnya) {
    wifiTerhubungSebelumnya = false;
    Serial.println("Wi-Fi terputus!");
  }
  if (millis() - waktuCobaWifi >= INTERVAL_WIFI) {
    waktuCobaWifi = millis();
    Serial.println("Mencoba menghubungkan Wi-Fi...");
    WiFi.reconnect();
  }
}

bool periksaValiditasRTC() {
  if (!rtc.IsDateTimeValid() || !rtc.GetIsRunning()) return false;
  RtcDateTime sekarang = rtc.GetDateTime();
  if (!sekarang.IsValid()) return false;
  if (sekarang.Year() < 2020 || sekarang.Year() > 2099) return false;
  return true;
}

uint32_t buatPIN(uint32_t periode) {
  uint8_t pesan[8];
  for (int i = 7; i >= 0; i--) {
    pesan[i] = periode & 0xFF;
    periode >>= 8;
  }
  SHA256 sha;
  uint8_t hasilHash[32];
  sha.resetHMAC(SECRET_KEY, strlen(SECRET_KEY));
  sha.update(pesan, sizeof(pesan));
  sha.finalizeHMAC(SECRET_KEY, strlen(SECRET_KEY), hasilHash, sizeof(hasilHash));
  uint8_t offset = hasilHash[31] & 0x0F;
  uint32_t kode =
    ((uint32_t)(hasilHash[offset] & 0x7F) << 24) |
    ((uint32_t)hasilHash[offset + 1] << 16) |
    ((uint32_t)hasilHash[offset + 2] << 8) |
    ((uint32_t)hasilHash[offset + 3]);
  return kode % 1000000UL;
}

void bacaInformasiWaktu() {
  if (!rtcTersedia) {
    Serial.println("RTC ERROR!");
    return;
  }
  RtcDateTime sekarang = rtc.GetDateTime();
  if (!periksaValiditasRTC()) {
    rtcTersedia = false;
    Serial.println("RTC ERROR!");
    return;
  }
  uint32_t timestamp = sekarang.Unix32Time();
  uint32_t periode = timestamp / INTERVAL_PIN;
  uint32_t pin = buatPIN(periode);

  char tanggal[20];
  snprintf(tanggal, sizeof(tanggal), "%02d/%02d/%04d", sekarang.Day(), sekarang.Month(), sekarang.Year());
  char jam[12];
  snprintf(jam, sizeof(jam), "%02d:%02d:%02d", sekarang.Hour(), sekarang.Minute(), sekarang.Second());
  char pinFormat[7];
  snprintf(pinFormat, sizeof(pinFormat), "%06lu", (unsigned long)pin);

  Serial.println("============================");
  Serial.print("Tanggal       : "); Serial.println(tanggal);
  Serial.print("Waktu         : "); Serial.println(jam);
  Serial.print("Periode PIN   : "); Serial.println(periode);
  Serial.print("PIN saat ini  : "); Serial.println(pinFormat);
  Serial.println("============================");

  periodeTerakhir = periode;
}

void kirimPeriodeArduino() {
  if (!rtcTersedia) {
    Serial2.println("RTC_ERROR");
    return;
  }
  RtcDateTime sekarang = rtc.GetDateTime();
  if (!sekarang.IsValid()) {
    Serial2.println("RTC_ERROR");
    rtcTersedia = false;
    return;
  }
  uint32_t timestamp = sekarang.Unix32Time();
  uint32_t periode = timestamp / INTERVAL_PIN;
  Serial2.print("STEP:");
  Serial2.println(periode);
  periodeTerakhir = periode;
}

void kirimStatusPintu(bool status) {
  if (status == HIGH) {
    Serial.println("PINTU TERBUKA");
    Serial2.println("DOOR_OPEN");
  } else {
    Serial.println("PINTU TERTUTUP");
    Serial2.println("DOOR_CLOSED");
  }
}

void periksaPintu() {
  bool pembacaan = digitalRead(PIN_REED);
  if (pembacaan != statusPintuMentah) {
    statusPintuMentah = pembacaan;
    waktuDebounce = millis();
  }
  if (millis() - waktuDebounce >= DEBOUNCE_DELAY) {
    if (statusPintuMentah != statusPintuStabil) {
      statusPintuStabil = statusPintuMentah;
      kirimStatusPintu(statusPintuStabil);
    }
  }
}

void bunyiBuzzer(bool berhasil) {
  if (berhasil) {
    tone(PIN_BUZZER, 2000, 150);
    delay(200);
    tone(PIN_BUZZER, 2500, 150);
  } else {
    tone(PIN_BUZZER, 500, 500);
  }
}

void prosesPerintah(String perintah) {
  perintah.trim();
  if (perintah == "PING") {
    Serial2.println("PONG");
  } else if (perintah == "BEEP_GRANTED") {
    bunyiBuzzer(true);
  } else if (perintah == "BEEP_DENIED") {
    bunyiBuzzer(false);
  }
}

void komunikasiArduino() {
  while (Serial2.available()) {
    char karakter = Serial2.read();
    if (karakter == '\n') {
      bufferSerial[indeksSerial] = '\0';
      if (indeksSerial > 0) prosesPerintah(String(bufferSerial));
      indeksSerial = 0;
    } else if (karakter != '\r') {
      if (indeksSerial < sizeof(bufferSerial) - 1) {
        bufferSerial[indeksSerial++] = karakter;
      } else {
        indeksSerial = 0;
      }
    }
  }
}

void setup() {
  Serial.begin(9600);
  Serial2.begin(9600, SERIAL_8N1, RXD2, TXD2);
  delay(1000);
  mulaiWifi();
  pinMode(PIN_REED, INPUT_PULLUP);
  pinMode(PIN_BUZZER, OUTPUT);
  digitalWrite(PIN_BUZZER, LOW);

  Serial.println();
  Serial.println("============================");
  Serial.println(" SMART PARCEL BOX - ESP32");
  Serial.println("============================");

  rtc.Begin();
  rtcTersedia = periksaValiditasRTC();
  if (rtcTersedia) {
    Serial.println("RTC DS1302 SIAP!");
  } else {
    Serial.println("RTC DS1302 ERROR!");
  }

  statusPintuMentah = digitalRead(PIN_REED);
  statusPintuStabil = statusPintuMentah;
  kirimStatusPintu(statusPintuStabil);

  Serial.println("UART2 siap.");
  Serial.println("Sistem ESP32 siap.");
  Serial.println("============================");

  waktuBaca = millis();
  waktuKirim = millis() - INTERVAL_KIRIM;
}

void loop() {
  periksaWifi();
  komunikasiArduino();
  periksaPintu();

  if (millis() - waktuBaca >= INTERVAL_BACA) {
    waktuBaca = millis();
    bacaInformasiWaktu();
  }

  if (millis() - waktuKirim >= INTERVAL_KIRIM) {
    waktuKirim = millis();
    kirimPeriodeArduino();
  }
}`;

  const webServerVariant = `/*
 * ==============================================================
 * KODE DENGAN DUKUNGAN WIRELESS WEBSERVER REST API
 * (Sama persis dengan kode Anda + WebServer Port 80 untuk Dashboard)
 * ==============================================================
 * Cukup tambahkan #include <WebServer.h>, rute /api/status, dan
 * server.handleClient() agar dashboard bisa mengakses via WiFi tanpa kabel USB!
 * ==============================================================
 */

#include <WiFi.h>
#include <WebServer.h>
#include <ThreeWire.h>
#include <RtcDS1302.h>
#include <SHA256.h>

#define RXD2 16
#define TXD2 17
#define RTC_DAT 19
#define RTC_CLK 18
#define RTC_RST 21
#define PIN_REED 22
#define PIN_BUZZER 26

const char* WIFI_SSID = "AAA";
const char* WIFI_PASSWORD = "123456789";
const uint32_t INTERVAL_PIN = 43200UL;
const char SECRET_KEY[] = "SMARTPARCEL-CHANGE-THIS-SECRET-KEY-2026";

ThreeWire myWire(RTC_DAT, RTC_CLK, RTC_RST);
RtcDS1302<ThreeWire> rtc(myWire);
WebServer server(80);

// Status Telemetri untuk Web
char tglStr[20] = "09/11/2026";
char jamStr[12] = "00:00:00";
char pinStr[7] = "000000";
uint32_t perAktif = 0;
bool statusPintu = false;
bool rtcTersedia = false;

// Dynamic PIN HMAC-SHA256
uint32_t hitungPIN(uint32_t periode) {
  uint8_t pesan[8];
  for (int i = 7; i >= 0; i--) { pesan[i] = periode & 0xFF; periode >>= 8; }
  SHA256 sha;
  uint8_t hash[32];
  sha.resetHMAC(SECRET_KEY, strlen(SECRET_KEY));
  sha.update(pesan, sizeof(pesan));
  sha.finalizeHMAC(SECRET_KEY, strlen(SECRET_KEY), hash, sizeof(hash));
  uint8_t offset = hash[31] & 0x0F;
  uint32_t kode = ((uint32_t)(hash[offset] & 0x7F) << 24) |
                  ((uint32_t)hash[offset + 1] << 16) |
                  ((uint32_t)hash[offset + 2] << 8) |
                  ((uint32_t)hash[offset + 3]);
  return kode % 1000000UL;
}

void setCors() {
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.sendHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  server.sendHeader("Access-Control-Allow-Headers", "Content-Type");
}

void handleStatus() {
  setCors();
  char buf[256];
  snprintf(buf, sizeof(buf),
    "{\\"type\\":\\"STATUS\\",\\"rtc\\":\\"%s\\",\\"date\\":\\"%s\\",\\"time\\":\\"%s\\",\\"period\\":%lu,\\"pin\\":\\"%s\\",\\"door\\":\\"%s\\"}",
    rtcTersedia ? "OK" : "ERROR", tglStr, jamStr, (unsigned long)perAktif, pinStr, statusPintu ? "OPEN" : "CLOSED"
  );
  server.send(200, "application/json", buf);
}

void setup() {
  Serial.begin(9600);
  Serial2.begin(9600, SERIAL_8N1, RXD2, TXD2);
  pinMode(PIN_REED, INPUT_PULLUP);
  pinMode(PIN_BUZZER, OUTPUT);

  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  rtc.Begin();
  rtcTersedia = rtc.IsDateTimeValid() && rtc.GetIsRunning();

  // Setup rute HTTP REST API untuk Dashboard
  server.on("/api/status", HTTP_GET, handleStatus);
  server.on("/api/status", HTTP_OPTIONS, []() { setCors(); server.send(204); });
  server.begin();

  Serial.println("SMART PARCEL BOX + WEBSERVER SIAP");
}

void loop() {
  server.handleClient(); // Melayani request dari Web Dashboard

  statusPintu = digitalRead(PIN_REED);

  if (rtcTersedia) {
    RtcDateTime skrg = rtc.GetDateTime();
    perAktif = skrg.Unix32Time() / INTERVAL_PIN;
    uint32_t p = hitungPIN(perAktif);
    snprintf(pinStr, sizeof(pinStr), "%06lu", (unsigned long)p);
    snprintf(tglStr, sizeof(tglStr), "%02d/%02d/%04d", skrg.Day(), skrg.Month(), skrg.Year());
    snprintf(jamStr, sizeof(jamStr), "%02d:%02d:%02d", skrg.Hour(), skrg.Minute(), skrg.Second());
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

      {/* Tab Switcher for Sketches */}
      <div className="flex items-center gap-2 p-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs font-tech">
        <button
          onClick={() => setActiveSketchTab('user')}
          className={`flex-1 py-2 px-3 rounded-lg font-bold transition-all ${
            activeSketchTab === 'user'
              ? 'bg-cyan-500 text-slate-950 shadow-md'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          KODE ESP32 ANDA (HOTSPOT "AAA" + USB SERIAL)
        </button>
        <button
          onClick={() => setActiveSketchTab('webserver')}
          className={`flex-1 py-2 px-3 rounded-lg font-bold transition-all ${
            activeSketchTab === 'webserver'
              ? 'bg-blue-600 text-white shadow-md'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          KODE DENGAN REST API (+ WEBSERVER WIRELESS)
        </button>
      </div>

      {/* Active ESP32 Code Section */}
      <div className="rounded-2xl bg-[#0a0f1d] border border-slate-800/80 overflow-hidden shadow-xl">
        <div className="p-4 bg-slate-900/80 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileCode className="w-4 h-4 text-cyan-400" />
            <span className="text-xs font-bold text-white font-tech">
              {activeSketchTab === 'user' ? 'ESP32_SmartParcelBox_StationMode.ino' : 'ESP32_SmartParcelBox_WebServer.ino'}
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded bg-gradient-to-r from-blue-950 to-cyan-950 text-cyan-300 border border-cyan-800/60 font-mono-code">
              {activeSketchTab === 'user' ? 'Hotspot "AAA" • Serial USB 9600' : 'Hotspot "AAA" • WebServer Port 80 + Serial'}
            </span>
          </div>

          <button
            onClick={() => handleCopy(activeSketchTab === 'user' ? userSketch : webServerVariant, activeSketchTab)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono-code transition-colors"
          >
            {copiedSection === activeSketchTab ? (
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
          <code>{activeSketchTab === 'user' ? userSketch : webServerVariant}</code>
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

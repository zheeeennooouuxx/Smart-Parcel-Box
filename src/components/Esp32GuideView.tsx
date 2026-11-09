import React, { useState } from 'react';
import { Code2, Copy, Check, Cpu, Layers, Terminal, AlertCircle, FileCode } from 'lucide-react';

export const Esp32GuideView: React.FC = () => {
  const [copiedSection, setCopiedSection] = useState<string | null>(null);

  const handleCopy = (code: string, id: string) => {
    navigator.clipboard.writeText(code);
    setCopiedSection(id);
    setTimeout(() => setCopiedSection(null), 2000);
  };

  const esp32Code = `/*
 * ==============================================================
 * SMART PARCEL BOX - FIRMWARE ESP32 CONTROLLER
 * ==============================================================
 * Fitur:
 * 1. Serial USB (Baud 9600): Mengirim JSON satu baris ke Web Dashboard
 * 2. Serial2 / UART2 (GPIO16 RX, GPIO17 TX): Komunikasi ke Arduino Uno
 * 3. DS1302 RTC: Sumber waktu fisik interval 12 jam
 * 4. HMAC-SHA256: Algoritma kalkulasi PIN dinamis 6-digit
 * 5. Reed Switch (GPIO4): Deteksi magnetik buka/tutup pintu box
 * 6. Buzzer (GPIO5): Indikator audio
 * ==============================================================
 */

#include <Arduino.h>
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

// Secret Key HMAC-SHA256 (Harus SAMA PERSIS dengan Arduino Uno)
const char* SECRET_KEY = "SMART_PARCEL_SECRET_KEY_2026";
const unsigned long INTERVAL_12_HOURS = 43200UL; // 12 jam dalam detik

// Serial2 ke Arduino Uno (GPIO16 = RX, GPIO17 = TX)
HardwareSerial ArduinoSerial(2);

// Status Cache
int lastReedState = -1;
unsigned long lastSerialTelemetry = 0;
unsigned long currentPeriod = 0;
char currentPin[7] = "000000";

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

void sendJsonDashboard(const char* dateStr, const char* timeStr, bool isRtcOk, const char* doorStr) {
  if (!isRtcOk) {
    Serial.println("{\\"type\\":\\"ERROR\\",\\"rtc\\":\\"ERROR\\",\\"message\\":\\"RTC NOT READY\\"}");
    return;
  }
  
  // Format JSON satu baris diakhiri newline untuk Web Serial API
  Serial.printf(
    "{\\"type\\":\\"STATUS\\",\\"rtc\\":\\"OK\\",\\"date\\":\\"%s\\",\\"time\\":\\"%s\\",\\"period\\":%lu,\\"pin\\":\\"%s\\",\\"door\\":\\"%s\\"}\\n",
    dateStr, timeStr, currentPeriod, currentPin, doorStr
  );
}

void setup() {
  // Serial USB ke Web Dashboard Browser
  Serial.begin(9600);
  
  // Serial2 ke Arduino Uno
  ArduinoSerial.begin(9600, SERIAL_8N1, 16, 17);

  pinMode(REED_SWITCH_PIN, INPUT_PULLUP);
  pinMode(BUZZER_PIN, OUTPUT);
  digitalWrite(BUZZER_PIN, LOW);

  // Inisialisasi RTC DS1302
  Rtc.Begin();
  if (!Rtc.IsDateTimeValid()) {
    Serial.println("{\\"type\\":\\"ERROR\\",\\"rtc\\":\\"ERROR\\",\\"message\\":\\"RTC DATETIME INVALID\\"}");
  }
  if (Rtc.GetIsWriteProtected()) {
    Rtc.SetIsWriteProtected(false);
  }
  if (!Rtc.GetIsRunning()) {
    Rtc.SetIsRunning(true);
  }
}

void loop() {
  // 1. Baca Reed Switch
  int reedState = digitalRead(REED_SWITCH_PIN);
  const char* doorStateStr = (reedState == HIGH) ? "OPEN" : "CLOSED";

  if (reedState != lastReedState) {
    lastReedState = reedState;
    // Kirim event perubahan pintu ke Arduino Uno via UART2
    if (reedState == HIGH) {
      ArduinoSerial.println("DOOR_OPEN");
    } else {
      ArduinoSerial.println("DOOR_CLOSED");
    }

    // Kirim event instan ke Web Dashboard Serial USB
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

  // 3. Telemetri Rutin ke Web Dashboard via USB Serial setiap 2 detik
  if (millis() - lastSerialTelemetry >= 2000) {
    lastSerialTelemetry = millis();

    if (!Rtc.IsDateTimeValid()) {
      Serial.println("{\\"type\\":\\"ERROR\\",\\"rtc\\":\\"ERROR\\",\\"message\\":\\"RTC BATTERY LOW OR DISCONNECTED\\"}");
      ArduinoSerial.println("RTC_ERROR");
      return;
    }

    RtcDateTime now = Rtc.GetDateTime();
    unsigned long epochSeconds = now.Epoch32Time();
    unsigned long newPeriod = epochSeconds / INTERVAL_12_HOURS;

    // Hitung ulang PIN hanya jika periode waktu berganti
    if (newPeriod != currentPeriod) {
      currentPeriod = newPeriod;
      generateHmacPin(currentPeriod, currentPin);
      
      // Sinkronkan step periode ke Arduino Uno
      ArduinoSerial.printf("STEP:%lu\\n", currentPeriod);
    }

    char dateBuffer[12];
    char timeBuffer[10];
    snprintf(dateBuffer, sizeof(dateBuffer), "%04u-%02u-%02u", now.Year(), now.Month(), now.Day());
    snprintf(timeBuffer, sizeof(timeBuffer), "%02u:%02u:%02u", now.Hour(), now.Minute(), now.Second());

    sendJsonDashboard(dateBuffer, timeBuffer, true, doorStateStr);
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
 * - SoftwareSerial / Hardware Serial ke ESP32
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
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl md:text-2xl font-bold text-white tracking-wide font-tech flex items-center gap-2.5">
            <Code2 className="w-6 h-6 text-cyan-400" />
            PANDUAN & KODE FIRMWARE ESP32 + ARDUINO
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Program lengkap ESP32 yang mengirimkan JSON format satu baris ke USB Serial tanpa mengganggu UART2 Arduino Uno.
          </p>
        </div>
      </div>

      {/* Architecture Alert */}
      <div className="p-4 rounded-xl bg-cyan-950/40 border border-cyan-800/60 text-xs text-slate-300 space-y-2">
        <div className="flex items-center gap-2 text-cyan-300 font-bold font-tech text-sm">
          <Terminal className="w-4 h-4" />
          ARSITEKTUR DUAL-SERIAL ESP32
        </div>
        <p className="leading-relaxed">
          ESP32 menggunakan <strong>Serial USB (Baud 9600)</strong> untuk berbicara langsung dengan browser ini menggunakan Web Serial API. Sedangkan komunikasi ke Arduino Uno menggunakan <strong>Serial2 (UART2 pada GPIO16 RX dan GPIO17 TX)</strong>. Kedua jalur ini terisolasi sehingga pengiriman JSON ke dashboard tidak akan memicu konflik pesan pada Arduino.
        </p>
      </div>

      {/* ESP32 Code Section */}
      <div className="rounded-2xl bg-[#0a0f1d] border border-slate-800/80 overflow-hidden shadow-xl">
        <div className="p-4 bg-slate-900/80 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileCode className="w-4 h-4 text-cyan-400" />
            <span className="text-xs font-bold text-white font-tech">ESP32_SmartParcelBox.ino</span>
            <span className="text-[10px] px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800/60 font-mono-code">
              Firmware Utama
            </span>
          </div>

          <button
            onClick={() => handleCopy(esp32Code, 'esp32')}
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
          <code>{esp32Code}</code>
        </pre>
      </div>

      {/* Arduino Uno Companion Code Section */}
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

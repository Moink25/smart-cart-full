#include <ESP8266WiFi.h>
#include <ESP8266HTTPClient.h>
#include <WiFiClientSecure.h>
#include <ArduinoJson.h>
#include <SPI.h>
#include <MFRC522.h>

// WiFi credentials
const char *ssid = "YOUR_WIFI_SSID";
const char *password = "YOUR_WIFI_PASSWORD";

// Server details - Now using the hosted server
const char *serverHost = "smart-cart-test.onrender.com";
// Simplify path to avoid any routing issues
const char *serverPath = "/api/cart/rfid-scan";
const char *deviceId = "cart_001"; // Unique ID for this cart

// RFID pins
#define SS_PIN D8
#define RST_PIN D0

// LED pins
#define GREEN_LED_PIN D3
#define RED_LED_PIN D4

// RFID
MFRC522 rfid(SS_PIN, RST_PIN);
String lastReadRFID = "";
unsigned long lastRFIDReadTime = 0;
const int rfidCooldown = 2000; // 2 seconds cooldown between reads

// Retry parameters
const int maxRetries = 3;
const int retryDelay = 2000; // 2 seconds between retries

void setup()
{
  // Initialize serial
  Serial.begin(115200);
  delay(2000); // Give time for serial monitor to open
  Serial.println("\n\n========== SMART CART RFID READER ==========");
  Serial.println("Starting Simple RFID Reader - Cloud Server Version");

  // Initialize pins
  pinMode(GREEN_LED_PIN, OUTPUT);
  pinMode(RED_LED_PIN, OUTPUT);

  // Set initial LED states
  digitalWrite(GREEN_LED_PIN, LOW);
  digitalWrite(RED_LED_PIN, LOW);

  // Quick LED test
  blinkLED(GREEN_LED_PIN, 2);
  blinkLED(RED_LED_PIN, 2);

  // Initialize SPI and RFID
  SPI.begin();
  rfid.PCD_Init();
  delay(4);
  rfid.PCD_DumpVersionToSerial();
  Serial.println("RFID Reader initialized");

  // Connect to WiFi
  connectToWiFi();

  // Test connection to server
  testServerConnection();
}

void loop()
{
  // Check WiFi connection
  if (WiFi.status() != WL_CONNECTED)
  {
    Serial.println("WiFi disconnected. Reconnecting...");
    blinkLED(RED_LED_PIN, 3);
    connectToWiFi();
    return;
  }

  // Check if an RFID card is present
  if (rfid.PICC_IsNewCardPresent() && rfid.PICC_ReadCardSerial())
  {
    // Read RFID tag
    String rfidTag = readRFIDTag();

    // Check cooldown to avoid multiple reads
    if (millis() - lastRFIDReadTime > rfidCooldown)
    {
      lastRFIDReadTime = millis();

      // Process the scan (always add items)
      String action = "add";

      // Send RFID data to server
      sendRFIDData(rfidTag, action);

      // Save last read RFID
      lastReadRFID = rfidTag;
    }

    // Halt PICC and stop encryption
    rfid.PICC_HaltA();
    rfid.PCD_StopCrypto1();
  }

  // Send a test scan every 30 seconds for debugging
  static unsigned long lastTestTime = 0;
  if (millis() - lastTestTime > 30000)
  { // Every 30 seconds
    lastTestTime = millis();
    Serial.println("\n----- SENDING TEST SCAN -----");
    sendRFIDData("TEST_TAG", "add");
  }

  delay(100);
}

void connectToWiFi()
{
  Serial.print("\nConnecting to WiFi...");

  WiFi.begin(ssid, password);

  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 20)
  {
    delay(500);
    Serial.print(".");
    attempts++;
  }

  if (WiFi.status() == WL_CONNECTED)
  {
    Serial.println("\nWiFi connected successfully!");
    Serial.print("IP address: ");
    Serial.println(WiFi.localIP());
    blinkLED(GREEN_LED_PIN, 2);
  }
  else
  {
    Serial.println("\nFailed to connect to WiFi");
    blinkLED(RED_LED_PIN, 5);
  }
}

void testServerConnection()
{
  Serial.println("\n----- TESTING SERVER CONNECTION -----");
  Serial.print("Connecting to: https://");
  Serial.println(serverHost);

  WiFiClientSecure client;
  client.setInsecure(); // Skip certificate verification

  // First check if server is reachable
  if (!client.connect(serverHost, 443))
  {
    Serial.println("Connection failed! Server might be down.");
    blinkLED(RED_LED_PIN, 5);
    return;
  }

  Serial.println("Connected to server!");
  Serial.println("Sending GET request to test server...");

  // Try a simpler endpoint like /api/products
  client.print(String("GET /api/products HTTP/1.1\r\n") +
               "Host: " + serverHost + "\r\n" +
               "Connection: close\r\n\r\n");

  // Wait for response with timeout
  unsigned long timeout = millis();
  while (client.available() == 0)
  {
    if (millis() - timeout > 10000) // 10 second timeout
    {
      Serial.println("Request timeout! Server might be waking up from sleep.");
      client.stop();
      blinkLED(RED_LED_PIN, 3);
      return;
    }
    delay(100);
  }

  // Read response headers
  Serial.println("Server Response:");
  String line = client.readStringUntil('\n');
  Serial.println(line); // Print HTTP status line

  // Check if status line contains 502 Bad Gateway
  if (line.indexOf("502") > 0)
  {
    Serial.println("Server returned 502 Bad Gateway.");
    Serial.println("The server might be starting up. Please wait and try again.");
    blinkLED(RED_LED_PIN, 4);
    delay(5000);
    return;
  }

  // Skip headers
  while (client.available() && line.length() > 0)
  {
    line = client.readStringUntil('\n');
    if (line.length() <= 1)
      break; // Empty line means end of headers
  }

  // Read some of the response body
  String responseBody = "";
  int bytesRead = 0;
  timeout = millis();

  while (client.available() && bytesRead < 200)
  {
    char c = client.read();
    responseBody += c;
    bytesRead++;

    // Add another timeout check
    if (millis() - timeout > 5000)
    { // 5 second timeout for reading response
      break;
    }
  }

  Serial.println("Response (first 200 bytes):");
  Serial.println(responseBody);

  if (responseBody.length() > 0)
  {
    Serial.println("Server test successful!");
    blinkLED(GREEN_LED_PIN, 3);
  }
  else
  {
    Serial.println("No data received from server");
    blinkLED(RED_LED_PIN, 3);
  }

  client.stop();
}

String readRFIDTag()
{
  String tag = "";
  for (byte i = 0; i < rfid.uid.size; i++)
  {
    tag += (rfid.uid.uidByte[i] < 0x10 ? "0" : "");
    tag += String(rfid.uid.uidByte[i], HEX);
  }
  tag.toUpperCase();

  Serial.println("RFID Tag: " + tag);
  return tag;
}

void sendRFIDData(String rfidTag, String action)
{
  Serial.println("\n----- SENDING RFID DATA -----");

  if (WiFi.status() != WL_CONNECTED)
  {
    Serial.println("Error: Not connected to WiFi");
    return;
  }

  // Implement retry mechanism
  bool success = false;
  int retryCount = 0;

  while (!success && retryCount < maxRetries)
  {
    if (retryCount > 0)
    {
      Serial.print("Retry attempt ");
      Serial.print(retryCount);
      Serial.print(" of ");
      Serial.println(maxRetries);
      delay(retryDelay);
    }

    // Try to send data
    success = attemptSendRFIDData(rfidTag, action);
    retryCount++;
  }

  if (!success)
  {
    Serial.println("Failed to send RFID data after multiple attempts");
    blinkLED(RED_LED_PIN, 5);
  }
}

bool attemptSendRFIDData(String rfidTag, String action)
{
  // Use secure client for HTTPS
  WiFiClientSecure client;
  client.setInsecure(); // Skip certificate verification
  HTTPClient https;

  Serial.print("Connecting to server: https://");
  Serial.println(serverHost);

  // Full URL for the request
  String url = "https://" + String(serverHost) + String(serverPath);
  Serial.print("URL: ");
  Serial.println(url);

  // Start connection
  https.begin(client, url);
  https.addHeader("Content-Type", "application/json");
  https.setTimeout(15000); // Increase timeout to 15 seconds

  // Create JSON payload
  DynamicJsonDocument doc(200);
  doc["rfidTag"] = rfidTag;
  doc["action"] = action;
  doc["deviceId"] = deviceId;

  String jsonPayload;
  serializeJson(doc, jsonPayload);

  Serial.print("JSON payload: ");
  Serial.println(jsonPayload);

  // Send HTTP POST request
  Serial.println("Sending POST request...");
  int httpResponseCode = https.POST(jsonPayload);

  Serial.print("HTTP Response code: ");
  Serial.println(httpResponseCode);

  // Check if got a 502 Bad Gateway error
  if (httpResponseCode == 502)
  {
    Serial.println("Server returned 502 Bad Gateway.");
    Serial.println("The server might be starting up. Waiting before retry.");
    https.end();
    blinkLED(RED_LED_PIN, 2);
    return false;
  }

  if (httpResponseCode > 0)
  {
    String response = https.getString();
    Serial.print("Response: ");
    Serial.println(response);

    // Parse response
    DynamicJsonDocument responseDoc(1024);
    DeserializationError error = deserializeJson(responseDoc, response);

    if (!error)
    {
      bool success = responseDoc["success"];
      if (success)
      {
        // Product successfully added to cart
        Serial.println("Product successfully added to cart!");
        blinkLED(GREEN_LED_PIN, 3);
        https.end();
        return true;
      }
      else
      {
        // Failed to add product
        Serial.println("Failed to add product to cart");
        Serial.print("Error message: ");
        if (responseDoc.containsKey("message"))
        {
          Serial.println(responseDoc["message"].as<String>());
        }
        blinkLED(RED_LED_PIN, 3);
        https.end();
        return false;
      }
    }
    else
    {
      Serial.print("JSON parsing error: ");
      Serial.println(error.c_str());
      blinkLED(RED_LED_PIN, 2);
      https.end();
      return false;
    }
  }
  else
  {
    Serial.print("Error on sending POST: ");
    Serial.println(https.errorToString(httpResponseCode));
    blinkLED(RED_LED_PIN, 3);
    https.end();
    return false;
  }
}

void blinkLED(int pin, int times)
{
  for (int i = 0; i < times; i++)
  {
    digitalWrite(pin, HIGH);
    delay(200);
    digitalWrite(pin, LOW);
    delay(200);
  }
}
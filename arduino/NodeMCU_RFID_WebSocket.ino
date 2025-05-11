#include <ESP8266WiFi.h>
#include <ESP8266HTTPClient.h>
#include <WebSocketsClient.h>
#include <ArduinoJson.h>
#include <SPI.h>
#include <MFRC522.h>
#include <LiquidCrystal_I2C.h>

// WiFi credentials
const char *ssid = "YOUR_WIFI_SSID";
const char *password = "YOUR_WIFI_PASSWORD";

// Server details
const char *websocketServer = "192.168.1.100"; // Replace with your server IP
const int websocketPort = 5000;
const char *websocketPath = "/";

// Device ID for cart (make unique for each cart)
const char *deviceId = "cart_001";

// RFID pins
#define SS_PIN D8
#define RST_PIN D0

// Button pins
#define CHECKOUT_BUTTON_PIN D1
#define REMOVE_BUTTON_PIN D2

// LED pins
#define GREEN_LED_PIN D3
#define RED_LED_PIN D4
#define BLUE_LED_PIN D5

// RFID
MFRC522 rfid(SS_PIN, RST_PIN);
String lastReadRFID = "";
unsigned long lastRFIDReadTime = 0;
const int rfidCooldown = 2000; // 2 seconds cooldown between reads

// LCD Display (I2C)
LiquidCrystal_I2C lcd(0x27, 16, 2); // Set the LCD address (0x27 or 0x3F are common)

// WebSocket
WebSocketsClient webSocket;
bool connected = false;
bool cartConnected = false;
String connectedUserId = "";

// Button states
bool checkoutButtonState = HIGH;
bool removeButtonState = HIGH;
bool lastCheckoutButtonState = HIGH;
bool lastRemoveButtonState = HIGH;
unsigned long lastDebounceTime = 0;
const int debounceDelay = 50;

// Cart state
int itemCount = 0;
float cartTotal = 0.0;
String lastProductName = "";

void setup()
{
  // Initialize serial
  Serial.begin(115200);
  Serial.println("\nStarting Smart Cart RFID Reader");

  // Initialize pins
  pinMode(CHECKOUT_BUTTON_PIN, INPUT_PULLUP);
  pinMode(REMOVE_BUTTON_PIN, INPUT_PULLUP);
  pinMode(GREEN_LED_PIN, OUTPUT);
  pinMode(RED_LED_PIN, OUTPUT);
  pinMode(BLUE_LED_PIN, OUTPUT);

  // Set initial LED states
  digitalWrite(GREEN_LED_PIN, LOW);
  digitalWrite(RED_LED_PIN, LOW);
  digitalWrite(BLUE_LED_PIN, LOW);

  // Initialize SPI and RFID
  SPI.begin();
  rfid.PCD_Init();
  delay(4);
  rfid.PCD_DumpVersionToSerial();
  Serial.println("RFID Reader initialized");

  // Initialize LCD
  lcd.init();
  lcd.backlight();
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("Smart Cart");
  lcd.setCursor(0, 1);
  lcd.print("Initializing...");

  // Connect to WiFi
  connectToWiFi();

  // Setup WebSocket
  setupWebSocket();

  // Update LCD
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("Smart Cart Ready");
  lcd.setCursor(0, 1);
  lcd.print("Waiting...");
}

void loop()
{
  // Handle WebSocket
  webSocket.loop();

  // Reconnect if needed
  if (!connected)
  {
    blinkLED(RED_LED_PIN, 3);
    connectToWiFi();
    setupWebSocket();

    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print("Connection Lost");
    lcd.setCursor(0, 1);
    lcd.print("Reconnecting...");

    delay(5000);
    return;
  }

  // Read button states
  bool currentCheckoutButtonState = digitalRead(CHECKOUT_BUTTON_PIN);
  bool currentRemoveButtonState = digitalRead(REMOVE_BUTTON_PIN);

  // Check for button state changes with debounce
  if ((currentCheckoutButtonState != lastCheckoutButtonState) ||
      (currentRemoveButtonState != lastRemoveButtonState))
  {
    lastDebounceTime = millis();
  }

  if ((millis() - lastDebounceTime) > debounceDelay)
  {
    // If checkout button state has changed
    if (currentCheckoutButtonState != checkoutButtonState)
    {
      checkoutButtonState = currentCheckoutButtonState;
      // If button is pressed (LOW when pressed with INPUT_PULLUP)
      if (checkoutButtonState == LOW)
      {
        Serial.println("Checkout button pressed");
        if (cartConnected && itemCount > 0)
        {
          blinkLED(GREEN_LED_PIN, 3);
          requestCheckout();
        }
        else
        {
          blinkLED(RED_LED_PIN, 2);
        }
      }
    }

    if (currentRemoveButtonState != removeButtonState)
    {
      removeButtonState = currentRemoveButtonState;
      if (removeButtonState == LOW && cartConnected)
      {
        Serial.println("Remove mode activated");
        digitalWrite(RED_LED_PIN, HIGH);
      }
      else
      {
        digitalWrite(RED_LED_PIN, LOW);
      }
    }
  }

  lastCheckoutButtonState = currentCheckoutButtonState;
  lastRemoveButtonState = currentRemoveButtonState;

  // Check if an RFID card is present
  if (cartConnected && rfid.PICC_IsNewCardPresent() && rfid.PICC_ReadCardSerial())
  {
    // Read RFID tag
    String rfidTag = readRFIDTag();

    // Check cooldown to avoid multiple reads
    if (millis() - lastRFIDReadTime > rfidCooldown)
    {
      lastRFIDReadTime = millis();

      // Determine action based on button state
      String action = "add"; // Default action
      if (removeButtonState == LOW)
      {
        action = "remove";
        blinkLED(RED_LED_PIN, 2);
      }
      else
      {
        blinkLED(GREEN_LED_PIN, 2);
      }

      // Send RFID data to server
      sendRFIDData(rfidTag, action);

      // Save last read RFID
      lastReadRFID = rfidTag;
    }

    // Halt PICC and stop encryption
    rfid.PICC_HaltA();
    rfid.PCD_StopCrypto1();
  }

  delay(100);
}

void connectToWiFi()
{
  Serial.print("Connecting to WiFi");
  digitalWrite(BLUE_LED_PIN, HIGH);

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
    Serial.println("\nWiFi connected");
    Serial.print("IP address: ");
    Serial.println(WiFi.localIP());
    digitalWrite(BLUE_LED_PIN, LOW);
  }
  else
  {
    Serial.println("\nFailed to connect to WiFi");
    digitalWrite(BLUE_LED_PIN, LOW);
    blinkLED(BLUE_LED_PIN, 5);
  }
}

void setupWebSocket()
{
  Serial.println("Setting up WebSocket connection");

  // Server address, port, and URL
  webSocket.begin(websocketServer, websocketPort, websocketPath);

  // Event handler
  webSocket.onEvent(webSocketEvent);

  // Try every 5000ms if connection has failed
  webSocket.setReconnectInterval(5000);

  // Set timeout
  webSocket.setTimeout(5000);
}

void webSocketEvent(WStype_t type, uint8_t *payload, size_t length)
{
  switch (type)
  {
  case WStype_DISCONNECTED:
    Serial.println("WebSocket disconnected");
    connected = false;
    cartConnected = false;
    updateLCDStatus();
    break;

  case WStype_CONNECTED:
    Serial.println("WebSocket connected");
    connected = true;

    // Send a connection message to register as a NodeMCU device
    DynamicJsonDocument doc(200);
    doc["deviceId"] = deviceId;

    String message;
    serializeJson(doc, message);

    webSocket.sendTXT("nodemcu_connect");
    webSocket.sendTXT(message.c_str());

    break;

  case WStype_TEXT:
    Serial.printf("WebSocket message received: %s\n", payload);
    handleWebSocketMessage(payload, length);
    break;

  case WStype_ERROR:
    Serial.println("WebSocket error");
    break;
  }
}

void handleWebSocketMessage(uint8_t *payload, size_t length)
{
  // Convert payload to null-terminated string
  char *message = new char[length + 1];
  strncpy(message, (char *)payload, length);
  message[length] = '\0';

  // Parse JSON message
  DynamicJsonDocument doc(1024);
  DeserializationError error = deserializeJson(doc, message);

  if (error)
  {
    Serial.print("deserializeJson() failed: ");
    Serial.println(error.c_str());
    delete[] message;
    return;
  }

  // Handle different message types
  const char *event = doc["event"];

  if (event)
  {
    if (strcmp(event, "cart_connected") == 0)
    {
      handleCartConnected(doc);
    }
    else if (strcmp(event, "product_scanned") == 0)
    {
      handleProductScanned(doc);
    }
    else if (strcmp(event, "checkout_complete") == 0)
    {
      handleCheckoutComplete(doc);
    }
    else if (strcmp(event, "product_not_found") == 0)
    {
      handleProductNotFound(doc);
    }
  }

  delete[] message;
}

void handleCartConnected(const DynamicJsonDocument &doc)
{
  bool success = doc["success"];
  const char *userId = doc["userId"];

  if (success)
  {
    cartConnected = true;
    connectedUserId = userId;

    digitalWrite(GREEN_LED_PIN, HIGH);
    delay(1000);
    digitalWrite(GREEN_LED_PIN, LOW);

    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print("Cart Connected");
    lcd.setCursor(0, 1);
    lcd.print("Ready to scan");

    Serial.println("Cart connected to user: " + connectedUserId);
  }
}

void handleProductScanned(const DynamicJsonDocument &doc)
{
  const char *action = doc["action"];
  JsonObject product = doc["product"];

  const char *productName = product["name"];
  float productPrice = product["price"];

  lastProductName = productName;

  if (strcmp(action, "add") == 0)
  {
    itemCount++;
    cartTotal += productPrice;

    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print("Added: ");
    lcd.print(productName);
    lcd.setCursor(0, 1);
    lcd.print("Total: $");
    lcd.print(cartTotal);

    digitalWrite(GREEN_LED_PIN, HIGH);
    delay(500);
    digitalWrite(GREEN_LED_PIN, LOW);
  }
  else if (strcmp(action, "remove") == 0)
  {
    itemCount = max(0, itemCount - 1);
    cartTotal = max(0.0f, cartTotal - productPrice);

    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print("Removed: ");
    lcd.print(productName);
    lcd.setCursor(0, 1);
    lcd.print("Total: $");
    lcd.print(cartTotal);

    digitalWrite(RED_LED_PIN, HIGH);
    delay(500);
    digitalWrite(RED_LED_PIN, LOW);
  }

  updateLCDStatus();
}

void handleCheckoutComplete(const DynamicJsonDocument &doc)
{
  const char *deviceId = doc["deviceId"];

  if (strcmp(deviceId, deviceId) == 0)
  {
    cartConnected = false;
    itemCount = 0;
    cartTotal = 0.0;

    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print("Checkout Complete");
    lcd.setCursor(0, 1);
    lcd.print("Thank you!");

    blinkLED(GREEN_LED_PIN, 5);

    delay(3000);
    updateLCDStatus();
  }
}

void handleProductNotFound(const DynamicJsonDocument &doc)
{
  const char *rfidTag = doc["rfidTag"];

  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("Unknown Product");
  lcd.setCursor(0, 1);
  lcd.print("RFID: ");
  lcd.print(rfidTag);

  blinkLED(RED_LED_PIN, 3);

  delay(2000);
  updateLCDStatus();
}

void updateLCDStatus()
{
  lcd.clear();

  if (!connected)
  {
    lcd.setCursor(0, 0);
    lcd.print("Disconnected");
    lcd.setCursor(0, 1);
    lcd.print("Please wait...");
  }
  else if (!cartConnected)
  {
    lcd.setCursor(0, 0);
    lcd.print("Cart ID: ");
    lcd.print(deviceId);
    lcd.setCursor(0, 1);
    lcd.print("Ready to connect");
  }
  else
  {
    lcd.setCursor(0, 0);
    lcd.print("Items: ");
    lcd.print(itemCount);
    lcd.setCursor(0, 1);
    lcd.print("Total: $");
    lcd.print(cartTotal);
  }
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
  if (!connected)
  {
    Serial.println("Not connected to server, can't send RFID data");
    return;
  }

  if (!cartConnected)
  {
    Serial.println("Cart not connected to user, can't send RFID data");
    return;
  }

  DynamicJsonDocument doc(200);
  doc["rfidTag"] = rfidTag;
  doc["action"] = action;
  doc["deviceId"] = deviceId;

  String message;
  serializeJson(doc, message);

  Serial.println("Sending RFID data: " + message);
  webSocket.sendTXT("nodemcu_rfid_scan");
  webSocket.sendTXT(message.c_str());
}

void requestCheckout()
{
  if (!cartConnected)
  {
    Serial.println("Cart not connected, can't checkout");
    return;
  }

  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("Processing");
  lcd.setCursor(0, 1);
  lcd.print("Checkout...");

  // Checkout is handled on the server side automatically
  // The server will send a checkout_complete event
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
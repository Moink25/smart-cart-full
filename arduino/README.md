# Smart Cart RFID Hardware Setup

This directory contains the Arduino code for the NodeMCU ESP8266 with RC522 RFID reader integration for the Smart Cart system.

## Hardware Requirements

- NodeMCU ESP8266 development board
- MFRC522 RFID reader module
- 2 push buttons (for add/remove actions)
- 2 LEDs (green and red)
- Breadboard and jumper wires
- Micro USB cable for programming and power

## Wiring Instructions

Connect the components as follows:

### RFID RC522 to NodeMCU:

- SDA (SS) -> D8
- SCK -> D5 (SCK)
- MOSI -> D7 (MOSI)
- MISO -> D6 (MISO)
- IRQ -> Not connected
- GND -> GND
- RST -> D0
- 3.3V -> 3.3V

### Buttons:

- Add Button -> D1 (with 10k pull-up resistor to 3.3V)
- Remove Button -> D2 (with 10k pull-up resistor to 3.3V)

### LEDs:

- Green LED -> D3 (with 220 ohm resistor)
- Red LED -> D4 (with 220 ohm resistor)

## Required Libraries

Install the following libraries using the Arduino Library Manager:

1. ESP8266WiFi
2. ESP8266HTTPClient
3. WebSocketsClient by Links2004
4. ArduinoJson by Benoit Blanchon
5. MFRC522 by GithubCommunity

## Configuration

Before uploading the code to your NodeMCU, update the following variables in the `NodeMCU_RFID_WebSocket.ino` file:

1. WiFi credentials:

```cpp
const char* ssid = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASSWORD";
```

2. Server details:

```cpp
const char* websocketServer = "192.168.1.100"; // Replace with your server IP
const int websocketPort = 5000;
```

## Setup and Usage

1. Wire the components according to the instructions above
2. Install the required libraries
3. Update the WiFi and server configuration
4. Upload the code to your NodeMCU
5. Open the Serial Monitor at 115200 baud to view debug information
6. The device will connect to WiFi and establish a WebSocket connection with the server
7. Use the buttons and RFID tags to interact with the Smart Cart system:
   - Place an RFID tag on the reader while pressing the "Add" button to add an item to the cart
   - Place an RFID tag on the reader while pressing the "Remove" button to remove an item from the cart
   - If no button is pressed, the default action is "add"

## Troubleshooting

- If the red LED blinks 3 times repeatedly, there's a connection issue with the server
- If the red LED blinks 5 times after scanning a tag, the server reported an error (e.g., product not found)
- Check the Serial Monitor for detailed error messages and debugging information

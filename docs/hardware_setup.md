# Smart Cart Hardware Setup Guide

This guide provides detailed instructions for setting up the hardware components of the Smart Cart system.

## Components Required

- NodeMCU ESP8266 development board
- MFRC522 RFID reader module
- 2 push buttons (for add/remove actions)
- 2 LEDs (green and red)
- Breadboard and jumper wires
- Micro USB cable for programming and power
- RFID cards or tags for testing

## Wiring Instructions

### RFID RC522 to NodeMCU

| RC522 Pin | NodeMCU Pin   |
| --------- | ------------- |
| SDA (SS)  | D8            |
| SCK       | D5 (SCK)      |
| MOSI      | D7 (MOSI)     |
| MISO      | D6 (MISO)     |
| IRQ       | Not connected |
| GND       | GND           |
| RST       | D0            |
| 3.3V      | 3.3V          |

### Buttons

| Button        | NodeMCU Pin                            |
| ------------- | -------------------------------------- |
| Add Button    | D1 (with 10k pull-up resistor to 3.3V) |
| Remove Button | D2 (with 10k pull-up resistor to 3.3V) |

### LEDs

| LED       | NodeMCU Pin                |
| --------- | -------------------------- |
| Green LED | D3 (with 220 ohm resistor) |
| Red LED   | D4 (with 220 ohm resistor) |

## Circuit Diagram

```
                         +-----+
                         |     |
                    +----+ USB +----+
                    |    |     |    |
                    |    +-----+    |
                    |               |
                +---+---+       +---+---+
                |       |       |       |
          +-----+ D1    |       |    D8 +-----+
          |     |       |       |       |     |
Add       |     |       |       |       |     |      RFID
Button    +     |       |       |       |     +      Module
          |     |NodeMCU|       |       |     |
          +-----+ D2    |       |    D0 +-----+
                |       |       |       |
          +-----+ D3    |       |    D5 +-----+
          |     |       |       |       |     |
Green     +     |       |       |       |     +
LED       |     |       |       |       |     |
          +-----+ D4    |       |    D6 +-----+
                |       |       |       |
          +-----+ GND   |       |    D7 +-----+
          |     |       |       |       |     |
Red       +     |       |       |       |     +
LED       |     |       |       |       |     |
          +-----+ 3.3V  |       |   GND +-----+
                |       |       |       |
                +-------+       +-------+
```

## Software Setup

1. Install the Arduino IDE
2. Add ESP8266 board support to Arduino IDE

   - Open Arduino IDE
   - Go to File > Preferences
   - Add `http://arduino.esp8266.com/stable/package_esp8266com_index.json` to Additional Boards Manager URLs
   - Go to Tools > Board > Boards Manager
   - Search for ESP8266 and install

3. Install required libraries:

   - ESP8266WiFi
   - ESP8266HTTPClient
   - WebSocketsClient by Links2004
   - ArduinoJson by Benoit Blanchon
   - MFRC522 by GithubCommunity

4. Configure the NodeMCU_RFID_WebSocket.ino file:

   - Update WiFi credentials
   - Update server IP address and port

5. Connect NodeMCU to your computer via USB
6. Select the correct board and port in Arduino IDE
7. Upload the code to NodeMCU

## Testing the Hardware

1. Open the Serial Monitor (baud rate: 115200)
2. Verify that the NodeMCU connects to WiFi and WebSocket server
3. Place an RFID tag near the reader
4. Press the Add button while scanning to add an item to the cart
5. Press the Remove button while scanning to remove an item from the cart
6. Check the Serial Monitor and LED indicators for feedback

## Troubleshooting

### Connection Issues

- Ensure WiFi credentials are correct
- Verify the server is running and accessible
- Check that the WebSocket port is open and not blocked by a firewall

### RFID Reading Issues

- Make sure the wiring is correct
- Try different RFID tags
- Check that the RFID reader is powered correctly (3.3V)

### Button/LED Issues

- Verify the pull-up resistors are connected correctly
- Check the LED polarity (longer leg is positive/anode)
- Ensure the current-limiting resistors are in place for LEDs

## Additional Resources

- [NodeMCU ESP8266 Pinout Reference](https://randomnerdtutorials.com/esp8266-pinout-reference-gpios/)
- [MFRC522 RFID Module Documentation](https://www.nxp.com/docs/en/data-sheet/MFRC522.pdf)
- [WebSocket Client Library Documentation](https://github.com/Links2004/arduinoWebSockets)

# Smart Cart API Documentation

This document outlines the available API endpoints for the Smart Cart system.

## Base URL

```
http://localhost:5000/api
```

## Authentication

Most endpoints require authentication via JWT token. Include the token in the Authorization header:

```
Authorization: Bearer <your_token>
```

## Endpoints

### Authentication

#### Login

- **URL**: `/auth/login`
- **Method**: `POST`
- **Auth Required**: No
- **Body**:
  ```json
  {
    "username": "string",
    "password": "string"
  }
  ```
- **Success Response**:
  ```json
  {
    "message": "Login successful",
    "token": "jwt_token_string",
    "user": {
      "id": "string",
      "username": "string",
      "role": "admin|customer"
    }
  }
  ```

#### Get Current User

- **URL**: `/auth/me`
- **Method**: `GET`
- **Auth Required**: Yes
- **Success Response**:
  ```json
  {
    "user": {
      "id": "string",
      "username": "string",
      "role": "admin|customer"
    }
  }
  ```

### Products

#### Get All Products

- **URL**: `/products`
- **Method**: `GET`
- **Auth Required**: No
- **Success Response**:
  ```json
  [
    {
      "id": "string",
      "name": "string",
      "price": 0.0,
      "rfidTag": "string",
      "quantity": 0
    }
  ]
  ```

#### Get Product by ID

- **URL**: `/products/:id`
- **Method**: `GET`
- **Auth Required**: No
- **Success Response**:
  ```json
  {
    "id": "string",
    "name": "string",
    "price": 0.0,
    "rfidTag": "string",
    "quantity": 0
  }
  ```

#### Get Product by RFID Tag

- **URL**: `/products/rfid/:tag`
- **Method**: `GET`
- **Auth Required**: No
- **Success Response**:
  ```json
  {
    "id": "string",
    "name": "string",
    "price": 0.0,
    "rfidTag": "string",
    "quantity": 0
  }
  ```

#### Create Product (Admin Only)

- **URL**: `/products`
- **Method**: `POST`
- **Auth Required**: Yes (Admin)
- **Body**:
  ```json
  {
    "name": "string",
    "price": 0.0,
    "rfidTag": "string",
    "quantity": 0
  }
  ```
- **Success Response**:
  ```json
  {
    "id": "string",
    "name": "string",
    "price": 0.0,
    "rfidTag": "string",
    "quantity": 0
  }
  ```

#### Update Product (Admin Only)

- **URL**: `/products/:id`
- **Method**: `PUT`
- **Auth Required**: Yes (Admin)
- **Body**:
  ```json
  {
    "name": "string", // optional
    "price": 0.0, // optional
    "rfidTag": "string", // optional
    "quantity": 0 // optional
  }
  ```
- **Success Response**:
  ```json
  {
    "id": "string",
    "name": "string",
    "price": 0.0,
    "rfidTag": "string",
    "quantity": 0
  }
  ```

#### Delete Product (Admin Only)

- **URL**: `/products/:id`
- **Method**: `DELETE`
- **Auth Required**: Yes (Admin)
- **Success Response**:
  ```json
  {
    "message": "Product deleted successfully",
    "product": {
      "id": "string",
      "name": "string",
      "price": 0.0,
      "rfidTag": "string",
      "quantity": 0
    }
  }
  ```

### Cart

#### Get User's Cart

- **URL**: `/cart`
- **Method**: `GET`
- **Auth Required**: Yes
- **Success Response**:
  ```json
  {
    "userId": "string",
    "items": [
      {
        "id": "string",
        "name": "string",
        "price": 0.0,
        "rfidTag": "string",
        "quantity": 0
      }
    ],
    "total": 0.0
  }
  ```

#### Add Item to Cart

- **URL**: `/cart/add`
- **Method**: `POST`
- **Auth Required**: Yes
- **Body**:
  ```json
  {
    "productId": "string",
    "quantity": 1 // optional, defaults to 1
  }
  ```
- **Success Response**:
  ```json
  {
    "userId": "string",
    "items": [
      {
        "id": "string",
        "name": "string",
        "price": 0.0,
        "rfidTag": "string",
        "quantity": 0
      }
    ],
    "total": 0.0
  }
  ```

#### Remove Item from Cart

- **URL**: `/cart/remove`
- **Method**: `POST`
- **Auth Required**: Yes
- **Body**:
  ```json
  {
    "productId": "string",
    "quantity": 1 // optional, defaults to 1
  }
  ```
- **Success Response**:
  ```json
  {
    "userId": "string",
    "items": [
      {
        "id": "string",
        "name": "string",
        "price": 0.0,
        "rfidTag": "string",
        "quantity": 0
      }
    ],
    "total": 0.0
  }
  ```

#### Clear Cart

- **URL**: `/cart/clear`
- **Method**: `DELETE`
- **Auth Required**: Yes
- **Success Response**:
  ```json
  {
    "userId": "string",
    "items": [],
    "total": 0
  }
  ```

#### RFID Scan

- **URL**: `/cart/rfid-scan`
- **Method**: `POST`
- **Auth Required**: Yes
- **Body**:
  ```json
  {
    "rfidTag": "string",
    "action": "add|remove"
  }
  ```
- **Success Response**:
  ```json
  {
    "message": "Product added to|removed from cart",
    "cart": {
      "userId": "string",
      "items": [
        {
          "id": "string",
          "name": "string",
          "price": 0.0,
          "rfidTag": "string",
          "quantity": 0
        }
      ],
      "total": 0.0
    },
    "product": {
      "id": "string",
      "name": "string",
      "price": 0.0,
      "rfidTag": "string",
      "quantity": 0
    }
  }
  ```

### Payment

#### Get Razorpay Key

- **URL**: `/payment/key`
- **Method**: `GET`
- **Auth Required**: No
- **Success Response**:
  ```json
  {
    "key": "rzp_test_your_key_id"
  }
  ```

#### Create Payment Order

- **URL**: `/payment/create-order`
- **Method**: `POST`
- **Auth Required**: Yes
- **Success Response**:
  ```json
  {
    "orderId": "string",
    "amount": 0.0,
    "currency": "INR",
    "cartTotal": 0.0
  }
  ```

#### Verify Payment

- **URL**: `/payment/verify`
- **Method**: `POST`
- **Auth Required**: Yes
- **Body**:
  ```json
  {
    "paymentId": "string",
    "orderId": "string",
    "signature": "string"
  }
  ```
- **Success Response**:
  ```json
  {
    "success": true,
    "message": "Payment successful and order processed",
    "orderId": "string",
    "paymentId": "string",
    "amount": 0.0
  }
  ```

## WebSocket Events

The Smart Cart system uses Socket.IO for real-time updates.

### Server to Client Events

- **product_scanned**: Emitted when a product is scanned via RFID

  ```json
  {
    "product": {
      "id": "string",
      "name": "string",
      "price": 0.0,
      "rfidTag": "string",
      "quantity": 0
    },
    "action": "add|remove"
  }
  ```

- **cart_updated**: Emitted when a cart is updated

  ```json
  {
    "userId": "string",
    "carts": [
      {
        "userId": "string",
        "items": [
          {
            "id": "string",
            "name": "string",
            "price": 0.0,
            "rfidTag": "string",
            "quantity": 0
          }
        ],
        "total": 0.0
      }
    ]
  }
  ```

- **inventory_updated**: Emitted when inventory quantities change

  ```json
  {
    "products": [
      {
        "id": "string",
        "name": "string",
        "price": 0.0,
        "rfidTag": "string",
        "quantity": 0
      }
    ]
  }
  ```

- **error**: Emitted when an error occurs
  ```json
  {
    "message": "string"
  }
  ```

### Client to Server Events

- **rfid_scan**: Emit to simulate an RFID scan

  ```json
  {
    "rfidTag": "string",
    "action": "add|remove",
    "userId": "string"
  }
  ```

- **inventory_update**: Emit to update a product's inventory

  ```json
  {
    "productId": "string",
    "quantity": 0
  }
  ```

- **payment_completed**: Emit when a payment is completed
  ```json
  {
    "userId": "string",
    "orderId": "string",
    "paymentId": "string"
  }
  ```
